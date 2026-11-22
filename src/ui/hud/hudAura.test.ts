import { describe, expect, it } from 'vitest';
import { createBus, createInputState, defaultSettings } from '../../core/context';
import { block } from '../../core/registry';
import type { IWorld } from '../../core/types';
import { GameClock } from '../../game/clock';
import { ObjectiveTracker } from '../../game/objectives';
import { PlayerState } from '../../game/playerState';
import { Survival } from '../../game/survival';
import { NO_UI_SIM } from './query';

/** Enough of a DOM for Hud to build and for setAura to show or hide its node. */
class MiniNode {
  parent: MiniNode | null = null;
  childNodes: MiniNode[] = [];
  private text: string | null = null;

  get textContent(): string {
    if (this.childNodes.length) return this.childNodes.map((c) => c.textContent).join('');
    return this.text ?? '';
  }

  set textContent(value: string) {
    this.text = value;
    for (const c of this.childNodes) c.parent = null;
    this.childNodes = [];
  }

  appendChild<T extends MiniNode>(child: T): T {
    if (child.parent) child.parent.childNodes = child.parent.childNodes.filter((n) => n !== child);
    child.parent = this;
    this.childNodes.push(child);
    this.text = null;
    return child;
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.childNodes = this.parent.childNodes.filter((n) => n !== this);
    this.parent = null;
  }

  replaceChildren(...nodes: MiniNode[]): void {
    for (const c of this.childNodes) c.parent = null;
    this.childNodes = [];
    for (const n of nodes) this.appendChild(n);
  }

  replaceChild(next: MiniNode, prev: MiniNode): MiniNode {
    const i = this.childNodes.indexOf(prev);
    if (prev.parent === this) prev.parent = null;
    next.parent = this;
    if (i >= 0) this.childNodes[i] = next;
    else this.childNodes.push(next);
    return prev;
  }

  append(...nodes: MiniNode[]): void {
    for (const n of nodes) this.appendChild(n);
  }
}

class MiniEl extends MiniNode {
  readonly tag: string;
  hidden = false;
  readonly attrs = new Map<string, string>();
  private classes = new Set<string>();
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): void } & Record<string, string>;
  readonly classList: {
    add(...names: string[]): void;
    remove(...names: string[]): void;
    toggle(name: string, force?: boolean): void;
    contains(name: string): boolean;
  };
  readonly dataset: Record<string, string>;

  constructor(tag: string) {
    super();
    this.tag = tag;
    const values: Record<string, string> = {};
    this.style = new Proxy(values, {
      get: (t, p) => {
        if (p === 'setProperty') return (name: string, value: string) => { t[name] = value; };
        if (p === 'removeProperty') return (name: string) => { delete t[name]; };
        return typeof p === 'string' ? t[p] ?? '' : undefined;
      },
      set: (t, p, v) => {
        if (typeof p === 'string') t[p] = String(v);
        return true;
      },
    }) as MiniEl['style'];
    this.dataset = new Proxy({} as Record<string, string>, {
      get: (t, p) => (typeof p === 'string' ? t[p] : undefined),
      set: (t, p, v) => {
        if (typeof p === 'string') t[p] = String(v);
        return true;
      },
      deleteProperty: (t, p) => {
        if (typeof p === 'string') delete t[p];
        return true;
      },
    });
    this.classList = {
      add: (...names) => { for (const n of names) this.classes.add(n); },
      remove: (...names) => { for (const n of names) this.classes.delete(n); },
      toggle: (name, force) => {
        const on = force ?? !this.classes.has(name);
        if (on) this.classes.add(name);
        else this.classes.delete(name);
      },
      contains: (name) => this.classes.has(name),
    };
  }

  get className(): string {
    return [...this.classes].join(' ');
  }

  set className(value: string) {
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  get id(): string {
    return this.attrs.get('id') ?? '';
  }

  set id(value: string) {
    this.attrs.set('id', value);
  }

  get offsetWidth(): number {
    return 0;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === 'hidden') this.hidden = true;
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? this.attrs.get(name)! : null;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(): void { /* Hud binds clicks; this test never fires them. */ }
  removeEventListener(): void { /* dispose unbinds those clicks. */ }

  getBoundingClientRect(): { top: number; bottom: number; left: number; right: number; width: number; height: number; x: number; y: number } {
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 };
  }
}

const elements: MiniEl[] = [];
const documentMock = {
  createElement: (tag: string): MiniEl => {
    const el = new MiniEl(tag);
    elements.push(el);
    return el;
  },
  createElementNS: (_ns: string, tag: string): MiniEl => documentMock.createElement(tag),
  createTextNode: (text: string): MiniNode => {
    const n = new MiniNode();
    n.textContent = text;
    return n;
  },
  getElementById: (id: string): MiniEl | null => elements.find((e) => e.id === id) ?? null,
  head: null as MiniEl | null,
};
documentMock.head = documentMock.createElement('head');

(globalThis as unknown as { Node: typeof MiniNode; document: typeof documentMock }).Node = MiniNode;
(globalThis as unknown as { document: typeof documentMock }).document = documentMock;

const { Hud } = await import('./hud');
const { UIRoot } = await import('../kit/root');

function findAura(node: MiniNode): MiniEl | null {
  if (node instanceof MiniEl && node.classList.contains('hw-aura')) return node;
  for (const child of node.childNodes) {
    const found = findAura(child);
    if (found) return found;
  }
  return null;
}

describe('hud aura', () => {
  it('setAura shows the string in the cluster and setAura(null) hides the node', () => {
    const bus = createBus();
    const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
    const clock = new GameClock(bus);
    const world = { getBlock: () => block('stone') } as unknown as IWorld;
    const survival = new Survival(world, player, clock, () => 'woodland');
    const objectives = new ObjectiveTracker(bus, player);
    const app = documentMock.createElement('div');
    const root = new UIRoot(app as unknown as HTMLElement);
    const hud = new Hud(root, {
      bus,
      settings: defaultSettings(false),
      world,
      player,
      clock,
      objectives,
      survival,
      sim: () => NO_UI_SIM,
      input: createInputState(),
    });
    const aura = findAura(hud.el as unknown as MiniNode);
    expect(aura).not.toBeNull();
    expect(aura!.hidden).toBe(true);
    hud.setAura('Spark 4');
    expect(aura!.hidden).toBe(false);
    expect(aura!.textContent).toBe('Spark 4');
    expect(aura!.classList.contains('hw-aura')).toBe(true);
    hud.setAura(null);
    expect(aura!.hidden).toBe(true);
    hud.dispose();
    objectives.dispose();
    player.dispose();
  });
});
