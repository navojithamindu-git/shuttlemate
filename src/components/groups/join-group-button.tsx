"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/actions/groups";
import { toast } from "sonner";

export function JoinGroupButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    startTransition(async () => {
      try {
        await acceptInvite(token);
        setJoined(true);
      } catch (err) {
        if (err instanceof Error && err.message !== "NEXT_REDIRECT") {
          toast.error(err.message);
        }
      }
    });
  };

  return (
    <Button className="w-full" disabled={isPending || joined} onClick={handleJoin}>
      {isPending ? "Joining..." : joined ? "Joined!" : "Join Group"}
    </Button>
  );
}
