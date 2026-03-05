import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rollGroupSessions } from "@/lib/actions/groups";
import { GroupChat } from "@/components/groups/group-chat";
import { GroupSessionCard } from "@/components/groups/group-session-card";
import { MemberList } from "@/components/groups/member-list";
import { InviteLinkPanel } from "@/components/groups/invite-link-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, MapPin, Pencil, Users } from "lucide-react";
import Link from "next/link";
import type { GroupMemberRole } from "@/lib/types/database";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Roll sessions in the background (generate next occurrence if needed)
  try {
    await rollGroupSessions(id);
  } catch {
    // Non-critical — don't block the page
  }

  const today = new Date().toISOString().split("T")[0];

  // Fetch group with members, upcoming sessions, RSVPs, and active invite
  const { data: group } = await supabase
    .from("recurring_groups")
    .select(
      `
      *,
      group_members(
        *,
        profiles(id, full_name, avatar_url, skill_level)
      ),
      sessions!group_id(
        *,
        group_session_rsvps(*)
      ),
      group_invitations(token, expires_at)
    `
    )
    .eq("id", id)
    .single();

  if (!group) notFound();

  const currentMember = (group.group_members as any[]).find(
    (m: { user_id: string }) => m.user_id === user.id
  );
  const currentUserRole: GroupMemberRole = currentMember?.role ?? "member";
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // Next 7 days of sessions
  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysStr = next7Days.toISOString().split("T")[0];

  const upcomingSessions = ((group.sessions as any[]) ?? [])
    .filter(
      (s: { date: string; status: string }) =>
        s.date >= today && s.date <= next7DaysStr && s.status !== "cancelled"
    )
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));

  // Active invite link (non-expired)
  const activeInvite = ((group.group_invitations as any[]) ?? []).find(
    (inv: { expires_at: string }) => new Date(inv.expires_at) > new Date()
  );

  const existingLink = activeInvite
    ? {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/join/${activeInvite.token}`,
        expiresAt: activeInvite.expires_at,
      }
    : null;

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="secondary">{group.skill_level}</Badge>
            <Badge variant="outline">{group.game_type}</Badge>
            {!group.is_active && <Badge variant="destructive">Paused</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground text-sm mt-1">{group.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Every {DAY_NAMES[group.day_of_week]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {group.start_time.slice(0, 5)}–{group.end_time.slice(0, 5)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {group.location}, {group.city}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {(group.group_members as any[]).length} members
            </span>
          </div>
        </div>
        {canManage && (
          <Link href={`/groups/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1 shrink-0">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="schedule" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="schedule" className="flex-1">
            Schedule{upcomingSessions.length > 0 && ` (${upcomingSessions.length})`}
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
          <TabsTrigger value="members" className="flex-1">
            Members ({(group.group_members as any[]).length})
          </TabsTrigger>
        </TabsList>

        {/* Schedule tab */}
        <TabsContent value="schedule" className="mt-4 space-y-3">
          {upcomingSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              No upcoming sessions. They will be generated automatically.
            </p>
          ) : (
            upcomingSessions.map((session: any) => (
              <GroupSessionCard
                key={session.id}
                session={session}
                groupMembers={group.group_members as any[]}
                currentUserId={user.id}
                canManage={canManage}
              />
            ))
          )}
        </TabsContent>

        {/* Chat tab */}
        <TabsContent value="chat" className="mt-4">
          <Card className="overflow-hidden">
            <div className="h-[calc(100vh-20rem)] flex flex-col">
              <GroupChat groupId={id} currentUserId={user.id} />
            </div>
          </Card>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MemberList
                groupId={id}
                members={group.group_members as any[]}
                currentUserId={user.id}
                currentUserRole={currentUserRole}
              />

              {canManage && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Invite people</h4>
                    <InviteLinkPanel groupId={id} existingLink={existingLink} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
