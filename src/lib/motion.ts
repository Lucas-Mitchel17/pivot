// Small UI motions. Every one of them is skipped when the system asks for reduced motion.

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const turning = new WeakSet<Element>();

/** Hover on the Pivot mark: the inner square pivots a quarter turn while the arc sweeps around. */
export function pivotTurn(root: Element) {
  const inner = root.querySelector(".inner");
  const arc = root.querySelector(".arc");
  if (!inner || !arc || reducedMotion() || turning.has(root)) return;
  turning.add(root);
  arc.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 600, easing: "cubic-bezier(.5,0,.3,1)" });
  inner
    .animate([{ transform: "rotate(0deg)" }, { transform: "rotate(90deg)" }], { duration: 600, easing: "cubic-bezier(.6,0,.3,1.2)" })
    .finished.catch(() => {})
    .finally(() => turning.delete(root));
}

let pillAt: { x: number; w: number } | null = null;
let pillObserver: ResizeObserver | null = null;

/** Places the tab highlight under the selected tab, sliding it from where it was at the last render. */
export function tabPill(nav: HTMLElement) {
  const pill = nav.querySelector<HTMLElement>(".tab-pill");
  if (!pill) return;
  const place = (animate: boolean) => {
    const tab = nav.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!tab) return;
    const to = { x: tab.offsetLeft, w: tab.offsetWidth };
    const frame = (p: { x: number; w: number }) => ({ transform: `translateX(${p.x}px)`, width: `${p.w}px` });
    Object.assign(pill.style, frame(to));
    if (animate && pillAt && (pillAt.x !== to.x || pillAt.w !== to.w) && !reducedMotion()) {
      pill.animate([frame(pillAt), frame(to)], { duration: 280, easing: "cubic-bezier(.3,1.2,.5,1)" });
    }
    pillAt = to;
  };
  place(true);
  // Fonts loading or the window resizing move the tabs; follow them without sliding.
  pillObserver?.disconnect();
  pillObserver = new ResizeObserver(() => place(false));
  pillObserver.observe(nav);
}

/** Counts a number up to `to` in the element's text, e.g. "0%" → "104%". */
export function countUp(el: HTMLElement, to: number, suffix: string, ms = 900) {
  if (reducedMotion()) return;
  const start = performance.now();
  const step = (now: number) => {
    const f = Math.min(1, (now - start) / ms);
    el.textContent = `${Math.round(to * (1 - (1 - f) ** 3))}${suffix}`;
    if (f < 1) requestAnimationFrame(step);
  };
  el.textContent = `0${suffix}`;
  requestAnimationFrame(step);
}
