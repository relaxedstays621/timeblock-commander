# Scope

Standalone scope contract for a **session or task**. Not the project.

Project-level scope lives in `../System Guide/architecture.md` under the `Boundary` section. That file says what TimeBlock Commander is and is not. This file is one level narrower: it constrains a single session or task inside that project boundary.

The task packet in `delegation-contract.md` carries an inline `Scope:` field for one-line use. This file is the longer form: write it once, and let multiple tasks inside a session inherit it.

## When to write a scope

Write a standalone scope when:

- the work spans more than one task
- multiple agents will touch the work and need a shared boundary
- the user wants to lock the boundary before any agent starts
- a session is long enough that scope drift is a real risk

For a single self-contained task, the inline `Scope:` field in the task packet is enough.

## Authority

A scope written here is the contract for the active session or task. It must sit inside the project boundary defined in `../System Guide/architecture.md`. Tasks within the session reference it. Agents do not widen it without explicit reassignment from the operator.

If a task needs work outside the session/task scope, the agent should:

1. Stop.
2. Name the boundary crossing — and whether it is a session-scope crossing or a project-boundary crossing.
3. Ask the operator to widen the scope (or, for a project-boundary crossing, decide whether the work belongs in this project at all), or split the work into a separate task with its own scope.

## Template

```text
Goal:
<One sentence on the outcome being pursued.>

In scope:
- <files, folders, modules, or behaviors the work may touch>

Out of scope:
- <files, folders, behaviors, or systems that must not be touched>

Constraints:
- <coding standard, runtime constraint, dependency rule, or external contract>

Non-goals:
- <results that look related but are explicitly not the target>

Owner:
<Operator or stakeholder responsible for accepting the work.>

Effective for:
<this task | current session>

Project boundary reference:
../System Guide/architecture.md (Boundary section)

Verification source:
<Pointer to the checklist file under checklists/, if one exists.>
```

## Relationship to other files

- `delegation-contract.md` — task packets reference this scope by linking to it.
- `checklists/` — verification of "done within scope" lives there.
- `session-handoffs/` — outgoing scope state is captured in the active handoff so the next session inherits it.

---

## Active Scope: 2026-05-07 — daily-planning grid + capture overhaul

Goal:
Make the daily/weekly time-blocking experience usable on a 15-minute grid with manual block control, mobile-first capture, two priority flags (user-pin and must-be-done-today), and a visible "am I on track" cue.

In scope:
- `src/lib/scheduler.ts`, `src/lib/scoring.ts`, `src/lib/blocks.ts`, `src/lib/local-date.ts`
- Calendar UI (day + week views) and capture form components under `src/app/` and `src/components/`
- API routes under `src/app/api/` for block move and task capture
- `prisma/schema.prisma` for two new boolean fields on Task: `userPinned`, `mustBeDoneToday`

Out of scope:
- Team or multi-tenant support
- External meeting-scheduling or invites
- Native mobile app — mobile work stays inside Next.js
- New external integrations beyond existing Google Calendar
- Anything outside the project boundary in `../System Guide/architecture.md`

Constraints:
- All start/end times snap to :15 intervals; the day begins on the next :15 boundary
- Operator-local time is the source of truth end-to-end (architecture rule)
- A 15-minute task occupies a 30-minute slot on the grid; visual block height equals actual duration otherwise
- Prime hours (8am–12pm) are deep-work protected; only top-3 by composite score (or user-pinned) claim them
- `mustBeDoneToday` forces today placement but prefers non-prime hours unless also `userPinned`
- "Scheduled" status is derived from today's/this-week's blocks, not stored
- Drag/drop cascades — adjacent blocks shift later, never overwrite

Non-goals:
- Calendar zoom or per-pixel granularity below :15
- Full undo/redo for block moves
- Capacity-balancing across companies as part of this scope (existing balance check is unchanged)
- Reordering or rewriting the composite-score formula beyond adding the user-pin override

Owner:
matthewb621@gmail.com

Effective for:
current session

Project boundary reference:
../System Guide/architecture.md (Boundary section)

Sequencing (drives checklist file numbering):
1. Schema: add `userPinned` and `mustBeDoneToday` (foundation for items 4 and 5 below)
2. 15-minute grid and day-start on :15
3. "Scheduled" status derived
4. Top-3 + prime-hour placement, with pin = 100 override
5. Must-be-done-today placement with non-prime preference and displacement rules
6. Live red "now" bar with on-track cue
7. Movable blocks with cascade
8. Mobile menu visibility
9. Additive Schedule Today — preserve existing blocks; explicit Clear Today is the only path back to the backlog
