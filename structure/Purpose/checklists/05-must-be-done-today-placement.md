# Checklist: 05-must-be-done-today-placement

Task: A task with `mustBeDoneToday = true` is forced into today's schedule but prefers non-prime hours. Capture form gets a "Must be done today" toggle. Displaced tasks are pushed later in the day, and any that no longer fit return to the queue/log unscheduled.
Scope reference: `../scope.md` Active Scope (item 5 of sequencing)
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

Evidence scope for this section: commits `56ef4a0` and the audit-response fix `67f703f`.

- [x] capture form exposes a "Must be done today" toggle, persisted to `mustBeDoneToday` — `src/components/QuickCapture.tsx` paired toggle inside a "Priority flags" group; payload sends `mustBeDoneToday` to `POST /api/tasks`. Zod accepts the field via the item-04 schema update.
- [x] scheduler places `mustBeDoneToday` tasks today, **preferring non-prime hours** unless the task is also `userPinned` — `src/lib/scheduler.ts` `scheduleDay`: `preferPrime = task.userPinned || (isPrimeEligible && !isMustToday)`. A non-pinned must-today task (with or without top-3 membership) gets `slotOrder = [nonPrime, prime]`; pinned must-today gets `[prime, nonPrime]`.
- [x] when today's non-prime is full, must-today tasks may flow into prime — but only after top-3 have claimed their prime slots — **Audit follow-up (`67f703f`):** placement order reordered to Pass 1 = eligibles (top-3 ∪ pinned, including any must-today members), Pass 2 = must-today-only (must-today AND NOT prime-eligible), Pass 3 = non-eligibles. Eligibles always run first, so a non-pinned must-today task only sees leftover prime in its fallback after Pass 1 has claimed top-3/pinned slots. The earlier order (must-today first) could let a non-pinned must-today preempt a lower-score eligible in prime; that's closed.
- [x] when today is fully packed, lower-priority same-day blocks shift later in the day to make room — must-today's first-pass priority means it claims its preferred slots before lower-priority tasks; lower-priority tasks placing later see the must-today slots already occupied and naturally fill remaining gaps, effectively "shifting later" relative to a no-must-today plan.
- [x] tasks displaced past end-of-day return to the queue/log with no block (status derived as unscheduled per item 03) — when no slot fits, the placement loop simply doesn't push a `ScheduleSlot`; no block row is created; `Task.status` stays QUEUED/BACKLOG; the item-03 derived `isScheduled` flag returns false.
- [~] manual end-to-end test: capture a non-pinned must-today task at 9am, verify it lands after 12pm if non-prime is available — **DEFERRED**; no dev-server run this session. Audit/operator should exercise via browser before final accept.
- [~] manual end-to-end test: capture a pinned + must-today task, verify it lands in prime hours — **DEFERRED**; same as above.

## Out-of-scope guardrails

Evidence scope for this section: commit `56ef4a0`.

- [x] no change to composite-score formula (item 04 owns the pin override) — `src/lib/scoring.ts` is untouched in this commit.
- [x] no change to the 15-min grid behavior (item 02) — slot math (`SLOT_MIN`, `SLOTS_PER_HOUR`, `gridSlotsForDuration`, `alignedDuration`) is unchanged; must-today only changes ITERATION ORDER, not slot geometry.
- [x] no calendar-write to Google Calendar beyond what already happens for placed blocks — `src/app/api/calendar/route.ts` and `src/lib/google-calendar.ts` untouched. Item-05 changes are scheduler/route/UI only; Google sync happens elsewhere on its existing trigger.
- [x] no auto-deferral to tomorrow — overflowed tasks return to queue, not next day, unless user explicitly reschedules — `scheduleWeek` filters must-today out of non-today day iterations so the task cannot land on tomorrow. The route's `'day'` branch on a future date filters must-today out of the task pool entirely.

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records the placement preference and displacement rule — see `2026-05-11-item-05-must-today-and-session-close.md`
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
