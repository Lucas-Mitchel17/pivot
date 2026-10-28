//! Commands the windows call through `invoke`.

use crate::{alerts, changed, tray::SITE, AppState};
use chrono::{Duration, NaiveDate};
use pivot_core::db::{self, local_date, Preset, PresetInput, Recurring, RecurringInput, Session};
use pivot_core::engine::{Answer, Engine};
use pivot_core::stats::{self, Summary};
use serde::Serialize;
use std::sync::MutexGuard;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

type Res<T> = Result<T, String>;

fn engine<'a>(state: &'a State<AppState>) -> MutexGuard<'a, Engine> {
    state.engine.lock().unwrap()
}

#[derive(Serialize)]
pub struct Active {
    session: Session,
    next: Option<Preset>,
}

#[derive(Serialize)]
pub struct AppStateDto {
    active: Option<Active>,
    auto_enabled: bool,
    auto_paused_until: f64,
    theme: String,
    lang: String,
    now: f64,
}

#[tauri::command]
pub fn get_state(state: State<AppState>) -> Res<AppStateDto> {
    let e = engine(&state);
    let active = match e.active()? {
        Some(session) => Some(Active { next: e.next_preset_for(&session)?, session }),
        None => None,
    };
    Ok(AppStateDto {
        active,
        auto_enabled: e.db.setting("auto_enabled") == "1",
        auto_paused_until: e.db.setting("auto_paused_until").parse().unwrap_or(0.0),
        theme: e.db.setting("theme"),
        lang: e.db.setting("lang"),
        now: db::now(),
    })
}

// ---------- presets ----------

#[tauri::command]
pub fn list_presets(state: State<AppState>) -> Res<Vec<Preset>> {
    engine(&state).db.presets(false)
}

#[tauri::command]
pub fn save_preset(app: AppHandle, state: State<AppState>, input: PresetInput) -> Res<i64> {
    let id = engine(&state).db.save_preset(&input)?;
    changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn delete_preset(app: AppHandle, state: State<AppState>, id: i64) -> Res<()> {
    engine(&state).db.delete_preset(id)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_favorite(app: AppHandle, state: State<AppState>, id: i64, favorite: bool) -> Res<()> {
    engine(&state).db.set_favorite(id, favorite)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn start_preset(app: AppHandle, state: State<AppState>, id: i64) -> Res<()> {
    {
        let mut e = engine(&state);
        let p = e.db.preset(id)?.ok_or("preset not found")?;
        e.start_preset(&p, "app", db::now())?;
    }
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn start_custom(app: AppHandle, state: State<AppState>, title: String, minutes: f64, category: String) -> Res<()> {
    engine(&state).start_custom(&title, minutes, &category, "app", db::now())?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn stop_timer(app: AppHandle, state: State<AppState>) -> Res<()> {
    let stopped = engine(&state).stop(db::now())?;
    if let Some(s) = stopped {
        alerts::close(&app, s.id);
    }
    changed(&app);
    Ok(())
}

// ---------- reminders ----------

#[derive(Serialize)]
pub struct RecurringDto {
    #[serde(flatten)]
    rec: Recurring,
    next_slot: Option<f64>,
}

#[tauri::command]
pub fn list_recurring(state: State<AppState>) -> Res<Vec<RecurringDto>> {
    let now = db::now();
    Ok(engine(&state)
        .db
        .recurring()?
        .into_iter()
        .map(|rec| RecurringDto { next_slot: if rec.enabled { rec.next_slot(now) } else { None }, rec })
        .collect())
}

#[tauri::command]
pub fn save_recurring(app: AppHandle, state: State<AppState>, input: RecurringInput) -> Res<i64> {
    let id = engine(&state).db.save_recurring(&input)?;
    changed(&app);
    Ok(id)
}

#[tauri::command]
pub fn delete_recurring(app: AppHandle, state: State<AppState>, id: i64) -> Res<()> {
    engine(&state).db.delete_recurring(id)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_recurring_enabled(app: AppHandle, state: State<AppState>, id: i64, enabled: bool) -> Res<()> {
    engine(&state).db.set_recurring_enabled(id, enabled)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn set_auto_enabled(app: AppHandle, state: State<AppState>, enabled: bool) -> Res<()> {
    engine(&state).db.set_setting("auto_enabled", if enabled { "1" } else { "0" })?;
    changed(&app);
    Ok(())
}

/// `seconds` = 0 resumes.
#[tauri::command]
pub fn pause_auto(app: AppHandle, state: State<AppState>, seconds: f64) -> Res<()> {
    let until = if seconds > 0.0 { db::now() + seconds } else { 0.0 };
    engine(&state).db.set_setting("auto_paused_until", &until.to_string())?;
    changed(&app);
    Ok(())
}

// ---------- history ----------

#[derive(Serialize)]
pub struct DayRow {
    date: String,
    stand_s: f64,
    sit_s: f64,
    switches: i64,
    water_done: i64,
    water_total: i64,
}

#[derive(Serialize)]
pub struct History {
    summary: Summary,
    days: Vec<DayRow>,
}

/// `date` is "YYYY-MM-DD"; with `week`, the Monday–Sunday week containing it.
#[tauri::command]
pub fn history(state: State<AppState>, date: String, week: bool) -> Res<History> {
    let day = NaiveDate::parse_from_str(&date, "%Y-%m-%d").unwrap_or_else(|_| local_date(db::now()));
    let now = db::now();
    let e = engine(&state);
    if !week {
        return Ok(History { summary: stats::summarize_day(&e.db, day, now)?, days: vec![] });
    }
    let first = stats::week_start(day);
    let mut days = vec![];
    for i in 0..7 {
        let d = first + Duration::days(i);
        let s = stats::summarize_day(&e.db, d, now)?;
        days.push(DayRow {
            date: d.format("%Y-%m-%d").to_string(),
            stand_s: s.stand_s,
            sit_s: s.sit_s,
            switches: s.switches,
            water_done: s.water_done,
            water_total: s.water_total,
        });
    }
    Ok(History { summary: stats::summarize_week(&e.db, day, now)?, days })
}

// ---------- alert ----------

#[derive(Serialize)]
pub struct AlertInfo {
    session: Session,
    next: Option<Preset>,
    every_min: Option<i64>,
}

#[tauri::command]
pub fn alert_info(state: State<AppState>, id: i64) -> Res<AlertInfo> {
    let e = engine(&state);
    let session = e.db.session(id)?.ok_or("session not found")?;
    let next = e.next_preset_for(&session)?;
    let every_min = match session.recurring_id {
        Some(r) => e.db.recurring_one(r)?.map(|r| r.every_min),
        None => None,
    };
    Ok(AlertInfo { session, next, every_min })
}

#[tauri::command]
pub fn answer(app: AppHandle, state: State<AppState>, id: i64, action: Answer, snooze_min: f64) -> Res<()> {
    engine(&state).answer(id, action, snooze_min, db::now())?;
    alerts::close(&app, id);
    changed(&app);
    Ok(())
}

// ---------- settings ----------

#[tauri::command]
pub fn set_setting(app: AppHandle, state: State<AppState>, key: String, value: String) -> Res<()> {
    let allowed = match key.as_str() {
        "theme" => ["system", "light", "dark"].contains(&value.as_str()),
        "lang" => ["pt", "en"].contains(&value.as_str()),
        _ => false,
    };
    if !allowed {
        return Err(format!("invalid setting {key}={value}"));
    }
    engine(&state).db.set_setting(&key, &value)?;
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn open_site(app: AppHandle) -> Res<()> {
    app.opener().open_url(SITE, None::<&str>).map_err(|e| e.to_string())
}
