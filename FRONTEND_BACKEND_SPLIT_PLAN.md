# Frontend/Backend Base Split Plan

## Purpose

This document defines how to separate the current Next.js codebase into a scalable frontend/backend base without prematurely breaking it into microservices.

The goal is to :

- keep one deployable application for now
- separate UI concerns from backend business logic
- prepare the system for future extraction into services
- support future products: `Shuttlemates`, `Marketplace`, `Indoor Court Booking`, and mobile apps

## Current Problem

Right now the project is technically full-stack, but the boundaries are not explicit enough for long-term scaling:

- `src/app` contains pages and route handlers
- `src/components` contains UI
- `src/lib/actions` contains business logic
- `src/lib/supabase` contains data access
- database logic, application rules, and HTTP concerns are still close together

This works at the current stage, but it becomes difficult to scale when:

- multiple apps need the same backend capabilities
- mobile clients need stable APIs
- separate teams start working on different business areas
- some domains need to be extracted into independent services

## Recommended Approach

Use a **modular monolith** now, not separate hosted frontend/backend services yet.

That means:

- one codebase
- one main deployment
- clear internal separation between frontend and backend code
- each business domain organized as an isolated module

This gives most of the design benefits of microservices without paying the operational cost too early.

## Why Not Split Into Microservices Immediately

Microservices are useful later, but they introduce significant cost now:

- more deployments to manage
- network failures between services
- harder debugging
- distributed transactions and eventual consistency issues
- more DevOps overhead
- slower feature development during product discovery

At the current stage, the better move is to build strict module boundaries inside one system. If the boundaries are clean, those modules can later be extracted into separate services with much lower risk.

## What "Frontend/Backend Split" Means In This Project

It does **not** mean creating two completely separate repos immediately.

It means introducing a clean separation of responsibility:

### Frontend responsibilities

- rendering pages
- UI components
- client-side state
- form handling
- calling backend APIs or server entry points

### Backend responsibilities

- business rules
- use-cases
- authorization checks
- database access
- external integrations
- domain events

The frontend should not contain business logic or direct database behavior.

## Target Structure

```txt
src/
  app/
    (routes, pages, route handlers only)
  components/
    (pure UI and feature presentation)
  modules/
    auth/
      index.ts
      domain/
      application/
      infrastructure/
    users/
      index.ts
      domain/
      application/
      infrastructure/
    sessions/
      index.ts
      domain/
      application/
      infrastructure/
    groups/
      index.ts
      domain/
      application/
      infrastructure/
    messages/
      index.ts
      domain/
      application/
      infrastructure/
  shared/
    errors/
    auth/
    events/
    logger/
    types/
    utils/
```

## Module Structure Explained

Each module should own one business area.

Example:

- `auth` handles login/session/auth-related policies
- `users` handles profile and preferences
- `sessions` handles session creation/join/cancel flows
- `groups` handles group creation/membership/matchups
- `messages` handles conversations and chat actions

Inside each module:

### `domain/`

Contains business concepts and rules.

Examples:

- entities such as `Session`, `Group`, `UserProfile`
- validation rules such as "session must be in the future"
- interfaces such as `SessionRepository`

This layer should not know about Next.js, Supabase, or HTTP.

### `application/`

Contains use-cases that coordinate work.

Examples:

- `CreateSessionUseCase`
- `JoinGroupUseCase`
- `SendMessageUseCase`

This layer:

- receives input
- checks rules
- calls repositories
- triggers events if needed
- returns result DTOs

### `infrastructure/`

Contains implementation details.

Examples:

- Supabase repository implementations
- database mappers
- email or notification provider adapters

This is the only layer that should directly talk to Supabase/Postgres or external services.

## Simple Real Example

User creates a new badminton session.

### Frontend flow

1. User fills the form in a React component.
2. The page submits to an API route or server entry point.

### Backend flow

1. Route handler receives the request.
2. Route handler calls `CreateSessionUseCase` from `src/modules/sessions`.
3. The use-case validates business rules.
4. The use-case calls `SessionRepository`.
5. `SupabaseSessionRepository` writes to the database.
6. The result is returned to the frontend.

### Important boundary rule

The page or component should never directly perform session business logic or raw database writes.

## Example File Flow

```txt
src/app/api/sessions/route.ts
  -> src/modules/sessions/index.ts
  -> src/modules/sessions/application/create-session.ts
  -> src/modules/sessions/domain/session-repository.ts
  -> src/modules/sessions/infrastructure/supabase-session-repository.ts
```

## Public Module API Rule

Each module should expose a public API through `index.ts`.

Allowed:

```ts
import { createSession } from "@/modules/sessions";
```

Not allowed:

```ts
import { SupabaseSessionRepository } from "@/modules/sessions/infrastructure/supabase-session-repository";
```

This prevents accidental coupling between modules.

## Why This Is Better For Future Scale

This structure supports future growth in a controlled way.

### For multiple applications

When `Marketplace` and `Indoor Court Booking` are added:

- shared backend domains can stay in the monolith initially
- new modules can be added without mixing concerns
- common capabilities like auth, users, notifications, and payments can be reused

### For mobile apps

Mobile should consume stable backend APIs, not page-specific logic.

This structure helps by:

- moving business logic into reusable backend modules
- keeping HTTP entry points thin and explicit
- making it easier to expose versioned APIs for web and mobile

### For future microservices

If one domain grows independently, it can later be extracted.

Likely candidates in the future:

- `auth`
- `notifications`
- `payments`
- `court-booking`
- `marketplace-orders`

Because the domain logic and infrastructure are already isolated, the extraction becomes a relocation exercise rather than a full rewrite.

## Authentication Direction

Use one common identity/authentication system across all products.

Recommended model:

- one shared auth system
- one core user identity
- app-specific profile or domain tables where needed
- shared SSO across web and mobile applications

Why:

- better user experience
- easier account management
- simpler mobile support
- lower duplication
- easier long-term security governance

Do not create separate user databases for each app unless there is a hard organizational or regulatory reason.

## Migration Plan

### Phase 1: Define the boundaries

1. Create `src/modules/`
2. Create modules for `auth`, `users`, `sessions`, `groups`, `messages`
3. Add `domain`, `application`, and `infrastructure` folders inside each
4. Add one `index.ts` public entry point per module

### Phase 2: Move backend logic out of UI-oriented areas

1. Review `src/lib/actions/*`
2. Move business logic into `application/`
3. Move direct Supabase queries into `infrastructure/`
4. Keep `src/app/api/*` thin

### Phase 3: Introduce shared backend standards

1. Create `src/shared/errors`
2. Create `src/shared/logger`
3. Create `src/shared/events`
4. Create consistent DTO and error patterns

### Phase 4: Enforce boundaries

1. Add ESLint import boundary rules
2. Block cross-module internal imports
3. Document allowed dependencies in an architecture guide

### Phase 5: Prepare for external clients

1. Standardize API responses
2. Add API versioning where needed
3. Design endpoints with mobile consumption in mind

### Phase 6: Extract only when justified

Extract a module into a microservice only when one of these becomes true:

- it needs independent scaling
- it needs independent deployment cadence
- it has a separate ownership team
- it becomes an operational bottleneck

## Suggested First Refactor Targets In This Repo

Best first candidates based on the current project shape:

1. `src/lib/actions/sessions.ts` -> `src/modules/sessions/application/`
2. `src/lib/actions/groups.ts` -> `src/modules/groups/application/`
3. `src/lib/actions/messages.ts` -> `src/modules/messages/application/`
4. Supabase calls used by those flows -> corresponding `infrastructure/` folders
5. Route handlers in `src/app/api/*` -> thin adapters only

## Practical Rules For The Team

1. UI code does not contain business decisions.
2. Pages and components do not directly access the database.
3. Every business capability belongs to one module owner.
4. Modules expose public entry points and hide internal implementation.
5. Shared code must stay generic and not become a hidden dumping ground.
6. New features should be added to modules, not directly to `src/lib/actions`.

## Final Recommendation

Do not split this project into independently hosted frontend and backend systems yet.

Instead:

1. keep one Next.js deployment for now
2. separate frontend and backend concerns inside the repo
3. reorganize the backend into strict domain modules
4. expose stable APIs for future mobile and additional products
5. extract services later only where scale or ownership demands it

This gives the project a scalable base without taking on premature microservice complexity.
