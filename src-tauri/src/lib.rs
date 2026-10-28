//! Tauri shell: tray, windows, the 1-second clock and the commands the
//! windows call. All timer logic lives in `pivot-core`.

mod alerts;
mod commands;
mod sound;
mod tray;

use pivot_core::cli::{self, Command};
use pivot_core::db::{self, Db};
use pivot_core::engine::Engine;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

pub struct AppState {
    pub engine: Mutex<Engine>,
}

pub const CHANGED: &str = "pivot://changed";

/// Tell every window and the tray that something changed.
pub fn changed(app: &AppHandle) {
    tray::refresh(app);
    let _ = app.emit(CHANGED, ());
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn handle_command(app: &AppHandle, cmd: &Command) {
    match cmd {
        Command::Open => show_main(app),
        c if c.mutates() => {
            let state = app.state::<AppState>();
            let mut engine = state.engine.lock().unwrap();
            if let Err(e) = cli::apply(&mut engine, c, db::now()) {
                eprintln!("pivot: {e}");
            }
            drop(engine);
            changed(app);
        }
        _ => {}
    }
}

fn start_clock(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(1000));
        let due = {
            let state = app.state::<AppState>();
            let mut engine = state.engine.lock().unwrap();
            engine.tick(db::now()).unwrap_or_default()
        };
        if !due.is_empty() {
            for s in &due {
                alerts::open(&app, s);
            }
            changed(&app);
        }
        tray::tick(&app);
    });
}

pub fn run(cmd: Command) {
    let engine = Engine::new(Db::open(&db::default_path()).expect("could not open the Pivot database"));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let args: Vec<String> = argv.into_iter().skip(1).collect();
            handle_command(app, &cli::parse(&args));
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--background"])))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { engine: Mutex::new(engine) })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::list_presets,
            commands::save_preset,
            commands::delete_preset,
            commands::set_favorite,
            commands::start_preset,
            commands::start_custom,
            commands::stop_timer,
            commands::list_recurring,
            commands::save_recurring,
            commands::delete_recurring,
            commands::set_recurring_enabled,
            commands::set_auto_enabled,
            commands::pause_auto,
            commands::history,
            commands::alert_info,
            commands::answer,
            commands::set_setting,
            commands::open_site,
        ])
        .on_window_event(|window, event| {
            // Closing the main window keeps Pivot running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            tray::create(&handle)?;

            // Start with the system the first time; the user can turn it off later.
            {
                let state = handle.state::<AppState>();
                let engine = state.engine.lock().unwrap();
                if engine.db.setting("autostart_set") != "1" {
                    let _ = handle.autolaunch().enable();
                    let _ = engine.db.set_setting("autostart_set", "1");
                }
            }

            match &cmd {
                Command::Background => {}
                Command::Open => show_main(&handle),
                other => handle_command(&handle, other),
            }
            start_clock(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Pivot")
        .run(|_app, event| {
            // Keep running in the tray when the last window closes.
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
