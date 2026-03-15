-- ============================================
-- Migration 009: Match Tracking, Leaderboard & Matchmaking
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. matches: one row per match
CREATE TABLE public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.recurring_groups(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('singles', 'doubles')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled')),
  logged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. match_players: per-player result in each match
--    score_set1/2/3 store THAT PLAYER'S TEAM score for each set
CREATE TABLE public.match_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team INTEGER NOT NULL CHECK (team IN (1, 2)),
  score_set1 INTEGER,
  score_set2 INTEGER,
  score_set3 INTEGER,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. player_group_stats: cached leaderboard stats per player per group
CREATE TABLE public.player_group_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.recurring_groups(id) ON DELETE CASCADE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  is_provisional BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, group_id)
);

-- 4. matchups: generated court assignments per session
CREATE TABLE public.matchups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.recurring_groups(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  generated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('rank_based', 'random', 'manual')),
  courts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_matches_group ON public.matches(group_id, played_at DESC);
CREATE INDEX idx_matches_session ON public.matches(session_id);
CREATE INDEX idx_match_players_match ON public.match_players(match_id);
CREATE INDEX idx_match_players_player ON public.match_players(player_id);
CREATE INDEX idx_player_stats_group ON public.player_group_stats(group_id, rank NULLS LAST);
CREATE INDEX idx_player_stats_player ON public.player_group_stats(player_id);
CREATE INDEX idx_matchups_group ON public.matchups(group_id, created_at DESC);
CREATE INDEX idx_matchups_session ON public.matchups(session_id);

-- Auto-update trigger for player_group_stats (reuses existing function from migration 001)
CREATE TRIGGER update_player_group_stats_updated_at
  BEFORE UPDATE ON public.player_group_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_group_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

-- matches: group members can read; owner/admin can insert & update
CREATE POLICY "Group members can read matches"
  ON public.matches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = matches.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Group admins can log matches"
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = logged_by
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = matches.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Group admins can update matches"
  ON public.matches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = matches.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  );

-- match_players: group members can read; admin client handles inserts (stats recalc uses service role)
CREATE POLICY "Group members can read match players"
  ON public.match_players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = match_players.match_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Group admins can insert match players"
  ON public.match_players FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id = match_players.match_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  );

-- player_group_stats: group members can read; only service role (admin client) can write
CREATE POLICY "Group members can read player stats"
  ON public.player_group_stats FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = player_group_stats.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

-- matchups: group members can read; admins can insert
CREATE POLICY "Group members can read matchups"
  ON public.matchups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = matchups.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Group admins can create matchups"
  ON public.matchups FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = generated_by
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = matchups.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_group_stats;
