"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelSession } from "@/lib/actions/sessions";
import { toast } from "sonner";

export function CancelSessionButton({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this session?")) return;

    setLoading(true);
    try {
      await cancelSession(sessionId);
      toast.success("Session cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleCancel} disabled={loading}>
      {loading ? "Cancelling..." : "Cancel Session"}
    </Button>
  );
}
