# Checklist: 06-live-now-bar

Task: Render a horizontal "now" bar across the daily calendar showing current time. Color cues whether the operator is on track relative to the current block.
Scope reference: `../scope.md` Active Scope (item 6 of sequencing)
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

- [ ] day view renders a horizontal bar at the operator-local current time
- [ ] bar updates at least every 60 seconds without a full re-render of the calendar grid
- [ ] bar color is red by default; switches to green-ish or neutral when the operator is on or ahead of pace
- [ ] "on track" rule documented in code: green if `now <= currentBlock.expectedEnd`, red if `now > currentBlock.expectedEnd`
- [ ] when there is no block currently in progress, bar is shown but on-track color is neutral
- [ ] bar is hidden on past or future days in the week view, or rendered only on today's column
- [ ] no memory leak from the timer (cleanup on unmount)

## Out-of-scope guardrails

- [ ] no scheduler logic changes
- [ ] no schema changes
- [ ] no Google Calendar push for "now" state
- [ ] no notification or alert system tied to the bar — it is a visual cue only

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records the timer choice and the on-track rule
- [ ] git branch and commit are recorded in the handoff
