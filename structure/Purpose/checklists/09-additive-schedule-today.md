# Checklist: 09-additive-schedule-today

Task: Make **Schedule Today** and **Schedule Week** additive — both must place only tasks that do not already have a live block in the target range, and must never wipe manually-placed blocks or revert their tasks to the queue. Returning items to the backlog should require the explicit **Clear Today** action that already exists in the UI.

Scope notes from operator (locked 2026-05-11): Schedule Week also moves to the additive model (decision point 1); when nothing new can be scheduled, surface a toast "Nothing new to schedule" (decision point 2); on planner-vs-manual placement conflict, pack around silently (decision point 3).
Scope reference: `../scope.md` Active Scope (item 9 of sequencing)
Owner: matthewb621@gmail.com

## Why

Operator-reported behavior on 2026-05-11: pressing **Schedule Today** removes every block already on today's calendar and re-queues the linked tasks, then re-plans from scratch. After manually dragging tasks back onto today's grid (item-07 path), a second press wipes them again. The mental model the operator expects: Schedule Today fills in unscheduled work without disturbing what is already placed. Returning a task to the backlog should be an explicit user action.

Today's surface, for reference:

- `src/app/api/schedule/route.ts` lines 192–247 (action `'day'`) calls `clearBlocks(tx, { userId, range: targetDate })` before the planner runs.
- `clearBlocks` in `src/lib/blocks.ts` deletes every non-completed block for the date AND resets every linked task whose status is `SCHEDULED`/`IN_PROGRESS` back to `QUEUED`.
- `src/app/page.tsx:187` already exposes a separate **Clear Today** button that calls `DELETE /api/blocks?date=...` — the existing explicit-clear path. Post-fix, that button stays as the only way to wipe today.

## Development Agent done

- [x] requested change is implemented, or the blocker is stated
- [x] changes are scoped to the stated area
- [x] unrelated user or runtime changes are preserved
- [x] existing project patterns are followed
- [x] verification was run, or not-run status is explained
- [x] changed files are listed in the handoff
- [x] residual risks and follow-ups are named

## Audit Agent done

- [ ] findings are ordered by severity and reported before any summary
- [ ] each finding is grounded in concrete evidence or labeled as inference
- [ ] verification gaps are named
- [ ] missing tests are identified
- [ ] no fixes were implemented unless explicitly reassigned
- [ ] final recommendation is one of: accept, revise, block

## Task-specific verification

Behavioral (manual or scripted against live runtime):

- [~] press **Schedule Today** with N queued tasks on an empty day → N blocks created
- [~] press **Schedule Today** a second time with no new tasks added → **zero** new blocks created; existing blocks unchanged in id, position, and `taskId`; toast "Nothing new to schedule" surfaces
- [~] manually drag an existing block to a new slot (item-07 path), then press **Schedule Today** → the dragged block keeps its position and id; its task does **not** flip back to `QUEUED`
- [~] add a new task to the queue after a prior **Schedule Today**, press it again → the new task lands in an open slot; **no existing block is touched**
- [~] **Schedule Week** behaves the same way: re-pressing preserves all existing blocks in the week range; new tasks land in open slots; nothing-new case surfaces the toast
- [~] planner placement conflict with a manual block packs around silently — no surface, just lands in the next free slot (or queue if none fits within end-of-day)
- [~] press **Clear Today** → all non-completed blocks for today are removed and linked tasks revert to `QUEUED` (existing behavior preserved verbatim)
- [~] stale-scheduled sweep still runs: a block dated yesterday on an incomplete task is removed and its task reset before today's scheduling proceeds (do not regress the logic at `src/app/api/schedule/route.ts:74–99`)
- [~] capacity / prime-hour / must-today rules still apply to newly-placed tasks (items 04 + 05 not regressed)
- [~] the existing `rescheduleFromNow` action (Reschedule from now) is unchanged in semantics

All behavioral rows above marked `[~]` — deferred to post-deployment exercise; this dev-side change is on the branch but has not been rebuilt + swapped into the running container yet, so live-runtime validation is not possible from this session. Code-path inspection below stands in as the dev-side check; the handoff records the verification gap.

Code paths:

- [x] `clearBlocks` is no longer called from the `action === 'day'` or `action === 'week'` branches
- [x] both branches route existing blocks as "survivors" through the planner's `existingBlocks` parameter so it can pack around them
- [x] task-eligibility filter for both branches excludes any task that has a live block on the target date(s) (consistent with the existing stale-scheduled `liveBlockFilter` semantics)
- [x] no schema changes: do not introduce an `isManual` / `locked` flag — preserving all blocks unconditionally is simpler and matches the operator's stated model
- [x] response payload carries a flag (e.g. `nothingNew: true`) when zero blocks are created so the client can surface the toast without re-deriving state

Verification commands (Dev Agent should run before handoff):

- [x] `npx tsc --noEmit` clean for touched files (only the four pre-existing `googleapis` / `google-auth-library` errors, unchanged and unrelated)
- [~] in-container Prisma probe still returns `DB_OK` — deferred because this change has not been deployed yet

## Out-of-scope guardrails

- [x] no changes to **Reschedule from now** semantics
- [x] no changes to the stale-scheduled sweep (`src/app/api/schedule/route.ts:74–99`)
- [x] no changes to `clearBlocks` itself — it remains the primitive for **Clear Today**
- [x] no schema changes (no new TimeBlock flags, no migration)
- [x] no UI copy / icon changes for the Schedule Today / Clear Today buttons
- [x] no Google Calendar reconciliation changes — calendar push remains operator-driven

## Decision points — resolved 2026-05-11

1. **Schedule Week:** also additive. Drop `clearBlocks` from the week branch; pack around existing blocks across the week range.
2. **No-op behavior:** surface a toast "Nothing new to schedule" when zero new blocks are created. Server returns a flag in the response; client routes through an info-banner (distinct from the error-banner channel).
3. **Planner-vs-manual conflict:** pack around silently. Existing blocks are immutable survivors; the planner finds the next free slot. If a task can't fit before end-of-day, it stays in the queue without a special surface (mirrors the standard overflow path).

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records before/after behavior, the decision-point answers from the operator, and the smallest reproducer
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
