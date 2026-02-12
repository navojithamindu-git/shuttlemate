-- ============================================
-- Migration 003: Message edit, delete & reactions
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Add is_edited and is_deleted columns to direct_messages
ALTER TABLE public.direct_messages
  ADD COLUMN is_edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Add is_edited and is_deleted columns to session_messages
ALTER TABLE public.session_messages
  ADD COLUMN is_edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- 3. Update RLS: allow senders to edit/delete their own direct messages
CREATE POLICY "Senders can update own DMs"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = sender_id)
  WITH CHECK ((SELECT auth.uid()) = sender_id);

-- Drop the old restrictive update policy (only allowed receiver to mark read)
DROP POLICY IF EXISTS "Users can update received DMs" ON public.direct_messages;

-- Re-create a combined update policy: sender can edit, receiver can mark read
CREATE POLICY "Users can update own DMs"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id
  );

-- Drop the duplicate sender-only policy since the combined one covers it
DROP POLICY IF EXISTS "Senders can update own DMs" ON public.direct_messages;

-- 4. Add update policy for session messages (sender can edit own messages)
CREATE POLICY "Users can update own session messages"
  ON public.session_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 5. Create message_reactions table
CREATE TABLE public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  direct_message_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  session_message_id UUID REFERENCES public.session_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each user can only react with same emoji once per message
  CONSTRAINT unique_dm_reaction UNIQUE(user_id, emoji, direct_message_id),
  CONSTRAINT unique_session_reaction UNIQUE(user_id, emoji, session_message_id),
  -- Must reference exactly one message type
  CONSTRAINT one_message_type CHECK (
    (direct_message_id IS NOT NULL AND session_message_id IS NULL) OR
    (direct_message_id IS NULL AND session_message_id IS NOT NULL)
  )
);

CREATE INDEX idx_reactions_dm ON public.message_reactions(direct_message_id);
CREATE INDEX idx_reactions_session ON public.message_reactions(session_message_id);

-- 6. Enable RLS on message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reactions (for messages they can see)
CREATE POLICY "Users can read reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (true);

-- Users can add their own reactions
CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 7. Enable realtime for reactions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
