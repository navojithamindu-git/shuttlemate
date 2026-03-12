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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowLeft, Pencil, Trash2, Smile, X, Check, ChevronDown } from "lucide-react";
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
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const hasInitialScrolledRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true });

    if (data) {
      setMessages((prev) => {
        // Preserve optimistic (temp) messages during polling
        const temps = prev.filter((m) => m.id.startsWith("temp-"));
        const remainingTemps = temps.filter(
          (t) =>
            !data.some(
              (d) => d.content === t.content && d.sender_id === t.sender_id
            )
        );
        return [...data, ...remainingTemps];
      });

      if (data.length > 0) {
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
  }, [currentUserId, otherUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Initial fetch
  useEffect(() => {
    fetchMessages().then(() => setLoading(false));
    markDirectMessagesAsRead(otherUserId).catch(() => {});
  }, [fetchMessages, otherUserId]);

  // Realtime subscription + presence for typing indicator
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
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          userId: string;
          typing: boolean;
        }>();
        const isOtherTyping = Object.values(state)
          .flat()
          .some((p) => p.userId === otherUserId && p.typing);
        setOtherUserTyping(isOtherTyping);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: currentUserId, typing: false });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, otherUserId]);

  // Polling fallback + visibility refetch (30s — realtime is primary, polling is safety net)
  useEffect(() => {
    const pollInterval = setInterval(fetchMessages, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchMessages();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMessages]);

  // Track scroll position for jump-to-bottom button
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setIsScrolledUp(!nearBottom);
      if (nearBottom) setNewMsgCount(0);
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll: instant jump on initial load, smart scroll for new messages
  useEffect(() => {
    if (messages.length === 0) return;

    if (!hasInitialScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView();
      hasInitialScrolledRef.current = true;
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessageCountRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        if (isNearBottom) {
          scrollToBottom();
        } else {
          setNewMsgCount((c) => c + (messages.length - prevMessageCountRef.current));
        }
      }
    }

    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleScrollToBottom = () => {
    scrollToBottom();
    setNewMsgCount(0);
    setIsScrolledUp(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Clear typing indicator immediately on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    channelRef.current?.track({ userId: currentUserId, typing: false });

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
        setReactions((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), tempReaction],
        }));
      }

      setEmojiPickerMsgId(null);

      try {
        await toggleReaction("direct", messageId, emoji);
      } catch (err) {
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

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  };

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

  const isAnyPickerOpen = emojiPickerMsgId !== null || showInputEmoji;
  const charsLeft = 2000 - newMessage.length;

  return (
    <div className="flex flex-col h-full relative">
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
        <div>
          <p className="font-medium text-sm leading-tight">{otherUserName}</p>
          {otherUserTyping && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">
              typing...
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-0 chat-texture">
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
        {messages.map((msg, index) => {
          const prevMsg = messages[index - 1];
          const isGrouped =
            !!prevMsg &&
            prevMsg.sender_id === msg.sender_id &&
            !msg.id.startsWith("temp-") &&
            new Date(msg.created_at).getTime() -
              new Date(prevMsg.created_at).getTime() <
              2 * 60 * 1000;

          const msgDate = new Date(msg.created_at).toDateString();
          const prevMsgDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
          const showDateSeparator = msgDate !== prevMsgDate;

          const isOwn = msg.sender_id === currentUserId;
          const isEditing = editingId === msg.id;
          const grouped = getGroupedReactions(msg.id);
          const isSending = msg.id.startsWith("temp-");

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{formatDateLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
            <div
              className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0.5" : "mt-3"} ${isSending ? "opacity-60" : ""}`}
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

                {/* Message-level emoji picker */}
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
                    className={`rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${
                      isOwn
                        ? "bg-emerald-600 text-white dark:bg-emerald-600"
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

                {/* Timestamp — hidden on grouped messages unless hovered */}
                {!isEditing && (!isGrouped || hoveredId === msg.id) && (
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
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to bottom button */}
      {isScrolledUp && (
        <div className="absolute bottom-[5rem] left-0 right-0 flex justify-center z-20 pointer-events-none">
          <button
            onClick={handleScrollToBottom}
            className="pointer-events-auto flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg hover:bg-emerald-700 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {newMsgCount > 0
              ? `${newMsgCount} new ${newMsgCount === 1 ? "message" : "messages"}`
              : "Scroll to bottom"}
          </button>
        </div>
      )}

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
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 mb-0.5"
            onClick={() => setShowInputEmoji(!showInputEmoji)}
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              const value = e.target.value;
              setNewMessage(value);
              if (channelRef.current) {
                channelRef.current.track({ userId: currentUserId, typing: true });
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  channelRef.current?.track({ userId: currentUserId, typing: false });
                }, 2000);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Type a message..."
            disabled={sending}
            maxLength={2000}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none py-2.5 overflow-y-auto"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 mb-0.5"
            disabled={sending || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {charsLeft <= 400 && (
          <p
            className={`text-[10px] text-right mt-1 ${
              charsLeft <= 100 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {charsLeft} remaining
          </p>
        )}
      </div>
    </div>
  );
}
