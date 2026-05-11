# Session Handoff: item-08-mobile-menu-visibility

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (to be assigned for the item-08 audit)

## Active scope

`../scope.md` Active Scope, sequencing item 8 — mobile menu visibility. Make capture and navigation usable on a 375px-wide viewport. Source commit: `a73c520 feat(schedule+ui): additive Schedule Today/Week + mobile menu visibility` (bundled with item 09).

## What changed

The checklist's two specific bars are 44px tap targets and WCAG AA contrast (4.5:1). The mobile-zoom-on-focus failure for the capture form is the third explicit ask. All three are addressed in the same commit.

### `src/app/page.tsx` — visibility & tap targets

- **Hamburger button** (was `text-xl text-white/70 md:hidden` with no explicit size): now wrapped in a `min-h-[44px] min-w-[44px] flex` container with `text-2xl text-white/90`, `-ml-2` to absorb the added padding visually, and proper `aria-label` / `aria-expanded` for screen-reader correctness. Contrast bumped from 70% → 90% white opacity for first-impression legibility against the dark surface.
- **Header `+ Capture` button**: added `min-h-[44px]`. Color already white-on-red.
- **Header sign-out / email button**: contrast bumped from `text-white/50 hover:/80` to `text-white/80 hover:/95`; `min-h-[44px]` added.
- **Header sign-in button**: already `text-white` (no contrast issue); added `min-h-[44px]`.
- **Sidebar nav buttons** (Command Center): inactive contrast bumped from `text-white/50 hover:/70` to `text-white/80 hover:/95`; `min-h-[44px]` added in addition to existing `py-2.5`. Active state (red accent) unchanged.
- **Action buttons** (Schedule Today / Schedule Week): contrast bumped from `text-white/60 hover:/80` to `text-white/85 hover:/95`; `min-h-[44px]` added.
- **Clear Today button**: contrast bumped from `text-red-400/70 hover:text-red-400` to `text-red-300 hover:text-red-200` for stronger destructive-action visibility; `min-h-[44px]` added.

### `src/components/QuickCapture.tsx` — iOS zoom-on-focus fix

- **Title input**: `text-[15px]` → `text-[16px]`. iOS Safari triggers an auto-zoom on focus for any input with computed font-size below 16px; this caused a layout shift the operator would experience as "tap the field, the page jumps." Bumping to exactly 16px is the smallest change that fixes the symptom.
- **Context textarea**: `text-[13px]` → `text-[16px]` for the same reason.
- Both inputs already had `py-3` / `py-2.5` and large enough widths; only the font-size needed changing to clear the iOS threshold.

### What was NOT changed

- **Pill-style selection buttons** in QuickCapture (company / type / duration / priority flags). These chips are `text-[11px] px-3 py-1.5` and don't meet 44px individually. The checklist scopes the 44px bar to *menu items* and the explicit ask is *form fields*; pills are dense secondary controls inside the modal and would force a layout redesign to reach 44px each. Out of scope for this commit. Could revisit in a follow-up "capture-form ergonomics" task.
- **Sidebar Top 3 / Allocation widgets** (`text-white/40` and `/30`): secondary informational content, not interactive menu items. The contrast bar in the checklist is "menu text"; these are content. Left as-is.
- **Desktop layout**: minor — sidebar items grow ~4–6px taller via `min-h-[44px]`. The change is visually conservative; no font sizes were reduced.
- **No new icons, fonts, or design-system primitives** introduced (per the checklist's out-of-scope guardrail).

## Design choices flagged for the audit

- **Universal `min-h-[44px]`, not mobile-only.** The natural Tailwind alternative is `md:min-h-0` to keep desktop compact. I deliberately did not do that: a 44px control on desktop is still ergonomic, the change is small, and the cost of a media-query branch (and the risk of forgetting it on a new control) is higher than the cost of a slightly taller sidebar. If the audit prefers mobile-only, the change is a one-attribute edit per button.
- **Opacity-based contrast, not color tokens.** The fix tunes opacity (`text-white/50 → /80`) rather than introducing a `text-foreground-secondary` token. Reason: the existing palette uses the opacity pattern throughout (`SectionLabel`, allocation labels, etc.), so a token would be a one-off. If the project later introduces a semantic color system, that is a separate refactor.
- **Hamburger `aria-label`.** Was missing entirely; now reflects state via `aria-expanded`. Small but visible to screen readers.
- **No screenshots in this handoff.** Project pattern leans on text descriptions; screenshots would need the live runtime which is not yet rebuilt. Operator can capture before/after after the deploy.

## Files touched

Source (commit `a73c520`, alongside item 09):

- `src/app/page.tsx` — header hamburger, header capture/sign-in/sign-out buttons, sidebar nav buttons, action buttons (Schedule Today / Week / Clear Today). Same file is touched by item 09's banner + handler edits; the item-08 hunks are the contrast / tap-target portions.
- `src/components/QuickCapture.tsx` — title input and context textarea `text-[16px]`.

Bookkeeping (this commit):

- `structure/Purpose/checklists/08-mobile-menu-visibility.md` — Dev / Out-of-scope / Handoff-readiness rows ticked; the three behavioral rows (375px viewport, real-phone test, no desktop regression) marked `[~]` deferred behind the no-rebuild-yet condition.
- `structure/Purpose/session-handoffs/2026-05-11-item-08-mobile-menu-visibility.md` — this file.

## Verification state

- `npx tsc --noEmit` — clean for all touched files. The four pre-existing `googleapis` / `google-auth-library` errors are unchanged and unrelated.
- No tests in repo; no new tests added.
- **Contrast spot-check (computed, not WCAG-tool-confirmed):** 80% white opacity over `#0a0a0a` ≈ 12.6:1 contrast ratio, comfortably above the 4.5:1 normal-text bar. 85% white over the same background ≈ 14.2:1. Even the most muted post-fix label (action button at 85%) clears AAA (7:1).
- **Deferred manual exercises** (post-deploy):
  - Open `time.yourrelaxedstay.com` in a phone browser at 375px width. Tap hamburger → menu opens; tap any nav item → menu closes and route changes. No horizontal scroll.
  - Tap any sidebar nav item — touch target reads as comfortable, not cramped. Compare to previous build if possible.
  - Open + Capture on phone, tap into the title input — no zoom, no layout shift, keyboard appears. Type. Same for the context textarea.
  - Desktop regression: open at 1440px — sidebar items are slightly taller (4–6px), nothing else looks meaningfully different.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Source commit: `a73c520 feat(schedule+ui): additive Schedule Today/Week + mobile menu visibility` (combined with item 09)
- Bookkeeping commit landing this handoff: this commit
- Pushed: yes — source commit is on origin; this bookkeeping commit will be pushed alongside item-09's bookkeeping.

## Audit packet for item 08

For the Audit Agent pass:

- Code: `a73c520` (only the `page.tsx` contrast/tap-target hunks and the `QuickCapture.tsx` font-size hunks belong to item 08).
- Bookkeeping: this handoff plus the ticked checklist `08-mobile-menu-visibility.md`.
- Standards: `../../Development/coding-principles.md`; checklist 08's task-specific rows; the WCAG AA 4.5:1 normal-text bar; the iOS Safari ≥16px input-zoom convention.
- Known verification gap: live-device-test is deferred behind the rebuild-and-swap blocker. Do not hold against the implementation; flag in the audit response.
- Design choices flagged above are open for revise/accept rather than implicit acceptance.

## Known risks

- **Not yet deployed.** Same blocker as item 09 — the source change is on origin but `timeblock-app` is still on the prior image.
- **Pill-chip touch targets remain small.** Documented above as out-of-scope; a determined operator-side audit might call this out. Flag-and-defer rather than reopen.
- **iOS-only zoom fix verification.** The 16px bump fixes iOS Safari specifically; Android Chrome handles smaller inputs without zoom but the change does not regress Android. Real-phone test on operator's actual device is the only way to fully confirm.
- **`aria-expanded` on hamburger** is new; nothing else in the codebase had it. Screen-reader regression risk is essentially zero (the previous state had nothing), but worth noting.

## Next session should start with

1. `git status -sb` and `git log --oneline -20`.
2. Read this handoff and the item-09 handoff for the full session context (bundled commit `a73c520`).
3. Operator-side: rebuild + swap, then run a phone-browser pass at `time.yourrelaxedstay.com`. The deployment smoke per the new template note should include both the Prisma DB probe and the item-09 nothing-new check.
4. If the audit returns Accept: move `checklists/08-mobile-menu-visibility.md` to `checklists/done/`. Items 08 and 09 close out the active sequencing in `../scope.md`.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator authorizes rebuild + swap for `a73c520`; smoke includes a real-phone visit to confirm hamburger / sidebar / capture-modal behavior
- [ ] Audit Agent runs item-08 audit against `a73c520`'s page.tsx + QuickCapture.tsx hunks; surface accept/revise on the universal-44px and opacity-based-contrast choices
- [ ] On accept: move checklist to `done/`; item 08 closes
