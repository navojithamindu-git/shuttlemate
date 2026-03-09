"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Trophy, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { logMatch } from "@/lib/actions/matches";
import type { MatchFormat, GroupMember, Profile, MatchWithPlayers } from "@/lib/types/database";

interface LogMatchModalProps {
  groupId: string;
  groupMembers: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (match: MatchWithPlayers) => void;
}

interface ScoreSet {
  team1: string;
  team2: string;
}

function getInitials(name: string | null) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";
}

function PlayerChip({
  member,
  team,
  onClick,
}: {
  member: GroupMember & { profiles: Pick<Profile, "id" | "full_name" | "avatar_url"> };
  team: 1 | 2 | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors ${
        team === 1
          ? "bg-blue-500/15 border border-blue-500/30"
          : team === 2
          ? "bg-orange-500/15 border border-orange-500/30"
          : "hover:bg-muted border border-transparent"
      }`}
    >
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={member.profiles.avatar_url ?? undefined} />
        <AvatarFallback className="text-[9px]">{getInitials(member.profiles.full_name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm flex-1 truncate">{member.profiles.full_name ?? "Unknown"}</span>
      {team !== null && (
        <Badge
          className={`text-[10px] h-4 px-1.5 shrink-0 ${
            team === 1 ? "bg-blue-500 hover:bg-blue-500" : "bg-orange-500 hover:bg-orange-500"
          }`}
        >
          T{team}
        </Badge>
      )}
    </button>
  );
}

export function LogMatchModal({
  groupId,
  groupMembers,
  open,
  onOpenChange,
  onSuccess,
}: LogMatchModalProps) {
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<MatchFormat>("singles");
  const [playerTeams, setPlayerTeams] = useState<Record<string, 1 | 2 | null>>({});
  const [scores, setScores] = useState<{ set1: ScoreSet; set2: ScoreSet; set3: ScoreSet }>({
    set1: { team1: "", team2: "" },
    set2: { team1: "", team2: "" },
    set3: { team1: "", team2: "" },
  });
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setStep(1);
    setFormat("singles");
    setPlayerTeams({});
    setScores({
      set1: { team1: "", team2: "" },
      set2: { team1: "", team2: "" },
      set3: { team1: "", team2: "" },
    });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // Player team assignment: cycles None → T1 → T2 → None
  const handlePlayerClick = (userId: string) => {
    const requiredPerTeam = format === "singles" ? 1 : 2;
    const current = playerTeams[userId] ?? null;

    setPlayerTeams((prev) => {
      const updated = { ...prev };

      if (current === null) {
        const t1Count = Object.values(prev).filter((v) => v === 1).length;
        if (t1Count < requiredPerTeam) {
          updated[userId] = 1;
        } else {
          const t2Count = Object.values(prev).filter((v) => v === 2).length;
          if (t2Count < requiredPerTeam) {
            updated[userId] = 2;
          }
        }
      } else if (current === 1) {
        const t2Count = Object.values(prev).filter((v) => v === 2).length;
        if (t2Count < requiredPerTeam) {
          updated[userId] = 2;
        } else {
          updated[userId] = null;
        }
      } else {
        updated[userId] = null;
      }

      return updated;
    });
  };

  const team1Ids = Object.entries(playerTeams)
    .filter(([, t]) => t === 1)
    .map(([id]) => id);
  const team2Ids = Object.entries(playerTeams)
    .filter(([, t]) => t === 2)
    .map(([id]) => id);

  const requiredPerTeam = format === "singles" ? 1 : 2;
  const step2Valid = team1Ids.length === requiredPerTeam && team2Ids.length === requiredPerTeam;

  const parseScore = (s: string) => parseInt(s, 10);
  const set1Valid =
    scores.set1.team1 !== "" &&
    scores.set1.team2 !== "" &&
    !isNaN(parseScore(scores.set1.team1)) &&
    !isNaN(parseScore(scores.set1.team2));
  const set2Valid =
    scores.set2.team1 !== "" &&
    scores.set2.team2 !== "" &&
    !isNaN(parseScore(scores.set2.team1)) &&
    !isNaN(parseScore(scores.set2.team2));

  // Set 3 needed when set 1 and set 2 have different winners
  const set1Winner =
    set1Valid
      ? parseScore(scores.set1.team1) > parseScore(scores.set1.team2)
        ? 1
        : 2
      : null;
  const set2Winner =
    set2Valid
      ? parseScore(scores.set2.team1) > parseScore(scores.set2.team2)
        ? 1
        : 2
      : null;
  const needsSet3 = set1Winner !== null && set2Winner !== null && set1Winner !== set2Winner;
  const set3Valid =
    !needsSet3 ||
    (scores.set3.team1 !== "" &&
      scores.set3.team2 !== "" &&
      !isNaN(parseScore(scores.set3.team1)) &&
      !isNaN(parseScore(scores.set3.team2)));

  const step3Valid = set1Valid && set2Valid && set3Valid;

  // Detect winner for preview
  const getWinningTeam = (): 1 | 2 | null => {
    if (!step3Valid) return null;
    let t1Sets = 0,
      t2Sets = 0;
    if (parseScore(scores.set1.team1) > parseScore(scores.set1.team2)) t1Sets++;
    else t2Sets++;
    if (parseScore(scores.set2.team1) > parseScore(scores.set2.team2)) t1Sets++;
    else t2Sets++;
    if (needsSet3 && scores.set3.team1 !== "" && scores.set3.team2 !== "") {
      if (parseScore(scores.set3.team1) > parseScore(scores.set3.team2)) t1Sets++;
      else t2Sets++;
    }
    if (t1Sets > t2Sets) return 1;
    if (t2Sets > t1Sets) return 2;
    return null;
  };

  const winningTeam = getWinningTeam();

  const getMemberById = (id: string) =>
    groupMembers.find((m) => m.user_id === id);

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const s1 = { team1: parseScore(scores.set1.team1), team2: parseScore(scores.set1.team2) };
        const s2 = { team1: parseScore(scores.set2.team1), team2: parseScore(scores.set2.team2) };
        const s3 = needsSet3
          ? { team1: parseScore(scores.set3.team1), team2: parseScore(scores.set3.team2) }
          : undefined;

        await logMatch(groupId, {
          format,
          team1PlayerIds: team1Ids,
          team2PlayerIds: team2Ids,
          scores: { set1: s1, set2: s2, set3: s3 },
        });

        // Build an optimistic match object for the parent to display immediately
        const makePlayerEntry = (id: string, team: 1 | 2, isWinner: boolean) => {
          const member = getMemberById(id);
          return {
            id: `temp-${id}`,
            match_id: "temp",
            player_id: id,
            team,
            score_set1: team === 1 ? s1.team1 : s1.team2,
            score_set2: team === 1 ? s2.team1 : s2.team2,
            score_set3: s3 ? (team === 1 ? s3.team1 : s3.team2) : null,
            is_winner: isWinner,
            created_at: new Date().toISOString(),
            profiles: {
              id,
              full_name: member?.profiles.full_name ?? null,
              avatar_url: member?.profiles.avatar_url ?? null,
            },
          };
        };

        const optimisticMatch: MatchWithPlayers = {
          id: `temp-${Date.now()}`,
          group_id: groupId,
          session_id: null,
          format,
          status: "completed",
          logged_by: "",
          played_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          match_players: [
            ...team1Ids.map((id) => makePlayerEntry(id, 1, winningTeam === 1)),
            ...team2Ids.map((id) => makePlayerEntry(id, 2, winningTeam === 2)),
          ],
        };

        onSuccess(optimisticMatch);
        toast.success("Match logged");
        handleClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to log match");
      }
    });
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose the match format.</p>
      <div className="flex gap-3">
        <Button
          type="button"
          variant={format === "singles" ? "default" : "outline"}
          className="flex-1"
          onClick={() => {
            setFormat("singles");
            setPlayerTeams({});
          }}
        >
          Singles
        </Button>
        <Button
          type="button"
          variant={format === "doubles" ? "default" : "outline"}
          className="flex-1"
          onClick={() => {
            setFormat("doubles");
            setPlayerTeams({});
          }}
        >
          Doubles
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tap players to assign teams.{" "}
        <span className="text-blue-500 font-medium">Blue = Team 1</span>{" "}
        <span className="text-orange-500 font-medium">Orange = Team 2</span>
      </p>
      <div className="flex gap-4 text-xs font-medium mb-1">
        <span className="text-blue-500">T1: {team1Ids.length}/{requiredPerTeam}</span>
        <span className="text-orange-500">T2: {team2Ids.length}/{requiredPerTeam}</span>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {groupMembers.map((member) => (
          <PlayerChip
            key={member.user_id}
            member={member}
            team={playerTeams[member.user_id] ?? null}
            onClick={() => handlePlayerClick(member.user_id)}
          />
        ))}
      </div>
    </div>
  );

  const renderScoreInput = (
    setKey: "set1" | "set2" | "set3",
    label: string
  ) => (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="99"
          placeholder="0"
          value={scores[setKey].team1}
          onChange={(e) =>
            setScores((prev) => ({
              ...prev,
              [setKey]: { ...prev[setKey], team1: e.target.value },
            }))
          }
          className="text-center h-9 text-blue-600"
        />
        <span className="text-muted-foreground font-bold shrink-0">–</span>
        <Input
          type="number"
          min="0"
          max="99"
          placeholder="0"
          value={scores[setKey].team2}
          onChange={(e) =>
            setScores((prev) => ({
              ...prev,
              [setKey]: { ...prev[setKey], team2: e.target.value },
            }))
          }
          className="text-center h-9 text-orange-600"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex justify-between text-xs font-medium px-1">
        <span className="text-blue-500">
          T1: {team1Ids.map((id) => getMemberById(id)?.profiles.full_name?.split(" ")[0] ?? "?").join(" & ")}
        </span>
        <span className="text-orange-500">
          T2: {team2Ids.map((id) => getMemberById(id)?.profiles.full_name?.split(" ")[0] ?? "?").join(" & ")}
        </span>
      </div>
      {renderScoreInput("set1", "Set 1")}
      {renderScoreInput("set2", "Set 2")}
      {needsSet3 && renderScoreInput("set3", "Set 3")}
      {step3Valid && winningTeam !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-sm font-medium">
            Team {winningTeam} wins:{" "}
            {(winningTeam === 1 ? team1Ids : team2Ids)
              .map((id) => getMemberById(id)?.profiles.full_name?.split(" ")[0] ?? "?")
              .join(" & ")}
          </span>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => {
    const t1Names = team1Ids
      .map((id) => getMemberById(id)?.profiles.full_name ?? "?")
      .join(" & ");
    const t2Names = team2Ids
      .map((id) => getMemberById(id)?.profiles.full_name ?? "?")
      .join(" & ");

    const scoreSummary = [
      `${scores.set1.team1}–${scores.set1.team2}`,
      `${scores.set2.team1}–${scores.set2.team2}`,
      needsSet3 ? `${scores.set3.team1}–${scores.set3.team2}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted px-4 py-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Format</span>
            <Badge variant="outline" className="capitalize">
              {format}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium flex-1 ${winningTeam === 1 ? "text-foreground" : "text-muted-foreground"}`}>
              {winningTeam === 1 && <Trophy className="inline h-3.5 w-3.5 text-yellow-500 mr-1" />}
              {t1Names}
            </span>
            <span className="font-mono text-xs text-muted-foreground shrink-0">{scoreSummary}</span>
            <span className={`font-medium flex-1 text-right ${winningTeam === 2 ? "text-foreground" : "text-muted-foreground"}`}>
              {winningTeam === 2 && <Trophy className="inline h-3.5 w-3.5 text-yellow-500 mr-1" />}
              {t2Names}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          This will update the group leaderboard.
        </p>
      </div>
    );
  };

  const stepTitles = ["Format", "Players", "Scores", "Confirm"];
  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4];
  const stepValid = [true, step2Valid, step3Valid, true];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Match — Step {step} of 4: {stepTitles[step - 1]}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s < step ? "bg-primary" : s === step ? "bg-primary/60" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {stepContent[step - 1]()}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={step === 1 ? handleClose : () => setStep((s) => s - 1)}
            disabled={isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 4 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepValid[step - 1] || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Log Match"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
