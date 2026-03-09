import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Pencil, Trophy, TrendingUp } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/profile/complete");

  // Fetch stats across all groups
  const { data: myStats } = await supabase
    .from("player_group_stats")
    .select("*, recurring_groups(id, name)")
    .eq("player_id", user.id)
    .order("points", { ascending: false });

  const totalMatches = myStats?.reduce((sum, s) => sum + s.matches_played, 0) ?? 0;
  const totalWins = myStats?.reduce((sum, s) => sum + s.wins, 0) ?? 0;
  const overallWinRate =
    totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : null;

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Profile</h1>
        <Link href="/profile/edit">
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">
                {profile.full_name ?? "No name set"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Skill Level
            </p>
            <Badge variant="secondary">{profile.skill_level ?? "Not set"}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Location
            </p>
            <p>{profile.city ?? "Not set"}</p>
          </div>
          {profile.bio && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Bio
              </p>
              <p className="text-sm">{profile.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badminton stats — only shown once the player has at least one match */}
      {totalMatches > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Badminton Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-2xl font-bold">{totalMatches}</p>
                <p className="text-xs text-muted-foreground">Matches</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-2xl font-bold">{totalWins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="text-2xl font-bold">{overallWinRate ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Win rate</p>
              </div>
            </div>

            {myStats && myStats.filter((s) => s.matches_played > 0).length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Group Rankings</h4>
                  <div className="space-y-1">
                    {myStats
                      .filter((s) => s.matches_played > 0)
                      .map((stat) => {
                        const group = stat.recurring_groups as { id: string; name: string } | null;
                        if (!group) return null;
                        const wr =
                          stat.matches_played > 0
                            ? Math.round((stat.wins / stat.matches_played) * 100)
                            : 0;
                        return (
                          <Link
                            key={stat.group_id}
                            href={`/groups/${stat.group_id}`}
                            className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {stat.rank === 1 && (
                                <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                              )}
                              <span className="text-sm truncate">{group.name}</span>
                              {stat.is_provisional && (
                                <span
                                  className="text-xs text-muted-foreground"
                                  title="Provisional — fewer than 5 matches"
                                >
                                  *
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-sm">
                              <span className="font-medium">
                                {stat.rank !== null ? `#${stat.rank}` : "—"}
                              </span>
                              <span className="text-muted-foreground">{wr}% win</span>
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
