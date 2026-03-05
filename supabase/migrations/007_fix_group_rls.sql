-- ============================================
-- Migration 007: Fix infinite recursion in group RLS policies
-- The group_members SELECT policy was querying group_members to check membership,
-- which triggered itself → infinite loop.
-- Fix: SECURITY DEFINER helper functions bypass RLS for membership checks.
-- ============================================

-- 1. Create helper functions (SECURITY DEFINER runs as postgres, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
    AND user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
    AND user_id = (SELECT auth.uid())
    AND role IN ('owner', 'admin')
  );
$$;

-- 2. Drop all the recursive policies

-- recurring_groups
DROP POLICY IF EXISTS "Group members can read their groups" ON public.recurring_groups;
DROP POLICY IF EXISTS "Owners and admins can update groups" ON public.recurring_groups;

-- group_members
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Members can be removed by admins or leave themselves" ON public.group_members;

-- group_messages
DROP POLICY IF EXISTS "Group members can read group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Group members can send messages" ON public.group_messages;

-- group_session_rsvps
DROP POLICY IF EXISTS "Group members can read RSVPs" ON public.group_session_rsvps;

-- group_invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.group_invitations;

-- 3. Re-create all policies using the helper functions (no recursion)

-- recurring_groups
CREATE POLICY "Group members can read their groups"
  ON public.recurring_groups FOR SELECT TO authenticated
  USING (public.is_group_member(id));

CREATE POLICY "Owners and admins can update groups"
  ON public.recurring_groups FOR UPDATE TO authenticated
  USING (public.is_group_admin(id));

-- group_members: use the function for SELECT (prevents recursion)
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

-- INSERT: allow self-insert (owner bootstrapping) OR admin adding someone
CREATE POLICY "Owners and admins can add members"
  ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR public.is_group_admin(group_id)
  );

-- DELETE: self-leave OR admin removing
CREATE POLICY "Members can be removed by admins or leave themselves"
  ON public.group_members FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_group_admin(group_id)
  );

-- group_messages
CREATE POLICY "Group members can read group messages"
  ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "Group members can send messages"
  ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.is_group_member(group_id)
  );

-- group_session_rsvps: check membership via session's group_id
CREATE POLICY "Group members can read RSVPs"
  ON public.group_session_rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = group_session_rsvps.session_id
      AND public.is_group_member(s.group_id)
    )
  );

-- group_invitations
CREATE POLICY "Admins can manage invitations"
  ON public.group_invitations FOR ALL TO authenticated
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));
