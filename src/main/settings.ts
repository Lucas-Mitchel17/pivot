// Settings tab: appearance, alert sound (volume, test, custom file) and types.
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, type AppState, type BuiltinKey, type Category, type GoalUnit, type SoundInfo } from "../lib/api";
import { h } from "../lib/dom";
import { BUILTIN_NAMES, catColor, catName, fmtGoal, t, weekdayLetters, type Lang } from "../lib/i18n";
import { relaunch } from "@tauri-apps/plugin-process";
import { confirmDelete, confirmDialog, segmented, switchButton } from "./ui";
import { canSelfUpdate, checkForUpdates, currentVersion, installUpdate, updateStatus } from "./updates";

/** Colors for user types: mid-light hues that read on both light and dark surfaces. */
export const TYPE_COLORS = ["#f5c451", "#57e389", "#ff8a8a", "#c061cb", "#ffa348", "#5bc8af", "#dc8add", "#99c1f1"];

interface TypeDraft {
  id: number | null;
  /** Set when editing a built-in. */
  key: BuiltinKey | null;
  name: string;
  /** null = the built-in's theme color. */
  color: string | null;
  goal: string;
  goalUnit: GoalUnit;
  error: string;
}
const blankType = (): TypeDraft => ({ id: null, key: null, name: "", color: TYPE_COLORS[0], goal: "", goalUnit: "min", error: "" });
let typeDraft: TypeDraft = blankType();

let soundMessage: { ok: boolean; text: string } | null = null;
let historyMessage = "";
/** alert_on_top as it was when this process started; differs after a change that needs a restart. */
let alertOnTopAtStart: boolean | null = null;
let autostart = false;
isEnabled()
  .then((v) => (autostart = v))
  .catch(() => {});

export function newType(rerender: () => void) {
  typeDraft = blankType();
  rerender();
  document.querySelector<HTMLInputElement>("#type-name")?.focus();
}

function soundError(code: string): string {
  if (code.startsWith("too_long:")) return t("set.sound.err.too_long", { secs: code.split(":")[1] });
  const key = `set.sound.err.${code}`;
  return ["extension", "too_big", "unsupported"].includes(code) ? t(key as "set.sound.err.unsupported") : code;
}

function appearance(state: AppState) {
  return h(
    "section",
    { class: "section" },
    h("h2", {}, t("set.appearance")),
    h(
      "div",
      { class: "card settings-card" },
      h(
        "div",
        { class: "setting-row" },
        h("span", { class: "row-title" }, t("settings.theme")),
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
        { class: "setting-row" },
        h("span", { class: "row-title" }, t("settings.lang")),
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
    ),
  );
}

function sound(info: SoundInfo, rerender: () => void) {
  let volume = info.volume;
  const output = h("output", {}, `${volume}%`);
  const file = h("input", {
    type: "file",
    accept: ".wav,.mp3,.ogg,.flac,.m4a,.aac,audio/*",
    class: "sr-only",
    tabindex: "-1",
    onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const secs = await api.setCustomSound(f.name, new Uint8Array(await f.arrayBuffer()));
        soundMessage = { ok: true, text: t("set.sound.saved", { secs: secs.toFixed(1) }) };
      } catch (err) {
        soundMessage = { ok: false, text: soundError(String(err)) };
      }
      rerender();
    },
  });

  return h(
    "section",
    { class: "section" },
    h("h2", {}, t("set.sound")),
    h(
      "div",
      { class: "card settings-card" },
      h(
        "div",
        { class: "setting-row" },
        h(
          "label",
          { class: "volume" },
          h("span", { class: "row-title" }, t("set.volume")),
          h("input", {
            type: "range",
            min: "0",
            max: "100",
            step: "5",
            value: String(volume),
            oninput: (e: Event) => {
              volume = Number((e.target as HTMLInputElement).value);
              output.textContent = `${volume}%`;
            },
            onchange: () => api.setVolume(volume),
          }),
          output,
        ),
        h("button", { class: "btn", type: "button", onclick: () => api.testSound(volume) }, t("set.test")),
      ),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          { class: "row-main", style: "cursor:default" },
          h(
            "span",
            { class: "row-title" },
            info.custom_name ? t("set.sound.custom", { name: info.custom_name }) : t("set.sound.builtin"),
          ),
          h("span", { class: "row-sub" }, t("set.sound.hint")),
        ),
        h(
          "div",
          { style: "display:flex;gap:8px" },
          info.custom_name
            ? h(
                "button",
                {
                  class: "btn ghost",
                  type: "button",
                  onclick: async () => {
                    await api.resetSound();
                    soundMessage = null;
                    rerender();
                  },
                },
                t("set.sound.reset"),
              )
            : null,
          h("button", { class: "btn", type: "button", onclick: () => file.click() }, t("set.sound.pick")),
          file,
        ),
      ),
      soundMessage ? h("p", { class: soundMessage.ok ? "ok" : "error", role: "status" }, soundMessage.text) : null,
    ),
  );
}

/** Goal in minutes from "2h", "1h30", "1:30" (hours:minutes) or "45" (minutes). */
export function parseGoalMinutes(text: string): number | null {
  const v = text.trim().toLowerCase().replace(/\s+/g, "");
  let m: RegExpMatchArray | null;
  let minutes: number;
  if ((m = v.match(/^(\d+)(?:h|:)(\d{1,2})?(?:m|min)?$/))) minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = v.match(/^(\d+)(?:m|min)?$/))) minutes = Number(m[1]);
  else return null;
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

function goalField(c: Category): string {
  if (c.goal === null) return "";
  if (c.goal_unit === "count") return String(c.goal);
  const h = Math.floor(c.goal / 60);
  const m = Math.round(c.goal % 60);
  return h ? (m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : String(m);
}

function goalDays(state: AppState) {
  const days = new Set(state.goal_days);
  return h(
    "div",
    { class: "card settings-card" },
    h(
      "div",
      { class: "setting-row" },
      h("span", { class: "row-title" }, t("set.types.goalDays")),
      h(
        "div",
        { class: "days", role: "group", "aria-label": t("set.types.goalDays") },
        weekdayLetters().map((l, i) => {
          const d = String(i);
          return h(
            "button",
            {
              class: "day",
              type: "button",
              "aria-pressed": String(days.has(d)),
              onclick: () => {
                if (days.has(d) && days.size === 1) return; // keep at least one day
                if (days.has(d)) days.delete(d);
                else days.add(d);
                api.setSetting("goal_days", [...days].sort().join(""));
              },
            },
            l,
          );
        }),
      ),
    ),
  );
}

function types(state: AppState, categories: Category[], rerender: () => void) {
  if (typeDraft.id !== null && !categories.some((c) => c.id === typeDraft.id)) typeDraft = blankType();
  const editing = categories.find((c) => c.id === typeDraft.id);

  const rows = categories.map((c) =>
    h(
      "li",
      { class: `row${typeDraft.id === c.id ? " editing" : ""}` },
      h("span", { class: "dot", style: `background:${catColor(c)};width:14px;height:14px` }),
      h(
        "button",
        {
          class: "row-main",
          type: "button",
          onclick: () => {
            typeDraft = {
              id: c.id,
              key: c.key,
              name: catName(c),
              color: c.color ?? (c.key ? null : TYPE_COLORS[0]),
              goal: goalField(c),
              goalUnit: c.goal_unit,
              error: "",
            };
            rerender();
            document.querySelector<HTMLInputElement>("#type-name")?.focus();
          },
        },
        h(
          "span",
          { style: "display:flex;align-items:center;gap:8px" },
          h("span", { class: "row-title" }, catName(c)),
          c.key ? h("span", { class: "tag" }, t("set.types.builtin")) : null,
        ),
        c.goal !== null ? h("span", { class: "row-sub" }, fmtGoal(c)) : null,
      ),
    ),
  );

  const save = async () => {
    const name = typeDraft.name.trim();
    let goal: number | null = null;
    if (!name) typeDraft.error = t("err.name");
    else if (typeDraft.goal.trim()) {
      goal = typeDraft.goalUnit === "count" ? Number(typeDraft.goal) : parseGoalMinutes(typeDraft.goal);
      typeDraft.error = goal !== null && Number.isInteger(goal) && goal > 0 && goal <= 1440 ? "" : t("err.goal");
    } else typeDraft.error = "";
    if (typeDraft.error) return rerender();
    // A built-in left with its translated name keeps the stored one, so it stays translated.
    const stored = editing?.key && name === t(`cat.${editing.key}` as "cat.stand") ? BUILTIN_NAMES[editing.key] : name;
    try {
      await api.saveCategory({ id: typeDraft.id, name: stored, color: typeDraft.color, goal, goal_unit: typeDraft.goalUnit });
      typeDraft = blankType();
    } catch (err) {
      typeDraft.error = String(err).includes("duplicate") ? t("err.duplicate") : String(err);
    }
    rerender();
  };

  const swatch = (color: string | null, label: string, background: string) =>
    h("button", {
      class: "swatch",
      type: "button",
      style: `background:${background}`,
      "aria-label": label,
      title: label,
      "aria-pressed": String(color === typeDraft.color),
      onclick: (e: Event) => {
        typeDraft.color = color;
        (e.currentTarget as HTMLElement)
          .closest(".swatches")
          ?.querySelectorAll(".swatch")
          .forEach((s) => s.setAttribute("aria-pressed", String(s === e.currentTarget)));
      },
    });

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
      { class: "field span-4" },
      t("set.types.name"),
      h("input", {
        id: "type-name",
        class: "input",
        value: typeDraft.name,
        maxlength: 30,
        oninput: (e: Event) => (typeDraft.name = (e.target as HTMLInputElement).value),
      }),
    ),
    h(
      "fieldset",
      { class: "field span-4", style: "border:0;margin:0;padding:0" },
      h("legend", { style: "padding:0;margin-bottom:4px" }, t("set.types.color")),
      h(
        "div",
        { class: "swatches" },
        typeDraft.key ? swatch(null, t("set.types.default"), `var(--cat-${typeDraft.key})`) : null,
        TYPE_COLORS.map((color) => swatch(color, color, color)),
      ),
    ),
    h(
      "div",
      { class: "field span-4" },
      h("label", { for: "type-goal" }, t("set.types.goal")),
      h(
        "div",
        { class: "goal-input" },
        h("input", {
          id: "type-goal",
          class: "input",
          value: typeDraft.goal,
          inputmode: typeDraft.goalUnit === "count" ? "numeric" : "text",
          placeholder: typeDraft.goalUnit === "count" ? "8" : "2h",
          maxlength: 6,
          oninput: (e: Event) => (typeDraft.goal = (e.target as HTMLInputElement).value),
        }),
        segmented(
          t("set.types.goal"),
          [
            ["min", t("set.types.goal.min")],
            ["count", t("set.types.goal.count")],
          ],
          typeDraft.goalUnit,
          (v) => {
            typeDraft.goalUnit = v;
            typeDraft.goal = "";
            rerender();
          },
        ),
      ),
      h("span", { class: "hint", style: "font-weight:400" }, t(typeDraft.goalUnit === "count" ? "set.types.goal.countHint" : "set.types.goal.minHint")),
    ),
    typeDraft.error ? h("p", { class: "error span-4", role: "alert" }, typeDraft.error) : null,
    h(
      "div",
      { class: "form-actions" },
      typeDraft.id !== null && !typeDraft.key
        ? h(
            "button",
            {
              class: "btn danger",
              type: "button",
              title: t("set.types.deleteHint"),
              onclick: async () => {
                if (!(await confirmDelete(typeDraft.name, t("set.types.deleteHint")))) return;
                await api.deleteCategory(typeDraft.id!);
                typeDraft = blankType();
                rerender();
              },
            },
            t("delete"),
          )
        : null,
      h(
        "div",
        { class: "right" },
        typeDraft.id !== null
          ? h("button", { class: "btn ghost", type: "button", onclick: () => ((typeDraft = blankType()), rerender()) }, t("cancel"))
          : null,
        h("button", { class: "btn primary", type: "submit" }, t(typeDraft.id !== null ? "save.changes" : "save")),
      ),
    ),
    typeDraft.id !== null && !typeDraft.key ? h("p", { class: "hint span-4" }, t("set.types.deleteHint")) : null,
  );

  return [
    h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", {}, t("set.types")), h("span", { class: "hint" }, t("set.types.hint"))),
      h("ul", { class: "card list" }, rows),
      goalDays(state),
    ),
    h("section", { class: "section" }, h("h2", {}, t(typeDraft.id !== null ? "set.types.edit" : "set.types.new")), form),
  ];
}

function alertSection(state: AppState) {
  alertOnTopAtStart ??= state.alert_on_top;
  const pendingRestart = state.alert_on_top_needs_restart && state.alert_on_top !== alertOnTopAtStart;
  return h(
    "section",
    { class: "section" },
    h("h2", {}, t("set.alert")),
    h(
      "div",
      { class: "card settings-card" },
      h(
        "div",
        { class: "setting-row", style: "flex-wrap:nowrap" },
        h(
          "div",
          { class: "row-main", style: "cursor:default" },
          h("span", { class: "row-title" }, t("set.alert.onTop")),
          h("span", { class: "row-sub" }, t("set.alert.onTop.hint")),
        ),
        switchButton(state.alert_on_top, t("set.alert.onTop"), (v) => api.setSetting("alert_on_top", v ? "1" : "0")),
      ),
      pendingRestart
        ? h(
            "div",
            { class: "setting-row" },
            h("span", { class: "ok" }, t("set.alert.restart")),
            h("button", { class: "btn primary", type: "button", onclick: () => relaunch() }, t("set.alert.restartNow")),
          )
        : null,
    ),
  );
}

function history(rerender: () => void) {
  const clear = async (olderThanDays: number | null) => {
    const ok = await confirmDialog({
      title: t(olderThanDays ? "set.history.confirmOld" : "set.history.confirmAll"),
      body: t("set.history.confirmBody"),
      confirm: t("set.history.confirmBtn"),
    });
    if (!ok) return;
    const n = await api.clearHistory(olderThanDays);
    historyMessage = t("set.history.done", { n });
    rerender();
  };
  return h(
    "section",
    { class: "section" },
    h("h2", {}, t("set.history")),
    h(
      "div",
      { class: "card settings-card" },
      h("p", { class: "hint", style: "margin:0" }, t("set.history.hint")),
      h(
        "div",
        { style: "display:flex;gap:8px;flex-wrap:wrap" },
        h("button", { class: "btn", type: "button", onclick: () => clear(30) }, t("set.history.old")),
        h("button", { class: "btn danger", type: "button", onclick: () => clear(null) }, t("set.history.all")),
      ),
      historyMessage ? h("p", { class: "ok", role: "status", style: "margin:0" }, historyMessage) : null,
    ),
  );
}

function updates() {
  const s = updateStatus();
  let line: Node | string = "";
  let action: HTMLElement | null = h(
    "button",
    { class: "btn", type: "button", disabled: s.kind === "checking", onclick: () => checkForUpdates() },
    t(s.kind === "checking" ? "set.updates.checking" : "set.updates.check"),
  );
  if (s.kind === "latest") line = h("span", { class: "ok" }, t("set.updates.latest"));
  if (s.kind === "error") line = h("span", { class: "error" }, t("set.updates.error"));
  if (s.kind === "downloading") {
    line = h("span", { class: "row-sub" }, t("set.updates.downloading", { pct: s.pct }));
    action = null;
  }
  if (s.kind === "available") {
    line = h(
      "div",
      { class: "row-main", style: "cursor:default" },
      h("span", { class: "row-title" }, t("set.updates.available", { version: s.version })),
      s.notes ? h("span", { class: "row-sub" }, s.notes) : null,
      canSelfUpdate() ? null : h("span", { class: "row-sub" }, t("set.updates.packageHint")),
    );
    action = h(
      "button",
      { class: "btn primary", type: "button", onclick: () => installUpdate() },
      t(canSelfUpdate() ? "set.updates.install" : "set.updates.download"),
    );
  }
  return h(
    "section",
    { class: "section" },
    h("h2", {}, t("set.updates")),
    h(
      "div",
      { class: `card settings-card${s.kind === "available" ? " update-card" : ""}` },
      h(
        "div",
        { class: "setting-row" },
        h("span", { class: "row-title mono" }, t("set.updates.version", { version: currentVersion() })),
        action,
      ),
      line,
    ),
  );
}

export async function renderSettings(state: AppState, categories: Category[], rerender: () => void): Promise<HTMLElement> {
  const info = await api.soundInfo();
  return h(
    "div",
    { class: "page" },
    updates(),
    appearance(state),
    alertSection(state),
    sound(info, rerender),
    ...types(state, categories, rerender),
    history(rerender),
  );
}
