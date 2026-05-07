# Architecture

Durable system shape for TimeBlock Commander. Operational and implementation churn live elsewhere — `Development/` and `User_Guide/`.

This file is also the **project-level scope** home. Anything inside the Boundary section is in scope for the project; anything explicitly excluded is out of scope. Per-task and per-session scope is narrower and lives in `../Purpose/scope.md` and inside task packets.

## Current Stack

- Next.js 14 (App Router) — frontend and API routes
- React 18 + Tailwind CSS — UI
- PostgreSQL 16 + Prisma — task and block storage
- NextAuth — authentication, with the Prisma adapter
- Google Calendar via `googleapis` — external calendar integration
- Zod — input validation
- date-fns — date math
- Docker Compose — single-host deployment (Hetzner / VPS)

## Boundary

TimeBlock Commander **is**:

- a single-operator, AI-assisted time-blocking command center
- a scheduling engine that turns prioritized tasks into hour-aligned blocks
- a multi-company allocation tracker (Aperture Ads, Rentals, DIYP, Personal)
- a deep-work protector for the 8am–12pm prime-hour window
- an overload and imbalance detector
- a mobile-friendly capture surface for the same operator's task queue
- a Google Calendar consumer for the operator's own calendar
- a self-hosted web app, deployed via Docker Compose on a single VPS

TimeBlock Commander **is not**:

- a team or multi-tenant product (single operator only)
- a project management tool (no Gantt, no dependencies graph, no assignees other than the operator)
- a meeting scheduler or external invite system
- a CRM, a billing tool, or a time-tracking-for-clients tool
- a multi-region, horizontally scaled service
- a mobile native app (mobile capture works inside the same Next.js app)
- a generic LLM agent runtime (the `Purpose/` layer is for orienting an LLM into this codebase, not for running production agents)

Anything outside this boundary needs explicit operator approval before it enters scope. Adjacent ideas — team mode, external sharing, native mobile — should be split into a separate project rather than absorbed.

## Main Layers

- `src/app/` — Next.js App Router. Pages and API routes.
- `src/components/`, `src/hooks/` — UI surface.
- `src/lib/` — domain logic. The load-bearing modules:
  - `scheduler.ts` — turns scored tasks into hour-aligned blocks
  - `scoring.ts` — priority, urgency, strategic value, deadline proximity
  - `blocks.ts` — block lifecycle and filtering, including the live/stale gap rule
  - `google-calendar.ts` — Calendar read/write
  - `auth.ts` — NextAuth configuration, including OAuth token persistence on re-sign-in
  - `db.ts` — Prisma client
  - `local-date.ts`, `timezone.ts` — operator-local time math
  - `schemas.ts` — Zod input shapes
- `prisma/` — schema and seed.
- `structure/` — human and LLM orientation layer (this folder).

## Design Rule

Preserve operator-local time correctness end-to-end. Any feature that touches scheduling, blocks, or calendar must respect operator local time and the prime-hour boundary. If a change forces UTC creep into UI or scheduling logic, it has crossed the architectural rule and needs a deliberate decision rather than an inline fix.
