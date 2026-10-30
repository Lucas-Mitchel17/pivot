// Opening animation, played when the main window opens from closed (not when it comes back from
// minimized): the Pivot cube spins in, rolls back leaving the word "Pivot" behind it, then the
// pair flies into the top bar's logo while the app fades in. A click or any key skips it.
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { h, icon } from "../lib/dom";
import { PIVOT_MARK } from "../lib/logo";
import { reducedMotion } from "../lib/motion";

let overlay: HTMLElement | null = null;
let playing = false;

/** Covers the window so it opens on the splash instead of a flash of the app. */
function arm() {
  if (overlay || reducedMotion()) return;
  overlay = h(
    "div",
    { class: "splash", "aria-hidden": "true" },
    h("div", { class: "splash-veil" }),
    h("div", { class: "splash-lockup" }, icon(PIVOT_MARK, "splash-cube"), h("span", { class: "splash-word" }, "Pivot")),
  );
  document.body.append(overlay);
  document.body.classList.add("splashing");
}

function finish(el: HTMLElement) {
  if (overlay !== el) return;
  el.remove();
  overlay = null;
  playing = false;
  document.body.classList.remove("splashing");
}

async function play() {
  const el = overlay;
  if (!el || playing) return;
  playing = true;
  const skip = () => {
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    finish(el);
  };
  el.addEventListener("pointerdown", skip, { once: true });
  window.addEventListener("keydown", skip, { once: true });

  const run = (target: Element, frames: Keyframe[], duration: number, easing: string, delay = 0) =>
    target.animate(frames, { duration, easing, delay, fill: "forwards" }).finished.catch(() => {});
  const lockup = el.querySelector<HTMLElement>(".splash-lockup")!;
  const cube = el.querySelector<HTMLElement>(".splash-cube")!;
  const word = el.querySelector<HTMLElement>(".splash-word")!;
  const veil = el.querySelector<HTMLElement>(".splash-veil")!;
  // The cube starts over the middle of the word and rolls back to its own place.
  const off = (lockup.offsetWidth - cube.offsetWidth) / 2;

  await run(cube, [
    { transform: `translateX(${off}px) scale(.2) rotate(-300deg)`, opacity: 0 },
    { transform: `translateX(${off}px) scale(1.08) rotate(12deg)`, opacity: 1, offset: 0.75 },
    { transform: `translateX(${off}px) scale(1) rotate(0deg)`, opacity: 1 },
  ], 650, "cubic-bezier(.2,.7,.3,1)");
  const roll = "cubic-bezier(.5,0,.25,1)";
  await Promise.all([
    run(cube, [{ transform: `translateX(${off}px) rotate(0deg)`, opacity: 1 }, { transform: "translateX(0) rotate(-360deg)", opacity: 1 }], 650, roll),
    run(word, [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)" }], 650, roll),
  ]);
  if (overlay !== el) return;
  await new Promise((r) => setTimeout(r, 250));

  const mark = document.querySelector(".topbar .brand-mark");
  if (mark && overlay === el) {
    const l = lockup.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const s = m.width / cube.getBoundingClientRect().width;
    const dx = m.left - l.left;
    const dy = m.top + m.height / 2 - (l.top + l.height / 2);
    await Promise.all([
      run(lockup, [{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], 580, "cubic-bezier(.6,0,.2,1)"),
      run(veil, [{ opacity: 1 }, { opacity: 0 }], 480, "ease-out", 120),
    ]);
  }
  window.removeEventListener("keydown", skip);
  finish(el);
}

/** Wires the splash; `rendered` resolves once the app has drawn its top bar (the flight's target). */
export function initSplash(rendered: Promise<unknown>) {
  const start = () => void rendered.then(play);
  arm();
  listen("pivot://hidden", arm);
  listen("pivot://opened", start);
  const win = getCurrentWindow();
  win.isVisible().then((visible) => (visible ? start() : undefined)).catch(start);
  // Fallback for any way of showing the window that doesn't send "opened".
  win.onFocusChanged(({ payload: focused }) => (focused ? start() : undefined));
}
