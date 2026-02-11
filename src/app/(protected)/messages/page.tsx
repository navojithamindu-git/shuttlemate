import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessageCircle } from "lucide-react";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6">Messages</h1>

      <div className="flex gap-6">
        {/* Conversation list */}
        <Card className="w-full md:w-96 overflow-hidden">
          <ConversationList currentUserId={user.id} />
        </Card>

        {/* Desktop: placeholder for when no conversation is selected */}
        <Card className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center p-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Select a conversation to start chatting
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
