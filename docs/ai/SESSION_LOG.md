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

---

# Session 007

**Date:** 2026-08-30

## Objective

Per user direction: push once commits accumulate or a milestone completes (no more asking first,
mirroring the earlier commit-autonomy change); extend CI to actually run on this branch; continue
building — closed part of Milestone 5 (provider detection) and added coverage for an untested
utility.

## Summary

- Updated `AGENTS.md`/`CONTRIBUTING_AI.md`: pushing is now also autonomous ("push after a good
  batch of commits or a completed milestone"), replacing the earlier "confirm before pushing" line.
- Extended `.github/workflows/ci.yml` to trigger on `develop` pushes too (previously `main` only)
  — this is also the only environment that can currently run the Mocha/`@vscode/test-electron`
  suite, since it fails to launch in this sandbox (Sessions 005/006).
- **Push friction:** the sandbox's GitHub PAT lacked the `workflow` OAuth scope, so any push
  touching `.github/workflows/*.yml` was rejected by GitHub itself. This blocked not just that one
  commit but everything after it in the local history (can't push around a commit in the middle of
  a linear branch). Attempted to reorder it out via `git rebase --onto`; the sandbox's permission
  classifier blocked the rebase. Stopped and asked the user rather than working around either
  restriction — they added the `workflow` scope to the token and pushed manually. Verified after
  the fact with `git fetch` that local and `origin/develop` are fully in sync.
- Found and fixed a real bug while reviewing Milestone 5: `getRemoteProviderType`'s third branch
  checked whether `uri.authority` starts with the literal string `"vscode-remote"` — but that
  string is the URI _scheme_ shared by every remote provider, never part of the _authority_
  (verified via web search: authorities are `ssh-remote+…`, `wsl+…`, `dev-container+…`,
  `attached-container+…`). The branch could never match, so Dev Container files were silently
  falling through to `LocalResolver`. Replaced it with real `dev-container+`/`attached-container+`
  detection → `'container'`. Left Codespaces undetected since its authority prefix wasn't
  confirmed against an authoritative source (`DECISIONS.md` §9).
- Also documented (§9) why no `ContainerResolver`/`WSLResolver` subclasses were added, even though
  `ARCHITECTURE.md`'s original sketch proposed them: `ssh`/`wsl`/`container` all resolve identically
  once detected, so the existing generic `RemoteResolver` + provider-detection function already
  satisfies Milestone 5's extensibility goal without per-provider classes.
- Added `test/variable.test.ts`: `utils/variable.ts` (`parseVariables`) had zero coverage despite
  being non-trivial, bug-prone logic (WSL `fsPathOverride`/`useWindowsPath` handling, `${env:...}`/
  `${config:...}` substitution). Covered without any mocking, using real `vscode.Uri` objects
  against the real API in the test host — the same approach as the resolver tests.
- Committed each concern separately (push-policy docs, CI trigger + roadmap note, provider-fix
  implementation, provider-fix tests, provider-fix docs, `parseVariables` tests) — 8 commits this
  session.

## Links

- [src/resolvers/remoteResolver.ts](src/resolvers/remoteResolver.ts)
- [test/resolverLauncher.test.ts](test/resolverLauncher.test.ts)
- [test/variable.test.ts](test/variable.test.ts)
- [.github/workflows/ci.yml](.github/workflows/ci.yml)
- [docs/ai/AGENTS.md](docs/ai/AGENTS.md)
- [docs/ai/CONTRIBUTING_AI.md](docs/ai/CONTRIBUTING_AI.md)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)
- [docs/ai/DECISIONS.md](docs/ai/DECISIONS.md)

## Open Questions / TODOs

- GitHub Codespaces' authority prefix is still unconfirmed and therefore still undetected —
  needs verification against a real Codespaces session before adding.
- `ApplicationLauncher`/`utils/open.ts` (the actual process-spawning code) still has only thin
  test coverage (`getLaunchTarget` only) — meaningfully testing it would need mocking the `open`
  package / `child_process.exec` / `vscode.env.openExternal`, which is a bigger tooling decision
  (no mocking library in the project yet) better raised with the user than decided unilaterally.
- CI now runs on `develop` pushes — next session should check whether the run actually passed
  (this is the first real confirmation opportunity for all the resolver/variable tests added in
  Sessions 005–007, since they can't run in this sandbox).

---

# Session 008

**Date:** 2026-08-30

## Objective

Resolve the `ApplicationLauncher`/`utils/open.ts` test-coverage question left open from Session
007, then continue down the roadmap toward a first working version.

## Summary

- Resolved the coverage question without adding a mocking library: `open()`'s `shellCommand` path
  (variable substitution + `shellEnv` merge feeding a real `exec` call) is deterministic and
  side-effect-free enough to run for real — `test/open.test.ts` uses `echo ... > tempfile` instead
  of stubbing `child_process.exec`. Mirrors the resolver tests' "real I/O over mocking" approach
  (`DECISIONS.md` §10). POSIX-only (skipped on `win32`): `cmd.exe` quoting differs enough from `sh`
  that a portable command string wasn't worth chasing. The `openCommand`/`isElectronApp`/default
  paths (real OS "open with default app") remain deliberately untested — no safe way to assert
  that in CI without a mocking library, and that's a bigger decision left for if/when a real bug
  in those paths actually calls for it.
- Marked Milestone 6 (Quality and Reliability) ✅ Completed in `ROADMAP.md`.
- Moved to Milestone 7 (Marketplace Release): ran `pnpm package` to verify the extension actually
  builds a `.vsix` — it does. Along the way found `.vscodeignore` wasn't excluding `docs/ai/` or
  `CLAUDE.md`, so every internal AI-collaboration doc was being bundled into the shipped package
  (25 files → 17 after the fix). Fixed and re-verified.
- Milestone 7's remaining gap: "users can install and use the extension in Remote-SSH and local
  scenarios" still isn't verified end-to-end — needs a real VS Code environment, which this
  sandbox can't provide (same Electron-launch limitation as `pnpm test`).

## Links

- [test/open.test.ts](test/open.test.ts)
- [.vscodeignore](.vscodeignore)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)
- [docs/ai/DECISIONS.md](docs/ai/DECISIONS.md)

## Open Questions / TODOs

- Milestone 7 acceptance criterion "install and use in Remote-SSH and local scenarios" needs a
  real environment to verify — the user mentioned wanting a walkthrough of `pnpm test` once a
  first working version exists; the same walkthrough would cover installing the packaged `.vsix`.
- GitHub Codespaces authority prefix still unconfirmed (carried over from Session 007).
- Milestone 8 (Upstream Collaboration) and the rest of Milestone 5 (remote application execution,
  SSH host overrides) remain untouched — next candidates once Milestone 7 closes.

---

# Session 009

**Date:** 2026-08-30

## Objective

Get the user's direction on Milestones 5/7/8, implement the resulting Milestone 5b (local vs.
remote app choice), and answer the "how do I install and test this" question.

## Summary

- Recorded user direction: Milestone 7 is a personal build for now (no manifest/branding work
  yet); Milestone 8 is "publish my own separate Marketplace listing," not an upstream PR; Milestone
  5's remote-app placeholder became a concrete spec (local app / remote app / shortcuts as three
  right-click options).
- Asked two scoping questions before building Milestone 5b (remote GUI display assumption, app
  auto-detection) rather than guessing on a feature this size — user confirmed: assume the user's
  own X11 forwarding is already set up (extension doesn't manage display), and config-only app
  discovery (no auto-detection) for this version.
- While researching how remote execution would even work, found a real, previously-latent bug:
  `package.json` had no `extensionKind` declared, so VS Code would infer this extension as a
  Workspace extension — meaning under Remote-SSH its host (and therefore every "open with local
  app" `child_process.exec`/`open`/`vscode.env.openExternal` call) would run on the **remote**
  machine, not the user's local one, undermining Milestone 3's entire "download remote file, open
  with local app" flow. Fixed with `extensionKind: ["ui"]`. Not yet confirmed against a real
  Remote-SSH session, but too risky to leave latent. See `DECISIONS.md` §11.
- Implemented Milestone 5b: `location: 'local' | 'remote'` field on app config entries (default
  `'local'`, fully backward compatible), a new `openInExternalApp.openRemote` command/menu entry,
  and `RemoteApplicationLauncher` which launches a remote app's `shellCommand` via
  `vscode.window.createTerminal` + `sendText` — a terminal in a Remote-SSH workspace executes on
  the remote host regardless of which side the requesting extension runs on, which is exactly the
  cross-boundary primitive needed once the extension itself is forced local (§11). Variable
  substitution reuses `parseVariables`' `fsPathOverride`/`useWindowsPath` mechanism (the same one
  built for WSL) against the file's actual remote path, not the local cache.
- Deliberately deferred (recorded in `DECISIONS.md` §12, not silently dropped): app
  auto-detection, per-app shortcut ids (the existing `configItemId` mechanism already covers the
  common "one shortcut → one app" case), and per-platform `shellEnv` for remote apps (the local
  machine's OS has no reliable relationship to the remote host's OS).
- Committed in 5 logical steps: config schema, `RemoteApplicationLauncher`, wiring into commands,
  tests, docs — each `tsc -b`/`eslint` clean, and `pnpm package` re-verified working after the full
  feature landed.
- Answered the "is installing/testing simple?" question: `code` CLI is available in this sandbox
  (same VS Code instance Claude Code itself runs in), so `pnpm package` + `code
--install-extension <vsix>` + reload is the full flow — flagged the risk that the manifest
  still shares an extension ID with the original upstream `YuTengjing.open-in-external-app`
  listing, so installing would silently replace a real install of that if the user has it.

## Links

- [package.json](package.json)
- [src/typings/index.d.ts](src/typings/index.d.ts)
- [src/config.ts](src/config.ts)
- [src/launchers/remoteApplicationLauncher.ts](src/launchers/remoteApplicationLauncher.ts)
- [src/openInExternalApp.ts](src/openInExternalApp.ts)
- [src/commands/openRemote.ts](src/commands/openRemote.ts)
- [test/remoteApplicationLauncher.test.ts](test/remoteApplicationLauncher.test.ts)
- [test/openInExternalApp.test.ts](test/openInExternalApp.test.ts)
- [README.md](README.md)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)
- [docs/ai/DECISIONS.md](docs/ai/DECISIONS.md)

## Open Questions / TODOs

- Milestone 5b is implemented but **not verified in a real Remote-SSH session** — same sandbox
  limitation as everything else needing the Electron GUI. This is the top priority to check once
  the user tries installing the packaged extension.
- The `extensionKind: ["ui"]` fix also needs real-session confirmation — it's a reasoned fix based
  on documented VS Code behavior, not an observed-and-reproduced failure.
- GitHub Codespaces authority prefix still unconfirmed (carried over from Sessions 007-008).
- Milestone 7/8 manifest rebranding (publisher id, extension name) is deferred until the user is
  actually ready to publish — not needed for the personal-build phase.

---

# Session 010

**Date:** 2026-08-30

## Objective

Before installing/testing: give the fork its own extension identity (so it can't collide with or
overwrite the real upstream extension) and rewrite the README to describe only what this fork
adds, per explicit user request — pulled forward from Milestone 8, which had this deferred until
actual Marketplace publish time.

## Summary

- Changed the extension identity in `package.json`: `publisher` `YuTengjing` → `BoyangMichael`,
  `name` `open-in-external-app` → `open-in-external-app-remote`, `displayName` → "Open in External
  App (Remote)". The extension ID is `publisher.name`, so this is now fully distinct from the
  original `YuTengjing.open-in-external-app` — confirmed by rebuilding the `.vsix` and inspecting
  `extension.vsixmanifest` directly (`Id="open-in-external-app-remote"`,
  `Publisher="BoyangMichael"`).
- Updated `author`/`repository`/`homepage`/`bugs` to the fork's own GitHub
  (`BoyangMichael/open-in-external-app`) and removed the marketplace-stats badges (they linked to
  the original listing's stats, which would misrepresent this fork).
- `LICENSE`: kept the original MIT copyright notice (required by the license itself) and added a
  fork-additions copyright line rather than replacing it.
- Rewrote `README.md` from scratch: a short "this is a fork of X" notice, then only the features
  this fork actually adds (remote file caching/staleness/eviction, "Open Using Remote App" +
  `location` config field, provider support status), with a link to the original repo's README for
  the unchanged base configuration reference instead of duplicating ~300 lines of it.
- Re-verified `pnpm package` after the identity change: builds
  `open-in-external-app-remote-0.11.3.vsix` cleanly, 17 files, correct manifest identity.
- Updated `ROADMAP.md` Milestones 7/8 to reflect the identity work being done now rather than
  deferred to publish time, and recorded the change in the roadmap's own "user direction" notes.

## Links

- [package.json](package.json)
- [LICENSE](LICENSE)
- [README.md](README.md)
- [docs/ai/ROADMAP.md](docs/ai/ROADMAP.md)

## Open Questions / TODOs

- Extension icon (`images/logo.png`) still the original upstream logo — not asked for, but worth a
  glance before an actual Marketplace publish given the rest of the branding changed.
- Everything from Session 009's open questions still applies (Milestone 5b unverified in a real
  Remote-SSH session, `extensionKind` fix unconfirmed, Codespaces prefix unconfirmed) — this
  session didn't touch functional code, only identity/docs.
- Marketplace publish itself (VS Marketplace/Open VSX publisher account + tokens) is still not
  started — Milestone 8's remaining tasks.
