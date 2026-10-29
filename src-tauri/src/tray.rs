//! The tray / top-bar icon: countdown next to the icon (Linux and macOS;
//! tooltip on Windows) and a menu with the favorite timers.

use crate::{changed, show_main, AppState};
use pivot_core::db;
use pivot_core::i18n::{display_title, fmt_left, fmt_minutes, tr, Lang};
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_opener::OpenerExt;

const TRAY_ID: &str = "pivot";
pub const SITE: &str = "https://lucasmitchel.dev";

/// Last label written, so the 1-second clock only touches the tray on change.
static LAST_LABEL: Mutex<String> = Mutex::new(String::new());

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("Pivot")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(on_menu)
        .build(app)?;
    Ok(())
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let state = app.state::<AppState>();
    let engine = state.engine.lock().unwrap();
    let l = Lang::from_setting(&engine.db.setting("lang"));
    let favorites = engine.db.presets(true).unwrap_or_default();
    let active = engine.active().ok().flatten();
    let auto_on = engine.db.setting("auto_enabled") == "1";
    drop(engine);

    let mut items: Vec<Box<dyn IsMenuItem<Wry>>> = vec![];
    let paused = active.as_ref().is_some_and(|s| s.paused_at.is_some());
    let header = match &active {
        Some(s) => format!(
            "{} {} · {}",
            if paused { "⏸" } else { "▶" },
            display_title(l, &s.title),
            fmt_minutes(s.planned_s as f64 / 60.0)
        ),
        None => tr(l, "tray.idle").to_string(),
    };
    items.push(Box::new(MenuItem::with_id(app, "header", header, false, None::<&str>)?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    for p in favorites {
        let text = format!("{} — {}", fmt_minutes(p.minutes), display_title(l, &p.title));
        items.push(Box::new(MenuItem::with_id(app, format!("fav:{}", p.id), text, true, None::<&str>)?));
    }
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    let can_pause = active.as_ref().is_some_and(|s| paused || s.ends_at > db::now());
    let (pause_id, pause_text) = if paused { ("resume", "tray.resume") } else { ("pause", "tray.pause") };
    items.push(Box::new(MenuItem::with_id(app, pause_id, tr(l, pause_text), can_pause, None::<&str>)?));
    items.push(Box::new(MenuItem::with_id(app, "stop", tr(l, "tray.stop"), active.is_some(), None::<&str>)?));
    items.push(Box::new(CheckMenuItem::with_id(app, "auto", tr(l, "tray.auto"), true, auto_on, None::<&str>)?));
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(MenuItem::with_id(app, "open", tr(l, "tray.open"), true, None::<&str>)?));
    items.push(Box::new(MenuItem::with_id(app, "credit", tr(l, "tray.credit"), true, None::<&str>)?));
    items.push(Box::new(MenuItem::with_id(app, "quit", tr(l, "tray.quit"), true, None::<&str>)?));

    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|b| b.as_ref()).collect();
    Menu::with_items(app, &refs)
}

fn on_menu(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    let state = app.state::<AppState>();
    match id {
        "open" => show_main(app),
        "credit" => {
            let _ = app.opener().open_url(SITE, None::<&str>);
        }
        "quit" => app.exit(0),
        "stop" => {
            let _ = state.engine.lock().unwrap().stop(db::now());
            changed(app);
        }
        "pause" => {
            let _ = state.engine.lock().unwrap().pause(db::now());
            changed(app);
        }
        "resume" => {
            let _ = state.engine.lock().unwrap().resume(db::now());
            changed(app);
        }
        "auto" => {
            let engine = state.engine.lock().unwrap();
            let on = engine.db.setting("auto_enabled") == "1";
            let _ = engine.db.set_setting("auto_enabled", if on { "0" } else { "1" });
            drop(engine);
            changed(app);
        }
        fav if fav.starts_with("fav:") => {
            if let Ok(pid) = fav[4..].parse::<i64>() {
                let mut engine = state.engine.lock().unwrap();
                if let Ok(Some(p)) = engine.db.preset(pid) {
                    let _ = engine.start_preset(&p, "menu", db::now());
                }
                drop(engine);
                changed(app);
            }
        }
        _ => {}
    }
}

/// Rebuild the menu (favorites, language, running timer changed).
pub fn refresh(app: &AppHandle) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), build_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
    LAST_LABEL.lock().unwrap().clear();
    tick(app);
}

/// Update the countdown next to the icon. Called every second.
pub fn tick(app: &AppHandle) {
    let label = {
        let state = app.state::<AppState>();
        let engine = state.engine.lock().unwrap();
        let l = Lang::from_setting(&engine.db.setting("lang"));
        match engine.active().ok().flatten() {
            Some(s) => {
                let left = s.left_s(db::now());
                let clock = if left > 0.0 { fmt_left(left) } else { tr(l, "tray.due").to_string() };
                let mark = if s.paused_at.is_some() { "⏸ " } else { "" };
                format!("{mark}\"{}\" {}", display_title(l, &s.title), clock)
            }
            None => String::new(),
        }
    };
    let mut last = LAST_LABEL.lock().unwrap();
    if *last == label {
        return;
    }
    *last = label.clone();
    drop(last);
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if label.is_empty() { "Pivot".to_string() } else { format!("Pivot — {label}") };
        let _ = tray.set_tooltip(Some(&tooltip));
        #[cfg(not(target_os = "windows"))]
        let _ = tray.set_title(if label.is_empty() { None } else { Some(label.as_str()) });
    }
}
