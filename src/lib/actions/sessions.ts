"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { GameType, SkillLevel } from "@/lib/types/database";

export async function createSession(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const sessionData = {
    creator_id: user.id,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    date: formData.get("date") as string,
    time: formData.get("time") as string,
    location: formData.get("location") as string,
    city: formData.get("city") as string,
    skill_level: formData.get("skill_level") as SkillLevel,
    game_type: formData.get("game_type") as GameType,
    max_players: parseInt(formData.get("max_players") as string),
  };

  const { data, error } = await supabase
    .from("sessions")
    .insert(sessionData)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Auto-join the creator as a participant
  await supabase.from("session_participants").insert({
    session_id: data.id,
    user_id: user.id,
  });

  // Notify players whose availability matches this session
  try {
    const { notifyMatchingPlayers } = await import(
      "@/lib/actions/notifications"
    );
    await notifyMatchingPlayers({
      id: data.id,
      creator_id: user.id,
      title: sessionData.title,
      date: sessionData.date,
      time: sessionData.time,
      location: sessionData.location,
      city: sessionData.city,
      skill_level: sessionData.skill_level,
      game_type: sessionData.game_type,
    });
  } catch (err) {
    console.error("Failed to send availability notifications:", err);
  }

  revalidatePath("/sessions");
  redirect(`/sessions/${data.id}`);
}

export async function cleanupExpiredSessions() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Mark past sessions as completed
  await supabase
    .from("sessions")
    .update({ status: "completed" })
    .lt("date", today)
    .in("status", ["open", "full"]);

  // Delete sessions older than 7 days (completed or cancelled)
  await supabase
    .from("sessions")
    .delete()
    .lt("date", sevenDaysAgo)
    .in("status", ["completed", "cancelled"]);
}

export async function joinSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check capacity and session status
  const { data: session } = await supabase
    .from("sessions")
    .select("max_players, date, status")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");

  // Prevent joining past or inactive sessions
  const today = new Date().toISOString().split("T")[0];
  if (session.date < today) {
    throw new Error("This session has already passed");
  }
  if (session.status === "completed" || session.status === "cancelled") {
    throw new Error("This session is no longer active");
  }

  const { count } = await supabase
    .from("session_participants")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (session && count !== null && count >= session.max_players) {
    throw new Error("Session is full");
  }

  const { error } = await supabase.from("session_participants").insert({
    session_id: sessionId,
    user_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Already joined this session");
    }
    throw new Error(error.message);
  }

  // Update status to full if at capacity
  if (session && count !== null && count + 1 >= session.max_players) {
    await supabase
      .from("sessions")
      .update({ status: "full" })
      .eq("id", sessionId);
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/my-sessions");
}

export async function leaveSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("session_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  // Reopen if was full
  await supabase
    .from("sessions")
    .update({ status: "open" })
    .eq("id", sessionId)
    .eq("status", "full");

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/my-sessions");
}

export async function cancelSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId)
    .eq("creator_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/my-sessions");
}
