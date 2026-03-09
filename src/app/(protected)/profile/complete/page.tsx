import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfileCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { next } = await searchParams;

  if (profile?.profile_complete) redirect(next ?? "/sessions");

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">Complete Your Profile</h1>
      <p className="text-muted-foreground mb-8">
        Tell us about yourself so we can match you with the right sessions.
      </p>
      <ProfileForm profile={profile} isOnboarding={true} redirectTo={next} />
    </div>
  );
}
