"use client";

import { useState } from "react";
import { updateNotificationPreference } from "@/lib/actions/availability";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface NotificationToggleProps {
  enabled: boolean;
}

export function NotificationToggle({
  enabled: initialEnabled,
}: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const handleChange = async (checked: boolean) => {
    setLoading(true);
    setEnabled(checked);
    try {
      await updateNotificationPreference(checked);
      toast.success(
        checked
          ? "Email notifications enabled"
          : "Email notifications disabled"
      );
    } catch (err) {
      setEnabled(!checked);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update preference"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <div>
          <Label htmlFor="email-notifications" className="font-medium">
            Email Notifications
          </Label>
          <p className="text-sm text-muted-foreground">
            Get notified when sessions match your availability
          </p>
        </div>
      </div>
      <Switch
        id="email-notifications"
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={loading}
      />
    </div>
  );
}
