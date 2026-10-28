// Automatic tab: recurring reminders (e.g. drink water every hour, 9–18, Mon–Fri).
import { api, type AppState, type Category, type Recurring } from "../lib/api";
import { h, icon } from "../lib/dom";
import { fmtDays, fmtMinutes, hhmm, t, title, weekdayLetters } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { switchButton } from "./ui";

interface Draft {
  id: number | null;
  title: string;
  category: Category;
  every: string;
  start: string;
  end: string;
  weekdays: Set<string>;
  enabled: boolean;
  error: string;
}

const blank = (): Draft => ({
  id: null,
  title: "",
  category: "water",
  every: "60",
  start: "09:00",
  end: "18:00",
  weekdays: new Set("01234"),
  enabled: true,
  error: "",
});
let draft: Draft = blank();

export function newReminder(rerender: () => void) {
  draft = blank();
  rerender();
  document.querySelector<HTMLInputElement>("#rec-title")?.focus();
}

function parseHHMM(v: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(v);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const fmtHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function preview(d: Draft): string {
  const start = parseHHMM(d.start);
  const end = parseHHMM(d.end);
  const every = Number(d.every);
  if (start === null || end === null || !(every > 0) || end <= start) return "";
  const slots: number[] = [];
  for (let m = start + every; m <= end; m += every) slots.push(m);
  if (!slots.length) return t("auto.preview.none");
  if (slots.length === 1) return t("auto.preview.one", { first: fmtHM(slots[0]) });
  return t("auto.preview", { n: slots.length, first: fmtHM(slots[0]), last: fmtHM(slots[slots.length - 1]) });
}

export function renderAutomatic(state: AppState, list: Recurring[], rerender: () => void): HTMLElement {
  if (draft.id !== null && !list.some((r) => r.id === draft.id)) draft = blank();
  const paused = state.auto_paused_until > state.now;

  const edit = (r: Recurring) => {
    draft = {
      id: r.id,
      title: title(r.title),
      category: r.category,
      every: String(r.every_min),
      start: r.start_time,
      end: r.end_time,
      weekdays: new Set(r.weekdays),
      enabled: r.enabled,
      error: "",
    };
    rerender();
    document.querySelector<HTMLInputElement>("#rec-title")?.focus();
  };

  const master = h(
    "div",
    { class: "card master" },
    h(
      "div",
      { class: "row-main", style: "cursor:default" },
      h("span", { class: "row-title" }, t("auto.master")),
      h(
        "span",
        { class: "row-sub" },
        paused ? t("auto.paused", { time: hhmm(state.auto_paused_until) }) : t("auto.master.sub"),
      ),
    ),
    h(
      "div",
      { class: "controls" },
      state.auto_enabled
        ? h(
            "button",
            { class: "btn", type: "button", onclick: () => api.pauseAuto(paused ? 0 : 3600) },
            t(paused ? "auto.resume" : "auto.pause"),
          )
        : null,
      switchButton(state.auto_enabled, t("auto.master"), (v) => api.setAutoEnabled(v)),
    ),
  );

  const rows = list.map((r) => {
    const label = title(r.title);
    const rule = t("auto.rule", {
      every: fmtMinutes(r.every_min),
      start: r.start_time,
      end: r.end_time,
      days: fmtDays(r.weekdays),
    });
    const next = !r.enabled ? t("auto.off") : r.next_slot ? t("auto.nextAt", { time: hhmm(r.next_slot) }) : "";
    return h(
      "li",
      { class: `row${draft.id === r.id ? " editing" : ""}` },
      h("span", { class: "badge icon-badge" }, icon(r.category === "water" ? ICONS.water : ICONS.person)),
      h(
        "button",
        { class: "row-main", type: "button", onclick: () => edit(r) },
        h("span", { class: "row-title" }, label),
        h("span", { class: "row-sub" }, rule),
      ),
      h("span", { class: "mono row-sub" }, next),
      switchButton(r.enabled, label, (v) => api.setRecurringEnabled(r.id, v)),
    );
  });

  const save = async () => {
    const start = parseHHMM(draft.start);
    const end = parseHHMM(draft.end);
    const every = Number(draft.every);
    if (!draft.title.trim()) draft.error = t("err.title");
    else if (start === null || end === null) draft.error = t("err.time");
    else if (end <= start) draft.error = t("err.window");
    else if (!(every > 0)) draft.error = t("err.minutes");
    else if (!draft.weekdays.size) draft.error = t("err.days");
    else draft.error = "";
    if (draft.error) return rerender();
    const original = draft.id !== null ? list.find((r) => r.id === draft.id) : undefined;
    const name = original && title(original.title) === draft.title.trim() ? original.title : draft.title.trim();
    await api.saveRecurring({
      id: draft.id,
      title: name,
      category: draft.category,
      every_min: Math.round(every),
      start_time: fmtHM(start!),
      end_time: fmtHM(end!),
      weekdays: [...draft.weekdays].sort().join(""),
      enabled: draft.enabled,
    });
    draft = blank();
    rerender();
  };

  const letters = weekdayLetters();
  const previewLine = h("span", { class: "hint", id: "rec-preview" }, preview(draft));
  const updatePreview = () => (previewLine.textContent = preview(draft));

  const form = h(
    "form",
    {
      class: "card form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        save();
      },
    },
    h(
      "label",
      { class: "field span-2" },
      t("f.title"),
      h("input", {
        id: "rec-title",
        class: "input",
        value: draft.title,
        maxlength: 40,
        oninput: (e: Event) => (draft.title = (e.target as HTMLInputElement).value),
      }),
    ),
    h(
      "label",
      { class: "field" },
      t("auto.every"),
      h("input", {
        class: "input mono",
        inputmode: "numeric",
        value: draft.every,
        oninput: (e: Event) => ((draft.every = (e.target as HTMLInputElement).value), updatePreview()),
      }),
    ),
    h(
      "label",
      { class: "field" },
      t("f.type"),
      h(
        "select",
        { class: "input", onchange: (e: Event) => (draft.category = (e.target as HTMLSelectElement).value as Category) },
        (["water", "stand", "break", "other"] as Category[]).map((c) =>
          h("option", { value: c, selected: c === draft.category }, t(`cat.${c}` as "cat.water")),
        ),
      ),
    ),
    h(
      "label",
      { class: "field" },
      t("auto.from"),
      h("input", {
        class: "input mono",
        value: draft.start,
        placeholder: "09:00",
        oninput: (e: Event) => ((draft.start = (e.target as HTMLInputElement).value), updatePreview()),
      }),
    ),
    h(
      "label",
      { class: "field" },
      t("auto.to"),
      h("input", {
        class: "input mono",
        value: draft.end,
        placeholder: "18:00",
        oninput: (e: Event) => ((draft.end = (e.target as HTMLInputElement).value), updatePreview()),
      }),
    ),
    h(
      "fieldset",
      { class: "field span-2", style: "border:0;margin:0;padding:0" },
      h("legend", { style: "padding:0;margin-bottom:4px" }, t("auto.days")),
      h(
        "div",
        { class: "days" },
        letters.map((l, i) => {
          const d = String(i);
          return h(
            "button",
            {
              class: "day",
              type: "button",
              "aria-pressed": String(draft.weekdays.has(d)),
              onclick: (e: Event) => {
                if (draft.weekdays.has(d)) draft.weekdays.delete(d);
                else draft.weekdays.add(d);
                (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(draft.weekdays.has(d)));
              },
            },
            l,
          );
        }),
      ),
    ),
    draft.error ? h("p", { class: "error", role: "alert" }, draft.error) : null,
    h(
      "div",
      { class: "form-actions" },
      draft.id !== null
        ? h(
            "button",
            {
              class: "btn danger",
              type: "button",
              onclick: async () => {
                await api.deleteRecurring(draft.id!);
                draft = blank();
                rerender();
              },
            },
            t("delete"),
          )
        : previewLine,
      h(
        "div",
        { class: "right" },
        draft.id !== null
          ? h("button", { class: "btn ghost", type: "button", onclick: () => ((draft = blank()), rerender()) }, t("cancel"))
          : null,
        h("button", { class: "btn primary", type: "submit" }, t(draft.id !== null ? "save.changes" : "save")),
      ),
    ),
  );

  return h(
    "div",
    { class: "page" },
    master,
    h(
      "section",
      { class: "section" },
      h("h2", {}, t("auto.list")),
      list.length ? h("ul", { class: "card list" }, rows) : h("p", { class: "card empty" }, t("auto.empty")),
    ),
    h("section", { class: "section" }, h("h2", {}, t(draft.id !== null ? "auto.edit" : "auto.new")), form),
  );
}
