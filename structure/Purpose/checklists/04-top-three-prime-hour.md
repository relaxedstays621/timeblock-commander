# Checklist: 04-top-three-prime-hour

Task: Top-3 by composite score claim prime-hour slots (8am–12pm). User-pinned tasks force composite score to 100 so they always lead the top-3 and always claim prime hours.
Scope reference: `../scope.md` Active Scope (item 4 of sequencing)
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

- [ ] `calculateScore` returns 100 when `task.userPinned === true` (early return; other components still compute for diagnostics if useful, but the returned value is 100)
- [ ] `selectTop3` continues to apply the company-spread heuristic, with pinned tasks naturally rising due to score
- [ ] scheduler places top-3 into prime hours (8am–12pm operator-local) before any other tasks
- [ ] non-top-3, non-pinned tasks are excluded from prime-hour placement when prime is full
- [ ] when more than 3 tasks are pinned, all of them claim prime hours up to capacity, then overflow goes to non-prime
- [ ] unit-level reasoning trace: a pinned reactive task still scores 100 (pin overrides reactive penalty)

## Out-of-scope guardrails

- [ ] no change to the must-be-done-today placement rule (item 05 owns that)
- [ ] no change to drag/drop behavior (item 07)
- [ ] no UI changes beyond surfacing the pin state on the capture form
- [ ] composite-score formula for non-pinned tasks is unchanged

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records the score override and prime-hour rule
- [ ] git branch and commit are recorded in the handoff
