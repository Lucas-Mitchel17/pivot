// Favorites tab: saved timers (star = shows in the tray menu) and the create/edit form.
import { api, type AppState, type Category, type Preset } from "../lib/api";
import { h, icon } from "../lib/dom";
import { catName, fmtMinutes, minutesField, parseMinutesField, t, title } from "../lib/i18n";
import { ICONS } from "../lib/icons";
import { categorySelect, confirmDelete, minutesInput, nowCard } from "./ui";

interface Draft {
  id: number | null;
  title: string;
  minutes: string;
  categoryId: number;
  next: string; // preset id or ""
  favorite: boolean;
  error: string;
}

let defaultCategory = 0;
const blank = (): Draft => ({ id: null, title: "", minutes: "15", categoryId: defaultCategory, next: "", favorite: true, error: "" });
let draft: Draft = blank();

export function newTimer(rerender: () => void) {
  draft = blank();
  rerender();
  document.querySelector<HTMLInputElement>("#fav-title")?.focus();
}

export function renderFavorites(state: AppState, presets: Preset[], categories: Category[], rerender: () => void): HTMLElement {
  defaultCategory = categories[0]?.id ?? 0;
  if (draft.id !== null && !presets.some((p) => p.id === draft.id)) draft = blank();
  if (!categories.some((c) => c.id === draft.categoryId)) draft.categoryId = defaultCategory;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const byId = new Map(presets.map((p) => [p.id, p]));

  const edit = (p: Preset) => {
    draft = {
      id: p.id,
      title: title(p.title),
      minutes: minutesField(p.minutes),
      categoryId: p.category_id,
      next: p.next_preset_id ? String(p.next_preset_id) : "",
      favorite: p.favorite,
      error: "",
    };
    rerender();
    document.querySelector<HTMLInputElement>("#fav-title")?.focus();
  };

  const rows = presets.map((p) => {
    const next = p.next_preset_id ? byId.get(p.next_preset_id) : undefined;
    const sub = [catName(catById.get(p.category_id)), next ? t("fav.next", { next: `${title(next.title)} ${fmtMinutes(next.minutes)}` }) : null]
      .filter(Boolean)
      .join(" · ");
    const label = title(p.title);
    return h(
      "li",
      { class: `row${draft.id === p.id ? " editing" : ""}` },
      h(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-pressed": String(p.favorite),
          "aria-label": t(p.favorite ? "fav.star.on" : "fav.star.off", { title: label }),
          onclick: () => api.setFavorite(p.id, !p.favorite),
        },
        icon(p.favorite ? ICONS.starFilled : ICONS.star),
      ),
      h("span", { class: "badge" }, fmtMinutes(p.minutes)),
      h(
        "button",
        { class: "row-main", type: "button", onclick: () => edit(p) },
        h("span", { class: "row-title" }, label),
        h("span", { class: "row-sub" }, sub),
      ),
      h(
        "button",
        {
          class: "icon-btn round",
          type: "button",
          "aria-label": t("fav.play", { title: label }),
          onclick: () => api.startPreset(p.id),
        },
        icon(ICONS.play),
      ),
    );
  });

  const save = async () => {
    const minutes = parseMinutesField(draft.minutes);
    if (!draft.title.trim()) draft.error = t("err.title");
    else if (minutes === null) draft.error = t("err.minutesFormat");
    else draft.error = "";
    if (draft.error) return rerender();
    // Keep the stored Portuguese name of a default preset when only its English label was shown.
    const original = draft.id !== null ? byId.get(draft.id) : undefined;
    const name = original && title(original.title) === draft.title.trim() ? original.title : draft.title.trim();
    await api.savePreset({
      id: draft.id,
      title: name,
      minutes: minutes!,
      category_id: draft.categoryId,
      next_preset_id: draft.next ? Number(draft.next) : null,
      favorite: draft.favorite,
    });
    draft = blank();
    rerender();
  };

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
        id: "fav-title",
        class: "input",
        value: draft.title,
        maxlength: 40,
        oninput: (e: Event) => (draft.title = (e.target as HTMLInputElement).value),
      }),
    ),
    h(
      "label",
      { class: "field" },
      t("f.minutes"),
      minutesInput("fav-minutes", draft.minutes, (v) => (draft.minutes = v)),
    ),
    h(
      "label",
      { class: "field" },
      t("f.type"),
      categorySelect(categories, draft.categoryId, (id) => (draft.categoryId = id)),
    ),
    h(
      "label",
      { class: "field span-2" },
      t("f.next"),
      h(
        "select",
        { class: "input", onchange: (e: Event) => (draft.next = (e.target as HTMLSelectElement).value) },
        h("option", { value: "" }, t("f.next.none")),
        presets
          .filter((p) => p.id !== draft.id)
          .map((p) =>
            h(
              "option",
              { value: String(p.id), selected: String(p.id) === draft.next },
              `${title(p.title)} · ${fmtMinutes(p.minutes)}`,
            ),
          ),
      ),
    ),
    h(
      "label",
      { class: "check span-2" },
      h("input", {
        type: "checkbox",
        checked: draft.favorite,
        onchange: (e: Event) => (draft.favorite = (e.target as HTMLInputElement).checked),
      }),
      t("f.favorite"),
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
                if (!(await confirmDelete(draft.title.trim() || "—", t("confirm.timer")))) return;
                await api.deletePreset(draft.id!);
                draft = blank();
                rerender();
              },
            },
            t("delete"),
          )
        : null,
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
    nowCard(state),
    h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", {}, t("fav.title")), h("span", { class: "hint" }, t("fav.hint"))),
      presets.length
        ? h("ul", { class: "card list" }, rows)
        : h("p", { class: "card empty" }, t("fav.empty")),
    ),
    h("section", { class: "section" }, h("h2", {}, t(draft.id !== null ? "fav.edit" : "fav.new")), form),
  );
}
