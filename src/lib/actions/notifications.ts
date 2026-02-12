import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/email/resend";
import { format } from "date-fns";

interface SessionData {
  id: string;
  creator_id: string;
  title: string;
  date: string;
  time: string;
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
    .lte("start_time", session.time)
    .gte("end_time", session.time)
    .neq("user_id", session.creator_id);

  // Find users with recurring availability matching this session
  const { data: recurringMatches } = await admin
    .from("availability_recurring")
    .select("user_id")
    .eq("day_of_week", dayOfWeek)
    .ilike("city", `%${session.city}%`)
    .lte("start_time", session.time)
    .gte("end_time", session.time)
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

      await resend.emails.send({
        from: "ShuttleMates <onboarding@resend.dev>",
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
              <p style="margin: 4px 0; color: #374151; font-size: 14px;">Time: ${session.time.slice(0, 5)}</p>
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
