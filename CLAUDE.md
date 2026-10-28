# Pivot — notes for Claude

Cross-platform posture timer (Tauri 2). Read `README.md` for what it does and `docs/PLAN.md`
for how it is built before changing anything.

## Rules

- **Everything in English:** code, comments, README, docs, commit messages. The only Portuguese
  in the code is the pt-BR UI translations (`src/lib/i18n.ts`, `core/src/i18n.rs`).
- **Commits are Lucas's alone:** no `Co-Authored-By` or any other Claude attribution in commits or PRs.
- **Every UI string goes through i18n**, in both languages.
- **Components use the design system's semantic tokens** (`--surface-*`, `--text-*`, `--action-*`,
  `--border-*`), never raw ramp colors, except the category colors in `styles.css`.
- **Logic belongs in `core/`** (pure Rust, no Tauri) with a test; `src-tauri/` only wires it to
  the tray, windows and commands.

## Commands

```
npm install
npm run tauri dev               # run the app (see gotchas)
npm test                        # pivot-core tests
cargo test --workspace          # all Rust tests, including the sound module
npx tsc --noEmit -p .           # type-check the frontend
npx tauri build --bundles deb   # local .deb in target/release/bundle/deb/
```

## Gotchas

- `cargo` lives in `~/.cargo/bin`, which may not be on PATH in a non-login shell:
  prefix with `PATH="$HOME/.cargo/bin:$PATH"`.
- Test with `PIVOT_DB=<some scratch dir>/pivot.db` so Lucas's real data
  (`~/.local/share/pivot/`) is never touched.
- `npm run tauri dev` registers autostart pointing at `target/debug/pivot`. Delete
  `~/.config/autostart/Pivot.desktop` afterwards; the installed app recreates its own.
- Lucas runs the installed `.deb` (`/usr/bin/pivot`). Stop it with `pkill -x pivot` and start it
  again with `setsid -f /usr/bin/pivot --background`.
- In zsh, a glob with no match aborts the whole command (e.g. `rm a b *.x`): list files explicitly.
- When stopping dev processes, don't `pkill -f` a pattern that also matches your own shell's
  command line (e.g. "tauri dev").
- The project path has spaces ("Ferramentas de Trabalho"); quote it in shell commands.

## Releasing

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `core/Cargo.toml`.
2. Commit, then `git tag -a vX.Y.Z -m "Pivot X.Y.Z" && git push origin vX.Y.Z`.
3. `.github/workflows/release.yml` builds the unsigned installers for Linux, Windows and macOS and publishes the release.
   Only tag after Lucas has tested the local build.
