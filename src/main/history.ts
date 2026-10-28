// History tab: day or week summary (one tile per type), the day's timeline and the log.
import { api, type Category, type CategoryStat, type DayRow, type Session, type Summary } from "../lib/api";
import { h, icon } from "../lib/dom";
import { catColor, catName, dayLabel, fmtDuration, hhmm, out, src, t, title } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { segmented } from "./ui";

let day = new Date();
let week = false;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isToday = (d: Date) => iso(d) === iso(new Date());

type Cats = Map<number, Category>;

/** "Standing 1h45" for timer types, "Water 5/9" for reminder-only ones. */
function statValue(c: CategoryStat): string {
  return c.timers === 0 && c.reminders_total > 0 ? `${c.reminders_done}/${c.reminders_total}` : fmtDuration(c.timer_s);
}

function tiles(s: Summary, cats: Cats) {
  const tile = (label: string, dot: string, value: string, note: string) =>
    h(
      "div",
      { class: "card tile" },
      h("span", { class: "tile-label" }, h("span", { class: "dot", style: `background:${dot}` }), label),
      h("span", { class: "tile-value" }, value),
      h("span", { class: "tile-note" }, note),
    );
  const pct = (x: number) => (s.tracked_s ? Math.round((100 * x) / s.tracked_s) : 0);
  const items = s.categories.map((c) => {
    const cat = cats.get(c.category_id);
    const note =
      c.timers === 0 && c.reminders_total > 0
        ? t("hist.reminders", { done: c.reminders_done, total: c.reminders_total })
        : t("hist.pct", { pct: pct(c.timer_s) });
    return tile(catName(cat), catColor(cat), statValue(c), note);
  });
  items.push(tile(t("hist.switches"), "var(--text-muted)", String(s.switches), t("hist.switches.note")));
  return h("div", { class: "tiles", "aria-label": t("hist.tiles") }, items);
}

function timeline(s: Summary, cats: Cats) {
  const now = Date.now() / 1000;
  const timed = s.sessions.filter((x) => x.recurring_id === null);
  // From 9h (or the first session) to 18h (or now / the last session).
  const nine = s.start + 9 * 3600;
  const six = s.start + 18 * 3600;
  const first = Math.min(nine, ...timed.map((x) => x.started_at));
  const lastEnd = Math.max(six, ...timed.map((x) => x.ended_at ?? Math.min(now, s.end)));
  const from = Math.max(s.start, Math.floor((first - s.start) / 3600) * 3600 + s.start);
  const to = Math.min(s.end, Math.ceil((lastEnd - s.start) / 3600) * 3600 + s.start);
  const span = Math.max(1, to - from);
  const pos = (ts: number) => ((Math.min(Math.max(ts, from), to) - from) / span) * 100;
  const segments = timed.map((x) => {
    const end = x.ended_at ?? Math.min(now, s.end);
    const cat = cats.get(x.category_id);
    return h("span", {
      title: `${title(x.title)} · ${catName(cat)} · ${hhmm(x.started_at)}–${hhmm(end)}`,
      style: `left:${pos(x.started_at)}%;width:${Math.max(0.4, pos(end) - pos(x.started_at))}%;background:${catColor(cat)}`,
    });
  });
  const marks: string[] = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) marks.push(hhmm(from + (span * i) / steps));
  return h(
    "section",
    { class: "card timeline", "aria-label": t("hist.timeline") },
    h("div", { class: "bar" }, segments),
    h("div", { class: "bar-scale" }, marks.map((m) => h("span", {}, m))),
  );
}

function logRow(x: Session, cats: Cats) {
  const cat = cats.get(x.category_id);
  const span = x.recurring_id !== null ? hhmm(x.started_at) : `${hhmm(x.started_at)}–${x.ended_at ? hhmm(x.ended_at) : "…"}`;
  const outcome = x.outcome
    ? x.outcome === "done" && x.recurring_id !== null
      ? t("out.done.water")
      : out(x.outcome)
    : t("out.running");
  return h(
    "li",
    { class: "row log-row" },
    h("span", { class: "log-time" }, span),
    h("span", { class: "dot", style: `background:${catColor(cat)}`, title: catName(cat) }),
    h("span", { class: "row-title", style: "flex:1" }, title(x.title)),
    h("span", { class: "chip" }, src(x.source)),
    h("span", { class: `log-outcome${x.outcome === "skipped" ? " bad" : ""}` }, outcome),
  );
}

function dayRows(days: DayRow[], cats: Cats) {
  return h(
    "ul",
    { class: "card list" },
    days.map((d) => {
      const date = new Date(`${d.date}T12:00:00`);
      const parts = d.categories.map((c) => `${catName(cats.get(c.category_id))} ${statValue(c)}`);
      return h(
        "li",
        { class: "row" },
        h(
          "button",
          {
            class: "row-main",
            type: "button",
            onclick: () => {
              day = date;
              week = false;
              document.dispatchEvent(new Event("pivot:rerender"));
            },
          },
          h("span", { class: "row-title" }, dayLabel(date)),
          h("span", { class: "row-sub" }, parts.length ? parts.join(" · ") : t("hist.dayRow.none")),
        ),
      );
    }),
  );
}

export async function renderHistory(categories: Category[], rerender: () => void): Promise<HTMLElement> {
  const cats: Cats = new Map(categories.map((c) => [c.id, c]));
  const { summary, days } = await api.history(iso(day), week);
  const move = (dir: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + dir * (week ? 7 : 1));
    day = d;
    rerender();
  };
  const monday = new Date(day);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const heading = week
    ? t("hist.weekOf", { day: dayLabel(monday, false) })
    : isToday(day)
      ? `${t("hist.today")} · ${dayLabel(day)}`
      : dayLabel(day);

  return h(
    "div",
    { class: "page wide" },
    h(
      "div",
      { class: "hist-head" },
      h(
        "div",
        { class: "hist-nav" },
        h("button", { class: "icon-btn", type: "button", "aria-label": t("hist.prev"), onclick: () => move(-1) }, icon(ICONS.chevronLeft)),
        h("h1", {}, heading),
        h("button", { class: "icon-btn", type: "button", "aria-label": t("hist.next"), onclick: () => move(1) }, icon(ICONS.chevronRight)),
      ),
      segmented(t("hist.period"), [["day", t("hist.day")], ["week", t("hist.week")]], week ? "week" : "day", (v) => {
        week = v === "week";
        rerender();
      }),
    ),
    tiles(summary, cats),
    week ? null : timeline(summary, cats),
    h(
      "section",
      { class: "section" },
      h("h2", {}, t(week ? "hist.days" : "hist.log")),
      week
        ? dayRows(days, cats)
        : summary.sessions.length
          ? h("ul", { class: "card list" }, [...summary.sessions].reverse().map((x) => logRow(x, cats)))
          : h("p", { class: "card empty" }, t("hist.empty")),
    ),
  );
}
