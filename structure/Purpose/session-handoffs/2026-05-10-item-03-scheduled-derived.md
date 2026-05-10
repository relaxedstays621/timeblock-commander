# Session Handoff: item-03-scheduled-derived

Session date: 2026-05-10
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: unassigned (control-plane row still `<fill per project>`)

## Active scope

`../scope.md` Active Scope, sequencing item 3. The dev-side change landed in one commit; bookkeeping in a follow-up.

## Work completed

- Implemented item 03 in `a27eec2 feat(tasks): derive isScheduled flag from blocks-this-week`. Three behaviour changes plus comments:
  1. **Removed the only `status='SCHEDULED'` write path.** `src/app/api/schedule/route.ts` no longer runs `updateMany({data:{status:'SCHEDULED'}})` after block creation. Block creation does not mutate `task.status`.
  2. **Derived `isScheduled` on GET /api/tasks.** `src/app/api/tasks/route.ts` enriches each returned task with `isScheduled = task has >= 1 block in [startOfWeek..endOfWeek]` of the operator's local ISO week. Implementation is two queries: the existing task fetch, plus a single batched `prisma.timeBlock.findMany` keyed on the returned task ids.
  3. **UI consumes the derived flag.** `src/components/ui.tsx` `StatusBadge` accepts an optional `isScheduled` prop; when true and stored status is non-terminal (BACKLOG / QUEUED / SCHEDULED) the badge renders SCHEDULED. Terminal statuses still win. `src/app/page.tsx` passes the flag, and the manual status dropdown in `TaskDetailModal` no longer offers SCHEDULED.
- Ticked Development Agent + task-specific + out-of-scope-guardrail boxes on `../checklists/03-scheduled-status-derived.md`.

## Work in progress

- None. Item 03 dev-side is complete pending audit.

## Decisions made

- **Did not remove `SCHEDULED` from the `TaskStatus` enum.** The scope's out-of-scope guardrail says no enum migration unless required. The dual-state approach (stored status carries legacy SCHEDULED; derived flag is the truth) satisfies the checklist's "stored status is documented as separate from the derived flag" branch.
- **Range is `[startOfWeek..endOfWeek]` of today's local date.** Today is always inside that range, so the "block today regardless of week boundary" rule is implicit; no special-case needed.
- **Terminal statuses win over the derived flag.** A task with `status=COMPLETE` and a block this week would show `Complete`, not `Scheduled` — once it's done it's done. Only non-terminal statuses (BACKLOG / QUEUED / SCHEDULED) flip to SCHEDULED when `isScheduled` is true.
- **Caching: none.** The derivation runs per request on `GET /api/tasks`. Two queries per request. If list size grows large enough that this becomes hot, a Set computed once per request is still cheap; further caching can wait.
- **No data migration.** Legacy rows with `status=SCHEDULED` remain. Reads still tolerate them (see the read-path filters in `schedule/route.ts`); writes won't produce them. Operator can sweep them to `QUEUED` later if desired.

## Open questions

- Should `GET /api/tasks/[id]` also include `isScheduled`? Skipped this session because the existing UI consumer reads the flag from the list, not from the single-task fetch. Easy to add if a future consumer needs it.
- Is the audit-write path inside the scheduler's transaction (`updateMany` removal) safe? See "Known risks" below.

## Files touched

Source (commits `a27eec2` and `39c59a0`):

- `src/app/api/tasks/route.ts` — GET enriches each task with derived `isScheduled`.
- `src/app/api/schedule/route.ts` — removed the `updateMany({data:{status:'SCHEDULED'}})` after block creation.
- `src/components/ui.tsx` — `StatusBadge` accepts and honors `isScheduled`; legacy stored `SCHEDULED` with no block this week normalizes to QUEUED at display time.
- `src/app/page.tsx` — `<StatusBadge ... isScheduled={task.isScheduled} />` in the queue row; `TaskDetailModal` dropdown no longer lists `SCHEDULED`.

Bookkeeping (this commit):

- `structure/Purpose/checklists/03-scheduled-status-derived.md` — Dev Agent + task-specific + out-of-scope-guardrail boxes ticked with evidence per box.
- `structure/Purpose/session-handoffs/2026-05-10-item-03-scheduled-derived.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- No tests in the repo to run.
- **Deferred:** manual exercise in a browser of the four checklist scenarios (block-this-week / block-next-week / block-today / no-blocks). Operator can confirm via the queue view.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commits: `a27eec2 feat(tasks): derive isScheduled flag from blocks-this-week`, `39c59a0 feat(ui): StatusBadge normalizes legacy SCHEDULED to QUEUED`
- Pushed: unknown (not checked this session)

## Next session should start with

- **Audit Agent:** read this handoff, then audit `a27eec2` against `../checklists/03-scheduled-status-derived.md`. Areas to scrutinize: the `weekStart`/`weekEnd` derivation when the user's timezone differs from the server's (we trust the existing `toLocalDateString` pattern); the terminal-status-wins rule in `StatusBadge`; whether removing the `updateMany` causes any second-pass scheduler logic that depended on `status='SCHEDULED'` to mis-classify (the schedule/route.ts comment at line 51 says the literal status is deliberately not the source of truth, so this should be safe).
- **If continuing development:** the next sequencing item is `../checklists/04-top-three-prime-hour.md` — top-3 + prime-hour placement, with the `userPinned = 100` override.

## Known risks

- **Second-pass scheduler invariants.** `schedule/route.ts` previously set `status='SCHEDULED'` after block creation. Several downstream filters use `status: { in: ['QUEUED', 'BACKLOG', 'SCHEDULED'] }` — defensive for legacy rows but also reading the value the now-removed write produced. After this commit, newly-created blocks leave their tasks in `QUEUED` or `BACKLOG`. The `freshTasks` refetches inside the transaction (`schedule/route.ts:175` and `:198`) include both, so the planner still sees them. Audit should confirm no other code path relied on `status='SCHEDULED'` post-creation.
- **`clearBlocks` SCHEDULED→QUEUED reset.** `src/lib/blocks.ts:90` still resets task status from `SCHEDULED`/`IN_PROGRESS` to `QUEUED` when a block is cleared. Post-item-03 new tasks won't be SCHEDULED, so this branch becomes a no-op for new data. Harmless but redundant for the future; can be tidied in a later cleanup pass.
- **Timezone for `weekStart`/`weekEnd`.** Uses the existing `toLocalDateString` + `startOfWeek` pattern. Same TZ-edge consideration noted in item 02 handoffs (server vs. operator midnight). Not a regression — same pattern as the scheduler — but worth flagging.
- **Legacy `SCHEDULED` rows are normalized at display time.** A task with `status=SCHEDULED` and no block this week now renders as `QUEUED` in the badge (see `StatusBadge` in `ui.tsx` — non-terminal stored statuses defer to the derived flag, and stored `SCHEDULED` with `isScheduled=false` falls back to `QUEUED`). The DB row is untouched; only the visual representation is normalized. Operator can still sweep legacy rows to `QUEUED` if they want the DB to match the displayed truth.
