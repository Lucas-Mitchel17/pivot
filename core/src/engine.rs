//! Timer and reminder logic, free of Tauri so it can be tested directly.
//!
//! There is at most one running timer (posture, break, focus…). Recurring
//! reminders run alongside it as their own sessions. An open session whose
//! `ends_at` has passed is "due": `tick` returns it once and the app shows the
//! alert. Answering closes the session, or snoozes it, which moves `ends_at`
//! so it becomes due again later.

use crate::db::{local_date, Db, Preset, Result, Session};
use chrono::Duration;
use std::collections::HashMap;

/// A reminder slot older than this when we notice it (laptop asleep, app
/// closed) is skipped instead of firing late.
pub const MISSED_SLOT_GRACE: f64 = 15.0 * 60.0;

#[derive(Debug, Clone, Copy, PartialEq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Answer {
    Next,
    Done,
    Skipped,
    Snooze,
}

pub struct Engine {
    pub db: Db,
    alerted: HashMap<i64, f64>,
}

impl Engine {
    pub fn new(db: Db) -> Self {
        Engine { db, alerted: HashMap::new() }
    }

    // ---------- timer ----------

    pub fn active(&self) -> Result<Option<Session>> {
        self.db.open_timer()
    }

    pub fn start_preset(&mut self, p: &Preset, source: &str, now: f64) -> Result<i64> {
        self.start(&p.title, p.minutes, p.category_id, source, Some(p.id), now)
    }

    pub fn start_custom(&mut self, title: &str, minutes: f64, category_id: i64, source: &str, now: f64) -> Result<i64> {
        self.start(title, minutes, category_id, source, None, now)
    }

    fn start(&mut self, title: &str, minutes: f64, category_id: i64, source: &str, preset: Option<i64>, now: f64) -> Result<i64> {
        if let Some(cur) = self.active()? {
            self.db.end_session(cur.id, "stopped", now)?;
            self.alerted.remove(&cur.id);
        }
        let planned = (minutes * 60.0).round().max(1.0) as i64;
        self.db.start_session(title, category_id, source, planned, preset, None, now)
    }

    pub fn stop(&mut self, now: f64) -> Result<Option<Session>> {
        let cur = self.active()?;
        if let Some(s) = &cur {
            self.db.end_session(s.id, "stopped", now)?;
            self.alerted.remove(&s.id);
        }
        Ok(cur)
    }

    /// Pauses the running timer. A timer that already finished can't be paused.
    pub fn pause(&mut self, now: f64) -> Result<Option<Session>> {
        let cur = self.active()?;
        if let Some(s) = &cur {
            if s.paused_at.is_none() && s.ends_at > now {
                self.db.pause_session(s.id, now)?;
            }
        }
        Ok(cur)
    }

    pub fn resume(&mut self, now: f64) -> Result<Option<Session>> {
        let cur = self.active()?;
        if let Some(s) = &cur {
            self.db.resume_session(s.id, now)?;
        }
        Ok(cur)
    }

    pub fn next_preset_for(&self, s: &Session) -> Result<Option<Preset>> {
        let Some(pid) = s.preset_id else { return Ok(None) };
        match self.db.preset(pid)? {
            Some(p) => match p.next_preset_id {
                Some(n) => self.db.preset(n),
                None => Ok(None),
            },
            None => Ok(None),
        }
    }

    /// Returns the id of a timer started by `Answer::Next`, if any.
    pub fn answer(&mut self, id: i64, action: Answer, snooze_min: f64, now: f64) -> Result<Option<i64>> {
        let Some(s) = self.db.session(id)? else { return Ok(None) };
        if s.ended_at.is_some() {
            return Ok(None);
        }
        if action == Answer::Snooze {
            self.db.snooze_session(id, now + snooze_min * 60.0)?;
            return Ok(None);
        }
        let outcome = if action == Answer::Skipped { "skipped" } else { "done" };
        self.db.end_session(id, outcome, now)?;
        self.alerted.remove(&id);
        if action == Answer::Next {
            if let Some(next) = self.next_preset_for(&s)? {
                return self.start_preset(&next, "alert", now).map(Some);
            }
        }
        Ok(None)
    }

    // ---------- reminders ----------

    pub fn auto_active(&self, now: f64) -> bool {
        self.db.setting("auto_enabled") == "1"
            && self.db.setting("auto_paused_until").parse::<f64>().unwrap_or(0.0) <= now
    }

    pub fn check_recurring(&mut self, now: f64) -> Result<Vec<i64>> {
        if !self.auto_active(now) {
            return Ok(vec![]);
        }
        let today = local_date(now);
        let mut fired = vec![];
        for rec in self.db.recurring()? {
            if !rec.enabled {
                continue;
            }
            let mut slots = rec.slots_on(today - Duration::days(1));
            slots.extend(rec.slots_on(today));
            let Some(&slot) = slots.iter().filter(|&&s| s <= now).last() else { continue };
            if rec.last_fired_at.is_some_and(|last| slot <= last) {
                continue;
            }
            self.db.set_last_fired(rec.id, slot)?;
            if now - slot > MISSED_SLOT_GRACE {
                continue;
            }
            // A reminder still unanswered from the previous slot counts as skipped.
            for old in self.db.open_reminders()? {
                if old.recurring_id == Some(rec.id) {
                    self.db.end_session(old.id, "skipped", now)?;
                    self.alerted.remove(&old.id);
                }
            }
            fired.push(self.db.start_session(&rec.title, rec.category_id, "auto", 0, None, Some(rec.id), now)?);
        }
        Ok(fired)
    }

    // ---------- clock ----------

    /// Call about once a second. Fires reminders and returns sessions that just became due.
    pub fn tick(&mut self, now: f64) -> Result<Vec<Session>> {
        self.check_recurring(now)?;
        let mut open = self.db.open_reminders()?;
        if let Some(t) = self.active()?.filter(|t| t.paused_at.is_none()) {
            open.push(t);
        }
        let mut due = vec![];
        for s in open {
            if s.ends_at <= now && self.alerted.get(&s.id) != Some(&s.ends_at) {
                self.alerted.insert(s.id, s.ends_at);
                due.push(s);
            }
        }
        Ok(due)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{day_start, RecurringInput};
    use chrono::NaiveDate;

    fn engine() -> Engine {
        Engine::new(Db::in_memory().unwrap())
    }

    fn monday_at(h: f64) -> f64 {
        day_start(NaiveDate::from_ymd_opt(2026, 10, 26).unwrap()) + h * 3600.0
    }

    #[test]
    fn a_paused_timer_does_not_run_out_and_resumes_where_it_was() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let stand = e.db.find_preset("em-pe").unwrap().unwrap(); // 15 min
        let id = e.start_preset(&stand, "menu", t0).unwrap();
        e.pause(t0 + 300.0).unwrap();
        let s = e.db.session(id).unwrap().unwrap();
        assert_eq!(s.left_s(t0 + 5000.0), 600.0, "frozen while paused");
        assert!(e.tick(t0 + 5000.0).unwrap().is_empty(), "never due while paused");

        e.resume(t0 + 1200.0).unwrap(); // paused for 15 min
        let s = e.db.session(id).unwrap().unwrap();
        assert_eq!((s.paused_at, s.paused_s, s.ends_at), (None, 900.0, t0 + 1800.0));
        assert!(e.tick(t0 + 1799.0).unwrap().is_empty());
        assert_eq!(e.tick(t0 + 1800.0).unwrap().len(), 1);
        e.answer(id, Answer::Done, 0.0, t0 + 1800.0).unwrap();
        assert_eq!(e.db.session(id).unwrap().unwrap().run_s(t0 + 1800.0), 900.0);
    }

    #[test]
    fn stopping_a_paused_timer_counts_only_the_time_it_ran() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let stand = e.db.find_preset("em-pe").unwrap().unwrap();
        let id = e.start_preset(&stand, "menu", t0).unwrap();
        e.pause(t0 + 120.0).unwrap();
        e.pause(t0 + 200.0).unwrap(); // pausing twice keeps the first pause
        e.stop(t0 + 600.0).unwrap();
        let s = e.db.session(id).unwrap().unwrap();
        assert_eq!((s.paused_at, s.paused_s, s.run_s(s.ended_at.unwrap())), (None, 480.0, 120.0));
    }

    #[test]
    fn a_finished_timer_cannot_be_paused() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let stand = e.db.find_preset("em-pe").unwrap().unwrap();
        let id = e.start_preset(&stand, "menu", t0).unwrap();
        e.pause(t0 + 15.0 * 60.0).unwrap();
        assert_eq!(e.db.session(id).unwrap().unwrap().paused_at, None);
    }

    #[test]
    fn timer_becomes_due_once() {
        let mut e = engine();
        let t0 = monday_at(8.0); // before the water window
        let stand = e.db.find_preset("em-pe").unwrap().unwrap();
        let id = e.start_preset(&stand, "menu", t0).unwrap();
        assert!(e.tick(t0 + 60.0).unwrap().is_empty());
        let due = e.tick(t0 + 15.0 * 60.0).unwrap();
        assert_eq!(due.iter().map(|s| s.id).collect::<Vec<_>>(), [id]);
        assert!(e.tick(t0 + 15.0 * 60.0 + 1.0).unwrap().is_empty());
    }

    #[test]
    fn starting_a_timer_stops_the_previous_one() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let other = e.db.category_id("other").unwrap();
        let a = e.start_custom("A", 10.0, other, "cli", t0).unwrap();
        let b = e.start_custom("B", 10.0, other, "cli", t0 + 5.0).unwrap();
        assert_eq!(e.db.session(a).unwrap().unwrap().outcome.as_deref(), Some("stopped"));
        assert_eq!(e.active().unwrap().unwrap().id, b);
    }

    #[test]
    fn answering_next_starts_the_chained_preset() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let stand = e.db.find_preset("em-pe").unwrap().unwrap();
        let id = e.start_preset(&stand, "menu", t0).unwrap();
        let next = e.answer(id, Answer::Next, 5.0, t0 + 900.0).unwrap().unwrap();
        let s = e.db.session(next).unwrap().unwrap();
        assert_eq!(s.title, "Sentado");
        assert_eq!(s.source, "alert");
        assert_eq!(e.db.session(id).unwrap().unwrap().outcome.as_deref(), Some("done"));
    }

    #[test]
    fn snooze_makes_it_due_again_later() {
        let mut e = engine();
        let t0 = monday_at(8.0);
        let other = e.db.category_id("other").unwrap();
        let id = e.start_custom("A", 1.0, other, "cli", t0).unwrap();
        assert_eq!(e.tick(t0 + 60.0).unwrap().len(), 1);
        e.answer(id, Answer::Snooze, 5.0, t0 + 70.0).unwrap();
        assert!(e.tick(t0 + 100.0).unwrap().is_empty());
        assert_eq!(e.tick(t0 + 70.0 + 300.0).unwrap().len(), 1);
        assert_eq!(e.db.session(id).unwrap().unwrap().snoozes, 1);
    }

    #[test]
    fn water_reminder_fires_on_the_hour_once() {
        let mut e = engine();
        assert!(e.tick(monday_at(9.5)).unwrap().is_empty());
        let due = e.tick(monday_at(10.0) + 2.0).unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].title, "Beber água");
        assert_eq!(due[0].source, "auto");
        assert!(e.tick(monday_at(10.0) + 30.0).unwrap().is_empty());
    }

    #[test]
    fn unanswered_reminder_is_skipped_by_the_next_slot() {
        let mut e = engine();
        let first = e.tick(monday_at(10.0)).unwrap()[0].id;
        e.tick(monday_at(11.0)).unwrap();
        assert_eq!(e.db.session(first).unwrap().unwrap().outcome.as_deref(), Some("skipped"));
    }

    #[test]
    fn missed_slots_do_not_fire_late() {
        let mut e = engine();
        assert!(e.tick(monday_at(10.5)).unwrap().is_empty());
        assert!(e.tick(monday_at(10.6)).unwrap().is_empty());
        assert_eq!(e.tick(monday_at(11.0)).unwrap().len(), 1);
    }

    #[test]
    fn paused_or_disabled_reminders_stay_quiet() {
        let mut e = engine();
        e.db.set_setting("auto_paused_until", &monday_at(12.0).to_string()).unwrap();
        assert!(e.tick(monday_at(11.0)).unwrap().is_empty());
        assert_eq!(e.tick(monday_at(12.0) + 1.0).unwrap().len(), 1);
        e.db.set_setting("auto_enabled", "0").unwrap();
        assert!(e.tick(monday_at(13.0)).unwrap().is_empty());
    }

    #[test]
    fn weekend_rule_only_fires_on_weekends() {
        let mut e = engine();
        let rec = e.db.recurring().unwrap()[0].id;
        e.db.set_recurring_enabled(rec, false).unwrap();
        e.db.save_recurring(&RecurringInput {
            id: None,
            title: "Água fds".into(),
            category_id: e.db.category_id("water").unwrap(),
            every_min: 120,
            start_time: "10:00".into(),
            end_time: "20:00".into(),
            weekdays: "56".into(),
            enabled: true,
        })
        .unwrap();
        assert!(e.tick(monday_at(12.0)).unwrap().is_empty());
        let saturday_noon = monday_at(12.0) + 5.0 * 86400.0;
        assert_eq!(e.tick(saturday_noon).unwrap().len(), 1);
    }
}
