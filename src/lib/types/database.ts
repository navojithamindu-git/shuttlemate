export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Open";
export type GameType = "Singles" | "Doubles" | "Either";
export type SessionStatus = "open" | "full" | "cancelled" | "completed";
export type Gender = "Male" | "Female" | "Prefer not to say";

export interface Profile {
  id: string;
  full_name: string | null;
  skill_level: SkillLevel | null;
  gender: Gender | null;
  phone: string | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_system_message: boolean;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  user_id: string;
  emoji: string;
  direct_message_id: string | null;
  session_message_id: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  skill_level: SkillLevel;
  game_type: GameType;
  max_players: number;
  status: SessionStatus;
  last_edited_at: string | null;
  group_id: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  confirmed: boolean;
  confirmation_deadline: string | null;
  joined_at: string;
}

export interface SessionFormData {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  skill_level: SkillLevel;
  game_type: GameType;
  max_players: number;
}

export interface SessionWithCreator extends Session {
  creator: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
}

export interface SessionWithParticipants extends SessionWithCreator {
  session_participants: (SessionParticipant & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
}

export interface AvailabilitySpecific {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  city: string;
  created_at: string;
}

export interface AvailabilityRecurring {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  city: string;
  created_at: string;
}

// ---- Recurring Groups ----

export type GroupMemberRole = "owner" | "admin" | "member";
export type RsvpStatus = "yes" | "maybe" | "no";

export interface RecurringGroup {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  city: string;
  skill_level: SkillLevel;
  game_type: GameType;
  max_players: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_system_message: boolean;
  created_at: string;
}

export interface GroupSessionRsvp {
  id: string;
  session_id: string;
  user_id: string;
  status: RsvpStatus;
  updated_at: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface RecurringGroupWithDetails extends RecurringGroup {
  group_members: (GroupMember & {
    profiles: Pick<Profile, "id" | "full_name" | "avatar_url" | "skill_level">;
  })[];
}
