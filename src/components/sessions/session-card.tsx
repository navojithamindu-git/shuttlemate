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
import { format } from "date-fns";

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    date: string;
    time: string;
    location: string;
    city: string;
    skill_level: string;
    game_type: string;
    max_players: number;
    status: string;
    session_participants: { count: number }[];
  };
}

export function SessionCard({ session }: SessionCardProps) {
  const participantCount = session.session_participants?.[0]?.count ?? 0;

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex gap-2 mb-2 flex-wrap">
            <Badge variant="secondary">{session.skill_level}</Badge>
            <Badge variant="outline">{session.game_type}</Badge>
            {session.status === "full" && (
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
            <span>{session.time.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {session.location}, {session.city}
            </span>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {participantCount}/{session.max_players} players
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
