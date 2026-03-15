"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, MessageSquare, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  generateMatchups,
  shareMatchupToChat,
  getGroupMembersForMatchups,
} from "@/lib/actions/matches";
import type { MatchFormat, MatchupMode, MatchupCourt, MemberWithStats } from "@/lib/types/database";

interface GenerateMatchupsModalProps {
  groupId: string;
  sessionId?: string;
  sessionDate?: string; // YYYY-MM-DD for display
  rsvpYesIds: string[]; // pre-fill from RSVPs
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name: string | null) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";
}

function PlayerBadge({
  member,
  selected,
  onClick,
}: {
  member: MemberWithStats;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors border ${
        selected
          ? "bg-primary/10 border-primary/30"
          : "border-transparent hover:bg-muted"
      }`}
    >
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={member.avatar_url ?? undefined} />
        <AvatarFallback className="text-[8px]">{getInitials(member.full_name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm flex-1 truncate">{member.full_name ?? "Unknown"}</span>
      {member.rank !== null ? (
        <span className="text-[10px] text-muted-foreground shrink-0">#{member.rank}{member.is_provisional ? "*" : ""}</span>
      ) : (
        <span className="text-[10px] text-muted-foreground shrink-0">unranked</span>
      )}
    </button>
  );
}

interface ManualCourtProps {
  courtIndex: number;
  matchFormat: MatchFormat;
  allMembers: MemberWithStats[];
  court: MatchupCourt;
  usedIds: Set<string>;
  onChange: (court: MatchupCourt) => void;
  onRemove: () => void;
}

function ManualCourt({
  courtIndex,
  matchFormat,
  allMembers,
  court,
  usedIds,
  onChange,
  onRemove,
}: ManualCourtProps) {
  const slotsPerTeam = matchFormat === "singles" ? 1 : 2;

  const assignPlayer = (team: 1 | 2, slotIndex: number, playerId: string) => {
    const updated = { ...court };
    if (team === 1) {
      const arr = [...updated.team1];
      arr[slotIndex] = playerId;
      updated.team1 = arr;
    } else {
      const arr = [...updated.team2];
      arr[slotIndex] = playerId;
      updated.team2 = arr;
    }
    onChange(updated);
  };

  const removePlayer = (team: 1 | 2, slotIndex: number) => {
    const updated = { ...court };
    if (team === 1) {
      const arr = [...updated.team1];
      arr.splice(slotIndex, 1);
      updated.team1 = arr;
    } else {
      const arr = [...updated.team2];
      arr.splice(slotIndex, 1);
      updated.team2 = arr;
    }
    onChange(updated);
  };

  const availableForSlot = (team: 1 | 2, slotIndex: number) => {
    const currentInSlot = team === 1 ? court.team1[slotIndex] : court.team2[slotIndex];
    return allMembers.filter(
      (m) => !usedIds.has(m.user_id) || m.user_id === currentInSlot
    );
  };

  const renderTeam = (team: 1 | 2) => {
    const slots = team === 1 ? court.team1 : court.team2;
    return (
      <div className="flex-1 space-y-1">
        <p className={`text-xs font-medium ${team === 1 ? "text-blue-500" : "text-orange-500"}`}>
          Team {team}
        </p>
        {Array.from({ length: slotsPerTeam }).map((_, i) => {
          const playerId = slots[i] ?? "";
          const member = allMembers.find((m) => m.user_id === playerId);
          return (
            <div key={i}>
              {member ? (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${team === 1 ? "bg-blue-500/10" : "bg-orange-500/10"}`}>
                  <span className="text-xs flex-1 truncate">{member.full_name ?? "?"}</span>
                  <button
                    type="button"
                    onClick={() => removePlayer(team, i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <select
                  className="w-full text-xs border rounded-md px-2 py-1.5 bg-background"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) assignPlayer(team, i, e.target.value);
                  }}
                >
                  <option value="">Pick player…</option>
                  {availableForSlot(team, i).map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.full_name ?? "Unknown"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Court {courtIndex + 1}
        </span>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-3">
        {renderTeam(1)}
        <div className="flex items-center self-center">
          <span className="text-xs text-muted-foreground font-bold">vs</span>
        </div>
        {renderTeam(2)}
      </div>
    </div>
  );
}

export function GenerateMatchupsModal({
  groupId,
  sessionId,
  sessionDate,
  rsvpYesIds,
  open,
  onOpenChange,
}: GenerateMatchupsModalProps) {
  const [mode, setMode] = useState<MatchupMode>("rank_based");
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("singles");
  const [allMembers, setAllMembers] = useState<MemberWithStats[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(rsvpYesIds));
  const [generatedCourts, setGeneratedCourts] = useState<MatchupCourt[] | null>(null);
  const [manualCourts, setManualCourts] = useState<MatchupCourt[]>([]);
  const [sharedToChat, setSharedToChat] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const router = useRouter();

  // Fetch members + stats when modal opens
  useEffect(() => {
    if (!open) return;
    setIsLoadingMembers(true);
    setGeneratedCourts(null);
    setSharedToChat(false);
    getGroupMembersForMatchups(groupId)
      .then((members) => {
        setAllMembers(members);
        // Pre-select RSVP yes players that are actually members
        const memberIds = new Set(members.map((m) => m.user_id));
        setSelectedIds(new Set(rsvpYesIds.filter((id) => memberIds.has(id))));
      })
      .catch(() => toast.error("Failed to load members"))
      .finally(() => setIsLoadingMembers(false));
  }, [open, groupId, rsvpYesIds]);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedList = allMembers.filter((m) => selectedIds.has(m.user_id));
  const perCourt = matchFormat === "singles" ? 2 : 4;
  const canGenerate = selectedList.length >= perCourt;

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateMatchups(groupId, {
          sessionId,
          mode: mode === "manual" ? "manual" : mode,
          format: matchFormat,
          playerIds: [...selectedIds],
          manualCourts: mode === "manual" ? manualCourts : undefined,
        });
        setGeneratedCourts(result.courts as MatchupCourt[]);
        setSharedToChat(false);
        toast.success("Matchups generated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to generate matchups");
      }
    });
  };

  const handleShareToChat = () => {
    if (!generatedCourts) return;
    startTransition(async () => {
      try {
        const nameMap: Record<string, string> = {};
        allMembers.forEach((m) => {
          nameMap[m.user_id] = m.full_name ?? "Unknown";
        });
        await shareMatchupToChat(groupId, generatedCourts, nameMap, sessionDate);
        setSharedToChat(true);
        toast.success("Matchups shared to group chat");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to share");
      }
    });
  };

  const handleClose = () => {
    setGeneratedCourts(null);
    setManualCourts([]);
    setSharedToChat(false);
    onOpenChange(false);
  };

  const getName = (id: string) =>
    allMembers.find((m) => m.user_id === id)?.full_name ?? "?";

  // Compute used IDs in manual courts to prevent double-assignment
  const usedInManual = new Set(
    manualCourts.flatMap((c) => [...c.team1, ...c.team2]).filter(Boolean)
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Matchups</DialogTitle>
        </DialogHeader>

        {isLoadingMembers ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading members…</p>
        ) : (
          <div className="space-y-5">
            {/* Mode */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mode</p>
              <div className="flex gap-2">
                {(["rank_based", "random", "manual"] as MatchupMode[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={mode === m ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs capitalize"
                    onClick={() => {
                      setMode(m);
                      setGeneratedCourts(null);
                    }}
                  >
                    {m === "rank_based" ? "Rank" : m === "random" ? "Random" : "Manual"}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {mode === "rank_based" && "Closest ranks play each other for balanced matches."}
                {mode === "random" && "Pure shuffle — fully random court assignments."}
                {mode === "manual" && "You assign who plays who on each court."}
              </p>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Format</p>
              <div className="flex gap-2">
                {(["singles", "doubles"] as MatchFormat[]).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={matchFormat === f ? "default" : "outline"}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => {
                      setMatchFormat(f);
                      setGeneratedCourts(null);
                    }}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            {/* Players (not shown for manual — managed in court slots directly) */}
            {mode !== "manual" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Players
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {selectedList.length} selected · {Math.floor(selectedList.length / perCourt)} court{Math.floor(selectedList.length / perCourt) !== 1 ? "s" : ""}
                    {selectedList.length % perCourt > 0 && (
                      <span className="text-amber-500 ml-1">· {selectedList.length % perCourt} sits out</span>
                    )}
                  </span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {allMembers.map((m) => (
                    <PlayerBadge
                      key={m.user_id}
                      member={m}
                      selected={selectedIds.has(m.user_id)}
                      onClick={() => togglePlayer(m.user_id)}
                    />
                  ))}
                </div>
                {selectedList.length < perCourt && (
                  <p className="text-xs text-destructive">
                    Need at least {perCourt} players for {matchFormat}.
                  </p>
                )}
              </div>
            )}

            {/* Manual court builder */}
            {mode === "manual" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Courts</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() =>
                      setManualCourts((prev) => [
                        ...prev,
                        { court: prev.length + 1, team1: [], team2: [] },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Add Court
                  </Button>
                </div>
                {manualCourts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Click "Add Court" to begin.</p>
                ) : (
                  manualCourts.map((court, i) => (
                    <ManualCourt
                      key={i}
                      courtIndex={i}
                      matchFormat={matchFormat}
                      allMembers={allMembers}
                      court={court}
                      usedIds={usedInManual}
                      onChange={(updated) =>
                        setManualCourts((prev) => prev.map((c, idx) => (idx === i ? updated : c)))
                      }
                      onRemove={() =>
                        setManualCourts((prev) =>
                          prev
                            .filter((_, idx) => idx !== i)
                            .map((c, idx) => ({ ...c, court: idx + 1 }))
                        )
                      }
                    />
                  ))
                )}
              </div>
            )}

            {/* Generate button */}
            <Button
              type="button"
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={
                isPending ||
                (mode !== "manual" && !canGenerate) ||
                (mode === "manual" && manualCourts.length === 0)
              }
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
              {generatedCourts ? "Regenerate" : "Generate"}
            </Button>

            {/* Generated result */}
            {generatedCourts && generatedCourts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  {generatedCourts.map((court) => {
                    const t1 = court.team1.map(getName).join(" & ");
                    const t2 = court.team2.map(getName).join(" & ");
                    return (
                      <div key={court.court} className="rounded-lg bg-muted px-3 py-2">
                        <span className="text-xs font-semibold text-muted-foreground mr-2">
                          Court {court.court}
                        </span>
                        <span className="text-sm">
                          {t1}{" "}
                          <span className="text-muted-foreground font-bold">vs</span>{" "}
                          {t2}
                        </span>
                      </div>
                    );
                  })}
                  {(() => {
                    const assignedIds = new Set(
                      generatedCourts.flatMap((c) => [...c.team1, ...c.team2])
                    );
                    const sittingOut = [...selectedIds].filter((id) => !assignedIds.has(id));
                    if (sittingOut.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                        <span className="font-medium">Sits out: </span>
                        {sittingOut.map(getName).join(", ")}
                      </div>
                    );
                  })()}
                </div>

                <Button
                  type="button"
                  variant={sharedToChat ? "outline" : "secondary"}
                  className="w-full gap-2"
                  onClick={handleShareToChat}
                  disabled={isPending || sharedToChat}
                >
                  <MessageSquare className="h-4 w-4" />
                  {sharedToChat ? "Shared to chat ✓" : "Share to Group Chat"}
                </Button>

                <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  After the matches are played, head to the <span className="font-medium text-foreground">Matches tab</span> and tap <span className="font-medium text-foreground">+ Log Match</span> to record results and update the leaderboard.
                </div>

                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  onClick={handleClose}
                >
                  Done
                </Button>
              </>
            )}

            {generatedCourts && generatedCourts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Not enough players to fill even one court.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
