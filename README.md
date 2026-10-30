# Pivot

A posture timer for switching between standing, sitting and taking breaks while you work — the desk "flip cube" timer, on your computer. Runs on Linux, Windows and macOS.

- Tray / top bar icon with a countdown and your favorite timers (`15m — Standing`, `10m — Break`…)
- Pause a timer and resume it where it was
- An alert that stays above your other windows until you answer it (optional), with sound; one click starts the next timer in the sequence
- Recurring reminders (e.g. "Drink water" every hour, 9:00–18:00, Monday to Friday)
- Day and week history: time per type, switches between types, reminders done
- Daily goals per type (e.g. "Standing 2h a day", "Water 8 times a day") and a weekly chart of the ideal week vs. how it went
- Your own types (e.g. "Active break"), each with its own color in the history; the built-in ones can be renamed and recolored
- Alert volume with a test button, or your own sound (up to 8 seconds)
- Updates from inside the app (Settings → Updates)
- Light and dark themes, built on the Lucas Mitchel Dev design system
- English and Brazilian Portuguese
- Optional terminal commands: `pivot start em-pe`, `pivot status`, `pivot log`

**Stack:** Tauri 2 · Rust (`pivot-core` + SQLite) · TypeScript + Vite · [mitchel-design-system](https://github.com/Lucas-Mitchel17/mitchel-design-system)

## Installing

Download the installer for your system from the [latest release](https://github.com/Lucas-Mitchel17/pivot/releases/latest).

| System | File |
|---|---|
| Ubuntu / Debian | `.deb` |
| Fedora / openSUSE | `.rpm` |
| Any Linux | `.AppImage` |
| Windows | `.msi` or `-setup.exe` |
| macOS (Apple Silicon) | `aarch64.dmg` |
| macOS (Intel) | `x64.dmg` |

### Why Windows and macOS warn you

Pivot is a small, local app: no account, no server, nothing leaves your computer. So the
Windows and macOS builds are **not code-signed** — that takes a paid Windows code-signing
certificate and a paid Apple Developer membership, which doesn't make sense for a project
this size. The code is all here and the installers are built by GitHub Actions from it
(see `.github/workflows/release.yml`).

What that means when you install:

- **Windows:** SmartScreen says "Windows protected your PC". Click **More info → Run anyway**.
- **macOS:** the first time, macOS refuses to open it. Go to **System Settings → Privacy &
  Security**, scroll down and click **Open Anyway** next to Pivot. Or, in Terminal:
  `xattr -dr com.apple.quarantine /Applications/Pivot.app`
- **Linux:** nothing to do. On GNOME, the tray icon needs the AppIndicator extension
  (enabled by default on Ubuntu). Wayland doesn't let apps keep a window on top, so when
  "Keep the alert above everything" is on (the default), Pivot runs through XWayland.

### Updates

Pivot checks GitHub for a new release when it starts; **Settings → Updates** shows it and has a
"Check for updates" button.

- **Windows, macOS and AppImage** update themselves: "Update and restart".
- **.deb / .rpm** update the same way from version 0.5.1 on: the system asks for your password to
  install the new package. If that fails, the button opens the download page instead.

Updates are signed with Pivot's own update key (free, unrelated to the paid OS code signing), so
the app only installs builds that came from this repository's releases. In-app updates work
from version 0.3.0 on (0.5.1 for .deb/.rpm); older versions need one manual download, e.g.
`sudo apt install ./Pivot_<version>_amd64.deb` in the folder you downloaded it to.

## Using it

Pivot starts with your system and lives in the tray. Pick a favorite from the tray menu, or
open the window to manage timers, reminders and history. Closing the window keeps it running;
use **Quit** in the tray menu to stop it.

Linking timers is what makes it a flip cube: "Standing 15m" can suggest "Sitting 45m" when it
ends, and that one suggests "Standing" again.

### Terminal

```
pivot                     open the window
pivot start em-pe         start a saved timer (by name or slug)
pivot 30 "Standing"       one-off timer (30, 1:30, 90s, 1h30)
pivot stop                stop the timer
pivot pause | resume      pause or resume the timer
pivot status              show the current timer
pivot list                list saved timers
pivot log [--week]        today's (or this week's) summary
```

## Development

```
npm install
npm run tauri dev        # run the app
npm test                 # pivot-core tests
npm run tauri build      # installers for the current system
```

Linux build dependencies (Ubuntu/Debian):

```
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev libasound2-dev build-essential
```

Set `PIVOT_DB=/some/test.db` to run against a throwaway database.

Releases: push a version tag (`git tag v0.3.1 && git push origin v0.3.1`) and the
workflow builds every installer, signs the update bundles and publishes the release with the
`latest.json` the app checks. It needs the repository secret `TAURI_SIGNING_PRIVATE_KEY`
(the private half of the key whose public half is `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json`). Local builds need it too:
`TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/pivot.key)" npm run tauri build`.

How it is put together: [`docs/PLAN.md`](docs/PLAN.md).

---

Developed by [Lucas Mitchel Dev](https://lucasmitchel.dev).
