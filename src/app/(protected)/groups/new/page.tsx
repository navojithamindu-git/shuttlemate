import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupForm } from "@/components/groups/group-form";

export default function NewGroupPage() {
  return (
    <div className="container max-w-lg mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Create a Recurring Group</CardTitle>
          <p className="text-sm text-muted-foreground">
            Your crew will have a private chat and auto-scheduled weekly sessions.
          </p>
        </CardHeader>
        <CardContent>
          <GroupForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
