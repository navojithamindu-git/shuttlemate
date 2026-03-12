import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { RecurringGroup } from "@/lib/types/database";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const GROUP_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-red-500", "bg-yellow-500",
];
const GROUP_TEXT_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-blue-600 dark:text-blue-400",
  "text-orange-600 dark:text-orange-400",
  "text-purple-600 dark:text-purple-400",
  "text-pink-600 dark:text-pink-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-red-600 dark:text-red-400",
  "text-yellow-600 dark:text-yellow-400",
];
const GROUP_BG_COLORS = [
  "bg-emerald-500/10", "bg-blue-500/10", "bg-orange-500/10", "bg-purple-500/10",
  "bg-pink-500/10", "bg-cyan-500/10", "bg-red-500/10", "bg-yellow-500/10",
];

function groupColorIndex(name: string) {
  return [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % GROUP_COLORS.length;
}

interface GroupCardProps {
  group: RecurringGroup & { memberCount: number; nextSessionDate?: string };
}

export function GroupCard({ group }: GroupCardProps) {
  const idx = groupColorIndex(group.name);
  const initial = group.name[0].toUpperCase();

  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full group hover:-translate-y-0.5">
        <CardContent className="pt-0 pb-4 px-0">
          {/* Coloured top accent bar */}
          <div className={`${GROUP_COLORS[idx]} h-1.5 w-full rounded-t-lg`} />

          <div className="px-4 pt-4 space-y-3">
            {/* Avatar + name */}
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-xl ${GROUP_BG_COLORS[idx]} flex items-center justify-center shrink-0`}>
                <span className={`text-base font-bold ${GROUP_TEXT_COLORS[idx]}`}>{initial}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base leading-tight truncate group-hover:text-primary transition-colors">
                  {group.name}
                </h3>
                {group.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {group.description}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Details */}
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Every {DAY_NAMES[group.day_of_week]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{group.start_time.slice(0, 5)} – {group.end_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{group.location}, {group.city}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
                </div>
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{group.skill_level}</Badge>
                {!group.is_active && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">Paused</Badge>
                )}
              </div>
              {group.nextSessionDate && (
                <span className={`text-xs font-semibold ${GROUP_TEXT_COLORS[idx]}`}>
                  {format(new Date(group.nextSessionDate + "T00:00:00"), "MMM d")}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
