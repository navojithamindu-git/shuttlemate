import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionForm } from "@/components/sessions/session-form";
import type { SessionFormData } from "@/lib/types/database";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (!session) notFound();

  // Only the creator can edit
  if (session.creator_id !== user.id) redirect(`/sessions/${id}`);

  // Cannot edit cancelled or completed sessions
  if (session.status === "cancelled" || session.status === "completed") {
    redirect(`/sessions/${id}`);
  }

  const initialData: SessionFormData = {
    id: session.id,
    title: session.title,
    description: session.description,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    location: session.location,
    city: session.city,
    skill_level: session.skill_level,
    game_type: session.game_type,
    max_players: session.max_players,
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Edit Session</h1>
      <SessionForm mode="edit" initialData={initialData} />
    </div>
  );
}
