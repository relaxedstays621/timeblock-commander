# Session Handoff: item-03-audit-response

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (whichever model ran the item-03 audit against `7fe1d4c`; control-plane row still reads `<fill per project>`)

## Active scope

`../scope.md` Active Scope, sequencing item 3. This handoff records the response to the Audit Agent's `Block` recommendation against `7fe1d4c`.

## Audit findings (verbatim summary)

1. **High** — `PATCH /api/tasks/:id` could still write `status='SCHEDULED'` because `UpdateTaskSchema` inherited `TaskStatusEnum` which still listed `SCHEDULED`. The Zod validator passed it through to `prisma.task.update`, conflicting with the item-03 contract.
2. **Medium** — `TaskDetailModal` initialized local `status` from `task.status`. A legacy `SCHEDULED` task could round-trip `{ status: 'SCHEDULED' }` back through the API on a no-op Update click, since the dropdown options didn't include `SCHEDULED` but the local state value did.

Audit confirmed all other item-03 surface (scheduler write removal, `GET /api/tasks` derivation, `StatusBadge` display normalization).

## Fixes applied

Commit: `39ff38f fix(tasks): close item-03 audit findings 1 + 2`

### Finding 1
- `src/lib/schemas.ts`: removed `'SCHEDULED'` from `TaskStatusEnum`. `CreateTaskSchema` and `UpdateTaskSchema` both inherit. `PATCH /api/tasks/:id` with `{ status: 'SCHEDULED' }` now fails Zod validation and returns 400. The Prisma `TaskStatus` enum is unchanged so legacy reads still work.

### Finding 2
- `src/app/page.tsx` `TaskDetailModal`: local status state initializes as `task.status === 'SCHEDULED' ? 'QUEUED' : task.status`. A no-op Update click on a legacy SCHEDULED row now submits `{ status: 'QUEUED' }` — valid, and matches the badge's display normalization.

The two fixes are belt-and-braces:
- F1 hard-blocks any client (UI, curl, n8n webhook) from writing SCHEDULED.
- F2 prevents the UI from ever attempting to write it in the first place, sparing the user a confusing 400.

## What was NOT changed

- The Prisma `TaskStatus` enum in `prisma/schema.prisma` still carries `SCHEDULED`. Removing it would be a destructive schema migration; the scope's out-of-scope guardrail explicitly disallows enum migration unless required, and reading legacy rows requires keeping the value.
- Other PATCH callers (`onUpdateTask(task.id, { status: 'DEFERRED' })` in TodayView, hardcoded `status: 'BACKLOG'` on create in QuickCapture) carry safe values; no change needed.
- `clearBlocks` in `src/lib/blocks.ts` still treats stored `SCHEDULED` as one of the resettable statuses. Harmless: legacy rows benefit, new rows never carry the value.

## Files touched

Source (commit `39ff38f`):

- `src/lib/schemas.ts` — `TaskStatusEnum` no longer accepts `'SCHEDULED'`.
- `src/app/page.tsx` — `TaskDetailModal` normalizes legacy `SCHEDULED` local state to `QUEUED` on init.

Bookkeeping (this commit):

- `structure/Purpose/checklists/03-scheduled-status-derived.md` — task-specific item 7 evidence updated to cite `39ff38f` and explain the two write-path closures.
- `structure/Purpose/session-handoffs/2026-05-11-item-03-audit-response.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- `npx prisma generate`: succeeds (audit confirmed).
- No tests in repo.
- Suggested manual exercise: in a fresh dev server, hit `PATCH /api/tasks/<id>` with `{ "status": "SCHEDULED" }` via curl; expect 400 with Zod validation error.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Audit-response source commit: `39ff38f fix(tasks): close item-03 audit findings 1 + 2`
- Prior item-03 commits: `a27eec2`, `39c59a0`, `7fe1d4c`
- Pushed: unknown (not checked this session)

## Next session should start with

- **Audit Agent re-pass:** read this handoff, then re-audit commits `a27eec2 + 39c59a0 + 7fe1d4c + 39ff38f` against `../checklists/03-scheduled-status-derived.md`. On accept, move the checklist to `../checklists/done/`.
- **If continuing development:** the next sequencing item is `../checklists/04-top-three-prime-hour.md` — top-3 + prime-hour placement with the `userPinned = 100` override.
- **Item 01 re-audit** also remains pending against `44c5e8b + 20a587d + 0717cc6`.

## Known risks

- A client (or test) that sent `status: 'SCHEDULED'` to `PATCH /api/tasks/:id` previously would now receive a 400. If there are external integrations (n8n flows, curl scripts in operator workflow) that did so, they would need to be updated to use `'QUEUED'` or to drop the `status` field. Audit noted the potential breakage path; in practice no internal consumer was found, so the surface is narrow.
- The Prisma enum still has `SCHEDULED`. Anything reading status directly (analytics, downstream filters) will continue to see legacy SCHEDULED. The `StatusBadge` normalization plus the derived flag are the user-visible truths.
