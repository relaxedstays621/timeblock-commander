# Checklist: 03-scheduled-status-derived

Task: A task is considered "scheduled" only when it has at least one block on today's or this week's calendar. Status becomes derived per query, not stored.
Scope reference: `../scope.md` Active Scope (item 3 of sequencing)
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

- [ ] task list query computes "scheduled" by checking blocks for today or this week (operator-local time)
- [ ] task with a block this week → shows scheduled
- [ ] task with a block next week → shows unscheduled
- [ ] task with a block today → shows scheduled regardless of week boundary
- [ ] task with no blocks → shows unscheduled
- [ ] week boundary respects ISO week (consistent with `scoring.ts` `getCurrentWeek`)
- [ ] no stored `status = SCHEDULED` write paths remain in the codebase, or stored status is documented as separate from the derived flag

## Out-of-scope guardrails

- [ ] no schema migration that changes the existing `TaskStatus` enum unless required
- [ ] no UI redesign of the task list beyond the scheduled-flag fix
- [ ] no edits to scheduler placement logic (items 04 and 05)

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` documents the derivation rule and any caching decisions
- [ ] git branch and commit are recorded in the handoff
