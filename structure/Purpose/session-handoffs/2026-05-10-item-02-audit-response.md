# Session Handoff: item-02-audit-response

Session date: 2026-05-10
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (whichever model ran the item-02 audit against `3e48962`; control-plane row still reads `<fill per project>`)

## Active scope

`../scope.md` Active Scope, sequencing item 2. This handoff covers the Development Agent's response to the Audit Agent's `Block` recommendation against `3e48962`.

## Audit findings (verbatim summary)

1. **High** — Schedule Today and Schedule Week did not enforce "day starts on the next :15" for today. The clamp existed in `rescheduleFromNow` but was not passed by `'today'` / `'week'` branches of `/api/schedule`. Result: pressing Schedule Today at 9:42 could land a block at 9:00.
2. **Medium** — "All generated block start and end times are :15-aligned" was only partially enforced. Starts were aligned by slot math; durations were persisted unchanged from `task.estimatedMinutes`, which `schemas.ts` accepts as any integer 5..480. A 20-min task produced a 9:00–9:20 block, violating the :15 end-time rule.

Audit also confirmed scope-adjacency edits in `calendar/route.ts`, `migrate-user.ts`, and `timezone.ts` as legitimate schema-consumer updates, and confirmed the bookkeeping commit `3e48962` was citeable.

## Fixes applied

Commit: `628e6b0 fix(scheduler): address item-02 audit findings 1 + 2`

### Finding 1
- `src/app/api/schedule/route.ts`: added `earliestStartSlotForToday = Math.ceil((currentHour*60 + currentMinute) / 15)` at the top of the transaction, alongside the existing `currentHour` / `currentMinute` derivation.
- `'week'` branch (`schedule/route.ts:191`): passes `earliestStartSlotForToday` into `scheduleWeek`. `scheduleWeek` already applies the clamp only to whichever iterated day equals today.
- `'day'` (else) branch: passes the clamp to `scheduleDay` only when `dateStr === todayLocalStr`. Future-day schedules fall back to `config.dayStart`.
- `'reschedule'` branch: unchanged — already routed the clamp via `rescheduleFromNow`.

### Finding 2
- `src/lib/scheduler.ts`: introduced `alignedDuration = Math.ceil(task.estimatedMinutes / SLOT_MIN) * SLOT_MIN` inside `scheduleDay`. The daily-capacity check uses the aligned value; the persisted `ScheduleSlot.durationMinutes` is the aligned value. `task.estimatedMinutes` on the Task itself is untouched.
- A 15-min task continues to store duration 15 (already aligned) while reserving 2 grid slots (the existing visual breathing-room rule). A 20-min task now stores 30. End-time = start + alignedDuration is :15-aligned by construction.

## What was NOT changed

- `schemas.ts` was not modified. Tasks can still be captured with non-:15-multiple `estimatedMinutes` (e.g., 20, 25, 35). The snap happens at block-generation time. Trade-off: a user-entered 20-min task results in a 30-min block, which is visible in the block label. Argued in the commit body as truth-preserving for the user input while enforcing the scope's block-side contract.
- Existing TimeBlock rows in the DB with non-:15 durations are not migrated. The scope contract is about *generation*; historical data is out of scope. Flag separately if the operator wants a one-off migration.
- The two checklist deferrals (manual browser visual check, DST-boundary exercise) remain deferred. Neither was raised by the audit, so they continue to wait on operator runtime exercise before final accept.

## Files touched

Source (commit `628e6b0`):

- `src/app/api/schedule/route.ts` — `earliestStartSlotForToday` derivation; threaded into `'week'` and `'day'` branches.
- `src/lib/scheduler.ts` — `alignedDuration` computed once per task; used by capacity check and as persisted `durationMinutes`.

Bookkeeping (this commit, after handoff write):

- `structure/Purpose/checklists/02-fifteen-min-grid.md` — task-specific items 1 and 2 evidence updated to cite `628e6b0` and explain the fix.
- `structure/Purpose/session-handoffs/2026-05-10-item-02-audit-response.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- No tests in the repo to run.
- Deferred (unchanged from prior handoff): manual browser visual check, DST-boundary exercise.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Audit-response source commit: `628e6b0 fix(scheduler): address item-02 audit findings 1 + 2`
- Prior item-02 commits the audit cited: `425ef49`, `9ca42f3`, `3e48962`
- Pushed: unknown (not checked this session)

## Next session should start with

- **Audit Agent re-pass:** read this handoff, then re-audit commits `425ef49 + 9ca42f3 + 3e48962 + 628e6b0` against `../checklists/02-fifteen-min-grid.md`. If both findings are now satisfied and the deferrals are acceptable to defer, the recommendation can move from Block to Accept (or Revise, if remaining gaps are surfaced). On accept, move the checklist to `../checklists/done/`.
- **Operator:** before final accept, exercise the deferred manual visual check and (if practical) the DST-boundary run.
- **If continuing development:** the next sequencing item is `../checklists/03-scheduled-status-derived.md`.

## Known risks

- The "20-min task becomes a 30-min block" trade-off may surprise users. If feedback says the snap should happen at input instead of at scheduling, the fix is to also snap `estimatedMinutes` in `schemas.ts` / the task POST handler. Item-04 or item-05 may be a natural place to revisit.
- `scheduleWeek`'s today-detection still uses `startOfDay(date).getTime() === todayStart.getTime()` with server-local `new Date()` — same TZ-edge concern noted in the prior handoff. Audit did not flag it; deferring to a separate item.
