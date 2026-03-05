import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/smtp";
import { format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or locally via the secret)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Target tomorrow's sessions so members can plan ahead
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Find all group sessions happening tomorrow
  const { data: sessions, error } = await admin
    .from("sessions")
    .select("id, title, start_time, end_time, location, city, group_id, date")
    .eq("date", tomorrowStr)
    .not("group_id", "is", null)
    .in("status", ["open", "full"]);

  if (error) {
    console.error("Cron: failed to fetch today's sessions", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: "No group sessions tomorrow" });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const tomorrowDayName = dayNames[tomorrow.getDay()];
  const formattedDate = format(tomorrow, "MMMM d, yyyy");

  let totalNotified = 0;

  for (const session of sessions) {
    const groupId = session.group_id as string;

    // Get group members
    const { data: members } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (!members || members.length === 0) continue;
    const memberIds = members.map((m) => m.user_id);

    // Post a system message in the group chat
    await admin.from("group_messages").insert({
      group_id: groupId,
      user_id: (
        await admin
          .from("recurring_groups")
          .select("owner_id")
          .eq("id", groupId)
          .single()
      ).data?.owner_id,
      content: `🏸 Reminder: session tomorrow! ${tomorrowDayName} ${formattedDate}, ${session.start_time.slice(0, 5)}–${session.end_time.slice(0, 5)} at ${session.location}. Please confirm your RSVP in the Schedule tab.`,
      is_system_message: true,
    });

    // Email members with notifications enabled
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email_notifications")
      .in("id", memberIds)
      .eq("email_notifications", true);

    if (!profiles || profiles.length === 0) continue;

    const { data: authData } = await admin.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    authData?.users?.forEach((u) => {
      if (u.email) emailMap.set(u.id, u.email);
    });

    const groupUrl = `${appUrl}/groups/${groupId}`;

    for (const profile of profiles) {
      const email = emailMap.get(profile.id);
      if (!email) continue;

      try {
        await sendEmail({
          to: email,
          subject: `${session.title} — session tomorrow! Confirm your RSVP`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a1a; margin: 0 0 16px 0;">Your session is tomorrow 🏸</h2>
              <p style="color: #374151; margin: 0 0 8px 0;">Hi ${profile.full_name ?? "Player"},</p>
              <p style="color: #374151; margin: 0 0 16px 0;">Just a reminder that <strong>${session.title}</strong> is happening tomorrow:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 0 0 20px 0;">
                <p style="margin: 4px 0; color: #374151; font-size: 14px;">📅 ${tomorrowDayName}, ${formattedDate}</p>
                <p style="margin: 4px 0; color: #374151; font-size: 14px;">🕐 ${session.start_time.slice(0, 5)}–${session.end_time.slice(0, 5)}</p>
                <p style="margin: 4px 0; color: #374151; font-size: 14px;">📍 ${session.location}, ${session.city}</p>
              </div>
              <p style="color: #374151; margin: 0 0 16px 0;">Please confirm whether you're coming so your crew can plan ahead.</p>
              <a href="${groupUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Confirm RSVP</a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this because you are a member of ${session.title} on ShuttleMates.</p>
            </div>
          `,
        });
        totalNotified++;
      } catch (err) {
        console.error(`Cron: failed to send reminder to ${profile.id}:`, err);
      }
    }
  }

  return NextResponse.json({
    message: `Reminders sent for ${sessions.length} session(s), ${totalNotified} member(s) notified`,
  });
}
