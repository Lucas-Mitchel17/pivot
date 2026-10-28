// Typed wrappers around the Rust commands in src-tauri/src/commands.rs.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type BuiltinKey = "stand" | "sit" | "break" | "focus" | "water" | "other";

export interface Category {
  id: number;
  /** Set for built-in categories, null for the user's own. */
  key: BuiltinKey | null;
  name: string;
  /** "#rrggbb" for user categories; built-ins take their color from the theme. */
  color: string | null;
  sort_order: number;
}

export interface Preset {
  id: number;
  slug: string;
  title: string;
  minutes: number;
  category_id: number;
  next_preset_id: number | null;
  favorite: boolean;
  sort_order: number;
}

export interface Recurring {
  id: number;
  title: string;
  category_id: number;
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
  category_id: number;
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

export interface CategoryStat {
  category_id: number;
  timer_s: number;
  timers: number;
  reminders_done: number;
  reminders_total: number;
}

export interface Summary {
  start: number;
  end: number;
  tracked_s: number;
  switches: number;
  reminders_skipped: number;
  categories: CategoryStat[];
  sessions: Session[];
}

export interface DayRow {
  date: string;
  tracked_s: number;
  switches: number;
  categories: CategoryStat[];
}

export interface SoundInfo {
  volume: number;
  custom_name: string | null;
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
  startCustom: (title: string, minutes: number, categoryId: number) =>
    invoke("start_custom", { title, minutes, categoryId }),
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
  categories: () => invoke<Category[]>("list_categories"),
  saveCategory: (input: { id: number | null; name: string; color: string }) => invoke<number>("save_category", { input }),
  deleteCategory: (id: number) => invoke("delete_category", { id }),
  soundInfo: () => invoke<SoundInfo>("sound_info"),
  setVolume: (volume: number) => invoke("set_volume", { volume }),
  testSound: (volume?: number) => invoke("test_sound", { volume }),
  setCustomSound: (name: string, bytes: Uint8Array) =>
    invoke<number>("set_custom_sound", { name, bytes: Array.from(bytes) }),
  resetSound: () => invoke("reset_sound"),
};

/** Runs `fn` whenever the app state changes (any window, tray or terminal). */
export function onChanged(fn: () => void) {
  return listen("pivot://changed", fn);
}
