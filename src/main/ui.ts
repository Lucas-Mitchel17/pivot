// Small pieces shared by the tabs.
import { api, type AppState } from "../lib/api";
import { h, icon } from "../lib/dom";
import { fmtLeft, fmtMinutes, t, title } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { LOGO_LOCKUP } from "../lib/logo";

export function switchButton(checked: boolean, label: string, onchange: (v: boolean) => void) {
  return h("button", {
    class: "switch",
    role: "switch",
    "aria-checked": String(checked),
    "aria-label": label,
    onclick: () => onchange(!checked),
  });
}

export function segmented<T extends string>(label: string, options: [T, string][], value: T, onpick: (v: T) => void) {
  return h(
    "div",
    { class: "segmented", role: "group", "aria-label": label },
    options.map(([v, text]) =>
      h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => onpick(v) }, text),
    ),
  );
}

export function credit() {
  return h(
    "button",
    { class: "credit", type: "button", onclick: () => api.openSite() },
    h("span", {}, t("credit")),
    icon(LOGO_LOCKUP, "logo"),
    h("strong", {}, "Lucas Mitchel Dev"),
    h("span", { "aria-hidden": "true" }, "·"),
    h("span", { class: "site" }, "lucasmitchel.dev"),
  );
}

/** "Running now" card; the clock updates through `tickClocks`. */
export function nowCard(state: AppState) {
  const a = state.active;
  if (!a) return null;
  const s = a.session;
  const total = Math.max(1, s.ends_at - s.started_at);
  return h(
    "section",
    { class: "card now", "aria-label": t("now.running") },
    h(
      "div",
      { class: "now-main" },
      h(
        "div",
        { class: "now-line" },
        h("span", { class: "display row-title" }, title(s.title)),
        h("span", { class: "mono now-clock", "data-ends": s.ends_at }, fmtLeft(s.ends_at - state.now)),
      ),
      h(
        "div",
        { class: "progress", "aria-hidden": "true" },
        h("div", { "data-progress": `${s.started_at},${s.ends_at}`, style: `width:${progressPct(s.started_at, s.ends_at, state.now)}%` }),
      ),
      h(
        "span",
        { class: "row-sub" },
        a.next ? t("now.next", { next: `${title(a.next.title)} ${fmtMinutes(a.next.minutes)}` }) : `${fmtMinutes(total / 60)}`,
      ),
    ),
    h("button", { class: "btn", type: "button", onclick: () => api.stop() }, icon(ICONS.stop), t("stop")),
  );
}

function progressPct(start: number, end: number, now: number) {
  return Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
}

/** Refresh every countdown on the page; called once a second. */
export function tickClocks() {
  const now = Date.now() / 1000;
  document.querySelectorAll<HTMLElement>("[data-ends]").forEach((el) => {
    const left = Number(el.dataset.ends) - now;
    el.textContent = left > 0 ? fmtLeft(left) : t("now.due");
  });
  document.querySelectorAll<HTMLElement>("[data-progress]").forEach((el) => {
    const [start, end] = (el.dataset.progress ?? "0,1").split(",").map(Number);
    el.style.width = `${progressPct(start, end, now)}%`;
  });
}
