# Project Context

## Background

This project is a fork of:

    tjx666/open-in-external-app

The original VS Code extension allows users to open files from VS Code in external
applications.

However, it assumes that the files exist on the **local filesystem**.

When using VS Code Remote-SSH (or other remote filesystem providers), the extension
fails because the selected file actually lives on a remote machine while the
external application runs locally.

Typical example:

    Local machine
        ├── VS Code UI
        ├── Avogadro2
        └── VESTA

               │

        Remote SSH

               │

        HPC Cluster
        ├── ORCA outputs
        ├── Gaussian outputs
        └── xyz/cif/pdb files

The goal is to make the extension work seamlessly in Remote-SSH and other
URI-based environments.

The user should simply right-click a remote file and choose:

    Open in External App

and have the local desktop application open the file **without manually downloading** it.

---

## Problem Statement

The core problems we are solving:

1. **Local-only assumptions**
   - The upstream extension assumes the file path is local.
   - It does not perform remote file transfer or URI-aware resolution.

2. **Remote-SSH and other providers**
   - In Remote-SSH, VS Code runs locally while files reside on a remote machine.
   - External desktop applications (Avogadro2, VESTA, etc.) also run locally.
   - The extension must detect remote URIs, download files, and launch the local app
     against the cached file.

3. **Extensibility beyond SSH**
   - We want to support multiple VS Code filesystem providers without rewriting core logic.
   - The solution should not be tied exclusively to Remote-SSH or to chemistry workflows.

---

## Vision

### Long-term Goal

Build a **URI-aware** extension that:

- Works seamlessly across all VS Code filesystem providers.
- Supports any desktop application that can open a file path.
- Is clean and maintainable enough to be accepted **upstream**.

The project should solve a general "Remote VS Code ⇄ External App" problem, not just
a chemistry-specific problem.

### Non-goals

- We are not building a chemistry-only tool.
- We are not tightly coupling to specific applications (Avogadro2, VESTA, etc.).
- We are not implementing a workaround-only hack; the solution should be
  architecturally sound.

---

## High-Level Approach

We replace the current, implicit architecture:

    File
      ↓
    spawn()

with an explicit, layered architecture:

    URI
     ↓
    FileResolver
     ↓
    ResolvedFile (local path + metadata)
     ↓
    ApplicationLauncher
     ↓
    spawn()

Key ideas:

- **FileResolver**
  - Knows about VS Code URIs and providers.
  - Decides if a file needs to be downloaded.
  - Handles remote file transfer and caching.
  - Returns a local filesystem path and related metadata.

- **ApplicationLauncher**
  - Knows how to launch applications with arguments.
  - Handles platform differences and argument formatting.
  - Does *not* care whether the original file was remote or local.

This separation allows us to support new URI providers by adding new resolvers
without changing the launcher logic.

---

## Constraints and Considerations

- **Upstream compatibility**
  - Preserve upstream coding style and conventions.
  - Keep changes reviewable and well-documented.
  - Avoid breaking existing behavior for local files.

- **Cross-platform behavior**
  - Support Windows, macOS, and Linux.
  - Keep platform-specific logic contained and testable.

- **Performance and reliability**
  - Avoid excessive downloads.
  - Consider caching, concurrency, and cache invalidation.
  - Ensure that temporary files are managed safely and predictably.

---

## Related Documents

- `ARCHITECTURE.md` — detailed architecture and component responsibilities.
- `DECISIONS.md` — design philosophy and key decisions.
- `ROADMAP.md` — milestones, feature plan, and quality goals.
- `CONTRIBUTING_AI.md` — guidelines for AI-assisted development.
- `AGENTS.md` — how AI agents collaborate across sessions.
- `SESSION_LOG.md` — chronological log of major AI-assisted sessions.