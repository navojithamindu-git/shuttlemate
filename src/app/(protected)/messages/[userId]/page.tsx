import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/messages/conversation-list";
import { ChatWindow } from "@/components/messages/chat-window";

export default async function DirectMessagePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the other user's profile
  const { data: otherUser } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", userId)
    .single();

  if (!otherUser) notFound();

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6 hidden md:block">Messages</h1>

      <div className="flex gap-6">
        {/* Conversation list - hidden on mobile */}
        <Card className="hidden md:block w-96 overflow-hidden">
          <ConversationList
            currentUserId={user.id}
            selectedUserId={userId}
          />
        </Card>

        {/* Chat window */}
        <Card className="flex-1 overflow-hidden h-[calc(100vh-12rem)]">
          <ChatWindow
            currentUserId={user.id}
            otherUserId={otherUser.id}
            otherUserName={otherUser.full_name ?? "Unknown"}
            otherUserAvatar={otherUser.avatar_url}
            showBackButton
          />
        </Card>
      </div>
    </div>
  );
}
