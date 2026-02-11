"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { joinSession, leaveSession } from "@/lib/actions/sessions";
import { toast } from "sonner";

interface JoinLeaveButtonProps {
  sessionId: string;
  isJoined: boolean;
  isCreator: boolean;
  isFull: boolean;
}

export function JoinLeaveButton({
  sessionId,
  isJoined,
  isCreator,
  isFull,
}: JoinLeaveButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    try {
      if (isJoined) {
        await leaveSession(sessionId);
        toast.success("You left the session");
      } else {
        await joinSession(sessionId);
        toast.success("You joined the session!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (isCreator && isJoined) {
    return <Badge variant="secondary">You created this session</Badge>;
  }

  if (isFull && !isJoined) {
    return (
      <Button disabled variant="secondary">
        Session Full
      </Button>
    );
  }

  return (
    <Button
      onClick={handleAction}
      variant={isJoined ? "destructive" : "default"}
      disabled={loading}
    >
      {loading ? "..." : isJoined ? "Leave Session" : "Join Session"}
    </Button>
  );
}
