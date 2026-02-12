"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendDirectMessage,
  markDirectMessagesAsRead,
  editDirectMessage,
  deleteDirectMessage,
  toggleReaction,
} from "@/lib/actions/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Pencil, Trash2, Smile, X, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div className="w-[352px] h-[435px] bg-popover border rounded-lg flex items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  ),
});

interface Reaction {
  id: string;
  user_id: string;
  emoji: string;
  direct_message_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  is_edited?: boolean;
  is_deleted?: boolean;
  created_at: string;
}

interface ChatWindowProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  showBackButton?: boolean;
}

export function ChatWindow({
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  showBackButton = false,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch messages and reactions
  useEffect(() => {
    const supabase = createClient();

    async function fetchMessages() {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
      setLoading(false);

      if (data && data.length > 0) {
        const messageIds = data.map((m) => m.id);
        const { data: reactionsData } = await supabase
          .from("message_reactions")
          .select("*")
          .in("direct_message_id", messageIds);

        if (reactionsData) {
          const grouped: Record<string, Reaction[]> = {};
          reactionsData.forEach((r: Reaction) => {
            const key = r.direct_message_id!;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
          });
          setReactions(grouped);
        }
      }
    }

    fetchMessages();
    markDirectMessagesAsRead(otherUserId).catch(() => {});
  }, [currentUserId, otherUserId]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`dm-${[currentUserId, otherUserId].sort().join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `sender_id=eq.${otherUserId}`,
        },
        (payload) => {
          if (payload.new.receiver_id === currentUserId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as Message];
            });
            markDirectMessagesAsRead(otherUserId).catch(() => {});
          }
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
        (payload) => {
          if (payload.new.receiver_id === otherUserId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith("temp-") &&
                  m.content === payload.new.content
              );
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = payload.new as Message;
                return updated;
              }
              return [...prev, payload.new as Message];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? (payload.new as Message) : m
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const r = payload.new as Reaction;
          if (r.direct_message_id) {
            setReactions((prev) => {
              const existing = prev[r.direct_message_id!] || [];
              if (existing.some((e) => e.id === r.id)) return prev;
              return {
                ...prev,
                [r.direct_message_id!]: [...existing, r],
              };
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
        },
        (payload) => {
          const old = payload.old as { id: string };
          setReactions((prev) => {
            const updated = { ...prev };
            for (const key in updated) {
              updated[key] = updated[key].filter((r) => r.id !== old.id);
              if (updated[key].length === 0) delete updated[key];
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId]);

  // Auto-scroll
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendDirectMessage(otherUserId, content);
      const supabase = createClient();
      const { data: latest } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("sender_id", currentUserId)
        .eq("receiver_id", otherUserId)
        .eq("content", content)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (latest as Message) : m))
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
      toast.error(
        err instanceof Error ? err.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  };

  const handleEdit = useCallback(
    async (messageId: string) => {
      if (!editContent.trim()) return;
      try {
        await editDirectMessage(messageId, editContent.trim());
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: editContent.trim(), is_edited: true }
              : m
          )
        );
        setEditingId(null);
        setEditContent("");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to edit message"
        );
      }
    },
    [editContent]
  );

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await deleteDirectMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: "", is_deleted: true }
            : m
        )
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete message"
      );
    }
  }, []);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      // Optimistic update
      const tempReaction: Reaction = {
        id: `temp-${Date.now()}`,
        user_id: currentUserId,
        emoji,
        direct_message_id: messageId,
        created_at: new Date().toISOString(),
      };

      const existing = reactions[messageId] || [];
      const userExisting = existing.find(
        (r) => r.emoji === emoji && r.user_id === currentUserId
      );

      if (userExisting) {
        // Optimistically remove
        setReactions((prev) => {
          const updated = (prev[messageId] || []).filter(
            (r) => r.id !== userExisting.id
          );
          if (updated.length === 0) {
            const rest = { ...prev };
            delete rest[messageId];
            return rest;
          }
          return { ...prev, [messageId]: updated };
        });
      } else {
        // Optimistically add
        setReactions((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), tempReaction],
        }));
      }

      setEmojiPickerMsgId(null);

      try {
        await toggleReaction("direct", messageId, emoji);
      } catch (err) {
        // Revert on error
        if (userExisting) {
          setReactions((prev) => ({
            ...prev,
            [messageId]: [...(prev[messageId] || []), userExisting],
          }));
        } else {
          setReactions((prev) => {
            const updated = (prev[messageId] || []).filter(
              (r) => r.id !== tempReaction.id
            );
            if (updated.length === 0) {
              const rest = { ...prev };
              delete rest[messageId];
              return rest;
            }
            return { ...prev, [messageId]: updated };
          });
        }
        toast.error(
          err instanceof Error ? err.message : "Failed to react"
        );
      }
    },
    [currentUserId, reactions]
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const getGroupedReactions = (messageId: string) => {
    const msgReactions = reactions[messageId] || [];
    const grouped: Record<string, { emoji: string; count: number; userReacted: boolean }> = {};
    msgReactions.forEach((r) => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, userReacted: false };
      }
      grouped[r.emoji].count++;
      if (r.user_id === currentUserId) grouped[r.emoji].userReacted = true;
    });
    return Object.values(grouped);
  };

  // Determine which picker is open (message reaction or input)
  const isAnyPickerOpen = emojiPickerMsgId !== null || showInputEmoji;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        {showBackButton && (
          <Link href="/messages">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherUserAvatar ?? undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(otherUserName)}
          </AvatarFallback>
        </Avatar>
        <p className="font-medium text-sm">{otherUserName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Loading messages...
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          const isEditing = editingId === msg.id;
          const grouped = getGroupedReactions(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className={`max-w-[75%] relative group`}>
                {/* Action buttons */}
                {hoveredId === msg.id &&
                  !isEditing &&
                  !msg.is_deleted &&
                  !msg.id.startsWith("temp-") && (
                    <div
                      className={`absolute -top-8 ${
                        isOwn ? "right-0" : "left-0"
                      } flex items-center gap-0.5 bg-background border rounded-md shadow-sm p-0.5 z-10`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setEmojiPickerMsgId(
                            emojiPickerMsgId === msg.id ? null : msg.id
                          )
                        }
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </Button>
                      {isOwn && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(msg.id);
                              setEditContent(msg.content);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(msg.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                {/* Message-level emoji picker (rendered only for active message) */}
                {emojiPickerMsgId === msg.id && (
                  <div
                    className={`absolute bottom-full mb-1 z-50 ${
                      isOwn ? "right-0" : "left-0"
                    }`}
                  >
                      <EmojiPicker
                        onEmojiSelect={(emoji: { native: string }) =>
                          handleReaction(msg.id, emoji.native)
                        }
                        theme="auto"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                  </div>
                )}

                {/* Message bubble */}
                {msg.is_deleted ? (
                  <div className="rounded-lg px-3 py-1.5 text-sm bg-muted italic text-muted-foreground">
                    This message was deleted
                  </div>
                ) : isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      ref={editInputRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit(msg.id);
                        if (e.key === "Escape") {
                          setEditingId(null);
                          setEditContent("");
                        }
                      }}
                      className="text-sm h-8"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleEdit(msg.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setEditingId(null);
                        setEditContent("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content}
                  </div>
                )}

                {/* Reactions */}
                {grouped.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
                    {grouped.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => handleReaction(msg.id, r.emoji)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                          r.userReacted
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted border-transparent hover:border-border"
                        }`}
                      >
                        <span>{r.emoji}</span>
                        <span className="text-muted-foreground">{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp + edited label */}
                {!isEditing && (
                  <p
                    className={`text-[10px] text-muted-foreground mt-0.5 ${
                      isOwn ? "text-right" : ""
                    }`}
                  >
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                    {msg.is_edited && !msg.is_deleted && (
                      <span className="ml-1">(edited)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Dismiss overlay when emoji picker is open */}
      {isAnyPickerOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setEmojiPickerMsgId(null);
            setShowInputEmoji(false);
          }}
        />
      )}

      {/* Input */}
      <div className="p-4 border-t relative">
        {/* Input emoji picker - single instance, rendered only when open */}
        {showInputEmoji && (
          <div className="absolute bottom-full mb-2 left-4 z-50">
              <EmojiPicker
                onEmojiSelect={(emoji: { native: string }) => {
                  setNewMessage((prev) => prev + emoji.native);
                  setShowInputEmoji(false);
                  inputRef.current?.focus();
                }}
                theme="auto"
                previewPosition="none"
                skinTonePosition="none"
              />
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setShowInputEmoji(!showInputEmoji)}
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
