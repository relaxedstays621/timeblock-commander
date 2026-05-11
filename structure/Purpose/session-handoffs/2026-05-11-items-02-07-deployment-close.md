# Session Handoff: items-02-07-deployment-close

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: (no audit needed for this deployment-only step)

## Active scope

Closes the runtime carry-over for items 02–07: source for those items has been live on `origin/docs/add-structure-scaffold` for some time, but the running `timeblock-app` container was still on the pre-02-07 image. This session rebuilt the container image and swapped the runtime to pick up the new code. Item 01's schema half was closed earlier today by `efbd3ba`; this handoff is the application-runtime counterpart and does not revisit item 01.

## What happened

The previous session crashed mid-deployment. Recovery established the following state:

- Working tree clean at `efbd3ba`. No bookkeeping commit from the crashed session.
- `timeblock-app:latest` already existed locally with build timestamp `2026-05-11T13:01:28Z` — the crashed session's `docker compose build app` had completed.
- Live container was still on image SHA `sha256:3bbf4dcccadc...`, identical to the rollback tag — confirming the build had run but the swap had not.
- Rollback tag `timeblock-app:pre-02-07` → `3bbf4dcccadc` was intact.

Scenario diagnosed as "build finished, swap didn't happen." Operator authorized swap, smoke verification, bookkeeping, and push.

1. `docker compose up -d app` — container `timeblock-app` recreated. `timeblock-db` already running, healthy. (One pre-existing orphan warning for `timeblock-caddy`; ignored — out of scope.)
2. New container ID `018c02428bbb`, image SHA `sha256:8c3ff2890a4c4ce0661650bfcafa1a5c24c82f0cfb1509314a435cac9d47a838` — matches the freshly built `timeblock-app:latest`.
3. Smoke checks (all four passed):
   - `docker ps | grep timeblock-app` → Up, port 3100 exposed.
   - `docker logs --tail 100` → `Next.js 14.2.35` / `Ready in 66ms`, no errors (no missing-module, no Prisma client init failure, no DB connection error, no port-in-use).
   - `curl http://localhost:3100/` → **200**.
   - `curl -X PUT http://localhost:3100/api/blocks/test-probe-id` → **401**. This route did not exist in the pre-02-07 image (it was introduced in item 07's source commit `113987f`), so any non-404 response is empirical proof the new build is live; the 401 is auth-gating doing its job.

## Image identifiers

- Pre-deployment (rollback target): `timeblock-app:pre-02-07` → `sha256:3bbf4dcccadc95ab890188f7f89e90cc5d4c554219de505895817cfa006a6ed7`, image timestamp `2026-05-07T13:20:19Z`.
- Post-deployment (now live): `timeblock-app:latest` → `sha256:8c3ff2890a4c4ce0661650bfcafa1a5c24c82f0cfb1509314a435cac9d47a838`, image timestamp `2026-05-11T13:01:28Z`.
- Rollback recipe (operator-only — do not auto-execute):
  ```
  docker tag timeblock-app:pre-02-07 timeblock-app:latest
  docker compose -f /opt/apps/timeblock/docker-compose.yml up -d app
  ```

## Items now live in the running container

| Item | Source commit(s) | Surface |
| --- | --- | --- |
| 02 — 15-min grid | source landed on branch | grid resolution upgrade in scheduler + UI |
| 03 — scheduled derived | `39ff38f`, `fee14f9`, `ce449f0` | `Task.status` derivation, audit response, accept |
| 04 — top-3 prime hour | `caafbbe`, `51c3ba0`, `1f655a0`, `2994393` | scheduler pinned own prime hours, audit fixes, accept |
| 05 — must-today | `56ef4a0`, `4e99ee0`, `67f703f`, `598ad8f`, `35cdf25`, `c60edb8`, `894001d` | `mustBeDoneToday` placement + capture toggle, eligibles-before-must-today fix, accept |
| 06 — live-now bar | `c4d79ac`, `7e77605`, `b434a30` | on-track cue in `TodayView`, accept |
| 07 — movable blocks | `113987f`, `31658b2`, `ab2d737`, `90fc261`, `b4a21a6` | drag-to-move + server-side cascade, two-phase update fix, accept |

Item 01's DB-schema half is referenced for completeness only — closed by `efbd3ba` earlier today; not part of this deployment artifact.

## Files touched

- `structure/Purpose/session-handoffs/2026-05-11-items-02-07-deployment-close.md` — this file. The only artifact landed by this commit. No source files touched in this session.

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Branch SHA before this commit: `efbd3ba docs(purpose): close item-01 deployment carry-over — db:push applied`
- Bookkeeping commit landing this handoff: this commit
- Pushed to origin: yes (this session)

## Known risks

- **Rollback is manual and image-tag-based.** No automated health probe drives revert; the rollback recipe above must be triggered by the operator. The `pre-02-07` tag is local-only — if the local Docker image store is wiped, the rollback target is gone unless re-pulled from a registry. No registry is configured for this project.
- **Pre-existing orphan warning** for `timeblock-caddy` surfaced during `docker compose up -d app`. Not introduced by this session and not relevant to the app runtime; left for a future cleanup pass.
- **No deferred manual browser exercises were run as part of this session.** Items 01 / 05 / 06 / 07 each had operator-runnable validation listed in their respective handoffs. Those remain operator-driven; the deployment proves the routes load, not that the UX flows behave as intended end-to-end.
- **`pre-02-07` tag retention.** Recommended to keep until the operator has had at least one normal-use session against the new build. Deletion is cheap to defer.

## Next session should start with

1. `git status -sb` and `git log --oneline -20`.
2. If continuing development: read `../scope.md` and pick up item 08 (mobile-menu-visibility) — the only active checklist remaining.
3. Operator-side: run the deferred manual browser exercises now that the new code is live AND the DB is in sync (post-`efbd3ba`).
4. Once the operator confirms a clean usage session against the new build, the `timeblock-app:pre-02-07` rollback tag can be removed: `docker rmi timeblock-app:pre-02-07`.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator runs deferred manual browser exercises for items 01 / 05 / 06 / 07 against the live runtime
- [ ] After a clean usage session: `docker rmi timeblock-app:pre-02-07` to retire the rollback tag
- [ ] If starting item 08: open `../checklists/08-mobile-menu-visibility.md`
