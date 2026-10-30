// Main window: tabs (Favorites / Automatic / History / Settings) and the credit footer.
import "../styles.css";
import { api, onChanged, type AppState } from "../lib/api";
import { h, icon, replace } from "../lib/dom";
import { t } from "../lib/i18n";
import { PIVOT_MARK } from "../lib/logo";
import { pivotTurn, tabPill } from "../lib/motion";
import { applySettings } from "../lib/theme";
import { renderAutomatic } from "./automatic";
import { renderFavorites } from "./favorites";
import { renderHistory } from "./history";
import { renderSettings } from "./settings";
import { initSplash } from "./splash";
import { credit, tickClocks } from "./ui";
import { initUpdates, onUpdateStatus, updateStatus } from "./updates";

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
  const topbar = h(
    "header",
    { class: "topbar" },
    h(
      "div",
      { class: "brand", onmouseenter: (e: Event) => pivotTurn(e.currentTarget as Element) },
      icon(PIVOT_MARK, "brand-mark"),
      h("span", { class: "brand-name" }, "Pivot"),
    ),
    h(
      "nav",
      { class: "tabs", role: "tablist", "aria-label": t("sections") },
      h("span", { class: "tab-pill", "aria-hidden": "true" }),
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
          id === "settings" && updateStatus().kind === "available"
            ? h("span", { class: "tab-dot", "aria-label": t("set.updates") })
            : null,
        ),
      ),
    ),
    h("span"),
  );

  const content = h("main", { class: "content" }, page);
  replace(root, topbar, content, h("footer", { class: "footer" }, credit()));
  content.scrollTop = scroll;
  tabPill(topbar.querySelector<HTMLElement>(".tabs")!);
  if (focusedId) document.getElementById(focusedId)?.focus();
}

document.addEventListener("pivot:rerender", render);
onChanged(render);
onUpdateStatus(render);
setInterval(tickClocks, 1000);
initSplash(render());
initUpdates();
