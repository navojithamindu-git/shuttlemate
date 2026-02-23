import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/smtp";
import { format } from "date-fns";

interface SessionEditData {
  sessionId: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  changes: string[];
  deadline: string;
  creatorId: string;
}

interface SessionCancelData {
  sessionId: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  creatorId: string;
}

interface SessionData {
  id: string;
  creator_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  skill_level: string;
  game_type: string;
}

export async function notifyMatchingPlayers(session: SessionData) {
  const admin = createAdminClient();

  // Determine the day of week for the session date (0=Sun, 6=Sat)
  const sessionDate = new Date(session.date + "T00:00:00");
  const dayOfWeek = sessionDate.getDay();

  // Find users with specific-date availability matching this session
  // Use %city% pattern so "Malabe" matches "Colombo, Gampaha, Malabe"
  const { data: specificMatches } = await admin
    .from("availability_specific")
    .select("user_id")
    .eq("date", session.date)
    .ilike("city", `%${session.city}%`)
    .lte("start_time", session.end_time)
    .gte("end_time", session.start_time)
    .neq("user_id", session.creator_id);

  // Find users with recurring availability overlapping this session's time range
  const { data: recurringMatches } = await admin
    .from("availability_recurring")
    .select("user_id")
    .eq("day_of_week", dayOfWeek)
    .ilike("city", `%${session.city}%`)
    .lte("start_time", session.end_time)
    .gte("end_time", session.start_time)
    .neq("user_id", session.creator_id);

  // Deduplicate user IDs
  const matchedUserIds = new Set<string>();
  specificMatches?.forEach((m) => matchedUserIds.add(m.user_id));
  recurringMatches?.forEach((m) => matchedUserIds.add(m.user_id));

  if (matchedUserIds.size === 0) return;

  // Get profiles with notifications enabled
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email_notifications")
    .in("id", Array.from(matchedUserIds))
    .eq("email_notifications", true);

  if (!profiles || profiles.length === 0) return;

  // Get emails from auth.users
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  // Filter out already-notified users
  const { data: existingNotifications } = await admin
    .from("notification_log")
    .select("user_id")
    .eq("session_id", session.id)
    .in("user_id", Array.from(matchedUserIds));

  const alreadyNotified = new Set(
    existingNotifications?.map((n) => n.user_id) ?? []
  );

  // Prepare email data
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const formattedDate = format(sessionDate, "EEEE, MMMM d, yyyy");
  const notificationInserts: {
    user_id: string;
    session_id: string;
    type: string;
  }[] = [];

  // Send emails
  for (const profile of profiles) {
    if (alreadyNotified.has(profile.id)) continue;

    const email = emailMap.get(profile.id);
    if (!email) continue;

    try {
      const playerName = profile.full_name ?? "Player";
      const sessionUrl = `${appUrl}/sessions/${session.id}`;

      await sendEmail({
        to: email,
        subject: `New session matches your availability: ${session.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">New session matches your availability!</h2>
            <p style="color: #374151; margin: 0 0 8px 0;">Hi ${playerName},</p>
            <p style="color: #374151; margin: 0 0 16px 0;">A new badminton session has been created that fits your schedule:</p>
            <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
              <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">${session.title}</h3>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Date: ${formattedDate}</p>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Time: ${session.start_time.slice(0, 5)} – ${session.end_time.slice(0, 5)}</p>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Location: ${session.location}, ${session.city}</p>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Level: ${session.skill_level} | Type: ${session.game_type}</p>
            </div>
            <a href="${sessionUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View Session</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because your availability matches this session. Manage your preferences in ShuttleMates availability settings.</p>
          </div>
        `,
      });

      notificationInserts.push({
        user_id: profile.id,
        session_id: session.id,
        type: "session_match",
      });
    } catch (err) {
      console.error(`Failed to send notification to ${profile.id}:`, err);
    }
  }

  // Log successful notifications
  if (notificationInserts.length > 0) {
    await admin.from("notification_log").insert(notificationInserts);
  }
}

export async function notifySessionEdited(data: SessionEditData) {
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Reset confirmed=false for all participants except creator
  await admin
    .from("session_participants")
    .update({
      confirmed: false,
      confirmation_deadline: data.deadline,
    })
    .eq("session_id", data.sessionId)
    .neq("user_id", data.creatorId);

  // Get all participants except creator
  const { data: participants } = await admin
    .from("session_participants")
    .select("user_id")
    .eq("session_id", data.sessionId)
    .neq("user_id", data.creatorId);

  if (!participants || participants.length === 0) return;

  const participantIds = participants.map((p) => p.user_id);

  // Post system chat message listing changes + deadline
  const deadlineFormatted = format(
    new Date(data.deadline),
    "EEEE, MMMM d 'at' h:mm a"
  );
  const changesList = data.changes.map((c) => `• ${c}`).join("\n");
  const systemContent = `Session updated by the host:\n${changesList}\n\nPlease confirm your attendance by ${deadlineFormatted} or your spot will be released.`;

  await admin.from("session_messages").insert({
    session_id: data.sessionId,
    user_id: data.creatorId,
    content: systemContent,
    is_system_message: true,
  });

  // Get all participant profiles (edit/cancel emails are always sent - not optional)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", participantIds);

  if (!profiles || profiles.length === 0) return;

  // Get emails from auth.users
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  const sessionDate = new Date(data.date + "T00:00:00");
  const formattedDate = format(sessionDate, "EEEE, MMMM d, yyyy");
  const sessionUrl = `${appUrl}/sessions/${data.sessionId}`;
  const changesHtml = data.changes
    .map((c) => `<li style="margin: 4px 0; color: #374151;">${c}</li>`)
    .join("");

  for (const profile of profiles) {
    const email = emailMap.get(profile.id);
    if (!email) continue;

    const playerName = profile.full_name ?? "Player";

    try {
      await sendEmail({
        to: email,
        subject: `Session updated: ${data.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Session Updated</h2>
            <p style="color: #374151; margin: 0 0 8px 0;">Hi ${playerName},</p>
            <p style="color: #374151; margin: 0 0 16px 0;">The host has made changes to <strong>${data.title}</strong>:</p>
            <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 16px 0;">
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #1a1a1a;">What changed:</p>
              <ul style="margin: 0; padding-left: 16px;">${changesHtml}</ul>
            </div>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">Action required</p>
              <p style="margin: 4px 0 0 0; color: #92400e;">Please confirm your attendance by <strong>${deadlineFormatted}</strong> or your spot will be released.</p>
            </div>
            <a href="${sessionUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Confirm Attendance</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you joined this session on ShuttleMates.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send edit notification to ${profile.id}:`, err);
    }
  }
}

export async function notifySessionCancelled(data: SessionCancelData) {
  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Get all participants except creator
  const { data: participants } = await admin
    .from("session_participants")
    .select("user_id")
    .eq("session_id", data.sessionId)
    .neq("user_id", data.creatorId);

  if (!participants || participants.length === 0) return;

  const participantIds = participants.map((p) => p.user_id);

  // Post system chat message
  await admin.from("session_messages").insert({
    session_id: data.sessionId,
    user_id: data.creatorId,
    content: "Session has been cancelled by the host.",
    is_system_message: true,
  });

  // Get all participant profiles (cancel emails are always sent - not optional)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", participantIds);

  if (!profiles || profiles.length === 0) return;

  // Get emails from auth.users
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  authData?.users?.forEach((u) => {
    if (u.email) emailMap.set(u.id, u.email);
  });

  const sessionDate = new Date(data.date + "T00:00:00");
  const formattedDate = format(sessionDate, "EEEE, MMMM d, yyyy");
  const sessionsUrl = `${appUrl}/sessions`;

  for (const profile of profiles) {
    const email = emailMap.get(profile.id);
    if (!email) continue;

    const playerName = profile.full_name ?? "Player";

    try {
      await sendEmail({
        to: email,
        subject: `Session cancelled: ${data.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Session Cancelled</h2>
            <p style="color: #374151; margin: 0 0 8px 0;">Hi ${playerName},</p>
            <p style="color: #374151; margin: 0 0 16px 0;">Unfortunately, the following session has been cancelled by the host:</p>
            <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
              <h3 style="margin: 0 0 12px 0; color: #991b1b;">${data.title}</h3>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Date: ${formattedDate}</p>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Time: ${data.start_time.slice(0, 5)} – ${data.end_time.slice(0, 5)}</p>
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Location: ${data.location}, ${data.city}</p>
            </div>
            <a href="${sessionsUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Browse Sessions</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you joined this session on ShuttleMates.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(
        `Failed to send cancellation notification to ${profile.id}:`,
        err
      );
      
    }
  }
}
