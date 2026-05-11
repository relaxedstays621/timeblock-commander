# Checklist: 09-additive-schedule-today

Task: Make **Schedule Today** additive — it must place only tasks that do not already have a live block today, and must never wipe manually-placed blocks or revert their tasks to the queue. Returning items to the backlog should require the explicit **Clear Today** action that already exists in the UI.
Scope reference: `../scope.md` Active Scope (item 9 of sequencing)
Owner: matthewb621@gmail.com

## Why

Operator-reported behavior on 2026-05-11: pressing **Schedule Today** removes every block already on today's calendar and re-queues the linked tasks, then re-plans from scratch. After manually dragging tasks back onto today's grid (item-07 path), a second press wipes them again. The mental model the operator expects: Schedule Today fills in unscheduled work without disturbing what is already placed. Returning a task to the backlog should be an explicit user action.

Today's surface, for reference:

- `src/app/api/schedule/route.ts` lines 192–247 (action `'day'`) calls `clearBlocks(tx, { userId, range: targetDate })` before the planner runs.
- `clearBlocks` in `src/lib/blocks.ts` deletes every non-completed block for the date AND resets every linked task whose status is `SCHEDULED`/`IN_PROGRESS` back to `QUEUED`.
- `src/app/page.tsx:187` already exposes a separate **Clear Today** button that calls `DELETE /api/blocks?date=...` — the existing explicit-clear path. Post-fix, that button stays as the only way to wipe today.

## Development Agent done

- [ ] requested change is implemented, or the blocker is stated
- [ ] changes are scoped to the stated area
- [ ] unrelated user or runtime changes are preserved
- [ ] existing project patterns are followed
- [ ] verification was run, or not-run status is explained
- [ ] changed files are listed in the handoff
- [ ] residual risks and follow-ups are named

## Audit Agent done

- [ ] findings are ordered by severity and reported before any summary
- [ ] each finding is grounded in concrete evidence or labeled as inference
- [ ] verification gaps are named
- [ ] missing tests are identified
- [ ] no fixes were implemented unless explicitly reassigned
- [ ] final recommendation is one of: accept, revise, block

## Task-specific verification

Behavioral (manual or scripted against live runtime):

- [ ] press **Schedule Today** with N queued tasks on an empty day → N blocks created
- [ ] press **Schedule Today** a second time with no new tasks added → **zero** new blocks created; existing blocks unchanged in id, position, and `taskId`
- [ ] manually drag an existing block to a new slot (item-07 path), then press **Schedule Today** → the dragged block keeps its position and id; its task does **not** flip back to `QUEUED`
- [ ] add a new task to the queue after a prior **Schedule Today**, press it again → the new task lands in an open slot; **no existing block is touched**
- [ ] press **Clear Today** → all non-completed blocks for today are removed and linked tasks revert to `QUEUED` (existing behavior preserved verbatim)
- [ ] stale-scheduled sweep still runs: a block dated yesterday on an incomplete task is removed and its task reset before today's scheduling proceeds (do not regress the logic at `src/app/api/schedule/route.ts:74–99`)
- [ ] a task that has a live block today is **not** placed again by the planner — the planner's task-eligibility filter must exclude tasks with a live block on the target date
- [ ] capacity / prime-hour / must-today rules still apply to newly-placed tasks (items 04 + 05 not regressed)
- [ ] the existing `rescheduleFromNow` action (Reschedule from now) is unchanged in semantics

Code paths:

- [ ] `clearBlocks` is no longer called from the `action === 'day'` branch
- [ ] the day-branch planner sees the existing blocks as "survivors" and routes them into the planner's `existingBlocks` parameter so it can pack around them
- [ ] task-eligibility filter for the day branch excludes any task that has a live block on the target date (consistent with the existing stale-scheduled `liveBlockFilter` semantics)
- [ ] no schema changes: do not introduce an `isManual` / `locked` flag — preserving all blocks unconditionally is simpler and matches the operator's stated model

Verification commands (Dev Agent should run before handoff):

- [ ] `npx tsc --noEmit` clean for touched files
- [ ] in-container Prisma probe still returns `DB_OK` (per `_template.md` deployment note — not a deployment task here, but if the change requires a rebuild, smoke-check before declaring done)

## Out-of-scope guardrails

- [ ] no changes to **Schedule Week** behavior in this task — see Decision points below
- [ ] no changes to **Reschedule from now** semantics
- [ ] no changes to the stale-scheduled sweep (`src/app/api/schedule/route.ts:74–99`)
- [ ] no changes to `clearBlocks` itself — it is still the right primitive for **Clear Today** and **Schedule Week**
- [ ] no schema changes (no new TimeBlock flags, no migration)
- [ ] no UI copy / icon changes for the Schedule Today / Clear Today buttons
- [ ] no Google Calendar reconciliation changes — calendar push remains operator-driven

## Decision points to flag for the operator

The Dev Agent should surface these before or during implementation, not silently choose:

- **Schedule Week:** does the same additive rule apply? Today's bug report is specifically about Schedule Today; Schedule Week (action `'week'`) calls `clearBlocks` over the week range. Operator preference is unknown for the week case — flag and ask, do not bundle the change without authorization.
- **Re-press behavior when capacity is reached:** if all queued tasks are already scheduled and Schedule Today is pressed, the action becomes a no-op. Confirm the operator wants silent no-op vs. a toast / banner saying "nothing to schedule."
- **Manually-placed conflict with planner placement:** if a manual block sits exactly where the planner wanted to put a different task, the planner should pack around it. Confirm this matches operator expectation (vs. a "conflict — couldn't place X" surface).

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records before/after behavior, the decision-point answers from the operator, and the smallest reproducer
- [ ] git branch and commit are recorded in the handoff
- [ ] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
