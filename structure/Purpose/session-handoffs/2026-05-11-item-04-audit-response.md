# Session Handoff: item-04-audit-response

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (whichever model ran the item-04 audit against `d643916`)

## Active scope

`../scope.md` Active Scope, sequencing item 4. This handoff records the response to the Audit Agent's `Block` recommendation against `d643916`.

## Audit findings (verbatim summary)

1. **High** — Non-eligible tasks could claim prime slots ahead of lower-score eligibles. `scheduleDay` iterated `schedulable` in strict score order; a non-eligible with `slotOrder = [nonPrime, prime]` could spill into prime via its fallback when non-prime was full, even though lower-score top-3/pinned tasks hadn't iterated yet. Concrete example: `selectTop3` includes a 70-score task A from company X for cross-company spread; B is a 85-score same-company task that didn't make top-3. B (non-eligible) iterates first; if non-prime is full, B takes prime ahead of A.
2. **Medium** — POST `/api/tasks` constructed the `calculateScore` input from a partial Task object that omitted `userPinned`. A pinned capture stored `compositeScore` = pre-pin score (e.g., 30) rather than 100, so the queue-view sort (`compositeScore desc`) showed the pinned task below tasks with higher raw scores until the next PATCH triggered a recompute.

Audit also confirmed: `calculateScore` pin short-circuit, `computePrimeEligibleIds` shape, `QuickCapture` send-and-reset, and the `mustBeDoneToday`-writable-but-not-consumed deferral matching item 05's scope.

## Fixes applied

Commit: `51c3ba0 fix(scheduler): close item-04 audit findings 1 + 2`

### Finding 1 — two-pass placement
- `src/lib/scheduler.ts` `scheduleDay`: replaced the single-pass score-ordered loop with a two-pass placement.
  - Pass 1 iterates `eligibles = schedulable.filter(({task}) => primeEligibleTaskIds?.has(task.id))` in score order with `slotOrder = [prime, nonPrime]`.
  - Pass 2 iterates `nonEligibles = schedulable.filter(({task}) => !primeEligibleTaskIds?.has(task.id))` in score order with `slotOrder = [nonPrime, prime]`.
- Within each group score order is preserved (the source `schedulable` is already sorted). Cross-group, eligibles always run first regardless of score. A high-score non-eligible can no longer preempt an unplaced eligible.
- Non-eligibles can still spill into prime AFTER pass 1 finishes — matching the checklist's "non-top-3 are excluded when prime is full" phrasing. If audit prefers strict (non-eligibles never claim prime), that's a one-line tightening: drop `primeSlots` from the pass-2 fallback. Surfaced for audit's call.
- When `primeEligibleTaskIds` is omitted (rare library-only paths), `eligibles` is empty and the partition collapses to pre-item-04 behaviour.

### Finding 2 — POST stores pinned score
- `src/app/api/tasks/route.ts` POST: include `data.userPinned` and `data.mustBeDoneToday` in the object passed to `calculateScore`. A pinned capture now stores `compositeScore: 100` immediately.
- `mustBeDoneToday` is included for symmetry. Today the field doesn't influence the score; item 05 may give it weight, and the insert site should feed the full schema regardless.

## What was NOT changed

- The `selectTop3` company-spread heuristic stays. The audit's example (high-score non-top-3 same-company task) is a *property of selectTop3*, not a bug — A made top-3 because the spread heuristic preferred cross-company representation over raw score. The two-pass placement is what makes this safe; the heuristic itself is untouched per the checklist guardrail.
- PATCH `/api/tasks/:id` is unchanged. Its existing `merged` object already includes `userPinned` (via `{...existing, ...data}`), so `calculateScore(merged)` already short-circuits correctly for pin toggles. Audit didn't flag this; left alone.
- The `'reschedule'` branch path inherits the two-pass change through `rescheduleFromNow → scheduleWeek → scheduleDay`. No call-site change needed.
- The Prisma `TaskStatus` enum / read-path defensive filters from item 03 stay as they are.

## Files touched

Source (commit `51c3ba0`):

- `src/lib/scheduler.ts` — `scheduleDay` two-pass placement.
- `src/app/api/tasks/route.ts` — POST passes `userPinned`/`mustBeDoneToday` to `calculateScore`.

Bookkeeping (this commit):

- `structure/Purpose/checklists/04-top-three-prime-hour.md` — task-specific items 1, 3, and 4 evidence updated to cite `51c3ba0` and explain the fixes.
- `structure/Purpose/session-handoffs/2026-05-11-item-04-audit-response.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- `npx prisma generate`: succeeds (no schema changes this commit).
- No tests in repo.
- Suggested manual exercise for re-audit:
  1. Construct a scenario with: top-3 task A (score 70, company X), non-top-3 task B (score 85, company X). Run Schedule Today. Expect A in prime; B in non-prime.
  2. Capture a task with the pin toggle on, then GET `/api/tasks` and confirm `compositeScore: 100` for the new row before any Schedule pass runs.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Audit-response source commit: `51c3ba0 fix(scheduler): close item-04 audit findings 1 + 2`
- Prior item-04 commits: `caafbbe`, `d643916`
- Pushed: unknown (not checked this session)

## Next session should start with

- **Audit Agent re-pass:** read this handoff, then re-audit commits `caafbbe + d643916 + 51c3ba0 + <this commit>` against `../checklists/04-top-three-prime-hour.md`. Decision point flagged: should non-eligibles be able to claim leftover prime after pass 1, or never? Current implementation allows leftover (looser); strict reading would forbid (one-line change).
- **If continuing development:** the next sequencing item is `../checklists/05-must-be-done-today-placement.md`. The schema field and capture-form Zod surface are already in place; item 05 owns the scheduler placement rule and (if desired) the capture-form toggle for the must-today flag.

## Known risks

- **Score sort still uses `compositeScore` for the queue UI.** With Finding 2 fixed, a freshly-pinned task stores `compositeScore: 100`. Older pinned tasks captured before this commit still carry their pre-pin score; the queue sort will show them lower than expected until the next PATCH triggers a recompute. The scheduler reads `calculateScore` directly (not the stored value) so placement is unaffected; only the UI sort is stale for legacy pinned rows.
- **Pass-2 prime fallback is a contract judgment call.** Audit flagged "only top-3 or pinned claim prime" as the contract; checklist says "excluded when prime is full". I went with the checklist's literal reading. If audit's re-pass holds the stricter view, the fix is a one-liner: change pass-2 `slotOrder` from `[nonPrime, prime]` to `[nonPrime]`.
