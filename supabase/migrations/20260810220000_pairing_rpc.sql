-- ================================================================
-- Migration: 0002_pairing_rpc.sql
-- Purpose: Adds RPC functions to safely bypass RLS during onboarding
-- ================================================================

-- ----------------------------------------------------------------
-- FUNCTION: create_space(space_name text)
-- Creates a space and immediately pairs the creator to it.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_space(space_name text DEFAULT 'Our Space')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_space_id uuid;
  new_invite_code text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert into spaces (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.spaces (name, created_by)
  VALUES (space_name, current_user_id)
  RETURNING id, invite_code INTO new_space_id, new_invite_code;

  -- 2. Insert into space_members
  INSERT INTO public.space_members (space_id, user_id, is_active)
  VALUES (new_space_id, current_user_id, true);

  -- 3. Return the generated space info
  RETURN json_build_object(
    'id', new_space_id, 
    'invite_code', new_invite_code
  );
END;
$$;


-- ----------------------------------------------------------------
-- FUNCTION: join_space(join_code text)
-- Allows a user to join an existing space using its 6-character code.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_space(join_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_space_id uuid;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Find the space by the exact invite code (case-insensitive just in case)
  SELECT id INTO target_space_id
  FROM public.spaces
  WHERE upper(invite_code) = upper(join_code);

  IF target_space_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- 2. Insert or update the user in space_members
  INSERT INTO public.space_members (space_id, user_id, is_active)
  VALUES (target_space_id, current_user_id, true)
  ON CONFLICT (space_id, user_id) 
  DO UPDATE SET is_active = true, joined_at = now();

  -- 3. Return the space id
  RETURN json_build_object(
    'id', target_space_id
  );
END;
$$;
