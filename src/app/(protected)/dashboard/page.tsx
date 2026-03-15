import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupSessionCard } from "@/components/groups/group-session-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Trophy, Users, Zap, Swords, Plus, Flame, Clock, Activity } from "lucide-react";
import { format } from "date-fns";
import { sessionMinutes, formatCourtTime, getWeekStart, calcStreak } from "@/lib/utils/session-utils";

const GROUP_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-yellow-500",
];

function groupColor(name: string) {
  const code = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GROUP_COLORS[code % GROUP_COLORS.length];
}

interface Achievement {
  label: string;
  icon: string;
  description: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, profile_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) redirect("/profile/complete");

  const now = new Date();
  // Use local date parts to avoid UTC shift (critical for UTC+5:30 and similar timezones)
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nextWeekDate = new Date(now); nextWeekDate.setDate(now.getDate() + 7);
  const nextWeek = `${nextWeekDate.getFullYear()}-${pad(nextWeekDate.getMonth() + 1)}-${pad(nextWeekDate.getDate())}`;
  const weekStartDate = getWeekStart(now);
  const weekStartStr = `${weekStartDate.getFullYear()}-${pad(weekStartDate.getMonth() + 1)}-${pad(weekStartDate.getDate())}`;
  const weekStartISO = weekStartDate.toISOString();

  // 3 months back for streak calculation
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

  const [
    { data: myMemberships },
    { data: myStats },
    { data: recentMatchPlayers },
    { data: weekSessionParticipants },
    { data: weekGroupRsvps },
    { data: weekMatchPlayers },
    { data: streakSessions },
    { data: streakGroupRsvps },
  ] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id, role, recurring_groups(id, name)")
      .eq("user_id", user.id),
    supabase
      .from("player_group_stats")
      .select("matches_played, wins, rank")
      .eq("player_id", user.id),
    supabase
      .from("match_players")
      .select("is_winner, matches!inner(id, status, played_at)")
      .eq("player_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    // Public sessions joined this week
    supabase
      .from("session_participants")
      .select("sessions!inner(id, date, start_time, end_time, game_type, status)")
      .eq("user_id", user.id)
      .gte("sessions.date", weekStartStr)
      .lte("sessions.date", today)
      .neq("sessions.status", "cancelled"),
    // Group sessions RSVPd 'going' this week
    supabase
      .from("group_session_rsvps")
      .select("sessions!inner(id, date, start_time, end_time, game_type, status)")
      .eq("user_id", user.id)
      .eq("status", "yes")
      .gte("sessions.date", weekStartStr)
      .lte("sessions.date", today)
      .neq("sessions.status", "cancelled"),
    // Matches played this week
    supabase
      .from("match_players")
      .select("matches!inner(id, status)")
      .eq("player_id", user.id)
      .gte("matches.played_at", weekStartISO)
      .eq("matches.status", "completed"),
    // Public session dates in last 3 months (for streak)
    supabase
      .from("session_participants")
      .select("sessions!inner(date, status)")
      .eq("user_id", user.id)
      .gte("sessions.date", threeMonthsAgoStr)
      .lte("sessions.date", today)
      .neq("sessions.status", "cancelled"),
    // Group session dates in last 3 months (for streak)
    supabase
      .from("group_session_rsvps")
      .select("sessions!inner(date, status)")
      .eq("user_id", user.id)
      .eq("status", "yes")
      .gte("sessions.date", threeMonthsAgoStr)
      .lte("sessions.date", today)
      .neq("sessions.status", "cancelled"),
  ]);

  const groupIds = (myMemberships ?? []).map((m) => m.group_id);

  let upcomingSessions: {
    id: string;
    group_id: string | null;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    title: string;
    status: string;
    group_session_rsvps: { id: string; session_id: string; user_id: string; status: string; updated_at: string }[];
    [key: string]: unknown;
  }[] = [];

  let allGroupMembers: {
    id: string;
    group_id: string;
    user_id: string;
    role: string;
    joined_at: string;
    profiles: { id: string; full_name: string | null; avatar_url: string | null; skill_level: string | null };
  }[] = [];

  if (groupIds.length > 0) {
    const [sessResult, membResult] = await Promise.all([
      supabase
        .from("sessions")
        .select("*, group_session_rsvps(*)")
        .in("group_id", groupIds)
        .gte("date", today)
        .lte("date", nextWeek)
        .neq("status", "cancelled")
        .order("date", { ascending: true }),
      supabase
        .from("group_members")
        .select("*, profiles(id, full_name, avatar_url, skill_level)")
        .in("group_id", groupIds),
    ]);
    upcomingSessions = (sessResult.data ?? []) as typeof upcomingSessions;
    allGroupMembers = (membResult.data ?? []) as typeof allGroupMembers;
  }

  const totalMatches = (myStats ?? []).reduce((s, r) => s + r.matches_played, 0);
  const totalWins = (myStats ?? []).reduce((s, r) => s + r.wins, 0);
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : null;
  const isRankOne = (myStats ?? []).some((s) => s.rank === 1);

  // Activity this week — merge public + group sessions, deduplicate by id
  const nowTimeMinutes = now.getHours() * 60 + now.getMinutes();
  type SessionRow = { id: string; date: string; start_time: string; end_time: string; game_type: string; status: string };
  const allWeekRaw = [
    ...(weekSessionParticipants ?? []).map((p) => (p as unknown as { sessions: SessionRow }).sessions),
    ...(weekGroupRsvps ?? []).map((p) => (p as unknown as { sessions: SessionRow }).sessions),
  ].filter(Boolean);
  const seenIds = new Set<string>();
  const weekSessions = allWeekRaw
    .filter((s) => { if (seenIds.has(s.id)) return false; seenIds.add(s.id); return true; })
    // Exclude future sessions (tomorrow+) and today's sessions that haven't started yet
    .filter((s) => {
      if (s.date > today) return false;
      if (s.date < today) return true;
      const [sh, sm] = s.start_time.split(":").map(Number);
      return sh * 60 + sm <= nowTimeMinutes;
    });
  const sessionsToday = weekSessions.filter((s) => s.date === today).length;
  const sessionsThisWeek = weekSessions.length;
  const courtMinutesThisWeek = weekSessions.reduce(
    (sum, s) => sum + sessionMinutes(s.start_time, s.end_time),
    0
  );
  const matchesThisWeek = (weekMatchPlayers ?? []).length;

  // Weekly streak — combine public + group session dates, deduplicate
  const allSessionDates = [
    ...(streakSessions ?? []).map((p) => (p as unknown as { sessions: { date: string } }).sessions?.date),
    ...(streakGroupRsvps ?? []).map((p) => (p as unknown as { sessions: { date: string } }).sessions?.date),
  ].filter(Boolean) as string[];
  const weekStreak = calcStreak([...new Set(allSessionDates)], now);

  const recentForm = (recentMatchPlayers ?? [])
    .filter((mp) => (mp.matches as unknown as { status: string } | null)?.status === "completed")
    .slice(0, 5);

  const unlockedAchievements: Achievement[] = [];
  if (totalMatches >= 1) unlockedAchievements.push({ label: "First Match", icon: "🏸", description: "Played your first match" });
  if (totalWins >= 1) unlockedAchievements.push({ label: "First Win", icon: "⭐", description: "Won your first match" });
  if (totalMatches >= 10) unlockedAchievements.push({ label: "10 Matches", icon: "🎯", description: "Played 10 matches" });
  if (totalWins >= 10) unlockedAchievements.push({ label: "10 Wins", icon: "🏆", description: "Won 10 matches" });
  if (totalMatches >= 25) unlockedAchievements.push({ label: "25 Matches", icon: "🔥", description: "Played 25 matches" });
  if (totalWins >= 25) unlockedAchievements.push({ label: "25 Wins", icon: "👑", description: "Won 25 matches" });
  if (totalMatches >= 50) unlockedAchievements.push({ label: "50 Matches", icon: "💎", description: "Played 50 matches" });
  if (isRankOne) unlockedAchievements.push({ label: "Reached #1", icon: "🥇", description: "Ranked #1 in a group" });

  const groupMap = new Map(
    (myMemberships ?? []).map((m) => {
      const g = m.recurring_groups as unknown as { id: string; name: string } | null;
      return [m.group_id, { name: g?.name ?? "Group", role: m.role as string }];
    }),
  );

  const sessionsByGroup = new Map<string, (typeof upcomingSessions)[0]>();
  for (const session of upcomingSessions) {
    if (session.group_id && !sessionsByGroup.has(session.group_id)) {
      sessionsByGroup.set(session.group_id, session);
    }
  }

  const membersByGroup = new Map<string, typeof allGroupMembers>();
  for (const member of allGroupMembers) {
    if (!membersByGroup.has(member.group_id)) membersByGroup.set(member.group_id, []);
    membersByGroup.get(member.group_id)!.push(member);
  }

  const firstName = profile.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="min-h-screen">
      {/* Greeting Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 dark:from-emerald-900 dark:via-emerald-800 dark:to-teal-900">
        {/* Dot grid */}
        <div className="hero-grid absolute inset-0 text-white/[0.06] pointer-events-none" />
        {/* Orbs */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-glow-pulse pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-teal-300/10 blur-2xl animate-glow-pulse [animation-delay:2s] pointer-events-none" />
        <div className="relative container max-w-2xl mx-auto px-4 py-8">
          <p className="text-emerald-100 text-sm mb-1">{todayLabel}</p>
          <h1 className="text-2xl font-bold text-white">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-emerald-100 text-sm mt-1">Here&apos;s what&apos;s on this week.</p>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <Link href="/sessions/new">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Session
              </Button>
            </Link>
            <Link href="/groups">
              <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                My Groups
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Activity this week */}
        {(sessionsThisWeek > 0 || weekStreak > 0) && (
          <Card className="overflow-hidden">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  Your Activity
                </h2>
                {weekStreak > 1 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-500">
                    <Flame className="h-3.5 w-3.5" />
                    {weekStreak}-week streak
                  </span>
                )}
              </div>

              {sessionsThisWeek > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {sessionsThisWeek}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionsThisWeek === 1 ? "session" : "sessions"} this week
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold">
                        <Clock className="h-4 w-4 inline mr-0.5 text-blue-500" />
                        {formatCourtTime(courtMinutesThisWeek)}
                      </p>
                      <p className="text-xs text-muted-foreground">court time</p>
                    </div>
                    {matchesThisWeek > 0 && (
                      <div className="text-center">
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {matchesThisWeek}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {matchesThisWeek === 1 ? "match" : "matches"} played
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No sessions played yet this week.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Career stats strip — only if matches played */}
        {totalMatches > 0 && (
          <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Trophy className="h-3 w-3" /> Career Stats
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalMatches}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Matches</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalWins}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Wins</p>
            </div>
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{winRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Win rate</p>
            </div>
          </div>
          </div>
        )}

        {/* Groups This Week */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              This Week
            </h2>
            <Link href="/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              All groups →
            </Link>
          </div>

          {groupIds.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">No groups yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Create or join a group to see sessions here.</p>
                </div>
                <Link href="/groups/new">
                  <Button size="sm" className="mt-1">Create a group</Button>
                </Link>
              </CardContent>
            </Card>
          ) : sessionsByGroup.size === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium">No sessions this week</p>
                <p className="text-xs text-muted-foreground mt-1">Your groups have nothing scheduled in the next 7 days.</p>
              </CardContent>
            </Card>
          ) : (
            Array.from(sessionsByGroup.entries()).map(([groupId, session]) => {
              const group = groupMap.get(groupId);
              const members = membersByGroup.get(groupId) ?? [];
              const canManage = group?.role === "owner" || group?.role === "admin";
              return (
                <div key={groupId} className="space-y-1.5">
                  <div className="flex items-center gap-2 px-1">
                    <div
                      className={`h-5 w-5 rounded-full ${groupColor(group?.name ?? "")} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                    >
                      {(group?.name ?? "G")[0].toUpperCase()}
                    </div>
                    <Link href={`/groups/${groupId}`} className="text-sm font-semibold hover:underline">
                      {group?.name ?? "Group"}
                    </Link>
                  </div>
                  <GroupSessionCard
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    session={session as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    groupMembers={members as any}
                    currentUserId={user.id}
                    canManage={canManage}
                  />
                </div>
              );
            })
          )}
        </section>

        {/* Recent Form + Achievements side by side (if both exist) */}
        {(recentForm.length > 0 || unlockedAchievements.length > 0) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {recentForm.length > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                    Recent Form
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {recentForm.map((mp, i) => (
                      <div
                        key={i}
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                          mp.is_winner
                            ? "bg-emerald-500 shadow-emerald-500/30"
                            : "bg-red-400 shadow-red-400/30"
                        }`}
                        title={mp.is_winner ? "Win" : "Loss"}
                      >
                        {mp.is_winner ? "W" : "L"}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last {recentForm.length} {recentForm.length === 1 ? "match" : "matches"}
                  </p>
                </CardContent>
              </Card>
            )}

            {unlockedAchievements.length > 0 && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                    Achievements
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{unlockedAchievements.length} unlocked</span>
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {unlockedAchievements.map((a) => (
                      <span
                        key={a.label}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                        title={a.description}
                      >
                        {a.icon} {a.label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* No matches yet — prompt to log one */}
        {totalMatches === 0 && groupIds.length > 0 && (
          <Card className="border-dashed">
            <CardContent className="py-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Swords className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">No matches logged yet</p>
                <p className="text-xs text-muted-foreground">Head to a group to log your first match and start tracking your stats.</p>
              </div>
              <Link href="/groups" className="shrink-0">
                <Button size="sm" variant="outline">Go to Groups</Button>
              </Link>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
