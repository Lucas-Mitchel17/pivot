// Settings tab: appearance, alert sound (volume, test, custom file) and types.
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, type AppState, type Category, type SoundInfo } from "../lib/api";
import { h } from "../lib/dom";
import { catColor, catName, t, type Lang } from "../lib/i18n";
import { confirmDelete, confirmDialog, segmented } from "./ui";
import { canSelfUpdate, checkForUpdates, currentVersion, installUpdate, updateStatus } from "./updates";

/** Colors for user types: mid-light hues that read on both light and dark surfaces. */
export const TYPE_COLORS = ["#f5c451", "#57e389", "#ff8a8a", "#c061cb", "#ffa348", "#5bc8af", "#dc8add", "#99c1f1"];

interface TypeDraft {
  id: number | null;
  name: string;
  color: string;
  error: string;
}
const blankType = (): TypeDraft => ({ id: null, name: "", color: TYPE_COLORS[0], error: "" });
let typeDraft: TypeDraft = blankType();

let soundMessage: { ok: boolean; text: string } | null = null;
let historyMessage = "";
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

function types(categories: Category[], rerender: () => void) {
  if (typeDraft.id !== null && !categories.some((c) => c.id === typeDraft.id)) typeDraft = blankType();

  const rows = categories.map((c) =>
    h(
      "li",
      { class: `row${typeDraft.id === c.id ? " editing" : ""}` },
      h("span", { class: "dot", style: `background:${catColor(c)};width:14px;height:14px` }),
      c.key
        ? h(
            "div",
            { class: "row-main", style: "cursor:default;flex-direction:row;align-items:center;gap:8px" },
            h("span", { class: "row-title" }, catName(c)),
            h("span", { class: "tag" }, t("set.types.builtin")),
          )
        : h(
            "button",
            {
              class: "row-main",
              type: "button",
              onclick: () => {
                typeDraft = { id: c.id, name: c.name, color: c.color ?? TYPE_COLORS[0], error: "" };
                rerender();
                document.querySelector<HTMLInputElement>("#type-name")?.focus();
              },
            },
            h("span", { class: "row-title" }, c.name),
          ),
    ),
  );

  const save = async () => {
    if (!typeDraft.name.trim()) {
      typeDraft.error = t("err.name");
      return rerender();
    }
    try {
      await api.saveCategory({ id: typeDraft.id, name: typeDraft.name.trim(), color: typeDraft.color });
      typeDraft = blankType();
    } catch (err) {
      typeDraft.error = String(err).includes("duplicate") ? t("err.duplicate") : String(err);
    }
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
      { class: "field span-2", style: "border:0;margin:0;padding:0" },
      h("legend", { style: "padding:0;margin-bottom:4px" }, t("set.types.color")),
      h(
        "div",
        { class: "swatches" },
        TYPE_COLORS.map((color) =>
          h("button", {
            class: "swatch",
            type: "button",
            style: `background:${color}`,
            "aria-label": color,
            "aria-pressed": String(color === typeDraft.color),
            onclick: (e: Event) => {
              typeDraft.color = color;
              (e.currentTarget as HTMLElement)
                .closest(".swatches")
                ?.querySelectorAll(".swatch")
                .forEach((s) => s.setAttribute("aria-pressed", String(s === e.currentTarget)));
            },
          }),
        ),
      ),
    ),
    typeDraft.error ? h("p", { class: "error", role: "alert" }, typeDraft.error) : null,
    h(
      "div",
      { class: "form-actions" },
      typeDraft.id !== null
        ? h(
            "button",
            {
              class: "btn danger",
              type: "button",
              title: t("set.types.deleteHint"),
              onclick: async () => {
                const name = categories.find((c) => c.id === typeDraft.id)?.name ?? typeDraft.name;
                if (!(await confirmDelete(name, t("set.types.deleteHint")))) return;
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
    typeDraft.id !== null ? h("p", { class: "hint span-4" }, t("set.types.deleteHint")) : null,
  );

  return [
    h(
      "section",
      { class: "section" },
      h("div", { class: "section-head" }, h("h2", {}, t("set.types")), h("span", { class: "hint" }, t("set.types.hint"))),
      h("ul", { class: "card list" }, rows),
    ),
    h("section", { class: "section" }, h("h2", {}, t(typeDraft.id !== null ? "set.types.edit" : "set.types.new")), form),
  ];
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
    sound(info, rerender),
    ...types(categories, rerender),
    history(rerender),
  );
}
