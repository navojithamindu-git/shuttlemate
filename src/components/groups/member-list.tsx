"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserMinus, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { removeMember, promoteMember, demoteMember } from "@/lib/actions/groups";
import type { GroupMember, GroupMemberRole, Profile } from "@/lib/types/database";

interface MemberListProps {
  groupId: string;
  members: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
  currentUserId: string;
  currentUserRole: GroupMemberRole;
}

const ROLE_BADGE: Record<GroupMemberRole, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Owner", variant: "default" },
  admin: { label: "Admin", variant: "secondary" },
  member: { label: "Member", variant: "outline" },
};

function getInitials(name: string | null) {
  return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "?";
}

type ConfirmingAction =
  | { type: "remove"; userId: string; name: string }
  | { type: "promote"; userId: string; name: string }
  | { type: "demote"; userId: string; name: string }
  | { type: "leave" };

export function MemberList({ groupId, members, currentUserId, currentUserRole }: MemberListProps) {
  const [localMembers, setLocalMembers] = useState(members);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<ConfirmingAction | null>(null);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleRemove = (userId: string) => {
    startTransition(async () => {
      try {
        await removeMember(groupId, userId);
        setLocalMembers((prev) => prev.filter((m) => m.user_id !== userId));
        toast.success("Member removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove member");
      } finally {
        setConfirming(null);
      }
    });
  };

  const handlePromote = (userId: string) => {
    startTransition(async () => {
      try {
        await promoteMember(groupId, userId);
        setLocalMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: "admin" as GroupMemberRole } : m))
        );
        toast.success("Member promoted to admin");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to promote member");
      } finally {
        setConfirming(null);
      }
    });
  };

  const handleDemote = (userId: string) => {
    startTransition(async () => {
      try {
        await demoteMember(groupId, userId);
        setLocalMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: "member" as GroupMemberRole } : m))
        );
        toast.success("Admin demoted to member");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to demote member");
      } finally {
        setConfirming(null);
      }
    });
  };

  const handleConfirm = () => {
    if (!confirming) return;
    if (confirming.type === "remove") handleRemove(confirming.userId);
    else if (confirming.type === "promote") handlePromote(confirming.userId);
    else if (confirming.type === "demote") handleDemote(confirming.userId);
    else if (confirming.type === "leave") handleRemove(currentUserId);
  };

  return (
    <>
      <div className="space-y-3">
        {localMembers.map((member) => {
          const roleInfo = ROLE_BADGE[member.role];
          const isSelf = member.user_id === currentUserId;
          const isOwner = member.role === "owner";

          return (
            <div key={member.user_id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={member.profiles.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(member.profiles.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {member.profiles.full_name ?? "Unknown"}
                    {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                  </span>
                  <Badge variant={roleInfo.variant} className="text-[10px] h-4 px-1.5 shrink-0">
                    {roleInfo.label}
                  </Badge>
                </div>
                {member.profiles.skill_level && (
                  <p className="text-xs text-muted-foreground">{member.profiles.skill_level}</p>
                )}
              </div>
              {canManage && !isOwner && !isSelf && (
                <div className="flex gap-1 shrink-0">
                  {currentUserRole === "owner" && member.role === "member" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={isPending}
                      onClick={() => setConfirming({ type: "promote", userId: member.user_id, name: member.profiles.full_name ?? "this member" })}
                      title="Promote to admin"
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {currentUserRole === "owner" && member.role === "admin" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={isPending}
                      onClick={() => setConfirming({ type: "demote", userId: member.user_id, name: member.profiles.full_name ?? "this member" })}
                      title="Demote to member"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() => setConfirming({ type: "remove", userId: member.user_id, name: member.profiles.full_name ?? "this member" })}
                    title="Remove member"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {isSelf && member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground h-7"
                  disabled={isPending}
                  onClick={() => setConfirming({ type: "leave" })}
                >
                  Leave
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline confirm dialog */}
      {confirming && (
        <div className="mt-3 rounded-md border bg-muted/40 p-3 space-y-2">
          <p className="text-sm">
            {confirming.type === "remove" && <>Remove <span className="font-medium">{confirming.name}</span> from the group?</>}
            {confirming.type === "promote" && <>Make <span className="font-medium">{confirming.name}</span> an admin? They will be able to manage members and edit the group.</>}
            {confirming.type === "demote" && <>Demote <span className="font-medium">{confirming.name}</span> back to member? They will lose admin privileges.</>}
            {confirming.type === "leave" && <>Leave this group? You will lose access to the chat and sessions.</>}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={confirming.type === "promote" || confirming.type === "demote" ? "default" : "destructive"}
              className="h-7 text-xs"
              disabled={isPending}
              onClick={handleConfirm}
            >
              {isPending ? "..." : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={isPending}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
