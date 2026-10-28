//! Terminal commands.
//!
//! Read-only commands (`status`, `log`, `list`) are answered straight from the
//! database by the process the terminal started. Commands that change state
//! (`start`, a duration, `stop`) are forwarded to the running app, which owns
//! the timers and the tray.

use crate::db::{local_date, Db, Result};
use crate::engine::Engine;
use crate::i18n::{display_title, fmt_left, fmt_minutes, tr, Lang};
use crate::stats;
use chrono::{Local, TimeZone};

#[derive(Debug, Clone, PartialEq)]
pub enum Command {
    Open,
    Background,
    Help,
    Start(String),
    Custom { minutes: f64, title: Option<String> },
    Stop,
    Status,
    Log { week: bool },
    List,
}

impl Command {
    /// Commands the running app has to carry out.
    pub fn mutates(&self) -> bool {
        matches!(self, Command::Start(_) | Command::Custom { .. } | Command::Stop)
    }
}

/// `args` excludes the program name.
pub fn parse(args: &[String]) -> Command {
    let Some(first) = args.first() else { return Command::Open };
    let rest = args[1..].join(" ");
    match first.as_str() {
        "--background" | "--minimized" => Command::Background,
        "help" | "-h" | "--help" => Command::Help,
        "start" if !rest.trim().is_empty() => Command::Start(rest.trim().to_string()),
        "stop" => Command::Stop,
        "status" => Command::Status,
        "list" => Command::List,
        "log" => Command::Log { week: args[1..].iter().any(|a| matches!(a.as_str(), "--semana" | "--week" | "-w")) },
        other => match parse_duration(other) {
            Some(minutes) => Command::Custom {
                minutes,
                title: (!rest.trim().is_empty()).then(|| rest.trim().to_string()),
            },
            None => Command::Help,
        },
    }
}

/// Minutes. "30" / "30m" -> 30, "90s" -> 1.5, "1h" -> 60, "1h30" -> 90.
pub fn parse_duration(text: &str) -> Option<f64> {
    let t = text.trim().to_lowercase();
    if t.is_empty() {
        return None;
    }
    let (hours, rest) = match t.split_once('h') {
        Some((h, r)) => (h.parse::<f64>().ok()?, r),
        None => (0.0, t.as_str()),
    };
    let mut minutes = hours * 60.0;
    if !rest.is_empty() {
        let (num, unit) = rest
            .find(|c: char| c.is_ascii_alphabetic())
            .map(|i| rest.split_at(i))
            .unwrap_or((rest, ""));
        let value: f64 = num.parse().ok()?;
        minutes += match unit {
            "" | "m" | "min" => value,
            "s" => value / 60.0,
            _ => return None,
        };
    }
    (minutes > 0.0).then_some(minutes)
}

fn hhmm(ts: f64) -> String {
    Local.timestamp_opt(ts as i64, 0).single().map(|d| d.format("%H:%M").to_string()).unwrap_or_default()
}

/// Text for read-only commands, and the confirmation line for forwarded ones.
pub fn describe(db: &Db, cmd: &Command, lang: Lang, now: f64) -> Result<(i32, String)> {
    Ok(match cmd {
        Command::Help | Command::Open | Command::Background => (0, tr(lang, "cli.usage").to_string()),
        Command::Start(key) => match db.find_preset(key)? {
            Some(p) => (0, format!("▶ {} · {}", display_title(lang, &p.title), fmt_minutes(p.minutes))),
            None => {
                let names: Vec<String> = db.presets(false)?.into_iter().map(|p| p.slug).collect();
                (1, format!("{} \"{key}\". {}: {}", tr(lang, "cli.unknown"), tr(lang, "cli.favorites"), names.join(", ")))
            }
        },
        Command::Custom { minutes, title } => {
            let title = title.clone().unwrap_or_else(|| fmt_minutes(*minutes));
            (0, format!("▶ {title} · {}", fmt_minutes(*minutes)))
        }
        Command::Stop => match db.open_timer()? {
            Some(s) => (0, format!("■ {} {}", display_title(lang, &s.title), tr(lang, "cli.stopped"))),
            None => (0, tr(lang, "cli.none").to_string()),
        },
        Command::Status => match db.open_timer()? {
            None => (0, tr(lang, "cli.none").to_string()),
            Some(s) if s.ends_at <= now => (0, format!("{} · {}", display_title(lang, &s.title), tr(lang, "cli.due"))),
            Some(s) => (
                0,
                format!("{} · {} {}", display_title(lang, &s.title), tr(lang, "cli.left"), fmt_left(s.ends_at - now)),
            ),
        },
        Command::List => {
            let lines: Vec<String> = db
                .presets(false)?
                .into_iter()
                .map(|p| {
                    format!(
                        "{} {:<16} {:>6}  {}",
                        if p.favorite { "★" } else { " " },
                        p.slug,
                        fmt_minutes(p.minutes),
                        display_title(lang, &p.title)
                    )
                })
                .collect();
            (0, lines.join("\n"))
        }
        Command::Log { week } => (0, log_text(db, *week, lang, now)?),
    })
}

/// Carry out a state-changing command inside the running app.
pub fn apply(engine: &mut Engine, cmd: &Command, now: f64) -> Result<()> {
    match cmd {
        Command::Start(key) => {
            if let Some(p) = engine.db.find_preset(key)? {
                engine.start_preset(&p, "cli", now)?;
            }
        }
        Command::Custom { minutes, title } => {
            let title = title.clone().unwrap_or_else(|| fmt_minutes(*minutes));
            let category = engine.db.find_preset(&title)?.map(|p| p.category).unwrap_or_else(|| "other".into());
            engine.start_custom(&title, *minutes, &category, "cli", now)?;
        }
        Command::Stop => {
            engine.stop(now)?;
        }
        _ => {}
    }
    Ok(())
}

pub fn log_text(db: &Db, week: bool, lang: Lang, now: f64) -> Result<String> {
    let day = local_date(now);
    let s = if week { stats::summarize_week(db, day, now)? } else { stats::summarize_day(db, day, now)? };
    let head = if week {
        format!("{} {}", tr(lang, "log.week"), stats::week_start(day).format("%d/%m"))
    } else {
        day.format("%d/%m/%Y").to_string()
    };
    let mut lines = vec![
        head,
        format!(
            "  {}: {}   {}: {}   {}: {}   {}: {}/{}",
            tr(lang, "log.stand"),
            stats::fmt_duration(s.stand_s),
            tr(lang, "log.sit"),
            stats::fmt_duration(s.sit_s),
            tr(lang, "log.switches"),
            s.switches,
            tr(lang, "log.water"),
            s.water_done,
            s.water_total
        ),
        String::new(),
    ];
    for x in &s.sessions {
        let span = if x.planned_s == 0 {
            hhmm(x.started_at)
        } else {
            format!("{}–{}", hhmm(x.started_at), x.ended_at.map(hhmm).unwrap_or_else(|| "…".into()))
        };
        let outcome = match x.outcome.as_deref() {
            Some(o) => tr(lang, &format!("out.{o}")),
            None => tr(lang, "log.running"),
        };
        let prefix = if week {
            Local.timestamp_opt(x.started_at as i64, 0).single().map(|d| d.format("%d/%m ").to_string()).unwrap_or_default()
        } else {
            String::new()
        };
        lines.push(format!(
            "  {prefix}{span:<13} {:<20} {:<11} {outcome}",
            display_title(lang, &x.title),
            tr(lang, &format!("src.{}", x.source))
        ));
    }
    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }

    #[test]
    fn parses_durations() {
        assert_eq!(parse_duration("30"), Some(30.0));
        assert_eq!(parse_duration("30m"), Some(30.0));
        assert_eq!(parse_duration("90s"), Some(1.5));
        assert_eq!(parse_duration("1h"), Some(60.0));
        assert_eq!(parse_duration("1h30"), Some(90.0));
        assert_eq!(parse_duration("1.5h"), Some(90.0));
        assert_eq!(parse_duration("abc"), None);
        assert_eq!(parse_duration("0"), None);
        assert_eq!(parse_duration("10x"), None);
    }

    #[test]
    fn parses_commands() {
        assert_eq!(parse(&[]), Command::Open);
        assert_eq!(parse(&args("start em-pe")), Command::Start("em-pe".into()));
        assert_eq!(parse(&args("30 Em pé")), Command::Custom { minutes: 30.0, title: Some("Em pé".into()) });
        assert_eq!(parse(&args("90s")), Command::Custom { minutes: 1.5, title: None });
        assert_eq!(parse(&args("log --semana")), Command::Log { week: true });
        assert_eq!(parse(&args("start")), Command::Help);
        assert_eq!(parse(&args("bogus")), Command::Help);
        assert!(parse(&args("stop")).mutates());
        assert!(!parse(&args("status")).mutates());
    }

    #[test]
    fn custom_timer_named_like_a_preset_takes_its_category() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        apply(&mut e, &parse(&args("30 Em pé")), 1000.0).unwrap();
        let s = e.active().unwrap().unwrap();
        assert_eq!((s.category.as_str(), s.planned_s), ("stand", 1800));
    }

    #[test]
    fn status_reports_time_left() {
        let mut e = Engine::new(Db::in_memory().unwrap());
        apply(&mut e, &parse(&args("start foco")), 1000.0).unwrap();
        let (_, text) = describe(&e.db, &Command::Status, Lang::Pt, 1060.0).unwrap();
        assert_eq!(text, "Foco · faltam 24:00");
        let (code, _) = describe(&e.db, &Command::Start("nada".into()), Lang::Pt, 0.0).unwrap();
        assert_eq!(code, 1);
    }
}
