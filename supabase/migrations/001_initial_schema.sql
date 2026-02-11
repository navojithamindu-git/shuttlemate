-- ============================================
-- ShuttleMates Database Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Custom types
CREATE TYPE skill_level AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Open');
CREATE TYPE game_type AS ENUM ('Singles', 'Doubles', 'Either');
CREATE TYPE session_status AS ENUM ('open', 'full', 'cancelled', 'completed');

-- 2. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  skill_level skill_level,
  city TEXT,
  bio TEXT,
  avatar_url TEXT,
  profile_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Sessions table
CREATE TABLE public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  skill_level skill_level NOT NULL DEFAULT 'Open',
  game_type game_type NOT NULL DEFAULT 'Either',
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 20),
  status session_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Session participants (junction table)
CREATE TABLE public.session_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- 5. Indexes
CREATE INDEX idx_sessions_date ON public.sessions(date);
CREATE INDEX idx_sessions_city ON public.sessions(city);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_creator ON public.sessions(creator_id);
CREATE INDEX idx_participants_session ON public.session_participants(session_id);
CREATE INDEX idx_participants_user ON public.session_participants(user_id);

-- 6. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

-- Sessions: authenticated can read all, create own, update/delete own
CREATE POLICY "Sessions viewable by authenticated users"
  ON public.sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create sessions"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = creator_id);

CREATE POLICY "Creators can update own sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = creator_id)
  WITH CHECK ((SELECT auth.uid()) = creator_id);

CREATE POLICY "Creators can delete own sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = creator_id);

-- Participants: authenticated can view, users join/leave themselves
CREATE POLICY "Participants viewable by authenticated users"
  ON public.session_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join sessions"
  ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can leave sessions"
  ON public.session_participants FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
