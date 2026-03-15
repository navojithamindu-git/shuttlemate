"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { format } from "date-fns";
import type { MatchFormat, MatchupMode, MatchupCourt, MemberWithStats } from "@/lib/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreSet {
  team1: number;
  team2: number;
}

export interface LogMatchData {
  format: MatchFormat;
  sessionId: string;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  scores: {
    set1: ScoreSet;
    set2: ScoreSet;
    set3?: ScoreSet;
  };
}

export interface GenerateMatchupsData {
  sessionId?: string;
  mode: MatchupMode;
  format: MatchFormat;
  playerIds: string[];
  manualCourts?: MatchupCourt[]; // only for manual mode
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectWinningTeam(scores: LogMatchData["scores"]): 1 | 2 | null {
  let team1Sets = 0;
  let team2Sets = 0;

  if (scores.set1.team1 > scores.set1.team2) team1Sets++;
  else if (scores.set1.team2 > scores.set1.team1) team2Sets++;

  if (scores.set2.team1 > scores.set2.team2) team1Sets++;
  else if (scores.set2.team2 > scores.set2.team1) team2Sets++;

  if (scores.set3) {
    if (scores.set3.team1 > scores.set3.team2) team1Sets++;
    else if (scores.set3.team2 > scores.set3.team1) team2Sets++;
  }

  if (team1Sets > team2Sets) return 1;
  if (team2Sets > team1Sets) return 2;
  return null;
}

/** Recalculate stats for affected players then update ranks for the whole group.
 *  Must be called with admin client (bypasses RLS on player_group_stats). */
async function recalculateGroupStats(groupId: string, affectedPlayerIds: string[]) {
  const admin = createAdminClient();

  // For each affected player, count all their completed matches in this group
  for (const playerId of affectedPlayerIds) {
    const { data: playerMatches } = await admin
      .from("match_players")
      .select("is_winner, matches!inner(group_id, status)")
      .eq("player_id", playerId)
      .eq("matches.group_id", groupId)
      .eq("matches.status", "completed");

    const matchesPlayed = playerMatches?.length ?? 0;
    const wins = playerMatches?.filter((m) => m.is_winner).length ?? 0;
    const losses = matchesPlayed - wins;
    const points = wins * 3;
    const isProvisional = matchesPlayed < 5;

    await admin.from("player_group_stats").upsert(
      {
        player_id: playerId,
        group_id: groupId,
        matches_played: matchesPlayed,
        wins,
        losses,
        points,
        is_provisional: isProvisional,
      },
      { onConflict: "player_id,group_id" }
    );
  }

  // Re-rank all players in the group: points DESC, wins DESC
  const { data: allStats } = await admin
    .from("player_group_stats")
    .select("id, points, wins")
    .eq("group_id", groupId)
    .order("points", { ascending: false })
    .order("wins", { ascending: false });

  if (allStats && allStats.length > 0) {
    await Promise.all(
      allStats.map((stat, index) =>
        admin
          .from("player_group_stats")
          .update({ rank: index + 1 })
          .eq("id", stat.id)
      )
    );
  }
}

// ─── Score Validation ─────────────────────────────────────────────────────────

function validateBadmintonScore(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return "Scores must be whole numbers";
  if (a < 0 || b < 0) return "Scores can't be negative";
  if (a === b) return "Scores can't be tied";
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (winner < 21) return `Game must reach 21`;
  if (winner > 30) return "Max score is 30";
  if (winner === 30) {
    if (loser < 28) return "At 30 pts, opponent must have 28 or 29";
    return null;
  }
  if (loser >= 20 && winner - loser < 2) return "Must win by 2 points from deuce";
  if (loser < 20 && winner !== 21) return `Win must be exactly 21 when opponent has less than 20`;
  return null;
}

function validateScores(scores: LogMatchData["scores"]): void {
  const sets: [ScoreSet, string][] = [
    [scores.set1, "Set 1"],
    [scores.set2, "Set 2"],
  ];
  if (scores.set3) sets.push([scores.set3, "Set 3"]);

  for (const [set, label] of sets) {
    const err = validateBadmintonScore(set.team1, set.team2);
    if (err) throw new Error(`${label}: ${err}`);
  }
}

// ─── Log Match ───────────────────────────────────────────────────────────────

export async function logMatch(groupId: string, data: LogMatchData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  validateScores(data.scores);

  // Validate session and logging window
  const { data: session } = await supabase
    .from("sessions")
    .select("date, start_time, status, group_id")
    .eq("id", data.sessionId)
    .single();

  if (!session || session.group_id !== groupId || session.status === "cancelled")
    throw new Error("Invalid session");

  const sessionStart = new Date(`${session.date}T${session.start_time}`);
  const now = new Date();

  if (now < sessionStart) throw new Error("Session has not started yet");

  // Window closes at end of the day after the session date
  const [y, mo, d] = session.date.split("-").map(Number);
  const windowEnd = new Date(y, mo - 1, d + 1);
  windowEnd.setHours(23, 59, 59, 999);
  if (now > windowEnd) throw new Error("Logging window for this session has closed");

  const admin = createAdminClient();
  const winningTeam = detectWinningTeam(data.scores);

  // Insert match
  const { data: match, error: matchError } = await admin
    .from("matches")
    .insert({
      group_id: groupId,
      session_id: data.sessionId,
      format: data.format,
      status: "completed",
      logged_by: user.id,
      played_at: sessionStart.toISOString(),
    })
    .select("id")
    .single();

  if (matchError || !match) throw new Error(matchError?.message ?? "Failed to create match");

  // Build match_players rows
  const playerRows = [
    ...data.team1PlayerIds.map((pid) => ({
      match_id: match.id,
      player_id: pid,
      team: 1 as const,
      score_set1: data.scores.set1.team1,
      score_set2: data.scores.set2.team1,
      score_set3: data.scores.set3?.team1 ?? null,
      is_winner: winningTeam === 1,
    })),
    ...data.team2PlayerIds.map((pid) => ({
      match_id: match.id,
      player_id: pid,
      team: 2 as const,
      score_set1: data.scores.set1.team2,
      score_set2: data.scores.set2.team2,
      score_set3: data.scores.set3?.team2 ?? null,
      is_winner: winningTeam === 2,
    })),
  ];

  const { error: playersError } = await admin.from("match_players").insert(playerRows);
  if (playersError) {
    // Roll back match on failure
    await admin.from("matches").delete().eq("id", match.id);
    throw new Error(playersError.message);
  }

  // Recalculate stats synchronously (so leaderboard is fresh on next page load)
  const allPlayerIds = [...data.team1PlayerIds, ...data.team2PlayerIds];
  await recalculateGroupStats(groupId, allPlayerIds);

  revalidatePath(`/groups/${groupId}`);

  // Notifications in background
  after(async () => {
    try {
      const adminBg = createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      // Fetch group + player names
      const [{ data: group }, { data: profiles }] = await Promise.all([
        adminBg.from("recurring_groups").select("name, owner_id").eq("id", groupId).single(),
        adminBg.from("profiles").select("id, full_name").in("id", allPlayerIds),
      ]);

      const nameMap = new Map(profiles?.map((p) => [p.id, p.full_name ?? "Unknown"]) ?? []);
      const team1Names = data.team1PlayerIds.map((id) => nameMap.get(id) ?? "?").join(" & ");
      const team2Names = data.team2PlayerIds.map((id) => nameMap.get(id) ?? "?").join(" & ");

      const scoreStr = [
        `${data.scores.set1.team1}-${data.scores.set1.team2}`,
        `${data.scores.set2.team1}-${data.scores.set2.team2}`,
        data.scores.set3 ? `${data.scores.set3.team1}-${data.scores.set3.team2}` : null,
      ]
        .filter(Boolean)
        .join(", ");

      const winnerNames = winningTeam === 1 ? team1Names : winningTeam === 2 ? team2Names : "Draw";

      // Post system message in group chat
      await adminBg.from("group_messages").insert({
        group_id: groupId,
        user_id: group?.owner_id ?? user.id,
        content: `🏸 Match logged (${data.format}): ${team1Names} vs ${team2Names} — ${scoreStr} — Winner: ${winnerNames}`,
        is_system_message: true,
      });

      // Email opted-in members
      const { data: members } = await adminBg
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (!members || members.length === 0) return;
      const memberIds = members.map((m) => m.user_id);

      const { data: memberProfiles } = await adminBg
        .from("profiles")
        .select("id, full_name, email_notifications")
        .in("id", memberIds)
        .eq("email_notifications", true);

      if (!memberProfiles || memberProfiles.length === 0) return;

      const { data: authData } = await adminBg.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      authData?.users?.forEach((u) => {
        if (u.email) emailMap.set(u.id, u.email);
      });

      const { sendEmail } = await import("@/lib/email/smtp");
      const groupUrl = `${appUrl}/groups/${groupId}`;

      for (const profile of memberProfiles) {
        const email = emailMap.get(profile.id);
        if (!email) continue;
        try {
          await sendEmail({
            to: email,
            subject: `Match logged in ${group?.name ?? "your group"} — check the leaderboard`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">New match logged</h2>
                <p style="color: #374151; margin: 0 0 16px 0;">A new ${data.format} match has been recorded in <strong>${group?.name}</strong>:</p>
                <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                  <p style="margin: 4px 0; color: #374151; font-size: 14px;">🏸 ${team1Names} vs ${team2Names}</p>
                  <p style="margin: 4px 0; color: #374151; font-size: 14px;">Score: ${scoreStr}</p>
                  <p style="margin: 4px 0; color: #374151; font-size: 14px;">Winner: ${winnerNames}</p>
                </div>
                <a href="${groupUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View Leaderboard</a>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you are a member of ${group?.name} on ShuttleMates.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`Failed to send match notification to ${profile.id}:`, err);
        }
      }
    } catch (err) {
      console.error("Failed to send match notifications:", err);
    }
  });
}

// ─── Void Match ───────────────────────────────────────────────────────────────

export async function voidMatch(matchId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Fetch match to get group_id + affected players
  const { data: match } = await supabase
    .from("matches")
    .select("group_id, match_players(player_id)")
    .eq("id", matchId)
    .single();

  if (!match) throw new Error("Match not found");

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", match.group_id)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  const admin = createAdminClient();
  await admin.from("matches").update({ status: "cancelled" }).eq("id", matchId);

  // Recalculate stats for affected players
  const affectedIds = (match.match_players as { player_id: string }[]).map((p) => p.player_id);
  await recalculateGroupStats(match.group_id, affectedIds);

  revalidatePath(`/groups/${match.group_id}`);
}

// ─── Generate Matchups ────────────────────────────────────────────────────────

function generateRankBased(
  playersWithStats: MemberWithStats[],
  matchFormat: MatchFormat
): MatchupCourt[] {
  const sorted = [...playersWithStats].sort((a, b) => {
    const ra = a.rank ?? 9999;
    const rb = b.rank ?? 9999;
    return ra - rb;
  });

  const courts: MatchupCourt[] = [];
  const perCourt = matchFormat === "singles" ? 2 : 4;

  for (let i = 0; i < Math.floor(sorted.length / perCourt); i++) {
    const slice = sorted.slice(i * perCourt, (i + 1) * perCourt);
    if (matchFormat === "singles") {
      courts.push({ court: i + 1, team1: [slice[0].user_id], team2: [slice[1].user_id] });
    } else {
      // Snake draft: best + worst vs 2nd + 3rd for balanced doubles
      courts.push({
        court: i + 1,
        team1: [slice[0].user_id, slice[3].user_id],
        team2: [slice[1].user_id, slice[2].user_id],
      });
    }
  }
  return courts;
}

function generateRandom(playerIds: string[], matchFormat: MatchFormat): MatchupCourt[] {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const courts: MatchupCourt[] = [];
  const perCourt = matchFormat === "singles" ? 2 : 4;

  for (let i = 0; i < Math.floor(shuffled.length / perCourt); i++) {
    const slice = shuffled.slice(i * perCourt, (i + 1) * perCourt);
    if (matchFormat === "singles") {
      courts.push({ court: i + 1, team1: [slice[0]], team2: [slice[1]] });
    } else {
      courts.push({ court: i + 1, team1: [slice[0], slice[1]], team2: [slice[2], slice[3]] });
    }
  }
  return courts;
}

export async function generateMatchups(groupId: string, data: GenerateMatchupsData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  const admin = createAdminClient();
  let courts: MatchupCourt[] = [];

  if (data.mode === "manual") {
    courts = data.manualCourts ?? [];
  } else if (data.mode === "rank_based") {
    // Fetch stats for selected players
    const { data: stats } = await admin
      .from("player_group_stats")
      .select("player_id, rank, points, is_provisional")
      .eq("group_id", groupId)
      .in("player_id", data.playerIds);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", data.playerIds);

    const statsMap = new Map(stats?.map((s) => [s.player_id, s]) ?? []);
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    const membersWithStats: MemberWithStats[] = data.playerIds.map((id) => ({
      user_id: id,
      role: "member",
      full_name: profileMap.get(id)?.full_name ?? null,
      avatar_url: profileMap.get(id)?.avatar_url ?? null,
      rank: statsMap.get(id)?.rank ?? null,
      points: statsMap.get(id)?.points ?? 0,
      is_provisional: statsMap.get(id)?.is_provisional ?? true,
    }));

    courts = generateRankBased(membersWithStats, data.format);
  } else {
    courts = generateRandom(data.playerIds, data.format);
  }

  // Delete previous matchup for this session (or group if no session)
  if (data.sessionId) {
    await admin.from("matchups").delete().eq("session_id", data.sessionId);
  }

  const { data: matchup, error } = await admin
    .from("matchups")
    .insert({
      group_id: groupId,
      session_id: data.sessionId ?? null,
      generated_by: user.id,
      mode: data.mode,
      courts,
    })
    .select("id, courts")
    .single();

  if (error) throw new Error(error.message);

  // No revalidatePath here — matchup is returned to the modal directly;
  // the page doesn't display matchups so a refresh would just reset modal state.
  return matchup;
}

// ─── Share Matchup to Chat ────────────────────────────────────────────────────

export async function shareMatchupToChat(
  groupId: string,
  courts: MatchupCourt[],
  playerNames: Record<string, string>,
  sessionDate?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  const getName = (id: string) => playerNames[id] ?? "Unknown";

  const lines: string[] = [
    sessionDate
      ? `🏸 Matchups for ${format(new Date(sessionDate + "T00:00:00"), "MMMM d")}:`
      : "🏸 Matchups:",
  ];

  for (const court of courts) {
    const t1 = court.team1.map(getName).join(" & ");
    const t2 = court.team2.map(getName).join(" & ");
    lines.push(`Court ${court.court}: ${t1} vs ${t2}`);
  }

  const admin = createAdminClient();
  const { data: group } = await admin
    .from("recurring_groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  await admin.from("group_messages").insert({
    group_id: groupId,
    user_id: group?.owner_id ?? user.id,
    content: lines.join("\n"),
    is_system_message: true,
  });

  // Also notify opted-in members via email
  after(async () => {
    try {
      const adminBg = createAdminClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      const { data: groupData } = await adminBg
        .from("recurring_groups")
        .select("name")
        .eq("id", groupId)
        .single();

      const { data: members } = await adminBg
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (!members || members.length === 0) return;
      const memberIds = members.map((m) => m.user_id);

      const { data: memberProfiles } = await adminBg
        .from("profiles")
        .select("id, full_name, email_notifications")
        .in("id", memberIds)
        .eq("email_notifications", true);

      if (!memberProfiles || memberProfiles.length === 0) return;

      const { data: authData } = await adminBg.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      authData?.users?.forEach((u) => {
        if (u.email) emailMap.set(u.id, u.email);
      });

      const { sendEmail } = await import("@/lib/email/smtp");
      const groupUrl = `${appUrl}/groups/${groupId}`;
      const courtsHtml = courts
        .map((c) => {
          const t1 = c.team1.map(getName).join(" & ");
          const t2 = c.team2.map(getName).join(" & ");
          return `<p style="margin: 4px 0; color: #374151; font-size: 14px;">Court ${c.court}: ${t1} vs ${t2}</p>`;
        })
        .join("");

      for (const profile of memberProfiles) {
        const email = emailMap.get(profile.id);
        if (!email) continue;
        try {
          await sendEmail({
            to: email,
            subject: `Matchups ready${sessionDate ? ` for ${format(new Date(sessionDate + "T00:00:00"), "MMMM d")}` : ""} — ${groupData?.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Matchups are ready!</h2>
                <p style="color: #374151; margin: 0 0 16px 0;">Court assignments for <strong>${groupData?.name}</strong>:</p>
                <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">${courtsHtml}</div>
                <a href="${groupUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View Group</a>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you are a member of ${groupData?.name} on ShuttleMates.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`Failed to send matchup notification to ${profile.id}:`, err);
        }
      }
    } catch (err) {
      console.error("Failed to send matchup notifications:", err);
    }
  });

  revalidatePath(`/groups/${groupId}`);
}

// ─── Get members with stats (for matchup modal) ───────────────────────────────

export async function getGroupMembersForMatchups(groupId: string): Promise<MemberWithStats[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  const [{ data: members }, { data: stats }] = await Promise.all([
    admin
      .from("group_members")
      .select("user_id, role, profiles(id, full_name, avatar_url)")
      .eq("group_id", groupId),
    admin
      .from("player_group_stats")
      .select("player_id, rank, points, is_provisional")
      .eq("group_id", groupId),
  ]);

  const statsMap = new Map(stats?.map((s) => [s.player_id, s]) ?? []);

  return (members ?? []).map((m) => {
    const profile = m.profiles as unknown as { id: string; full_name: string | null; avatar_url: string | null } | null;
    const stat = statsMap.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      rank: stat?.rank ?? null,
      points: stat?.points ?? 0,
      is_provisional: stat?.is_provisional ?? true,
    };
  });
}

// ─── Get player match history (for leaderboard row expansion) ─────────────────

export async function getPlayerMatchHistory(groupId: string, playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      id,
      format,
      played_at,
      match_players(
        player_id,
        team,
        score_set1,
        score_set2,
        score_set3,
        is_winner,
        profiles(id, full_name, avatar_url)
      )
    `)
    .eq("group_id", groupId)
    .eq("status", "completed")
    .order("played_at", { ascending: false })
    .limit(10);

  // Filter to only matches where playerId participated
  return (matches ?? []).filter((m) =>
    (m.match_players as { player_id: string }[]).some((p) => p.player_id === playerId)
  );
}
