-- Migration 004: Session Edit Feature
-- Adds support for editing sessions with participant re-confirmation

-- Add confirmed + confirmation_deadline to session_participants
ALTER TABLE public.session_participants
  ADD COLUMN confirmed BOOLEAN DEFAULT TRUE,
  ADD COLUMN confirmation_deadline TIMESTAMPTZ;

-- Add last_edited_at to sessions
ALTER TABLE public.sessions
  ADD COLUMN last_edited_at TIMESTAMPTZ;

-- Add is_system_message to session_messages (for auto chat messages)
ALTER TABLE public.session_messages
  ADD COLUMN is_system_message BOOLEAN DEFAULT FALSE;

-- RLS: Participants can update their own participation (confirm attendance)
CREATE POLICY "Users can update own participation"
  ON public.session_participants FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- RLS: Session creators can update participant rows (reset confirmation on edit)
CREATE POLICY "Creators can update session participants"
  ON public.session_participants FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id
      AND s.creator_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id
      AND s.creator_id = (SELECT auth.uid())
    )
  );

-- Index for cleanup queries (finding unconfirmed participants past deadline)
CREATE INDEX idx_participants_confirmed
  ON public.session_participants(confirmed, confirmation_deadline);
