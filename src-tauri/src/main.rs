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

    pivot_lib::run(cmd)
}
