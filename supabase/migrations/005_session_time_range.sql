-- ============================================
-- Migration 005: Session Time Range Support
-- Replaces single 'time' with 'start_time' + 'end_time'
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Rename existing 'time' column to 'start_time'
ALTER TABLE public.sessions RENAME COLUMN time TO start_time;

-- 2. Add end_time column with a temporary default
ALTER TABLE public.sessions ADD COLUMN end_time TIME NOT NULL DEFAULT '11:00';

-- 3. Backfill existing rows: set end_time = start_time + 2 hours
UPDATE public.sessions SET end_time = start_time + INTERVAL '2 hours';

-- 4. Remove the temporary default
ALTER TABLE public.sessions ALTER COLUMN end_time DROP DEFAULT;
