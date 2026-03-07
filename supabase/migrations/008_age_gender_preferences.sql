-- Add date of birth to profiles (for age calculation)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add gender to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Prefer not to say'));

-- Add player preferences to sessions (soft/informational only, no enforcement)
-- Shape: { male_slots?: number, female_slots?: number, min_age?: number, max_age?: number }
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS player_preferences JSONB;
