# Checklist: 02-fifteen-min-grid

Task: Move scheduling and calendar rendering to a 15-minute grid. Day starts on the next :15. A 15-minute task occupies a 30-minute slot on the grid; otherwise visual height equals actual duration.
Scope reference: `../scope.md` Active Scope (item 2 of sequencing)
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

- [ ] day-start helper rounds the operator's start time up to the next :15 (e.g., 7:42 → 7:45, 7:46 → 8:00)
- [ ] all generated block start and end times are :15-aligned
- [ ] a 15-minute task renders as a 30-minute slot on the grid
- [ ] a 30-minute task renders as a 30-minute slot
- [ ] a 90-minute task renders as a 90-minute slot
- [ ] manual visual check of day view at the operator's local timezone confirms grid lines on every :15
- [ ] week view inherits the same grid without separate logic
- [ ] no DST-boundary regressions on a day with a transition (`local-date.ts` and `timezone.ts` still authoritative)

## Out-of-scope guardrails

- [ ] no scoring or pin-flag changes in this checklist
- [ ] no drag/drop wiring in this checklist (item 07)
- [ ] no live-bar UI in this checklist (item 06)
- [ ] no edits to `auth.ts`, `google-calendar.ts`, or any non-scheduling module

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` reflects the grid state and any unverified DST or timezone risks
- [ ] git branch and commit are recorded in the handoff
