//! Day and week summaries for the History tab and `pivot log`.
//!
//! Every category is tracked on its own: timers add up time, reminders count
//! done / total. "Switches" counts every change from one timer category to
//! another, in the order the timers ran.

use crate::db::{day_start, Db, Result, Session};
use chrono::{Datelike, Duration, NaiveDate};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Default, Clone, PartialEq, Serialize)]
pub struct CategoryStat {
    pub category_id: i64,
    /// Seconds spent in timers of this category.
    pub timer_s: f64,
    pub timers: i64,
    /// Reminders of this category answered "done" / fired.
    pub reminders_done: i64,
    pub reminders_total: i64,
}

#[derive(Debug, Default, Serialize)]
pub struct Summary {
    pub start: f64,
    pub end: f64,
    /// Sum of all timer time, for percentages.
    pub tracked_s: f64,
    pub switches: i64,
    pub reminders_skipped: i64,
    /// Ordered by timer time, then reminders fired.
    pub categories: Vec<CategoryStat>,
    pub sessions: Vec<Session>,
}

impl Summary {
    pub fn category(&self, id: i64) -> Option<&CategoryStat> {
        self.categories.iter().find(|c| c.category_id == id)
    }
}

pub fn week_start(day: NaiveDate) -> NaiveDate {
    day - Duration::days(day.weekday().num_days_from_monday() as i64)
}

pub fn summarize(db: &Db, start: f64, end: f64, now: f64) -> Result<Summary> {
    let mut out = Summary { start, end, ..Default::default() };
    out.sessions = db.sessions_between(start, end)?;
    let mut by_cat: BTreeMap<i64, CategoryStat> = BTreeMap::new();
    let mut last_timer_cat: Option<i64> = None;
    for s in &out.sessions {
        let stat = by_cat
            .entry(s.category_id)
            .or_insert_with(|| CategoryStat { category_id: s.category_id, ..Default::default() });
        if s.recurring_id.is_some() {
            stat.reminders_total += 1;
            match s.outcome.as_deref() {
                Some("done") => stat.reminders_done += 1,
                Some("skipped") => out.reminders_skipped += 1,
                _ => {}
            }
            continue;
        }
        // Time inside [start, end), minus pauses (approximate for a session split across days).
        let until = s.ended_at.unwrap_or(now);
        let stop = s.paused_at.map_or(until, |p| p.min(until));
        let secs = (stop.min(end) - s.started_at.max(start)).max(0.0).min(s.run_s(until));
        stat.timer_s += secs;
        stat.timers += 1;
        out.tracked_s += secs;
        if last_timer_cat.is_some_and(|c| c != s.category_id) {
            out.switches += 1;
        }
        last_timer_cat = Some(s.category_id);
    }
    out.categories = by_cat.into_values().collect();
    out.categories.sort_by(|a, b| {
        b.timer_s
            .partial_cmp(&a.timer_s)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.reminders_total.cmp(&a.reminders_total))
    });
    Ok(out)
}

pub fn summarize_day(db: &Db, day: NaiveDate, now: f64) -> Result<Summary> {
    summarize(db, day_start(day), day_start(day + Duration::days(1)), now)
}

pub fn summarize_week(db: &Db, day: NaiveDate, now: f64) -> Result<Summary> {
    let first = week_start(day);
    summarize(db, day_start(first), day_start(first + Duration::days(7)), now)
}

/// 6300 s -> "1h45", 2700 -> "45min", 3600 -> "1h".
pub fn fmt_duration(seconds: f64) -> String {
    let minutes = (seconds / 60.0).round() as i64;
    let (h, m) = (minutes / 60, minutes % 60);
    match (h, m) {
        (0, m) => format!("{m}min"),
        (h, 0) => format!("{h}h"),
        (h, m) => format!("{h}h{m:02}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::CategoryInput;
    use crate::engine::{Answer, Engine};

    #[test]
    fn tracks_each_category_switches_and_reminders() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        let day = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        let t = day_start(day) + 9.0 * 3600.0;
        let sit = e.db.find_preset("sentado").unwrap().unwrap();
        let a = e.start_preset(&sit, "menu", t).unwrap();
        let b = e.answer(a, Answer::Next, 5.0, t + 2700.0).unwrap().unwrap(); // -> standing
        e.answer(b, Answer::Next, 5.0, t + 2700.0 + 900.0).unwrap(); // -> sitting, still running
        let water = e.tick(day_start(day) + 10.0 * 3600.0).unwrap();
        let w = water.iter().find(|s| s.recurring_id.is_some()).unwrap().id;
        e.answer(w, Answer::Done, 0.0, day_start(day) + 10.0 * 3600.0 + 5.0).unwrap();

        let now = t + 2700.0 + 900.0 + 600.0;
        let s = summarize_day(&e.db, day, now).unwrap();
        let id = |k| e.db.category_id(k).unwrap();
        assert_eq!(s.category(id("sit")).unwrap().timer_s, 2700.0 + 600.0);
        assert_eq!(s.category(id("stand")).unwrap().timer_s, 900.0);
        assert_eq!(s.tracked_s, 2700.0 + 600.0 + 900.0);
        assert_eq!(s.switches, 2);
        let water = s.category(id("water")).unwrap();
        assert_eq!((water.reminders_done, water.reminders_total), (1, 1));
        assert_eq!(s.categories[0].category_id, id("sit"), "sorted by time");
    }

    #[test]
    fn user_categories_show_up_on_their_own() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        let active_break = e
            .db
            .save_category(&CategoryInput { id: None, name: "Pausa com atividade".into(), color: Some("#f5c451".into()), goal: None, goal_unit: "min".into() })
            .unwrap();
        let day = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        let t = day_start(day) + 8.0 * 3600.0;
        let id = e.start_custom("Caminhar", 10.0, active_break, "app", t).unwrap();
        e.answer(id, Answer::Done, 5.0, t + 600.0).unwrap();
        let s = summarize_day(&e.db, day, t + 700.0).unwrap();
        assert_eq!(s.category(active_break).unwrap().timer_s, 600.0);
        assert_eq!(s.switches, 0);
    }

    #[test]
    fn paused_time_is_not_counted() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        let day = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        let t = day_start(day) + 8.0 * 3600.0;
        let stand = e.db.find_preset("em-pe").unwrap().unwrap();
        e.start_preset(&stand, "menu", t).unwrap();
        e.pause(t + 300.0).unwrap();
        let s = summarize_day(&e.db, day, t + 3000.0).unwrap();
        assert_eq!(s.tracked_s, 300.0, "still paused");
        e.resume(t + 900.0).unwrap();
        let s = summarize_day(&e.db, day, t + 1000.0).unwrap();
        assert_eq!(s.tracked_s, 400.0);
    }

    #[test]
    fn formats_durations() {
        assert_eq!(fmt_duration(6300.0), "1h45");
        assert_eq!(fmt_duration(2700.0), "45min");
        assert_eq!(fmt_duration(3600.0), "1h");
    }
}
