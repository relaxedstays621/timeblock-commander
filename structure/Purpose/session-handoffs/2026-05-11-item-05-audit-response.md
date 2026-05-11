# Session Handoff: item-05-audit-response

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

**Supersedes the earlier 2026-05-11 end-of-day handoff** (`2026-05-11-item-05-must-today-and-session-close.md`). The audit ran same-day and surfaced the order tension that handoff explicitly flagged. This file is the new pickup-tomorrow contract.

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (whichever model ran the item-05 audit against `56ef4a0 + 4e99ee0`)

## Active scope

`../scope.md` Active Scope, sequencing item 5.

## Audit finding (verbatim summary)

**High** — Non-pinned `mustBeDoneToday` tasks could take prime slots before top-3/pinned tasks placed. `scheduleDay` ordered all must-today tasks first (`scheduler.ts:184`), before prime eligibles (`scheduler.ts:185`). A non-pinned must-today task used `[nonPrime, prime]` (`scheduler.ts:216`), so if non-prime was full it could claim prime before the top-3 pass ran. This conflicted with checklist item 05's own claim that prime fallback happens "only after top-3 have claimed their prime slots" and with item 04's accepted prime protection.

Audit also confirmed:
- The capture-form toggle exists, resets, and sends `mustBeDoneToday`.
- Must-today tasks are properly restricted to today in both `scheduleWeek` and the `'day'` route branch.
- Overflow behaviour is consistent with item-03's derived `isScheduled`.

Verification gaps named: manual browser checks remain deferred for the two named scenarios.

## Fix applied

Commit: `67f703f fix(scheduler): close item-05 audit finding — eligibles before must-today`

### Reordered placement (the core fix)

- **Pass 1 — prime-eligibles** (top-3 ∪ pinned), INCLUDING any must-today member. Eligibles always run first, so prime slots are claimed by item-04 winners before must-today competes.
- **Pass 2 — must-today-only** (must-today AND NOT prime-eligible). Tries non-prime first; falls back to prime only if non-prime is full and Pass 1 left prime open. Tasks that don't fit stay unscheduled.
- **Pass 3 — non-eligibles**. Unchanged. Non-prime-first with prime as fallback.

### Refined `preferPrime` predicate

```ts
preferPrime = task.userPinned || (isPrimeEligible && !isMustToday);
```

Cases honored:
- pinned (with or without must-today): Pass 1, prime-first.
- top-3 only, not must-today: Pass 1, prime-first.
- top-3 + must-today, not pinned: Pass 1, **non-prime-first** (item-05 exception clause "preferring non-prime unless also userPinned" wins over item-04 "top-3 own prime" when both apply).
- must-today only: Pass 2, non-prime-first.
- regular: Pass 3, non-prime-first.

## What was NOT changed

- `scheduleWeek` must-today filter (non-today day iterations exclude must-today tasks). Unchanged — audit confirmed.
- `'day'` route branch must-today plumbing. Unchanged — audit confirmed.
- `QuickCapture` toggle, payload, reset. Unchanged — audit confirmed.
- `selectTop3`, `computePrimeEligibleIds`, `gridSlotsForDuration`, `alignedDuration` math. Unchanged.
- No new tests; project still has no test suite. Audit relied on tsc + reasoning trace.

## Files touched

Source (commit `67f703f`):

- `src/lib/scheduler.ts` — partition reordered (`eligibles → mustTodayOnly → nonEligibles`); `preferPrime` predicate refined; comments updated to name the audit fix.

Bookkeeping (this commit):

- `structure/Purpose/checklists/05-must-be-done-today-placement.md` — task-specific items 2 and 3 evidence cite `67f703f` and explain the new order.
- `structure/Purpose/session-handoffs/2026-05-11-item-05-audit-response.md` — this file (supersedes the earlier 2026-05-11 EOD handoff as the active pickup contract).

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- `npx prisma generate`: succeeds.
- No tests in repo.
- **Still deferred** (carried over from the EOD handoff): manual browser exercise of the two named scenarios — capture a non-pinned must-today at 9am (expect placement after 12p), capture pinned + must-today (expect prime). Operator should drive these before final accept.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Audit-response source commit: `67f703f fix(scheduler): close item-05 audit finding — eligibles before must-today`
- Prior item-05 commits: `56ef4a0` (initial build), `4e99ee0` (EOD bookkeeping)
- Pushed: unknown — not checked this session.

## Pending audit queue (highest priority for tomorrow)

1. **Item 05 re-audit** — against `56ef4a0 + 4e99ee0 + 67f703f + <this commit>`. Should be a quick pass; the high-finding is closed by the placement reorder.
2. **Item 01 re-audit** — still outstanding. Packet: `44c5e8b + 20a587d + 0717cc6`; handoff at `2026-05-10-item-01-schema-flags-close.md`.

## Next session should start with

In order:

1. **`git log --oneline -20` and `git status -sb`** — confirm branch state matches this handoff (`67f703f` is the latest source commit; this commit lands the bookkeeping).
2. **Read this handoff** in full (skip the older 2026-05-11 EOD one — this supersedes it). Read `../scope.md` for active-scope refresher.
3. **Run the item-05 re-audit** with the packet above. Decision points:
   - Confirm the reorder behavior matches the checklist's own "after top-3 have claimed their slots" line.
   - Decide whether to accept (move to `done/`) or revise (cite specific concrete behaviour to change).
4. **Run the item-01 re-audit** if you want to close that loop. The bookkeeping artifacts there have already had revisions applied; the audit just hasn't re-passed.
5. **After both audits clear**, move to item 06 (live red "now" bar + on-track cue). The item-02 `currentSlot` derivation in `TodayView` is in place and ready to be a position anchor for the bar.

## Known risks

- **The order-tension flagged in the EOD handoff is now resolved in code.** If audit finds further nuance (e.g., a top-3 must-today task expectations), surface it.
- **`db:push` still pending on the host** — same risk as the EOD handoff: item-01 fields (`userPinned`, `mustBeDoneToday`, `startMinute`) need to be live in the DB before the UI can be exercised in a browser.
- **The earlier EOD handoff's "Pickup-tomorrow checklist" is partly obsolete** — its first audit-queue item ("item 05 first audit") happened today and is now followed up by this audit-response commit. Use this handoff's "Next session should start with" instead.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Confirm `npm run db:push` ran on the host since `44c5e8b`; if not, run it
- [ ] Item 05 re-audit packet: `56ef4a0 + 4e99ee0 + 67f703f + <this commit>`
- [ ] Item 01 re-audit packet: `44c5e8b + 20a587d + 0717cc6` (still pending)
- [ ] After audits clear: item 06 (live "now" bar + on-track cue)
