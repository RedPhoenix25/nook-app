-- Add space_id and author_id to daily_prompts
ALTER TABLE public.daily_prompts ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE;
ALTER TABLE public.daily_prompts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop the unique constraint so multiple prompts can exist per date
ALTER TABLE public.daily_prompts DROP CONSTRAINT IF EXISTS daily_prompts_prompt_date_key;

-- Update RLS for daily_prompts to allow spaces to view/insert/update their own prompts
-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can view daily prompts" ON public.daily_prompts;
DROP POLICY IF EXISTS "System can insert daily prompts" ON public.daily_prompts;
DROP POLICY IF EXISTS "Users can view prompts for their space or global ones" ON public.daily_prompts;
DROP POLICY IF EXISTS "Users can insert custom prompts for their space" ON public.daily_prompts;
DROP POLICY IF EXISTS "Users can update prompts they authored or global ones if they claim them" ON public.daily_prompts;
DROP POLICY IF EXISTS "Users can delete custom prompts they authored" ON public.daily_prompts;

-- Create new policies
CREATE POLICY "Users can view prompts for their space or global ones"
ON public.daily_prompts FOR SELECT
USING (
  space_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.space_members sm
    WHERE sm.space_id = daily_prompts.space_id
    AND sm.user_id = auth.uid()
    AND sm.is_active = true
  )
);

CREATE POLICY "Users can insert custom prompts for their space"
ON public.daily_prompts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.space_members sm
    WHERE sm.space_id = daily_prompts.space_id
    AND sm.user_id = auth.uid()
    AND sm.is_active = true
  )
);

CREATE POLICY "Users can update prompts they authored or global ones if they claim them"
ON public.daily_prompts FOR UPDATE
USING (
  author_id = auth.uid() OR
  (space_id IS NULL AND EXISTS (
    SELECT 1 FROM public.space_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.is_active = true
  ))
);

CREATE POLICY "Users can delete custom prompts they authored"
ON public.daily_prompts FOR DELETE
USING (author_id = auth.uid());

-- Update the get_today_prompt RPC to accept a space ID
DROP FUNCTION IF EXISTS public.get_today_prompt();

CREATE OR REPLACE FUNCTION public.get_today_prompt(p_space_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_prompt_record record;
  dummy_prompts text[] := ARRAY[
    'What made you smile today?',
    'What is a memory of us you cherish?',
    'What is something you learned recently?',
    'If you could travel anywhere right now, where would it be?',
    'What is one thing you appreciate about our relationship?',
    'What is your favorite way to relax?',
    'What are you most looking forward to this week?'
  ];
  random_prompt text;
BEGIN
  -- 1. Try to find an existing prompt for today (global or for this space)
  SELECT * INTO today_prompt_record
  FROM public.daily_prompts
  WHERE prompt_date = CURRENT_DATE
  AND (space_id = p_space_id OR space_id IS NULL)
  ORDER BY created_at ASC
  LIMIT 1;

  -- 2. If it doesn't exist, create one for this space!
  IF today_prompt_record IS NULL THEN
    random_prompt := dummy_prompts[floor(random() * array_length(dummy_prompts, 1) + 1)];
    
    INSERT INTO public.daily_prompts (prompt_text, prompt_date, space_id)
    VALUES (random_prompt, CURRENT_DATE, p_space_id)
    RETURNING * INTO today_prompt_record;
  END IF;

  -- 3. Return the primary prompt
  RETURN json_build_object(
    'id', today_prompt_record.id,
    'prompt_text', today_prompt_record.prompt_text,
    'prompt_date', today_prompt_record.prompt_date,
    'space_id', today_prompt_record.space_id,
    'author_id', today_prompt_record.author_id,
    'created_at', today_prompt_record.created_at
  );
END;
$$;
