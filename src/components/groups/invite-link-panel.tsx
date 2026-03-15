"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Link, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateInviteLink, revokeInviteLink } from "@/lib/actions/groups";
import { formatDistanceToNow } from "date-fns";

interface InviteLinkPanelProps {
  groupId: string;
  existingLink?: { url: string; expiresAt: string } | null;
}

export function InviteLinkPanel({ groupId, existingLink }: InviteLinkPanelProps) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(
    existingLink ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateInviteLink(groupId);
        setLink(result);
        toast.success("Invite link generated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to generate link");
      }
    });
  };

  const handleRevoke = () => {
    setConfirmingRevoke(false);
    startTransition(async () => {
      try {
        await revokeInviteLink(groupId);
        setLink(null);
        toast.success("Invite link revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to revoke link");
      }
    });
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link.url);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Share an invite link so people can join your group. Links expire after 24 hours.
      </p>

      {link ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={link.url} readOnly className="text-xs font-mono" />
            <Button size="icon" variant="outline" onClick={handleCopy} title="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Expires {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })}
            </Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={handleGenerate}
                className="text-xs h-7 gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                New link
              </Button>
              {confirmingRevoke ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Revoke link?</span>
                  <Button size="sm" variant="destructive" disabled={isPending} onClick={handleRevoke} className="text-xs h-7">
                    Yes
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setConfirmingRevoke(false)} className="text-xs h-7">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => setConfirmingRevoke(true)}
                  className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Revoke
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          variant="outline"
          className="w-full gap-2"
        >
          <Link className="h-4 w-4" />
          Generate Invite Link
        </Button>
      )}
    </div>
  );
}
