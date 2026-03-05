"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { format } from "date-fns";
import type { GameType, RsvpStatus, SkillLevel } from "@/lib/types/database";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the next `count` future dates that fall on `dayOfWeek` (0=Sun, 6=Sat),
 *  starting strictly after `afterDate` (defaults to today). */
function getNextOccurrences(
  dayOfWeek: number,
  count: number,
  afterDate?: Date
): Date[] {
  const dates: Date[] = [];
  const cursor = afterDate ? new Date(afterDate) : new Date();
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === dayOfWeek) {
      dates.push(new Date(cursor));
    }
  }
  return dates;
}

// ─── Create group ────────────────────────────────────────────────────────────

export async function createRecurringGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const groupData = {
    owner_id: user.id,
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    day_of_week: parseInt(formData.get("day_of_week") as string),
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
    location: formData.get("location") as string,
    city: formData.get("city") as string,
    skill_level: formData.get("skill_level") as SkillLevel,
    game_type: formData.get("game_type") as GameType,
    max_players: 20, // session capacity = member count at generation time
  };

  const admin = createAdminClient();

  const { data: group, error } = await admin
    .from("recurring_groups")
    .insert(groupData)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Add owner as first member with 'owner' role (must happen before SELECT policy can read group)
  await admin.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "owner",
  });

  // Generate initial sessions and notify in background
  after(async () => {
    try {
      await generateGroupSessions(group.id, group, 4);

      // Post welcome system message
      const admin = createAdminClient();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      await admin.from("group_messages").insert({
        group_id: group.id,
        user_id: user.id,
        content: `Welcome to ${group.name}! This is your group's chat. Sessions are scheduled every ${dayNames[group.day_of_week]} at ${group.start_time.slice(0, 5)}–${group.end_time.slice(0, 5)}.`,
        is_system_message: true,
      });
    } catch (err) {
      console.error("Failed to generate initial group sessions:", err);
    }
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

// ─── Generate sessions ───────────────────────────────────────────────────────

/** Generate `count` new occurrences for the group. Used on creation and rolling. */
export async function generateGroupSessions(
  groupId: string,
  group: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    location: string;
    city: string;
    skill_level: string;
    game_type: string;
    max_players: number;
    owner_id: string;
    name: string;
  },
  count: number
) {
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Find the latest scheduled future session for this group
  const today = new Date().toISOString().split("T")[0];
  const { data: existingSessions } = await admin
    .from("sessions")
    .select("date")
    .eq("group_id", groupId)
    .gte("date", today)
    .order("date", { ascending: false })
    .limit(1);

  const latestDate =
    existingSessions && existingSessions.length > 0
      ? new Date(existingSessions[0].date + "T00:00:00")
      : undefined;

  const newDates = getNextOccurrences(group.day_of_week, count, latestDate);

  // Get current group members for bulk participant + RSVP inserts
  const { data: members } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);

  const memberIds = members?.map((m) => m.user_id) ?? [];

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let i = 0; i < newDates.length; i++) {
    const date = newDates[i];
    const dateStr = date.toISOString().split("T")[0];
    const isFirst = i === 0;

    // Insert the session
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({
        creator_id: group.owner_id,
        title: group.name,
        date: dateStr,
        start_time: group.start_time,
        end_time: group.end_time,
        location: group.location,
        city: group.city,
        skill_level: group.skill_level,
        game_type: group.game_type,
        max_players: memberIds.length || group.max_players,
        group_id: groupId,
        is_private: true,
        status: "open",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Failed to insert session for date", dateStr, sessionError);
      continue;
    }

    if (memberIds.length > 0) {
      await admin.from("session_participants").insert(
        memberIds.map((uid) => ({ session_id: session.id, user_id: uid }))
      );
      await admin.from("group_session_rsvps").insert(
        memberIds.map((uid) => ({ session_id: session.id, user_id: uid, status: "yes" }))
      );
    }

    // Only announce the nearest session — skip silent future ones
    if (!isFirst) continue;

    const formattedDate = format(date, "MMMM d, yyyy");
    await admin.from("group_messages").insert({
      group_id: groupId,
      user_id: group.owner_id,
      content: `📅 Next session: ${dayNames[group.day_of_week]} ${formattedDate}, ${group.start_time.slice(0, 5)}–${group.end_time.slice(0, 5)} at ${group.location}. Update your RSVP in the Schedule tab.`,
      is_system_message: true,
    });

    if (memberIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, email_notifications")
        .in("id", memberIds)
        .eq("email_notifications", true);

      if (profiles && profiles.length > 0) {
        const { data: authData } = await admin.auth.admin.listUsers();
        const emailMap = new Map<string, string>();
        authData?.users?.forEach((u) => {
          if (u.email) emailMap.set(u.id, u.email);
        });

        const { sendEmail } = await import("@/lib/email/smtp");
        const groupUrl = `${appUrl}/groups/${groupId}`;

        for (const profile of profiles) {
          const email = emailMap.get(profile.id);
          if (!email) continue;

          try {
            await sendEmail({
              to: email,
              subject: `${group.name} — session scheduled for ${formattedDate}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">New session scheduled</h2>
                  <p style="color: #374151; margin: 0 0 8px 0;">Hi ${profile.full_name ?? "Player"},</p>
                  <p style="color: #374151; margin: 0 0 16px 0;">Your group <strong>${group.name}</strong> has a session coming up:</p>
                  <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">📅 ${dayNames[group.day_of_week]}, ${formattedDate}</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">🕐 ${group.start_time.slice(0, 5)}–${group.end_time.slice(0, 5)}</p>
                    <p style="margin: 4px 0; color: #374151; font-size: 14px;">📍 ${group.location}, ${group.city}</p>
                  </div>
                  <p style="color: #374151; margin: 0 0 16px 0;">You're marked as <strong>Going</strong> by default. Update your RSVP if your plans change.</p>
                  <a href="${groupUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Update RSVP</a>
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you are a member of ${group.name} on ShuttleMates.</p>
                </div>
              `,
            });
          } catch (err) {
            console.error(`Failed to send session notification to ${profile.id}:`, err);
          }
        }
      }
    }
  }
}

// ─── Rolling session generation ──────────────────────────────────────────────

/** Called on group page load. Generates one more occurrence if the latest is within 7 days. */
export async function rollGroupSessions(groupId: string) {
  const admin = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: latestSession } = await admin
    .from("sessions")
    .select("date")
    .eq("group_id", groupId)
    .gte("date", todayStr)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!latestSession) return;

  const latestDate = new Date(latestSession.date + "T00:00:00");
  const daysUntilLatest = Math.floor(
    (latestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilLatest > 7) return;

  const { data: group } = await admin
    .from("recurring_groups")
    .select("*")
    .eq("id", groupId)
    .eq("is_active", true)
    .single();

  if (!group) return;

  await generateGroupSessions(groupId, group, 1);
}

// ─── Invite link ─────────────────────────────────────────────────────────────

export async function generateInviteLink(
  groupId: string
): Promise<{ url: string; expiresAt: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check caller is owner or admin
  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  // Delete any existing invite for this group
  await supabase.from("group_invitations").delete().eq("group_id", groupId);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("group_invitations").insert({
    group_id: groupId,
    token,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { url: `${appUrl}/join/${token}`, expiresAt };
}

export async function revokeInviteLink(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    throw new Error("Not authorized");
  }

  await supabase.from("group_invitations").delete().eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}`);
}

// ─── Accept invite ───────────────────────────────────────────────────────────

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Use admin client to read invite regardless of RLS
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("group_invitations")
    .select("group_id, expires_at")
    .eq("token", token)
    .single();

  if (!invitation) throw new Error("Invalid invite link");
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error("This invite link has expired");
  }

  const groupId = invitation.group_id;

  // Check if already a member
  const { data: existing } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    redirect(`/groups/${groupId}`);
  }

  // Add to group
  const { error } = await admin.from("group_members").insert({
    group_id: groupId,
    user_id: user.id,
    role: "member",
  });

  if (error) throw new Error(error.message);

  // Add to all upcoming sessions of the group + default RSVP
  const today = new Date().toISOString().split("T")[0];
  const { data: upcomingSessions } = await admin
    .from("sessions")
    .select("id")
    .eq("group_id", groupId)
    .gte("date", today)
    .in("status", ["open", "full"]);

  if (upcomingSessions && upcomingSessions.length > 0) {
    const sessionIds = upcomingSessions.map((s) => s.id);
    await admin.from("session_participants").insert(
      sessionIds.map((sid) => ({ session_id: sid, user_id: user.id }))
    );
    await admin.from("group_session_rsvps").insert(
      sessionIds.map((sid) => ({ session_id: sid, user_id: user.id, status: "yes" }))
    );
  }

  // Post system message
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: group } = await admin
    .from("recurring_groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  await admin.from("group_messages").insert({
    group_id: groupId,
    user_id: group?.owner_id ?? user.id,
    content: `${profile?.full_name ?? "A new player"} joined the group.`,
    is_system_message: true,
  });

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

// ─── Remove member ───────────────────────────────────────────────────────────

export async function removeMember(groupId: string, targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Check caller is owner/admin OR removing themselves
  if (user.id !== targetUserId) {
    const { data: callerMember } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .single();

    if (!callerMember || !["owner", "admin"].includes(callerMember.role)) {
      throw new Error("Not authorized");
    }

    // Prevent removing the owner
    const { data: targetMember } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", targetUserId)
      .single();

    if (targetMember?.role === "owner") {
      throw new Error("Cannot remove the group owner");
    }
  }

  const admin = createAdminClient();

  // Get target name for system message
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", targetUserId)
    .single();

  // Remove from group
  await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);

  // Remove from upcoming sessions
  const today = new Date().toISOString().split("T")[0];
  const { data: upcomingSessions } = await admin
    .from("sessions")
    .select("id")
    .eq("group_id", groupId)
    .gte("date", today);

  if (upcomingSessions && upcomingSessions.length > 0) {
    const sessionIds = upcomingSessions.map((s) => s.id);
    await admin
      .from("session_participants")
      .delete()
      .in("session_id", sessionIds)
      .eq("user_id", targetUserId);
    await admin
      .from("group_session_rsvps")
      .delete()
      .in("session_id", sessionIds)
      .eq("user_id", targetUserId);
  }

  // Get group owner for system message author
  const { data: group } = await admin
    .from("recurring_groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  const name = profile?.full_name ?? "A member";
  const isLeaving = user.id === targetUserId;
  await admin.from("group_messages").insert({
    group_id: groupId,
    user_id: group?.owner_id ?? user.id,
    content: isLeaving ? `${name} left the group.` : `${name} was removed from the group.`,
    is_system_message: true,
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
}

// ─── Update RSVP ─────────────────────────────────────────────────────────────

export async function updateGroupRsvp(sessionId: string, status: RsvpStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("group_session_rsvps").upsert(
    { session_id: sessionId, user_id: user.id, status },
    { onConflict: "session_id,user_id" }
  );

  if (error) throw new Error(error.message);

  // Find group_id to revalidate
  const { data: session } = await supabase
    .from("sessions")
    .select("group_id")
    .eq("id", sessionId)
    .single();

  if (session?.group_id) {
    revalidatePath(`/groups/${session.group_id}`);
  }
}

// ─── Update group settings ───────────────────────────────────────────────────

export async function updateGroup(
  groupId: string,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    return { success: false, error: "Not authorized" };
  }

  const { data: current } = await supabase
    .from("recurring_groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (!current) return { success: false, error: "Group not found" };

  const newData = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    day_of_week: parseInt(formData.get("day_of_week") as string),
    start_time: formData.get("start_time") as string,
    end_time: formData.get("end_time") as string,
    location: formData.get("location") as string,
    city: formData.get("city") as string,
    skill_level: formData.get("skill_level") as SkillLevel,
    game_type: formData.get("game_type") as GameType,
  };

  const { error } = await supabase
    .from("recurring_groups")
    .update(newData)
    .eq("id", groupId);

  if (error) return { success: false, error: error.message };

  // Detect schedule changes and post system message
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const changes: string[] = [];
  if (current.name !== newData.name) changes.push(`Name: "${newData.name}"`);
  if (current.day_of_week !== newData.day_of_week) changes.push(`Day: ${dayNames[newData.day_of_week]}`);
  if (current.start_time.slice(0, 5) !== newData.start_time.slice(0, 5)) changes.push(`Start time: ${newData.start_time}`);
  if (current.end_time.slice(0, 5) !== newData.end_time.slice(0, 5)) changes.push(`End time: ${newData.end_time}`);
  if (current.location !== newData.location) changes.push(`Location: ${newData.location}`);
  if (current.city !== newData.city) changes.push(`City: ${newData.city}`);

  if (changes.length > 0) {
    after(async () => {
      const admin = createAdminClient();
      const changesList = changes.map((c) => `• ${c}`).join("\n");

      await admin.from("group_messages").insert({
        group_id: groupId,
        user_id: user.id,
        content: `Group settings updated:\n${changesList}`,
        is_system_message: true,
      });

      // Email members about the changes
      const { data: members } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      if (!members || members.length === 0) return;
      const memberIds = members.map((m) => m.user_id);

      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, email_notifications")
        .in("id", memberIds)
        .eq("email_notifications", true);

      if (!profiles || profiles.length === 0) return;

      const { data: authData } = await admin.auth.admin.listUsers();
      const emailMap = new Map<string, string>();
      authData?.users?.forEach((u) => {
        if (u.email) emailMap.set(u.id, u.email);
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const groupUrl = `${appUrl}/groups/${groupId}`;
      const { sendEmail } = await import("@/lib/email/smtp");

      for (const profile of profiles) {
        const email = emailMap.get(profile.id);
        if (!email) continue;
        try {
          await sendEmail({
            to: email,
            subject: `${newData.name} — group settings updated`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Group settings updated</h2>
                <p style="color: #374151; margin: 0 0 8px 0;">Hi ${profile.full_name ?? "Player"},</p>
                <p style="color: #374151; margin: 0 0 16px 0;">The settings for your group <strong>${newData.name}</strong> have been updated:</p>
                <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; white-space: pre-line; font-size: 14px; color: #374151;">
${changes.map((c) => `• ${c}`).join("\n")}
                </div>
                <a href="${groupUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View Group</a>
                <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you are a member of ${newData.name} on ShuttleMates.</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`Failed to send update email to ${profile.id}:`, err);
        }
      }
    });
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { success: true };
}

// ─── Promote member to admin ─────────────────────────────────────────────────

export async function promoteMember(groupId: string, targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: callerMember } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (callerMember?.role !== "owner") throw new Error("Only the owner can promote members");

  await supabase
    .from("group_members")
    .update({ role: "admin" })
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);

  revalidatePath(`/groups/${groupId}`);
}
