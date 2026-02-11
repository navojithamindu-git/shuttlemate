"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Conversation {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface ConversationListProps {
  currentUserId: string;
  selectedUserId?: string;
}

export function ConversationList({
  currentUserId,
  selectedUserId,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    const supabase = createClient();

    // Fetch all DMs involving the current user
    const { data: messages } = await supabase
      .from("direct_messages")
      .select("*, sender:profiles!sender_id(id, full_name, avatar_url), receiver:profiles!receiver_id(id, full_name, avatar_url)")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false });

    if (!messages) {
      setLoading(false);
      return;
    }

    // Group by conversation partner
    const convMap = new Map<string, Conversation>();

    for (const msg of messages) {
      const isSender = msg.sender_id === currentUserId;
      const otherUser = isSender ? msg.receiver : msg.sender;
      const otherId = isSender ? msg.receiver_id : msg.sender_id;

      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          userId: otherId,
          fullName: otherUser?.full_name ?? "Unknown",
          avatarUrl: otherUser?.avatar_url ?? null,
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        });
      }

      // Count unread messages from this user
      if (!isSender && !msg.read) {
        const conv = convMap.get(otherId)!;
        conv.unreadCount++;
      }
    }

    setConversations(Array.from(convMap.values()));
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [currentUserId]);

  // Subscribe to new DMs
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dm-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${currentUserId}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Loading conversations...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No messages yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation from a session&apos;s participant list
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((conv) => (
        <Link
          key={conv.userId}
          href={`/messages/${conv.userId}`}
          className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${
            selectedUserId === conv.userId ? "bg-muted" : ""
          }`}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={conv.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(conv.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{conv.fullName}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(conv.lastMessageAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">
                {conv.lastMessage}
              </p>
              {conv.unreadCount > 0 && (
                <Badge className="h-5 min-w-5 flex items-center justify-center text-[10px] px-1.5 shrink-0">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
