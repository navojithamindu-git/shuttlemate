"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

const SKILL_COLORS: Record<string, string> = {
  Beginner: "border-l-emerald-500",
  Intermediate: "border-l-blue-500",
  Advanced: "border-l-orange-500",
  Open: "border-l-purple-500",
};

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    city: string;
    skill_level: string;
    game_type: string;
    max_players: number;
    status: string;
    session_participants: { count: number }[];
  };
}

function getTimingBadge(date: string, start_time: string) {
  const now = new Date();
  const sessionDate = new Date(date + "T" + start_time);
  const daysUntil = differenceInCalendarDays(sessionDate, now);

  if (sessionDate < now) return { label: "Expired", variant: "destructive" as const };
  if (daysUntil === 0) return { label: "Today", variant: "default" as const };
  if (daysUntil === 1) return { label: "Tomorrow", variant: "default" as const };
  if (daysUntil <= 7) return { label: `In ${daysUntil} days`, variant: "secondary" as const };
  return null;
}

export function SessionCard({ session }: SessionCardProps) {
  const participantCount = session.session_participants?.[0]?.count ?? 0;
  const timing = getTimingBadge(session.date, session.start_time);
  const isFull = session.status === "full" || participantCount >= session.max_players;
  const spotsLeft = session.max_players - participantCount;
  const borderColor = SKILL_COLORS[session.skill_level] ?? "border-l-primary";

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 ${borderColor}`}>
        <CardHeader className="pb-3">
          <div className="flex gap-2 mb-2 flex-wrap">
            <Badge variant="secondary">{session.skill_level}</Badge>
            <Badge variant="outline">{session.game_type}</Badge>
            {timing && (
              <Badge variant={timing.variant}>{timing.label}</Badge>
            )}
            {isFull && session.status !== "completed" && session.status !== "cancelled" && (
              <Badge variant="destructive">Full</Badge>
            )}
            {session.status === "completed" && (
              <Badge variant="secondary">Completed</Badge>
            )}
            {session.status === "cancelled" && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
          </div>
          <CardTitle className="text-lg leading-tight">{session.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(new Date(session.date + "T00:00:00"), "EEE, MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {session.location}, {session.city}
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-2 pt-0">
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? "bg-destructive" : "bg-emerald-500"}`}
              style={{ width: `${Math.min((participantCount / session.max_players) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {isFull
                ? `${participantCount}/${session.max_players} · Full`
                : `${participantCount}/${session.max_players} joined · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
