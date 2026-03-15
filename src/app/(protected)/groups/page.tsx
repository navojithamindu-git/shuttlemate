import { createClient } from "@/lib/supabase/server";
import { GroupCard } from "@/components/groups/group-card";
import { PageHeader } from "@/components/layout/page-header";
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
    <div>
      <PageHeader
        title="My Groups"
        subtitle="Your private recurring groups and crews."
        badge={groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? "s" : ""}` : undefined}
        action={
          <Link href="/groups/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </Link>
        }
      />

      <div className="container mx-auto py-6 px-4">
        {groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold mb-1">No groups yet</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
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
    </div>
  );
}
