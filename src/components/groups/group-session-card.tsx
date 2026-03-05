"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateGroupRsvp } from "@/lib/actions/groups";
import type { GroupMember, GroupSessionRsvp, RsvpStatus, Session } from "@/lib/types/database";
import type { Profile } from "@/lib/types/database";

interface GroupSessionCardProps {
  session: Session & { group_session_rsvps: GroupSessionRsvp[] };
  groupMembers: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url">;
  })[];
  currentUserId: string;
}

const RSVP_OPTIONS: { status: RsvpStatus; label: string; emoji: string }[] = [
  { status: "yes", label: "Going", emoji: "✅" },
  { status: "maybe", label: "Maybe", emoji: "❓" },
  { status: "no", label: "Can't make it", emoji: "❌" },
];

function getInitials(name: string | null) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";
}

export function GroupSessionCard({
  session,
  groupMembers,
  currentUserId,
}: GroupSessionCardProps) {
  const [rsvps, setRsvps] = useState<GroupSessionRsvp[]>(session.group_session_rsvps ?? []);
  const [isPending, startTransition] = useTransition();

  const myRsvp = rsvps.find((r) => r.user_id === currentUserId)?.status ?? "yes";

  const handleRsvp = (status: RsvpStatus) => {
    // Optimistic update
    setRsvps((prev) => {
      const existing = prev.find((r) => r.user_id === currentUserId);
      if (existing) return prev.map((r) => (r.user_id === currentUserId ? { ...r, status } : r));
      return [...prev, { id: "temp", session_id: session.id, user_id: currentUserId, status, updated_at: new Date().toISOString() }];
    });

    startTransition(async () => {
      try {
        await updateGroupRsvp(session.id, status);
      } catch (err) {
        // Revert
        setRsvps(session.group_session_rsvps ?? []);
        toast.error(err instanceof Error ? err.message : "Failed to update RSVP");
      }
    });
  };

  // Group members by RSVP status
  const byStatus: Record<RsvpStatus, typeof groupMembers> = { yes: [], maybe: [], no: [] };
  for (const member of groupMembers) {
    const rsvp = rsvps.find((r) => r.user_id === member.user_id);
    const status: RsvpStatus = rsvp?.status ?? "yes";
    byStatus[status].push(member);
  }

  const sessionDate = new Date(session.date + "T00:00:00");
  const isToday = new Date().toISOString().split("T")[0] === session.date;
  const isTomorrow =
    new Date(Date.now() + 86400000).toISOString().split("T")[0] === session.date;

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isToday && <Badge variant="default">Today</Badge>}
              {isTomorrow && <Badge variant="secondary">Tomorrow</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">
                {format(sessionDate, "EEEE, MMMM d")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{session.location}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
            <Users className="h-4 w-4" />
            <span>{byStatus.yes.length}/{session.max_players}</span>
          </div>
        </div>

        {/* RSVP grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {RSVP_OPTIONS.map(({ status, label, emoji }) => (
            <div key={status} className="space-y-1">
              <p className="text-muted-foreground font-medium">
                {emoji} {label} ({byStatus[status].length})
              </p>
              <div className="flex flex-wrap justify-center gap-0.5 min-h-6">
                {byStatus[status].map((m) => (
                  <Avatar key={m.user_id} className="h-6 w-6">
                    <AvatarImage src={m.profiles.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(m.profiles.full_name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* My RSVP buttons */}
        <div className="flex gap-2 pt-1 border-t">
          <span className="text-xs text-muted-foreground self-center mr-1">You:</span>
          {RSVP_OPTIONS.map(({ status, label }) => (
            <Button
              key={status}
              size="sm"
              variant={myRsvp === status ? "default" : "outline"}
              className="flex-1 text-xs h-7"
              disabled={isPending}
              onClick={() => handleRsvp(status)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
