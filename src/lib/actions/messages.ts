"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function sendGroupMessage(groupId: string, content: string) {
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
