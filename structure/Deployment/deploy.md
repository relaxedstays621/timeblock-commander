# Deploy

Starter deployment guide for `<PROJECT>`.

Use this file for the durable deployment path rather than ephemeral terminal history.

## Target

`<Describe where the project is deployed.>`

## Deploy Flow

`<Describe the normal deployment sequence.>`

## Environment

`<List the environment assumptions, secrets handling rules, or config boundaries.>`

## Rollback

`<Describe the simplest safe rollback path.>`

## Deployment Operations Hardening

Long-running operations have crashed agent sessions, leaving runtime in ambiguous states. These rules eliminate that failure mode.

### Capture rollback target before any swap

Before a build that will swap a running container, tag the currently-running image with a stable, task-scoped name AND record both the tag and the resolved SHA in the task handoff:

    docker inspect --format='{{.Image}}' <container>     # captures SHA
    docker tag <sha256:...> <image>:pre-<task-id>
    docker images | grep pre-<task-id>                   # verify

The handoff must contain both `<image>:pre-<task-id>` and the resolved `sha256:...` value. Tags can be reassigned; the SHA is the durable audit reference.

### Builds run detached, not streamed

Multi-minute operations must not be foreground in the agent session. Use tmux with a tee'd log:

    tmux new -d -s build-<task-id> 'docker compose build app 2>&1 | tee /tmp/build-<task-id>.log'

Poll status every ~30s. Do not stream output.

**Completion signal: tmux session exit is authoritative.** Log content is evidence (final summary line, error trace) but NOT a completion signal — a partial BuildKit line can read like a success marker mid-stream. Always wait for the tmux session to have exited before treating the build as done.

This pattern survives agent CLI crashes, SSH disconnects, and OOM kills. The build keeps running under the docker daemon regardless of the agent's state.

### Swap only after the build is verified

Confirm the new image exists with a fresh timestamp and was built from the expected source commit. Then:

    docker compose up -d app

### Smoke verification

Follow the deployment-task smoke contract in `structure/Development/_template.md`. At minimum:

- Container Up with new image SHA
- Logs clean (no missing-module / Prisma init / DB errors)
- GET / returns 200
- Prisma SELECT 1 succeeds
- Auth path responds (not 500)
- One task-specific empirical probe proving new code is live

### No silent rollback

On any smoke failure, STOP and report. Document the rollback recipe in the report but do NOT execute it. Operator decides rollback vs. forward-fix.

Rollback recipe:

    docker tag <image>:pre-<task-id> <image>:latest
    docker compose up -d app
