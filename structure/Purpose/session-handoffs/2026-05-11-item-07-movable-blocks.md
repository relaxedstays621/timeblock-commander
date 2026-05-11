# Session Handoff: item-07-movable-blocks

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (to be assigned for the item-07 audit)

## Active scope

`../scope.md` Active Scope, sequencing item 7 — movable blocks with cascade.

## Work completed

- Implemented drag-to-move in `TodayView` with a left-edge grip per block, server-side cascade with end-of-day overflow handling, and a new `PUT /api/blocks/[id]` endpoint. Source commit: `113987f feat(blocks): drag-to-move with server-side cascade`.
- Updated `checklists/07-movable-blocks-cascade.md`: ticked Dev Agent, Out-of-scope, and Handoff-readiness boxes; ticked most Task-specific rows with evidence; marked rows 2 (mobile jitter) and 8 (prime-hour drop scenario) as `[~]` deferred behind the DB-auth blocker. Audit Agent boxes left blank for the audit pass.

## Implementation summary

### Cascade algorithm (`src/lib/blocks.ts` → `planCascade`)

Pure function. Given the day's blocks and a target slot for the moved block, returns the final placement for every block on the day plus a list of any that overflow past end-of-day.

Order of placement:

1. The moved block lands at the requested slot — operator intent wins.
2. Every other block is processed in original-start-ascending order. Each tries to keep its original slot; if its range overlaps anything already placed, it slides forward to the first non-overlapping position. The slide loops because pushing past one placed block can cause overlap with the next.
3. A block whose final end would exceed `dayEndSlot` (default `21 * 4`) goes into the `unscheduled` list.

Why this shape, not a "shift the whole suffix by the same delta" cascade: simpler to reason about, and the checklist's "preserve relative gaps where possible" allows gap collapse when a push is forced. With this algorithm, a block that has no conflict keeps its slot exactly; only conflict-affected blocks move.

`gridSlotsForDuration` is reused from `scheduler.ts` (newly exported) so a `<=15`-min block reserves 30 minutes of grid space — identical occupancy semantics in the auto-scheduler and the manual cascade. Single source of truth.

### Transactional apply (`src/lib/blocks.ts` → `moveBlockWithCascade`)

Takes the full Prisma client (not a `TransactionClient`) because it owns its own `$transaction`. Inside the transaction:

1. **Delete unscheduled blocks** first — frees their slots.
2. **Two-phase update** for the placed-and-changed blocks. Postgres enforces the `(userId, date, startHour, startMinute)` unique constraint per statement, so writing the placed updates straight to their final slots fails on backward moves (`A: 42→40, B: 40→42` would write `B` to slot 42 before `A` vacates it). Resolved by parking each updated row on a sentinel date (`9999-12-31`) with its FINAL `(startHour, startMinute)` in Phase 1, then moving each back to the real date (changing only `date`) in Phase 2. The cascade plan guarantees the final `(hour, minute)` pairs are pairwise unique, so no Phase-1 statement collides on the sentinel; the cascade also guarantees moved blocks' final positions are disjoint from the unchanged ones, so no Phase-2 statement collides on the real date. Landed in `31658b2`.
3. **Revert tasks** of unscheduled blocks from `SCHEDULED`/`IN_PROGRESS` to `QUEUED` — mirrors the existing `clearBlocks` pattern.

The "moved block can't fit at all" case is detected via `plan.unscheduled.some(u => u.id === movedId)` before the transaction starts; the function throws and the API route returns 409 rather than silently unscheduling the operator's drop target.

History note: the initial implementation in `113987f` used a reverse-new-slot-order trick that breaks on backward moves; the audit's `Block` finding called it out and the two-phase fix in `31658b2` resolves it. `DEFERRABLE INITIALLY DEFERRED` on the constraint was considered as an alternative but rejected because it would require a schema migration. Delete-and-recreate was rejected because it loses `block.id`.

### API endpoint (`src/app/api/blocks/[id]/route.ts`)

`PUT /api/blocks/[id]` with body `{ startHour: 0..23, startMinute: 0|15|30|45 }`. Zod refuses any other minute value at the boundary. Ownership is checked inside `moveBlockWithCascade` (the `findFirst` requires both id and userId).

Error mapping:

- `Block not found` → 404
- `Move would push the block past end-of-day` → 409
- Anything else → 500

The endpoint does not touch `gcalEventId` and does not call `/api/calendar`. Calendar reconciliation remains an explicit user action, so a single drop produces no Google Calendar write.

### Client interaction (`src/app/page.tsx` → `TodayView`)

- Each non-completed block now renders a left-edge `⋮⋮` grip (`cursor-grab` / `active:cursor-grabbing`, `touch-action: none`).
- Pointerdown on the grip installs window-level `pointermove`/`pointerup`/`pointercancel` listeners. Drag mode activates only after the pointer moves more than 5px (DRAG_THRESHOLD_PX), so a stray tap on the grip never moves anything.
- During drag the block dims to opacity 0.4; a green snap-line shows the target slot inside the timeline container (same absolute-positioning context as item-06's now-bar, at a higher z-index).
- Snap math: `slotDelta = Math.round(dy / SLOT_PX)`; candidate slot is clamped to `[dayStartSlot, dayEndSlot - durSlots]` so a block cannot drag above the visible day or past 9pm.
- On `pointerup`: if `snappedSlot !== origSlot`, the client calls `onMoveBlock` (which routes through `DashboardPage.handleMoveBlock` → `moveBlock(...)` → `refreshAll()`). If the server reports `unscheduled.length > 0`, the existing error-banner channel surfaces "N block(s) didn't fit and were returned to the queue."

The grip is a separate child of the block flex row, not the block container. This keeps the existing onClick handlers on the title/buttons unaffected — pointerdown that starts on the grip is never followed by a synthetic click on the title, so no click-suppression is needed.

### WeekView

Untouched. The week view shows summary cards with no per-minute grid, so drag-to-move is not a useful affordance there. If a future requirement asks for week-level drag, it is a separate item.

### Files touched

Source (commit `113987f`):

- `src/lib/scheduler.ts` — exported `gridSlotsForDuration` (one-character change: added `export`).
- `src/lib/blocks.ts` — added `planCascade` (pure) and `moveBlockWithCascade` (transactional). Both fully commented in the same audit-trail style used by `scheduler.ts`.
- `src/app/api/blocks/[id]/route.ts` — new file. PUT handler with Zod body validation.
- `src/hooks/useApi.ts` — added `moveBlock(id, h, m)` and exported `MoveBlockResponse` type.
- `src/app/page.tsx` — added `moveBlock` import, `handleMoveBlock` in `DashboardPage`, drag state and pointerdown handler in `TodayView`, grip element on each block, dim-while-dragging style, and the green snap-target preview line.

Bookkeeping (this commit):

- `structure/Purpose/checklists/07-movable-blocks-cascade.md` — Dev / Task-specific / Out-of-scope / Handoff-readiness boxes ticked with evidence; rows 2 and 8 marked `[~]` deferred.
- `structure/Purpose/session-handoffs/2026-05-11-item-07-movable-blocks.md` — this file.

## Design choices flagged for the audit

- **Manual drop respects operator intent, not item 04's prime-hour rule.** The checklist's "manual test … respects prime-hour rule OR rejects with a clear error" was resolved as: honor the drop, do not reject. Rationale: a manual drag is explicit operator authority; the cascade itself prevents overwrites and overflow returns to the queue; the auto-scheduler restores item-04 ordering on Reschedule. If the audit wants the opposite (reject non-eligible drops into prime), that is a revise.
- **"Where possible" gap preservation is interpreted as "no proactive shifts."** Blocks with no direct conflict keep their original slots exactly. Blocks pushed by a conflict slide only as far as needed, which can collapse a previously-existing gap. The alternative — shift the whole suffix by the same delta to preserve all inter-block gaps — was rejected as more surprising ("moving one block shifts my whole afternoon").
- **`prisma db pull` formatting leak avoided.** During the session, `prisma db pull --print` (which failed P1000) appears to have left `prisma/schema.prisma` re-formatted in the working tree. That unrelated diff was reverted with `git checkout HEAD --` before the item-07 source commit, so `113987f` does not carry schema churn. Worth a note in case future sessions see the same artifact.

## Verification state

- `npx tsc --noEmit` — clean for all touched files (`scheduler.ts`, `blocks.ts`, `app/api/blocks/[id]/route.ts`, `hooks/useApi.ts`, `app/page.tsx`). The four pre-existing `googleapis` / `google-auth-library` missing-module errors are unchanged and unrelated.
- `npx prisma generate` — not run this session; no schema changes in item 07.
- No tests in repo; no new tests added. The `planCascade` function is the most testable surface; if a test suite is later introduced, that is the natural first target.
- **Deferred manual browser exercises:**
  - Desktop drag: pick up a block by its grip, drag to a free slot, drop → confirm PUT fires and block lands at the snapped slot.
  - Mobile touch-drag: same scenario on a touchscreen → confirm no page scroll on the grip, no jitter.
  - Cascade collision: drop block A onto block B's slot → confirm B slides forward, gap-collapse behavior matches expectation.
  - End-of-day overflow: drop a 60-min block at 8:45pm → expect 409 ("move would push past end-of-day"). Drop a block that cascades others past 9pm → expect them to land in queue with the "didn't fit" notice.
  - Calendar sync: do a drag, do not click the calendar push → expect no Google Calendar write.
  - Prime-hour scenario: drop a non-top-3 block at 10am → confirm it lands at 10am (no rejection) per the design choice above.
- All deferred exercises share the same blocker: the running app cannot reach the DB because `.env`'s `DATABASE_URL` password does not match the DB user's actual password. P1000 surfaced from `prisma db pull` earlier this session.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commit: `113987f feat(blocks): drag-to-move with server-side cascade`
- Bookkeeping commit: this commit
- Pushed: no — branch is 32+ ahead of origin and has not been pushed this session.

## Audit packet for item 07

For the Audit Agent pass:

- Code: `113987f` + `31658b2` (fix for the unique-constraint Block)
- Bookkeeping: `ab2d737` + this follow-up commit
- Standards: `../../Development/coding-principles.md`; checklist 07's task-specific rows; `../delegation-contract.md` "Bookkeeping Artifact Commit Policy".
- Known verification gap (do not hold against the implementation): manual desktop/mobile drag exercises are deferred behind the DB-credential blocker.
- Design choices flagged above are open for revise/accept rather than implicit acceptance.

## Next session should start with

1. `git status -sb` and `git log --oneline -20` — confirm branch state and that this commit is the bookkeeping tip.
2. Read this handoff and `../scope.md` for active-scope refresher.
3. Run the item-07 audit against the packet above. Decision points:
   - Accept or revise on the "manual drop bypasses item 04 prime rule" choice.
   - Accept or revise on the "no proactive gap preservation" choice.
   - Verify the reverse-new-slot-order claim by reading `moveBlockWithCascade` against the trace in this handoff.
4. If `Accept`: move checklist 07 to `checklists/done/` in a follow-up Dev commit. Start item 08 (mobile-menu-visibility) — the final sequencing item.
5. If `Revise`: apply the fixes in follow-up commits per the bookkeeping artifact commit policy.
6. **Independent of the audit:** operator still needs to repair the DB credential mismatch so all the deferred manual exercises (items 01, 05, 06, 07) can run.

## Known risks

- **DB-credential mismatch still open.** Blocks live-DB verification for items 01, 05, 06, 07. Operator action required.
- **Concurrent drags.** No locking. If the user drags two blocks at once on two devices, the second move's `findMany` may see a stale state. Practical impact: a rare race that leaves one cascade out of date; the next refresh corrects it. Not addressed in this commit.
- **Long-running drags.** `pointermove`/`pointerup` are global listeners installed per drag; if a drag is interrupted by a tab switch or modal, `pointercancel` fires and the drag closes cleanly. Tested only via reasoning.
- **`unscheduled` notice is surfaced through the error-banner channel.** That channel is for errors; a soft "blocks returned to queue" notice arguably belongs in a distinct info banner. Not fixed in this commit; flagged for future polish.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator fixes DB-credential mismatch so item-01/05/06/07 manual checks can run
- [ ] Audit Agent runs item-07 audit against `113987f` + this commit; surface accept/revise on the two design choices flagged above
- [ ] On accept: move `checklists/07-movable-blocks-cascade.md` to `checklists/done/`; start item 08 (mobile-menu-visibility)
