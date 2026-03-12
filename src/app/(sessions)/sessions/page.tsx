import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupExpiredSessions, cleanupUnconfirmedParticipants } from "@/lib/actions/sessions";
import { SessionCard } from "@/components/sessions/session-card";
import { SessionFilters } from "@/components/sessions/session-filters";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";

interface SearchParams {
  city?: string;
  skill_level?: string;
  game_type?: string;
  date_from?: string;
  date_to?: string;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Clean up expired sessions and unconfirmed participants before fetching
  await cleanupExpiredSessions();
  try {
    await cleanupUnconfirmedParticipants();
  } catch (err) {
    console.error("Failed to cleanup unconfirmed participants:", err);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Use admin client so the query works for both authenticated and guest users
  // regardless of RLS policies on the sessions table
  const adminClient = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  let query = adminClient
    .from("sessions")
    .select(
      `*, session_participants(count)`
    )
    .in("status", ["open", "full"])
    .eq("is_private", false)
    .gte("date", params.date_from ?? today)
    .order("date", { ascending: true });

  if (params.date_to) query = query.lte("date", params.date_to);
  if (params.city) query = query.eq("city", params.city);
  if (params.skill_level) query = query.eq("skill_level", params.skill_level);
  if (params.game_type) query = query.eq("game_type", params.game_type);

  const { data: sessions } = await query;
  const sessionCount = sessions?.length ?? 0;
  const isFiltered = !!(params.city || params.skill_level || params.game_type);

  return (
    <div>
      <PageHeader
        title="Find Sessions"
        subtitle="Browse open badminton sessions near you and join a game."
        badge={sessionCount > 0 ? `${sessionCount} session${sessionCount !== 1 ? "s" : ""} available` : undefined}
        action={
          user ? (
            <Link href="/sessions/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Session
              </Button>
            </Link>
          ) : (
            <Link href="/signup">
              <Button variant="outline">Sign up to create</Button>
            </Link>
          )
        }
      />

      <div className="container mx-auto py-6 px-4">
        <SessionFilters currentFilters={params} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {sessions?.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
        {sessionCount === 0 && (
          <div className="col-span-full text-center py-16">
            <p className="text-4xl mb-3">🏸</p>
            <p className="text-lg font-semibold mb-1">No sessions found</p>
            <p className="text-muted-foreground text-sm mb-6">
              {isFiltered
                ? "Try adjusting your filters — there may be sessions in nearby areas."
                : "Be the first to put one together."}
            </p>
            {user ? (
              <Link href="/sessions/new">
                <Button className="gap-2">
                  <Zap className="h-4 w-4" />
                  Create a session
                </Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button>Sign up to create the first session</Button>
              </Link>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
