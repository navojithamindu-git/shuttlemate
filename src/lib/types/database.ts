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
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string;
  city: string;
  skill_level: SkillLevel;
  game_type: GameType;
  max_players: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
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
