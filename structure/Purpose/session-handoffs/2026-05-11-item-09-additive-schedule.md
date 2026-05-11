# Session Handoff: item-09-additive-schedule

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (to be assigned for the item-09 audit)

## Active scope

`../scope.md` Active Scope, sequencing item 9 — additive Schedule Today / Schedule Week. Preserve existing blocks across re-presses; explicit Clear Today is the only path back to the backlog. Source commit: `a73c520 feat(schedule+ui): additive Schedule Today/Week + mobile menu visibility` (bundled with item 08).

## Operator decision points (locked before implementation)

1. **Schedule Week:** apply the same additive rule. Both branches are in scope.
2. **No-op behavior:** when zero new blocks are created, surface a neutral info-banner "Nothing new to schedule." (not the red error-banner channel).
3. **Manual-vs-planner conflict:** pack around silently. Existing blocks are immutable survivors; the planner finds the next free slot. No special surface.

## What changed

### `src/app/api/schedule/route.ts`

- **Removed `clearBlocks` calls** from both the `action === 'day'` branch and the `action === 'week'` branch. The import line no longer references `clearBlocks`; `liveBlockFilter` is retained for the unchanged stale-scheduled sweep.
- **Added task-eligibility filter** in each branch. The filter is computed in JS against the already-fetched `survivingBlocks` list rather than a separate DB round-trip:
  - Day branch: a task is ineligible iff it has a non-completed block on `dateStr`. When `dateStr === todayLocalStr`, the block additionally must be in a future :15 slot (mirrors `liveBlockFilter` semantics so already-elapsed slots on today don't gate eligibility).
  - Week branch: a task is ineligible iff it has a non-completed block on a date in `[todayLocalStr, weekEndStr]`. Same future-slot rule for blocks on today.
- The eligibility set is applied AFTER the existing must-today filter so the two compose cleanly: a future-day schedule still strips must-today tasks (per item-05's no-spill rule), then drops anyone with a live block on that day.
- **Response payload now carries `nothingNew: created.length === 0`** so the client can distinguish a successful no-op from a successful placement without re-deriving state.
- The stale-scheduled sweep at lines 74–99 is unchanged — it still handles yesterday's-or-earlier blocks before either branch runs.

### `src/app/page.tsx`

- New state `infoBanner: string | null`, paired helper `reportInfo(message)` with a 4s auto-dismiss (faster than the 6s errorBanner because info is less urgent).
- `handleSchedule` now captures the response from `triggerSchedule` and, when `result?.nothingNew`, calls `reportInfo('Nothing new to schedule.')`.
- New info-banner UI rendered immediately under the existing error banner: `bg-sky-500/[0.10]`, `text-sky-200`, same dismiss-X affordance, visually distinct from the red error channel.

### What was NOT changed

- `clearBlocks` itself in `src/lib/blocks.ts` — still the right primitive for `DELETE /api/blocks?date=...` (the explicit Clear Today button at `src/app/page.tsx`).
- `scheduleDay` and `scheduleWeek` in `src/lib/scheduler.ts` — already correctly handled `existingBlocks` via their `occupied` set and capacity arithmetic. Passing the survivors through (instead of a cleared-state empty list) was a no-code-change-needed integration; the planner does the right thing.
- `rescheduleFromNow` semantics — out of scope per the checklist.
- The stale-scheduled sweep — preserved verbatim.
- Task schema — no `isManual` / `locked` flag; preserving all existing blocks unconditionally is simpler and matches the operator's mental model.

## Design choices flagged for the audit

- **Eligibility filter computed in JS, not via a separate DB query.** The day/week branches already fetch `survivingBlocks` for the planner; filtering in code reuses that data and avoids a second `findMany` per request. The trade-off is a duplicate of `liveBlockFilter`'s logic in inline form. Alternative: refactor `liveBlockFilter` to accept a memory predicate sibling. Not done because the inline duplicate is short and the two predicates are tested implicitly by the same scheduling behavior.
- **"Future :15 slot" comparison uses `>` strictly, not `>=`.** A block whose start equals the current minute is considered already-elapsed and the task is therefore eligible for re-placement. This matches `liveBlockFilter`'s convention (line 53 of `blocks.ts`) and item-07's cascade convention. The :15 grid means this only happens at exact minute boundaries.
- **Info banner is host-level, not view-level.** Lives in `DashboardPage` and renders at the top of the page so any view (today/week/queue/analytics) sees it. Same shape as the error banner. A future expansion could give each view its own toast region; not needed now.
- **No client-side eligibility precheck.** The Schedule Today/Week buttons always POST. If the operator presses with a fully-scheduled day, the server responds in well under a second and the toast appears. Disabling the button client-side would require duplicating the eligibility check in the browser — premature.

## Files touched

Source (commit `a73c520`):

- `src/app/api/schedule/route.ts` — removed `clearBlocks` from day + week branches; added eligibility filter in each; added `nothingNew` to response.
- `src/app/page.tsx` — added `infoBanner` state, `reportInfo` helper, `handleSchedule` checks `nothingNew`, info-banner render.

Item 08's edits (mobile menu) are in the same commit but are tracked separately by their own checklist + handoff.

Bookkeeping (this commit):

- `structure/Purpose/checklists/09-additive-schedule-today.md` — Dev / Out-of-scope / Handoff-readiness rows ticked; behavioral rows marked `[~]` deferred behind the no-rebuild-yet condition.
- `structure/Purpose/session-handoffs/2026-05-11-item-09-additive-schedule.md` — this file.

## Verification state

- `npx tsc --noEmit` — clean for all touched files. The four pre-existing `googleapis` / `google-auth-library` missing-module errors are unchanged and unrelated.
- No tests in repo; no new tests added. `scheduleDay` and `scheduleWeek` are the natural test surfaces if a suite is later introduced; the eligibility filter logic is small and inline enough to test via the route handler.
- **Deferred manual browser exercises** (all behind the rebuild-and-swap blocker, see "Known risks"):
  - Press Schedule Today twice with no new tasks → toast surfaces; zero new blocks; existing blocks unchanged.
  - Manually drag a block (item-07 path), press Schedule Today → block keeps id and position; task does not flip to QUEUED.
  - Add a new task between presses → new task lands in an open slot; existing blocks untouched.
  - Schedule Week with the same shape: re-press preserves; new task fills; nothing-new toast.
  - Conflict: drop a manual block in a prime slot, press Schedule Today with a top-3 task in the queue → top-3 task lands in the next free prime slot (or non-prime if prime is fully occupied).
  - Clear Today → still wipes today's incomplete blocks and reverts their tasks to QUEUED.
  - Stale-scheduled sweep regression: a yesterday-block on an incomplete task gets removed and reset before today's planning.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commit: `a73c520 feat(schedule+ui): additive Schedule Today/Week + mobile menu visibility` (combined with item 08)
- Bookkeeping commit landing this handoff: this commit
- Pushed: yes — the source commit is on origin; this bookkeeping commit will be pushed alongside item-08's bookkeeping.

## Audit packet for item 09

For the Audit Agent pass:

- Code: `a73c520` (only the `route.ts` and `page.tsx` hunks named in "Files touched" above belong to item 09).
- Bookkeeping: this handoff plus the ticked checklist `09-additive-schedule-today.md`.
- Standards: `../../Development/coding-principles.md`; checklist 09's task-specific rows; `../delegation-contract.md` "Bookkeeping Artifact Commit Policy".
- Known verification gap: live-runtime behavioral exercises are deferred behind the rebuild-and-swap blocker. Do not hold against the implementation; flag in the audit response.
- Design choices flagged above are open for revise/accept rather than implicit acceptance.

## Known risks

- **Not yet deployed.** The source change is on origin `docs/add-structure-scaffold` but `timeblock-app` is still running the previously-built image (`sha256:8c3ff2890a4c…`, built 2026-05-11 13:01). A rebuild + swap is required before the operator can exercise the new behavior; per the deployment-task note added in commit `d32f35d`, that smoke must include an in-container Prisma probe and ideally an auth-path probe too.
- **Stale-scheduled sweep interaction.** The sweep resets task status to QUEUED for tasks whose blocks are all stale. After the sweep, those tasks pass through the eligibility filter as eligible (no live block). This is correct — they need to be re-placed. Audit should verify no edge case where a task is double-counted across the sweep and the eligibility filter.
- **Future-day schedule with must-today.** For a future-day schedule, must-today tasks are stripped before eligibility filtering, as before. Audit should verify a must-today task with a live block today is NOT re-placed on a future day (the must-today strip is the gate that prevents this; the eligibility filter is a secondary check).
- **Empty `taskId` blocks.** Blocks without a `taskId` (free-form / manual without a task link) are immutable survivors but don't contribute to the eligibility set. Item-07's manual drag preserves `taskId`, so practically every block today has one. If a future feature adds free-form blocks, they are correctly preserved.

## Next session should start with

1. `git status -sb` and `git log --oneline -20` — confirm branch state.
2. Read this handoff and the item-08 handoff for the full session context (bundled commit).
3. Decide on rebuild + swap (operator-authorized). The new template smoke includes an auth-path probe and a Prisma `SELECT 1` probe; for this change specifically, also exercise: press Schedule Today twice → second press surfaces "Nothing new to schedule" and zero new blocks created.
4. If the audit returns Accept: move `checklists/09-additive-schedule-today.md` to `checklists/done/` in a follow-up Dev commit. Items 08 and 09 close out the active sequencing in `../scope.md`.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator authorizes rebuild + swap for `a73c520`; smoke per deployment-task note (DB probe + auth probe + item-09 behavioral spot-check)
- [ ] Audit Agent runs item-09 audit against `a73c520`'s route.ts + page.tsx hunks; surface accept/revise on the design choices flagged above
- [ ] On accept: move checklist to `done/`; item 09 closes
