# Checklist: 04-top-three-prime-hour

Task: Top-3 by composite score claim prime-hour slots (8am–12pm). User-pinned tasks force composite score to 100 so they always lead the top-3 and always claim prime hours.
Scope reference: `../scope.md` Active Scope (item 4 of sequencing)
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

- [ ] findings are ordered by severity and reported before any summary
- [ ] each finding is grounded in concrete evidence or labeled as inference
- [ ] verification gaps are named
- [ ] missing tests are identified
- [ ] no fixes were implemented unless explicitly reassigned
- [ ] final recommendation is one of: accept, revise, block

## Task-specific verification

Evidence scope for this section: commits `caafbbe` and the audit-response fix `51c3ba0`.

- [x] `calculateScore` returns 100 when `task.userPinned === true` (early return; other components still compute for diagnostics if useful, but the returned value is 100) — `src/lib/scoring.ts`: `if (task.userPinned) return 100;` is the first statement after the docstring; nothing else mutates the return when the pin is set. **Audit follow-up (`51c3ba0`):** POST `/api/tasks` now feeds `userPinned` (and `mustBeDoneToday`) into the `calculateScore` input, so a pinned capture stores `compositeScore: 100` immediately rather than its pre-pin value
- [x] `selectTop3` continues to apply the company-spread heuristic, with pinned tasks naturally rising due to score — `src/lib/scoring.ts` `selectTop3` is untouched; the score-sort + company-spread heuristic remains. Pinned tasks now score 100 so they sort to the top first, and the company-spread pass picks them subject to the same rules
- [x] scheduler places top-3 into prime hours (8am–12pm operator-local) before any other tasks — **Audit follow-up (`51c3ba0`):** `scheduleDay` now runs a two-pass placement. Pass 1 iterates the eligibles partition (top-3 + pinned) in score order with `slotOrder = [prime, nonPrime]`; pass 2 iterates the non-eligibles partition in score order with `slotOrder = [nonPrime, prime]`. Eligibles always run before any non-eligible regardless of score, so a high-score non-top-3 task cannot preempt a lower-score eligible. The `primeEligibleTaskIds` Set is still computed once per scheduling pass via `computePrimeEligibleIds`
- [x] non-top-3, non-pinned tasks are excluded from prime-hour placement when prime is full — non-eligibles iterate in pass 2 with `[nonPrime, prime]`. Eligibles already placed in pass 1 will have filled prime if there were enough; in that case `prime` in the fallback iterator yields no free slot and the task goes non-prime (or is unplaceable). If prime has leftover after pass 1, non-eligibles can still claim those slots, matching the checklist's "when prime is full" phrasing
- [x] when more than 3 tasks are pinned, all of them claim prime hours up to capacity, then overflow goes to non-prime — `computePrimeEligibleIds` is a UNION of `selectTop3` (capped at 3) and `tasks.filter(userPinned)` (no cap). Pinned tasks beyond the top-3 are still in the set; they iterate in score order and grab prime slots until prime is full, then naturally fall back to non-prime via the contiguous-slot fallback in the placement loop
- [x] unit-level reasoning trace: a pinned reactive task still scores 100 (pin overrides reactive penalty) — `calculateScore` early-returns before the reactive penalty branch (`task.isReactive && task.urgency < 7 → score -= 5`) is reached. Pin always wins

## Out-of-scope guardrails

Evidence scope for this section: commits `caafbbe` and `51c3ba0`.

- [x] no change to the must-be-done-today placement rule (item 05 owns that) — `mustBeDoneToday` is now writable via `CreateTaskSchema`/`UpdateTaskSchema` so the capture form/PATCH can set it, but no scheduler placement code consumes the field. Placement logic for `mustBeDoneToday` is explicitly left to item 05
- [x] no change to drag/drop behavior (item 07) — no drag-event handlers added or modified
- [x] no UI changes beyond surfacing the pin state on the capture form — only `src/components/QuickCapture.tsx` gained a pin toggle button. No edits to `TaskDetailModal`, `TodayView`, `WeekView`, `QueueView`, or `AnalyticsView`. The `mustBeDoneToday` field is accepted by the schema but the capture form does not yet expose a toggle for it (item 05 owns that UI)
- [x] composite-score formula for non-pinned tasks is unchanged — the body of `calculateScore` after the `userPinned` early return is byte-identical to the pre-item-04 version

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records the score override and prime-hour rule — see `2026-05-11-item-04-top-three-prime-hour.md`
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
