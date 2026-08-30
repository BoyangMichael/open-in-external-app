<div align="center">

# Open in External App (Remote)

Open files with external applications from VS Code — any combination of a local or remote file,
opened with a local or remote app.

</div>

## About this fork

This is a fork of [tjx666/open-in-external-app](https://github.com/tjx666/open-in-external-app),
a great extension for opening files with external applications (Typora, Photoshop, a browser,
etc.) that assumes everything — the file and the app — lives on your local machine.

This fork adds the other three combinations: a file on a Remote-SSH/WSL/Dev Container host, opened
with either a local or a remote app; and a local file opened with a remote app (not yet supported —
see the table below).

For the base configuration reference (the `openInExternalApp.openMapper` format, `shellCommand`
variables, per-app `args`/`shellEnv`, keyboard shortcuts for specific config items, etc.) — all of
that is unchanged from upstream, so see the
[original README](https://github.com/tjx666/open-in-external-app#readme) for the full reference.
This README only covers what's new here.

## 🆕 What's new in this fork

|             | Local app                          | Remote app                                         |
| ----------- | ---------------------------------- | -------------------------------------------------- |
| Local file  | ✅ original extension, unchanged   | ⚠️ not yet supported                               |
| Remote file | ✅ **the main point of this fork** | ✅ **new**: runs the app on the remote host itself |

### Remote file → local app

The original motivation for this fork. Right-click a file in a Remote-SSH, WSL, or Dev Container
workspace and choose **"Open in External App"** as usual — the file is transparently downloaded to
a local cache and opened with your configured local app, the same as a local file. Reopening an
unchanged file reuses the cache; reopening a file that changed on the remote side re-downloads it
automatically.

- `openInExternalApp.cacheDir` — where cached remote files are stored (default: a directory under
  your OS temp folder).
- `openInExternalApp.cacheMaxAgeDays` — cached files older than this are pruned automatically on
  startup (default: `7`; set to `0` to disable pruning).

### Remote file → remote app

New context-menu entry: **"Open Using Remote App"**. Instead of downloading the file, this launches
an app **on the remote host** via a VS Code integrated terminal — useful when the app is already
installed there and you have your own GUI forwarding (e.g. X11 forwarding) set up. The extension
doesn't manage GUI forwarding itself; it assumes you already have that working.

Mark an app `"location": "remote"` to make it available under "Open Using Remote App" instead of
"Open in External App". Remote apps only support `shellCommand` (not `openCommand`/
`isElectronApp`, which are local-machine mechanisms), and `${file}`/`${fileBasename}`/etc.
substitute against the file's real path **on the remote host**:

```jsonc
{
  "openInExternalApp.openMapper": [
    {
      "extensionName": "xyz",
      "apps": [
        {
          "title": "Avogadro2 (local)",
          "shellCommand": "avogadro2 ${file}"
          // location defaults to "local": downloads the file to a local cache
          // first, then opens the cached copy with this local command
        },
        {
          "title": "Avogadro2 (remote)",
          "shellCommand": "avogadro2 ${file}",
          "location": "remote"
          // runs on the remote host instead, against the file's real remote
          // path - requires avogadro2 installed there and GUI forwarding set up
        }
      ]
    }
  ]
}
```

If a file isn't actually on a remote host, "Open Using Remote App" shows a message and does
nothing — there's no local system-default fallback for a remote app, unlike local apps.

### Local file → remote app — not yet supported

Uploading a local file to a remote host and running an app against it there isn't implemented.
"Open Using Remote App" only works on a file that's already on a remote host (it shows a message
and does nothing otherwise). This would also need a way to pick which remote host to target when
you aren't already connected to one via Remote-SSH — not yet designed.

### Provider support

Detects Remote-SSH, WSL, and Dev Container (attached or generated) workspaces. GitHub Codespaces
isn't detected yet.

## 🔌 Installation

Not yet published to the Marketplace. To try it locally:

```bash
pnpm install
pnpm package                                          # builds a .vsix
code --install-extension open-in-external-app-remote-*.vsix
```

## License

MIT — see [LICENSE](LICENSE). Includes the original upstream project's copyright notice; fork
additions are copyright their own author, per the same license.
