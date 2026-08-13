-- ================================================================
-- Nook App — Initial Database Schema
-- Migration: 0001_initial_schema.sql
--
-- Rules enforced:
--   • All tables use UUID primary keys.
--   • All entries reference space_id (never user_a_id / user_b_id).
--   • RLS is ENABLED on every table.
--   • Users can only access data in spaces they are active members of.
-- ================================================================

-- Enable pgcrypto for UUID and random string generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- HELPER FUNCTION: generate_invite_code()
-- Returns a unique 6-character alphanumeric invite code.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i      int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ----------------------------------------------------------------
-- TABLE: profiles
-- One row per authenticated user, mirrors auth.users.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL DEFAULT '',
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own row select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: own row update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: own row insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ----------------------------------------------------------------
-- TABLE: spaces
-- A "space" is the shared context between 2+ users.
-- NOTE: RLS policies for spaces are added AFTER space_members exists.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text        NOT NULL UNIQUE DEFAULT generate_invite_code(),
  created_by  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- TABLE: space_members
-- Junction table linking users to spaces.
-- Must be created BEFORE is_space_member() function.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id  uuid        NOT NULL REFERENCES public.spaces(id)  ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean     NOT NULL DEFAULT true,
  UNIQUE (space_id, user_id)
);

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- HELPER FUNCTION: is_space_member()
-- Defined AFTER space_members table exists (SQL language validates at creation time).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_space_member(sid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members
    WHERE space_id = sid
      AND user_id  = auth.uid()
      AND is_active = true
  );
$$;

-- ----------------------------------------------------------------
-- RLS POLICIES: spaces (now that is_space_member() exists)
-- ----------------------------------------------------------------
CREATE POLICY "spaces: member select"
  ON public.spaces FOR SELECT
  USING (is_space_member(id));

CREATE POLICY "spaces: creator insert"
  ON public.spaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "spaces: member update"
  ON public.spaces FOR UPDATE
  USING (is_space_member(id));

-- ----------------------------------------------------------------
-- RLS POLICIES: space_members (now that is_space_member() exists)
-- ----------------------------------------------------------------
CREATE POLICY "space_members: member select"
  ON public.space_members FOR SELECT
  USING (is_space_member(space_id));

CREATE POLICY "space_members: self insert"
  ON public.space_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "space_members: self update"
  ON public.space_members FOR UPDATE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- TABLE: daily_prompts
-- Global prompts curated per date; all spaces share the same prompts.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_prompts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text text        NOT NULL,
  prompt_date date        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_prompts: authenticated read"
  ON public.daily_prompts FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------------------------------
-- TABLE: prompt_responses
-- A user's response to a daily prompt within a space.
-- DUAL-UNLOCK: both responses only become visible once both members submit.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prompt_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid        NOT NULL REFERENCES public.spaces(id)        ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  prompt_id     uuid        NOT NULL REFERENCES public.daily_prompts(id) ON DELETE CASCADE,
  response_text text,
  media_url     text,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, user_id, prompt_id)
);

ALTER TABLE public.prompt_responses ENABLE ROW LEVEL SECURITY;

-- Helper: have ALL active members of a space submitted for a given prompt?
CREATE OR REPLACE FUNCTION both_members_submitted(sid uuid, pid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT (
    (SELECT COUNT(*) FROM public.space_members WHERE space_id = sid AND is_active = true)
    =
    (SELECT COUNT(*) FROM public.prompt_responses WHERE space_id = sid AND prompt_id = pid)
  );
$$;

CREATE POLICY "prompt_responses: own response select"
  ON public.prompt_responses FOR SELECT
  USING (
    is_space_member(space_id)
    AND (user_id = auth.uid() OR both_members_submitted(space_id, prompt_id))
  );

CREATE POLICY "prompt_responses: member insert"
  ON public.prompt_responses FOR INSERT
  WITH CHECK (
    is_space_member(space_id)
    AND auth.uid() = user_id
  );

CREATE POLICY "prompt_responses: own update"
  ON public.prompt_responses FOR UPDATE
  USING (auth.uid() = user_id AND is_space_member(space_id));

-- ----------------------------------------------------------------
-- ENUM + TABLE: notes
-- Shared notes/memories within a space (text, photo, checklist).
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.note_type AS ENUM ('text', 'photo', 'checklist');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.notes (
  id         uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid             NOT NULL REFERENCES public.spaces(id)  ON DELETE CASCADE,
  author_id  uuid             NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text,
  media_url  text,
  note_type  public.note_type NOT NULL DEFAULT 'text',
  created_at timestamptz      NOT NULL DEFAULT now(),
  updated_at timestamptz      NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes: member select"
  ON public.notes FOR SELECT
  USING (is_space_member(space_id));

CREATE POLICY "notes: member insert"
  ON public.notes FOR INSERT
  WITH CHECK (
    is_space_member(space_id)
    AND auth.uid() = author_id
  );

CREATE POLICY "notes: author update"
  ON public.notes FOR UPDATE
  USING (auth.uid() = author_id AND is_space_member(space_id));

CREATE POLICY "notes: author delete"
  ON public.notes FOR DELETE
  USING (auth.uid() = author_id AND is_space_member(space_id));

-- ----------------------------------------------------------------
-- INDEXES for common query patterns
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_space_members_user       ON public.space_members(user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space      ON public.space_members(space_id);
CREATE INDEX IF NOT EXISTS idx_prompt_responses_space   ON public.prompt_responses(space_id);
CREATE INDEX IF NOT EXISTS idx_prompt_responses_prompt  ON public.prompt_responses(prompt_id);
CREATE INDEX IF NOT EXISTS idx_notes_space              ON public.notes(space_id);
CREATE INDEX IF NOT EXISTS idx_notes_author             ON public.notes(author_id);
CREATE INDEX IF NOT EXISTS idx_daily_prompts_date       ON public.daily_prompts(prompt_date);
