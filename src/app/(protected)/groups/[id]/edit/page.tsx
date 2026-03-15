import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupForm } from "@/components/groups/group-form";
import { DeleteGroupButton } from "@/components/groups/delete-group-button";

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("recurring_groups")
    .select("*")
    .eq("id", id)
    .single();

  if (!group) notFound();

  // Only owner/admin can edit
  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .single();

  if (!member || !["owner", "admin"].includes(member.role)) {
    notFound();
  }

  const isOwner = member.role === "owner";

  return (
    <div className="container max-w-lg mx-auto py-8 px-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Edit Group</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupForm mode="edit" group={group} />
        </CardContent>
      </Card>

      {isOwner && (
        <div className="px-1">
          <DeleteGroupButton groupId={id} groupName={group.name} />
        </div>
      )}
    </div>
  );
}
