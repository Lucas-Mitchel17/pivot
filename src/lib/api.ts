// Typed wrappers around the Rust commands in src-tauri/src/commands.rs.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Category = "stand" | "sit" | "break" | "focus" | "water" | "other";
export const CATEGORIES: Category[] = ["stand", "sit", "break", "focus", "water", "other"];

export interface Preset {
  id: number;
  slug: string;
  title: string;
  minutes: number;
  category: Category;
  next_preset_id: number | null;
  favorite: boolean;
  sort_order: number;
}

export interface Recurring {
  id: number;
  title: string;
  category: Category;
  every_min: number;
  start_time: string;
  end_time: string;
  weekdays: string;
  enabled: boolean;
  last_fired_at: number | null;
  next_slot: number | null;
}

export interface Session {
  id: number;
  preset_id: number | null;
  recurring_id: number | null;
  title: string;
  category: Category;
  source: "cli" | "menu" | "app" | "auto" | "alert";
  started_at: number;
  planned_s: number;
  ends_at: number;
  ended_at: number | null;
  outcome: "done" | "stopped" | "skipped" | null;
  snoozes: number;
}

export interface AppState {
  active: { session: Session; next: Preset | null } | null;
  auto_enabled: boolean;
  auto_paused_until: number;
  theme: "system" | "light" | "dark";
  lang: "pt" | "en";
  now: number;
}

export interface Summary {
  start: number;
  end: number;
  stand_s: number;
  sit_s: number;
  switches: number;
  water_done: number;
  water_total: number;
  reminders_skipped: number;
  sessions: Session[];
}

export interface DayRow {
  date: string;
  stand_s: number;
  sit_s: number;
  switches: number;
  water_done: number;
  water_total: number;
}

export interface AlertInfo {
  session: Session;
  next: Preset | null;
  every_min: number | null;
}

export type PresetInput = Omit<Preset, "id" | "slug" | "sort_order"> & { id: number | null };
export type RecurringInput = Omit<Recurring, "id" | "last_fired_at" | "next_slot"> & { id: number | null };
export type Answer = "next" | "done" | "skipped" | "snooze";

export const api = {
  state: () => invoke<AppState>("get_state"),
  presets: () => invoke<Preset[]>("list_presets"),
  savePreset: (input: PresetInput) => invoke<number>("save_preset", { input }),
  deletePreset: (id: number) => invoke("delete_preset", { id }),
  setFavorite: (id: number, favorite: boolean) => invoke("set_favorite", { id, favorite }),
  startPreset: (id: number) => invoke("start_preset", { id }),
  startCustom: (title: string, minutes: number, category: Category) =>
    invoke("start_custom", { title, minutes, category }),
  stop: () => invoke("stop_timer"),
  recurring: () => invoke<Recurring[]>("list_recurring"),
  saveRecurring: (input: RecurringInput) => invoke<number>("save_recurring", { input }),
  deleteRecurring: (id: number) => invoke("delete_recurring", { id }),
  setRecurringEnabled: (id: number, enabled: boolean) => invoke("set_recurring_enabled", { id, enabled }),
  setAutoEnabled: (enabled: boolean) => invoke("set_auto_enabled", { enabled }),
  pauseAuto: (seconds: number) => invoke("pause_auto", { seconds }),
  history: (date: string, week: boolean) =>
    invoke<{ summary: Summary; days: DayRow[] }>("history", { date, week }),
  alertInfo: (id: number) => invoke<AlertInfo>("alert_info", { id }),
  answer: (id: number, action: Answer, snoozeMin = 5) => invoke("answer", { id, action, snoozeMin }),
  setSetting: (key: "theme" | "lang", value: string) => invoke("set_setting", { key, value }),
  openSite: () => invoke("open_site"),
};

/** Runs `fn` whenever the app state changes (any window, tray or terminal). */
export function onChanged(fn: () => void) {
  return listen("pivot://changed", fn);
}
