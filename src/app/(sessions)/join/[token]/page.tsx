import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { JoinGroupButton } from "@/components/groups/join-group-button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use admin client to read invite regardless of RLS
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("group_invitations")
    .select("group_id, expires_at")
    .eq("token", token)
    .single();

  // Invalid token
  if (!invitation) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 text-center">
        <Card>
          <CardContent className="pt-8 pb-6 space-y-4">
            <p className="text-2xl">🔗</p>
            <h1 className="text-xl font-bold">Invalid link</h1>
            <p className="text-muted-foreground text-sm">
              This invite link is invalid or has already been revoked.
            </p>
            <Link href="/sessions">
              <Button variant="outline">Browse sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired token
  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 text-center">
        <Card>
          <CardContent className="pt-8 pb-6 space-y-4">
            <p className="text-2xl">⏰</p>
            <h1 className="text-xl font-bold">Link expired</h1>
            <p className="text-muted-foreground text-sm">
              This invite link expired. Ask the group admin to generate a new one.
            </p>
            <Link href="/sessions">
              <Button variant="outline">Browse sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch group details (use admin to bypass RLS)
  const { data: group } = await admin
    .from("recurring_groups")
    .select("*, group_members(count)")
    .eq("id", invitation.group_id)
    .single();

  if (!group) {
    return (
      <div className="container max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-muted-foreground">Group not found.</p>
      </div>
    );
  }

  const memberCount = (group.group_members as any[])?.[0]?.count ?? 0;

  // If already a member, redirect straight in
  if (user) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      redirect(`/groups/${group.id}`);
    }
  }

  return (
    <div className="container max-w-md mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <p className="text-3xl mb-2">🏸</p>
          <CardTitle>You&apos;re invited to join</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Group info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h2 className="font-semibold text-lg">{group.name}</h2>
            {group.description && (
              <p className="text-sm text-muted-foreground">{group.description}</p>
            )}
            <div className="space-y-1.5 text-sm text-muted-foreground pt-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Every {DAY_NAMES[group.day_of_week]}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{group.start_time.slice(0, 5)} – {group.end_time.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{group.location}, {group.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              <Badge variant="secondary" className="text-xs">{group.skill_level}</Badge>
              <Badge variant="outline" className="text-xs">{group.game_type}</Badge>
            </div>
          </div>

          {/* Join or login */}
          {user ? (
            <JoinGroupButton token={token} />
          ) : (
            <div className="space-y-3">
              <Link href={`/login?redirect=/join/${token}`} className="block">
                <Button className="w-full">Sign in to join</Button>
              </Link>
              <Link href={`/signup?redirect=/join/${token}`} className="block">
                <Button variant="outline" className="w-full">Create an account</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
