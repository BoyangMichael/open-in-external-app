# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension (`open-in-external-app`) that lets users right-click a file and open it
with a configured external application. **This repository is a fork** of
[tjx666/open-in-external-app](https://github.com/tjx666/open-in-external-app), maintained to add
URI-aware support for remote filesystem providers (Remote-SSH today; WSL/Dev Containers/Codespaces
are future targets), since the upstream extension assumes files are always on the local filesystem.

The long-term goal (see `docs/ai/PROJECT_CONTEXT.md`) is a clean, generically URI-aware
"Remote VS Code ⇄ External App" extension that could realistically be upstreamed — not a one-off
hack, and not tied to any specific application domain.

## `docs/ai/` — read this before non-trivial changes

This repo maintains a formal AI-collaboration doc set that **every AI agent working here is
expected to follow**:

- `docs/ai/AGENTS.md` — collaboration rules for AI agents (read this first)
- `docs/ai/PROJECT_CONTEXT.md` — why the fork exists, problem statement, vision
- `docs/ai/ARCHITECTURE.md` — the FileResolver/ApplicationLauncher architecture in depth
- `docs/ai/DECISIONS.md` — design decisions and rationale, append-only log
- `docs/ai/ROADMAP.md` — milestone plan
- `docs/ai/CONTRIBUTING_AI.md` — coding guidelines for AI contributors
- `docs/ai/SESSION_LOG.md` — chronological log of AI-assisted sessions

**Non-negotiable working rules from these docs:**

1. **Keep `docs/ai` in sync with every meaningful change**, in the same change set — not as a
   follow-up. At minimum, add a `SESSION_LOG.md` entry for non-trivial work; update
   `ARCHITECTURE.md`/`DECISIONS.md` when structure or design choices change.
2. **Ask before committing.** After a meaningful update, pause and ask the user whether to commit
   (explicit accept/reject). Only commit (and push) on explicit acceptance.
3. **Respect the resolver/launcher boundary** (see Architecture below) — don't scatter
   provider-specific (`if remote`, `if ssh`) conditionals through unrelated modules.
4. **Preserve upstream compatibility**: keep local-file behavior unchanged by default, follow
   existing coding style, avoid unnecessary breaking changes, keep commits small and reviewable.

## Commands

Package manager is **pnpm** (enforced via `preinstall: only-allow pnpm`).

```bash
pnpm install              # install deps (runs stale-dep check via postinstall)

pnpm esbuild:base         # one-off build to ./out/src
pnpm esbuild:watch        # incremental build with sourcemaps, for extension dev host (F5)

pnpm lint                 # eslint src --ext ts

pnpm compile:test         # clean + tsc build of ./test/tsconfig.json → ./out/test
pnpm test                 # stale-dep check + compile:test + run tests via @vscode/test-electron

pnpm clean                # rimraf ./out
pnpm package              # vsce package --no-dependencies (build a .vsix)
```

- Tests are Mocha specs under `test/*.test.ts`, compiled to JS and loaded via `test/index.ts`
  (glob `**/**.test.js`) inside a real VS Code instance driven by `@vscode/test-electron`
  (`test/runTests.ts`). There is no per-file/single-test runner script — `pnpm test` runs the whole
  suite. To iterate, add/adjust specs and re-run `pnpm test`.
- To debug the extension interactively, open this folder in VS Code and use the "Run Extension"
  launch config (`.vscode/launch.json`), which invokes the extension host.
- Lint/format are enforced on commit: `simple-git-hooks` runs `lint-staged`
  (`eslint --fix` + `prettier --write` on staged `ts/json/md`) via a `pre-commit` hook installed by
  the `prepare` script.
- ESLint config extends `@yutengjing/eslint-config-typescript`; Prettier config is
  `@yutengjing/prettier-config` — both external, not defined in this repo.

## Architecture

The extension replaced an implicit, local-only flow (`file path → spawn(app, file)`) with an
explicit pipeline that separates URI resolution from application launching:

```
URI (vscode.Uri)
  ↓
FileResolver.resolve(uri)   — resolvers/
  ↓
ResolvedFile (local path + provider metadata)
  ↓
ApplicationLauncher.launch(resolvedFile, appConfig)   — launchers/
  ↓
open() — utils/open.ts   → spawn external process
```

### Entry point & command flow

- `src/extension.ts` — `activate()` registers all commands from `src/commands/index.ts`.
- `src/commands/open.ts` / `openMultiple.ts` — thin command handlers (single app vs. multi-app
  quick-pick) that delegate to `src/openInExternalApp.ts`.
- `src/openInExternalApp.ts` is the actual orchestrator:
  1. Resolves the target `Uri` (falls back to the active editor's document, or the last active
     file tab, via `utils/uri.ts`, when invoked from the command palette with no explicit URI).
  2. Calls `RemoteResolver.resolve(uri)` to get a `ResolvedFile` with a guaranteed local path.
  3. Looks up matching config: by extension name, by `configItemId` (for keybinding-driven
     shortcuts), by `__ALL__` shared config, or by `*` fallback — see `src/config.ts` for the Joi
     validation schema backing `openInExternalApp.openMapper`.
  4. If no config item and no shared config item match, opens via the system default
     (`ApplicationLauncher.launch`); otherwise opens via the matched config item's app(s)
     (`openWithConfigItem`), including a quick-pick when multiple apps are configured.

### Resolvers (`src/resolvers/`)

- `baseResolver.ts` — the `FileResolver` interface and `ResolvedFile` shape (localPath,
  originalUri, providerType, optional cacheInfo/remoteMetadata).
- `localResolver.ts` — identity resolution for local `file://` URIs.
- `remoteResolver.ts` — the resolver actually wired into `openInExternalApp.ts`. Detects provider
  type from `uri.authority` (`ssh-remote+…` → `ssh`, `wsl+…` → `wsl`, other
  `vscode-remote` → `remote`); for local/unknown URIs it delegates to `LocalResolver`. For a
  detected remote provider it downloads the file via `vscode.workspace.fs.readFile` into a cache
  dir (configurable via `openInExternalApp.cacheDir`, default `<tmpdir>/open-in-external-app-cache`),
  keyed by a sanitized `authority-filename` so repeated resolutions of the same URI reuse the
  cached copy. Non-`file`/`vscode-remote` schemes are marked `providerType: 'unsupported'` and
  returned as-is rather than downloaded.

New providers (WSL, Dev Containers, Codespaces) should be added as new `FileResolver`
implementations, not as branches inside existing ones — see `docs/ai/ARCHITECTURE.md` "Open
Questions" for unresolved cache-invalidation/concurrency design points.

### Launcher (`src/launchers/applicationLauncher.ts`)

Thin wrapper: `getLaunchTarget(resolvedFile)` returns the local path; `launch()` calls
`utils/open.ts#open()`. Deliberately has no knowledge of whether the file was local or remote —
that's the resolver's job.

### `src/utils/open.ts` — actual process launching

Handles the real cross-platform complexity, independent of the resolver/launcher split:

- Two launch strategies: the `open` npm package (`openByPkg`) vs. VS Code's built-in
  `vscode.env.openExternal` (`openByBuiltinApi`). The builtin API is required for Electron-based
  apps (e.g. Typora) but can't handle non-ASCII paths on Windows (microsoft/vscode#88273) — code
  falls back to `open` pkg in that case. `isElectronApp: true` config forces the builtin path.
- WSL support: when running in a WSL remote (`vscode.env.remoteName === 'wsl'`), paths are
  converted to Windows paths via `wsl-path`'s `wslToWindows` by default (`wslConvertWindowsPath`,
  default `true`); set `false` per-app to keep the native WSL path for WSL-native applications
  (see #83 for why `${file}`-style variable parsing needs `useWindowsPath`/`fsPathOverride` in
  that mixed-path scenario).
- `shellCommand` configs run through a shell (`node:child_process.exec`) with variable
  substitution (`utils/variable.ts`, supports VS Code's predefined variables plus
  `${cursorLineNumber}`/`${cursorColumnNumber}`), optional per-platform `shellEnv`, and on Windows
  are prefixed with `chcp 65001` to fix non-ASCII output handling.
- `openCommand`/`args` configs go through `open` pkg with the command as the target app.

### Configuration (`src/config.ts`, `package.json` → `contributes.configuration`)

`openInExternalApp.openMapper` is a user setting: an array of `{ id?, extensionName, apps }`
items, validated at read-time with a Joi schema (invalid config shows an error notification and
falls back to `[]`, i.e. system default open). `extensionName` can be a string, a string array
(shared config across extensions), `'*'` (fallback for any unmatched/extensionless file), or
`'__ALL__'` (applies to every file in addition to any per-extension match — see
`getSharedConfigItem` in `openInExternalApp.ts`). `apps` can be a bare command string or an array
of `{ title, openCommand | shellCommand, args, isElectronApp, shellEnv, wslConvertWindowsPath }`.
Localized strings for settings descriptions live in `package.nls*.json`, resolved via
`vscode-nls-i18n`.

## Notes

- `test-workspace/` holds fixture files (including a non-ASCII-named file) used to manually
  exercise the extension in an Extension Development Host — it's not part of the automated test
  compile.
- Node engine target is VS Code `^1.80.0`; build target is `ESNext`/`cjs` bundled with esbuild,
  `vscode` and `typescript` kept external.
