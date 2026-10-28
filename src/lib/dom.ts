// A tiny element builder: h("button", { class: "btn", onclick }, "Text").
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "class") {
      el.className = String(v);
    } else if (k === "html") {
      el.innerHTML = String(v);
    } else if (k in el && typeof v !== "string") {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** An inline SVG icon from a trusted string in icons.ts. */
export function icon(svg: string, cls = "icon"): HTMLSpanElement {
  return h("span", { class: cls, "aria-hidden": "true", html: svg });
}

export function replace(target: Element, ...nodes: Node[]) {
  target.replaceChildren(...nodes);
}
