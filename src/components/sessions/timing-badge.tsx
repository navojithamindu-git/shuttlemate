"use client";

import { Badge } from "@/components/ui/badge";
import { differenceInCalendarDays } from "date-fns";

interface TimingBadgeProps {
  date: string;
  startTime: string;
}

export function TimingBadge({ date, startTime }: TimingBadgeProps) {
  const now = new Date();
  const sessionDate = new Date(date + "T" + startTime);
  const daysUntil = differenceInCalendarDays(sessionDate, now);

  const timing =
    sessionDate < now
      ? { label: "Expired", variant: "destructive" as const }
      : daysUntil === 0
        ? { label: "Today", variant: "default" as const }
        : daysUntil === 1
          ? { label: "Tomorrow", variant: "default" as const }
          : daysUntil <= 7
            ? { label: `In ${daysUntil} days`, variant: "secondary" as const }
            : null;

  if (!timing) return null;

  return <Badge variant={timing.variant}>{timing.label}</Badge>;
}
