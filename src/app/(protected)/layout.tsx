import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";
import { PushNotificationPrompt } from "@/components/layout/push-notification-prompt";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, profile_complete")
      .eq("id", user.id)
      .single(),
    supabase
      .from("direct_messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false),
  ]);

  return (
    <div className="min-h-screen flex flex-col page-texture">
      <Navbar
        userName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        unreadMessageCount={unreadCount ?? 0}
        isAuthenticated={true}
      />
      <main className="flex-1">{children}</main>
      <PushNotificationPrompt />
    </div>
  );
}
