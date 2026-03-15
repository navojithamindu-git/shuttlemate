"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getPlayerMatchHistory } from "@/lib/actions/matches";
import type { LeaderboardEntry, GroupMember, Profile, GroupMemberRole } from "@/lib/types/database";

interface LeaderboardTabProps {
  groupId: string;
  leaderboard: LeaderboardEntry[];
  groupMembers: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
}

function getInitials(name: string | null) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";
}

function winRate(wins: number, played: number) {
  if (played === 0) return "—";
  return `${Math.round((wins / played) * 100)}%`;
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-muted-foreground text-sm">—</span>;
  if (rank === 1)
    return (
      <span className="flex items-center justify-center">
        <Trophy className="h-4 w-4 text-yellow-500" />
      </span>
    );
  if (rank === 2) return <span className="font-bold text-slate-400 text-sm">2</span>;
  if (rank === 3) return <span className="font-bold text-amber-600 text-sm">3</span>;
  return <span className="text-sm font-medium">{rank}</span>;
}

function MatchHistoryRow({
  match,
  playerId,
}: {
  match: any;
  playerId: string;
}) {
  const playerEntry = match.match_players.find((p: any) => p.player_id === playerId);
  if (!playerEntry) return null;

  const myTeam = playerEntry.team as 1 | 2;
  const oppTeam = myTeam === 1 ? 2 : 1;

  const myTeamPlayers = match.match_players.filter((p: any) => p.team === myTeam);
  const oppTeamPlayers = match.match_players.filter((p: any) => p.team === oppTeam);

  const oppRef = oppTeamPlayers[0];
  const myRef = myTeamPlayers[0];

  const scoreStr = [
    myRef?.score_set1 != null ? `${myRef.score_set1}–${oppRef?.score_set1 ?? "?"}` : null,
    myRef?.score_set2 != null ? `${myRef.score_set2}–${oppRef?.score_set2 ?? "?"}` : null,
    myRef?.score_set3 != null ? `${myRef.score_set3}–${oppRef?.score_set3 ?? "?"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const oppNames = oppTeamPlayers
    .map((p: any) => (p.profiles?.full_name?.split(" ")[0] ?? "?"))
    .join(" & ");

  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <span
        className={`w-8 text-center font-semibold rounded px-1 py-0.5 ${
          playerEntry.is_winner
            ? "bg-green-500/15 text-green-600"
            : "bg-red-500/15 text-red-600"
        }`}
      >
        {playerEntry.is_winner ? "W" : "L"}
      </span>
      <span className="text-muted-foreground capitalize">{match.format}</span>
      <span className="flex-1 text-muted-foreground">vs {oppNames}</span>
      <span className="font-mono">{scoreStr}</span>
      <span className="text-muted-foreground shrink-0">
        {format(new Date(match.played_at), "MMM d")}
      </span>
    </div>
  );
}

function LeaderboardRow({
  entry,
  groupId,
  memberRole,
}: {
  entry: LeaderboardEntry;
  groupId: string;
  memberRole: GroupMemberRole | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleExpand = () => {
    if (!expanded && history === null) {
      startTransition(async () => {
        try {
          const data = await getPlayerMatchHistory(groupId, entry.player_id);
          setHistory(data);
        } catch {
          setHistory([]);
        }
      });
    }
    setExpanded((e) => !e);
  };

  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={handleExpand}
      >
        {/* Rank */}
        <td className="py-3 pl-4 pr-2 w-10 text-center">
          <RankBadge rank={entry.rank} />
        </td>

        {/* Player */}
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={(entry.profiles as any)?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[9px]">
                {getInitials((entry.profiles as any)?.full_name ?? null)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate">
                  {(entry.profiles as any)?.full_name ?? "Unknown"}
                </span>
                {entry.is_provisional && (
                  <span
                    className="text-muted-foreground text-xs cursor-help"
                    title="Provisional — fewer than 5 matches played"
                  >
                    *
                  </span>
                )}
                {memberRole && ["owner", "admin"].includes(memberRole) && (
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
                    {memberRole === "owner" ? "Owner" : "Admin"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Stats */}
        <td className="py-3 pr-2 text-center text-sm">{entry.wins}</td>
        <td className="py-3 pr-2 text-center text-sm text-muted-foreground">{entry.losses}</td>
        <td className="py-3 pr-2 text-center text-sm">{winRate(entry.wins, entry.matches_played)}</td>
        <td className="py-3 pr-4 text-center text-sm font-medium">{entry.points}</td>
        <td className="py-3 pr-3 text-center">
          {isPending ? (
            <span className="text-muted-foreground text-xs">…</span>
          ) : expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
          )}
        </td>
      </tr>

      {/* Expanded match history */}
      {expanded && (
        <tr className="bg-muted/30">
          <td colSpan={7} className="px-4 pb-3 pt-1">
            {history === null || isPending ? (
              <p className="text-xs text-muted-foreground py-2">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No matches yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {history.map((match) => (
                  <MatchHistoryRow key={match.id} match={match} playerId={entry.player_id} />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function LeaderboardTab({ groupId, leaderboard, groupMembers }: LeaderboardTabProps) {
  const roleMap = new Map<string, GroupMemberRole>(
    groupMembers.map((m) => [m.user_id, m.role])
  );

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-3xl mb-2">🏆</p>
        <p className="font-medium mb-1">Leaderboard is empty</p>
        <p className="text-sm text-muted-foreground">Log the first match to start the rankings.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-2 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Player</th>
            <th className="py-2 pr-2 text-center text-xs font-medium text-muted-foreground">W</th>
            <th className="py-2 pr-2 text-center text-xs font-medium text-muted-foreground">L</th>
            <th className="py-2 pr-2 text-center text-xs font-medium text-muted-foreground">Win%</th>
            <th className="py-2 pr-4 text-center text-xs font-medium text-muted-foreground">Pts</th>
            <th className="py-2 pr-3 w-6" />
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => (
            <LeaderboardRow
              key={entry.player_id}
              entry={entry}
              groupId={groupId}
              memberRole={roleMap.get(entry.player_id) ?? null}
            />
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground px-4 py-2">
        * Provisional (fewer than 5 matches) · Tap a row to see match history
      </p>
    </div>
  );
}
