import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";

export default async function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let unreadCount = 0;

  if (user) {
    const [{ data: profileData }, { count }] = await Promise.all([
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
    profile = profileData;
    unreadCount = count ?? 0;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        userName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        unreadMessageCount={unreadCount}
        isAuthenticated={!!user}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
