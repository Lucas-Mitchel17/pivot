//! The alert: a small window above everything else, plus a system
//! notification in case the window lands behind a fullscreen app.

use crate::AppState;
use pivot_core::db::Session;
use pivot_core::i18n::{display_title, tr, Lang};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;

pub fn label(session_id: i64) -> String {
    format!("alert-{session_id}")
}

pub fn open(app: &AppHandle, s: &Session) {
    let lang = {
        let state = app.state::<AppState>();
        let engine = state.engine.lock().unwrap();
        Lang::from_setting(&engine.db.setting("lang"))
    };
    let title = display_title(lang, &s.title);

    let label = label(s.id);
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.show();
        let _ = w.set_focus();
    } else {
        let built = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("alert.html".into()))
            .title(format!("Pivot — {title}"))
            .inner_size(460.0, 500.0)
            .resizable(false)
            .minimizable(false)
            .always_on_top(true)
            .center()
            .focused(true)
            .build();
        if let Err(e) = built {
            eprintln!("pivot: could not open the alert: {e}");
        }
    }

    crate::sound::play_alarm();

    let body = if s.recurring_id.is_some() { String::new() } else { format!("\"{title}\" {}", tr(lang, "notify.timer")) };
    let _ = app
        .notification()
        .builder()
        .title(if s.recurring_id.is_some() { title.as_str() } else { "Pivot" })
        .body(if body.is_empty() { "Pivot" } else { body.as_str() })
        .show();
}

pub fn close(app: &AppHandle, session_id: i64) {
    if let Some(w) = app.get_webview_window(&label(session_id)) {
        let _ = w.close();
    }
}
