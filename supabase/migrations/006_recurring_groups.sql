-- ============================================
-- Migration 006: Recurring Private Groups
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Invite tokens for groups (token-based, no PII search needed)
CREATE TABLE public.group_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,  -- FK added after recurring_groups is created
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Recurring groups (the persistent social hub entity)
CREATE TYPE group_member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.recurring_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  skill_level skill_level NOT NULL DEFAULT 'Open',
  game_type game_type NOT NULL DEFAULT 'Either',
  max_players INTEGER NOT NULL DEFAULT 4 CHECK (max_players >= 2 AND max_players <= 20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now add the FK on group_invitations
ALTER TABLE public.group_invitations
  ADD CONSTRAINT group_invitations_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.recurring_groups(id) ON DELETE CASCADE;

-- 3. Group members with roles
CREATE TABLE public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.recurring_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role group_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 4. Persistent group-level chat (cross-week)
CREATE TABLE public.group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.recurring_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_system_message BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RSVP per session occurrence (yes/maybe/no)
CREATE TYPE rsvp_status AS ENUM ('yes', 'maybe', 'no');

CREATE TABLE public.group_session_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status rsvp_status NOT NULL DEFAULT 'yes',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- 6. Add group_id and is_private to sessions table
ALTER TABLE public.sessions
  ADD COLUMN group_id UUID REFERENCES public.recurring_groups(id) ON DELETE SET NULL,
  ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. Extend message_reactions to support group messages
ALTER TABLE public.message_reactions
  ADD COLUMN group_message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE;

-- Drop old 2-way check constraint and re-add as 3-way
ALTER TABLE public.message_reactions DROP CONSTRAINT one_message_type;
ALTER TABLE public.message_reactions ADD CONSTRAINT one_message_type CHECK (
  (direct_message_id IS NOT NULL AND session_message_id IS NULL AND group_message_id IS NULL) OR
  (direct_message_id IS NULL AND session_message_id IS NOT NULL AND group_message_id IS NULL) OR
  (direct_message_id IS NULL AND session_message_id IS NULL AND group_message_id IS NOT NULL)
);

ALTER TABLE public.message_reactions
  ADD CONSTRAINT unique_group_reaction UNIQUE(user_id, emoji, group_message_id);

-- 8. Indexes
CREATE INDEX idx_sessions_group ON public.sessions(group_id);
CREATE INDEX idx_group_invitations_token ON public.group_invitations(token);
CREATE INDEX idx_group_invitations_group ON public.group_invitations(group_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_messages_group ON public.group_messages(group_id, created_at);
CREATE INDEX idx_rsvps_session ON public.group_session_rsvps(session_id);
CREATE INDEX idx_rsvps_user ON public.group_session_rsvps(user_id);
CREATE INDEX idx_reactions_group ON public.message_reactions(group_message_id);

-- 9. Auto-update trigger for recurring_groups
CREATE TRIGGER update_recurring_groups_updated_at
  BEFORE UPDATE ON public.recurring_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.recurring_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_session_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- recurring_groups: only members can read
CREATE POLICY "Group members can read their groups"
  ON public.recurring_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = recurring_groups.id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.recurring_groups FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Owners and admins can update groups"
  ON public.recurring_groups FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = recurring_groups.id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only owner can delete group"
  ON public.recurring_groups FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

-- group_members: members can read all members of their shared groups
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_members.group_id
      AND gm2.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Owners and admins can add members"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id  -- owner adding themselves on creation
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Members can be removed by admins or leave themselves"
  ON public.group_members FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
    )
  );

-- group_messages
CREATE POLICY "Group members can read group messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Group members can send messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_messages.group_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own group messages"
  ON public.group_messages FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- group_session_rsvps
CREATE POLICY "Group members can read RSVPs"
  ON public.group_session_rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = group_session_rsvps.session_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can set own RSVP"
  ON public.group_session_rsvps FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Members can update own RSVP"
  ON public.group_session_rsvps FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- group_invitations: only admins can manage; anyone (via admin client) can read by token
CREATE POLICY "Admins can manage invitations"
  ON public.group_invitations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invitations.group_id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_invitations.group_id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
    )
  );

-- Update sessions SELECT policy: private sessions only visible to group members
DROP POLICY IF EXISTS "Sessions viewable by authenticated users" ON public.sessions;

CREATE POLICY "Sessions viewable by authenticated users"
  ON public.sessions FOR SELECT TO authenticated
  USING (
    is_private = FALSE
    OR (SELECT auth.uid()) = creator_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = sessions.group_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

-- Also allow unauthenticated reads for public sessions (needed for admin client bypass pattern)
-- The admin client bypasses RLS so this is handled in app code, not here.

-- 10. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_session_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
