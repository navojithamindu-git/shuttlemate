"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// --- Specific-date availability ---

export async function addSpecificAvailability(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const date = formData.get("date") as string;
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const city = formData.get("city") as string;

  if (!date || !start_time || !end_time || !city) {
    throw new Error("All fields are required");
  }
  if (end_time <= start_time) {
    throw new Error("End time must be after start time");
  }

  const { error } = await supabase.from("availability_specific").insert({
    user_id: user.id,
    date,
    start_time,
    end_time,
    city,
  });

  if (error) {
    if (error.code === "23505")
      throw new Error("This time slot already exists");
    throw new Error(error.message);
  }

  revalidatePath("/availability");
}

export async function removeSpecificAvailability(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("availability_specific")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/availability");
}

// --- Recurring weekly availability ---

export async function addRecurringAvailability(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const day_of_week = parseInt(formData.get("day_of_week") as string);
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const city = formData.get("city") as string;

  if (isNaN(day_of_week) || !start_time || !end_time || !city) {
    throw new Error("All fields are required");
  }
  if (end_time <= start_time) {
    throw new Error("End time must be after start time");
  }

  const { error } = await supabase.from("availability_recurring").insert({
    user_id: user.id,
    day_of_week,
    start_time,
    end_time,
    city,
  });

  if (error) {
    if (error.code === "23505")
      throw new Error("This time slot already exists");
    throw new Error(error.message);
  }

  revalidatePath("/availability");
}

export async function removeRecurringAvailability(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("availability_recurring")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/availability");
}

// --- Notification preferences ---

export async function updateNotificationPreference(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ email_notifications: enabled })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/availability");
}
