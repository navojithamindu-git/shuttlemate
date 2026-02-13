"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
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
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
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

  // Run notifications in the background (after response is sent)
  after(async () => {
    try {
      const { notifyMatchingPlayers } = await import(
        "@/lib/actions/notifications"
      );
      await notifyMatchingPlayers({
        id: data.id,
        creator_id: user.id,
        title: sessionData.title,
        date: sessionData.date,
        start_time: sessionData.start_time,
        end_time: sessionData.end_time,
        location: sessionData.location,
        city: sessionData.city,
        skill_level: sessionData.skill_level,
        game_type: sessionData.game_type,
      });
    } catch (err) {
      console.error("Failed to send availability notifications:", err);
    }
  });

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
    .select("max_players, date, start_time, status")
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

  // Fetch session details and participants before cancelling
  const { data: session } = await supabase
    .from("sessions")
    .select("title, date, start_time, end_time, location, city, creator_id")
    .eq("id", sessionId)
    .eq("creator_id", user.id)
    .single();

  if (!session) throw new Error("Session not found or not authorized");

  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId)
    .eq("creator_id", user.id);

  if (error) throw new Error(error.message);

  // Run notifications in the background (after response is sent)
  after(async () => {
    try {
      const { notifySessionCancelled } = await import(
        "@/lib/actions/notifications"
      );
      await notifySessionCancelled({
        sessionId,
        title: session.title,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        city: session.city,
        creatorId: user.id,
      });
    } catch (err) {
      console.error("Failed to send cancellation notifications:", err);
    }
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/my-sessions");
}

export async function editSession(
  sessionId: string,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  // Fetch current session
  const { data: session } = await supabase
    .from("sessions")
    .select("*, session_participants(count)")
    .eq("id", sessionId)
    .eq("creator_id", user.id)
    .single();

  if (!session) return { success: false, error: "Session not found or not authorized" };
  if (session.status === "cancelled" || session.status === "completed") {
    return { success: false, error: "Cannot edit a cancelled or completed session" };
  }

  // Parse new values
  const newData = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    date: formData.get("date") as string,
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
    location: formData.get("location") as string,
    city: formData.get("city") as string,
    skill_level: formData.get("skill_level") as SkillLevel,
    game_type: formData.get("game_type") as GameType,
    max_players: parseInt(formData.get("max_players") as string),
  };

  // Detect what changed
  const changes: string[] = [];
  if (session.title !== newData.title) changes.push(`Title: "${newData.title}"`);
  if (session.description !== newData.description) changes.push("Description updated");
  if (session.date !== newData.date) changes.push(`Date: ${newData.date}`);
  if (session.start_time.slice(0, 5) !== newData.start_time.slice(0, 5)) changes.push(`Start Time: ${newData.start_time}`);
  if (session.end_time.slice(0, 5) !== newData.end_time.slice(0, 5)) changes.push(`End Time: ${newData.end_time}`);
  if (session.location !== newData.location) changes.push(`Location: ${newData.location}`);
  if (session.city !== newData.city) changes.push(`City: ${newData.city}`);
  if (session.skill_level !== newData.skill_level) changes.push(`Skill Level: ${newData.skill_level}`);
  if (session.game_type !== newData.game_type) changes.push(`Game Type: ${newData.game_type}`);
  if (session.max_players !== newData.max_players) changes.push(`Max Players: ${newData.max_players}`);

  if (changes.length === 0) {
    return { success: false, error: "No changes detected" };
  }

  // Validate max_players >= current participant count
  const currentCount = session.session_participants?.[0]?.count ?? 0;
  if (newData.max_players < currentCount) {
    return {
      success: false,
      error: `Cannot reduce max players below current participant count (${currentCount})`,
    };
  }

  // Update session
  const { error } = await supabase
    .from("sessions")
    .update({
      ...newData,
      last_edited_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("creator_id", user.id);

  if (error) return { success: false, error: error.message };

  // Calculate dynamic confirmation deadline
  const sessionDateTime = new Date(newData.date + "T" + newData.start_time);
  const now = new Date();
  const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  let deadlineHours: number;
  if (hoursUntilSession < 6) {
    deadlineHours = 2;
  } else if (hoursUntilSession < 24) {
    deadlineHours = 6;
  } else if (hoursUntilSession < 72) {
    deadlineHours = 24;
  } else {
    deadlineHours = 48;
  }

  let deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
  // Cap: deadline never exceeds session start time
  if (deadline > sessionDateTime) {
    deadline = sessionDateTime;
  }

  // Run notifications in the background (after response is sent)
  // This prevents Vercel serverless function timeouts
  after(async () => {
    try {
      const { notifySessionEdited } = await import(
        "@/lib/actions/notifications"
      );
      await notifySessionEdited({
        sessionId,
        title: newData.title,
        date: newData.date,
        start_time: newData.start_time,
        end_time: newData.end_time,
        location: newData.location,
        city: newData.city,
        changes,
        deadline: deadline.toISOString(),
        creatorId: user.id,
      });
    } catch (err) {
      console.error("Failed to send edit notifications:", err);
    }
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/my-sessions");

  return { success: true };
}

export async function confirmSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check if session is still active
  const { data: session } = await supabase
    .from("sessions")
    .select("status")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Session not found");
  if (session.status === "cancelled") throw new Error("This session has been cancelled");
  if (session.status === "completed") throw new Error("This session has already completed");

  const { error } = await supabase
    .from("session_participants")
    .update({
      confirmed: true,
      confirmation_deadline: null,
    })
    .eq("session_id", sessionId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/sessions/${sessionId}`);
}

export async function cleanupUnconfirmedParticipants() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  // Find participants with confirmed=false AND deadline passed
  const { data: expired } = await admin
    .from("session_participants")
    .select("id, session_id")
    .eq("confirmed", false)
    .lt("confirmation_deadline", new Date().toISOString());

  if (!expired || expired.length === 0) return;

  // Get unique session IDs
  const sessionIds = [...new Set(expired.map((p) => p.session_id))];

  // Delete expired participants
  const expiredIds = expired.map((p) => p.id);
  await admin
    .from("session_participants")
    .delete()
    .in("id", expiredIds);

  // Reopen affected sessions from "full" to "open" if spots freed
  for (const sid of sessionIds) {
    const { data: session } = await admin
      .from("sessions")
      .select("max_players, status")
      .eq("id", sid)
      .single();

    if (session && session.status === "full") {
      const { count } = await admin
        .from("session_participants")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sid);

      if (count !== null && count < session.max_players) {
        await admin
          .from("sessions")
          .update({ status: "open" })
          .eq("id", sid);
      }
    }
  }
}
