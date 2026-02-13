import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { JoinLeaveButton } from "@/components/sessions/join-leave-button";
import { ParticipantList } from "@/components/sessions/participant-list";
import { CancelSessionButton } from "@/components/sessions/cancel-session-button";
import { EditSessionButton } from "@/components/sessions/edit-session-button";
import { ConfirmationBanner } from "@/components/sessions/confirmation-banner";
import { SessionChat } from "@/components/sessions/session-chat";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `
      *,
      creator:profiles!creator_id(id, full_name, avatar_url, skill_level),
      session_participants(
        user_id,
        joined_at,
        confirmed,
        confirmation_deadline,
        profiles(id, full_name, avatar_url, skill_level)
      )
    `
    )
    .eq("id", id)
    .single();

  if (!session) notFound();

  const participantCount = session.session_participants?.length ?? 0;
  const isCreator = user?.id === session.creator_id;
  const currentParticipant = session.session_participants?.find(
    (p: { user_id: string }) => p.user_id === user?.id
  );
  const isJoined = !!currentParticipant;
  const isFull = participantCount >= session.max_players;

  // Check if current user needs to confirm
  const needsConfirmation =
    currentParticipant &&
    !isCreator &&
    currentParticipant.confirmed === false &&
    currentParticipant.confirmation_deadline;

  // Check if any participant is unconfirmed (for creator view)
  const hasAnyUnconfirmed = session.session_participants?.some(
    (p: { user_id: string; confirmed: boolean }) =>
      p.user_id !== session.creator_id && p.confirmed === false
  );

  // DEBUG - remove after testing
  const debugInfo = {
    isCreator,
    hasAnyUnconfirmed,
    needsConfirmation: !!needsConfirmation,
    participants: session.session_participants?.map((p: { user_id: string; confirmed: boolean; confirmation_deadline: string | null }) => ({
      user_id: p.user_id.slice(0, 8),
      confirmed: p.confirmed,
      deadline: p.confirmation_deadline,
    })),
  };

  const creatorName = session.creator?.full_name ?? "Unknown";
  const creatorInitials = creatorName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  // Timing badge
  const sessionDateTime = new Date(session.date + "T" + session.time);
  const now = new Date();
  const daysUntil = differenceInCalendarDays(sessionDateTime, now);
  const timingBadge = sessionDateTime < now
    ? { label: "Expired", variant: "destructive" as const }
    : daysUntil === 0
      ? { label: "Today", variant: "default" as const }
      : daysUntil === 1
        ? { label: "Tomorrow", variant: "default" as const }
        : daysUntil <= 7
          ? { label: `In ${daysUntil} days`, variant: "secondary" as const }
          : null;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* DEBUG - remove after testing */}
      <pre className="text-xs bg-yellow-100 text-black p-2 rounded mb-4 overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Badge variant="secondary">{session.skill_level}</Badge>
            <Badge variant="outline">{session.game_type}</Badge>
            {timingBadge && (
              <Badge variant={timingBadge.variant}>{timingBadge.label}</Badge>
            )}
            {session.status === "full" && (
              <Badge variant="destructive">Full</Badge>
            )}
            {session.status === "completed" && (
              <Badge variant="secondary">Completed</Badge>
            )}
            {session.status === "cancelled" && (
              <Badge variant="destructive">Cancelled</Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold">{session.title}</h1>
          {session.description && (
            <p className="text-muted-foreground mt-2">{session.description}</p>
          )}
        </div>

        {/* Confirmation Banner */}
        {needsConfirmation && session.status !== "cancelled" && session.status !== "completed" && (
          <ConfirmationBanner
            sessionId={session.id}
            confirmationDeadline={currentParticipant.confirmation_deadline}
          />
        )}

        {/* Details Card */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(session.date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{session.time.slice(0, 5)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {session.location}, {session.city}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Players</p>
                  <p className="font-medium">
                    {participantCount} / {session.max_players}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Created by */}
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.creator?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {creatorInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Created by</p>
                <p className="text-sm font-medium">{creatorName}</p>
              </div>
            </div>

            <Separator />

            {/* Action buttons */}
            {session.status !== "cancelled" && session.status !== "completed" && (
              <div className="flex gap-3">
                <JoinLeaveButton
                  sessionId={session.id}
                  isJoined={isJoined ?? false}
                  isCreator={isCreator}
                  isFull={isFull}
                />
                {isCreator && (
                  <>
                    <EditSessionButton sessionId={session.id} />
                    <CancelSessionButton sessionId={session.id} />
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Players ({participantCount}/{session.max_players})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session.session_participants &&
            session.session_participants.length > 0 ? (
              <ParticipantList
                participants={session.session_participants}
                creatorId={session.creator_id}
                currentUserId={user?.id}
                showConfirmationStatus={isCreator && hasAnyUnconfirmed}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No players yet. Be the first to join!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Session Chat - only for upcoming sessions */}
        {(isJoined || isCreator) && user && session.status !== "cancelled" && session.status !== "completed" && (
          <SessionChat sessionId={session.id} currentUserId={user.id} />
        )}
      </div>
    </div>
  );
}
