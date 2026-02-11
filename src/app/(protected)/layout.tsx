import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";

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
    <div className="min-h-screen flex flex-col">
      <Navbar
        userName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        unreadMessageCount={unreadCount ?? 0}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
