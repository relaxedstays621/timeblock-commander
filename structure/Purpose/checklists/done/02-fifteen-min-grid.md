# Checklist: 02-fifteen-min-grid

Task: Move scheduling and calendar rendering to a 15-minute grid. Day starts on the next :15. A 15-minute task occupies a 30-minute slot on the grid; otherwise visual height equals actual duration.
Scope reference: `../scope.md` Active Scope (item 2 of sequencing)
Owner: matthewb621@gmail.com

## Development Agent done

- [x] requested change is implemented, or the blocker is stated
- [x] changes are scoped to the stated area (scope-adjacency notes in handoff)
- [x] unrelated user or runtime changes are preserved
- [x] existing project patterns are followed
- [x] verification was run, or not-run status is explained
- [x] changed files are listed in the handoff
- [x] residual risks and follow-ups are named

## Audit Agent done

Two-pass audit conducted against this work:

- **Pass 1** (against `3e48962`): recommendation `Block`. Findings F1 (High, day-start clamp not threaded into `'today'`/`'week'` routes) and F2 (Medium, durations not :15-aligned).
- **Pass 2** (against `628e6b0`): recommendation `Accept`. Both findings resolved; no remaining block/revise items.

- [x] findings are ordered by severity and reported before any summary
- [x] each finding is grounded in concrete evidence or labeled as inference
- [x] verification gaps are named (manual browser visual check, DST-boundary exercise — flagged in audit pass, remain operator-deferred at accept)
- [x] missing tests are identified (no test suite in repo; audit relied on tsc + diff inspection)
- [x] no fixes were implemented unless explicitly reassigned (Audit produced findings only; Dev applied fixes in commit `628e6b0`)
- [x] final recommendation is one of: accept, revise, block — `Accept` on re-pass

## Task-specific verification

Evidence scope for this section: commits `425ef49`, `9ca42f3`, and the audit-response fix `628e6b0`.

- [x] day-start helper rounds the operator's start time up to the next :15 (e.g., 7:42 → 7:45, 7:46 → 8:00) — `src/lib/local-date.ts` `alignToFifteen()` + `src/lib/scheduler.ts` `rescheduleFromNow` derives the clamp via `Math.ceil((currentHour*60 + currentMinute) / 15)`. **Audit follow-up (commit `628e6b0`):** the clamp is now also passed by the `'today'` and `'week'` branches of `src/app/api/schedule/route.ts`, not just `'reschedule'`. All three scheduling actions enforce the rule end-to-end.
- [x] all generated block start and end times are :15-aligned — starts: `scheduleDay` operates on slot indices; `startHour` and `startMinute` are derived as `Math.floor(slot / 4)` and `(slot % 4) * 15`, both :15-aligned by construction. **Audit follow-up (commit `628e6b0`):** durations are now also snapped via `alignedDuration = Math.ceil(estimatedMinutes / 15) * 15` and that aligned value is what is persisted as `block.durationMinutes` (and used in the daily-capacity check). End-time = start + alignedDuration is :15-aligned by construction. `task.estimatedMinutes` is left untouched.
- [x] a 15-minute task renders as a 30-minute slot on the grid — `gridSlotsForDuration` in `scheduler.ts` and `slotsForDuration` in `page.tsx` both return 2 slots for `≤15`
- [x] a 30-minute task renders as a 30-minute slot — `Math.ceil(30/15) = 2`
- [x] a 90-minute task renders as a 90-minute slot — `Math.ceil(90/15) = 6`
- [~] manual visual check of day view at the operator's local timezone confirms grid lines on every :15 — **DEFERRED**; dev server was not started this session. Operator must verify in browser before audit-accept
- [x] week view inherits the same grid without separate logic — `WeekView` per-day chip list reads the same `(startHour, startMinute)` data shape and sorts and labels accordingly; no separate hour math
- [~] no DST-boundary regressions on a day with a transition — **DEFERRED**; `local-date.ts` and `timezone.ts` DST-handling paths are unchanged (only additive — `alignToFifteen` and `zonedMinute` added), but no DST-day exercise was run this session

## Out-of-scope guardrails

Evidence scope for this section: commits `425ef49` and `9ca42f3`.

- [x] no scoring or pin-flag changes in this checklist — `src/lib/scoring.ts` not touched; `userPinned` / `mustBeDoneToday` not consumed in scheduler placement
- [x] no drag/drop wiring in this checklist (item 07) — no drag-event handlers added; block move API surface untouched
- [x] no live-bar UI in this checklist (item 06) — no "now" bar element added; only the existing current-slot row highlight remains, scoped to one :15 row via `currentSlot`
- [~] no edits to `auth.ts`, `google-calendar.ts`, or any non-scheduling module — `auth.ts` and `google-calendar.ts` untouched as required. Scope-adjacent edits: `src/app/api/calendar/route.ts` (Google sync consumer of `startMinute`), `scripts/migrate-user.ts` (consumer of the new unique key), and `src/lib/timezone.ts` (added `zonedMinute` mirroring `zonedHour`). These are consumer updates required by the schema change to preserve existing behavior, not feature work in non-scheduling modules. Surfaced in commit `425ef49` body and in this handoff for audit judgment.

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` reflects the grid state and any unverified DST or timezone risks — see `2026-05-10-item-02-fifteen-min-grid.md`
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
