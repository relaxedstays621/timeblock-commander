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

Two audit passes were conducted against this work:

- **Pass 1** (against `44c5e8b` plus the then-uncommitted checklist and session handoff): recommendation `Revise`. Findings, severity-ordered:
  - **High (process)** — checklist and session handoff were uncommitted (`M`/`??`) when presented for audit. Audit cannot cite uncommitted bookkeeping durably (working tree can be reset/stashed/overwritten between audit and accept). Surfaced the broader gap; closed by `0717cc6` (new "Bookkeeping Artifact Commit Policy" in `delegation-contract.md`, plus `_template.md` handoff-readiness row and README pointers under `checklists/` and `session-handoffs/`).
  - **Medium (accuracy)** — the task-specific typecheck row was originally ticked `[x]` even though `tsc --noEmit` exited non-zero because of pre-existing `googleapis` / `google-auth-library` missing-module errors. Item-01's own surface compiles cleanly, but the full-repo typecheck is blocked. Closed by `20a587d` (row downgraded to `[~]` with an explanation that names the unrelated modules).
  - **Medium (scope hygiene)** — the out-of-scope guardrails section conflated the commit's evidence with the active working tree, which carried unrelated item-02 drift across `scripts/`, `src/app/api/`, and `src/lib/`. A future reviewer could read working-tree state as part of item 01. Closed by `20a587d` (section now explicitly scopes its evidence to commit `44c5e8b`).
- **Pass 2** (against `44c5e8b` + `20a587d` + `0717cc6`): recommendation `Accept`. All three Pass-1 findings resolved. Two `[~]` partial rows remain documented gaps (full-repo typecheck blocked by unrelated deps; `prisma/seed.ts` runtime not exercised) — accepted as known carry-overs, not blockers.

- [x] findings are ordered by severity and reported before any summary
- [x] each finding is grounded in concrete evidence or labeled as inference
- [x] verification gaps are named (full-repo `tsc --noEmit` blocked by unrelated `googleapis` / `google-auth-library` deps; `prisma/seed.ts` runtime not exercised; live-DB `npm run db:push` on the host unverified — `prisma db pull` currently fails P1000 against user `timeblock`, separate operator action)
- [x] missing tests are identified (no test suite in repo; audit relied on schema inspection, `prisma generate`, and reasoning trace)
- [x] no fixes were implemented unless explicitly reassigned (Dev applied `20a587d` for the checklist findings and `0717cc6` for the process-level finding)
- [x] final recommendation is one of: accept, revise, block — `Accept` on the second pass

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
