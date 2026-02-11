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
