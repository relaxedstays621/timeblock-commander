# Checklist: 03-scheduled-status-derived

Task: A task is considered "scheduled" only when it has at least one block on today's or this week's calendar. Status becomes derived per query, not stored.
Scope reference: `../scope.md` Active Scope (item 3 of sequencing)
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

Evidence scope for this section: commits `a27eec2` and `39c59a0`.

- [x] task list query computes "scheduled" by checking blocks for today or this week (operator-local time) — `src/app/api/tasks/route.ts` GET derives `isScheduled` from a `prisma.timeBlock.findMany` keyed on `taskId IN (...)` and `date BETWEEN weekStart AND weekEnd`, with `weekStart`/`weekEnd` from `startOfWeek`/`endOfWeek` of the user's local today via `toLocalDateString(now, userTz)`
- [x] task with a block this week → shows scheduled — true by construction; the `date BETWEEN weekStart AND weekEnd` filter matches any such block
- [x] task with a block next week → shows unscheduled — `weekEnd` is end-of-this-week (Sunday, weekStartsOn:1); a block dated Monday-next-week is `> weekEnd` and excluded
- [x] task with a block today → shows scheduled regardless of week boundary — today is always inside `[startOfWeek..endOfWeek]` for the same date, so the range check satisfies the rule
- [x] task with no blocks → shows unscheduled — `scheduledTaskIds` is empty for such tasks; `isScheduled` defaults to `false`
- [x] week boundary respects ISO week (consistent with `scoring.ts` `getCurrentWeek`) — both use `weekStartsOn: 1` (Monday) via date-fns; `scoring.ts` uses `getISOWeek`, this route uses `startOfWeek`/`endOfWeek` with the same ISO convention
- [x] no stored `status = SCHEDULED` write paths remain in the codebase, or stored status is documented as separate from the derived flag — the only write path (`src/app/api/schedule/route.ts` `updateMany` after block creation) is removed in `a27eec2`; comments in `schedule/route.ts`, `tasks/route.ts`, and `ui.tsx` document that stored status and the derived flag are separate. Read paths that still mention `SCHEDULED` in `status: { in: [...] }` filters are defensive for legacy rows and are explicitly documented as such. `StatusBadge` (`39c59a0`) additionally normalizes legacy stored `SCHEDULED` with `isScheduled=false` to display as `QUEUED`, so the visible state is never stale

## Out-of-scope guardrails

Evidence scope for this section: commits `a27eec2` and `39c59a0`.

- [x] no schema migration that changes the existing `TaskStatus` enum unless required — `prisma/schema.prisma` `TaskStatus` enum is unchanged; `SCHEDULED` is preserved for backward compatibility with legacy rows. No `db:push` required for item 03
- [x] no UI redesign of the task list beyond the scheduled-flag fix — only changes in `src/app/page.tsx` are: pass `task.isScheduled` to `StatusBadge`, and remove `SCHEDULED` from the manual status dropdown. List layout and styling untouched
- [x] no edits to scheduler placement logic (items 04 and 05) — `src/lib/scheduler.ts`, `scoring.ts`, `blocks.ts` placement logic untouched

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` documents the derivation rule and any caching decisions — see `2026-05-10-item-03-scheduled-derived.md`
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
