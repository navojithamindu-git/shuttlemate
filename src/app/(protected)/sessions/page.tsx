import { createClient } from "@/lib/supabase/server";
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

  let query = supabase
    .from("sessions")
    .select(
      `*, session_participants(count)`
    )
    .in("status", ["open", "full"])
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
        <Link href="/sessions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Session
          </Button>
        </Link>
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
            <Link href="/sessions/new">
              <Button>Be the first to create one</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
