# Architecture Overview

## Current Upstream Architecture (conceptual)

The upstream extension effectively assumes a simple, local-only flow:

    File (local path)
      ↓
    spawn(app, file)

There is no explicit notion of URIs, remote files, or resolver abstractions.

---

## Proposed Architecture

We introduce an explicit pipeline that is aware of VS Code URIs and remote providers:

    URI
     ↓
    FileResolver
     ↓
    ResolvedFile
     ↓
    ApplicationLauncher
     ↓
    spawn()

### Goals

- Decouple **URI resolution** from **application launching**.
- Make remote behavior an implementation detail of `FileResolver`.
- Avoid sprinkling provider-specific conditionals (e.g. `if remote`) throughout the codebase.
- Make it straightforward to support new URI providers (Remote-SSH, WSL, Dev Containers, Codespaces, etc.).

---

## Components

### 1. FileResolver

**Responsibility:** Convert any VS Code URI into a usable local file.

**Input:**

- VS Code URI (e.g. `file://...`, `vscode-remote://ssh-remote+...`, `vscode-remote://wsl+...`, container URIs, etc.)
- Optional context (workspace folder, configuration, caching options).

**Output (ResolvedFile):**

- Local filesystem path to the resolved file.
- Metadata such as:
  - original URI
  - provider type (local, ssh, wsl, container, etc.)
  - cache location (if downloaded)
  - timestamps or version identifiers (for potential invalidation)

**Key Responsibilities:**

- Detect provider type from URI.
- Decide whether a download is needed.
- Perform secure file transfer using VS Code APIs (`workspace.fs`).
- Manage caching strategy:
  - configurable cache directory
  - optional cleanup strategy (manual, on-demand, time-based)
- Handle concurrency:
  - avoid redundant downloads of the same file if practical
  - ensure consistent results when multiple requests target the same URI.

**Example implementations:**

- `LocalResolver`
  - Input: `file://...`
  - Output: identical file path (no download).

- `RemoteSSHResolver`
  - Input: `vscode-remote://ssh-remote+...`
  - Output: path to the downloaded file in a local cache directory.

- Future resolvers:
  - `WSLResolver`
  - `ContainerResolver`
  - `CodespacesResolver`
  - Other provider-specific resolvers.

The `FileResolver` interface should be generic enough to support all of these.

---

### 2. ResolvedFile

A simple abstraction representing the output from `FileResolver`.

**Example shape (conceptual):**

- `localPath`: string — path usable by local applications.
- `originalUri`: URI — the original VS Code URI.
- `providerType`: string — e.g. `"local" | "ssh" | "wsl" | "container"`.
- `cacheInfo`: optional — information about where/when the file was cached.
- `cleanupHint`: optional — whether and how the file should be cleaned up.

This abstraction gives `ApplicationLauncher` a clean, local-only view of the world, plus metadata if needed (for logging or advanced behavior).

---

### 3. ApplicationLauncher

**Responsibility:** Launch configured applications with a local file path.

**Input:**

- `ResolvedFile` (local path + metadata).
- Application configuration (command, arguments, platform-specific overrides).

**Output:**

- A process is spawned to open the file in the desired application.
- Errors are reported in a consistent way (e.g. via VS Code notifications, logging).

**Key Responsibilities:**

- Command substitution and argument formatting.
- Platform differences:
  - Windows vs macOS vs Linux command behavior.
  - Paths and quoting.
- Respect user configuration:
  - local vs remote applications (future).
  - multiple applications per file type (future).
- Remain **agnostic** to URI source:
  - It should not know whether the file was remote, local, or cached.

---

## Example Flow: Remote-SSH to Avogadro2

1. User right-clicks a remote `.xyz` file in a Remote-SSH workspace.
2. VS Code provides a URI like:

       vscode-remote://ssh-remote+my-hpc-cluster/home/user/molecule.xyz

3. The extension calls `FileResolver.resolve(uri)`:
   - Detects the `ssh-remote` provider.
   - Downloads the file to a local cache directory (configurable).
   - Returns `ResolvedFile` with, for example:
     - `localPath`: `/Users/localuser/.cache/open-in-external-app/my-hpc-cluster/molecule.xyz`
     - `providerType`: `ssh`.

4. The extension calls `ApplicationLauncher.launch(resolvedFile, configuredApp)`:
   - Formats command and arguments for the current platform.
   - Spawns Avogadro2 with the local path.

5. The user sees Avogadro2 open the remote file content without manual download.

---

## Advantages

- **Separation of concerns**
  - `FileResolver` focuses on URIs, remote handling, and caching.
  - `ApplicationLauncher` focuses on launching apps and platform differences.

- **Extensibility**
  - New providers (WSL, Dev Containers, Codespaces) can be added as new resolvers.
  - Future features (remote apps, different cache strategies) can be introduced without rewriting core logic.

- **Maintainability**
  - Avoids duplicating remote logic across the codebase.
  - Keeps provider-specific knowledge in a few well-defined components.

---

## Open Questions

These should be revisited and documented in `DECISIONS.md` as they are resolved:

- How should cache invalidation work?
  - Time-based cleanup?
  - Manual user commands?
  - On-demand re-download?
- How should concurrent downloads of the same file be handled?
- Should we support remote execution of applications (e.g. via SSH) as a separate launcher type?
- What is the best way to expose configuration for:
  - cache directory
  - provider-specific options
  - SSH host overrides?