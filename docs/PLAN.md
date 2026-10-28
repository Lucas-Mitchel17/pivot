# Pivot — how it is built

## Why
Pivot replaces a physical "flip cube" desk timer: switch between standing, sitting and
breaks, get reminded to drink water, and keep a history of the day.

- **Desktop app, not a PWA:** a PWA can't guarantee the alarm with the app closed, can't
  show a countdown in the top bar or tray, and can't raise an always-on-top alert.
- **Tauri 2:** one codebase for Linux, Windows and macOS. The UI is plain web, so the
  design system's CSS custom properties work as they are.

Mockups: https://claude.ai/artifact/EXqQwvzucn2UrBBxXnDwJv

## Layout
```
core/                 pivot-core: db.rs, engine.rs, stats.rs, cli.rs, i18n.rs (+ tests), no UI
src-tauri/            Tauri app
  src/lib.rs          plugins, 1-second clock, main window hides instead of closing
  src/tray.rs         tray / top bar icon: countdown and favorites menu
  src/alerts.rs       always-on-top alert window + system notification
  src/sound.rs        alarm through the platform's own player and sound
  src/commands.rs     commands the windows call
  src/main.rs         terminal: status/log/list read the database directly
src/                  frontend (TypeScript + Vite, no framework)
  lib/                api.ts, i18n.ts (en / pt-BR), theme.ts, logo.ts, icons.ts, dom.ts
  main/               main window: favorites.ts, automatic.ts, history.ts, ui.ts
  alert/alert.ts      alert window
  styles.css          app styles on top of the design system's semantic tokens
assets/               source SVGs for the app and tray icons
.github/workflows/    release.yml: builds all installers on a version tag
```

## How it works
- **One process, living in the tray.**
  - Starts at login with `--background`.
  - Closing the window only hides it.
  - The single-instance plugin forwards any second launch (including terminal commands) to the running process.
- **Clock:** once a second, `Engine::tick`:
  - fires the reminders that are due;
  - returns sessions whose `ends_at` has passed, each once.
  - Each due session opens an `alert-<id>` window, plays the alarm and sends a system notification.
- **Tray:**
  - On Linux and macOS the countdown sits next to the icon (`"Standing" 23:41`). On Windows the tray can't show text, so it goes in the tooltip.
  - Menu: current timer, favorites, Stop, the automatic-reminders switch, Open, "Developed by Lucas Mitchel Dev", Quit.
- **Flip-cube chaining:** `presets.next_preset_id` links timers (Standing → Sitting → Standing…). The alert's main button starts the next one.
- **Reminders:**
  - Slots are `start + every`, up to `end`, on the chosen weekdays.
  - A slot missed by more than 15 minutes (laptop asleep) is not fired late.
  - An unanswered reminder becomes "skipped" when the next slot fires.
  - There is a global switch and a one-hour pause.
- **Storage:** SQLite at `dirs::data_dir()/pivot/pivot.db` (`PIVOT_DB` overrides it), with tables `presets`, `recurring`, `sessions` and `settings`.
- **Theme:** System / Light / Dark through `data-mode` on `<html>`; dark is the design system's default.
- **Language:** English and pt-BR.
  - The windows use `src/lib/i18n.ts`; the tray, notifications and terminal use `core/src/i18n.rs`.
  - The default presets are stored in Portuguese and shown translated.
- **Credit:** the window footer and the tray menu show "Developed by" with the `lucas-mitchel-dev-mark-lockup.svg` logo (ice → blue gradient), linking to https://lucasmitchel.dev.

## Releases
- `.github/workflows/release.yml` runs on every `v*` tag and calls `tauri-action` on Ubuntu, Windows and macOS (arm64 and x64).
- It runs the core tests and attaches the installers to a GitHub Release.
- **No code signing.** It is a small local app, so we don't pay for a Windows certificate or an Apple Developer membership.
  - macOS builds are ad-hoc signed (`signingIdentity: "-"`), so they run on Apple Silicon after "Open Anyway".
  - The README explains the warnings people will see.

## Verifying
- `npm test`: timers, chaining, snooze, hourly reminders, pause, weekends, stats, terminal.
- `pivot 20s Test` with the app running: the alert opens with sound, and `pivot log` shows the session as done.
- Tray: the countdown shows, and the favorites in the menu start timers.
- Standing alert → "Start Sitting" → the tray switches to the new timer.
- A reminder "every 2 minutes" in a short window: alerts fire and show in History as automatic.
- Switching theme and language from the top button updates the window, the alert and the tray menu.
