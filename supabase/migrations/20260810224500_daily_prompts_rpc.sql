-- ================================================================
-- Migration: 0003_daily_prompts_rpc.sql
-- Purpose: Adds RPC function to fetch or create today's daily prompt
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_today_prompt()
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
  -- 1. Try to find an existing prompt for today
  SELECT * INTO today_prompt_record
  FROM public.daily_prompts
  WHERE prompt_date = CURRENT_DATE
  LIMIT 1;

  -- 2. If it doesn't exist, create it!
  IF today_prompt_record IS NULL THEN
    random_prompt := dummy_prompts[floor(random() * array_length(dummy_prompts, 1) + 1)];
    
    -- We use ON CONFLICT DO NOTHING just in case a concurrent request already inserted it
    INSERT INTO public.daily_prompts (prompt_text, prompt_date)
    VALUES (random_prompt, CURRENT_DATE)
    ON CONFLICT (prompt_date) DO NOTHING
    RETURNING * INTO today_prompt_record;

    -- If another request beat us to it, our insert returns null, so we select it again
    IF today_prompt_record IS NULL THEN
      SELECT * INTO today_prompt_record
      FROM public.daily_prompts
      WHERE prompt_date = CURRENT_DATE
      LIMIT 1;
    END IF;
  END IF;

  -- 3. Return the prompt
  RETURN json_build_object(
    'id', today_prompt_record.id,
    'prompt_text', today_prompt_record.prompt_text,
    'prompt_date', today_prompt_record.prompt_date,
    'created_at', today_prompt_record.created_at
  );
END;
$$;
