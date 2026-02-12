import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SpecificAvailabilityForm } from "@/components/availability/specific-availability-form";
import { RecurringAvailabilityForm } from "@/components/availability/recurring-availability-form";
import { AvailabilityList } from "@/components/availability/availability-list";
import { NotificationToggle } from "@/components/availability/notification-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: specificSlots }, { data: recurringSlots }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("city, email_notifications")
        .eq("id", user.id)
        .single(),
      supabase
        .from("availability_specific")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true }),
      supabase
        .from("availability_recurring")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week", { ascending: true }),
    ]);

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">My Availability</h1>
      <p className="text-muted-foreground mb-6">
        Set when you are free to play. You will be notified by email when a
        session is created that matches your availability and city.
      </p>

      <div className="space-y-6">
        <NotificationToggle
          enabled={profile?.email_notifications ?? true}
        />

        <Tabs defaultValue="specific">
          <TabsList>
            <TabsTrigger value="specific">Specific Dates</TabsTrigger>
            <TabsTrigger value="recurring">Weekly Recurring</TabsTrigger>
          </TabsList>
          <TabsContent value="specific" className="mt-4">
            <SpecificAvailabilityForm
              defaultCity={profile?.city ?? undefined}
            />
          </TabsContent>
          <TabsContent value="recurring" className="mt-4">
            <RecurringAvailabilityForm
              defaultCity={profile?.city ?? undefined}
            />
          </TabsContent>
        </Tabs>

        <AvailabilityList
          specificSlots={specificSlots ?? []}
          recurringSlots={recurringSlots ?? []}
        />
      </div>
    </div>
  );
}
