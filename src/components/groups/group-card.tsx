import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import type { RecurringGroup } from "@/lib/types/database";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface GroupCardProps {
  group: RecurringGroup & { memberCount: number; nextSessionDate?: string };
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link href={`/groups/${group.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="pt-4 space-y-3">
          <div>
            <h3 className="font-semibold text-base truncate">{group.name}</h3>
            {group.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {group.description}
              </p>
            )}
          </div>

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
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Badge variant="secondary" className="text-xs">{group.skill_level}</Badge>
            <Badge variant="outline" className="text-xs">{group.game_type}</Badge>
            {!group.is_active && (
              <Badge variant="destructive" className="text-xs">Paused</Badge>
            )}
          </div>

          {group.nextSessionDate && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              Next session:{" "}
              <span className="font-medium text-foreground">
                {new Date(group.nextSessionDate + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
