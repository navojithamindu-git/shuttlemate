"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  toggleReaction,
} from "@/lib/actions/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Pencil, Trash2, Smile, X, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
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
  group_message_id: string | null;
  created_at: string;
}

interface Message {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  is_system_message?: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Member {
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface GroupChatProps {
  groupId: string;
  currentUserId: string;
  currentUserName: string | null;
  members: Member[];
}

/** Render message content, highlighting @mentions */
function renderContent(content: string, currentUserName: string | null) {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const isMe = currentUserName && part === `@${currentUserName}`;
      return (
        <span
          key={i}
          className={`font-semibold ${isMe ? "text-emerald-500" : "text-blue-500"}`}
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function GroupChat({
  groupId,
  currentUserId,
  currentUserName,
  members,
}: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);

  // @mention state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef<number>(0);

  const fetchMessages = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("group_messages")
      .select("*, profiles(full_name, avatar_url)")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages((prev) => {
        const temps = prev.filter((m) => m.id.startsWith("temp-"));
        const remainingTemps = temps.filter(
          (t) => !data.some((d) => d.content === t.content && d.user_id === t.user_id)
        );
        return [...data, ...remainingTemps];
      });

      if (data.length > 0) {
        const messageIds = data.map((m) => m.id);
        const { data: reactionsData } = await supabase
          .from("message_reactions")
          .select("*")
          .in("group_message_id", messageIds);

        if (reactionsData) {
          const grouped: Record<string, Reaction[]> = {};
          reactionsData.forEach((r: Reaction) => {
            const key = r.group_message_id!;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
          });
          setReactions(grouped);
        }
      }
    }
  }, [groupId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from("group_messages")
            .select("*, profiles(full_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from("group_messages")
            .select("*, profiles(full_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => prev.map((m) => (m.id === data.id ? data : m)));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          if (r.group_message_id) {
            setReactions((prev) => {
              const existing = prev[r.group_message_id!] || [];
              if (existing.some((e) => e.id === r.id)) return prev;
              return { ...prev, [r.group_message_id!]: [...existing, r] };
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "message_reactions" },
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
  }, [groupId]);

  // Polling fallback
  useEffect(() => {
    const pollInterval = setInterval(fetchMessages, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchMessages();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (prevMessageCountRef.current > 0 && messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  // Detect @mention trigger in the input
  const handleInputChange = (value: string) => {
    setNewMessage(value);

    // Find active @mention at end of string: last @ not followed by a space
    const match = value.match(/@([^\s]*)$/);
    if (match) {
      setMentionSearch(match[1]);
    } else {
      setMentionSearch(null);
    }
  };

  const filteredMembers = mentionSearch !== null
    ? members.filter((m) => {
        const name = m.profiles?.full_name ?? "";
        return (
          m.user_id !== currentUserId &&
          name.toLowerCase().includes(mentionSearch.toLowerCase())
        );
      })
    : [];

  const handleMentionSelect = (member: Member) => {
    const name = member.profiles?.full_name ?? "";
    // Replace the @partial with @FullName
    const updated = newMessage.replace(/@([^\s]*)$/, `@${name} `);
    setNewMessage(updated);
    setMentionSearch(null);
    setMentionedUserIds((prev) => new Set([...prev, member.user_id]));
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    const mentionIds = Array.from(mentionedUserIds);
    setNewMessage("");
    setMentionSearch(null);
    setMentionedUserIds(new Set());
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      group_id: groupId,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendGroupMessage(groupId, content, mentionIds);
      const supabase = createClient();
      const { data: latest } = await supabase
        .from("group_messages")
        .select("*, profiles(full_name, avatar_url)")
        .eq("group_id", groupId)
        .eq("user_id", currentUserId)
        .eq("content", content)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? latest : m)));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleEdit = useCallback(
    async (messageId: string) => {
      if (!editContent.trim()) return;
      try {
        await editGroupMessage(messageId, editContent.trim());
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, content: editContent.trim(), is_edited: true } : m
          )
        );
        setEditingId(null);
        setEditContent("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to edit message");
      }
    },
    [editContent]
  );

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await deleteGroupMessage(messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: "", is_deleted: true } : m))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete message");
    }
  }, []);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const tempReaction: Reaction = {
        id: `temp-${Date.now()}`,
        user_id: currentUserId,
        emoji,
        group_message_id: messageId,
        created_at: new Date().toISOString(),
      };

      const existing = reactions[messageId] || [];
      const userExisting = existing.find(
        (r) => r.emoji === emoji && r.user_id === currentUserId
      );

      if (userExisting) {
        setReactions((prev) => {
          const updated = (prev[messageId] || []).filter((r) => r.id !== userExisting.id);
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
        await toggleReaction("group", messageId, emoji);
      } catch {
        fetchMessages();
      }
    },
    [currentUserId, reactions, fetchMessages]
  );

  const getInitials = (name: string | null) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";

  const getGroupedReactions = (messageId: string) => {
    const msgReactions = reactions[messageId] || [];
    const grouped: Record<string, { emoji: string; count: number; userReacted: boolean }> = {};
    msgReactions.forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, userReacted: false };
      grouped[r.emoji].count++;
      if (r.user_id === currentUserId) grouped[r.emoji].userReacted = true;
    });
    return Object.values(grouped);
  };

  const isAnyPickerOpen = emojiPickerMsgId !== null || showInputEmoji;
  const showMentionMenu = mentionSearch !== null && filteredMembers.length > 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Dismiss overlay for emoji pickers */}
      {isAnyPickerOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setEmojiPickerMsgId(null);
            setShowInputEmoji(false);
          }}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hello to the group!
          </p>
        )}
        {messages.map((msg) => {
          if (msg.is_system_message) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 max-w-[85%] text-center">
                  <p className="text-xs text-amber-800 dark:text-amber-200 whitespace-pre-line">
                    {msg.content}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          }

          const isOwn = msg.user_id === currentUserId;
          const name = msg.profiles?.full_name ?? "Unknown";
          const isEditing = editingId === msg.id;
          const grouped = getGroupedReactions(msg.id);

          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {!isOwn && (
                <Avatar className="h-7 w-7 shrink-0 mt-1">
                  <AvatarImage src={msg.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[75%] relative ${isOwn ? "items-end" : "items-start"}`}>
                {!isOwn && (
                  <p className="text-xs text-muted-foreground mb-0.5">{name}</p>
                )}

                {/* Action buttons */}
                {hoveredId === msg.id && !isEditing && !msg.is_deleted && !msg.id.startsWith("temp-") && (
                  <div
                    className={`absolute -top-8 ${isOwn ? "right-0" : "left-0"} flex items-center gap-0.5 bg-background border rounded-md shadow-sm p-0.5 z-10`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)
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

                {/* Emoji picker */}
                {emojiPickerMsgId === msg.id && (
                  <div
                    className={`absolute bottom-full mb-1 z-50 ${isOwn ? "right-0" : "left-0"}`}
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
                      isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {renderContent(msg.content, currentUserName)}
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

                {/* Timestamp */}
                {!isEditing && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
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

      {/* Input */}
      <div className="p-4 border-t bg-background relative">
        {/* @mention dropdown */}
        {showMentionMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-1 z-50 bg-background border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filteredMembers.map((member) => (
              <button
                key={member.user_id}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur before click
                  handleMentionSelect(member);
                }}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={member.profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.profiles?.full_name ?? null)}
                  </AvatarFallback>
                </Avatar>
                <span>{member.profiles?.full_name ?? "Unknown"}</span>
              </button>
            ))}
          </div>
        )}

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
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMentionSearch(null);
            }}
            placeholder="Message the group... (type @ to mention)"
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
