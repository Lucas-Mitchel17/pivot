// In-app updates through the Tauri updater: checks GitHub's latest release
// (latest.json), then downloads, installs and restarts. A .deb/.rpm install
// asks for the user's password (pkexec) to install the new package; if that
// fails, it gets a link to the download page. Snaps are updated by the store.
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { api } from "../lib/api";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; version: string; notes: string }
  | { kind: "downloading"; pct: number }
  | { kind: "installing" }
  | { kind: "error" }
  | { kind: "installError" };

let status: UpdateStatus = { kind: "idle" };
let pending: Update | null = null;
let version = "";
let installKind: "appimage" | "package" | "snap" | "app" = "app";
const listeners = new Set<() => void>();

const set = (s: UpdateStatus) => {
  status = s;
  listeners.forEach((fn) => fn());
};

export const updateStatus = () => status;
export const currentVersion = () => version;
/** The App Center (snap store) updates the snap; the app doesn't check on its own. */
export const storeUpdates = () => installKind === "snap";
/** .deb/.rpm installs need the user's password to install an update. */
export const needsPassword = () => installKind === "package";
export const onUpdateStatus = (fn: () => void) => listeners.add(fn);

export async function initUpdates() {
  version = await getVersion().catch(() => "");
  installKind = await api.installKind().catch(() => "app" as const);
  if (storeUpdates()) return;
  // Quiet check at startup; errors (offline, no release yet) only show on a manual check.
  await checkForUpdates(true);
}

export async function checkForUpdates(quiet = false) {
  if (!quiet) set({ kind: "checking" });
  try {
    pending = await check();
    if (pending) set({ kind: "available", version: pending.version, notes: pending.body ?? "" });
    else set(quiet ? { kind: "idle" } : { kind: "latest" });
  } catch {
    set(quiet ? { kind: "idle" } : { kind: "error" });
  }
}

export async function installUpdate() {
  if (!pending) return;
  let total = 0;
  let received = 0;
  set({ kind: "downloading", pct: 0 });
  try {
    await pending.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      if (event.event === "Progress") {
        received += event.data.chunkLength;
        set({ kind: "downloading", pct: total ? Math.round((100 * received) / total) : 0 });
      }
      if (event.event === "Finished") set({ kind: "installing" });
    });
    await relaunch();
  } catch {
    set({ kind: "installError" });
  }
}
