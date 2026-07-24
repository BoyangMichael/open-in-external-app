# AI Session Log

This document records significant AI-assisted development sessions.
Its purpose is to provide context for future work and enable smooth handoffs
between different AI assistants or human contributors.

Each session entry should be brief but informative: what was done, why, and
what remains open.

---

## Template for New Sessions

When you add a new session, follow this structure:

```text
# Session NNN

**Date:** YYYY-MM-DD

## Objective

Short description of what this session aimed to achieve.

## Summary

Bullet points or a short paragraph describing:
- Key changes made.
- Important design decisions.
- Any limitations or follow-ups.

## Links

- PRs, commits, or files touched (if available).

## Open Questions / TODOs

- Items for future sessions to consider.
```

---

# Session 001

**Date:** 2026-07-24

## Objective

Investigate how to make the VS Code extension `open-in-external-app` work
seamlessly with Remote-SSH workspaces and define a clean, URI-aware
architecture.

## Summary

- Clarified the main problem: the upstream extension assumes local files and
  fails in Remote-SSH scenarios.
- Described typical workflows where VS Code runs locally, files live on a
  remote HPC cluster, and external desktop applications run on the local
  machine.
- Confirmed that users should be able to right-click a remote file and choose
  "Open in External App" without manual downloads.
- Reviewed a previous prototype that:
  - executed on the UI side (`extensionKind: ["ui"]`)
  - downloaded remote files using the VS Code filesystem API
  - supported both local and remote application execution
  - introduced configurable download directories and SSH host detection
  - updated settings, schemas, and documentation
- Decided to rebuild the functionality cleanly from first principles while
  preserving successful design ideas from the prototype.
- Established a URI-aware design direction, aiming to support:
  - Remote SSH
  - WSL (future)
  - Dev Containers (future)
  - GitHub Codespaces (future)
  - Other VS Code URI providers (future)
- Proposed an architecture based on `FileResolver` and `ApplicationLauncher`:

  - Old model:

        File
          ↓
        spawn()

  - New model:

        URI
         ↓
        FileResolver
         ↓
        ResolvedFile
         ↓
        ApplicationLauncher
         ↓
        spawn()

- Recorded key responsibilities:
  - `FileResolver`: resolve VS Code URIs, download remote files when necessary,
    return a local filesystem path.
  - `ApplicationLauncher`: launch configured applications, independent of where
    the file originated.
- Confirmed that this separation minimizes special cases and simplifies future
  extensions.
- Created a fork repository for ongoing work:

  - https://github.com/BoyangMichael/open-in-external-app

- Drafted an immediate roadmap:
  - Verify the upstream project builds unchanged.
  - Document the current architecture.
  - Introduce `FileResolver` abstraction.
  - Implement Remote-SSH resolver.
  - Preserve existing functionality.
  - Add tests and documentation.
  - Publish a VSIX release.
  - Consider an upstream pull request.

## Decisions

- Treat this as a long-term open-source project rather than a one-off
  modification.
- Prefer clean abstractions over scattered `if (remote)` conditionals.
- Keep commits small and reviewable.
- Preserve upstream coding style whenever possible.
- Design for extensibility instead of solving only the current use case.

## Open Questions / TODOs

- Where is the cleanest integration point for URI resolution?
- Should remote downloads be cached permanently or cleaned up automatically?
- How should concurrent downloads of the same file be handled?
- What is the best strategy for cache invalidation?
- Next steps for implementation:
  - Inspect the repository architecture.
  - Identify extension entry points.
  - Design the `FileResolver` interface.
  - Create the first implementation milestone.