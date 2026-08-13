CREATE POLICY "spaces: member delete"
  ON public.spaces FOR DELETE
  USING (
    is_space_member(id)
  );
