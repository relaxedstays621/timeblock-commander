# Session Handoff: auth-callback-incident

Session date: 2026-05-11
Outgoing model: claude-opus-4-7
Outgoing role: Development Agent

## Active assignment

- Development Agent: claude-opus-4-7
- Audit Agent: claude-opus-4-7 (consulted mid-incident on the structural-fix scope; no separate session)

## Active scope

Closes the post-deployment auth-callback incident that surfaced immediately
after commit `1d17b84` (items 02-07 runtime swap). Scope is the env-substitution
drift in `docker-compose.yml` plus its documentation and prevention surface.
No source-code, schema, or item-checklist work in this session.

## What happened

Within minutes of pushing `1d17b84`, the operator reported sign-in failure at
`https://time.yourrelaxedstay.com/api/auth/signin?error=Callback`. App logs
showed a repeating `PrismaClientInitializationError: Authentication failed
against database server at 'db', the provided database credentials for
'timeblock' are not valid` fired from NextAuth adapter calls
`getSessionAndUser` and `getUserByAccount`. Every OAuth callback was failing
at the Prisma init step.

### Root cause

`docker-compose.yml` synthesized the app's `DATABASE_URL` from
`${DB_PASSWORD:-timeblock_secret_change_me}`. The host `.env` did not contain
a `DB_PASSWORD` entry, so compose substituted the silent fallback. The live
`timeblock` DB user's password no longer matched the fallback because the
operator had rotated it earlier (see `efbd3ba` handoff
`2026-05-11-item-01-deployment-close.md`) so host-side `npx prisma db pull`
would succeed.

The pre-existing app container — started ~4 days earlier, before the rotation
— had the correct password baked into its container-level env from creation
time. The items 02-07 swap recreated the container with the current compose
env, picked up the now-stale fallback, and broke auth. The 4-smoke-check
deployment verification (root `200`, PUT `/api/blocks/[id]` → `401`, clean
Next.js boot, container Up) passed because none of those checks exercise the
NextAuth Prisma adapter — the route gating returned 401 before any DB query,
and the failure mode only fires when an OAuth callback actually completes the
Google handshake.

### Runtime mitigation (Step A)

Appended `DB_PASSWORD=<value matching the password embedded in .env's
DATABASE_URL>` to `/opt/apps/timeblock/.env` (gitignored). Ran
`docker compose up -d app`. Compose recreated both `timeblock-db` and
`timeblock-app` (the db service references the same `${DB_PASSWORD}`).
Persistent volume `timeblock_pgdata` carries the actual DB user password —
postgres only honors `POSTGRES_PASSWORD` at first volume initialization, so
the rotated password set by the operator is unchanged and no data was
touched. Verified with a direct in-container Prisma probe:

    docker exec timeblock-app node -e \
      "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
       p.\$queryRaw\`SELECT 1 as ok\`.then(r=>console.log('DB_OK',JSON.stringify(r)))
       .catch(e=>console.log('DB_FAIL',e.message.split('\\n')[0]))
       .finally(()=>p.\$disconnect())"

Result: `DB_OK [{"ok":1}]`. Auth callback errors stopped. **The mitigation
lives only on this host** — `.env` is gitignored and is not in the repo.

### Structural fix (Step B)

Audit Agent recommended: make every silent-fallback env-substitution required
in `docker-compose.yml`. Implemented in this commit:

- `POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set in .env}` (db service).
- `DATABASE_URL: postgresql://timeblock:${DB_PASSWORD:?DB_PASSWORD must be set in .env}@db:5432/timeblock?schema=public` (app service).
- `NEXTAUTH_URL: ${NEXTAUTH_URL:?NEXTAUTH_URL must be set in .env}` (app service).
- `NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?NEXTAUTH_SECRET must be set in .env}` (app service).

Verified positively (`docker compose config` resolves cleanly with `.env`
present) and negatively (`docker compose --env-file=/dev/null config` aborts
with `required variable DB_PASSWORD is missing a value: DB_PASSWORD must be
set in .env`). The remaining optional integrations (`GOOGLE_*`, `OPENAI_*`,
`N8N_*`) keep their empty-string defaults — those are genuinely optional.

`.env.example` was reorganized into four explicit sections plus a Prisma host
note, per audit guidance:

- Required for Docker/runtime: `DB_PASSWORD`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Required for Google sign-in in production: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional integrations: `OPENAI_API_KEY`, `N8N_*`
- Host-side Prisma CLI: `DATABASE_URL` uses `@localhost:5433`; app container builds its own `@db:5432` URL from `DB_PASSWORD`
- Host-side server defaults (ignored by docker): `PORT`, `NODE_ENV`

The checklist template `structure/Purpose/checklists/_template.md` gained a
deployment-tasks note: root `200` plus an unauthenticated `401` is not a
sufficient auth-path smoke; an in-container Prisma connectivity probe (the
exact command above) is the minimum bar.

## What was deliberately NOT done

- **Commit `1d17b84` was not amended.** It accurately records what was
  verified at deployment time. The gap is in the smoke-check shape, not in
  the commit text; the prevention note in the template addresses that going
  forward.
- **The DB user password was not rotated.** The operator's earlier rotation
  (per `efbd3ba`) is still authoritative; `.env`'s `DB_PASSWORD` matches it.
- **`pre-02-07` rollback was not used.** It would not have helped — recreating
  the old image via compose hits the same env-substitution path. Only the
  4-day-old running container had the correct env, and it was already gone.
  Rollback advice in `1d17b84`'s handoff did not anticipate this drift class;
  this handoff records that gap rather than retroactively rewriting that one.
- **No Dockerfile / entrypoint changes.** Audit considered a Prisma health
  probe at startup but recommended against it as the primary fix: it would
  catch the problem after compose has accepted a bad contract. Compose-level
  fail-loud catches it before container recreate. An entrypoint probe remains
  available as a separate hardening step if a future incident motivates it.
- **No re-run of the swap.** The currently-running container is on the new
  image (`sha256:8c3ff2890a4c…`, container `dcf080f19e29`) with correct env
  set during Step A; the Step B compose changes only affect substitution
  semantics, not resolved values, so no further recreate is required.

## Files touched

Source (this commit):

- `docker-compose.yml` — four `${VAR:-default}` substitutions changed to
  `${VAR:?error}` for `DB_PASSWORD` (twice), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.
- `.env.example` — full rewrite into the four sections plus host-side notes
  described above.
- `structure/Purpose/checklists/_template.md` — added deployment-task auth-path
  smoke note under Task-specific verification.

Bookkeeping (this commit):

- `structure/Purpose/session-handoffs/2026-05-11-auth-callback-incident.md` —
  this file.

Host-only (not in commit):

- `/opt/apps/timeblock/.env` — `DB_PASSWORD=<value>` appended during Step A.
  Gitignored. Operator should treat this as the source of truth for the live
  host's env.

## Verification state

- `docker compose config` — resolves cleanly with `.env` present; all four
  required vars present, no warnings.
- `docker compose --env-file=/dev/null config` — aborts with the custom
  required-var error for `DB_PASSWORD`. Fail-loud confirmed.
- `docker exec timeblock-app node -e "<prisma raw SELECT 1>"` — `DB_OK`.
  Prisma can authenticate to the DB; the original failure mode is fixed.
- Operator-side: should re-attempt `https://time.yourrelaxedstay.com` sign-in
  and confirm the callback succeeds. (Cannot be smoked from the Dev Agent's
  shell because the OAuth handshake completes in the operator's browser.)

## Branch and commit

- Branch: `docs/add-structure-scaffold`
- Branch SHA before this commit: `1d17b84 docs(purpose): close items 02-07 deployment carry-over — runtime swap applied`
- Commit landing this fix and handoff: this commit
- Pushed to origin: yes

## Known risks

- **`.env` divergence.** `DB_PASSWORD` is now also referenced by the host's
  `DATABASE_URL` string (because they must match for host-side Prisma CLI to
  work). The two are still independently editable in `.env`, so a future
  operator could rotate one without the other. The host-side Prisma section
  of `.env.example` calls out this constraint; long-term, a small `npm`
  script or pre-commit hook could enforce it.
- **`POSTGRES_PASSWORD` change attempt on a live volume.** A future operator
  who sees the required-var error and sets `DB_PASSWORD` to a NEW value
  (different from what the existing volume already initialized) will NOT
  change the live DB user password — postgres ignores `POSTGRES_PASSWORD`
  after first init. They will, however, change the app's resolved
  `DATABASE_URL`, which will then fail to authenticate against the unchanged
  live DB password. The fix is `ALTER USER timeblock WITH PASSWORD '<new>'`
  inside the db container plus updating `.env`'s `DATABASE_URL` and
  `DB_PASSWORD` together. Worth a future User_Guide entry; not part of this
  commit.
- **Default-tag drift.** The `pre-02-07` rollback image is still present
  locally; the items 02-07 deployment-close handoff suggested removing it
  after a clean usage session. That recommendation stands, separate from this
  incident.

## Next session should start with

1. `git status -sb` and `git log --oneline -20`.
2. Operator: re-attempt Google sign-in at `time.yourrelaxedstay.com` and
   confirm the callback no longer returns `?error=Callback`. If it does,
   collect a fresh `docker logs --tail 100 timeblock-app` slice; this commit
   does not address downstream OAuth misconfiguration (redirect URI in
   Google Console, NEXTAUTH_URL mismatch, etc.) — only the DB-auth root
   cause that produced the observed error.
3. If continuing development: item 08 (mobile-menu-visibility) remains the
   only active checklist.

## Pickup-tomorrow checklist (quick reference)

- [ ] `git status -sb` and `git log --oneline -20`
- [ ] Operator confirms Google sign-in works end-to-end against
      `time.yourrelaxedstay.com`
- [ ] After clean usage session: `docker rmi timeblock-app:pre-02-07` (still
      open from `1d17b84`'s handoff)
- [ ] If starting item 08: open `../checklists/08-mobile-menu-visibility.md`
