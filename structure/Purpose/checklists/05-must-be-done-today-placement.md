# Checklist: 05-must-be-done-today-placement

Task: A task with `mustBeDoneToday = true` is forced into today's schedule but prefers non-prime hours. Capture form gets a "Must be done today" toggle. Displaced tasks are pushed later in the day, and any that no longer fit return to the queue/log unscheduled.
Scope reference: `../scope.md` Active Scope (item 5 of sequencing)
Owner: matthewb621@gmail.com

## Development Agent done

- [ ] requested change is implemented, or the blocker is stated
- [ ] changes are scoped to the stated area
- [ ] unrelated user or runtime changes are preserved
- [ ] existing project patterns are followed
- [ ] verification was run, or not-run status is explained
- [ ] changed files are listed in the handoff
- [ ] residual risks and follow-ups are named

## Audit Agent done

- [ ] findings are ordered by severity and reported before any summary
- [ ] each finding is grounded in concrete evidence or labeled as inference
- [ ] verification gaps are named
- [ ] missing tests are identified
- [ ] no fixes were implemented unless explicitly reassigned
- [ ] final recommendation is one of: accept, revise, block

## Task-specific verification

- [ ] capture form exposes a "Must be done today" toggle, persisted to `mustBeDoneToday`
- [ ] scheduler places `mustBeDoneToday` tasks today, **preferring non-prime hours** unless the task is also `userPinned`
- [ ] when today's non-prime is full, must-today tasks may flow into prime — but only after top-3 have claimed their prime slots
- [ ] when today is fully packed, lower-priority same-day blocks shift later in the day to make room
- [ ] tasks displaced past end-of-day return to the queue/log with no block (status derived as unscheduled per item 03)
- [ ] manual end-to-end test: capture a non-pinned must-today task at 9am, verify it lands after 12pm if non-prime is available
- [ ] manual end-to-end test: capture a pinned + must-today task, verify it lands in prime hours

## Out-of-scope guardrails

- [ ] no change to composite-score formula (item 04 owns the pin override)
- [ ] no change to the 15-min grid behavior (item 02)
- [ ] no calendar-write to Google Calendar beyond what already happens for placed blocks
- [ ] no auto-deferral to tomorrow — overflowed tasks return to queue, not next day, unless user explicitly reschedules

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records the placement preference and displacement rule
- [ ] git branch and commit are recorded in the handoff
