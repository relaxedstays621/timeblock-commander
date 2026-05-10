# Session Handoffs

Rolling record of state at the end of each working session, so the next session can resume without guessing.

## What this is

A session handoff is an artifact written at the end of a conversation context. It captures everything an incoming agent needs to continue the work in a later session — possibly with a different model, possibly days or weeks later.

Session handoff is **not** the same as agent handoff:

- Agent handoff: one agent passes work to another agent **inside the same session**. See `../delegation-contract.md`.
- Session handoff: state is preserved **across sessions** when the conversation context is going to end or has already ended.

## Folder shape

```
session-handoffs/
  README.md          this file
  _template.md       the template to copy
  YYYY-MM-DD-<slug>.md   one file per session
```

## Naming

`YYYY-MM-DD-<slug>.md`, where `<slug>` is a short kebab-case label of the work.

Examples:

- `2026-05-07-purpose-scaffold.md`
- `2026-05-12-scheduler-bugfix.md`

If multiple sessions on the same day need handoffs, append a counter: `2026-05-07-purpose-scaffold-2.md`.

## Active handoff

The newest file is the active handoff. Older files are history.

Older handoffs are kept in git on purpose — they form an audit trail of how the project moved across sessions. Do not delete them.

## When to write

Write a session handoff when:

- the operator says the session is ending
- context is approaching its limit
- the work will be picked up later by a different agent or different model
- a long-running scope (see `../scope.md`) is paused mid-stream

Skip the handoff only when the session completed a single self-contained task with no follow-up work.

## When to read

The incoming agent reads the newest handoff right after the standard boot protocol (`../boot-protocol.md`), before starting work. Treat the handoff as the starting state, not as a replacement for the boot protocol itself.

## Commit before audit

Session handoffs must be committed before the Audit Agent reviews them. Audit decisions cite SHAs, so an untracked handoff cannot be cited durably. See `../delegation-contract.md` "Bookkeeping Artifact Commit Policy" for the rule and the Audit Agent obligation that flows from it.
