// Applies the theme setting (system | light | dark) and language to <html>.
import { setLang, type Lang } from "./i18n";

const media = window.matchMedia("(prefers-color-scheme: dark)");
let current: "system" | "light" | "dark" = "system";

function apply() {
  const dark = current === "dark" || (current === "system" && media.matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
}

media.addEventListener("change", apply);

export function applySettings(theme: "system" | "light" | "dark", lang: Lang) {
  current = theme;
  apply();
  setLang(lang);
}
