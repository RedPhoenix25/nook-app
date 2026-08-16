-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions for easy permission checking
DROP FUNCTION IF EXISTS public.is_space_member(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_space_member(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = check_space_id
    AND user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS public.is_space_member_by_path(text) CASCADE;
CREATE OR REPLACE FUNCTION public.is_space_member_by_path(file_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  extracted_space_id UUID;
BEGIN
  BEGIN
    -- The first directory level in the path should be the space_id
    extracted_space_id := CAST((string_to_array(file_path, '/'))[1] AS UUID);
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = extracted_space_id
    AND user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Spaces Policies
CREATE POLICY "Users can view spaces they are members of" 
ON public.spaces FOR SELECT USING (public.is_space_member(id));

CREATE POLICY "Authenticated users can create spaces" 
ON public.spaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update spaces they are members of" 
ON public.spaces FOR UPDATE USING (public.is_space_member(id));

-- 5. Space Members Policies
CREATE POLICY "Users can view their own memberships or shared ones" 
ON public.space_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_space_member(space_id)
);

CREATE POLICY "Users can join a space" 
ON public.space_members FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own membership (e.g., leave)" 
ON public.space_members FOR UPDATE USING (user_id = auth.uid());

-- 6. Notes Policies
CREATE POLICY "Users can view notes in their spaces" 
ON public.notes FOR SELECT USING (public.is_space_member(space_id));

CREATE POLICY "Users can insert notes in their spaces" 
ON public.notes FOR INSERT WITH CHECK (public.is_space_member(space_id) AND author_id = auth.uid());

CREATE POLICY "Users can update notes in their spaces" 
ON public.notes FOR UPDATE USING (public.is_space_member(space_id));

CREATE POLICY "Users can delete notes in their spaces" 
ON public.notes FOR DELETE USING (public.is_space_member(space_id));

-- 7. Daily Prompts Policies
CREATE POLICY "Users can view prompts for their space or global prompts" 
ON public.daily_prompts FOR SELECT USING (
  space_id IS NULL OR public.is_space_member(space_id)
);

CREATE POLICY "Users can insert daily prompts for their space" 
ON public.daily_prompts FOR INSERT WITH CHECK (public.is_space_member(space_id));

CREATE POLICY "Users can update daily prompts for their space" 
ON public.daily_prompts FOR UPDATE USING (public.is_space_member(space_id));

CREATE POLICY "Users can delete daily prompts for their space" 
ON public.daily_prompts FOR DELETE USING (public.is_space_member(space_id));

-- 8. Prompt Responses Policies
CREATE POLICY "Users can view responses in their space" 
ON public.prompt_responses FOR SELECT USING (public.is_space_member(space_id));

CREATE POLICY "Users can insert their own responses in their space" 
ON public.prompt_responses FOR INSERT WITH CHECK (
  public.is_space_member(space_id) AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own responses" 
ON public.prompt_responses FOR UPDATE USING (user_id = auth.uid());

-- 9. Prompts (Global Question Bank) Policies
CREATE POLICY "Prompts are viewable by everyone" 
ON public.prompts FOR SELECT USING (true);
-- Insert/Update/Delete are typically locked down to admin via dashboard

-- 10. Storage Bucket Policies (space_media)
-- Replace 'space_media' if your bucket name is different
CREATE POLICY "Users can view media in their spaces" 
ON storage.objects FOR SELECT USING (
  bucket_id = 'space_media' AND 
  public.is_space_member_by_path(name)
);

CREATE POLICY "Users can upload media to their spaces" 
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'space_media' AND 
  public.is_space_member_by_path(name)
);

CREATE POLICY "Users can update media in their spaces" 
ON storage.objects FOR UPDATE USING (
  bucket_id = 'space_media' AND 
  public.is_space_member_by_path(name)
);

CREATE POLICY "Users can delete media in their spaces" 
ON storage.objects FOR DELETE USING (
  bucket_id = 'space_media' AND 
  public.is_space_member_by_path(name)
);
