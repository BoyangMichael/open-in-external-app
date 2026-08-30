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

## Milestone 3b — Cache Correctness & Resilience 🚧 In Progress

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
3. **Cache eviction policy (open design question, not yet implemented):** decide whether cleanup
   is time-based, size-based, or a manual command, and implement it. Revisit
   `ARCHITECTURE.md` → "Open Questions" and `DECISIONS.md` §6 when this is decided.

**Acceptance criteria:**

- Reopening a remote file that changed on the remote side opens the updated content, not a stale
  cached copy.
- Reopening an unchanged remote file does not re-download it.
- A remote stat/download failure with an existing cache shows a warning and still opens the
  (possibly outdated) cached copy, rather than failing silently or crashing the command.
- Tests cover: cache reuse when unchanged, refresh when changed, and fallback-to-stale-cache on
  error.

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

## Milestone 5 — Configuration and Provider Support

**Goals:**

- Provide flexible configuration for applications and providers.
- Prepare for additional providers beyond Remote-SSH.

**Tasks:**

- Support configuration of:
  - local applications
  - (future) remote applications
  - cache directory
  - SSH host overrides and provider-specific options
- Design configuration schema to be extensible for WSL, Dev Containers,
  Codespaces, and others.

**Acceptance criteria:**

- Users can configure applications and cache behavior via settings.
- The configuration model leaves room for additional providers without major
  rewrites.

---

## Milestone 6 — Quality and Reliability

**Goals:**

- Raise the overall quality bar for the project.

**Tasks:**

- Add logging around URI resolution, downloads, and application launch.
- Introduce automated tests for resolvers and launcher behavior.
- Set up CI (build + tests) for the repository.
- Improve user and contributor documentation.

**Acceptance criteria:**

- Core features are covered by tests.
- CI runs on each commit/PR.
- Documentation reflects actual behavior and configuration.

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
