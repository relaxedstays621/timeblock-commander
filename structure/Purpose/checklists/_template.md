# Checklist: <task-slug>

Task: <one-line task description>
Scope reference: <link to `../scope.md` or inline scope from the task packet>
Owner: <operator or stakeholder>

## Development Agent done

Standard done criteria from `../roles.md` and `../delegation-contract.md`.

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

Add concrete checks for this task. Examples: commands, files to inspect, behaviors to confirm.

- [ ] <command or file inspection — replace>
- [ ] <observable behavior — replace>
- [ ] <regression check — replace>

## Out-of-scope guardrails

Items the agent must explicitly **not** have done.

- [ ] no edits outside the in-scope paths from `../scope.md`
- [ ] no changes to project state, deployment, or runtime config beyond what the task requires
- [ ] <task-specific exclusion — replace>

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` reflects the current state, if the session is ending
- [ ] git branch and commit are recorded in the handoff
- [ ] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
