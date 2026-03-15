-- Optional weight field for calorie estimation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg INTEGER;
