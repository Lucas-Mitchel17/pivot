// Main window: tabs (Favorites / Automatic / History), settings popover, credit footer.
import "../styles.css";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, onChanged, type AppState } from "../lib/api";
import { h, icon, replace } from "../lib/dom";
import { t, type Lang } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { applySettings } from "../lib/theme";
import { newReminder, renderAutomatic } from "./automatic";
import { newTimer, renderFavorites } from "./favorites";
import { renderHistory } from "./history";
import { credit, segmented, tickClocks } from "./ui";

type Tab = "favorites" | "automatic" | "history";
let tab: Tab = "favorites";
let settingsOpen = false;
let autostart = false;

const root = document.getElementById("app")!;

async function render() {
  const state: AppState = await api.state();
  applySettings(state.theme, state.lang);

  let page: HTMLElement;
  if (tab === "favorites") page = renderFavorites(state, await api.presets(), render);
  else if (tab === "automatic") page = renderAutomatic(state, await api.recurring(), render);
  else page = await renderHistory(render);

  const scroll = root.querySelector(".content")?.scrollTop ?? 0;
  const focusedId = document.activeElement?.id;

  const tabs: [Tab, string][] = [
    ["favorites", t("tab.favorites")],
    ["automatic", t("tab.automatic")],
    ["history", t("tab.history")],
  ];

  const topbar = h(
    "header",
    { class: "topbar" },
    tab === "history"
      ? h("span", { style: "width:2.5rem" })
      : h(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": t("add"),
            title: t("add"),
            onclick: () => (tab === "favorites" ? newTimer(render) : newReminder(render)),
          },
          icon(ICONS.plus),
        ),
    h(
      "nav",
      { class: "tabs", role: "tablist", "aria-label": t("sections") },
      tabs.map(([id, label]) =>
        h(
          "button",
          {
            class: "tab",
            role: "tab",
            type: "button",
            "aria-selected": String(tab === id),
            onclick: () => {
              tab = id;
              render();
            },
          },
          label,
        ),
      ),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        type: "button",
        "aria-label": t("settings"),
        title: t("settings"),
        "aria-expanded": String(settingsOpen),
        onclick: () => {
          settingsOpen = !settingsOpen;
          render();
        },
      },
      icon(ICONS.theme),
    ),
  );

  const popover = h(
    "div",
    { class: "popover", role: "dialog", "aria-label": t("settings"), hidden: !settingsOpen },
    h(
      "div",
      { class: "field" },
      t("settings.theme"),
      segmented(
        t("settings.theme"),
        [
          ["system", t("settings.theme.system")],
          ["light", t("settings.theme.light")],
          ["dark", t("settings.theme.dark")],
        ],
        state.theme,
        (v) => api.setSetting("theme", v),
      ),
    ),
    h(
      "div",
      { class: "field" },
      t("settings.lang"),
      segmented<Lang>(t("settings.lang"), [["pt", "Português"], ["en", "English"]], state.lang, (v) =>
        api.setSetting("lang", v),
      ),
    ),
    h(
      "label",
      { class: "check" },
      h("input", {
        type: "checkbox",
        checked: autostart,
        onchange: async (e: Event) => {
          const on = (e.target as HTMLInputElement).checked;
          await (on ? enable() : disable());
          autostart = await isEnabled();
        },
      }),
      t("settings.autostart"),
    ),
  );

  const content = h("main", { class: "content" }, page);
  replace(root, topbar, popover, content, h("footer", { class: "footer" }, credit()));
  content.scrollTop = scroll;
  if (focusedId) document.getElementById(focusedId)?.focus();
}

document.addEventListener("pivot:rerender", render);
document.addEventListener("click", (e) => {
  if (!settingsOpen) return;
  const target = e.target as Element;
  if (!target.closest(".popover") && !target.closest("[aria-expanded]")) {
    settingsOpen = false;
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOpen) {
    settingsOpen = false;
    render();
  }
});

onChanged(render);
setInterval(tickClocks, 1000);
isEnabled()
  .then((v) => (autostart = v))
  .catch(() => {})
  .finally(render);
