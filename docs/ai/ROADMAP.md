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

## Milestone 4 — Application Launch for Resolved Files ✅ Completed

**Goals:**

- Open resolved (downloaded) files in local applications via `ApplicationLauncher`.

**Tasks:**

- Wire `FileResolver` output (`ResolvedFile`) into the launcher. ✅ (Session 002)
- Ensure platform-appropriate command construction (Windows/macOS/Linux). ✅ (`utils/open.ts`:
  WSL path conversion, Windows non-ASCII/UTF-8 handling, per-platform `shellEnv`)
- Handle basic error reporting when applications fail to launch. ✅ `shellCommand` failures
  (`showErrorMessage`, pre-existing) and remote resolve failures (Milestone 3b's
  `showWarningMessage`/`showErrorMessage`); the `openCommand`/default-app paths don't surface
  launch failures back to the UI — `open`/`vscode.env.openExternal` don't reliably report them,
  and this hasn't come up as a real problem yet.

**Acceptance criteria:**

- In a Remote-SSH workspace, "Open in External App" opens the file in the chosen local
  application without manual download. — implemented and unit-tested at the resolver/launcher
  boundary; true end-to-end confirmation still needs a real Remote-SSH session (same gap as
  Milestone 7's acceptance criterion).

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

## Milestone 5b — Local vs. Remote App Choice ✅ Implemented (unverified end-to-end)

**Why:** User-defined goal (2026-08-30), more concrete than Milestone 5's original "(future) remote
applications" placeholder.

**Scope, as confirmed by the user (2026-08-30):**

- Remote GUI display: assume the user's own X11 forwarding (or equivalent) is already set up —
  the extension only launches the app remotely, it doesn't manage display forwarding.
- App discovery: config-only for now, no auto-detection (of local or remote apps). See
  `DECISIONS.md` §12 for the full design record.

**Implemented:**

1. **Open using local app** — unchanged existing behavior (`openInExternalApp.open`).
2. **Open using remote app** — new `openInExternalApp.openRemote` command/context-menu entry.
   Filters a matched config item's apps to `location: 'remote'` ones and launches via the new
   `RemoteApplicationLauncher` (`vscode.window.createTerminal` + `sendText`, per `DECISIONS.md`
   §11's finding), against the file's actual remote path
   (`resolvedFile.originalUri.path`) rather than a local cache. Depends on
   `extensionKind: ["ui"]` (§11) so the extension host — and therefore the command dispatch — is
   guaranteed to run locally even though the launched terminal itself is remote.
3. **User-defined shortcuts** — reuses the existing `configItemId` keybinding mechanism unchanged
   (works for both local and remote apps already); a finer-grained per-app shortcut id was scoped
   out (see `DECISIONS.md` §12 "Explicitly deferred").

`openInExternalApp.openMapper` apps gained an optional `location: 'local' | 'remote'` field
(default `'local'`) — every config written before this field existed keeps working identically.

**Acceptance criteria:**

- Right-clicking a file shows both "Open in External App" (local) and "Open Using Remote App"
  (remote) menu entries. ✅
- A remote app launches via a real terminal, using the file's remote path. — implemented and
  unit-tested at the command-construction level (`buildRemoteCommand`,
  `filterAppsByLocation`); **actual launch in a real Remote-SSH session is not yet verified** —
  this sandbox can't run the Electron GUI needed for that.
- Shortcuts can target either a local or a remote app. ✅ (existing `configItemId` mechanism,
  unchanged)

---

## Milestone 6 — Quality and Reliability ✅ Completed

**Goals:**

- Raise the overall quality bar for the project.

**Tasks:**

- Add logging around URI resolution, downloads, and application launch. ✅ (see
  `RemoteResolver`/`utils/logger.ts` usage from Milestone 3b)
- Introduce automated tests for resolvers and launcher behavior. ✅ `RemoteResolver` (staleness,
  fallback, pruning, provider detection), `parseVariables` (path/env/config substitution), and
  `open()`'s `shellCommand` path (variable substitution + `shellEnv` merge into a real `exec`
  call — no mocking library needed for this, see `DECISIONS.md` §10). The `openCommand`/
  `isElectronApp`/default paths (which spawn real OS "open with default app" behavior) remain
  deliberately untested — no safe, deterministic way to assert that in CI.
- Set up CI (build + tests) for the repository. ✅ already existed (`.github/workflows/ci.yml`,
  runs `pnpm test` via `xvfb-run` on Linux + native on macOS/Windows) but only triggered on
  `main` pushes — extended to also trigger on `develop` so work lands with CI feedback instead of
  only at merge time. This is also the only environment that can currently run the Mocha/Electron
  suite (`pnpm test` fails to launch VS Code in this sandbox — see `SESSION_LOG.md` sessions
  005/006).
- Improve user and contributor documentation. ✅ ongoing via `docs/ai/` and `CLAUDE.md`.

**Acceptance criteria:**

- Core features are covered by tests. ✅ resolver layer + `parseVariables` + `open()`'s
  `shellCommand` path; the OS-level "open with default app" paths are deliberately left untested
  (see `DECISIONS.md` §10) rather than adding a mocking library for uncertain benefit.
- CI runs on each commit/PR. ✅ for commits (push to `main`/`develop`); no `pull_request` trigger
  (not needed for a single-maintainer fork without external PRs).
- Documentation reflects actual behavior and configuration. ✅

---

## Milestone 7 — Personal Build Now, Marketplace Later 🚧 In Progress

**User direction (2026-08-30):** right now this is a personal build for the user's own use — no
rebranding/manifest work needed yet. Eventually (see Milestone 8) they do want to publish it as
its own listing on the VS Code Marketplace for anyone to install — that's a distinct goal from
upstreaming (Milestone 8 used to conflate the two; no longer does). Manifest/branding work
(distinct `publisher`, possibly `name`, since it can't stay under the original author's
`YuTengjing` publisher — see Milestone 8) is deferred until they're actually ready to publish, not
done preemptively.

**Tasks:**

- Finalize extension manifest and branding. — deferred until publish time (see Milestone 8).
- Prepare release notes describing features and limitations. — deferred until publish time.
- Build and test the VSIX package for personal use. ✅ `pnpm package` (`vsce package
--no-dependencies`) verified working: produces a clean 17-file `.vsix`. Found and fixed a
  packaging gap along the way — `.vscodeignore` didn't exclude `docs/ai/` or `CLAUDE.md`, so every
  AI-collaboration process doc was being bundled in; excluded now. "Tested" here means packaging
  succeeds and the file list is correct — actual install-and-use-it-in-Remote-SSH verification
  still needs a real VS Code environment (this sandbox can't run the Electron GUI).

**Acceptance criteria:**

- A downloadable VSIX is available for personal install. ✅ builds cleanly via `pnpm package`.
- Users can install and use the extension in Remote-SSH and local scenarios. — not yet verified
  end-to-end; needs a real VS Code + Remote-SSH session to confirm.

---

## Milestone 8 — Publish to the Marketplace (Not Upstream)

**User direction (2026-08-30):** no upstream PR to `tjx666/open-in-external-app` for now — instead,
publish this fork as its **own separate** listing on the VS Code Marketplace so anyone can install
it. This is a different goal from the original "upstream collaboration" framing (kept the milestone
number; renamed to match).

**Implications carried over from Milestone 7:**

- Needs a distinct `publisher` (can't publish under `YuTengjing`, the original author's publisher
  id, without their account) and likely a distinct extension `name`/`displayName` to avoid
  collision/confusion with the original `YuTengjing.open-in-external-app` listing — including the
  practical risk that installing a same-ID `.vsix` locally would silently overwrite an existing
  install of the real upstream extension if the user has both. Not done yet — deferred to when
  they're ready to actually publish (Milestone 7).
- `package.json` already has `publish:vs-marketplace`/`publish:open-vsx` scripts and
  `.github/workflows/ci.yml` already has a tag-triggered publish job — both assume the original
  publisher's marketplace tokens (`VS_MARKETPLACE_TOKEN`/`OPEN_VSX_TOKEN` secrets); will need the
  user's own tokens once they're ready to publish under their own identity.

**Tasks:**

- Decide on a publisher id, extension name, and branding (deferred — see Milestone 7).
- Set up the user's own VS Marketplace/Open VSX publisher account and tokens.
- Publish an initial release.

**Acceptance criteria:**

- The extension is published under the user's own publisher id and installable by anyone from the
  VS Code Marketplace (and/or Open VSX).
- No upstream PR is required or expected for this milestone.

---

## Keeping the Roadmap Updated

Future contributors (human or AI) should:

- Update milestone status (e.g. "in progress", "completed") as work evolves.
- Add new milestones if major new features or provider support is planned.
- Reflect significant changes in `DECISIONS.md` and `ARCHITECTURE.md`.
