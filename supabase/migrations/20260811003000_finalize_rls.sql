-- ================================================================
-- Nook App — Finalize Row-Level Security
-- Migration: 20260811003000_finalize_rls.sql
-- ================================================================

-- 1. PROFILES: Allow users to read profiles of anyone they share a space with
DROP POLICY IF EXISTS "profiles: own row select" ON public.profiles;

CREATE POLICY "profiles: shared space read"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.space_members sm1
      JOIN public.space_members sm2 ON sm1.space_id = sm2.space_id
      WHERE sm1.user_id = auth.uid() AND sm2.user_id = profiles.id
    )
  );

-- 2. Ensure prompt_responses strictly validates space_members for insertion
-- The existing policy checks `is_space_member(space_id)` which is good, but we can be explicit.
DROP POLICY IF EXISTS "prompt_responses: member insert" ON public.prompt_responses;
CREATE POLICY "prompt_responses: member insert"
  ON public.prompt_responses FOR INSERT
  WITH CHECK (
    is_space_member(space_id)
    AND auth.uid() = user_id
  );

-- 3. Ensure notes strictly validates space_members for insertion
DROP POLICY IF EXISTS "notes: member insert" ON public.notes;
CREATE POLICY "notes: member insert"
  ON public.notes FOR INSERT
  WITH CHECK (
    is_space_member(space_id)
    AND auth.uid() = author_id
  );

-- The RLS is now completely sealed!
