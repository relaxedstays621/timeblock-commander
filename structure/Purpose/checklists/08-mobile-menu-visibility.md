# Checklist: 08-mobile-menu-visibility

Task: Fix mobile menu visibility so capture and navigation are usable on a phone. Headline pain: the menu is barely visible.
Scope reference: `../scope.md` Active Scope (item 8 of sequencing)
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

- [ ] menu is visible on a 375px-wide viewport without horizontal scroll
- [ ] menu items meet a minimum 44px touch-target height
- [ ] color contrast for menu text meets WCAG AA (4.5:1 for normal text)
- [ ] menu is reachable from any page on mobile in one tap
- [ ] capture form fields are tappable without zoom and accept keyboard input without layout shift
- [ ] manual test on a real phone or accurate emulator (not just desktop devtools mobile mode)
- [ ] no regression on desktop layout

## Out-of-scope guardrails

- [ ] no native mobile app work (project boundary)
- [ ] no offline-mode capture in this checklist
- [ ] no redesign of the desktop menu beyond what is needed to keep it consistent
- [ ] no new icons, fonts, or design-system primitives

## Handoff readiness

- [ ] active session handoff under `../session-handoffs/` records before/after screenshots or device-test notes
- [ ] git branch and commit are recorded in the handoff
