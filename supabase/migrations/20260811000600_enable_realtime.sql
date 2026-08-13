-- ================================================================
-- Migration: 0004_enable_realtime.sql
-- Purpose: Enable Supabase Realtime for notes and prompt_responses
-- ================================================================

-- Add tables to the supabase_realtime publication to broadcast changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prompt_responses;
