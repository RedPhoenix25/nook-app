-- Add push token column to profiles table
ALTER TABLE public.profiles
ADD COLUMN expo_push_token text;
