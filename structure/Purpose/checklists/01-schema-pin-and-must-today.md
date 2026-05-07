# Checklist: 01-schema-pin-and-must-today

Task: Add `userPinned` and `mustBeDoneToday` boolean flags to the Task model. Foundation for items 04 and 05.
Scope reference: `../scope.md` Active Scope (item 1 of sequencing)
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

- [ ] `prisma/schema.prisma` Task model has `userPinned Boolean @default(false)` and `mustBeDoneToday Boolean @default(false)`
- [ ] equivalent SQL produced via `npx prisma migrate diff --from-schema-datamodel <prev> --to-schema-datamodel prisma/schema.prisma --script` and reviewed in the audit handoff
- [ ] deployment plan documented: applied via `npm run db:push` on the host (this repo uses db push, not committed migrations; see scope decision)
- [ ] `npx prisma generate` succeeds
- [ ] type imports across `src/lib/` still compile (`tsc --noEmit`)
- [ ] no existing `calculateScore` callers break (boolean fields default to false, score unchanged for legacy rows)
- [ ] seed file (`prisma/seed.ts`) still runs without changes

## Out-of-scope guardrails

- [ ] no scoring-formula change in this checklist (item 04 owns that)
- [ ] no scheduler placement change in this checklist (items 04 and 05 own that)
- [ ] no UI changes in this checklist (capture-form pin/today toggles belong in items 04 and 05)
- [ ] no edits outside `prisma/` and the generated client

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` reflects the migration state and any pending follow-ups
- [ ] git branch and commit are recorded in the handoff
