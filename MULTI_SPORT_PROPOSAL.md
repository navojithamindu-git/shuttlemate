# Multi-Sport Platform Proposal

## Current State: ShuttleMates (Badminton Only)

ShuttleMates is currently a badminton-specific session matching app. Players create sessions, others join, and they coordinate via built-in chat. The core features (sessions, messaging, availability, confirmations) are already sport-generic in the database — but the UI, branding, and copy are entirely badminton-focused.

---

## The Proposal: Go Multi-Sport

Expand the platform to support multiple sports: **Badminton, Tennis, Paddle, Table Tennis, Indoor Cricket** — with room to add more later.

### Why?

- Broader user base from day one — more people testing, more feedback
- A badminton player who also plays tennis brings friends from both communities
- No painful rebrand later — do it once, do it right
- The core platform (sessions, chat, matching) already works for any sport

---

## Launch Strategy

**Build multi-sport, but test with badminton first.**

- The app supports all sports from the start
- Marketing and initial user recruitment focuses on badminton players (our strongest community)
- As the core experience is validated, expand marketing to other sports
- This avoids tech debt while keeping testing focused

---

## What Changes

### 1. App Name

"ShuttleMates" is badminton-locked. A new name is needed before launch.

| Direction | Examples | Best For |
|-----------|----------|----------|
| Play/Match focused | PlayMate, MatchUp, GameOn | All sports |
| Court focused | CourtMate, RallyUp | Racket sports |
| Squad focused | SquadUp, CrewPlay | Team sports included |
| Clean/Modern | Rallly, Playo | Broad appeal |

**Decision needed:** How broad do we want to go? Racket sports only or all sports?

---

### 2. Landing Page

**Before (badminton-specific):**
- "Find your perfect badminton match"
- Badminton facts (calories burned, shuttlecock speed)
- Badminton-specific benefit cards

**After (sport-neutral platform selling):**

```
HERO
"Find players. Create sessions. Just play."
[Get Started]  [Browse Sessions]

SPORT SELECTOR (visual, interactive)
  🏸          🎾         🏓        🏏
Badminton   Tennis    Table Tennis  Cricket
  (42)       (18)       (12)       (8)
         ↑ live session counts per sport

HOW IT WORKS (already generic)
1. Pick your sport & create a session
2. Players near you join
3. Show up and play

SOCIAL PROOF
"120+ players  |  80 sessions  |  5 cities"
```

The landing page sells the **platform**, not a specific sport.

---

### 3. Sport-Specific Theming

When a user selects a sport, the UI adapts to feel like "their" app:

**Color accents per sport:**
- Badminton → Green
- Tennis → Yellow/Lime
- Paddle → Blue
- Cricket → Orange
- Table Tennis → Red

**Terminology adapts per sport:**

| | Badminton | Tennis | Cricket |
|---|-----------|--------|---------|
| Location label | "Court" | "Court" | "Ground" |
| Session noun | "Session" | "Match" | "Game" |
| Game type | Singles/Doubles/Either | Singles/Doubles/Either | Hidden |
| Skill levels | Beginner/Intermediate/Advanced/Open | Beginner/Intermediate/Advanced/Open | None (casual) |

**Example: Creating a badminton session**
```
🏸 Create a Badminton Session          [green accent]

Title:  [Saturday Morning Smash]
Court:  [City Sports Complex]          ← "Court"
Level:  [Intermediate]                 ← skill dropdown shown
Type:   [Doubles]                      ← game type shown
```

**Example: Creating a cricket game**
```
🏏 Create a Cricket Game               [orange accent]

Title:  [Sunday Soft Ball]
Ground: [Maitland Place]               ← "Ground" not "Court"
Players:[10]
                                       ← no skill level, no game type
```

Same form component, different look and fields based on sport.

---

### 4. Profile Changes

**Before:** One global skill level for the user.

**Problem:** Someone can be an advanced badminton player and a beginner at table tennis. Cricket doesn't even have meaningful skill levels — people just show up.

**After:** Skill level is per-sport, and optional for casual sports.

```
Your Sports:

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 🏸 Badminton  │  │ 🏏 Cricket    │  │ 🏓 Table T.   │
│ [Advanced]    │  │ [Casual]      │  │ [Beginner]    │
│               │  │  no levels    │  │               │
└──────────────┘  └──────────────┘  └──────────────┘
                     + Add Sport
```

- Racket sports: Beginner / Intermediate / Advanced / Open
- Casual team sports (cricket): No levels, or just Casual / Competitive

---

### 5. Session Browsing

**Sport tabs at the top of the browse page:**

```
[All] [🏸 Badminton] [🎾 Tennis] [🏓 Table Tennis] [🏏 Cricket]
───────────────────────────────────────────────────────────────
[City ▼]  [Skill Level ▼]  [Game Type ▼]
```

- Clicking a sport tab filters sessions and changes the page accent color
- Filters adapt: skill level and game type hide for sports that don't use them
- Session cards show a sport icon and sport-colored badge

---

### 6. Session Cards

```
┌─────────────────────────────────────────────┐
│ 🏸 Badminton  Intermediate  Doubles  Tomorrow │  ← green badge
│ Saturday Morning Smash                        │
│ 📅 Wed, Jan 15  ⏰ 09:00-11:00              │
│ 📍 City Sports Complex, Colombo              │
│ 👥 3/4 players                               │
└─────────────────────────────────────────────┘
```

---

## What Stays the Same

These features are already sport-agnostic and need **zero changes**:

- Chat / messaging system (group + direct)
- Session confirmation & deadline logic
- Availability system
- Player count management
- City-based discovery
- Notification system

---

## Technical Implementation

### Current Database Structure (Badminton Only)

```
ENUMS
─────
skill_level:    'Beginner' | 'Intermediate' | 'Advanced' | 'Open'
game_type:      'Singles' | 'Doubles' | 'Either'
session_status: 'open' | 'full' | 'cancelled' | 'completed'
gender_type:    'Male' | 'Female' | 'Prefer not to say'


TABLE: profiles
───────────────────────────────────────────────────────
id                 UUID (PK, FK → auth.users)
full_name          TEXT
skill_level        skill_level          ← one global level
gender             gender_type
phone              TEXT
city               TEXT                 ← single city
bio                TEXT
avatar_url         TEXT
profile_complete   BOOLEAN
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ


TABLE: sessions
───────────────────────────────────────────────────────
id                 UUID (PK)
creator_id         UUID (FK → profiles)
title              TEXT
description        TEXT
date               DATE
start_time         TIME
end_time           TIME
location           TEXT
city               TEXT
skill_level        skill_level          ← required for all sessions
game_type          game_type            ← required for all sessions
max_players        INTEGER (2-20)
status             session_status
last_edited_at     TIMESTAMPTZ
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ


TABLE: session_participants
───────────────────────────────────────────────────────
id                      UUID (PK)
session_id              UUID (FK → sessions)
user_id                 UUID (FK → profiles)
confirmed               BOOLEAN
confirmation_deadline   TIMESTAMPTZ
joined_at               TIMESTAMPTZ
UNIQUE(session_id, user_id)


TABLE: session_messages
───────────────────────────────────────────────────────
id                 UUID (PK)
session_id         UUID (FK → sessions)
user_id            UUID (FK → profiles)
content            TEXT
is_edited          BOOLEAN
is_deleted         BOOLEAN
is_system_message  BOOLEAN
created_at         TIMESTAMPTZ


TABLE: direct_messages
───────────────────────────────────────────────────────
id                 UUID (PK)
sender_id          UUID (FK → profiles)
receiver_id        UUID (FK → profiles)
content            TEXT
read               BOOLEAN
is_edited          BOOLEAN
is_deleted         BOOLEAN
created_at         TIMESTAMPTZ


TABLE: message_reactions
───────────────────────────────────────────────────────
id                   UUID (PK)
user_id              UUID (FK → profiles)
emoji                TEXT
direct_message_id    UUID (FK → direct_messages, nullable)
session_message_id   UUID (FK → session_messages, nullable)
created_at           TIMESTAMPTZ
UNIQUE(user_id, emoji, direct_message_id)
UNIQUE(user_id, emoji, session_message_id)
CHECK: exactly one message type is set


TABLE: availability_specific
───────────────────────────────────────────────────────
id                 UUID (PK)
user_id            UUID (FK → profiles)
date               DATE
start_time         TIME
end_time           TIME
city               TEXT
created_at         TIMESTAMPTZ


TABLE: availability_recurring
───────────────────────────────────────────────────────
id                 UUID (PK)
user_id            UUID (FK → profiles)
day_of_week        INTEGER (0-6)
start_time         TIME
end_time           TIME
city               TEXT
created_at         TIMESTAMPTZ
```

### Problems With Current Structure for Multi-Sport

1. `profiles.skill_level` is one global value — can't be Advanced in badminton and Beginner in tennis
2. `sessions.skill_level` is required (NOT NULL) — cricket doesn't need skill levels
3. `sessions.game_type` is required (NOT NULL) — cricket doesn't have singles/doubles
4. No `sport` column anywhere — no way to know what sport a session is for
5. Availability has no sport context — someone might be available for badminton but not cricket on the same day

---

### New Database Structure (Multi-Sport)

Changes marked with ✅ NEW, ✏️ CHANGED, ❌ REMOVED. Unmarked = no change.

```
ENUMS
─────
sport_type:     'badminton' | 'tennis' | 'table_tennis'      ✅ NEW
                | 'paddle' | 'cricket'
skill_level:    'Beginner' | 'Intermediate' | 'Advanced' | 'Open'
game_type:      'Singles' | 'Doubles' | 'Either'
session_status: 'open' | 'full' | 'cancelled' | 'completed'
gender_type:    'Male' | 'Female' | 'Prefer not to say'


TABLE: profiles
───────────────────────────────────────────────────────
id                 UUID (PK, FK → auth.users)
full_name          TEXT
skill_level        -----                ❌ REMOVED (moved to user_sports)
gender             gender_type
phone              TEXT
city               TEXT
bio                TEXT
avatar_url         TEXT
profile_complete   BOOLEAN
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ


TABLE: user_sports                      ✅ NEW TABLE
───────────────────────────────────────────────────────
id                 UUID (PK)
user_id            UUID (FK → profiles)
sport              sport_type
skill_level        skill_level          ← nullable (cricket won't have one)
is_primary         BOOLEAN DEFAULT FALSE
created_at         TIMESTAMPTZ
UNIQUE(user_id, sport)

Example rows:
  user_123 | badminton    | Advanced     | true
  user_123 | cricket      | NULL         | false
  user_123 | table_tennis | Beginner     | false


TABLE: sessions
───────────────────────────────────────────────────────
id                 UUID (PK)
creator_id         UUID (FK → profiles)
sport              sport_type           ✅ NEW (required)
title              TEXT
description        TEXT
date               DATE
start_time         TIME
end_time           TIME
location           TEXT
city               TEXT
skill_level        skill_level          ✏️ CHANGED: now nullable (NULL for cricket)
game_type          game_type            ✏️ CHANGED: now nullable (NULL for cricket)
max_players        INTEGER (2-20)
status             session_status
last_edited_at     TIMESTAMPTZ
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ


TABLE: session_participants             — no changes
───────────────────────────────────────────────────────
(same as current)


TABLE: session_messages                 — no changes
───────────────────────────────────────────────────────
(same as current)


TABLE: direct_messages                  — no changes
───────────────────────────────────────────────────────
(same as current)


TABLE: message_reactions                — no changes
───────────────────────────────────────────────────────
(same as current)


TABLE: availability_specific            — no changes for now
───────────────────────────────────────────────────────
(same as current — availability is about time/place, not sport)


TABLE: availability_recurring           — no changes for now
───────────────────────────────────────────────────────
(same as current)
```

### New Indexes

```
CREATE INDEX idx_sessions_sport ON sessions(sport);
CREATE INDEX idx_sessions_sport_city ON sessions(sport, city);
CREATE INDEX idx_user_sports_user ON user_sports(user_id);
CREATE INDEX idx_user_sports_sport ON user_sports(sport);
```

### Migration SQL (006_multi_sport.sql)

```sql
-- 1. Create sport type enum
CREATE TYPE sport_type AS ENUM (
  'badminton', 'tennis', 'table_tennis', 'paddle', 'cricket'
);

-- 2. Create user_sports table (replaces profiles.skill_level)
CREATE TABLE public.user_sports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sport sport_type NOT NULL,
  skill_level skill_level,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sport)
);

-- 3. Add sport column to sessions
ALTER TABLE public.sessions
  ADD COLUMN sport sport_type NOT NULL DEFAULT 'badminton';

-- 4. Make skill_level and game_type nullable (cricket doesn't need them)
ALTER TABLE public.sessions
  ALTER COLUMN skill_level DROP NOT NULL,
  ALTER COLUMN skill_level DROP DEFAULT;

ALTER TABLE public.sessions
  ALTER COLUMN game_type DROP NOT NULL,
  ALTER COLUMN game_type DROP DEFAULT;

-- 5. Migrate existing profile skill levels to user_sports
INSERT INTO public.user_sports (user_id, sport, skill_level, is_primary)
SELECT id, 'badminton', skill_level, TRUE
FROM public.profiles
WHERE skill_level IS NOT NULL;

-- 6. Remove skill_level from profiles (now in user_sports)
ALTER TABLE public.profiles DROP COLUMN skill_level;

-- 7. Remove the default on sessions.sport after migration
ALTER TABLE public.sessions ALTER COLUMN sport DROP DEFAULT;

-- 8. Indexes
CREATE INDEX idx_sessions_sport ON public.sessions(sport);
CREATE INDEX idx_sessions_sport_city ON public.sessions(sport, city);
CREATE INDEX idx_user_sports_user ON public.user_sports(user_id);
CREATE INDEX idx_user_sports_sport ON public.user_sports(sport);

-- 9. RLS for user_sports
ALTER TABLE public.user_sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sports viewable by everyone"
  ON public.user_sports FOR SELECT USING (true);

CREATE POLICY "Users can manage own sports"
  ON public.user_sports FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own sports"
  ON public.user_sports FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own sports"
  ON public.user_sports FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

---

### What Changes vs What Stays (Database Summary)

| Table | Change | Why |
|-------|--------|-----|
| profiles | Remove skill_level column | Moved to user_sports (per-sport) |
| user_sports | **NEW TABLE** | Per-sport skill levels per user |
| sessions | Add sport column, make skill_level & game_type nullable | Support all sports, cricket has no levels |
| session_participants | No change | Already generic |
| session_messages | No change | Already generic |
| direct_messages | No change | Already generic |
| message_reactions | No change | Already generic |
| availability_specific | No change | Time/place based, not sport-specific |
| availability_recurring | No change | Time/place based, not sport-specific |

**6 out of 8 tables stay exactly the same.** Only profiles loses a column, sessions gains one, and one new table is added.

---

### Sport Config (Drives the entire UI)

One configuration object that every component reads from:

```ts
const SPORT_CONFIG = {
  badminton: {
    icon: "🏸",
    accent: "green",
    locationLabel: "Court",
    sessionNoun: "Session",
    levels: ["Beginner", "Intermediate", "Advanced", "Open"],
    gameTypes: ["Singles", "Doubles", "Either"],
  },
  tennis: {
    icon: "🎾",
    accent: "yellow",
    locationLabel: "Court",
    sessionNoun: "Match",
    levels: ["Beginner", "Intermediate", "Advanced", "Open"],
    gameTypes: ["Singles", "Doubles", "Either"],
  },
  table_tennis: {
    icon: "🏓",
    accent: "red",
    locationLabel: "Table",
    sessionNoun: "Session",
    levels: ["Beginner", "Intermediate", "Advanced", "Open"],
    gameTypes: ["Singles", "Doubles", "Either"],
  },
  paddle: {
    icon: "🎾",
    accent: "blue",
    locationLabel: "Court",
    sessionNoun: "Match",
    levels: ["Beginner", "Intermediate", "Advanced", "Open"],
    gameTypes: ["Singles", "Doubles"],
  },
  cricket: {
    icon: "🏏",
    accent: "orange",
    locationLabel: "Ground",
    sessionNoun: "Game",
    levels: null,
    gameTypes: null,
  },
}
```

Components are written **once** and adapt based on this config. No sport-specific code duplication.

---

## Effort Estimate

| Area | Change | Size |
|------|--------|------|
| Database schema | Add sport columns + user_sports table | Small |
| Sport config | Create config object | Small |
| Profile form | Add multi-sport selector with per-sport levels | Medium |
| Session form | Add sport selector, adapt fields per sport | Medium |
| Session filters | Add sport tabs, adapt filters per sport | Medium |
| Session cards | Add sport badge and accent color | Small |
| Landing page | Rewrite copy, add sport selector | Medium |
| Branding | New name, logo, colors | Decision + Design |

---

## Key Decisions Needed

1. **App name** — What do we rename to?
2. **Sport scope** — Start with racket sports only, or include cricket/football from day one?
3. **Skill levels** — Global per user, or per sport? (Recommendation: per sport)
4. **Launch market** — Which city/community do we test with first?

---

## Summary

The platform's core is already sport-generic. The change is mostly in the **presentation layer** — how the UI looks, what labels say, which fields appear. By using a sport config to drive the UI, we get a platform where every sport feels like a dedicated app, but it's all one codebase. Build it once, launch with badminton, expand to everything.
