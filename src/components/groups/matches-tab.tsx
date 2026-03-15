"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Trophy, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { voidMatch } from "@/lib/actions/matches";
import { LogMatchModal } from "./log-match-modal";
import type { MatchWithPlayers, GroupMember, Profile } from "@/lib/types/database";

interface MatchesTabProps {
  groupId: string;
  matches: MatchWithPlayers[];
  groupMembers: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
  canManage: boolean;
  loggableSessions: { id: string; date: string; start_time: string }[];
}

function getInitials(name: string | null) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";
}

function MatchCard({
  match,
  canManage,
  onVoid,
  isPending,
}: {
  match: MatchWithPlayers;
  canManage: boolean;
  onVoid: (id: string) => void;
  isPending: boolean;
}) {
  const [confirmVoid, setConfirmVoid] = useState(false);

  const team1Players = match.match_players.filter((p) => p.team === 1);
  const team2Players = match.match_players.filter((p) => p.team === 2);

  const t1Ref = team1Players[0];
  const t2Ref = team2Players[0];

  const winnerTeam = team1Players[0]?.is_winner ? 1 : team2Players[0]?.is_winner ? 2 : null;

  const sets = [
    t1Ref?.score_set1 != null && t2Ref?.score_set1 != null
      ? `${t1Ref.score_set1}–${t2Ref.score_set1}`
      : null,
    t1Ref?.score_set2 != null && t2Ref?.score_set2 != null
      ? `${t1Ref.score_set2}–${t2Ref.score_set2}`
      : null,
    t1Ref?.score_set3 != null && t2Ref?.score_set3 != null
      ? `${t1Ref.score_set3}–${t2Ref.score_set3}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {match.format}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(match.played_at), "MMM d, yyyy")}
            </span>
          </div>
          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              {!confirmVoid ? (
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmVoid(true)}
                  disabled={isPending}
                >
                  void
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Void?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => onVoid(match.id)}
                    disabled={isPending}
                  >
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px]"
                    onClick={() => setConfirmVoid(false)}
                    disabled={isPending}
                  >
                    No
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="flex items-center gap-3">
          {/* Team 1 */}
          <div className={`flex-1 ${winnerTeam === 1 ? "font-semibold" : ""}`}>
            {winnerTeam === 1 && <Trophy className="inline h-3 w-3 text-yellow-500 mr-1" />}
            <div className="flex flex-wrap gap-1 items-center">
              {team1Players.map((p) => (
                <div key={p.player_id} className="flex items-center gap-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={(p.profiles as any)?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials((p.profiles as any)?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs truncate max-w-[80px]">
                    {(p.profiles as any)?.full_name ?? "?"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Score */}
          <div className="text-center shrink-0">
            <div className="flex flex-col gap-0.5">
              {sets.map((s, i) => (
                <span key={i} className="text-xs font-mono text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Team 2 */}
          <div className={`flex-1 text-right ${winnerTeam === 2 ? "font-semibold" : ""}`}>
            {winnerTeam === 2 && <Trophy className="inline h-3 w-3 text-yellow-500 mr-1" />}
            <div className="flex flex-wrap gap-1 items-center justify-end">
              {team2Players.map((p) => (
                <div key={p.player_id} className="flex items-center gap-1">
                  <span className="text-xs truncate max-w-[80px]">
                    {(p.profiles as any)?.full_name ?? "?"}
                  </span>
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={(p.profiles as any)?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials((p.profiles as any)?.full_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MatchesTab({ groupId, matches, groupMembers, canManage, loggableSessions }: MatchesTabProps) {
  const [localMatches, setLocalMatches] = useState(matches);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleVoid = (matchId: string) => {
    startTransition(async () => {
      try {
        await voidMatch(matchId);
        setLocalMatches((prev) => prev.filter((m) => m.id !== matchId));
        toast.success("Match voided");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to void match");
      }
    });
  };

  const handleMatchLogged = (newMatch: MatchWithPlayers) => {
    setLocalMatches((prev) => [newMatch, ...prev]);
  };

  return (
    <div className="space-y-3">
      {canManage && loggableSessions.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1" onClick={() => setLogModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Log Match
          </Button>
        </div>
      )}
      {canManage && loggableSessions.length === 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Matches can be logged on the session day and the following day.
        </p>
      )}

      {localMatches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🏸</p>
          <p className="font-medium mb-1">No matches yet</p>
          <p className="text-sm text-muted-foreground">
            {canManage ? "Log the first match to start tracking results." : "Matches will appear here once the admin logs them."}
          </p>
        </div>
      ) : (
        localMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            canManage={canManage}
            onVoid={handleVoid}
            isPending={isPending}
          />
        ))
      )}

      <LogMatchModal
        groupId={groupId}
        groupMembers={groupMembers}
        sessions={loggableSessions}
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        onSuccess={handleMatchLogged}
      />
    </div>
  );
}
