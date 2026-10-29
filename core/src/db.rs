//! SQLite storage: categories, presets, recurring reminders, sessions and settings.
//!
//! Times are epoch seconds (f64). Weekdays follow chrono's Monday = 0 …
//! Sunday = 6, stored as a string of digits ("01234" = Mon–Fri).
//!
//! The schema is versioned with `PRAGMA user_version`; future changes go in
//! `migrate` as new steps, so existing databases upgrade in place.

use chrono::{Datelike, Local, NaiveDate, NaiveTime, TimeZone};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, String>;

fn err(e: rusqlite::Error) -> String {
    e.to_string()
}

pub const SCHEMA_VERSION: i64 = 2;

/// Built-in categories: (key, stored name). Names are Portuguese and get
/// translated for display; user categories keep the name they were given.
pub const BUILTIN_CATEGORIES: [(&str, &str); 6] = [
    ("stand", "Em pé"),
    ("sit", "Sentado"),
    ("break", "Pausa"),
    ("focus", "Foco"),
    ("water", "Água"),
    ("other", "Outro"),
];

const SCHEMA: &str = "
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY,
    key        TEXT UNIQUE,
    name       TEXT NOT NULL,
    color      TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);
CREATE TABLE presets (
    id             INTEGER PRIMARY KEY,
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    minutes        REAL NOT NULL,
    category_id    INTEGER NOT NULL REFERENCES categories(id),
    next_preset_id INTEGER REFERENCES presets(id) ON DELETE SET NULL,
    favorite       INTEGER NOT NULL DEFAULT 1,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     REAL NOT NULL
);
CREATE TABLE recurring (
    id            INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    every_min     INTEGER NOT NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    weekdays      TEXT NOT NULL DEFAULT '01234',
    enabled       INTEGER NOT NULL DEFAULT 1,
    last_fired_at REAL
);
CREATE TABLE sessions (
    id           INTEGER PRIMARY KEY,
    preset_id    INTEGER REFERENCES presets(id) ON DELETE SET NULL,
    recurring_id INTEGER REFERENCES recurring(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    source       TEXT NOT NULL,
    started_at   REAL NOT NULL,
    planned_s    INTEGER NOT NULL,
    ends_at      REAL NOT NULL,
    ended_at     REAL,
    outcome      TEXT,
    snoozes      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_started ON sessions(started_at);
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

const DEFAULT_SETTINGS: [(&str, &str); 8] = [
    ("auto_enabled", "1"),
    ("auto_paused_until", "0"),
    ("theme", "system"), // system | light | dark
    ("lang", "pt"),      // pt | en
    ("sound_volume", "60"),
    ("sound_file", ""), // file name inside the data dir, "" = built-in chime
    ("alert_on_top", "1"), // keep the alert above other windows until it is answered
    ("goal_days", "01234"), // weekdays the daily goals apply to (Mon–Fri)
];

pub fn default_path() -> PathBuf {
    if let Some(path) = std::env::var_os("PIVOT_DB") {
        return PathBuf::from(path);
    }
    data_dir().join("pivot.db")
}

/// Where the database and the custom alert sound live.
pub fn data_dir() -> PathBuf {
    if let Some(path) = std::env::var_os("PIVOT_DB") {
        if let Some(parent) = PathBuf::from(path).parent() {
            return parent.to_path_buf();
        }
    }
    dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("pivot")
}

pub fn slugify(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        let base = match ch {
            'á' | 'à' | 'â' | 'ã' | 'ä' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            c => c.to_ascii_lowercase(),
        };
        if base.is_ascii_alphanumeric() {
            out.push(base);
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() { "timer".into() } else { out }
}

pub fn parse_hhmm(value: &str) -> Option<NaiveTime> {
    let (h, m) = value.trim().split_once(':')?;
    if m.len() != 2 {
        return None;
    }
    NaiveTime::from_hms_opt(h.parse().ok()?, m.parse().ok()?, 0)
}

/// Goal units: minutes of timers per day, or times per day (timers + reminders done).
pub const GOAL_UNITS: [&str; 2] = ["min", "count"];

fn valid_color(c: &str) -> bool {
    c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Category {
    pub id: i64,
    /// Set for built-in categories ("stand", "sit"…), `None` for user ones.
    pub key: Option<String>,
    pub name: String,
    /// "#rrggbb"; `None` (built-ins only) takes the color from the theme.
    pub color: Option<String>,
    pub sort_order: i64,
    /// Daily goal, in `goal_unit`; `None` = no goal.
    pub goal: Option<f64>,
    pub goal_unit: String,
}

impl Category {
    /// A built-in keeps its translated name until the user renames it.
    pub fn renamed(&self) -> bool {
        match self.key.as_deref() {
            Some(key) => BUILTIN_CATEGORIES.iter().any(|(k, n)| *k == key && *n != self.name),
            None => true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Preset {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub minutes: f64,
    pub category_id: i64,
    pub next_preset_id: Option<i64>,
    pub favorite: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Recurring {
    pub id: i64,
    pub title: String,
    pub category_id: i64,
    pub every_min: i64,
    pub start_time: String,
    pub end_time: String,
    pub weekdays: String,
    pub enabled: bool,
    pub last_fired_at: Option<f64>,
}

impl Recurring {
    /// Fire times on `day`: start+every, start+2·every … up to end (inclusive).
    pub fn slots_on(&self, day: NaiveDate) -> Vec<f64> {
        let wd = day.weekday().num_days_from_monday().to_string();
        if !self.weekdays.contains(&wd) || self.every_min <= 0 {
            return vec![];
        }
        let (Some(start), Some(end)) = (parse_hhmm(&self.start_time), parse_hhmm(&self.end_time)) else {
            return vec![];
        };
        let mut out = vec![];
        let mut t = start;
        loop {
            let (next, wrapped) = t.overflowing_add_signed(chrono::Duration::minutes(self.every_min));
            if wrapped != 0 || next > end {
                break;
            }
            t = next;
            if let Some(ts) = Local.from_local_datetime(&day.and_time(t)).earliest() {
                out.push(ts.timestamp() as f64);
            }
        }
        out
    }

    pub fn next_slot(&self, now: f64) -> Option<f64> {
        let today = local_date(now);
        (0..8)
            .flat_map(|d| self.slots_on(today + chrono::Duration::days(d)))
            .find(|&ts| ts > now)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Session {
    pub id: i64,
    pub preset_id: Option<i64>,
    pub recurring_id: Option<i64>,
    pub title: String,
    pub category_id: i64,
    pub source: String,
    pub started_at: f64,
    pub planned_s: i64,
    pub ends_at: f64,
    pub ended_at: Option<f64>,
    pub outcome: Option<String>,
    pub snoozes: i64,
    /// Set while the timer is paused.
    pub paused_at: Option<f64>,
    /// Seconds spent paused (finished pauses only).
    pub paused_s: f64,
}

impl Session {
    /// Seconds the timer actually ran up to `until` (its end, or now).
    pub fn run_s(&self, until: f64) -> f64 {
        let stop = self.paused_at.map_or(until, |p| p.min(until));
        (stop - self.started_at - self.paused_s).max(0.0)
    }

    /// Seconds left, frozen while paused.
    pub fn left_s(&self, now: f64) -> f64 {
        self.ends_at - self.paused_at.unwrap_or(now)
    }
}

pub fn local_date(ts: f64) -> NaiveDate {
    Local.timestamp_opt(ts as i64, 0).single().map(|d| d.date_naive()).unwrap_or_default()
}

pub fn day_start(day: NaiveDate) -> f64 {
    Local
        .from_local_datetime(&day.and_hms_opt(0, 0, 0).unwrap())
        .earliest()
        .map(|d| d.timestamp() as f64)
        .unwrap_or(0.0)
}

pub struct Db {
    conn: Connection,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CategoryInput {
    pub id: Option<i64>,
    pub name: String,
    /// Required for user categories; `None` gives a built-in its theme color back.
    pub color: Option<String>,
    pub goal: Option<f64>,
    pub goal_unit: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PresetInput {
    pub id: Option<i64>,
    pub title: String,
    pub minutes: f64,
    pub category_id: i64,
    pub next_preset_id: Option<i64>,
    pub favorite: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecurringInput {
    pub id: Option<i64>,
    pub title: String,
    pub category_id: i64,
    pub every_min: i64,
    pub start_time: String,
    pub end_time: String,
    pub weekdays: String,
    pub enabled: bool,
}

impl Db {
    pub fn open(path: &PathBuf) -> Result<Self> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        Self::init(Connection::open(path).map_err(err)?)
    }

    pub fn in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory().map_err(err)?)
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(err)?;
        let db = Db { conn };
        db.migrate()?;
        db.seed()?;
        Ok(db)
    }

    fn version(&self) -> Result<i64> {
        self.conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)
    }

    fn migrate(&self) -> Result<()> {
        if self.version()? < 1 {
            let mut sql = String::from("BEGIN;");
            sql.push_str(SCHEMA);
            for (i, (key, name)) in BUILTIN_CATEGORIES.iter().enumerate() {
                sql.push_str(&format!(
                    "INSERT INTO categories(key, name, sort_order, created_at) VALUES ('{key}', '{name}', {}, 0);",
                    i + 1
                ));
            }
            sql.push_str("PRAGMA user_version = 1; COMMIT;");
            self.batch(&sql)?;
        }
        if self.version()? < 2 {
            // 0.4: daily goals per type, pausing timers.
            self.batch(
                "BEGIN;
                 ALTER TABLE categories ADD COLUMN goal REAL;
                 ALTER TABLE categories ADD COLUMN goal_unit TEXT NOT NULL DEFAULT 'min';
                 ALTER TABLE sessions ADD COLUMN paused_at REAL;
                 ALTER TABLE sessions ADD COLUMN paused_s REAL NOT NULL DEFAULT 0;
                 PRAGMA user_version = 2;
                 COMMIT;",
            )?;
        }
        Ok(())
    }

    fn batch(&self, sql: &str) -> Result<()> {
        self.conn.execute_batch(sql).map_err(|e| {
            let _ = self.conn.execute_batch("ROLLBACK");
            err(e)
        })
    }

    fn seed(&self) -> Result<()> {
        for (k, v) in DEFAULT_SETTINGS {
            self.conn
                .execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?1, ?2)", params![k, v])
                .map_err(err)?;
        }
        let presets: i64 = self.conn.query_row("SELECT COUNT(*) FROM presets", [], |r| r.get(0)).map_err(err)?;
        if presets == 0 {
            let cat = |k: &str| self.category_id(k);
            let stand = self.add_preset("Em pé", 15.0, cat("stand")?, None, true)?;
            let sit = self.add_preset("Sentado", 45.0, cat("sit")?, Some(stand), true)?;
            let rest = self.add_preset("Descanso", 10.0, cat("break")?, None, true)?;
            self.add_preset("Foco", 25.0, cat("focus")?, Some(rest), true)?;
            self.set_next(stand, Some(sit))?;
        }
        let recurring: i64 =
            self.conn.query_row("SELECT COUNT(*) FROM recurring", [], |r| r.get(0)).map_err(err)?;
        if recurring == 0 {
            self.save_recurring(&RecurringInput {
                id: None,
                title: "Beber água".into(),
                category_id: self.category_id("water")?,
                every_min: 60,
                start_time: "09:00".into(),
                end_time: "18:00".into(),
                weekdays: "01234".into(),
                enabled: true,
            })?;
        }
        Ok(())
    }

    // ---------- settings ----------

    pub fn setting(&self, key: &str) -> String {
        self.conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
            .or_else(|| DEFAULT_SETTINGS.iter().find(|(k, _)| *k == key).map(|(_, v)| v.to_string()))
            .unwrap_or_default()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn
            .execute(
                "INSERT INTO settings(key, value) VALUES (?1, ?2) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map(|_| ())
            .map_err(err)
    }

    // ---------- categories ----------

    pub fn categories(&self) -> Result<Vec<Category>> {
        let mut stmt = self.conn.prepare("SELECT * FROM categories ORDER BY sort_order, id").map_err(err)?;
        let rows = stmt.query_map([], category_row).map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    }

    pub fn category(&self, id: i64) -> Result<Option<Category>> {
        self.conn
            .query_row("SELECT * FROM categories WHERE id = ?1", [id], category_row)
            .optional()
            .map_err(err)
    }

    /// Id of a built-in category by key ("stand", "other"…).
    pub fn category_id(&self, key: &str) -> Result<i64> {
        self.conn
            .query_row("SELECT id FROM categories WHERE key = ?1", [key], |r| r.get(0))
            .map_err(err)
    }

    /// Creates or updates a category. Built-ins can be renamed, recolored and
    /// given a goal, but keep their key (and can't be deleted).
    pub fn save_category(&self, c: &CategoryInput) -> Result<i64> {
        let name = c.name.trim();
        let builtin = match c.id {
            Some(id) => self.category(id)?.ok_or("category not found")?.key.is_some(),
            None => false,
        };
        let color_ok = match &c.color {
            Some(color) => valid_color(color),
            None => builtin,
        };
        let goal_ok = c.goal.is_none_or(|g| g > 0.0 && g <= 24.0 * 60.0) && GOAL_UNITS.contains(&c.goal_unit.as_str());
        if name.is_empty() || !color_ok || !goal_ok {
            return Err("invalid category".into());
        }
        let taken: Option<i64> = self
            .conn
            .query_row("SELECT id FROM categories WHERE lower(name) = lower(?1)", [name], |r| r.get(0))
            .optional()
            .map_err(err)?;
        if taken.is_some_and(|id| Some(id) != c.id) {
            return Err("duplicate category".into());
        }
        match c.id {
            None => {
                let order: i64 = self
                    .conn
                    .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories", [], |r| r.get(0))
                    .map_err(err)?;
                self.conn
                    .execute(
                        "INSERT INTO categories(name, color, sort_order, created_at, goal, goal_unit) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![name, c.color, order, now(), c.goal, c.goal_unit],
                    )
                    .map_err(err)?;
                Ok(self.conn.last_insert_rowid())
            }
            Some(id) => {
                self.conn
                    .execute(
                        "UPDATE categories SET name = ?1, color = ?2, goal = ?3, goal_unit = ?4 WHERE id = ?5",
                        params![name, c.color, c.goal, c.goal_unit, id],
                    )
                    .map_err(err)?;
                Ok(id)
            }
        }
    }

    /// Deletes a user category; timers, reminders and history using it move to "other".
    pub fn delete_category(&self, id: i64) -> Result<()> {
        let cat = self.category(id)?.ok_or("category not found")?;
        if cat.key.is_some() {
            return Err("built-in categories can't be deleted".into());
        }
        let other = self.category_id("other")?;
        for table in ["presets", "recurring", "sessions"] {
            self.conn
                .execute(&format!("UPDATE {table} SET category_id = ?1 WHERE category_id = ?2"), params![other, id])
                .map_err(err)?;
        }
        self.conn.execute("DELETE FROM categories WHERE id = ?1", [id]).map(|_| ()).map_err(err)
    }

    fn check_category(&self, id: i64) -> Result<()> {
        self.category(id)?.map(|_| ()).ok_or_else(|| "unknown category".into())
    }

    // ---------- presets ----------

    fn unique_slug(&self, title: &str, exclude: Option<i64>) -> Result<String> {
        let base = slugify(title);
        let mut slug = base.clone();
        let mut n = 2;
        loop {
            let found: Option<i64> = self
                .conn
                .query_row("SELECT id FROM presets WHERE slug = ?1", [&slug], |r| r.get(0))
                .optional()
                .map_err(err)?;
            match found {
                None => return Ok(slug),
                Some(id) if Some(id) == exclude => return Ok(slug),
                _ => {
                    slug = format!("{base}-{n}");
                    n += 1;
                }
            }
        }
    }

    pub fn add_preset(&self, title: &str, minutes: f64, category_id: i64, next: Option<i64>, favorite: bool) -> Result<i64> {
        let order: i64 = self
            .conn
            .query_row("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM presets", [], |r| r.get(0))
            .map_err(err)?;
        self.conn
            .execute(
                "INSERT INTO presets(slug, title, minutes, category_id, next_preset_id, favorite, sort_order, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![self.unique_slug(title, None)?, title, minutes, category_id, next, favorite, order, now()],
            )
            .map_err(err)?;
        Ok(self.conn.last_insert_rowid())
    }

    fn set_next(&self, id: i64, next: Option<i64>) -> Result<()> {
        self.conn
            .execute("UPDATE presets SET next_preset_id = ?1 WHERE id = ?2", params![next, id])
            .map(|_| ())
            .map_err(err)
    }

    pub fn save_preset(&self, p: &PresetInput) -> Result<i64> {
        let title = p.title.trim();
        if title.is_empty() || p.minutes <= 0.0 {
            return Err("invalid preset".into());
        }
        self.check_category(p.category_id)?;
        match p.id {
            None => self.add_preset(title, p.minutes, p.category_id, p.next_preset_id, p.favorite),
            Some(id) => {
                let next = p.next_preset_id.filter(|&n| n != id);
                self.conn
                    .execute(
                        "UPDATE presets SET slug = ?1, title = ?2, minutes = ?3, category_id = ?4, \
                         next_preset_id = ?5, favorite = ?6 WHERE id = ?7",
                        params![self.unique_slug(title, Some(id))?, title, p.minutes, p.category_id, next, p.favorite, id],
                    )
                    .map_err(err)?;
                Ok(id)
            }
        }
    }

    pub fn set_favorite(&self, id: i64, favorite: bool) -> Result<()> {
        self.conn
            .execute("UPDATE presets SET favorite = ?1 WHERE id = ?2", params![favorite, id])
            .map(|_| ())
            .map_err(err)
    }

    pub fn delete_preset(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM presets WHERE id = ?1", [id]).map(|_| ()).map_err(err)
    }

    pub fn presets(&self, favorites_only: bool) -> Result<Vec<Preset>> {
        let sql = if favorites_only {
            "SELECT * FROM presets WHERE favorite = 1 ORDER BY sort_order, id"
        } else {
            "SELECT * FROM presets ORDER BY sort_order, id"
        };
        let mut stmt = self.conn.prepare(sql).map_err(err)?;
        let rows = stmt.query_map([], preset_row).map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    }

    pub fn preset(&self, id: i64) -> Result<Option<Preset>> {
        self.conn
            .query_row("SELECT * FROM presets WHERE id = ?1", [id], preset_row)
            .optional()
            .map_err(err)
    }

    /// By slug, then case-insensitive title, then slugified key.
    pub fn find_preset(&self, key: &str) -> Result<Option<Preset>> {
        let q = |sql: &str, v: &str| self.conn.query_row(sql, [v], preset_row).optional().map_err(err);
        if let Some(p) = q("SELECT * FROM presets WHERE slug = ?1", key)? {
            return Ok(Some(p));
        }
        if let Some(p) = q("SELECT * FROM presets WHERE lower(title) = lower(?1)", key)? {
            return Ok(Some(p));
        }
        q("SELECT * FROM presets WHERE slug = ?1", &slugify(key))
    }

    // ---------- recurring ----------

    pub fn save_recurring(&self, r: &RecurringInput) -> Result<i64> {
        let title = r.title.trim();
        let (Some(start), Some(end)) = (parse_hhmm(&r.start_time), parse_hhmm(&r.end_time)) else {
            return Err("invalid time".into());
        };
        if title.is_empty() || r.every_min <= 0 || end <= start || r.weekdays.is_empty() {
            return Err("invalid reminder".into());
        }
        self.check_category(r.category_id)?;
        let (st, et) = (start.format("%H:%M").to_string(), end.format("%H:%M").to_string());
        match r.id {
            None => {
                self.conn
                    .execute(
                        "INSERT INTO recurring(title, category_id, every_min, start_time, end_time, weekdays, enabled) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![title, r.category_id, r.every_min, st, et, r.weekdays, r.enabled],
                    )
                    .map_err(err)?;
                Ok(self.conn.last_insert_rowid())
            }
            Some(id) => {
                self.conn
                    .execute(
                        "UPDATE recurring SET title = ?1, category_id = ?2, every_min = ?3, start_time = ?4, \
                         end_time = ?5, weekdays = ?6, enabled = ?7 WHERE id = ?8",
                        params![title, r.category_id, r.every_min, st, et, r.weekdays, r.enabled, id],
                    )
                    .map_err(err)?;
                Ok(id)
            }
        }
    }

    pub fn set_recurring_enabled(&self, id: i64, enabled: bool) -> Result<()> {
        self.conn
            .execute("UPDATE recurring SET enabled = ?1 WHERE id = ?2", params![enabled, id])
            .map(|_| ())
            .map_err(err)
    }

    pub fn set_last_fired(&self, id: i64, ts: f64) -> Result<()> {
        self.conn
            .execute("UPDATE recurring SET last_fired_at = ?1 WHERE id = ?2", params![ts, id])
            .map(|_| ())
            .map_err(err)
    }

    pub fn delete_recurring(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM recurring WHERE id = ?1", [id]).map(|_| ()).map_err(err)
    }

    pub fn recurring(&self) -> Result<Vec<Recurring>> {
        let mut stmt = self.conn.prepare("SELECT * FROM recurring ORDER BY id").map_err(err)?;
        let rows = stmt.query_map([], recurring_row).map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    }

    pub fn recurring_one(&self, id: i64) -> Result<Option<Recurring>> {
        self.conn
            .query_row("SELECT * FROM recurring WHERE id = ?1", [id], recurring_row)
            .optional()
            .map_err(err)
    }

    // ---------- sessions ----------

    #[allow(clippy::too_many_arguments)]
    pub fn start_session(
        &self,
        title: &str,
        category_id: i64,
        source: &str,
        planned_s: i64,
        preset_id: Option<i64>,
        recurring_id: Option<i64>,
        now: f64,
    ) -> Result<i64> {
        self.conn
            .execute(
                "INSERT INTO sessions(preset_id, recurring_id, title, category_id, source, started_at, planned_s, ends_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![preset_id, recurring_id, title, category_id, source, now, planned_s, now + planned_s as f64],
            )
            .map_err(err)?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn snooze_session(&self, id: i64, ends_at: f64) -> Result<()> {
        self.conn
            .execute("UPDATE sessions SET ends_at = ?1, snoozes = snoozes + 1 WHERE id = ?2", params![ends_at, id])
            .map(|_| ())
            .map_err(err)
    }

    /// Ending a paused timer closes the pause too.
    pub fn end_session(&self, id: i64, outcome: &str, now: f64) -> Result<()> {
        self.conn
            .execute(
                "UPDATE sessions SET ended_at = ?1, outcome = ?2, \
                 paused_s = paused_s + COALESCE(?1 - paused_at, 0), paused_at = NULL \
                 WHERE id = ?3 AND ended_at IS NULL",
                params![now, outcome, id],
            )
            .map(|_| ())
            .map_err(err)
    }

    pub fn pause_session(&self, id: i64, now: f64) -> Result<()> {
        self.conn
            .execute(
                "UPDATE sessions SET paused_at = ?1 WHERE id = ?2 AND ended_at IS NULL AND paused_at IS NULL",
                params![now, id],
            )
            .map(|_| ())
            .map_err(err)
    }

    /// Moves the end forward by the time spent paused.
    pub fn resume_session(&self, id: i64, now: f64) -> Result<()> {
        self.conn
            .execute(
                "UPDATE sessions SET ends_at = ends_at + (?1 - paused_at), paused_s = paused_s + (?1 - paused_at), \
                 paused_at = NULL WHERE id = ?2 AND paused_at IS NOT NULL",
                params![now, id],
            )
            .map(|_| ())
            .map_err(err)
    }

    pub fn session(&self, id: i64) -> Result<Option<Session>> {
        self.conn
            .query_row("SELECT * FROM sessions WHERE id = ?1", [id], session_row)
            .optional()
            .map_err(err)
    }

    /// The running (or finished but unanswered) timer, if any.
    pub fn open_timer(&self) -> Result<Option<Session>> {
        self.conn
            .query_row(
                "SELECT * FROM sessions WHERE ended_at IS NULL AND recurring_id IS NULL \
                 ORDER BY started_at DESC LIMIT 1",
                [],
                session_row,
            )
            .optional()
            .map_err(err)
    }

    pub fn open_reminders(&self) -> Result<Vec<Session>> {
        self.query_sessions(
            "SELECT * FROM sessions WHERE ended_at IS NULL AND recurring_id IS NOT NULL ORDER BY started_at",
            [],
        )
    }

    pub fn sessions_between(&self, start: f64, end: f64) -> Result<Vec<Session>> {
        self.query_sessions(
            "SELECT * FROM sessions WHERE started_at < ?1 AND COALESCE(ended_at, ends_at, started_at) >= ?2 \
             ORDER BY started_at",
            params![end, start],
        )
    }

    /// Deletes finished sessions; with `before`, only those that started earlier.
    /// The running timer and unanswered reminders are kept. Returns how many were deleted.
    pub fn clear_history(&self, before: Option<f64>) -> Result<usize> {
        self.conn
            .execute(
                "DELETE FROM sessions WHERE ended_at IS NOT NULL AND started_at < ?1",
                [before.unwrap_or(f64::MAX)],
            )
            .map_err(err)
    }

    fn query_sessions<P: rusqlite::Params>(&self, sql: &str, p: P) -> Result<Vec<Session>> {
        let mut stmt = self.conn.prepare(sql).map_err(err)?;
        let rows = stmt.query_map(p, session_row).map_err(err)?;
        rows.collect::<std::result::Result<_, _>>().map_err(err)
    }
}

pub fn now() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

fn category_row(r: &Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: r.get("id")?,
        key: r.get("key")?,
        name: r.get("name")?,
        color: r.get("color")?,
        sort_order: r.get("sort_order")?,
        goal: r.get("goal")?,
        goal_unit: r.get("goal_unit")?,
    })
}

fn preset_row(r: &Row) -> rusqlite::Result<Preset> {
    Ok(Preset {
        id: r.get("id")?,
        slug: r.get("slug")?,
        title: r.get("title")?,
        minutes: r.get("minutes")?,
        category_id: r.get("category_id")?,
        next_preset_id: r.get("next_preset_id")?,
        favorite: r.get("favorite")?,
        sort_order: r.get("sort_order")?,
    })
}

fn recurring_row(r: &Row) -> rusqlite::Result<Recurring> {
    Ok(Recurring {
        id: r.get("id")?,
        title: r.get("title")?,
        category_id: r.get("category_id")?,
        every_min: r.get("every_min")?,
        start_time: r.get("start_time")?,
        end_time: r.get("end_time")?,
        weekdays: r.get("weekdays")?,
        enabled: r.get("enabled")?,
        last_fired_at: r.get("last_fired_at")?,
    })
}

fn session_row(r: &Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: r.get("id")?,
        preset_id: r.get("preset_id")?,
        recurring_id: r.get("recurring_id")?,
        title: r.get("title")?,
        category_id: r.get("category_id")?,
        source: r.get("source")?,
        started_at: r.get("started_at")?,
        planned_s: r.get("planned_s")?,
        ends_at: r.get("ends_at")?,
        ended_at: r.get("ended_at")?,
        outcome: r.get("outcome")?,
        snoozes: r.get("snoozes")?,
        paused_at: r.get("paused_at")?,
        paused_s: r.get("paused_s")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seeds_presets_categories_and_water_reminder() {
        let db = Db::in_memory().unwrap();
        assert_eq!(db.version().unwrap(), SCHEMA_VERSION);
        let presets = db.presets(false).unwrap();
        assert_eq!(presets.iter().map(|p| p.slug.as_str()).collect::<Vec<_>>(), ["em-pe", "sentado", "descanso", "foco"]);
        let (stand, sit) = (&presets[0], &presets[1]);
        assert_eq!(stand.next_preset_id, Some(sit.id));
        assert_eq!(sit.next_preset_id, Some(stand.id));
        assert_eq!(stand.category_id, db.category_id("stand").unwrap());
        let rec = db.recurring().unwrap();
        assert_eq!(rec.len(), 1);
        assert_eq!(rec[0].category_id, db.category_id("water").unwrap());
        assert_eq!(db.categories().unwrap().len(), BUILTIN_CATEGORIES.len());
    }

    #[test]
    fn opening_twice_keeps_data_and_does_not_reseed() {
        let dir = std::env::temp_dir().join(format!("pivot-test-{}", std::process::id()));
        let path = dir.join("pivot.db");
        let _ = std::fs::remove_dir_all(&dir);
        let db = Db::open(&path).unwrap();
        db.save_category(&CategoryInput { id: None, name: "Mine".into(), color: Some("#57e389".into()), goal: None, goal_unit: "min".into() }).unwrap();
        drop(db);
        let db = Db::open(&path).unwrap();
        assert_eq!(db.version().unwrap(), SCHEMA_VERSION);
        assert_eq!(db.categories().unwrap().len(), BUILTIN_CATEGORIES.len() + 1);
        assert_eq!(db.presets(false).unwrap().len(), 4);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn user_categories_can_be_created_edited_and_deleted() {
        let db = Db::in_memory().unwrap();
        let id = db.save_category(&CategoryInput { id: None, name: "Pausa com atividade".into(), color: Some("#f5c451".into()), goal: None, goal_unit: "min".into() }).unwrap();
        let p = db.add_preset("Alongar", 5.0, id, None, true).unwrap();
        db.save_category(&CategoryInput { id: Some(id), name: "Alongamento".into(), color: Some("#57e389".into()), goal: None, goal_unit: "min".into() }).unwrap();
        assert_eq!(db.category(id).unwrap().unwrap().name, "Alongamento");
        db.delete_category(id).unwrap();
        assert_eq!(db.preset(p).unwrap().unwrap().category_id, db.category_id("other").unwrap());
    }

    #[test]
    fn rejects_bad_category_changes() {
        let db = Db::in_memory().unwrap();
        let stand = db.category_id("stand").unwrap();
        assert!(db.delete_category(stand).is_err());
        assert!(db.save_category(&CategoryInput { id: None, name: "Y".into(), color: Some("red".into()), goal: None, goal_unit: "min".into() }).is_err());
        assert!(db.save_category(&CategoryInput { id: None, name: "Y".into(), color: None, goal: None, goal_unit: "min".into() }).is_err(), "user types need a color");
        assert!(db.save_category(&CategoryInput { id: None, name: "Y".into(), color: Some("#000000".into()), goal: Some(0.0), goal_unit: "min".into() }).is_err());
        assert!(db.save_category(&CategoryInput { id: None, name: "Y".into(), color: Some("#000000".into()), goal: Some(2.0), goal_unit: "hours".into() }).is_err());
        assert!(db.save_category(&CategoryInput { id: None, name: "em pé".into(), color: Some("#000000".into()), goal: None, goal_unit: "min".into() }).is_err());
        let bad = PresetInput { id: None, title: "Z".into(), minutes: 1.0, category_id: 9999, next_preset_id: None, favorite: true };
        assert!(db.save_preset(&bad).is_err());
    }

    #[test]
    fn builtin_categories_can_be_renamed_recolored_and_given_a_goal() {
        let db = Db::in_memory().unwrap();
        let stand = db.category_id("stand").unwrap();
        let input = |name: &str, color: Option<&str>| CategoryInput {
            id: Some(stand),
            name: name.into(),
            color: color.map(Into::into),
            goal: Some(120.0),
            goal_unit: "min".into(),
        };
        db.save_category(&input("Em pé", None)).unwrap();
        let c = db.category(stand).unwrap().unwrap();
        assert_eq!((c.goal, c.renamed()), (Some(120.0), false));

        db.save_category(&input("De pé", Some("#57e389"))).unwrap();
        let c = db.category(stand).unwrap().unwrap();
        assert_eq!((c.key.as_deref(), c.name.as_str(), c.color.as_deref()), (Some("stand"), "De pé", Some("#57e389")));
        assert!(c.renamed());
    }

    #[test]
    fn upgrades_a_version_1_database_in_place() {
        let dir = std::env::temp_dir().join(format!("pivot-migrate-{}", std::process::id()));
        let path = dir.join("pivot.db");
        let _ = std::fs::remove_dir_all(&dir);
        {
            // What 0.3 created.
            std::fs::create_dir_all(&dir).unwrap();
            let conn = Connection::open(&path).unwrap();
            let mut sql = format!("BEGIN;{SCHEMA}");
            for (i, (key, name)) in BUILTIN_CATEGORIES.iter().enumerate() {
                sql.push_str(&format!("INSERT INTO categories(key, name, sort_order, created_at) VALUES ('{key}', '{name}', {i}, 0);"));
            }
            sql.push_str(
                "INSERT INTO sessions(title, category_id, source, started_at, planned_s, ends_at, ended_at, outcome) \
                 VALUES ('Old', 1, 'app', 100, 60, 160, 160, 'done');",
            );
            sql.push_str("PRAGMA user_version = 1; COMMIT;");
            conn.execute_batch(&sql).unwrap();
        }
        let db = Db::open(&path).unwrap();
        assert_eq!(db.version().unwrap(), SCHEMA_VERSION);
        let old = db.session(1).unwrap().unwrap();
        assert_eq!((old.paused_at, old.paused_s, old.run_s(160.0)), (None, 0.0, 60.0));
        assert_eq!(db.category(1).unwrap().unwrap().goal, None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn clearing_history_keeps_open_sessions_and_respects_the_cutoff() {
        let db = Db::in_memory().unwrap();
        let other = db.category_id("other").unwrap();
        let old = db.start_session("Old", other, "app", 60, None, None, 100.0).unwrap();
        db.end_session(old, "done", 160.0).unwrap();
        let recent = db.start_session("Recent", other, "app", 60, None, None, 1000.0).unwrap();
        db.end_session(recent, "done", 1060.0).unwrap();
        let running = db.start_session("Running", other, "app", 60, None, None, 2000.0).unwrap();

        assert_eq!(db.clear_history(Some(500.0)).unwrap(), 1);
        assert!(db.session(old).unwrap().is_none());
        assert!(db.session(recent).unwrap().is_some());
        assert_eq!(db.clear_history(None).unwrap(), 1);
        assert!(db.session(recent).unwrap().is_none());
        assert!(db.session(running).unwrap().is_some(), "the running timer survives");
    }

    #[test]
    fn slugs_are_ascii_and_unique() {
        assert_eq!(slugify("Em pé!"), "em-pe");
        assert_eq!(slugify("  Água & Café "), "agua-cafe");
        let db = Db::in_memory().unwrap();
        let id = db.add_preset("Em pé", 5.0, db.category_id("stand").unwrap(), None, false).unwrap();
        assert_eq!(db.preset(id).unwrap().unwrap().slug, "em-pe-2");
    }

    #[test]
    fn finds_presets_by_slug_title_or_slugified_key() {
        let db = Db::in_memory().unwrap();
        assert_eq!(db.find_preset("em-pe").unwrap().unwrap().title, "Em pé");
        assert_eq!(db.find_preset("SENTADO").unwrap().unwrap().slug, "sentado");
        assert_eq!(db.find_preset("em pe").unwrap().unwrap().slug, "em-pe");
        assert!(db.find_preset("nada").unwrap().is_none());
    }

    #[test]
    fn hourly_slots_between_nine_and_six() {
        let rec = Recurring {
            id: 1,
            title: "Água".into(),
            category_id: 5,
            every_min: 60,
            start_time: "09:00".into(),
            end_time: "18:00".into(),
            weekdays: "01234".into(),
            enabled: true,
            last_fired_at: None,
        };
        let monday = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        let slots = rec.slots_on(monday);
        assert_eq!(slots.len(), 9);
        assert_eq!(slots[0] - day_start(monday), 10.0 * 3600.0);
        assert_eq!(slots[8] - day_start(monday), 18.0 * 3600.0);
        let saturday = NaiveDate::from_ymd_opt(2026, 10, 31).unwrap();
        assert!(rec.slots_on(saturday).is_empty());
    }

    #[test]
    fn rejects_bad_reminders() {
        let db = Db::in_memory().unwrap();
        let mut r = RecurringInput {
            id: None,
            title: "x".into(),
            category_id: db.category_id("water").unwrap(),
            every_min: 30,
            start_time: "18:00".into(),
            end_time: "09:00".into(),
            weekdays: "0".into(),
            enabled: true,
        };
        assert!(db.save_recurring(&r).is_err());
        r.start_time = "9:5".into();
        assert!(db.save_recurring(&r).is_err());
        r.start_time = "9:05".into();
        r.end_time = "10:00".into();
        let id = db.save_recurring(&r).unwrap();
        assert_eq!(db.recurring_one(id).unwrap().unwrap().start_time, "09:05");
    }
}
