-- Migration: delete_space_rpc
-- Secure RPC to delete a space and cascade delete all associated notes, prompts, prompt responses, and memberships

CREATE OR REPLACE FUNCTION delete_space(target_space_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the calling user is an active member of this space
  IF NOT EXISTS (
    SELECT 1 FROM public.space_members 
    WHERE space_id = target_space_id 
      AND user_id = auth.uid() 
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this space';
  END IF;

  -- Delete all related records
  DELETE FROM public.notes WHERE space_id = target_space_id;
  DELETE FROM public.prompt_responses WHERE space_id = target_space_id;
  DELETE FROM public.daily_prompts WHERE space_id = target_space_id;
  DELETE FROM public.space_members WHERE space_id = target_space_id;
  DELETE FROM public.spaces WHERE id = target_space_id;

  RETURN true;
END;
$$;

-- Ensure RLS delete policy exists on spaces
DROP POLICY IF EXISTS "spaces: member delete" ON public.spaces;
CREATE POLICY "spaces: member delete"
  ON public.spaces FOR DELETE
  USING (
    public.is_space_member(id)
  );
