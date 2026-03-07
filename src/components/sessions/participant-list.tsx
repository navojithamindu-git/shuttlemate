import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

function calcAge(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
}

interface Participant {
  user_id: string;
  confirmed?: boolean;
  confirmation_deadline?: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    skill_level: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
  };
}

interface ParticipantListProps {
  participants: Participant[];
  creatorId: string;
  currentUserId?: string;
  showConfirmationStatus?: boolean;
}

export function ParticipantList({
  participants,
  creatorId,
  currentUserId,
  showConfirmationStatus,
}: ParticipantListProps) {
  return (
    <div className="space-y-3">
      {participants.map((p) => {
        const name = p.profiles.full_name ?? "Unknown";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();
        const isHost = p.user_id === creatorId;

        const genderChar =
          p.profiles.gender === "Male" ? "M" :
          p.profiles.gender === "Female" ? "F" :
          p.profiles.gender === "Prefer not to say" ? "?" : null;
        const age = p.profiles.date_of_birth ? calcAge(p.profiles.date_of_birth) : null;
        const genderAgeBadge = genderChar
          ? age !== null ? `${genderChar} • ${age}` : genderChar
          : age !== null ? `${age}` : null;

        return (
          <div key={p.user_id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={p.profiles.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{name}</span>
                {isHost && (
                  <Badge variant="outline" className="text-xs">
                    Host
                  </Badge>
                )}
                {p.profiles.skill_level && (
                  <Badge variant="secondary" className="text-xs">
                    {p.profiles.skill_level}
                  </Badge>
                )}
                {genderAgeBadge && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      p.profiles.gender === "Male"
                        ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                        : p.profiles.gender === "Female"
                        ? "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {genderAgeBadge}
                  </Badge>
                )}
                {showConfirmationStatus && !isHost && (
                  p.confirmed === false ? (
                    <Badge variant="destructive" className="text-xs">
                      Unconfirmed
                    </Badge>
                  ) : (
                    <Badge className="text-xs bg-green-600 hover:bg-green-700">
                      Confirmed
                    </Badge>
                  )
                )}
              </div>
            </div>
            {currentUserId && p.user_id !== currentUserId && (
              <Link href={`/messages/${p.user_id}`}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
