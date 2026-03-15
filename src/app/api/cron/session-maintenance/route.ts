import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    expiredResult,
    deleteResult,
    { data: expiredParticipants },
  ] = await Promise.all([
    admin
      .from("sessions")
      .update({ status: "completed" })
      .lt("date", today)
      .in("status", ["open", "full"])
      .select("id"),
    admin
      .from("sessions")
      .delete()
      .lt("date", sevenDaysAgo)
      .in("status", ["completed", "cancelled"])
      .select("id"),
    admin
      .from("session_participants")
      .select("id, session_id")
      .eq("confirmed", false)
      .lt("confirmation_deadline", now.toISOString()),
  ]);

  const expired = expiredParticipants ?? [];
  let reopenedSessions = 0;

  if (expired.length > 0) {
    const expiredIds = expired.map((participant) => participant.id);
    const sessionIds = [...new Set(expired.map((participant) => participant.session_id))];

    await admin.from("session_participants").delete().in("id", expiredIds);

    const { data: sessions } = await admin
      .from("sessions")
      .select("id, max_players, status")
      .in("id", sessionIds)
      .eq("status", "full");

    for (const session of sessions ?? []) {
      const { count } = await admin
        .from("session_participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id);

      if (count !== null && count < session.max_players) {
        await admin
          .from("sessions")
          .update({ status: "open" })
          .eq("id", session.id);
        reopenedSessions++;
      }
    }
  }

  return NextResponse.json({
    completedSessions: expiredResult.data?.length ?? 0,
    deletedSessions: deleteResult.data?.length ?? 0,
    removedParticipants: expired.length,
    reopenedSessions,
  });
}
