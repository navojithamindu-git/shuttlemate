import { createClient } from "@/lib/supabase/server";
import { GroupCard } from "@/components/groups/group-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  // Fetch user's groups with member count and next session
  const { data: memberships } = await supabase
    .from("group_members")
    .select(
      `
      group_id,
      recurring_groups(
        *,
        group_members(count),
        sessions!group_id(date)
      )
    `
    )
    .eq("user_id", user.id);

  const groups = memberships
    ?.map((m) => {
      const g = m.recurring_groups as any;
      if (!g) return null;
      const memberCount = g.group_members?.[0]?.count ?? 0;
      const futureDates = (g.sessions ?? [])
        .map((s: { date: string }) => s.date)
        .filter((d: string) => d >= today)
        .sort();
      return {
        ...g,
        memberCount,
        nextSessionDate: futureDates[0] ?? undefined,
      };
    })
    .filter(Boolean) ?? [];

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Groups</h1>
        <Link href="/groups/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg mb-2">No groups yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Create a private group for your regular crew, or ask someone to share an invite link.
          </p>
          <Link href="/groups/new">
            <Button>Create your first group</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: any) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
