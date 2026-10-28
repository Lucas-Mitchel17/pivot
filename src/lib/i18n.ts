// Portuguese and English strings for the windows. The tray, notifications and
// terminal have their own short list in core/src/i18n.rs.
import type { Category } from "./api";

export type Lang = "pt" | "en";
let lang: Lang = "pt";

const S = {
  "cat.stand": ["Em pé", "Standing"],
  "cat.sit": ["Sentado", "Sitting"],
  "cat.break": ["Pausa", "Break"],
  "cat.focus": ["Foco", "Focus"],
  "cat.water": ["Água", "Water"],
  "cat.other": ["Outro", "Other"],

  "tab.favorites": ["Favoritos", "Favorites"],
  "tab.automatic": ["Automáticos", "Automatic"],
  "tab.history": ["Histórico", "History"],
  sections: ["Seções", "Sections"],
  add: ["Novo", "New"],
  settings: ["Tema e idioma", "Theme and language"],
  "settings.theme": ["Tema", "Theme"],
  "settings.theme.system": ["Sistema", "System"],
  "settings.theme.light": ["Claro", "Light"],
  "settings.theme.dark": ["Escuro", "Dark"],
  "settings.lang": ["Idioma", "Language"],
  "settings.autostart": ["Abrir junto com o sistema", "Open at login"],
  credit: ["Desenvolvido por", "Developed by"],

  "now.running": ["Rodando agora", "Running now"],
  "now.due": ["acabou — responda o alerta", "finished — answer the alert"],
  "now.next": ["depois: {next}", "next: {next}"],
  stop: ["Parar", "Stop"],

  "fav.title": ["Meus timers", "My timers"],
  "fav.hint": ["A estrela coloca o timer no menu da barra de cima", "The star puts a timer in the top bar menu"],
  "fav.empty": ["Nenhum timer ainda. Crie o primeiro abaixo.", "No timers yet. Create the first one below."],
  "fav.new": ["Novo timer", "New timer"],
  "fav.edit": ["Editar timer", "Edit timer"],
  "fav.next": ["depois: {next}", "next: {next}"],
  "fav.star.on": ["Tirar {title} dos favoritos", "Remove {title} from favorites"],
  "fav.star.off": ["Pôr {title} nos favoritos", "Add {title} to favorites"],
  "fav.play": ["Iniciar {title}", "Start {title}"],
  "f.title": ["Título", "Title"],
  "f.minutes": ["Minutos", "Minutes"],
  "f.type": ["Tipo", "Type"],
  "f.next": ["Quando acabar, sugerir", "When it ends, suggest"],
  "f.next.none": ["Nada", "Nothing"],
  "f.favorite": ["Favorito", "Favorite"],
  save: ["Salvar", "Save"],
  "save.changes": ["Salvar alterações", "Save changes"],
  cancel: ["Cancelar", "Cancel"],
  delete: ["Excluir", "Delete"],
  "err.title": ["Dê um título.", "Give it a title."],
  "err.minutes": ["Os minutos têm que ser maiores que zero.", "Minutes must be greater than zero."],
  "err.time": ["Use o formato HH:MM.", "Use the HH:MM format."],
  "err.window": ["O fim tem que ser depois do início.", "The end has to be after the start."],
  "err.days": ["Escolha pelo menos um dia.", "Pick at least one day."],

  "auto.master": ["Lembretes automáticos", "Automatic reminders"],
  "auto.master.sub": ["Desligue durante reuniões ou na folga", "Turn off during meetings or on days off"],
  "auto.paused": ["Pausados até {time}", "Paused until {time}"],
  "auto.pause": ["Pausar 1h", "Pause 1h"],
  "auto.resume": ["Retomar", "Resume"],
  "auto.list": ["Recorrentes", "Recurring"],
  "auto.empty": ["Nenhum lembrete ainda.", "No reminders yet."],
  "auto.new": ["Novo lembrete", "New reminder"],
  "auto.edit": ["Editar lembrete", "Edit reminder"],
  "auto.every": ["A cada (minutos)", "Every (minutes)"],
  "auto.from": ["Das", "From"],
  "auto.to": ["Até", "To"],
  "auto.days": ["Dias", "Days"],
  "auto.rule": ["A cada {every} · {start}–{end} · {days}", "Every {every} · {start}–{end} · {days}"],
  "auto.nextAt": ["próx. {time}", "next {time}"],
  "auto.off": ["desligado", "off"],
  "auto.preview": ["Vai tocar {n} vezes por dia: {first} … {last}", "Fires {n} times a day: {first} … {last}"],
  "auto.preview.one": ["Vai tocar 1 vez por dia: {first}", "Fires once a day: {first}"],
  "auto.preview.none": ["Nesse intervalo não toca nenhuma vez.", "It never fires in this window."],
  "days.weekdays": ["seg a sex", "Mon–Fri"],
  "days.weekend": ["sáb e dom", "Sat, Sun"],
  "days.all": ["todo dia", "every day"],

  "hist.today": ["Hoje", "Today"],
  "hist.day": ["Dia", "Day"],
  "hist.week": ["Semana", "Week"],
  "hist.weekOf": ["Semana de {day}", "Week of {day}"],
  "hist.prev": ["Anterior", "Previous"],
  "hist.next": ["Próximo", "Next"],
  "hist.period": ["Período", "Period"],
  "hist.stand": ["Em pé", "Standing"],
  "hist.sit": ["Sentado", "Sitting"],
  "hist.switches": ["Trocas", "Switches"],
  "hist.switches.note": ["de posição", "of position"],
  "hist.water": ["Água", "Water"],
  "hist.pct": ["{pct}% do tempo", "{pct}% of the time"],
  "hist.skipped": ["{n} lembretes pulados", "{n} reminders skipped"],
  "hist.skipped.none": ["nenhum pulado", "none skipped"],
  "hist.timeline": ["Linha do dia", "Day timeline"],
  "hist.now": ["agora", "now"],
  "hist.log": ["Registro", "Log"],
  "hist.days": ["Dias", "Days"],
  "hist.empty": ["Nada registrado nesse dia.", "Nothing logged that day."],
  "hist.dayRow": ["em pé {stand} · sentado {sit} · água {water}", "standing {stand} · sitting {sit} · water {water}"],
  "src.cli": ["terminal", "terminal"],
  "src.menu": ["menu", "menu"],
  "src.app": ["app", "app"],
  "src.auto": ["automático", "automatic"],
  "src.alert": ["alerta", "alert"],
  "out.done": ["concluído", "done"],
  "out.done.water": ["feito", "done"],
  "out.stopped": ["parado", "stopped"],
  "out.skipped": ["pulado", "skipped"],
  "out.running": ["rodando", "running"],

  "alert.kicker": ["Tempo esgotado · {min}", "Time is up · {min}"],
  "alert.reminder": ["Lembrete · a cada {every}", "Reminder · every {every}"],
  "alert.title.stand": ["Hora de levantar", "Time to stand up"],
  "alert.title.sit": ["Hora de sentar", "Time to sit"],
  "alert.title.break": ["Hora da pausa", "Time for a break"],
  "alert.title.focus": ["Hora de focar", "Time to focus"],
  "alert.title.done": ["{title} acabou", "{title} is done"],
  "alert.body": ["{title}: {min} concluídos.", "{title}: {min} done."],
  "alert.body.next": ["{title}: {min} concluídos. Próximo: {next}.", "{title}: {min} done. Up next: {next}."],
  "alert.start": ["Começar {next}", "Start {next}"],
  "alert.snooze": ["+{n} min", "+{n} min"],
  "alert.end": ["Só encerrar", "Just finish"],
  "alert.close": ["Fechar", "Close"],
  "alert.done": ["Feito", "Done"],
  "alert.skip": ["Pular", "Skip"],
  "alert.note": ["Fica aberto até você responder", "Stays open until you answer"],
} as const;

type Key = keyof typeof S;

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l === "en" ? "en" : "pt-BR";
}

export function getLang(): Lang {
  return lang;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const [pt, en] = S[key];
  let out: string = lang === "en" ? en : pt;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export const cat = (c: Category) => t(`cat.${c}` as Key);
export const src = (s: string) => t(`src.${s}` as Key);
export const out = (o: string) => t(`out.${o}` as Key);

/** Default presets are stored in Portuguese; show them in English when asked. */
const DEFAULT_TITLES: Record<string, string> = {
  "Em pé": "Standing",
  Sentado: "Sitting",
  Descanso: "Break",
  Foco: "Focus",
  "Beber água": "Drink water",
};
export const title = (s: string) => (lang === "en" ? (DEFAULT_TITLES[s] ?? s) : s);

/** 25 -> "25m", 90 -> "1h30", 0.5 -> "30s". */
export function fmtMinutes(minutes: number): string {
  const total = Math.round(minutes * 60);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (!h) return `${m}m`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** 6300 s -> "1h45", 2700 -> "45min". */
export function fmtDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Seconds left as "23:41" or "1:05:00". */
export function fmtLeft(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function hhmm(ts: number): string {
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayLabel(d: Date, withWeekday = true): string {
  const locale = lang === "en" ? "en-US" : "pt-BR";
  const opts: Intl.DateTimeFormatOptions = withWeekday
    ? { weekday: "short", day: "numeric", month: "short" }
    : { day: "numeric", month: "short" };
  return d.toLocaleDateString(locale, opts).replaceAll(".", "");
}

/** Short weekday letters starting on Monday. */
export function weekdayLetters(): string[] {
  return lang === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "T", "Q", "Q", "S", "S", "D"];
}

export function weekdayNames(): string[] {
  return lang === "en"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
}

export function fmtDays(weekdays: string): string {
  if (weekdays === "01234") return t("days.weekdays");
  if (weekdays === "56") return t("days.weekend");
  if (weekdays === "0123456") return t("days.all");
  const names = weekdayNames();
  return [...weekdays].map((d) => names[Number(d)]).join(", ");
}
