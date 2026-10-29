//! The strings the Rust side shows: tray menu, notifications, terminal.
//! The windows have their own copy in `src/lib/i18n.ts`.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Lang {
    Pt,
    En,
}

impl Lang {
    pub fn from_setting(value: &str) -> Lang {
        if value == "en" { Lang::En } else { Lang::Pt }
    }
}

pub fn tr(lang: Lang, key: &str) -> &'static str {
    let (pt, en) = match key {
        "tray.favorites" => ("Favoritos", "Favorites"),
        "tray.stop" => ("Parar timer atual", "Stop current timer"),
        "tray.pause" => ("Pausar timer", "Pause timer"),
        "tray.resume" => ("Continuar timer", "Resume timer"),
        "tray.paused" => ("pausado", "paused"),
        "tray.auto" => ("Lembretes automáticos", "Automatic reminders"),
        "tray.open" => ("Abrir Pivot…", "Open Pivot…"),
        "tray.credit" => ("Desenvolvido por Lucas Mitchel Dev", "Developed by Lucas Mitchel Dev"),
        "tray.quit" => ("Encerrar", "Quit"),
        "tray.idle" => ("Nenhum timer rodando", "No timer running"),
        "tray.due" => ("acabou", "finished"),
        "notify.timer" => ("acabou", "is done"),
        "cli.none" => ("Nenhum timer rodando", "No timer running"),
        "cli.left" => ("faltam", "left"),
        "cli.due" => ("acabou, esperando resposta", "finished, waiting for an answer"),
        "cli.stopped" => ("parado", "stopped"),
        "cli.paused" => ("pausado", "paused"),
        "cli.resumed" => ("continuando", "resumed"),
        "cli.unknown" => ("Não achei o timer", "No timer called"),
        "cli.favorites" => ("Timers salvos", "Saved timers"),
        "cli.not_running" => (
            "O Pivot não está aberto. Abra o app (ou rode `pivot &`) e tente de novo.",
            "Pivot is not running. Open the app (or run `pivot &`) and try again.",
        ),
        "log.stand" => ("Em pé", "Standing"),
        "log.sit" => ("Sentado", "Sitting"),
        "log.switches" => ("Trocas", "Switches"),
        "log.water" => ("Água", "Water"),
        "log.week" => ("Semana de", "Week of"),
        "log.running" => ("rodando", "running"),
        "out.done" => ("concluído", "done"),
        "out.stopped" => ("parado", "stopped"),
        "out.skipped" => ("pulado", "skipped"),
        "src.cli" => ("terminal", "terminal"),
        "src.menu" => ("menu", "menu"),
        "src.app" => ("app", "app"),
        "src.auto" => ("automático", "automatic"),
        "src.alert" => ("alerta", "alert"),
        "cli.usage" => (
            "Uso:\n\
             \x20 pivot                     abre o app\n\
             \x20 pivot start <timer>       inicia um timer salvo (ex.: em-pe)\n\
             \x20 pivot <tempo> [título]    timer avulso (30, 30m, 90s, 1h30)\n\
             \x20 pivot stop                para o timer\n\
             \x20 pivot pause | resume      pausa ou continua o timer\n\
             \x20 pivot status              mostra o timer atual\n\
             \x20 pivot log [--semana]      resumo de hoje (ou da semana)\n\
             \x20 pivot list                lista os timers salvos",
            "Usage:\n\
             \x20 pivot                     open the app\n\
             \x20 pivot start <timer>       start a saved timer (e.g. em-pe)\n\
             \x20 pivot <time> [title]      one-off timer (30, 30m, 90s, 1h30)\n\
             \x20 pivot stop                stop the timer\n\
             \x20 pivot pause | resume      pause or resume the timer\n\
             \x20 pivot status              show the current timer\n\
             \x20 pivot log [--week]        today's summary (or the week's)\n\
             \x20 pivot list                list saved timers",
        ),
        _ => ("?", "?"),
    };
    if lang == Lang::En { en } else { pt }
}

/// Default preset names are stored in Portuguese; show them in English when asked.
pub fn display_title(lang: Lang, title: &str) -> String {
    if lang == Lang::Pt {
        return title.to_string();
    }
    match title {
        "Em pé" => "Standing",
        "Sentado" => "Sitting",
        "Descanso" => "Break",
        "Foco" => "Focus",
        "Beber água" => "Drink water",
        other => other,
    }
    .to_string()
}

/// Name to show for a category: built-ins are translated, user ones as typed.
pub fn category_name(lang: Lang, c: &crate::db::Category) -> String {
    let Some(key) = c.key.as_deref().filter(|_| !c.renamed()) else { return c.name.clone() };
    let (pt, en) = match key {
        "stand" => ("Em pé", "Standing"),
        "sit" => ("Sentado", "Sitting"),
        "break" => ("Pausa", "Break"),
        "focus" => ("Foco", "Focus"),
        "water" => ("Água", "Water"),
        _ => ("Outro", "Other"),
    };
    (if lang == Lang::En { en } else { pt }).to_string()
}

/// 25 -> "25m", 90 -> "1h30", 1.5 -> "1:30", 0.5 -> "0:30".
pub fn fmt_minutes(minutes: f64) -> String {
    let total = (minutes * 60.0).round() as i64;
    let (h, m, s) = (total / 3600, (total % 3600) / 60, total % 60);
    match (h, m, s) {
        (0, m, 0) => format!("{m}m"),
        (h, 0, 0) => format!("{h}h"),
        (h, m, 0) => format!("{h}h{m:02}"),
        (0, m, s) => format!("{m}:{s:02}"),
        (h, m, s) => format!("{h}:{m:02}:{s:02}"),
    }
}

/// Seconds left as "23:41" or "1:05:00".
pub fn fmt_left(seconds: f64) -> String {
    let s = seconds.max(0.0).ceil() as i64;
    let (h, m, sec) = (s / 3600, (s % 3600) / 60, s % 60);
    if h > 0 { format!("{h}:{m:02}:{sec:02}") } else { format!("{m:02}:{sec:02}") }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_minutes_keeping_seconds() {
        assert_eq!(fmt_minutes(25.0), "25m");
        assert_eq!(fmt_minutes(90.0), "1h30");
        assert_eq!(fmt_minutes(60.0), "1h");
        assert_eq!(fmt_minutes(1.5), "1:30");
        assert_eq!(fmt_minutes(0.5), "0:30");
        assert_eq!(fmt_minutes(60.5), "1:00:30");
    }
}
