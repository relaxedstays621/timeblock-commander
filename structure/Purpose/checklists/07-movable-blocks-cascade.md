# Checklist: 07-movable-blocks-cascade

Task: Blocks are movable via drag/drop on the calendar. Drops snap to :15. When a drop lands on an occupied slot, adjacent blocks cascade later in time rather than being overwritten.
Scope reference: `../scope.md` Active Scope (item 7 of sequencing)
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

- [ ] desktop drag/drop on a block updates start time on drop
- [ ] mobile touch-drag works without jitter on the same component
- [ ] drop coordinates snap to :15 grid
- [ ] dropping onto an occupied slot shifts the affected block(s) later, preserving their order and relative gaps where possible
- [ ] cascade does not push blocks past end-of-day; if it would, those blocks return to the queue/log (unscheduled, derivation per item 03)
- [ ] block move calls a single API endpoint that performs the cascade server-side (not on the client only)
- [ ] no double-write to Google Calendar on a single drop
- [ ] manual test: move a block onto a top-3 prime-hour slot — confirm cascade still respects prime-hour rule (item 04) or rejects with a clear error

## Out-of-scope guardrails

- [ ] no resize handles in this checklist (resize is not in scope)
- [ ] no multi-select drag in this checklist
- [ ] no undo/redo (explicit non-goal in scope.md)

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records the cascade algorithm and the end-of-day overflow behavior
- [ ] git branch and commit are recorded in the handoff
