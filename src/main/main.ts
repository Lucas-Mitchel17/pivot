// Main window: tabs (Favorites / Automatic / History / Settings) and the credit footer.
import "../styles.css";
import { api, onChanged, type AppState } from "../lib/api";
import { h, icon, replace } from "../lib/dom";
import { t } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { applySettings } from "../lib/theme";
import { newReminder, renderAutomatic } from "./automatic";
import { newTimer, renderFavorites } from "./favorites";
import { renderHistory } from "./history";
import { newType, renderSettings } from "./settings";
import { credit, tickClocks } from "./ui";

type Tab = "favorites" | "automatic" | "history" | "settings";
let tab: Tab = "favorites";

const root = document.getElementById("app")!;

async function render() {
  const state: AppState = await api.state();
  applySettings(state.theme, state.lang);
  const categories = await api.categories();

  let page: HTMLElement;
  if (tab === "favorites") page = renderFavorites(state, await api.presets(), categories, render);
  else if (tab === "automatic") page = renderAutomatic(state, await api.recurring(), categories, render);
  else if (tab === "history") page = await renderHistory(categories, render);
  else page = await renderSettings(state, categories, render);

  const scroll = root.querySelector(".content")?.scrollTop ?? 0;
  const focusedId = document.activeElement?.id;

  const tabs: [Tab, string][] = [
    ["favorites", t("tab.favorites")],
    ["automatic", t("tab.automatic")],
    ["history", t("tab.history")],
    ["settings", t("tab.settings")],
  ];
  const add: Partial<Record<Tab, () => void>> = {
    favorites: () => newTimer(render),
    automatic: () => newReminder(render),
    settings: () => newType(render),
  };
  const onAdd = add[tab];

  const topbar = h(
    "header",
    { class: "topbar" },
    onAdd
      ? h("button", { class: "icon-btn", type: "button", "aria-label": t("add"), title: t("add"), onclick: onAdd }, icon(ICONS.plus))
      : h("span", { style: "width:2.5rem" }),
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
    h("span", { style: "width:2.5rem" }),
  );

  const content = h("main", { class: "content" }, page);
  replace(root, topbar, content, h("footer", { class: "footer" }, credit()));
  content.scrollTop = scroll;
  if (focusedId) document.getElementById(focusedId)?.focus();
}

document.addEventListener("pivot:rerender", render);
onChanged(render);
setInterval(tickClocks, 1000);
render();
