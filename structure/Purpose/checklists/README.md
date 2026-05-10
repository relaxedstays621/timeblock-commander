# Checklists

Reusable, boxed verification lists for declaring work done.

## What this is

The done criteria in `../roles.md` and `../delegation-contract.md` are written as prose. This folder turns them into actual checklists an agent walks through before claiming a task is finished.

A checklist exists per active task or feature. When the task is accepted, its checklist moves to `done/` as an audit trail.

## Folder shape

```
checklists/
  README.md         this file
  _template.md      the template to copy
  <task-slug>.md    one file per active task
  done/
    <task-slug>.md  archived after the task is accepted
```

## Naming

`<task-slug>.md`, where `<task-slug>` is a short kebab-case label of the task or feature.

Examples:

- `oauth-token-persistence.md`
- `scheduler-hour-aware-filter.md`
- `purpose-scope-handoff-checklist.md`

## Lifecycle

1. Operator or development agent copies `_template.md` to `<task-slug>.md` when a new task starts.
2. Agent fills in the task-specific items beyond the standard role done criteria.
3. As work progresses, items are checked off. Unchecked items at session end are noted in the active session handoff.
4. When the audit agent accepts the work, the file is moved to `done/<task-slug>.md` as a record.

Do not delete completed checklists. They are the verification trail.

## Generic done lists

The template carries the standard Development Agent and Audit Agent done lists derived from `../roles.md` and `../delegation-contract.md`. Task-specific items are added beneath them.

If the prose in `../roles.md` or `../delegation-contract.md` changes, update `_template.md` too.

## Commit before audit

Checklists must be committed before the Audit Agent reviews them. Audit decisions cite SHAs, so a modified-but-uncommitted checklist cannot be cited durably. See `../delegation-contract.md` "Bookkeeping Artifact Commit Policy" for the rule and the Audit Agent obligation that flows from it.
