# Session Handoff: item-05-must-today-and-session-close

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

**This is the end-of-day handoff.** The operator is logging off after item 05's initial build. Tomorrow's session should resume from this file. The "Next session should start with" section below is the prioritized pickup queue.

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: unassigned (control-plane row still reads `<fill per project>`)

## Active scope

`../scope.md` Active Scope, sequencing items 1–8. Items 02, 03, 04 are accepted and archived. Items 01, 05 are awaiting audit. Items 06, 07, 08 are unstarted.

## Work completed today (2026-05-11)

Today moved three sequencing items forward:

1. **Item 03 audit-response → accepted → archived** (`39ff38f`, `fee14f9`, `ce449f0`). Closed F1 (TaskStatusEnum still accepted SCHEDULED) and F2 (TaskDetailModal could round-trip legacy SCHEDULED). Audit accepted; checklist now in `done/`.

2. **Item 04 implemented → audited → fixed → accepted → archived** (`caafbbe`, `d643916`, `51c3ba0`, `1f655a0`, `2994393`). Top-3 + pinned own prime hours; pin = score 100. Two-pass placement (eligibles before non-eligibles) closed the first audit's findings. Audit accepted; checklist in `done/`.

3. **Item 05 initial build** (`56ef4a0`). `mustBeDoneToday` placement: three-pass scheduler (must-today → eligibles → non-eligibles), capture-form toggle, route + scheduleWeek must-today set plumbing, no-spillover-to-tomorrow guarantee. Dev-side bookkeeping is in this commit.

Total commits today on `docs/add-structure-scaffold`: 13 (eight source/bookkeeping, four item-04 cycle, plus this handoff commit when it lands).

## What item 05 does (source: `56ef4a0`)

**Scheduler (`src/lib/scheduler.ts`)**
- `scheduleDay` accepts `mustTodayTaskIds: Set<string>` (optional). Placement is now three-pass:
  1. **must-today** — runs first. `slotOrder = userPinned ? [prime, nonPrime] : [nonPrime, prime]`. Pin overrides the non-prime preference.
  2. **prime-eligibles not in must-today partition** — `slotOrder = [prime, nonPrime]` per item 04.
  3. **non-eligibles** — `slotOrder = [nonPrime, prime]` (prime as fallback).
- Within each pass, score order is preserved from the source `schedulable` array. Cross-pass, must-today wins; eligibles win over non-eligibles.
- `scheduleWeek` computes `mustTodayTaskIds = new Set(scoredTasks.filter(t => t.mustBeDoneToday).map(t => t.id))` and passes it ONLY to whichever iterated day equals today. Non-today day iterations filter must-today tasks out of `remaining` so a must-today task cannot spill to tomorrow.

**Route (`src/app/api/schedule/route.ts`)**
- `'day'` branch: when `dateStr === todayLocalStr`, derives `mustTodayTaskIds` from `freshTasks` and passes through. When scheduling a future date, must-today is filtered out of the task pool entirely (`dayTasks = freshTasks.filter(t => !t.mustBeDoneToday)`).
- `'week'` and `'reschedule'` branches inherit via `scheduleWeek` / `rescheduleFromNow` — no call-site change.

**UI (`src/components/QuickCapture.tsx`)**
- "Must be done today" toggle paired with the pin toggle inside a "Priority flags" group. Rose-tinted when active, with contextual helper text:
  - non-pinned: "Placed today, after 12p when possible. Overflow stays in queue."
  - pinned + must-today: "Pin overrides: still today, but in an 8a–12p slot."
- `mustBeDoneToday` flows through the `createTask` payload; reset between captures.

## Decisions made (item 05)

- **Three-pass placement, not eviction-based displacement.** The checklist's "lower-priority same-day blocks shift later in the day to make room" is satisfied by iteration order: must-today places first, lower-priority tasks see the must-today slots occupied and naturally place around them. No evict-and-replan logic was needed.
- **Non-pinned must-today gets prime as fallback.** A non-pinned must-today task tries non-prime first and falls back to prime only if non-prime is full. This means must-today CAN land in prime — but only when forced by capacity. Audit may want to scrutinize this against the "preferring non-prime hours" phrasing.
- **Non-pinned must-today vs. eligibles ordering.** Must-today (Pass 1) runs before eligibles (Pass 2). If non-prime fills up during Pass 1, a must-today task may spill into prime before eligibles iterate, taking a prime slot from a would-be top-3 task. This is an order tension between the item-04 "top-3 own prime" rule and the item-05 "must-today is placed today" rule. The implementation favors item 05 (force today wins over reserve prime). Audit should rule on whether that priority order is correct.
- **No `TaskDetailModal` toggle.** The checklist only mentions the capture form. Editing a captured task to add/remove must-today requires PATCH via API or a future UI iteration. Same pattern as item 04.
- **No eviction across `scheduleDay` invocations.** A must-today task running today does not evict already-placed blocks from prior schedule runs that the rescheduler kept as `keep` (e.g., past blocks). The rescheduler's `keep` list is sacred — only future blocks are re-planned. This is consistent with the existing rescheduler contract.

## Open questions to flag for audit

1. **Order tension flagged in "Decisions made":** non-pinned must-today can spill into prime in Pass 1 before eligibles get their Pass-2 turn. Is that acceptable? If audit wants strict "top-3 own prime even when must-today competes", the fix is to make non-pinned must-today's slotOrder strictly `[nonPrime]` with no prime fallback. One-line change.
2. **Future-day `'day'` schedule** filters must-today out completely. Is the intent to permit a manual "schedule tomorrow" pass that includes must-today tasks (treating them as future-today)? Current implementation says no. Flagged for audit confirmation.
3. **Manual exercise items remain deferred** — no dev-server run this session. Operator/audit should exercise the two scenarios named in the checklist before accept.
4. **`AnalyticsView`** is unchanged. If it reports anything keyed on `mustBeDoneToday` in the future, that's a separate item.

## Files touched today

Source (commits `39ff38f`, `51c3ba0`, `56ef4a0`):

- `src/lib/scoring.ts` — pin short-circuit (item 04; older today).
- `src/lib/scheduler.ts` — two-pass (item-04 audit fix) → three-pass (item 05). `computePrimeEligibleIds` stable.
- `src/lib/schemas.ts` — `TaskStatusEnum` lost `SCHEDULED` (item-03 audit fix); `CreateTaskSchema` gained `userPinned`/`mustBeDoneToday` (item 04, earlier).
- `src/app/api/tasks/route.ts` — POST `calculateScore` input now includes `userPinned`/`mustBeDoneToday` (item-04 audit fix).
- `src/app/api/schedule/route.ts` — must-today plumbing in `'day'` branch (item 05).
- `src/app/page.tsx` — `TaskDetailModal` normalizes legacy SCHEDULED to QUEUED on init (item-03 audit fix).
- `src/components/QuickCapture.tsx` — pin toggle (item 04, earlier), must-today toggle (item 05).
- `src/components/ui.tsx` — `StatusBadge` two-version evolution (item-03 close + audit-response).

Bookkeeping (commits `fee14f9`, `ce449f0`, `1f655a0`, `2994393`, this commit):

- `structure/Purpose/checklists/done/03-scheduled-status-derived.md`
- `structure/Purpose/checklists/done/04-top-three-prime-hour.md`
- `structure/Purpose/checklists/05-must-be-done-today-placement.md` (this commit, Dev-side)
- Three new session handoffs: `2026-05-11-item-03-audit-response.md`, `2026-05-11-item-04-audit-response.md`, this file.

## Verification state

- `npx tsc --noEmit`: passes for all touched files. Pre-existing `googleapis` / `google-auth-library` missing-module errors remain unrelated.
- `npx prisma generate`: succeeds (no schema changes today).
- No tests in the repo.
- **Deferred for tomorrow / before audit accept**:
  - Manual exercise of item 05's two named scenarios in a browser.
  - `npm run db:push` on the host so the production DB sees the item-01 schema fields (`userPinned`, `mustBeDoneToday`, `startMinute`) and unique-key change. Today's API/UI code assumes these exist.
  - DST-boundary exercise (still deferred from item 02; audit hasn't pushed back on it).

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Latest source commit: `56ef4a0 feat(scheduler+ui): mustBeDoneToday placement + capture toggle`
- Latest bookkeeping commit: this commit (item-05 dev-side close)
- Pushed to remote: unknown — not checked this session. Worth a `git status -sb` first thing tomorrow.

## Pending audit queue (highest priority for tomorrow)

1. **Item 05 first audit** — against `56ef4a0` plus this commit's bookkeeping. Likely to surface the order-tension question flagged above.
2. **Item 01 re-audit** — outstanding since the original audit asked for three revisions. All three were addressed (`20a587d` ticked the boxes with scope notes; `0717cc6` codified the Bookkeeping Artifact Commit Policy). No re-audit has run. Packet: commits `44c5e8b + 20a587d + 0717cc6`; handoff at `session-handoffs/2026-05-10-item-01-schema-flags-close.md`.

## Next session should start with

In order:

1. **Run `git log --oneline -15` and `git status -sb`** to confirm the branch state matches this handoff (latest sha referenced above).
2. **Read this handoff in full** plus `../scope.md` to refresh active scope.
3. **Schedule the item 05 audit** using the same audit-packet pattern as prior items. Audit will likely surface:
   - The order tension between must-today and top-3 over prime slots.
   - The two deferred manual-exercise items.
4. **Schedule the item 01 re-audit** if it's been waiting.
5. **After both audits resolve**, move to item 06 (live red "now" bar + on-track cue). Item 06's checklist is at `../checklists/06-live-now-bar.md`. The item-02 `currentSlot` derivation in `TodayView` is already in place and ready to position the bar.

## Known risks

- **Order tension (item-04 vs item-05).** See "Open questions" #1. If audit pushes back on it, the fix is small but it's a behaviour choice the operator may want to make explicit in the scope.
- **`db:push` is not run.** All item-01 fields are in code; if the host DB hasn't had `npm run db:push` since `44c5e8b`, runtime will throw on any reference to `userPinned` / `mustBeDoneToday` / `startMinute`. Confirm host state before exercising the new UI tomorrow.
- **`isReactive` defaulting in QuickCapture.** Still `urgency >= 7`. Combined with must-today (without pin), a high-urgency must-today task has the reactive flag set, which the score formula penalizes — but the must-today partition runs first regardless of score, so placement isn't affected. Score sort within the must-today pass might still order it lower than a non-reactive must-today peer.
- **`scheduleWeek` non-today filter** assumes a `Task.mustBeDoneToday` field exists at runtime. Stale Prisma client (pre-db:push) would crash. Already named in db:push risk.
- **Pin-toggle helper text overlap.** When both `userPinned` and `mustBeDoneToday` are true, only the combined helper text shows. Visual spot-check tomorrow.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Confirm `npm run db:push` ran on the host since `44c5e8b`; if not, run it
- [ ] Spin up the audit packet for item 05
- [ ] Schedule item 01 re-audit if the operator wants to close that loop
- [ ] Tomorrow's coding work, after audits clear: item 06 (live "now" bar + on-track cue)
