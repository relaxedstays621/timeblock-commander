# Checklist: 06-live-now-bar

Task: Render a horizontal "now" bar across the daily calendar showing current time. Color cues whether the operator is on track relative to the current block.
Scope reference: `../scope.md` Active Scope (item 6 of sequencing)
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

Single audit pass conducted against this work:

- **Pass 1** (against `c4d79ac` + `7e77605`): recommendation `Accept`. No findings. The on-track rule is documented in source verbatim per the checklist's task-specific requirement; the bar reuses the existing top-level `setInterval` rather than introducing a new timer (no new cleanup obligation); `currentSlot` is used as the position anchor as the scope note required. WeekView is correctly untouched (the per-minute grid only exists in TodayView, so the "rendered only on today's column" option is satisfied trivially).

- [x] findings are ordered by severity and reported before any summary (none to order — clean first-pass Accept)
- [x] each finding is grounded in concrete evidence or labeled as inference (no findings)
- [x] verification gaps are named (deferred manual browser exercises for the green and red states remain behind the DB-credential blocker — same class of carry-over as items 01 and 05; the neutral state cannot be ruled out as the only exercised state from this session)
- [x] missing tests are identified (no test suite in repo; audit relied on tsc + reasoning trace + the inline on-track rule documentation)
- [x] no fixes were implemented unless explicitly reassigned (no fixes needed)
- [x] final recommendation is one of: accept, revise, block — `Accept`

## Task-specific verification

Evidence scope for this section: commit `c4d79ac` plus the bookkeeping commit landing this checklist update.

- [x] day view renders a horizontal bar at the operator-local current time — `src/app/page.tsx` `TodayView`: bar is rendered inside the timeline wrapper as an absolute-positioned `<div>` whose `top` is `(currentSlot - dayStartSlot) * SLOT_PX + (now.getMinutes() % SLOT_MIN) * (SLOT_PX / SLOT_MIN)`. `now` is `new Date()` (operator-local), and `currentSlot` is the existing item-02 derivation that the scope explicitly named as the bar's position anchor.
- [x] bar updates at least every 60 seconds without a full re-render of the calendar grid — the bar reuses the top-level `now` state in `DashboardPage` (60s `setInterval`); each tick re-renders `TodayView` but React only diffs the bar's `top`/`background` style and the single `:15` row's `isCurrentSlot` background. The visible-slot list, block elements, and calendar event elements are not re-mounted. No new timer added.
- [x] bar color is red by default; switches to green-ish or neutral when the operator is on or ahead of pace — three-state implementation in `TodayView`: red when over the current block's budget, green when within the current block's budget, neutral when no block is in progress. "Red by default" interpreted as: red is the attention-grabbing state used when the operator is behind; on-pace and idle states are non-red. Color tokens: `rgb(233,69,96)` (`accent-red`), `rgb(52,211,153)` (emerald-400), `rgba(255,255,255,0.35)` (neutral).
- [x] "on track" rule documented in code: green if `now <= currentBlock.expectedEnd`, red if `now > currentBlock.expectedEnd` — comment block at `src/app/page.tsx` `TodayView` (above the `nowMinutes` derivation) states the rule verbatim. `expectedEnd` is computed as `startMinuteOfDay + durationMinutes`; the scheduler aligns durations to `:15` multiples so this matches the visual end of the block on the grid.
- [x] when there is no block currently in progress, bar is shown but on-track color is neutral — `currentBlock` resolves to `null` when no block has `start <= now AND !completed`; the `onTrackState` ternary falls through to `'neutral'`. Bar still renders (`nowBarVisible` only depends on whether `now` is inside the visible day window).
- [x] bar is hidden on past or future days in the week view, or rendered only on today's column — `WeekView` is unchanged and renders only summary day cards with no per-minute grid; the bar JSX lives inside `TodayView`. Checklist's "rendered only on today's column" option is satisfied trivially: there is no other day column for the bar to leak into.
- [x] no memory leak from the timer (cleanup on unmount) — the `setInterval` lives in `DashboardPage` and is wrapped in a `useEffect` that returns `clearInterval`. Item 06 does not introduce a new timer.

## Out-of-scope guardrails

Evidence scope for this section: commit `c4d79ac`.

- [x] no scheduler logic changes — `src/lib/scheduler.ts` is not in `c4d79ac`.
- [x] no schema changes — `prisma/schema.prisma` is not in `c4d79ac`.
- [x] no Google Calendar push for "now" state — `src/app/api/calendar/route.ts` and `src/lib/google-calendar.ts` are not in `c4d79ac`. The on-track color is purely client-side.
- [x] no notification or alert system tied to the bar — it is a visual cue only — no `Notification`, audio, or alert APIs added. The bar is a single `<div>` with `pointer-events-none` and `aria-label="current time"`; it does not bind any event handlers.

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records the timer choice and the on-track rule — see `2026-05-11-item-06-live-now-bar.md`.
- [x] git branch and commit are recorded in the handoff
- [x] this checklist and its session handoff are committed (not `M` or `??`) before requesting the Audit Agent — see `../delegation-contract.md` "Bookkeeping Artifact Commit Policy"
