//! Day and week summaries for the History tab and `pivot log`.

use crate::db::{day_start, Db, Result, Session};
use chrono::{Datelike, Duration, NaiveDate};
use serde::Serialize;

#[derive(Debug, Default, Serialize)]
pub struct Summary {
    pub start: f64,
    pub end: f64,
    pub stand_s: f64,
    pub sit_s: f64,
    pub switches: i64,
    pub water_done: i64,
    pub water_total: i64,
    pub reminders_skipped: i64,
    pub sessions: Vec<Session>,
}

impl Summary {
    pub fn stand_pct(&self) -> i64 {
        let total = self.stand_s + self.sit_s;
        if total > 0.0 { (100.0 * self.stand_s / total).round() as i64 } else { 0 }
    }
}

pub fn week_start(day: NaiveDate) -> NaiveDate {
    day - Duration::days(day.weekday().num_days_from_monday() as i64)
}

pub fn summarize(db: &Db, start: f64, end: f64, now: f64) -> Result<Summary> {
    let mut out = Summary { start, end, ..Default::default() };
    out.sessions = db.sessions_between(start, end)?;
    let mut last_posture: Option<&str> = None;
    for s in &out.sessions {
        let posture = s.recurring_id.is_none() && (s.category == "stand" || s.category == "sit");
        if posture {
            let stop = s.ended_at.unwrap_or(now);
            let secs = (stop.min(end) - s.started_at.max(start)).max(0.0);
            if s.category == "stand" { out.stand_s += secs } else { out.sit_s += secs }
            if last_posture.is_some_and(|c| c != s.category) {
                out.switches += 1;
            }
            last_posture = Some(&s.category);
        }
        if s.category == "water" {
            out.water_total += 1;
            if s.outcome.as_deref() == Some("done") {
                out.water_done += 1;
            }
        }
        if s.recurring_id.is_some() && s.outcome.as_deref() == Some("skipped") {
            out.reminders_skipped += 1;
        }
    }
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
    use crate::engine::{Answer, Engine};

    #[test]
    fn counts_posture_time_switches_and_water() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        let day = NaiveDate::from_ymd_opt(2026, 10, 26).unwrap();
        let t = day_start(day) + 9.0 * 3600.0;
        let sit = e.db.find_preset("sentado").unwrap().unwrap();
        let a = e.start_preset(&sit, "menu", t).unwrap();
        let b = e.answer(a, Answer::Next, 5.0, t + 2700.0).unwrap().unwrap(); // -> standing
        e.answer(b, Answer::Next, 5.0, t + 2700.0 + 900.0).unwrap(); // -> sitting, still running
        let water = e.tick(day_start(day) + 10.0 * 3600.0).unwrap();
        let w = water.iter().find(|s| s.category == "water").unwrap().id;
        e.answer(w, Answer::Done, 0.0, day_start(day) + 10.0 * 3600.0 + 5.0).unwrap();

        let now = t + 2700.0 + 900.0 + 600.0;
        let s = summarize_day(&e.db, day, now).unwrap();
        assert_eq!(s.sit_s, 2700.0 + 600.0);
        assert_eq!(s.stand_s, 900.0);
        assert_eq!(s.switches, 2);
        assert_eq!((s.water_done, s.water_total), (1, 1));
    }

    #[test]
    fn formats_durations() {
        assert_eq!(fmt_duration(6300.0), "1h45");
        assert_eq!(fmt_duration(2700.0), "45min");
        assert_eq!(fmt_duration(3600.0), "1h");
    }
}
