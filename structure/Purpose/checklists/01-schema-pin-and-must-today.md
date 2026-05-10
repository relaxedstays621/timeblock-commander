# Checklist: 01-schema-pin-and-must-today

Task: Add `userPinned` and `mustBeDoneToday` boolean flags to the Task model. Foundation for items 04 and 05.
Scope reference: `../scope.md` Active Scope (item 1 of sequencing)
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

- [x] `prisma/schema.prisma` Task model has `userPinned Boolean @default(false)` and `mustBeDoneToday Boolean @default(false)` — confirmed at `prisma/schema.prisma:129-130`
- [x] equivalent SQL produced via `npx prisma migrate diff --from-schema-datamodel <prev> --to-schema-datamodel prisma/schema.prisma --script` and reviewed in the audit handoff — recorded in commit `44c5e8b`
- [x] deployment plan documented: applied via `npm run db:push` on the host (this repo uses db push, not committed migrations; see scope decision) — recorded in commit `44c5e8b` body
- [x] `npx prisma generate` succeeds — re-verified this session
- [~] type imports across `src/lib/` still compile (`tsc --noEmit`) — typecheck is currently **blocked** by pre-existing missing-module errors for `googleapis`/`google-auth-library` in `src/app/api/calendar/route.ts` and `src/lib/google-calendar.ts`, so `tsc --noEmit` exits non-zero. These errors are unrelated to item 01: `calculateScore` and the item-01 schema fields type-check cleanly, and no item-01 surface is touched by the failing modules. Full repo typecheck remains broken until those dependencies are installed or removed from the type-check surface.
- [x] no existing `calculateScore` callers break (boolean fields default to false, score unchanged for legacy rows) — `src/lib/scoring.ts:10-40` does not reference new fields
- [~] seed file (`prisma/seed.ts`) still runs without changes — file unmodified since initial commit and does not reference new fields; runtime not exercised this session

## Out-of-scope guardrails

Evidence scope for this section: **commit `44c5e8b` only**. Item 01 is being accepted by commit, not by working tree. The active workspace currently has unrelated modifications in `scripts/`, `src/app/api/`, and `src/lib/` from in-progress item-02 work; those are tracked separately and are not part of item-01 evidence.

- [x] no scoring-formula change in this checklist (item 04 owns that) — `src/lib/scoring.ts` not in `44c5e8b`
- [x] no scheduler placement change in this checklist (items 04 and 05 own that) — scheduler files not in `44c5e8b`
- [x] no UI changes in this checklist (capture-form pin/today toggles belong in items 04 and 05) — no `src/app/` or `src/components/` files in `44c5e8b`
- [x] no edits outside `prisma/` and the generated client — commit `44c5e8b` touched only `prisma/schema.prisma` and `structure/Purpose/checklists/01-schema-pin-and-must-today.md` (the checklist itself, which is bookkeeping, not project code). True for the commit; **not** true for the active working tree, which has unrelated item-02 drift.

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` reflects the migration state and any pending follow-ups — see `2026-05-10-item-01-schema-flags-close.md`
- [x] git branch and commit are recorded in the handoff
