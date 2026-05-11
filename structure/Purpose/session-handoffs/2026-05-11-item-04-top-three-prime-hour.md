# Session Handoff: item-04-top-three-prime-hour

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: unassigned (control-plane row still `<fill per project>`)

## Active scope

`../scope.md` Active Scope, sequencing item 4. Dev-side change in one source commit; bookkeeping in this commit.

## Work completed

- Implemented item 04 in `caafbbe feat(scheduler): top-3 + pinned own prime hours; pin = score 100`. Five behaviour changes plus comments:
  1. **`calculateScore` short-circuits to 100 when `task.userPinned` is true.** Reactive penalty, due-date ladder, carryover bonus etc. are all bypassed.
  2. **New `computePrimeEligibleIds(tasks)`** returns the Set of ids that may claim prime slots — union of `selectTop3` and `userPinned`. Handles the >3-pinned overflow case by union.
  3. **`scheduleDay` accepts an optional `primeEligibleTaskIds` Set.** Its `needsPrime` predicate now uses set lookup; the old `EnergyLevel/score>=70` heuristic is removed (unused `EnergyLevel` import dropped).
  4. **`scheduleWeek` computes the Set once over the schedulable pool** before iterating days, so top-3 membership is stable across the week.
  5. **The `'day'` branch in `/api/schedule`** also derives `primeEligibleTaskIds` (over `freshTasks` filtered to QUEUED/BACKLOG) and passes it to `scheduleDay`, so the rule applies identically to single-day scheduling.
  6. **Capture form pin toggle** added in `QuickCapture.tsx`. Tinted amber when pressed, with a helper line ("Score forced to 100; claims an 8a–12p slot."). `userPinned` is included in `createTask`.
  7. **`CreateTaskSchema` accepts `userPinned` and `mustBeDoneToday`** (boolean defaults false). `UpdateTaskSchema` inherits via `.partial()`. The Prisma fields landed in item 01; this commit opens the input surface.
- Ticked Development Agent + task-specific + out-of-scope-guardrail boxes on `../checklists/04-top-three-prime-hour.md`.

## Work in progress

- None. Item 04 dev-side is complete pending audit.

## Decisions made

- **`primeEligibleTaskIds` is week-stable, not per-day.** Computing it once in `scheduleWeek` means a top-3 task that fits on Monday doesn't lose top-3 status on Tuesday simply because Monday consumed it. For the `'day'` branch in the route, the set is computed against the day's task pool — same semantics for a single-day pass.
- **Pin overflow goes through the union, not a capped extension of top-3.** `computePrimeEligibleIds` unions `selectTop3` (capped at 3) and `tasks.filter(userPinned)` (uncapped). When >3 are pinned, all enter the eligible set; the placement loop grants prime in score order until prime fills, then the standard contiguous-slot search falls back to non-prime.
- **Capture form is the only UI surface for the pin.** Checklist guardrail says no UI changes beyond surfacing the pin on the capture form. `TaskDetailModal` does not yet have a pin toggle — pin/unpin a captured task requires editing it via API or future UI work.
- **`mustBeDoneToday` is writable but not consumed.** The Zod schema accepts it so the capture form (and any other client) can set it now. The scheduler doesn't yet consume it; that's item 05.
- **Removed `EnergyLevel/score>=70` prime preference.** A non-pinned high-energy task no longer gets automatic prime preference. It still scores well, can still be in top-3, and can still claim prime via that path. Behaviour change is intentional per the scope's "top-3 by composite score claim prime-hour slots" statement.

## Open questions

- Should `TaskDetailModal` get a pin toggle in a later item? Checklist guardrail forbids it here.
- Does the score-100 short-circuit need to be documented in the score breakdown UI? Currently no UI exposes the score components.
- Audit reasoning for "company-spread heuristic with pinned naturally rising": when 4 of 5 pinned tasks belong to the same company, `selectTop3`'s first-pass (one per company) picks 3 different companies — meaning some pinned tasks may not enter top-3 set, but the union still keeps them prime-eligible via `userPinned`. Worth flagging for audit so it can confirm the behaviour matches intent.

## Files touched

Source (commit `caafbbe`):

- `src/lib/scoring.ts` — `calculateScore` early returns 100 if `userPinned`.
- `src/lib/scheduler.ts` — `computePrimeEligibleIds` added; `scheduleDay` takes `primeEligibleTaskIds`; `scheduleWeek` computes once and passes down; unused `EnergyLevel` import removed.
- `src/lib/schemas.ts` — `CreateTaskSchema` accepts `userPinned` and `mustBeDoneToday`.
- `src/app/api/schedule/route.ts` — `'day'` branch computes and passes `primeEligibleTaskIds`.
- `src/components/QuickCapture.tsx` — pin toggle UI; `userPinned` in `createTask` payload; reset on submit.

Bookkeeping (this commit):

- `structure/Purpose/checklists/04-top-three-prime-hour.md` — Dev Agent + task-specific + out-of-scope-guardrail boxes ticked with evidence per box.
- `structure/Purpose/session-handoffs/2026-05-11-item-04-top-three-prime-hour.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- No tests in the repo to run.
- Suggested manual exercise:
  1. Capture a task with the pin toggle on. Confirm `userPinned: true` is persisted (e.g., `prisma studio` or PATCH-then-GET).
  2. Run Schedule Today. Pinned task should land on an 8–12 slot.
  3. Capture 4 pinned tasks. All four should claim prime; if prime fills, the latest should fall to non-prime.
  4. Capture a high-priority non-pinned task. Confirm it lands in non-prime unless it enters top-3.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commit: `caafbbe feat(scheduler): top-3 + pinned own prime hours; pin = score 100`
- Pushed: unknown (not checked this session)

## Next session should start with

- **Audit Agent:** read this handoff, then audit `caafbbe` against `../checklists/04-top-three-prime-hour.md`. Areas to scrutinize: the >3-pinned overflow union; the removal of `EnergyLevel`-based prime preference (intentional but a behaviour change); the route's `'day'` branch computing eligibility over the right pool; the score-100 short-circuit preserving the rest of the formula for non-pinned tasks.
- **If continuing development:** next sequencing item is `../checklists/05-must-be-done-today-placement.md` — `mustBeDoneToday` placement with non-prime preference and displacement rules. The Zod schema and capture-form wiring for the field are already in place from this commit, so item 05 should focus on the scheduler placement rules and (if desired) a capture-form toggle for the must-today flag.
- **Item 01 re-audit** also remains pending against `44c5e8b + 20a587d + 0717cc6`.

## Known risks

- **`scheduleWeek` recomputes top-3 only once.** If two callers both invoke `scheduleWeek` against an overlapping task pool in sequence (rare), top-3 is recomputed each call. Within a single call it's stable. The `/api/schedule` route's 'reschedule' branch calls `rescheduleFromNow` twice (which calls `scheduleWeek` twice) — top-3 may shift between the two passes if blocks/state change in between. Audit should confirm this is acceptable.
- **`'reschedule'` branch path.** `rescheduleFromNow` calls `scheduleWeek` internally; my changes to `scheduleWeek` (computing eligibility once) flow through automatically. No explicit eligibility derivation is needed at the rescheduler call site.
- **`mustBeDoneToday` writable but ignored.** A client that sets `mustBeDoneToday: true` on a task today won't see any placement change; the field round-trips through DB but the scheduler doesn't read it. Item 05 will pick this up.
- **`isReactive` defaulting.** `QuickCapture` sets `isReactive: urgency >= 7`. Combined with the pin override, a high-urgency pinned task would have been reactive-penalised; now pin wins. Consistent with the contract.
- **`AnalyticsView` may report a stale "top-3 prime usage" metric** if it ever existed; quick audit of `src/lib/scoring.ts` confirms `selectTop3` is intact, and `src/app/api/analytics/route.ts` was not touched. Worth a visual sanity check after item 05.
