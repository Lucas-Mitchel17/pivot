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
  "tab.settings": ["Configurações", "Settings"],
  sections: ["Seções", "Sections"],
  add: ["Novo", "New"],
  "add.timer": ["Timer", "Timer"],
  "add.reminder": ["Lembrete", "Reminder"],
  "add.type": ["Tipo", "Type"],
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
  "now.paused": ["⏸ pausado", "⏸ paused"],
  "now.pause": ["Pausar", "Pause"],
  "now.resume": ["Continuar", "Resume"],
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
  "f.minutes": ["Tempo (min ou min:seg)", "Time (min or min:sec)"],
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
  "err.minutesFormat": ["Use minutos (15) ou minutos:segundos (1:30).", "Use minutes (15) or minutes:seconds (1:30)."],
  "err.name": ["Dê um nome.", "Give it a name."],
  "err.duplicate": ["Já existe um tipo com esse nome.", "There is already a type with that name."],

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
  "hist.switches": ["Trocas", "Switches"],
  "hist.switches.note": ["mudanças de tipo", "changes of type"],
  "hist.pct": ["{pct}% do tempo", "{pct}% of the time"],
  "hist.reminders": ["{done} de {total} feitos", "{done} of {total} done"],
  "hist.tiles": ["Resumo por tipo", "Summary by type"],
  "hist.timeline": ["Linha do dia", "Day timeline"],
  "hist.now": ["agora", "now"],
  "hist.log": ["Registro", "Log"],
  "hist.days": ["Dias", "Days"],
  "hist.empty": ["Nada registrado nesse dia.", "Nothing logged that day."],
  "hist.dayRow.none": ["nada registrado", "nothing logged"],
  "hist.goalPct": ["{pct}% da {goal}", "{pct}% of {goal}"],
  "hist.goals": ["Semana ideal × real", "Ideal week vs. actual"],
  "hist.goals.of": ["de {ideal}", "of {ideal}"],
  "hist.goals.legend": ["Barras: o que você fez. Linha tracejada: a meta do dia.", "Bars: what you did. Dashed line: the day's goal."],
  "hist.goals.none": [
    "Defina uma meta por dia em Configurações → Tipos para comparar sua semana com a ideal.",
    "Set a daily goal in Settings → Types to compare your week with the ideal one.",
  ],
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
  "alert.title.done": ["\"{title}\" acabou", "\"{title}\" is done"],
  "alert.title.custom": ["Hora de: {type}", "Time for: {type}"],
  "alert.body": ["{title}: {min} concluídos.", "{title}: {min} done."],
  "alert.body.next": ["{title}: {min} concluídos. Próximo: {next}.", "{title}: {min} done. Up next: {next}."],
  "alert.start": ["Começar {next}", "Start {next}"],
  "alert.snooze": ["+{n} min", "+{n} min"],
  "alert.end": ["Só encerrar", "Just finish"],
  "alert.close": ["Fechar", "Close"],
  "alert.done": ["Feito", "Done"],
  "alert.skip": ["Pular", "Skip"],
  "alert.note": ["Fica aberto até você responder", "Stays open until you answer"],

  "confirm.delete": ["Tem certeza que deseja excluir \"{name}\"?", "Are you sure you want to delete \"{name}\"?"],
  "confirm.timer": ["O histórico desse timer continua guardado.", "This timer's history is kept."],
  "confirm.reminder": ["O histórico desse lembrete continua guardado.", "This reminder's history is kept."],

  "set.history": ["Histórico", "History"],
  "set.history.hint": ["Apaga o registro de timers e lembretes. Seus timers, lembretes e tipos continuam.", "Deletes the log of timers and reminders. Your timers, reminders and types stay."],
  "set.history.old": ["Apagar mais antigo que 30 dias", "Delete older than 30 days"],
  "set.history.all": ["Apagar todo o histórico", "Delete all history"],
  "set.history.confirmOld": ["Apagar o histórico com mais de 30 dias?", "Delete history older than 30 days?"],
  "set.history.confirmAll": ["Apagar todo o histórico?", "Delete all history?"],
  "set.history.confirmBody": ["Isso não pode ser desfeito. Seus timers, lembretes e tipos continuam.", "This can't be undone. Your timers, reminders and types stay."],
  "set.history.confirmBtn": ["Apagar", "Delete"],
  "set.history.done": ["{n} registros apagados.", "{n} entries deleted."],

  "set.updates": ["Atualizações", "Updates"],
  "set.updates.version": ["Versão {version}", "Version {version}"],
  "set.updates.check": ["Verificar atualizações", "Check for updates"],
  "set.updates.checking": ["Verificando…", "Checking…"],
  "set.updates.latest": ["Você está na versão mais recente.", "You're on the latest version."],
  "set.updates.available": ["Versão {version} disponível", "Version {version} available"],
  "set.updates.install": ["Atualizar e reiniciar", "Update and restart"],
  "set.updates.download": ["Baixar no GitHub", "Download from GitHub"],
  "set.updates.packageHint": ["Para instalar, o sistema vai pedir a sua senha.", "To install it, the system will ask for your password."],
  "set.updates.installing": ["Instalando…", "Installing…"],
  "set.updates.installError": ["Não foi possível instalar a atualização. Baixe a versão nova no GitHub.", "Couldn't install the update. Download the new version from GitHub."],
  "set.updates.store": ["Instalado pela App Center, que atualiza o Pivot sozinha.", "Installed from the App Center, which keeps Pivot up to date."],
  "set.updates.downloading": ["Baixando… {pct}%", "Downloading… {pct}%"],
  "set.updates.error": ["Não foi possível verificar agora. Tente de novo mais tarde.", "Couldn't check right now. Try again later."],

  "set.appearance": ["Aparência", "Appearance"],
  "set.alert": ["Alerta", "Alert"],
  "set.alert.onTop": ["Manter o alerta por cima de tudo até eu responder", "Keep the alert above everything until I answer"],
  "set.alert.onTop.hint": ["Desligado, o alerta vai para trás quando você clica em outra janela.", "When off, the alert goes behind other windows when you click them."],
  "set.alert.restart": ["Reinicie o Pivot para aplicar essa mudança.", "Restart Pivot to apply this change."],
  "set.alert.restartNow": ["Reiniciar agora", "Restart now"],
  "set.sound": ["Som do alerta", "Alert sound"],
  "set.volume": ["Volume", "Volume"],
  "set.test": ["Testar", "Test"],
  "set.sound.builtin": ["Som padrão do Pivot", "Pivot's built-in chime"],
  "set.sound.custom": ["Som próprio: {name}", "Custom sound: {name}"],
  "set.sound.pick": ["Escolher arquivo…", "Choose a file…"],
  "set.sound.reset": ["Voltar ao padrão", "Use the built-in chime"],
  "set.sound.hint": ["Até 8 segundos · wav, mp3, ogg, flac, m4a ou aac", "Up to 8 seconds · wav, mp3, ogg, flac, m4a or aac"],
  "set.sound.saved": ["Som salvo ({secs} s).", "Sound saved ({secs} s)."],
  "set.sound.err.extension": ["Formato não suportado. Use wav, mp3, ogg, flac, m4a ou aac.", "Unsupported format. Use wav, mp3, ogg, flac, m4a or aac."],
  "set.sound.err.too_big": ["Arquivo grande demais (máximo 5 MB).", "File too large (5 MB max)."],
  "set.sound.err.unsupported": ["Não consegui ler esse áudio.", "Couldn't read that audio."],
  "set.sound.err.too_long": ["O áudio tem {secs} s. O máximo é 8 s.", "The audio is {secs} s long. The maximum is 8 s."],
  "set.types": ["Tipos", "Types"],
  "set.types.hint": ["Cada tipo aparece separado no histórico, com a sua cor.", "Each type shows up on its own in History, with its color."],
  "set.types.builtin": ["padrão", "built-in"],
  "set.types.new": ["Novo tipo", "New type"],
  "set.types.edit": ["Editar tipo", "Edit type"],
  "set.types.name": ["Nome", "Name"],
  "set.types.color": ["Cor", "Color"],
  "set.types.default": ["Cor padrão", "Default color"],
  "set.types.goal": ["Meta por dia", "Daily goal"],
  "set.types.goal.min": ["tempo", "time"],
  "set.types.goal.count": ["vezes", "times"],
  "set.types.goal.minHint": ["Ex.: 2h, 1h30 ou 45 (minutos). Vazio = sem meta.", "E.g. 2h, 1h30 or 45 (minutes). Empty = no goal."],
  "set.types.goal.countHint": ["Timers e lembretes feitos por dia. Vazio = sem meta.", "Timers and reminders done per day. Empty = no goal."],
  "set.types.goalDays": ["Metas valem em", "Goals apply on"],
  "goal.perDay": ["meta {value}/dia", "goal {value}/day"],
  "err.goal": ["Meta inválida: use 2h, 1h30 ou minutos.", "Invalid goal: use 2h, 1h30 or minutes."],
  "set.types.deleteHint": ["Timers e histórico desse tipo passam para \"Outro\".", "Timers and history of this type move to \"Other\"."],
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

/** Built-ins are translated; the user's own types keep their name. */
/** Stored (Portuguese) names of the built-in types, as core/src/db.rs seeds them. */
export const BUILTIN_NAMES: Record<string, string> = {
  stand: "Em pé",
  sit: "Sentado",
  break: "Pausa",
  focus: "Foco",
  water: "Água",
  other: "Outro",
};

/** Built-ins are translated until the user renames them. */
export const catName = (c: Category | undefined) =>
  c ? (c.key && c.name === BUILTIN_NAMES[c.key] ? t(`cat.${c.key}` as Key) : c.name) : "";

/** CSS color for a type: the stored hex, or the theme's color for a built-in. */
export const catColor = (c: Category | undefined) =>
  c ? (c.color ?? (c.key ? `var(--cat-${c.key})` : "var(--text-muted)")) : "var(--text-muted)";

/** "2h/dia", "8×/dia"; "" without a goal. */
export function fmtGoal(c: Category | undefined): string {
  if (!c || c.goal === null) return "";
  const value = c.goal_unit === "count" ? `${c.goal}×` : fmtDuration(c.goal * 60);
  return t("goal.perDay", { value });
}
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

/** 25 -> "25m", 90 -> "1h30", 1.5 -> "1:30", 0.5 -> "0:30". */
export function fmtMinutes(minutes: number): string {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (sec) return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  if (!h) return `${m}m`;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

/** Minutes field text: "15" or "1:30" (minutes:seconds). null when invalid. */
export function parseMinutesField(text: string): number | null {
  const m = /^(\d{1,4})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const secs = m[2] === undefined ? 0 : Number(m[2]);
  if (secs > 59) return null;
  const minutes = Number(m[1]) + secs / 60;
  return minutes > 0 ? minutes : null;
}

/** 1.5 -> "1:30", 15 -> "15". */
export function minutesField(minutes: number): string {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${m}:${String(sec).padStart(2, "0")}` : String(m);
}

/** Keeps only digits and a single ":" followed by at most two digits. */
export function sanitizeMinutesField(text: string): string {
  const cleaned = text.replace(/[^\d:]/g, "");
  const i = cleaned.indexOf(":");
  if (i === -1) return cleaned.slice(0, 4);
  return cleaned.slice(0, Math.min(i, 4)) + ":" + cleaned.slice(i + 1).replace(/:/g, "").slice(0, 2);
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
