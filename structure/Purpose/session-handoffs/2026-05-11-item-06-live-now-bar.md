# Session Handoff: item-06-live-now-bar

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (to be assigned for the item-06 audit)

## Active scope

`../scope.md` Active Scope, sequencing item 6 — live red "now" bar plus on-track cue, anchored on the item-02 `currentSlot` derivation in `TodayView`.

## Work completed

- Implemented the live "now" bar in `TodayView` and the on-track color rule. Source commit: `c4d79ac feat(ui): live-now bar with on-track cue in TodayView`.
- Updated `checklists/06-live-now-bar.md`: ticked Development Agent, Task-specific, Out-of-scope, and Handoff-readiness boxes with evidence; left Audit Agent boxes blank for the audit pass.

## Implementation summary

### Timer choice

The bar reuses the top-level `now` state in `DashboardPage` (`src/app/page.tsx`), which is updated by an existing `setInterval(setNow, 60_000)` registered inside a `useEffect` that returns `clearInterval`. Item 06 adds **no new timer** and creates **no new cleanup obligation**. This was a deliberate choice over a `TodayView`-local timer: a second timer would have duplicated work (the same date math runs at the top level for `todayStr` and current-hour highlighting) and added a second cleanup site to audit.

Trade-off: the bar position updates at minute resolution, not second resolution. Sub-minute drift is invisible at `SLOT_PX = 22` (a minute is ~1.47px tall), so this is acceptable for a visual cue. If second-resolution is later desired, a `TodayView`-local timer can be added without touching the on-track rule.

### Position anchor

The bar is positioned at:

```
top = (currentSlot - dayStartSlot) * SLOT_PX
    + (now.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN)
```

Where `currentSlot` is the item-02 `:15` slot index containing `now`, and the second term is the sub-slot offset for the minutes inside that slot. Writing it in terms of `currentSlot` (rather than the equivalent `nowMinutes - dayStartHour*60`) makes the relationship to item-02's grid explicit, matching the scope note that named `currentSlot` as the bar's anchor.

The bar is wrapped in an `nowBarVisible` guard: `nowMinutes >= dayStartHour * 60 && nowMinutes < 21 * 60`. Hidden before the user-chosen start hour and after the 9pm end-of-day cutoff.

### On-track rule

Documented verbatim in the source comment block above the derivation:

- **green** if `currentBlock` exists AND `now <= currentBlock.expectedEnd`
- **red** if `currentBlock` exists AND `now > currentBlock.expectedEnd`
- **neutral** if no `currentBlock`

`currentBlock` = the latest-starting, not-yet-completed block on today whose start is `<= now`. `expectedEnd = startMinuteOfDay + durationMinutes`. The scheduler aligns durations to `:15` multiples, so `expectedEnd` matches the visual end of the block on the grid.

"No `currentBlock`" covers three sub-cases: pre-day (no block has started), all done (every started block is completed), and a gap between completed blocks. All three are visually idle and the bar renders neutral.

### Colors

| State   | Color                              | Tailwind reference |
| ---     | ---                                | ---                |
| green   | `rgb(52,211,153)`                  | `emerald-400` |
| red     | `rgb(233,69,96)`                   | `accent-red` (already used in the timeline for current-slot bg) |
| neutral | `rgba(255,255,255,0.35)`           | (custom — mid-opacity white) |

Bar geometry: `height: 2px`, full width across the timeline container, with a small `8x8` dot anchored at the left edge as a visual notch on the time gutter side. `z-10`, `pointer-events-none`, `aria-label="current time"`.

### Files touched

Source (commit `c4d79ac`):

- `src/app/page.tsx` — added the bar derivation in `TodayView`, hoisted `SLOT_PX` next to the other slot constants so it can be referenced before the JSX, and wrapped the timeline `<div>` with `relative` plus the bar element. `WeekView` is untouched (it has no per-minute grid).

Bookkeeping (this commit):

- `structure/Purpose/checklists/06-live-now-bar.md` — Dev Agent, Task-specific, Out-of-scope, and Handoff-readiness boxes ticked with evidence cites to `c4d79ac`.
- `structure/Purpose/session-handoffs/2026-05-11-item-06-live-now-bar.md` — this file.

## Verification state

- `npx tsc --noEmit` — `src/app/page.tsx` compiles cleanly. The four pre-existing `googleapis` / `google-auth-library` missing-module errors are unchanged and unrelated (documented in checklist 01).
- `npx prisma generate` — not relevant for item 06 (no schema change).
- No tests in repo; no new tests added.
- **Deferred — manual browser exercise.** The running `timeblock-app` container is reachable on `:3100`, but `DATABASE_URL` in `.env` does not match the password the DB user actually has (P1000 against `localhost:5433` for user `timeblock`). With the DB unreachable, `todayBlocks` is empty and the only color state that can be exercised is `neutral`. The green and red states need the operator to fix the DB credential (see Known risks) and then capture two scenarios:
  - **Green check**: an in-progress block where `now < startMinuteOfDay + durationMinutes` — bar should be `rgb(52,211,153)`.
  - **Red check**: an in-progress block where `now > startMinuteOfDay + durationMinutes` and the block is not completed — bar should be `rgb(233,69,96)`.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commit: `c4d79ac feat(ui): live-now bar with on-track cue in TodayView`
- Bookkeeping commit: this commit
- Pushed: no — branch is 28+ ahead of origin and has not been pushed this session.

## Audit packet for item 06

For the Audit Agent pass:

- Code: `c4d79ac`
- Bookkeeping: this commit
- Standards: `../../Development/coding-principles.md`; checklist 06's task-specific rows; the "Bookkeeping Artifact Commit Policy" in `../delegation-contract.md`.
- Known verification gap (do not hold against the implementation): manual green/red state exercises are deferred behind the DB-credential blocker — same class of carry-over as items 01 and 05.

## Next session should start with

1. `git status -sb` and `git log --oneline -20` — confirm branch state and that this commit is the bookkeeping tip.
2. Read this handoff and `../scope.md` for active-scope refresher.
3. Run the item-06 audit against the packet above.
4. If `Accept`: move checklist 06 to `checklists/done/` in a follow-up Dev commit and pick the next sequencing item (item 07 movable-blocks cascade, then item 08 mobile-menu visibility).
5. If `Revise`: apply the fixes to source and/or bookkeeping in follow-up commits per the bookkeeping artifact commit policy.
6. **Independent of the audit**: the operator needs to repair the DB credential mismatch so the deferred manual checks for items 01, 05, and 06 can be exercised.

## Known risks

- **DB-credential mismatch still open.** `prisma db pull` returns P1000 against user `timeblock` on `localhost:5433`. `.env`'s `DATABASE_URL` password does not equal the docker-compose default (`timeblock_secret_change_me`); `DB_PASSWORD` is unset in `.env`. Operator action required (see `2026-05-11-item-05-audit-response.md` for the same blocker context). Blocks browser-side verification for items 01, 05, and 06.
- **WeekView has no "now" cue.** The checklist allowed either-or; this implementation only renders the bar in `TodayView`. If a future requirement says "show today's column highlighted in WeekView with a now indicator," that is a new scope item, not a regression.
- **`onTrackState` doesn't surface a fourth "behind but not in a block" state.** Example: block A ended at 10:00, completed; block B starts at 11:00; now is 10:30 with no block to do. Currently shows neutral. If the operator wants "your schedule is empty but you should be doing X" cues, that's a different feature (idle-prompt or carryover surfacing), not an extension of the now bar.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator fixes DB-credential mismatch so item-01/05/06 manual checks can run
- [ ] Audit Agent runs item-06 audit against `c4d79ac` + this commit
- [ ] On accept: move `checklists/06-live-now-bar.md` to `checklists/done/`; start item 07 (movable-blocks cascade)
