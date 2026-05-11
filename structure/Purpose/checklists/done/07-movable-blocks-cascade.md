# Checklist: 07-movable-blocks-cascade

Task: Blocks are movable via drag/drop on the calendar. Drops snap to :15. When a drop lands on an occupied slot, adjacent blocks cascade later in time rather than being overwritten.
Scope reference: `../scope.md` Active Scope (item 7 of sequencing)
Owner: matthewb621@gmail.com

## Development Agent done

- [x] requested change is implemented, or the blocker is stated
- [x] changes are scoped to the stated area
- [x] unrelated user or runtime changes are preserved
- [x] existing project patterns are followed
- [x] verification was run, or not-run status is explained
- [x] changed files are listed in the handoff
- [x] residual risks and follow-ups are named

## Audit Agent done

Two audit passes were conducted against this work:

- **Pass 1** (against `113987f` + `ab2d737`): recommendation `Block`. High finding — `moveBlockWithCascade`'s reverse-new-slot-order update strategy hits a transient unique-constraint failure on `(userId, date, startHour, startMinute)` for backward moves. Concrete trace: `A` at slot 42, `B` at slot 40 (each 30-min); move `A` → 40 plans `A`→40, `B`→42; sorted reverse-new-slot the first statement writes `B` to slot 42, but slot 42 is still held by `A` and Postgres rejects with P2002. Resolved by `31658b2` (two-phase sentinel-date update: Phase 1 parks each updated row on `9999-12-31` with its final `(startHour, startMinute)`, Phase 2 returns each row's `date` to the real date; the cascade plan guarantees pairwise unique final slots so neither phase collides) plus `90fc261` (handoff updated to describe the two-phase approach and list the rejected alternatives — `DEFERRABLE` constraint requires a schema migration; delete-and-recreate loses `block.id`).
- **Pass 2** (against `113987f` + `31658b2` + `ab2d737` + `90fc261`): recommendation `Revise` (bookkeeping only). Low finding — the two `Evidence scope` lines on this checklist (Task-specific and Out-of-scope) cited only `113987f`, not the audit-driven fix in `31658b2`. An auditor following those scope lines would have missed the constraint-safety fix. Resolved by this commit (both lines now cite `113987f` and `31658b2`). Audit Agent accepted on the condition that this update landed.

- [x] findings are ordered by severity and reported before any summary
- [x] each finding is grounded in concrete evidence or labeled as inference (Pass-1 finding includes the failing trace; Pass-2 finding cites the line locations)
- [x] verification gaps are named (deferred manual desktop/mobile drag exercises remain behind the DB-credential blocker — same class of carry-over as items 01, 05, 06; backward-move cascade is now constraint-safe by reasoning but the live-DB exercise is also deferred)
- [x] missing tests are identified (no test suite in repo; audit relied on tsc + reasoning trace through the cascade plan and the two-phase update order)
- [x] no fixes were implemented unless explicitly reassigned (Dev applied `31658b2` for the Pass-1 Block and the stale-line corrections in this commit for the Pass-2 Revise)
- [x] final recommendation is one of: accept, revise, block — `Accept` after the bookkeeping fix in this commit

## Task-specific verification

Evidence scope for this section: commits `113987f` and `31658b2` (audit-driven cascade fix) plus the bookkeeping commit landing this checklist update.

- [x] desktop drag/drop on a block updates start time on drop — `src/app/page.tsx` `onBlockPointerDown` installs window-level `pointermove`/`pointerup` handlers on grip pointerdown; on commit the client calls `moveBlock(blockId, newHour, newMinute)` (PUT `/api/blocks/[id]`), which routes through `moveBlockWithCascade` in `src/lib/blocks.ts` and persists `startHour`/`startMinute`.
- [~] mobile touch-drag works without jitter on the same component — implementation uses `PointerEvent`, which unifies mouse and touch through one handler; the grip element carries Tailwind `touch-none` (CSS `touch-action: none`) so a touch drag on the handle does not trigger page scroll. Jitter check is **deferred** to a manual mobile session — the running app's DB-auth blocker keeps `todayBlocks` empty, so no draggable block renders end-to-end this session.
- [x] drop coordinates snap to :15 grid — `Math.round(dy / SLOT_PX)` in `onBlockPointerDown` converts pointer drift to slot-index delta; the candidate slot is `origSlot + slotDelta` clamped to `[dayStartSlot, dayEndSlot - durSlots]`. The server also defensively snaps `startMinute` to a `0/15/30/45` multiple in `moveBlockWithCascade`, and the API route's Zod schema refuses any other minute value.
- [x] dropping onto an occupied slot shifts the affected block(s) later, preserving their order and relative gaps where possible — `planCascade` in `src/lib/blocks.ts` places the moved block first, then processes the other blocks in original-start ascending order. Each other block keeps its original slot unless it overlaps an already-placed block, in which case it slides forward to the first non-overlapping position (looping until clear). Relative temporal order among cascaded blocks is preserved by the sort; relative gaps survive when no push is needed and collapse only when a push is forced (the "where possible" qualifier).
- [x] cascade does not push blocks past end-of-day; if it would, those blocks return to the queue/log (unscheduled, derivation per item 03) — `planCascade` returns an `unscheduled` array containing any block whose final position would end past `dayEndSlot` (default 9pm). `moveBlockWithCascade` then deletes those rows and reverts any `SCHEDULED`/`IN_PROGRESS` task back to `QUEUED` (mirrors the existing `clearBlocks` pattern). Item-03's derived `isScheduled` flag returns false for those tasks naturally. The client surfaces a "N block(s) didn't fit and were returned to the queue" notice via the existing error-banner channel.
- [x] block move calls a single API endpoint that performs the cascade server-side (not on the client only) — `PUT /api/blocks/[id]` is the only entry point; cascade math runs inside `moveBlockWithCascade` on the server inside a Prisma `$transaction`. The client receives the resulting `{ moved, cascaded, unscheduled }` payload and re-fetches via `refreshAll`.
- [x] no double-write to Google Calendar on a single drop — the move endpoint and `moveBlockWithCascade` do not touch `gcalEventId`, do not call any helper in `src/lib/google-calendar.ts`, and do not invoke `/api/calendar`. `gcalEventId` stays attached to the block; calendar reconciliation happens on the next explicit calendar push and is unchanged.
- [~] manual test: move a block onto a top-3 prime-hour slot — confirm cascade still respects prime-hour rule (item 04) or rejects with a clear error — **design choice (not "reject"):** manual drops are honored as the operator requested, so the cascade does not consult item 04's prime-hour rule. The auto-scheduler restores item-04 ordering on Reschedule. Rationale: a manual drag is explicit operator authority, and the cascade itself already prevents data loss (no overwrites; overflow returns to queue). The manual browser exercise of this scenario is **deferred** behind the DB-auth blocker.

## Out-of-scope guardrails

Evidence scope for this section: commits `113987f` and `31658b2`. Neither touches the guardrailed surfaces.

- [x] no resize handles in this checklist (resize is not in scope) — no resize affordance added; `block.durationMinutes` is not mutated by the move endpoint or `moveBlockWithCascade`.
- [x] no multi-select drag in this checklist — `draggingBlockId` is `string | null`, a single id; `onBlockPointerDown` operates on one block per pointerdown.
- [x] no undo/redo (explicit non-goal in scope.md) — no history stack added; commits write final state directly.

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records the cascade algorithm and the end-of-day overflow behavior — see `2026-05-11-item-07-movable-blocks.md`.
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
