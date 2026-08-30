# AI Contributor Guidelines

This document is intended for future AI assistants contributing to this project.
It describes goals, coding practices, and how AI-driven work should integrate with
human contributors and upstream.

---

## Project Goals (for AI contributors)

- Maintain a **clean, extensible architecture**.
- Avoid quick hacks or one-off fixes that do not generalize.
- Keep the extension **URI-aware** and provider-agnostic.
- Preserve compatibility with the upstream project and existing users.

Ultimately, we want a Remote-SSH capable version of the extension that is
maintainable and realistic to propose upstream.

---

## Coding Guidelines

1. **Keep commits small and focused**

   - Implement one well-defined change per commit where possible.
   - Avoid large, multi-purpose commits that are hard to review.

2. **Preserve upstream coding style**

   - Follow the existing patterns for TypeScript/JavaScript, configuration, and tests.
   - When in doubt, look at similar code in the upstream repository and imitate it.

3. **Document public APIs and configuration**

   - When adding or changing interfaces (`FileResolver`, `ApplicationLauncher`, settings, commands),
     update the relevant documentation:
     - Code comments for public interfaces.
     - `ARCHITECTURE.md` for structural changes.
     - `DECISIONS.md` for major design choices.
     - User-facing docs/settings descriptions where applicable.

4. **Avoid introducing breaking changes**

   - Preserve existing behavior for local files by default.
   - If a breaking change is truly necessary, document it clearly and consider
     migration strategies.

5. **Consider cross-platform behavior**

   - Verify that new features make sense on Windows, macOS, and Linux.
   - Keep platform-specific logic isolated and well-tested.

6. **Respect the resolver/launcher boundary**
   - Remote-specific logic belongs in `FileResolver` implementations.
   - Command launching and argument formatting belong in `ApplicationLauncher`.
   - Avoid sprinkling provider-specific conditionals across unrelated modules.

---

## When Implementing New Features

Before writing code, answer these questions:

1. **What is the abstraction?**

   - Identify the minimal interface or component that captures the feature.
   - Favor adding a new resolver or launcher implementation over ad-hoc logic.

2. **Can we minimize changes to existing code?**

   - Plug into existing extension entry points instead of rewriting them.
   - Keep wiring changes small and incremental.

3. **Can the feature be implemented without special-case branches?**

   - Prefer generic mechanisms over `if provider == "ssh"` scattered in multiple places.
   - Use configuration and polymorphic resolver implementations instead.

4. **Will it work for future URI providers?**

   - Design resolvers so that adding WSL, Dev Containers, Codespaces, etc. is straightforward.
   - Avoid assumptions tied only to Remote-SSH.

5. **Does it belong in the resolver or the launcher?**
   - Resolver: URI handling, remote download, caching.
   - Launcher: application execution, arguments, platform differences.
   - If logic mixes both concerns, try to split it.

---

## Questions to Ask Yourself

- Is this feature generic, or am I baking in a one-off special case?
- Can I express this behavior via a new implementation of an existing interface?
- Does the configuration surface remain understandable to users?
- Am I preserving compatibility with local-only workflows?
- Have I updated the relevant documentation and tests?

---

## Mandatory Documentation Rule

Every non-trivial change must update the docs/ai set in the same pass.

- If you change code, configuration, behavior, architecture, or workflow, update the relevant docs/ai file immediately.
- Do not leave documentation updates for a future cleanup task.
- For implementation work, this normally means:
  - adding or updating a session entry in `SESSION_LOG.md`
  - updating `ARCHITECTURE.md` or `DECISIONS.md` when structure or design choices change
  - updating `CONTRIBUTING_AI.md` or `AGENTS.md` when the working conventions change

## Commit Workflow Rule

Commit autonomously and often — no need to ask before committing.

- Commit as soon as a change is coherent and working, however small; don't batch unrelated work
  into one big commit waiting for a "big enough" milestone.
- Split unrelated concerns (docs, roadmap/decisions updates, implementation, tests) into separate
  commits so history stays easy to review and bisect.
- Push once a good number of commits has accumulated, or a milestone/roadmap item is completed —
  no need to ask first. Don't push after every single commit; batch a coherent chunk of work.

## Workflow for AI-Assisted Changes

1. **Review context**

   - Read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, and `DECISIONS.md`.
   - Check `ROADMAP.md` to see which milestone your work fits into.
   - Review `SESSION_LOG.md` for recent changes and open questions.

2. **Plan the change**

   - Write down a brief plan: what interface or component you will touch and why.
   - Ensure the change aligns with existing design decisions.

3. **Implement incrementally**

   - Make the smallest change that delivers value.
   - Keep TypeScript/JavaScript code idiomatic and consistent.

4. **Test and validate**

   - Run relevant build/test commands.
   - Validate behavior with both local and Remote-SSH scenarios where possible.

5. **Document and log**
   - Update documentation as needed.
   - Add a new entry in `SESSION_LOG.md` summarizing the work.

---

## Long-Term Objective

All AI-assisted work should move the project toward this long-term goal:

> Create a Remote-SSH (and generally URI-aware) version of the extension that is
> cleanly architected, well-tested, and maintainable enough to be accepted upstream.

If a proposed change does not support this goal, reconsider the design before proceeding.
