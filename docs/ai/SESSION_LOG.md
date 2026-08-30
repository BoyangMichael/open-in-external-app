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

---

# Session 002

**Date:** 2026-07-24

## Objective

Introduce the first URI-aware abstraction layer while preserving existing local-file behavior.

## Summary

- Added a small `FileResolver` abstraction with a `LocalResolver` implementation.
- Added an `ApplicationLauncher` wrapper that preserves the current launch flow for local files.
- Wired the main extension entry point through the new abstractions so the command path now resolves a URI to a local path before launching.
- Added a regression test covering local resolution and launcher target extraction.
- Verified the project compiles successfully with the test build.

## Links

- [src/resolvers/baseResolver.ts](src/resolvers/baseResolver.ts)
- [src/resolvers/localResolver.ts](src/resolvers/localResolver.ts)
- [src/launchers/applicationLauncher.ts](src/launchers/applicationLauncher.ts)
- [src/openInExternalApp.ts](src/openInExternalApp.ts)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)

## Open Questions / TODOs

- Implement a remote resolver for Remote-SSH and other URI providers.
- Decide how cached remote files should be invalidated and cleaned up.

---

# Session 003

**Date:** 2026-07-24

## Objective

Implement the first remote-aware resolver path for URI-based files and add initial cache configuration.

## Summary

- Added a `RemoteResolver` that detects Remote-SSH-style URIs and resolves them to a local cache path.
- Added a configurable `openInExternalApp.cacheDir` setting so cached remote files can be stored in a user-defined location.
- Switched the main extension flow to use the remote-aware resolver while preserving local behavior.
- Added a regression test for remote provider detection.
- Verified the project compiles successfully with the test build.

## Links

- [src/resolvers/remoteResolver.ts](src/resolvers/remoteResolver.ts)
- [src/openInExternalApp.ts](src/openInExternalApp.ts)
- [package.json](package.json)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)

## Open Questions / TODOs

- Add more robust remote file download handling and cache invalidation.
- Extend support to additional providers beyond the initial Remote-SSH-style detection.

---

# Session 004

**Date:** 2026-07-24

## Objective

Refine the remote resolver implementation and keep the AI documentation aligned with the latest code changes.

## Summary

- Improved the remote cache path construction to use a deterministic, file-name-based cache target.
- Added regression coverage for repeated resolution of the same remote URI.
- Kept the AI documentation in sync with the implementation progress so future contributors can follow the architecture evolution.
- Established a working convention: whenever code changes are made, the corresponding AI documentation should be updated in the same pass.

## Links

- [src/resolvers/remoteResolver.ts](src/resolvers/remoteResolver.ts)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)
- [docs/ai/SESSION_LOG.md](docs/ai/SESSION_LOG.md)

## Open Questions / TODOs

- Add cache invalidation and cleanup heuristics for downloaded remote files.
- Extend the resolver layer to support additional URI providers beyond the initial Remote-SSH-style path.

---

# Session 005

**Date:** 2026-08-30

## Objective

Revert an abandoned, unwired `normalizedPath`/`remoteMetadata` WIP change to `ResolvedFile`, then
address the staleness and error-handling gaps identified in Milestone 3's caching implementation
(Milestone 3b).

## Summary

- Reverted uncommitted changes to `baseResolver.ts`, `localResolver.ts`, and `remoteResolver.ts`
  that had added `normalizedPath`/`remoteMetadata` fields to `ResolvedFile` with no consumer
  anywhere in the codebase — the author didn't recall the intent behind them, so they were dropped
  rather than finished blind.
- Added Milestone 3b to `ROADMAP.md` and decisions 6a/6b to `DECISIONS.md` covering: cache
  staleness detection, resilient error handling on remote stat/download failure, and (still open)
  cache eviction policy.
- Implemented staleness detection in `RemoteResolver`: before reusing a cached file, its remote
  `mtime` (via `workspace.fs.stat`) is compared against an `mtime` recorded in a JSON sidecar
  (`<cachePath>.meta.json`) from the last successful download; a mismatch triggers a re-download.
- Implemented resilient error handling: a failed remote `stat`/`readFile` falls back to an existing
  stale cached copy with a `showWarningMessage`, or shows a `showErrorMessage` and rethrows when no
  cache exists yet. Added `msg.error.remoteFileUnavailable` / `msg.warning.remoteFileStale` to
  `package.nls.json`.
- Added a `readJson<T>` helper to `utils/fs.ts`.
- `ResolvedFile.cacheInfo` for the remote path now carries `{ cachePath, cached, refreshed, stale }`
  so callers/tests can observe which of the three outcomes (fresh reuse, refresh, stale fallback)
  occurred.
- Added three new tests in `test/resolverLauncher.test.ts` covering cache reuse, refresh-on-change,
  and stale-fallback-on-error, using a `file://` URI with a forged `ssh-remote+` authority so the
  tests exercise real filesystem I/O without an actual remote connection; each test isolates its
  own cache dir via `openInExternalApp.cacheDir` config to avoid cross-test pollution (the cache
  key is only `authority + basename`, not the full path).
- Verified with `tsc -b`, `eslint`, and `prettier --check` — all clean. **Could not run the actual
  Mocha/`@vscode/test-electron` suite in this sandbox**: the downloaded VS Code Insiders binary
  fails to launch at all (`bad option: --disable-extensions`, exit code 9), independent of this
  change. The new tests need to be run in a real dev environment (`pnpm test`) to confirm.

## Links

- [src/resolvers/remoteResolver.ts](src/resolvers/remoteResolver.ts)
- [src/utils/fs.ts](src/utils/fs.ts)
- [package.nls.json](package.nls.json)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)
- [docs/ai/DECISIONS.md](docs/ai/DECISIONS.md)

## Open Questions / TODOs

- Cache eviction/cleanup policy is still undecided (time-based vs. manual vs. size-based) —
  Milestone 3b task 3, not yet implemented.
- `pnpm test` needs to be run in a real environment to confirm the new tests pass; not verified in
  this session beyond typecheck/lint.
- Sessions 003 and 004's commits (`123da84`, `80874df`) landed after `AGENTS.md`'s doc-sync rule
  existed but this log wasn't updated between commit `cb683f6` and this session — worth keeping an
  eye on so the log doesn't drift from `git log` again.

---

# Session 006

**Date:** 2026-08-30

## Objective

Per user request: change the commit workflow rule to allow autonomous, frequent commits (no more
asking before each commit); split Session 005's pending changes into separate commits by content;
close out the last open item from Milestone 3b (cache eviction policy).

## Summary

- Updated `AGENTS.md` and `CONTRIBUTING_AI.md`: replaced "ask before committing" with "commit
  autonomously and often, split unrelated concerns into separate commits." Pushing to the remote
  remains a separate, explicit decision requiring confirmation.
- Committed Session 005's work as 6 separate commits instead of one, grouped by concern: the
  workflow-rule change, `CLAUDE.md`, the roadmap/decisions planning update, the resolver
  implementation, the tests, and this log.
- Closed Milestone 3b's last open item: decided and implemented a cache eviction policy —
  time-based, opportunistic pruning. `maybePruneRemoteCache()` runs once per extension activation
  (fire-and-forget from `activate()`), deleting cached files (and `.meta.json` sidecars) whose
  mtime exceeds `openInExternalApp.cacheMaxAgeDays` (new setting, default 7 days, `0` disables it).
  Documented the rationale in `DECISIONS.md` §6c (why time-based/opportunistic over a background
  timer or manual command) and marked Milestone 3b ✅ Completed in `ROADMAP.md`.
- Extracted `getConfiguredCacheDir()` in `remoteResolver.ts` so `resolve()` and pruning share cache
  dir resolution instead of duplicating the config lookup.
- Added tests for `pruneStaleCache`: removes entries past `maxAgeMs` (plus their sidecar), keeps
  fresh ones, and does nothing when `maxAgeMs` is `0`.
- Committed this second batch as 3 more commits (decision docs, implementation, tests) — 9 commits
  total across the session, each `tsc -b`/`eslint`/`prettier --check` clean before committing.
- Same sandbox limitation as Session 005: could not run the actual `pnpm test` Mocha/Electron
  suite here; verified via typecheck/lint only.

## Links

- [src/resolvers/remoteResolver.ts](src/resolvers/remoteResolver.ts)
- [src/extension.ts](src/extension.ts)
- [package.json](package.json)
- [package.nls.json](package.nls.json)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)
- [docs/ai/AGENTS.md](docs/ai/AGENTS.md)
- [docs/ai/CONTRIBUTING_AI.md](docs/ai/CONTRIBUTING_AI.md)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)
- [docs/ai/DECISIONS.md](docs/ai/DECISIONS.md)

## Open Questions / TODOs

- `pnpm test` still needs to run in a real environment to confirm all new tests (Sessions 005 and 006) actually pass — not verified beyond typecheck/lint in either session.
- Milestone 3b is now fully closed. Size-based cache eviction and a manual "clear cache" command
  remain explicitly open/deferred (`DECISIONS.md` §6c) if time-based pruning proves insufficient.
- Next roadmap items are Milestone 5 (config/provider extensibility beyond SSH — WSL/Dev
  Containers/Codespaces resolvers) and Milestone 6 (CI setup, which would also resolve the
  can't-run-tests-here limitation by giving the project an environment where they actually run).
