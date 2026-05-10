# Session Handoff: item-02-fifteen-min-grid

Session date: 2026-05-10
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

Pulled from `../control-plane.md` at session end.

- Development Agent: claude-opus-4-7
- Audit Agent: unassigned (control-plane row reads `<fill per project>`)

## Active scope

`../scope.md` Active Scope: 2026-05-07 — daily-planning grid + capture overhaul. Sequencing 1–8 in force. This session moved sequencing item 2 to dev-side done.

## Work completed

- Implemented item 02 (15-minute grid) across three commits:
  - `425ef49 feat(scheduler): :15-grid pass 1 — schema, scheduler math, consumers` — schema `startMinute` field + unique-key update, slot-based scheduler math, helpers (`alignToFifteen`, `zonedMinute`), and consumer updates in `liveBlockFilter`, schedule/blocks/calendar routes, and `migrate-user.ts`.
  - `9ca42f3 feat(scheduler+ui): now-aware day-start + :15 grid render` — `scheduleDay`/`scheduleWeek`/`rescheduleFromNow` clamp today's first slot to `Math.ceil((currentHour*60 + currentMinute) / 15)`; `TodayView` renders every :15 slot with proper block/event spans; `WeekView` chips sort and label by `(startHour, startMinute)`.
- Verified `npx tsc --noEmit` is clean for all touched files. Only the pre-existing `googleapis` / `google-auth-library` missing-module errors remain, unrelated.
- Ticked Development Agent and task-specific boxes on `../checklists/02-fifteen-min-grid.md`. Marked "manual visual check" and "DST-boundary check" as `[~]` deferred and surfaced them in the audit handoff.

## Work in progress

- None. Item 02 dev-side scope is complete pending the two deferred verifications and the audit pass.

## Decisions made

- **Block spans use a row-skip pattern, not absolute positioning.** A multi-slot block renders once at its start row with `minHeight = span * 22px`; subsequent rows it covers are simply not rendered (`coveredThrough` counter). Cleaner than overlaying an absolute-positioned grid on top of the row list, and good enough for the visual rule.
- **`:00` rows render "Available", `:15`/`:30`/`:45` rows don't.** Avoids a wall of "Available" labels on quiet days. Empty :15 rows still render the dim minute tick on the left so the grid stays legible.
- **`earliestStartSlotForToday` is a `scheduleWeek` parameter, not a `scheduleDay` one externally.** Callers think in terms of "now"; only the first scheduled day gets the clamp. `scheduleDay` accepts the param too for any direct callers, but only `scheduleWeek` passes it conditionally.
- **Buffer chip stays hour-precise.** The "15m prep before <event>" chip still fires only when the event starts at the top of the hour. Minute-precise buffer placement is out of scope for item 02 and can be picked up later if it becomes a real complaint.
- **Calendar route edit was retained.** `src/app/api/calendar/route.ts` is not in `scope.md`'s primary path list, but `buildEventTimes` consumes `block.startMinute` — without the edit, blocks at `:30` would sync to Google Calendar as `:00`. Treated as a consumer update required to preserve existing behavior, not a feature change. Same justification for `scripts/migrate-user.ts` (broke on new unique key) and `src/lib/timezone.ts` (added `zonedMinute` paralleling `zonedHour`).

## Open questions

- Who/what model is the Audit Agent for item 02? Control-plane row is still `<fill per project>`.
- Should the manual visual check be run by the operator or scripted in a separate verification pass before audit-accept? `scope.md`'s checklist names it as a manual operator check; flagging here for clarity.
- Does the schema change need `npm run db:push` to be run on the host before the live UI is exercised? Almost certainly yes — `startMinute` is required by Prisma client code as of `425ef49`.

## Files touched

Source (in `425ef49` and `9ca42f3`):

- `prisma/schema.prisma` — added `TimeBlock.startMinute` and updated unique key.
- `src/lib/scheduler.ts` — slot-based scheduling math, `ReschedulerNow`, `earliestStartSlotForToday`.
- `src/lib/blocks.ts` — `liveBlockFilter` now :15-aware.
- `src/lib/local-date.ts` — `alignToFifteen` helper.
- `src/lib/timezone.ts` — `zonedMinute` helper.
- `src/app/api/schedule/route.ts` — threads `currentMinute`; persists `slot.startMinute`.
- `src/app/api/blocks/route.ts` — orderBy `[startHour, startMinute]`.
- `src/app/api/calendar/route.ts` — `buildEventTimes` consumes `startMinute` for Google sync.
- `src/app/page.tsx` — :15 grid rendering in `TodayView`, `(startHour, startMinute)` sort/label in `WeekView`, `(startHour, startMinute)` sort in `todayBlocks`.
- `scripts/migrate-user.ts` — new unique-key shape.

Bookkeeping (this commit, after handoff write):

- `structure/Purpose/checklists/02-fifteen-min-grid.md` — Dev Agent + task-specific boxes ticked.
- `structure/Purpose/session-handoffs/2026-05-10-item-02-fifteen-min-grid.md` — this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain (item-01 audit already characterized these as unrelated to in-scope work).
- `npx prisma generate`: succeeds against the schema at HEAD (re-verified during item-01 close; schema is the same shape now plus `startMinute`).
- No tests in the repo to run.
- **Deferred:** manual visual check of `TodayView` at the operator's local TZ in a browser — must be run by the operator before audit-accept. Specifically check: `:15` ticks on every quarter-hour row; 30-min block at 9:00 occupies two slot rows; 90-min block occupies six; 15-min block occupies two (the 30-min slot rule); current-slot highlight follows the `:15` boundary as time advances.
- **Deferred:** DST-boundary exercise. `local-date.ts` and `timezone.ts` DST paths are untouched (additions are purely additive), but no DST-day run was performed.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Latest source commit: `9ca42f3 feat(scheduler+ui): now-aware day-start + :15 grid render`
- Pushed: unknown (not checked this session)

## Next session should start with

- **If Audit Agent is being assigned:** read `../checklists/02-fifteen-min-grid.md`, run the audit against commits `425ef49` and `9ca42f3`, then either move the checklist to `checklists/done/` (on accept) or attach findings (on revise/block). Also re-run the item-01 audit if not yet done — handoff `2026-05-10-item-01-schema-flags-close.md` is still pending audit-accept.
- **If the operator wants to drive the deferred manual checks:** start the Next.js dev server, exercise the day view, confirm the :15 grid and block heights; then run a DST-boundary sanity check by setting the system date to a US DST transition day (e.g., 2026-03-08 or 2026-11-01).
- **If continuing development:** the next sequencing item is `../checklists/03-scheduled-status-derived.md` — derive "scheduled" status from today's/this-week's blocks instead of storing it.
- Files to read first: `../scope.md`, `../checklists/03-scheduled-status-derived.md`, `src/lib/scheduler.ts`, and any session handoff newer than this one.

## Known risks

- **Manual visual check is deferred.** The grid renders without errors at compile time, but layout polish (row alignment of the dim minute tick, multi-slot block padding, current-slot highlight clarity) has not been exercised in a browser. Audit should require this before accept.
- **`startMinute` defaults to 0 for existing rows.** Once `npm run db:push` runs, every existing `TimeBlock` row will have `startMinute = 0`, which is correct for the previous hour-granularity world. No data backfill needed.
- **Server-TZ vs operator-TZ comparison in `scheduleWeek`.** The `isToday` check uses `startOfDay(date).getTime() === todayStart.getTime()` where `todayStart = startOfDay(new Date())` — server-local. If the server's wall clock differs from the operator's local day boundary, `earliestStartSlotForToday` could be applied to the wrong day. The bigger fix (threading `todayStr` through `scheduleWeek`) is deferred — flagging here for audit judgment and a possible item-03+ follow-up.
- **Calendar route consumer change** depends on `startMinute` being present on `TimeBlock`. If `db:push` hasn't run on the host, `block.startMinute` will be `undefined` at runtime and `buildEventTimes` will emit a malformed time string. Operator must run `db:push` before exercising Google sync against the new code.
- **No tests means audit must lean on tsc + manual exercise.** This was already the state pre-item-02; no regression, but worth naming.
