"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

export async function sendSessionMessage(sessionId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase.from("session_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    content: trimmed,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/sessions/${sessionId}`);
}

export async function sendDirectMessage(receiverId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase.from("direct_messages").insert({
    sender_id: user.id,
    receiver_id: receiverId,
    content: trimmed,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/messages");
  revalidatePath(`/messages/${receiverId}`);
}

export async function editDirectMessage(messageId: string, newContent: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = newContent.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase
    .from("direct_messages")
    .update({ content: trimmed, is_edited: true })
    .eq("id", messageId)
    .eq("sender_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/messages");
}

export async function deleteDirectMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("direct_messages")
    .update({ content: "", is_deleted: true })
    .eq("id", messageId)
    .eq("sender_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/messages");
}

export async function editSessionMessage(
  messageId: string,
  newContent: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = newContent.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase
    .from("session_messages")
    .update({ content: trimmed, is_edited: true })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function deleteSessionMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("session_messages")
    .update({ content: "", is_deleted: true })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function sendGroupMessage(
  groupId: string,
  content: string,
  mentionedUserIds?: string[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase.from("group_messages").insert({
    group_id: groupId,
    user_id: user.id,
    content: trimmed,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupId}`);

  // Send push notifications in background
  after(async () => {
    try {
      const admin = createAdminClient();

      const [{ data: sender }, { data: group }, { data: members }] =
        await Promise.all([
          admin
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single(),
          admin
            .from("recurring_groups")
            .select("name")
            .eq("id", groupId)
            .single(),
          admin
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupId)
            .neq("user_id", user.id),
        ]);

      if (!members || members.length === 0) return;

      const senderName = sender?.full_name ?? "Someone";
      const groupName = group?.name ?? "ShuttleMates";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const url = `${appUrl}/groups/${groupId}`;
      const preview = trimmed.length > 80 ? trimmed.slice(0, 77) + "..." : trimmed;

      const allMemberIds = members.map((m) => m.user_id);
      const mentionedIds = (mentionedUserIds ?? []).filter(
        (id) => id !== user.id
      );
      const otherIds = allMemberIds.filter((id) => !mentionedIds.includes(id));

      const { sendPushToUsers } = await import("@/lib/actions/push");

      await Promise.all([
        mentionedIds.length > 0
          ? sendPushToUsers(mentionedIds, {
              title: `${senderName} mentioned you in ${groupName}`,
              body: preview,
              url,
              tag: `group-mention-${groupId}`,
            })
          : Promise.resolve(),
        otherIds.length > 0
          ? sendPushToUsers(otherIds, {
              title: groupName,
              body: `${senderName}: ${preview}`,
              url,
              tag: `group-chat-${groupId}`,
            })
          : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("Failed to send push notifications:", err);
    }
  });
}

export async function editGroupMessage(messageId: string, newContent: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const trimmed = newContent.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const { error } = await supabase
    .from("group_messages")
    .update({ content: trimmed, is_edited: true })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function deleteGroupMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("group_messages")
    .update({ content: "", is_deleted: true })
    .eq("id", messageId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function toggleReaction(
  messageType: "direct" | "session" | "group",
  messageId: string,
  emoji: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const column =
    messageType === "direct"
      ? "direct_message_id"
      : messageType === "session"
      ? "session_message_id"
      : "group_message_id";

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .eq(column, messageId)
    .maybeSingle();

  if (existing) {
    // Remove reaction
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
  } else {
    // Add reaction
    const { error } = await supabase.from("message_reactions").insert({
      user_id: user.id,
      emoji,
      [column]: messageId,
    });

    if (error) throw new Error(error.message);
  }
}

export async function markDirectMessagesAsRead(senderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("direct_messages")
    .update({ read: true })
    .eq("sender_id", senderId)
    .eq("receiver_id", user.id)
    .eq("read", false);

  if (error) throw new Error(error.message);
}
