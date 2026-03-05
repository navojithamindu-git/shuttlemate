import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanupExpiredSessions, cleanupUnconfirmedParticipants } from "@/lib/actions/sessions";
import { SessionCard } from "@/components/sessions/session-card";
import { SessionFilters } from "@/components/sessions/session-filters";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

interface SearchParams {
  city?: string;
  skill_level?: string;
  game_type?: string;
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
  let query = adminClient
    .from("sessions")
    .select(
      `*, session_participants(count)`
    )
    .in("status", ["open", "full"])
    .eq("is_private", false)
    .gte("date", new Date().toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (params.city) query = query.eq("city", params.city);
  if (params.skill_level) query = query.eq("skill_level", params.skill_level);
  if (params.game_type) query = query.eq("game_type", params.game_type);

  const { data: sessions } = await query;

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Find Sessions</h1>
        {user ? (
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
        )}
      </div>

      <SessionFilters currentFilters={params} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {sessions?.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
        {(!sessions || sessions.length === 0) && (
          <div className="col-span-full text-center py-16">
            <p className="text-muted-foreground text-lg mb-4">
              No sessions found
            </p>
            {user ? (
              <Link href="/sessions/new">
                <Button>Be the first to create one</Button>
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
  );
}
