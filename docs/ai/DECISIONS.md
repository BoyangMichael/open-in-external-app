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
- How should cache invalidation interact with remote file changes (e.g. updated results)? —
  **resolved below.**

**Implications:**

- Initial implementation should favor correctness and simplicity.
- More advanced strategies can be introduced behind configuration once the basic behavior is stable.

Updates on this topic should be reflected here as they are decided.

### 6a. Staleness detection (decided — Milestone 3b)

**Decision:** Before reusing a cached copy, `RemoteResolver` compares the remote file's `mtime`
(via `workspace.fs.stat`) against the `mtime` recorded when the file was last cached. The recorded
`mtime` is persisted in a small JSON sidecar next to the cached file (`<cachePath>.meta.json`), so
freshness checks survive extension reloads rather than relying on in-memory state.

**Rationale:** The original cache key (`authority + filename`) only prevents redundant downloads
of an _unchanged_ file — it has no way to detect that the remote file was since modified, which
defeats the purpose of a "remote file resolver" (silently serving outdated content). A stat-based
mtime check is the cheapest correctness fix that doesn't require hashing file contents or keeping
a persistent connection.

**Implications:**

- One extra `workspace.fs.stat` round-trip per resolve; acceptable since it's far cheaper than a
  full re-download and only happens when the "Open in External App" command runs.
- Cache cleanup/eviction (size- or time-based) remains a separate, still-open question — staleness
  detection only prevents _serving wrong content_, it does not bound cache growth.

### 6b. Resilience on stat/download failure (decided — Milestone 3b)

**Decision:** If `workspace.fs.stat`/`readFile` fails (e.g. the remote connection drops) and a
cached copy already exists, `RemoteResolver` logs the failure, shows a
`vscode.window.showWarningMessage`, and returns the stale cached copy rather than failing the
command. If no cached copy exists, it shows a `vscode.window.showErrorMessage` and rethrows so the
command fails visibly instead of as an unhandled rejection.

**Rationale:** A transient remote hiccup shouldn't block opening a file the user already has a
local copy of; but silently swallowing the error would hide staleness from the user, hence the
warning message.

### 6c. Cache eviction policy (decided — Milestone 3b)

**Decision:** Time-based, opportunistic pruning. On extension activation, `maybePruneRemoteCache`
scans the configured cache directory and deletes any cached file (plus its `.meta.json` sidecar)
whose local mtime is older than `openInExternalApp.cacheMaxAgeDays` (default 7 days; `0` disables
pruning). It is not a background timer — it only runs once per activation, fire-and-forget, and
failures on individual entries are logged and skipped rather than aborting the whole pass.

**Rationale:** A per-activation sweep is the simplest option that still bounds disk growth without
adding timer/lifecycle management (start/stop on `deactivate`) or a new command surface. Using the
cached file's own mtime as the "last used" signal avoids needing a separate access-tracking
mechanism — every cache hit that redownloads (6a) naturally resets it, and untouched entries age
out. Size-based eviction and a manual "clear cache" command remain open for later if time-based
pruning proves insufficient in practice.

**Implications:**

- `RemoteResolver.resolve` and pruning now share cache-dir resolution via
  `getConfiguredCacheDir()`.
- Pruning is silent (log-only) by design — there's no user-facing notification when entries are
  evicted, since it's routine maintenance, not an error condition.

## 9. Dev Container Detection Fix, and No Per-Provider Resolver Classes

**Decision:** `getRemoteProviderType` detects Dev Containers via the `dev-container+`/
`attached-container+` authority prefixes, replacing a third branch that checked whether
`uri.authority` starts with the literal string `"vscode-remote"`. Verified against VS Code's
actual URI convention: `vscode-remote` is the URI **scheme** shared by every remote provider
(SSH, WSL, containers, Codespaces); the **authority** carries the provider-specific id
(`ssh-remote+…`, `wsl+…`, `dev-container+…`, `attached-container+…`). Authorities never start with
the scheme string, so that branch could never match a real URI — Dev Container files were silently
falling through to `LocalResolver` (treating a container-internal path as a host path).

**Rationale for fixing now:** found while reviewing Milestone 5 ("provider extensibility"); this
isn't a hypothetical gap, it's dead code hiding a real detection failure for an already-listed
target provider.

**Related decision — no `ContainerResolver`/`WSLResolver` classes:** `ARCHITECTURE.md`'s original
sketch proposed a resolver subclass per provider (`RemoteSSHResolver`, `WSLResolver`,
`ContainerResolver`, `CodespacesResolver`). In practice, `ssh`/`wsl`/`container` all resolve
identically once detected — same `workspace.fs.stat`/`readFile`/cache/prune flow — so a single
`RemoteResolver` plus a provider-detection function is sufficient and avoids the "special case per
provider" pattern §2 warns against. Only add a distinct resolver class if a provider someday needs
genuinely different resolution logic (not just a different authority prefix).

**Still open:** GitHub Codespaces' authority prefix wasn't confirmed via available sources (unlike
`dev-container+`/`attached-container+`, which are). Not guessing at it — `getRemoteProviderType`
still returns `undefined` for Codespaces URIs until the real prefix is confirmed.

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
