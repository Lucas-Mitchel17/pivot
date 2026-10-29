// No console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pivot_core::cli::{self, Command};
use pivot_core::db::{self, Db};
use pivot_core::i18n::Lang;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = cli::parse(&args);

    // Read-only commands answer from the database and exit; commands that
    // change something print what they will do, then go to the running app
    // (the single-instance plugin forwards them).
    if !matches!(cmd, Command::Open | Command::Background) {
        let code = match Db::open(&db::default_path()) {
            Ok(db) => {
                let lang = Lang::from_setting(&db.setting("lang"));
                match cli::describe(&db, &cmd, lang, db::now()) {
                    Ok((code, text)) => {
                        println!("{text}");
                        code
                    }
                    Err(e) => {
                        eprintln!("pivot: {e}");
                        1
                    }
                }
            }
            Err(e) => {
                eprintln!("pivot: {e}");
                1
            }
        };
        if code != 0 || !cmd.mutates() {
            std::process::exit(code);
        }
    }

    keep_alerts_on_top_on_wayland();
    pivot_lib::run(cmd)
}

/// Wayland doesn't let an app keep its own window above the others, so the alert
/// falls behind as soon as you click elsewhere. Running through XWayland (the X11
/// backend) makes GNOME honor "always on top". GTK picks its backend once, at
/// startup, so this has to happen before Tauri starts and needs a restart to change.
/// `PIVOT_FORCED_X11` marks a backend we chose, so a restart after turning the option
/// off (which inherits this process's environment) can undo it; a GDK_BACKEND the user
/// set themselves is left alone.
fn keep_alerts_on_top_on_wayland() {
    const MARK: &str = "PIVOT_FORCED_X11";
    let ours = std::env::var_os(MARK).is_some();
    if !pivot_lib::is_wayland() || (std::env::var_os("GDK_BACKEND").is_some() && !ours) {
        return;
    }
    let on_top = Db::open(&db::default_path()).map(|db| db.setting("alert_on_top") == "1").unwrap_or(true);
    // Safe: still single-threaded, nothing else reads the environment yet.
    if on_top {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var(MARK, "1");
    } else if ours {
        std::env::remove_var("GDK_BACKEND");
        std::env::remove_var(MARK);
    }
}
