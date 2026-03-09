import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { JoinGroupButton } from "@/components/groups/join-group-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import type { Metadata } from "next";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from("group_invitations")
    .select("group_id, expires_at")
    .eq("token", token)
    .single();

  if (!invitation || new Date(invitation.expires_at) < new Date()) {
    return { title: "Invalid Invite — ShuttleMates" };
  }

  const { data: group } = await admin
    .from("recurring_groups")
    .select("name, day_of_week, start_time, location, city, skill_level, group_members(count)")
    .eq("id", invitation.group_id)
    .single();

  if (!group) return { title: "Group Invite — ShuttleMates" };

  const memberCount = (group.group_members as any[])?.[0]?.count ?? 0;
  const title = `🏸 You're invited to join ${group.name}!`;
  const description = `Every ${DAY_NAMES[group.day_of_week]} · ${group.start_time.slice(0, 5)} · ${group.location}, ${group.city} · ${group.skill_level} · ${memberCount} member${memberCount !== 1 ? "s" : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "ShuttleMates",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

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
              <GoogleSignInButton redirectTo={`/join/${token}`} />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Link href={`/login?redirect=/join/${token}`} className="block">
                <Button variant="outline" className="w-full">Sign in with email</Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                No account?{" "}
                <Link href={`/signup?redirect=/join/${token}`} className="text-primary underline">
                  Create one
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
