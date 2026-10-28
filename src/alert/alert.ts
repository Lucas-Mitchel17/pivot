// Alert window: opened by Rust when a timer ends or a reminder fires.
// Its label is "alert-<session id>".
import "../styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, type Answer } from "../lib/api";
import { h, icon, replace } from "../lib/dom";
import { fmtMinutes, t, title } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { applySettings } from "../lib/theme";

const root = document.getElementById("app")!;
const id = Number(getCurrentWindow().label.replace("alert-", ""));

async function render() {
  const state = await api.state();
  applySettings(state.theme, state.lang);
  const info = await api.alertInfo(id);
  const s = info.session;
  if (s.ended_at !== null) return getCurrentWindow().close();

  const answer = (action: Answer, snooze = 5) => api.answer(id, action, snooze);
  const name = title(s.title);
  const reminder = s.recurring_id !== null;

  let kicker: string;
  let heading: string;
  let body: string;
  let primary: HTMLElement;
  let secondary: HTMLElement[];

  if (reminder) {
    kicker = t("alert.reminder", { every: fmtMinutes(info.every_min ?? 60) });
    heading = name;
    body = "";
    primary = h("button", { class: "btn primary big", onclick: () => answer("done") }, t("alert.done"));
    secondary = [
      h("button", { class: "btn", onclick: () => answer("snooze", 10) }, t("alert.snooze", { n: 10 })),
      h("button", { class: "btn", onclick: () => answer("skipped") }, t("alert.skip")),
    ];
  } else {
    const min = fmtMinutes(s.planned_s / 60);
    kicker = t("alert.kicker", { min });
    const next = info.next;
    const nextCat = next?.category;
    heading =
      nextCat && ["stand", "sit", "break", "focus"].includes(nextCat)
        ? t(`alert.title.${nextCat}` as "alert.title.sit")
        : t("alert.title.done", { title: name });
    body = next
      ? t("alert.body.next", { title: name, min, next: `${title(next.title)} ${fmtMinutes(next.minutes)}` })
      : t("alert.body", { title: name, min });
    primary = next
      ? h(
          "button",
          { class: "btn primary big", onclick: () => answer("next") },
          t("alert.start", { next: `${title(next.title)} · ${fmtMinutes(next.minutes)}` }),
        )
      : h("button", { class: "btn primary big", onclick: () => answer("done") }, t("alert.close"));
    secondary = [h("button", { class: "btn", onclick: () => answer("snooze", 5) }, t("alert.snooze", { n: 5 }))];
    if (next) secondary.push(h("button", { class: "btn", onclick: () => answer("done") }, t("alert.end")));
  }

  document.title = `Pivot — ${heading}`;
  replace(
    root,
    h(
      "main",
      { class: "alert", role: "alertdialog", "aria-labelledby": "alert-title" },
      h("span", { class: "alert-mark" }, icon(reminder ? ICONS.water.replace('width="18" height="18"', 'width="40" height="40"') : ICONS.cube)),
      h(
        "div",
        { style: "display:flex;flex-direction:column;gap:8px" },
        h("span", { class: "kicker" }, kicker),
        h("h1", { id: "alert-title" }, heading),
        body ? h("p", {}, body) : null,
      ),
      h(
        "div",
        { class: "alert-actions" },
        primary,
        h("div", { class: secondary.length > 1 ? "pair" : "" , style: secondary.length > 1 ? "" : "display:grid" }, secondary),
      ),
      h("span", { class: "alert-note" }, icon(ICONS.sound), t("alert.note")),
    ),
  );
  primary.focus();
}

// The sound is played by Rust (src-tauri/src/sound.rs).
render();
