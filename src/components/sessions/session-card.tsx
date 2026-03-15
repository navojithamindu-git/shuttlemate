"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

const SKILL_BAR: Record<string, string> = {
  Beginner: "bg-emerald-500",
  Intermediate: "bg-blue-500",
  Advanced: "bg-orange-500",
  Open: "bg-purple-500",
};

const SKILL_BADGE: Record<string, string> = {
  Beginner: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Intermediate: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Advanced: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  Open: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
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

  if (sessionDate < now) return { label: "Expired", cls: "bg-destructive/10 text-destructive border-destructive/20" };
  if (daysUntil === 0) return { label: "Today", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
  if (daysUntil === 1) return { label: "Tomorrow", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
  if (daysUntil <= 7) return { label: `In ${daysUntil} days`, cls: "bg-muted text-muted-foreground border-border" };
  return null;
}

export function SessionCard({ session }: SessionCardProps) {
  const participantCount = session.session_participants?.[0]?.count ?? 0;
  const timing = getTimingBadge(session.date, session.start_time);
  const isFull = session.status === "full" || participantCount >= session.max_players;
  const spotsLeft = session.max_players - participantCount;
  const barColor = SKILL_BAR[session.skill_level] ?? "bg-emerald-500";
  const badgeCls = SKILL_BADGE[session.skill_level] ?? SKILL_BADGE["Open"];
  const fillPct = Math.min((participantCount / session.max_players) * 100, 100);

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full group hover:-translate-y-0.5 overflow-hidden">
        {/* Coloured top bar matching skill level */}
        <div className={`${barColor} h-1.5 w-full`} />

        <CardContent className="pt-4 pb-3 space-y-3">
          {/* Badges row */}
          <div className="flex gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${badgeCls}`}>
              {session.skill_level}
            </span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-muted text-muted-foreground border-border">
              {session.game_type}
            </span>
            {timing && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${timing.cls}`}>
                {timing.label}
              </span>
            )}
            {isFull && session.status !== "completed" && session.status !== "cancelled" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-destructive/10 text-destructive border-destructive/20">
                Full
              </span>
            )}
            {session.status === "cancelled" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-destructive/10 text-destructive border-destructive/20">
                Cancelled
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {session.title}
          </h3>

          {/* Details */}
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{format(new Date(session.date + "T00:00:00"), "EEE, MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{session.location}, {session.city}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-start gap-2 pt-0 pb-4">
          {/* Fill bar */}
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? "bg-destructive" : barColor}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {isFull
                ? `${participantCount}/${session.max_players} · Full`
                : `${participantCount}/${session.max_players} · ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
