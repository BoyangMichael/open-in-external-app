# Design Decisions

This document captures key design decisions and guiding principles for the project.
It is meant to be updated as the architecture and implementation evolve.

---

## 1. Problem Scope and Philosophy

**Decision:** The project solves a general "Remote VS Code → External App" problem, not a
chemistry-only problem.

- Avogadro is only one example of a supported application.
- The extension should work for any desktop software that accepts a file path.

Examples of target applications include:

- Avogadro2
- VESTA
- ChimeraX
- PyMOL
- Blender
- ParaView
- OVITO
- ImageJ
- (and others)

**Implications:**

- Avoid hard-coding application-specific behavior.
- Keep configuration and logic generic (file types, commands, arguments).

---

## 2. Avoid Special Cases in Core Logic

**Decision:** Do not spread provider-specific conditionals (e.g. `if remote`, `if ssh`) across
core modules.

Instead:

- Isolate remote behavior behind clear abstractions (`FileResolver`, `ApplicationLauncher`).
- Use polymorphic implementations and configuration rather than scattered `if` statements.

**Implications:**

- Remote-specific logic belongs in resolver implementations.
- Launcher logic should be provider-agnostic and operate purely on local paths.

---

## 3. Prefer Composition and Clear Responsibilities

**Decision:** Separate the concerns of URI resolution, file transfer, and application launching.

- `FileResolver` handles:
  - interpreting VS Code URIs
  - deciding whether a file needs to be downloaded
  - performing downloads and caching

- `ApplicationLauncher` handles:
  - launching configured applications
  - command construction and argument formatting
  - platform differences (Windows/macOS/Linux)

**Implications:**

- Each component should have a single responsibility.
- New behavior should be added by composing these components, not by entangling their logic.

See `ARCHITECTURE.md` for more details.

---

## 4. Future-Proofing for Providers

**Decision:** The architecture must naturally extend to multiple VS Code providers without
rewriting launcher logic.

Target providers include:

- Remote-SSH
- WSL
- Dev Containers
- GitHub Codespaces
- Other remote/virtual filesystem providers

**Implications:**

- `FileResolver` must be URI-aware and provider-agnostic at the interface level.
- New providers should be supported via new resolver implementations, not via branching logic
  in unrelated modules.

---

## 5. Upstream Compatibility and Maintainability

**Decision:** Changes should be realistic to accept upstream.

- Preserve upstream coding style.
- Avoid unnecessary breaking changes.
- Keep commits small and reviewable.
- Document public APIs and configuration changes.

**Implications:**

- Favor incremental refactors over sweeping rewrites.
- Keep the default behavior for local files consistent with the existing extension.

---

## 6. Caching and Cleanup Strategy (Work in Progress)

**Decision (tentative):** Remote files will be cached locally in a configurable directory.
The precise cleanup policy is still under discussion.

Open questions:

- Should cache cleanup be time-based, manual, or on-demand?
- How should concurrent downloads of the same file be handled?
- How should cache invalidation interact with remote file changes (e.g. updated results)?

**Implications:**

- Initial implementation should favor correctness and simplicity.
- More advanced strategies can be introduced behind configuration once the basic behavior is stable.

Updates on this topic should be reflected here as they are decided.

---

## 7. Remote vs Local Application Execution (Future Direction)

**Decision (directional):** The primary focus is local application execution with downloaded
files. Remote application execution (e.g. launching GUI apps on a remote host) may be supported
later via dedicated launcher types.

Potential future design:

- `LocalApplicationLauncher` — opens files in local desktop applications.
- `RemoteApplicationLauncher` — uses SSH or other mechanisms to launch remote applications.

**Implications:**

- Do not mix remote execution concerns into the initial resolver/launcher implementation.
- Keep the design open to adding remote launchers later.

---

## 8. Documentation and Session Logging

**Decision:** Documentation and session logs are first-class artifacts.

- Significant design changes must be recorded in `DECISIONS.md` and/or `ARCHITECTURE.md`.
- Non-trivial AI-assisted work should be summarized in `SESSION_LOG.md`.

**Implications:**

- Future contributors (human or AI) should always consult these documents before making changes.
- The docs should be kept up to date with the code.

---

## How to Use This Document

When you make a notable design choice:

1. Add a short section here describing:
   - the decision
   - the rationale
   - key implications

2. Link to code, issues, or external design notes if needed.

This helps maintain a coherent architectural story as the project evolves.