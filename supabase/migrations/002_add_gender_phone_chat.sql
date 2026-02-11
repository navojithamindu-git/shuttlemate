-- ============================================
-- Migration 002: Add gender, phone, and chat
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Add gender type and columns to profiles
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Prefer not to say');

ALTER TABLE public.profiles
  ADD COLUMN gender gender_type,
  ADD COLUMN phone TEXT;

-- 2. Session messages table (chat within a session)
CREATE TABLE public.session_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_messages_session ON public.session_messages(session_id, created_at);

-- 3. Direct messages table (1:1 between players)
CREATE TABLE public.direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dm_participants ON public.direct_messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_dm_receiver ON public.direct_messages(receiver_id, created_at);

-- 4. Enable RLS
ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 5. Session messages policies
-- Only session participants can read messages
CREATE POLICY "Session participants can read messages"
  ON public.session_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_messages.session_id
      AND sp.user_id = (SELECT auth.uid())
    )
  );

-- Only session participants can send messages
CREATE POLICY "Session participants can send messages"
  ON public.session_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_messages.session_id
      AND sp.user_id = (SELECT auth.uid())
    )
  );

-- 6. Direct messages policies
-- Users can read messages they sent or received
CREATE POLICY "Users can read own DMs"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id
  );

-- Users can send DMs (as themselves)
CREATE POLICY "Users can send DMs"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = sender_id);

-- Users can mark their received messages as read
CREATE POLICY "Users can update received DMs"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = receiver_id)
  WITH CHECK ((SELECT auth.uid()) = receiver_id);

-- 7. Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
