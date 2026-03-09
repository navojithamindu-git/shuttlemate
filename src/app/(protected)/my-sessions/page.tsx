import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cleanupExpiredSessions } from "@/lib/actions/sessions";
import { SessionCard } from "@/components/sessions/session-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function MySessionsPage() {
  // Clean up expired sessions before fetching
  await cleanupExpiredSessions();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Sessions I created (exclude group sessions — those live in My Groups)
  const { data: createdSessions } = await supabase
    .from("sessions")
    .select(`*, session_participants(count)`)
    .eq("creator_id", user.id)
    .is("group_id", null)
    .order("date", { ascending: true });

  // Sessions I joined (but didn't create, and not group sessions)
  const { data: joinedData } = await supabase
    .from("session_participants")
    .select("session_id")
    .eq("user_id", user.id);

  const joinedSessionIds = joinedData?.map((j) => j.session_id) ?? [];

  let joinedSessions: typeof createdSessions = [];
  if (joinedSessionIds.length > 0) {
    const { data } = await supabase
      .from("sessions")
      .select(`*, session_participants(count)`)
      .in("id", joinedSessionIds)
      .neq("creator_id", user.id)
      .is("group_id", null)
      .order("date", { ascending: true });
    joinedSessions = data;
  }

  // Split into upcoming and past
  const isUpcoming = (s: { status: string }) =>
    s.status !== "completed" && s.status !== "cancelled";

  const createdUpcoming = createdSessions?.filter(isUpcoming) ?? [];
  const createdPast = createdSessions?.filter((s) => !isUpcoming(s)) ?? [];
  const joinedUpcoming = joinedSessions?.filter(isUpcoming) ?? [];
  const joinedPast = joinedSessions?.filter((s) => !isUpcoming(s)) ?? [];

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Sessions</h1>
        <Link href="/sessions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Session
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="created">
        <TabsList>
          <TabsTrigger value="created">
            Created ({createdSessions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="joined">
            Joined ({joinedSessions?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-6 space-y-8">
          {/* Upcoming created sessions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {createdUpcoming.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
            {createdUpcoming.length === 0 && createdPast.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12">
                You haven&apos;t created any sessions yet.
              </p>
            )}
            {createdUpcoming.length === 0 && createdPast.length > 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No upcoming sessions.
              </p>
            )}
          </div>

          {/* Past created sessions */}
          {createdPast.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                Past Sessions
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {createdPast.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="joined" className="mt-6 space-y-8">
          {/* Upcoming joined sessions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {joinedUpcoming.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
            {joinedUpcoming.length === 0 && joinedPast.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12">
                You haven&apos;t joined any sessions yet.
              </p>
            )}
            {joinedUpcoming.length === 0 && joinedPast.length > 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                No upcoming sessions.
              </p>
            )}
          </div>

          {/* Past joined sessions */}
          {joinedPast.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                Past Sessions
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {joinedPast.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
