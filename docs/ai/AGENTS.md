# AI Agents Overview

This document describes how AI assistants should collaborate on this project.
It complements:

- `PROJECT_CONTEXT.md` — what the project is about.
- `ARCHITECTURE.md` — how the system is structured.
- `CONTRIBUTING_AI.md` — guidelines for AI-assisted development.
- `SESSION_LOG.md` — chronological record of significant AI sessions.

---

## Roles of AI Agents

We expect multiple AI agents and humans to contribute over time. Each agent should:

- **Understand the context** before making changes.
- **Respect existing architecture and decisions** documented in `DECISIONS.md`.
- **Keep changes small and well-scoped** to ease review and debugging.
- **Document significant work** in `SESSION_LOG.md`.

Types of contributions include:

- Architecture design and refinement.
- Implementation of resolvers and launchers.
- Configuration and settings schema work.
- Documentation updates and examples.
- Testing, CI, and release automation.

---

## Collaboration Principles

1. **Leave a trail**

   - When you perform non-trivial work (design, refactor, new feature), add a short entry to `SESSION_LOG.md`.
   - Link to relevant code, pull requests, or design documents when possible.

2. **Minimize disruption**

   - Avoid large, sweeping changes unless explicitly requested.
   - Prefer incremental improvements that preserve behavior for existing users.

3. **Preserve upstream compatibility**

   - Follow upstream coding style and conventions.
   - Avoid breaking changes unless there is a clear migration path.

4. **Respect abstractions**

   - Keep `FileResolver` focused on URIs, remote handling, and caching.
   - Keep `ApplicationLauncher` focused on launching apps and handling platforms.
   - Do not introduce provider-specific conditionals scattered through unrelated modules.

5. **Keep docs/ai in sync with every meaningful change**

   - This is a non-negotiable rule for every non-trivial implementation, refactor, configuration change, or behavior change.
   - Update the relevant docs/ai files in the same change set, not as a later cleanup task.
   - At minimum, add or update the session log and adjust architecture or contributor guidance when the change affects structure, workflow, or decisions.

6. **Commit autonomously and often**
   - No need to pause and ask before committing. Commit on the fly whenever you reach a coherent,
     working change, however small — don't wait to batch work into one big commit.
   - Split unrelated concerns into separate commits (e.g. a docs-only change, a roadmap update, an
     implementation change, and its tests can each be their own commit) so history stays easy to
     review and bisect.
   - Push once a good number of commits has accumulated, or a milestone/roadmap item is completed
     — no need to ask first. Don't push after every single commit; batch a coherent chunk of work.

---

## How to Start a New AI Session

Before you begin implementing anything:

1. **Read the core docs**

   - `PROJECT_CONTEXT.md`
   - `ARCHITECTURE.md`
   - `DECISIONS.md`
   - `ROADMAP.md`

2. **Check the latest `SESSION_LOG.md`**

   - Understand what previous agents or humans did.
   - Identify ongoing work, open questions, and unresolved issues.

3. **Clarify your objective**

   - Write down a short objective for the session (e.g. "Implement basic LocalResolver and wire it into the command handler.").

4. **Confirm constraints**
   - Maintain backward compatibility for local file behavior.
   - Observe cross-platform requirements.
   - Keep changes within the current milestone if possible (see `ROADMAP.md`).

---

## Ending a Session

At the end of a session:

- Add a concise entry to `SESSION_LOG.md` including:

  - Date.
  - Objective.
  - Summary of changes or design decisions.
  - Any open questions or TODOs for future sessions.

- If you introduced new concepts or abstractions, briefly update:
  - `ARCHITECTURE.md` (for structural changes).
  - `DECISIONS.md` (for notable design choices or trade-offs).

---

## When to Create or Update Documentation

Update documentation when you:

- Add or modify a public API or configuration.
- Introduce a new resolver or launcher type.
- Change caching or cleanup behavior.
- Clarify support for a new VS Code provider (e.g. WSL, Dev Containers).
- Make a significant decision about performance, security, or compatibility.

Documentation changes should be:

- Short and targeted.
- Consistent with existing docs.
- Linked to from `SESSION_LOG.md` if they accompany substantial code changes.

---

## Handling Ambiguity

If requirements are unclear or multiple options exist:

1. Capture the options and trade-offs in `DECISIONS.md` or in a temporary design note.
2. Document assumptions you are making.
3. Prefer solutions that keep the architecture generic and URI-aware.
4. Avoid locking the extension into a single provider or application type.

---

## Summary

AI agents are expected to behave like careful open-source contributors:

- Understand the context before coding.
- Use the resolver/launcher abstractions properly.
- Keep work small, well-explained, and testable.
- Leave clear documentation trails for future collaborators.
