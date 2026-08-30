# Development Roadmap

This roadmap describes the planned evolution of the project. It is a living
document and should be updated as milestones are completed or refined.

---

## Milestone 1 — Project Setup ✅ Completed

**Goals:**

- Fork the upstream repository.
- Verify the build and extension packaging.
- Create an initial feature branch for remote/URI work.

**Acceptance criteria:**

- The fork builds and runs with behavior identical to upstream for local files.
- Basic development workflow (build, test, package) is documented.

---

## Milestone 2 — Architecture Refactor ✅ Completed

**Goals:**

- Introduce the `FileResolver` and `ApplicationLauncher` abstractions.
- Keep behavior unchanged for local files.

**Tasks:**

- Identify current extension entry points (commands, activations).
- Define interfaces for `FileResolver` and `ApplicationLauncher`.
- Implement a `LocalResolver` and a basic launcher that preserves existing behavior.
- Update `ARCHITECTURE.md` and `DECISIONS.md` to describe the new structure.

**Acceptance criteria:**

- All existing functionality continues to work for local files.
- The code clearly separates "resolve URI" from "launch application".

---

## Milestone 3 — Remote File Synchronization ✅ Completed

**Goals:**

- Support resolving remote URIs (initially Remote-SSH).
- Download remote files to a local cache directory using VS Code APIs.

**Tasks:**

- Detect `vscode-remote://` URIs and extract provider information.
- Implement `RemoteSSHResolver` using `workspace.fs`.
- Introduce configuration for the cache directory.
- Design initial cleanup strategy (manual or basic automatic cleanup).

**Acceptance criteria:**

- A remote file in a Remote-SSH workspace can be resolved to a local path.
- Downloads succeed and cached files are usable by local applications.
- Configuration options for cache location are documented.

---

## Milestone 3b — Cache Correctness & Resilience ✅ Completed

**Why:** Follow-up gaps identified while reviewing Milestone 3: the resolver caches by
`authority + filename` only, so it never notices when the remote file itself has changed, and it
has no error handling around the remote stat/download call. Neither is covered by the existing
test suite. See `DECISIONS.md` §6 for the caching decision this refines.

**Goals:**

- Detect when a cached remote file is stale relative to the remote source and refresh it
  automatically.
- Fail gracefully (user-facing message, not an unhandled rejection) when the remote file can't be
  reached, falling back to a stale cached copy when one exists.
- Define and implement a cache cleanup/eviction policy so the cache directory doesn't grow
  unbounded.

**Tasks:**

1. **Staleness detection (highest priority):** compare the remote file's mtime (via
   `workspace.fs.stat`) against the mtime recorded when it was last cached; re-download when they
   differ. Persist the recorded mtime alongside the cached file (e.g. a small sidecar metadata
   file) so this survives extension/window reloads.
2. **Resilient error handling:** wrap the remote `stat`/`readFile` calls so failures produce a
   `vscode.window.show*Message` instead of propagating as an unhandled rejection; if a cached copy
   already exists, fall back to it (with a warning) instead of failing the whole "Open in External
   App" action.
3. **Cache eviction policy (decided — time-based, opportunistic):** `maybePruneRemoteCache` runs
   once on extension activation and deletes cached files (and their sidecar metadata) whose mtime
   is older than the configurable `openInExternalApp.cacheMaxAgeDays` (default 7 days; `0`
   disables it). See `DECISIONS.md` §6c for the rationale and what's still open (size-based
   eviction, a manual "clear cache" command).

**Acceptance criteria:**

- Reopening a remote file that changed on the remote side opens the updated content, not a stale
  cached copy. ✅
- Reopening an unchanged remote file does not re-download it. ✅
- A remote stat/download failure with an existing cache shows a warning and still opens the
  (possibly outdated) cached copy, rather than failing silently or crashing the command. ✅
- Tests cover: cache reuse when unchanged, refresh when changed, fallback-to-stale-cache on error,
  and cache pruning behavior. ✅

---

## Milestone 4 — Application Launch for Resolved Files

**Goals:**

- Open resolved (downloaded) files in local applications via `ApplicationLauncher`.

**Tasks:**

- Wire `FileResolver` output (`ResolvedFile`) into the launcher.
- Ensure platform-appropriate command construction (Windows/macOS/Linux).
- Handle basic error reporting when applications fail to launch.

**Acceptance criteria:**

- In a Remote-SSH workspace, "Open in External App" opens the file in the chosen
  local application without manual download.

---

## Milestone 5 — Configuration and Provider Support 🚧 In Progress

**Goals:**

- Provide flexible configuration for applications and providers.
- Prepare for additional providers beyond Remote-SSH.

**Tasks:**

- Support configuration of:
  - local applications ✅
  - (future) remote applications — not started
  - cache directory ✅ (`openInExternalApp.cacheDir`, `openInExternalApp.cacheMaxAgeDays`)
  - SSH host overrides and provider-specific options — not started
- Design configuration schema to be extensible for WSL, Dev Containers, Codespaces, and others.
  - WSL ✅ already worked via the generic `RemoteResolver` path (no provider-specific code needed
    beyond authority detection).
  - Dev Containers ✅ fixed: `getRemoteProviderType` now detects `dev-container+`/
    `attached-container+` authorities (previously dead-code detection meant these silently fell
    through to `LocalResolver`). See `DECISIONS.md` §9.
  - Codespaces — still undetected; the authority prefix wasn't confirmed against an authoritative
    source, so `DECISIONS.md` §9 deliberately left it unguessed rather than risk a wrong prefix
    check. Needs verification (ideally against a real Codespaces session) before adding.
  - Decided against per-provider resolver classes (`ContainerResolver`, `WSLResolver`, etc.) — see
    `DECISIONS.md` §9 for why the existing generic `RemoteResolver` covers this without them.

**Acceptance criteria:**

- Users can configure applications and cache behavior via settings. ✅
- The configuration model leaves room for additional providers without major rewrites. ✅ (adding
  a provider is a one-line addition to `getRemoteProviderType`, confirmed by the Dev Container fix)

---

## Milestone 6 — Quality and Reliability 🚧 In Progress

**Goals:**

- Raise the overall quality bar for the project.

**Tasks:**

- Add logging around URI resolution, downloads, and application launch. ✅ (see
  `RemoteResolver`/`utils/logger.ts` usage from Milestone 3b)
- Introduce automated tests for resolvers and launcher behavior. ✅ for `RemoteResolver`
  (staleness, fallback, pruning); `ApplicationLauncher`/`utils/open.ts` still only has thin
  coverage (`getLaunchTarget` only).
- Set up CI (build + tests) for the repository. ✅ already existed (`.github/workflows/ci.yml`,
  runs `pnpm test` via `xvfb-run` on Linux + native on macOS/Windows) but only triggered on
  `main` pushes — extended to also trigger on `develop` so work lands with CI feedback instead of
  only at merge time. This is also the only environment that can currently run the Mocha/Electron
  suite (`pnpm test` fails to launch VS Code in this sandbox — see `SESSION_LOG.md` sessions
  005/006).
- Improve user and contributor documentation. ✅ ongoing via `docs/ai/` and `CLAUDE.md`.

**Acceptance criteria:**

- Core features are covered by tests. — resolver layer done; launcher/`utils/open.ts` still thin.
- CI runs on each commit/PR. — runs on push to `main`/`develop`; no `pull_request` trigger yet
  (not needed for a single-maintainer fork without external PRs).
- Documentation reflects actual behavior and configuration. ✅

---

## Milestone 7 — Marketplace Release

**Goals:**

- Publish a VSIX and, potentially, a marketplace entry for the fork.

**Tasks:**

- Finalize extension manifest and branding.
- Prepare release notes describing features and limitations.
- Build and test the VSIX package.

**Acceptance criteria:**

- A downloadable VSIX is available.
- Users can install and use the extension in Remote-SSH and local scenarios.

---

## Milestone 8 — Upstream Collaboration

**Goals:**

- Explore contributing the improvements back to the upstream project.

**Tasks:**

- Review differences between the fork and upstream.
- Identify changes that are suitable for an upstream pull request.
- Prepare a well-documented PR with clear motivation and tests.

**Acceptance criteria:**

- A serious upstream PR is drafted and discussed.
- Even if not immediately accepted, the fork remains in a maintainable state.

---

## Keeping the Roadmap Updated

Future contributors (human or AI) should:

- Update milestone status (e.g. "in progress", "completed") as work evolves.
- Add new milestones if major new features or provider support is planned.
- Reflect significant changes in `DECISIONS.md` and `ARCHITECTURE.md`.
