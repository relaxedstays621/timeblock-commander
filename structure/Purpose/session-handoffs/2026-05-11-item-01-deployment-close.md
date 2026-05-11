# Session Handoff: item-01-deployment-close

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (no audit needed for this deployment-only step)

## Active scope

Closes the deployment carry-over that earlier item-01 / item-05 / item-06 / item-07 handoffs all named: `npm run db:push` had not been applied on the host. The schema has been live as source since `44c5e8b`; this session brings the DB in sync.

## What happened

Operator authorized a one-time scope grant to use `DATABASE_URL` from `.env` for Prisma commands after resetting the DB user's password to match `.env` (closes the P1000 auth blocker noted in `2026-05-11-item-05-audit-response.md` and every handoff since).

1. `npx prisma db pull` succeeded; auth works.
2. `db pull` produced a real schema drift diff (DB was missing `Task.userPinned`, `Task.mustBeDoneToday`, `TimeBlock.startMinute`, and the new `TimeBlock @@unique([userId, date, startHour, startMinute])`) plus the cosmetic reintrospection noise that Prisma's `db pull` always emits against a hand-maintained schema (`@db.Text` drops, comment loss, field-order shuffle, enums at file end).
3. Per operator instruction (stop on diff), `schema.prisma` was reverted to `HEAD` and the drift was reported.
4. Operator authorized "Option 2": push, accept that re-introspection noise is not a real diff, do not re-run `db pull` to verify.
5. `npx prisma db push` (no flag) refused with one structural-conservatism warning about adding the new unique constraint.
6. Pre-flight: `SELECT "userId","date","startHour", COUNT(*) FROM "TimeBlock" GROUP BY 1,2,3 HAVING COUNT(*) > 1;` returned **(0 rows)** — no existing duplicates, so the new unique cannot fail on backfill. Operator authorized `--accept-data-loss` for this single push on the empirical evidence.
7. `npx prisma db push --accept-data-loss` succeeded: "Your database is now in sync with your Prisma schema. Done in 110ms." Prisma Client regenerated.

## Verification — direct DB inspection (not `db pull`)

`docker exec timeblock-db psql -U timeblock -d timeblock -c '\d "Task"'` confirmed:

- `userPinned   | boolean | not null | false`
- `mustBeDoneToday | boolean | not null | false`

`docker exec timeblock-db psql -U timeblock -d timeblock -c '\d "TimeBlock"'` confirmed:

- `startMinute     | integer | not null | 0`
- `TimeBlock_userId_date_startHour_startMinute_key UNIQUE, btree ("userId", date, "startHour", "startMinute")`
- `TimeBlock_taskId_fkey ... ON DELETE SET NULL` — matches schema's `onDelete: SetNull`.

All four expectations confirmed.

`db pull` was intentionally **not** re-run for step 4 of the operator's verification plan: the reintrospection style (`@db.Text` loss, field-order shuffle, etc.) would have produced cosmetic diff that is not real drift. The direct psql `\d` inspection above is the substitute and is sufficient evidence.

## Files touched

- `prisma/schema.prisma` — touched twice during the session (once by `db pull`, once by `git restore`); final state matches `HEAD`. **Not** in this commit.
- `structure/Purpose/session-handoffs/2026-05-11-item-01-deployment-close.md` — this file. The only artifact landed by this commit.

## Carry-overs closed by this push

The following deferred-manual-exercise items were all blocked by the DB-credential mismatch in earlier handoffs:

- Item 01 — `npm run db:push` pending on host. **Closed by this session.**
- Item 05 — manual browser exercise of must-today placement (non-pinned at 9am, pinned + must-today). **Unblocked.**
- Item 06 — green/red on-track color exercise of the live-now bar. **Unblocked.**
- Item 07 — drag/drop, cascade, end-of-day overflow, mobile touch, prime-hour drop. **Unblocked.**

These exercises are now operator-driven. The dev side of each item is already accepted and archived under `checklists/done/`; running the exercises is post-accept validation, not a re-open of any audit.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Branch SHA at time of push (HEAD before this commit): `b4a21a6 docs(purpose): accept item 07 and archive checklist`
- Bookkeeping commit landing this handoff: this commit
- Pushed to origin: yes, branch is in sync with `origin/docs/add-structure-scaffold` (was pushed earlier this session after item 07 archive; this handoff will need a separate push if remote tracking matters)

## Known risks

- **Cosmetic-noise floor.** Any future `prisma db pull` against this DB will reintroduce the same `@db.Text` / comment / field-order noise documented above. That is not real drift; do not auto-revert future schema work because of it. Use `prisma migrate diff --from-url ... --to-schema-datamodel ...` for non-destructive drift detection going forward.
- **`--accept-data-loss` precedent.** This push used the flag with empirical justification (zero duplicates pre-check). Future schema work should not treat this as a blanket precedent — re-evaluate each warning on its own.
- **No migration history.** This project uses `db push`, not committed migrations (recorded scope decision). The audit trail for "what got applied when" lives in handoffs like this one, not in `prisma/migrations/`. If the project later moves to migrations, an initial baseline migration should be generated from the current live state.

## Next session should start with

1. `git status -sb` and `git log --oneline -20`.
2. If continuing development: read `../scope.md` and pick up item 08 (mobile-menu-visibility), the only active checklist remaining.
3. The deferred manual browser exercises for items 01 / 05 / 06 / 07 are now operator-runnable; not Dev Agent work, but the operator may surface findings that become new Dev tasks.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Optionally push this commit to origin
- [ ] If starting item 08: open `../checklists/08-mobile-menu-visibility.md`
- [ ] Operator-side: run the deferred manual browser exercises for items 01 / 05 / 06 / 07 now that the DB is live with the full schema
