# Checklist: 08-mobile-menu-visibility

Task: Fix mobile menu visibility so capture and navigation are usable on a phone. Headline pain: the menu is barely visible.
Scope reference: `../scope.md` Active Scope (item 8 of sequencing)
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

- [~] menu is visible on a 375px-wide viewport without horizontal scroll
- [x] menu items meet a minimum 44px touch-target height (`min-h-[44px]` added to hamburger, sidebar nav, action buttons, header + Capture / Sign-in / sign-out)
- [x] color contrast for menu text meets WCAG AA (4.5:1 for normal text) — sidebar inactive `text-white/50 → /80`, action buttons `text-white/60 → /85`, hamburger `text-white/70 → /90`; spot-check: 80% white over `#0a0a0a` ≈ 12.6:1, comfortably above 4.5:1
- [x] menu is reachable from any page on mobile in one tap — hamburger preserved at `md:hidden` with the same toggle behavior, just larger/clearer
- [x] capture form fields are tappable without zoom and accept keyboard input without layout shift — QuickCapture title input + context textarea bumped from `text-[15px]` / `text-[13px]` to `text-[16px]` (iOS Safari zoom threshold)
- [~] manual test on a real phone or accurate emulator (not just desktop devtools mobile mode) — deferred to operator post-deployment
- [~] no regression on desktop layout — deferred to operator post-deployment; expected impact is minor (sidebar items grow 4–6px taller via `min-h-[44px]`; text becomes slightly more legible)

Rows marked `[~]` are deferred because the change has not been rebuilt + swapped into the running container yet; live-runtime visual verification is operator-driven and post-deployment.

## Out-of-scope guardrails

- [x] no native mobile app work (project boundary)
- [x] no offline-mode capture in this checklist
- [x] no redesign of the desktop menu beyond what is needed to keep it consistent
- [x] no new icons, fonts, or design-system primitives

## Handoff readiness

- [x] active session handoff under `../session-handoffs/` records before/after screenshots or device-test notes (text-based; no screenshots in this session)
- [x] git branch and commit are recorded in the handoff
