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
  const [confirming, setConfirming] = useState(false);

  const handleLeave = async () => {
    setLoading(true);
    try {
      await leaveSession(sessionId);
      toast.success("You left the session");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  const handleJoin = async () => {
    setLoading(true);
    try {
      await joinSession(sessionId);
      toast.success("You joined the session!");
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

  if (isJoined && confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Leave session?</span>
        <Button size="sm" variant="destructive" disabled={loading} onClick={handleLeave} className="h-8">
          {loading ? "..." : "Yes, leave"}
        </Button>
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => setConfirming(false)} className="h-8">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={isJoined ? () => setConfirming(true) : handleJoin}
      variant={isJoined ? "destructive" : "default"}
      disabled={loading}
    >
      {loading ? "..." : isJoined ? "Leave Session" : "Join Session"}
    </Button>
  );
}
