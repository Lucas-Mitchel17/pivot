// History tab: day or week summary (one tile per type), the day's timeline and the log.
import { api, type Category, type CategoryStat, type DayRow, type Session, type Summary } from "../lib/api";
import { h, icon } from "../lib/dom";
import { catColor, catName, dayLabel, fmtDuration, fmtGoal, hhmm, out, src, t, title, weekdayNames } from "../lib/i18n";
import { countUp, reducedMotion } from "../lib/motion";
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

/** Progress toward a type's daily goal: minutes of timers, or timers + reminders done. */
const goalValue = (c: CategoryStat | undefined, cat: Category) =>
  !c ? 0 : cat.goal_unit === "count" ? c.timers + c.reminders_done : c.timer_s / 60;
const fmtGoalValue = (v: number, cat: Category) => (cat.goal_unit === "count" ? `${Math.round(v)}×` : fmtDuration(v * 60));

/** Monday = 0 … Sunday = 6, like the goal_days setting. */
const weekday = (d: Date) => String((d.getDay() + 6) % 7);

function tiles(s: Summary, cats: Cats, goalToday: boolean) {
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
      cat?.goal != null && goalToday
        ? t("hist.goalPct", { pct: Math.round((100 * goalValue(c, cat)) / cat.goal), goal: fmtGoal(cat) })
        : c.timers === 0 && c.reminders_total > 0
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

/**
 * Ideal week vs. actual, one small chart per type with a goal: a bar per day
 * (actual) against a dashed line at the daily goal on goal days.
 */
function goals(days: DayRow[], categories: Category[], goalDays: string) {
  const withGoal = categories.filter((c) => c.goal !== null);
  if (!withGoal.length) return h("p", { class: "card empty" }, t("hist.goals.none"));
  const names = weekdayNames();
  // Bars grow in when the week is first shown, not on every refresh of the same week.
  const key = days[0]?.date ?? "";
  const grow = !reducedMotion() && document.querySelector<HTMLElement>(".goal-charts")?.dataset.week !== key;
  const charts = withGoal.map((cat) => {
    const goal = cat.goal!;
    const values = days.map((d) => goalValue(d.categories.find((c) => c.category_id === cat.id), cat));
    const isGoalDay = days.map((d) => goalDays.includes(weekday(new Date(`${d.date}T12:00:00`))));
    const ideal = goal * isGoalDay.filter(Boolean).length;
    const actual = values.reduce((a, b) => a + b, 0);
    const pct = ideal ? Math.round((100 * actual) / ideal) : 0;
    const top = Math.max(goal, ...values) * 1.1;
    const y = (v: number) => `${Math.min(100, (100 * v) / top)}%`;
    return h(
      "section",
      { class: "card goal-chart", "aria-label": catName(cat) },
      h(
        "div",
        { class: "goal-head" },
        h("span", { class: "tile-label" }, h("span", { class: "dot", style: `background:${catColor(cat)}` }), catName(cat)),
        h(
          "span",
          { class: "goal-total" },
          h("strong", { class: "mono" }, fmtGoalValue(actual, cat)),
          ` ${t("hist.goals.of", { ideal: fmtGoalValue(ideal, cat) })}`,
          countUpIf(grow, h("span", { class: `goal-pct${pct >= 100 ? " met" : ""}` }, `${pct}%`), pct),
        ),
      ),
      h(
        "div",
        { class: "goal-plot" },
        days.map((_, i) => {
          const tip = `${names[i]}: ${fmtGoalValue(values[i], cat)}${isGoalDay[i] ? ` / ${fmtGoalValue(goal, cat)}` : ""}`;
          return h(
            "div",
            { class: "goal-day", title: tip, "aria-label": tip, role: "img" },
            isGoalDay[i] ? h("span", { class: "goal-line", style: `bottom:${y(goal)}` }) : null,
            values[i] > 0
              ? h("span", { class: "goal-bar", style: `height:${y(values[i])};background:${catColor(cat)};--i:${i}` })
              : null,
          );
        }),
      ),
      h(
        "div",
        { class: "goal-axis", "aria-hidden": "true" },
        names.map((n, i) => h("span", { class: isGoalDay[i] && values[i] >= goal ? "met" : "" }, n)),
      ),
    );
  });
  return h(
    "div",
    { class: `goal-charts${grow ? " grow" : ""}`, "data-week": key },
    h("p", { class: "hint" }, t("hist.goals.legend")),
    charts,
  );
}

function countUpIf(grow: boolean, el: HTMLElement, to: number) {
  if (grow && to > 0) countUp(el, to, "%");
  return el;
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
  const [{ summary, days }, state] = await Promise.all([api.history(iso(day), week), api.state()]);
  const goalToday = !week && state.goal_days.includes(weekday(day));
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
    tiles(summary, cats, goalToday),
    week ? h("section", { class: "section" }, h("h2", {}, t("hist.goals")), goals(days, categories, state.goal_days)) : null,
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
