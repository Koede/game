/** A tiny typed DOM toolkit: element creation, cheap in-place updates, listener disposal. No framework. */

export type Dispose = () => void;

/** Anything `h` and `append` accept as content. Falsy values are skipped, arrays are flattened. */
export type Child = Node | string | number | false | null | undefined | readonly Child[];

type Handlers = { [K in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[K]) => void };

export interface Props {
  class?: string | readonly (string | false | null | undefined)[];
  text?: string;
  /** Attributes. `true` sets an empty attribute; `false`, `null` and `undefined` leave it off. */
  attrs?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  /** Inline styles by CSS property name ('min-width', '--hw-accent'), not camelCase. */
  style?: Readonly<Record<string, string>>;
  on?: Handlers;
}

/** Every widget of the kit exposes its root element as `el`. */
export interface Component {
  readonly el: HTMLElement;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = typeof props.class === 'string' ? props.class : props.class.filter(Boolean).join(' ');
    if (props.text !== undefined) el.textContent = props.text;
    if (props.attrs) for (const name in props.attrs) setAttr(el, name, props.attrs[name]);
    if (props.style) for (const name in props.style) el.style.setProperty(name, props.style[name]);
    if (props.on) {
      for (const type in props.on) {
        const fn = props.on[type as keyof HTMLElementEventMap];
        if (fn) el.addEventListener(type, fn as EventListener);
      }
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') parent.appendChild(document.createTextNode(String(child)));
    else if (child instanceof Node) parent.appendChild(child);
    else append(parent, ...child);
  }
}

export const clear = (el: Element): void => el.replaceChildren();

export const setClass = (el: Element, name: string, on: boolean): void => {
  el.classList.toggle(name, on);
};

/** Writes text only when it differs, so widgets can be refreshed many times per second for free. */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Sets, or with `null` / `false` / `undefined` removes, an attribute; skips the write when nothing changes. */
export function setAttr(el: Element, name: string, value: string | number | boolean | null | undefined): void {
  if (value === null || value === undefined || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    return;
  }
  const text = value === true ? '' : String(value);
  if (el.getAttribute(name) !== text) el.setAttribute(name, text);
}

/** Boolean state as a `data-*` attribute (present / absent), which is what the stylesheet keys on. */
export const setFlag = (el: HTMLElement, name: string, on: boolean): void => setAttr(el, `data-${name}`, on);

export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  fn: (ev: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean,
): Dispose;
export function listen<K extends keyof DocumentEventMap>(
  target: Document,
  type: K,
  fn: (ev: DocumentEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean,
): Dispose;
export function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  fn: (ev: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean,
): Dispose;
export function listen(target: EventTarget, type: string, fn: (ev: never) => void, options?: AddEventListenerOptions | boolean): Dispose {
  const handler = fn as EventListener;
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Collects clean-up functions and runs them once, in reverse order. */
export class Disposer {
  private items: Dispose[] = [];

  add(dispose: Dispose): Dispose {
    this.items.push(dispose);
    return dispose;
  }

  dispose(): void {
    const items = this.items;
    this.items = [];
    for (let i = items.length - 1; i >= 0; i--) items[i]();
  }
}

let nextId = 0;
/** A document-unique id for aria-labelledby / aria-controls wiring. */
export const uid = (prefix: string): string => `hw-${prefix}-${++nextId}`;

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
