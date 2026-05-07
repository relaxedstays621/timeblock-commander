# Scope

Standalone scope contract for a **session or task**. Not the project.

Project-level scope lives in `../System Guide/architecture.md` under the `Boundary` section. That file says what TimeBlock Commander is and is not. This file is one level narrower: it constrains a single session or task inside that project boundary.

The task packet in `delegation-contract.md` carries an inline `Scope:` field for one-line use. This file is the longer form: write it once, and let multiple tasks inside a session inherit it.

## When to write a scope

Write a standalone scope when:

- the work spans more than one task
- multiple agents will touch the work and need a shared boundary
- the user wants to lock the boundary before any agent starts
- a session is long enough that scope drift is a real risk

For a single self-contained task, the inline `Scope:` field in the task packet is enough.

## Authority

A scope written here is the contract for the active session or task. It must sit inside the project boundary defined in `../System Guide/architecture.md`. Tasks within the session reference it. Agents do not widen it without explicit reassignment from the operator.

If a task needs work outside the session/task scope, the agent should:

1. Stop.
2. Name the boundary crossing — and whether it is a session-scope crossing or a project-boundary crossing.
3. Ask the operator to widen the scope (or, for a project-boundary crossing, decide whether the work belongs in this project at all), or split the work into a separate task with its own scope.

## Template

```text
Goal:
<One sentence on the outcome being pursued.>

In scope:
- <files, folders, modules, or behaviors the work may touch>

Out of scope:
- <files, folders, behaviors, or systems that must not be touched>

Constraints:
- <coding standard, runtime constraint, dependency rule, or external contract>

Non-goals:
- <results that look related but are explicitly not the target>

Owner:
<Operator or stakeholder responsible for accepting the work.>

Effective for:
<this task | current session>

Project boundary reference:
../System Guide/architecture.md (Boundary section)

Verification source:
<Pointer to the checklist file under checklists/, if one exists.>
```

## Relationship to other files

- `delegation-contract.md` — task packets reference this scope by linking to it.
- `checklists/` — verification of "done within scope" lives there.
- `session-handoffs/` — outgoing scope state is captured in the active handoff so the next session inherits it.
