import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface Participant {
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    skill_level: string | null;
  };
}

interface ParticipantListProps {
  participants: Participant[];
  creatorId: string;
  currentUserId?: string;
}

export function ParticipantList({ participants, creatorId, currentUserId }: ParticipantListProps) {
  return (
    <div className="space-y-3">
      {participants.map((p) => {
        const name = p.profiles.full_name ?? "Unknown";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase();

        return (
          <div key={p.user_id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={p.profiles.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{name}</span>
                {p.user_id === creatorId && (
                  <Badge variant="outline" className="text-xs">
                    Host
                  </Badge>
                )}
                {p.profiles.skill_level && (
                  <Badge variant="secondary" className="text-xs">
                    {p.profiles.skill_level}
                  </Badge>
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
