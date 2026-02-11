"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendSessionMessage } from "@/lib/actions/messages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface SessionChatProps {
  sessionId: string;
  currentUserId: string;
}

export function SessionChat({ sessionId, currentUserId }: SessionChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch initial messages
  useEffect(() => {
    const supabase = createClient();

    async function fetchMessages() {
      const { data } = await supabase
        .from("session_messages")
        .select("*, profiles(full_name, avatar_url)")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    }

    fetchMessages();
  }, [sessionId]);

  // Subscribe to realtime messages
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`session-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // Fetch the full message with profile info
          const { data } = await supabase
            .from("session_messages")
            .select("*, profiles(full_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              // Replace optimistic temp message with real one
              const tempIndex = prev.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === data.content
              );
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = data;
                return updated;
              }
              return [...prev, data];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Optimistically add message to UI
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendSessionMessage(sessionId, content);
    } catch (err) {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setNewMessage(content);
      toast.error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Session Chat
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="h-80 overflow-y-auto space-y-3 mb-4 p-3 rounded-md border bg-muted/30"
        >
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Start the conversation!
            </p>
          )}
          {messages.map((msg) => {
            const isOwn = msg.user_id === currentUserId;
            const name = msg.profiles?.full_name ?? "Unknown";

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {!isOwn && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage
                      src={msg.profiles?.avatar_url ?? undefined}
                    />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}
                >
                  {!isOwn && (
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {name}
                    </p>
                  )}
                  <div
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
