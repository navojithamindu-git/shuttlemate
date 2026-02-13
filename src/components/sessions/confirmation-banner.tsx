"use client";

import { useState, useEffect } from "react";
import { confirmSession } from "@/lib/actions/sessions";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ConfirmationBannerProps {
  sessionId: string;
  confirmationDeadline: string;
}

export function ConfirmationBanner({
  sessionId,
  confirmationDeadline,
}: ConfirmationBannerProps) {
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const deadline = new Date(confirmationDeadline);
      if (deadline <= new Date()) {
        setTimeLeft("expired");
      } else {
        setTimeLeft(formatDistanceToNow(deadline, { addSuffix: false }));
      }
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [confirmationDeadline]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmSession(sessionId);
      toast.success("Attendance confirmed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">
          This session has been updated
        </p>
        <p className="text-sm text-amber-700">
          {timeLeft === "expired"
            ? "Your confirmation deadline has passed. Your spot may be released."
            : `Your spot will be released if you don't confirm within ${timeLeft}.`}
        </p>
      </div>
      <Button
        onClick={handleConfirm}
        disabled={loading}
        size="sm"
        className="shrink-0"
      >
        {loading ? "Confirming..." : "Confirm Attendance"}
      </Button>
    </div>
  );
}
