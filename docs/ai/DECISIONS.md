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

## 10. No Mocking Library — Test Real, Deterministic Side Effects Instead

**Decision:** `ApplicationLauncher`/`utils/open.ts`'s `shellCommand` path is tested by actually
running a real (deterministic, side-effect-free) shell command — `echo ... > tempfile` — instead
of stubbing `child_process.exec`, `open`, or `vscode.env.openExternal` with a mocking library.

**Rationale:** This mirrors how the resolver tests (Milestone 3b) exercise real filesystem I/O
against a forged local URI instead of mocking `workspace.fs` — real execution is trustworthy where
it's safe and deterministic to run, and this project has no mocking library today, so adding one
would be a tooling decision with its own maintenance cost. The `shellCommand` path is a good fit:
`exec`-ing a trivial, deterministic command and asserting on its output file is safe in CI and
exercises the actual variable-substitution/`shellEnv`-merge logic end to end, which is the part
most worth verifying (it's the most complex, most bug-prone branch — see the `${file}`/
`fsPathOverride` handling `parseVariables` needed for issue #83).

**What's still untested, and why:** the `openCommand`/`isElectronApp`/default paths
(`openByPkg`/`openByBuiltinApi`) spawn real OS-level "open with the default/configured
application" behavior — there's no safe, deterministic way to assert that succeeded in a headless
CI runner (it would try to launch a real GUI app or invoke OS shell-execute semantics). Testing
those meaningfully would require a mocking library (to stub the `open` package and
`vscode.env.openExternal`); not adding one preemptively — revisit only if a real bug surfaces in
those paths that tests would have caught.

**Implications:**

- `test/open.test.ts`'s `shellCommand` tests are POSIX-only (skipped on `win32`): `cmd.exe`
  quoting differs enough from `sh` that a single portable command string wasn't worth chasing for
  this coverage.

---

## 11. `extensionKind: ["ui"]` — Force Local Execution (Bug Fix)

**Decision:** Declare `"extensionKind": ["ui"]` in `package.json`.

**What was found:** the manifest had no `extensionKind` declared. Per VS Code's own docs, an
extension with no declaration and no purely-UI contribution points is inferred as a **Workspace**
extension — meaning under Remote-SSH, its extension host runs **on the remote machine**, not the
user's local machine. That would mean every `child_process.exec`/`open`
package/`vscode.env.openExternal` call in `utils/open.ts` — the calls that are supposed to launch
a **local** desktop app — was at risk of actually spawning on the remote host instead, silently
undermining the entire "download remote file → open with local app" flow that Milestone 3
implemented. This was found while researching how the new "open with remote app" feature
(Milestone 5) should work, not from an observed failure report — it needs confirmation in a real
Remote-SSH session, but the risk was serious enough to fix immediately rather than leave latent.

**Fix:** force the extension host to always run locally (`ui` kind), regardless of workspace type.
This guarantees local-app launching actually happens on the user's machine.

**Implication for remote-app execution (Milestone 5):** since the extension itself now always runs
locally, "run this app on the remote machine" cannot be done by just calling `child_process.exec`
in the extension host (that would exec locally). The intended mechanism is VS Code's `Terminal`
API: `vscode.window.createTerminal(...)` + `terminal.sendText(command)` — a terminal opened in a
Remote-SSH workspace executes on the remote host **regardless of which side the requesting
extension runs on**, which is exactly the cross-boundary primitive this feature needs. This still
needs to be validated in a real Remote-SSH session before being relied on as the implementation
approach.

---

## 12. Milestone 5b Implementation — Local/Remote App Choice

**User-confirmed scope (2026-08-30, resolving the open questions from `ROADMAP.md` Milestone 5b):**

- **Remote GUI display:** assume the user already has their own X11 forwarding (or equivalent)
  set up. The extension does not manage remote display — it only launches the app on the remote
  host via `RemoteApplicationLauncher` (§11), same as running the command in a manually-opened
  remote terminal.
- **App discovery:** config-only for this version — no auto-detection of installed apps (local or
  remote). Auto-detection (`.desktop` files, `/Applications`, registry, remote `$PATH` scanning) is
  real, separate scope, deferred until/unless actually needed.

**Decision:** extend each app entry in `openInExternalApp.openMapper` with an optional
`location: 'local' | 'remote'` field, defaulting to `'local'` when unset — every existing config
written before this field existed keeps working identically (verified: `filterAppsByLocation`
treats a missing `location` as `'local'`, and existing tests/behavior for the `'local'` path are
unchanged, just routed through the new filter). A new `openInExternalApp.openRemote` command/menu
entry (mirroring `open`, not `openMultiple`) filters a matched config item's apps down to
`location: 'remote'` ones and launches through `RemoteApplicationLauncher` instead of `utils/open`
's `open()`, using the file's actual remote path (`resolvedFile.originalUri.path`) rather than the
locally-cached copy. If the target file isn't actually on a remote provider, or no remote app is
configured for it, the user gets an informational message rather than silent failure or a
nonsensical local-system-default fallback (there is no sensible "default remote app").

**Rationale:** reusing the existing `openMapper`/`ExtensionConfigItem`/`ExternalAppConfig` schema
(rather than a parallel `remoteApps` config key) means a single config item can mix local and
remote variants of the same logical app under one `extensionName`, and all the existing
lookup/matching machinery (`extensionName`, `configItemId`, `__ALL__` shared config, `*` fallback)
applies unchanged to both — only the final app-list needed filtering by location.

**Explicitly deferred (not built in this pass):**

- App auto-detection (both local and remote) — per user direction, config-only for now.
- Per-app shortcut IDs that skip the app picker for one specific app within a multi-app list. The
  existing `configItemId` keybinding mechanism (`README.md` → "assign keyboard shortcut for
  specific config item") already covers the common case of "one shortcut → one app" when the
  target config item has exactly one app for the desired location; a finer-grained per-app id
  wasn't built since the common case is already served.
- Per-platform (`{windows, osx, linux}`) `shellEnv` for remote apps — the local machine's OS has no
  reliable relationship to the remote host's OS, so only a flat `shellEnv` map is honored for
  remote apps (`extractFlatShellEnv` in `remoteApplicationLauncher.ts`).

**Not yet validated:** everything here is built and unit-tested at the command-construction level
(`buildRemoteCommand`, `extractFlatShellEnv`, `filterAppsByLocation`), but actually launching a
remote app via a real `Terminal` in a real Remote-SSH session has not been confirmed — this
sandbox can't run the Electron GUI needed for that (same limitation noted throughout
`SESSION_LOG.md`).

**Update (2026-08-30, first real Remote-SSH test):** the user confirmed both context-menu entries
_appear_ correctly on a remote file in a real Remote-SSH session — the `extensionKind: ["ui"]` fix
(§11) and command/menu registration are confirmed working end to end. Clicking "Open Using Remote
App" produced no visible effect, though — still investigating whether that's a real bug or the
(easy-to-miss) "no remote app configured for this file type" info toast firing as designed with no
`location: "remote"` app actually configured yet. See §13.

---

## 13. Menu UX Fix — Submenu for Adjacency, Consistent Naming

**Problem reported (2026-08-30):** in a real context menu, `openInExternalApp.open` and
`openInExternalApp.openRemote` didn't appear next to each other — VS Code's "Open to the Side"
(unrelated to this extension) rendered between them, despite both being registered in the same
`navigation` group with adjacent `@10`/`@11` order values. Menu order within a shared group across
_different_ extensions/core commands isn't fully controllable via order numbers alone.

**Fix:** wrap both under a single submenu contribution (`openInExternalApp.submenu`, labeled "Open
in External App") so they're always rendered together as one expandable entry, immune to
interleaving from unrelated menu items — the standard VS Code idiom for this exact problem (used
by e.g. Git's "Open Changes"/"Compare with..." submenus). The `alt`-key swap to
`openInExternalApp.openMultiple` still works inside the submenu's own item list.

**Also renamed for consistency** (per user request): `openInExternalApp.open` "Open in External
App" → **"Open in Local App"**; `openInExternalApp.openMultiple` "Open in Multiple External Apps"
→ **"Open in Multiple Local Apps"**; `openInExternalApp.openRemote` "Open Using Remote App" →
**"Open in Remote App"**. The umbrella submenu label took over the old "Open in External App"
title. The settings page title (`contributes.configuration.title`) was also repointed from
`cmd.open` to the new `cmd.submenu` key, since it represents the whole extension, not specifically
the local-open command.

---

## 14. Real Bug: "Open in Remote App" Silently Downloaded the File First

**Problem (found via real Remote-SSH testing, 2026-08-30):** the user reported clicking "Open in
Remote App" and nothing visibly happening. Root cause: `openInExternalApp()` called
`resolver.resolve(uri)` **unconditionally** at the top of the function, before even checking
`location`. `RemoteResolver.resolve` always performs the full stat/download/cache flow (Milestone
3b) — meaning every remote-app launch first downloaded and cached the entire file locally, even
though a remote app never touches that local copy (it only needs `resolvedFile.originalUri.path`,
which the caller already had from the input `uri` itself). For a large remote file (the user's
workspace includes trajectory files, which can be very large) this could take a long time with
**zero progress feedback**, reading exactly like "clicked, nothing happened."

**Fix:** for `location === 'remote'`, skip `resolver.resolve()` entirely. Use
`getRemoteProviderType(uri)` (a pure, synchronous function, no I/O) plus a `uri.scheme ===
'vscode-remote'` check to confirm the file is actually remote, and use `uri.path` directly as both
the extension-matching path and the launch path. No local download, no cache directory touched, no
wasted latency — the remote-app path is now effectively instant regardless of file size.

**Why this wasn't caught earlier:** none of the Session 007-009 unit tests exercised the full
`openInExternalApp()` orchestration function end to end for the remote-app path — they tested
`RemoteResolver`, `parseVariables`, `buildRemoteCommand`, and `filterAppsByLocation` in isolation,
all of which were individually correct. The bug was in how `openInExternalApp()` wired them
together, which only a first real end-to-end test (a human, in a real Remote-SSH session) caught.
Added a regression test (`test/openInExternalApp.test.ts`) asserting the cache directory is never
created for a remote-app request.

**Implication:** this is a good example of why the sandbox's inability to run `pnpm test`'s real
Electron suite, or exercise the actual VS Code UI, is a meaningful verification gap (see
`SESSION_LOG.md` throughout) — unit tests on individual pieces don't substitute for exercising the
integration path a real user actually clicks.

---

## 15. "Open in Local App" Hangs Silently — `workspace.fs.stat` Never Settles

**Problem (found via real Remote-SSH testing, 2026-08-30, immediately after §14's fix shipped):**
with a real `location: "remote"` app configured and working (§14), the user then reported "Open in
Local App" also does nothing — on a file they describe as very small. The Output panel showed the
command handler running (`parsed args`, `parsed extension name`, `found matched config`, the
`variables:` dump) up through `RemoteApplicationLauncher`'s own successful remote-app launch log
line, and then **four repeated `parsed args` lines with nothing after them** — one per click,
because the user, seeing no response, clicked "Open in Local App" again each time.

**Diagnosis:** no log line appears between `parsed args` and the next `logger.info` call inside
`RemoteResolver.resolve()`, which only fires after `vscode.workspace.fs.stat(uri)` resolves. Every
other branch before that stat call is synchronous or fast local-fs I/O (`getRemoteProviderType`,
the scheme check, `ensureCacheDir`, `pathExists`). The only remaining explanation across four
separate attempts producing zero output is that `vscode.workspace.fs.stat(uri)` (or possibly
`readFile`, indistinguishable without an intermediate log line — not added yet) **never settles**
— neither resolves nor rejects — for this connection. This is the exact code path `§11` flagged as
"not yet validated in a real Remote-SSH session," and it's now confirmed to have a real problem,
though the precise cause (an `extensionKind: ["ui"]` interaction with remote `workspace.fs`
routing, vs. something specific to this SSH host/network/filesystem) is not yet isolated.

**Important scope note:** the "Open in Remote App" fix in §14 didn't actually fix this
underlying `workspace.fs` hang — it made the remote-app path stop depending on it entirely (it
never calls `resolver.resolve()` any more). So "remote app works now" is **not** evidence that
`workspace.fs.stat`/`readFile` are healthy; "Open in Local App" (and therefore the fork's original
core purpose, remote file → local app) still goes through that exact code path and is still
affected.

**Fix shipped (mitigation, not a root-cause fix):** wrap the local-path `resolver.resolve()` call
in `vscode.window.withProgress` (so a hang is at least visible as a persistent "Downloading..."
notification instead of total silence) and a 30-second timeout (`withTimeout` in
`openInExternalApp.ts`) that surfaces an error message instead of hanging forever. This does not
fix whatever is actually wrong with `workspace.fs.stat`/`readFile` — it only makes the failure
mode visible and bounded instead of silent and infinite.

**Still to investigate:**

- Does the _first_ click ever complete, just slowly (network/filesystem latency — the remote path
  looks like an HPC home directory, `/home/irsrvhome1/...`, which could be slower networked
  storage), or does it never complete no matter how long you wait? The new progress notification
  and 30s timeout should make this observable.
- Does opening the same file normally through VS Code's built-in editor (no extension involved)
  work fine and quickly? If yes, the problem is specific to how this extension calls
  `workspace.fs`; if that's also slow/stuck, it's a more general remote-connection issue outside
  this extension's control.
- Whether `extensionKind: ["ui"]` (§11) is actually implicated, or coincidental — not established
  either way yet.

---

## How to Use This Document

When you make a notable design choice:

1. Add a short section here describing:

   - the decision
   - the rationale
   - key implications

2. Link to code, issues, or external design notes if needed.

This helps maintain a coherent architectural story as the project evolves.
