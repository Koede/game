/**
 * Slot interaction, identical on every screen. Selection model: a tap PICKS a slot (its stack stays where it is,
 * highlighted), the next tap on another slot drops / merges / swaps it there. Nothing is ever held "in the air",
 * so nothing can be lost when a screen closes or a machine changes a slot underneath the player's finger.
 *
 * SlotInteraction is the DOM-free rule set (unit-tested); SlotController wires it to ItemSlots, adds the mouse
 * ghost, double-tap / shift-click / two-finger bulk moves, the drag that spreads a held stack, and the action bar
 * with "Move to ..." buttons and the bag's own actions (gather, lock, sew a pocket) for touch.
 * Every move the player makes goes through SlotInteraction's MoveHistory, so one step can be undone.
 */
import type { GameBus } from '../../core/context';
import { itemOrNull } from '../../core/registry';
import { canMerge, type Inventory } from '../../game/inventory';
import { distributeStack, gatherable, gatherMatching, MoveHistory, sectionMove, type Section, type SlotTarget } from '../../game/inventoryMoves';
import { isFavourite, moveAllOf, toggleFavourite, toggleLock } from '../../game/inventoryTools';
import { POUCH_ITEM, canAddPocket, pocketsOf, sewPocket } from '../../game/pockets';
import { moveHalf, moveOne, moveStack, quickMove } from '../../game/transfer';
import { Disposer, h, listen, setText, type Dispose } from '../kit/dom';
import type { Tooltip, TooltipCard } from '../kit/feedback';
import { foodLine } from './food';
import { itemCard, slotView, stackName } from './inventory/slotViews';

export { itemCard, slotView };
import { Button, IconButton } from '../kit/controls';
import { ItemIcon } from '../kit/icons';
import type { ItemSlot } from '../kit/slot';

/** Where quick move sends a stack: a group id (its whole range), or an explicit slot range of a group's inventory. */
export type QuickTarget = string | { group: string; start: number; end: number };

export interface SlotGroupSpec {
  /** Unique within the controller. */
  id: string;
  /** Shown as "Move to <label>". */
  label: string;
  inventory: Inventory;
  /** One view per inventory slot, starting at `start`. */
  views: readonly ItemSlot[];
  /** First inventory slot shown by views[0]. Default 0. */
  start?: number;
  /** Quick-move destinations in priority order. Default: every group over another inventory, in binding order;
   * when there is none, the other groups over the same inventory (hotbar <-> backpack). */
  quickTo?: readonly QuickTarget[];
  /**
   * The bag's sections in inventory slot order (the hotbar, then each pocket). When given, Shift and two-finger taps
   * move the whole stack round these sections, and Gather stays inside one. Without it, a bulk move is quickMove.
   */
  sections?: () => readonly Section[];
}

export interface SlotPick {
  group: string;
  /** Inventory slot index. */
  index: number;
  /** Dropping moves half the stack instead of all of it. */
  half: boolean;
}

export type SlotOutcome = 'none' | 'picked' | 'cancelled' | 'moved' | 'refused';

interface Group {
  id: string;
  label: string;
  inventory: Inventory;
  start: number;
  size: number;
  quickTo: readonly QuickTarget[] | undefined;
  sections: (() => readonly Section[]) | undefined;
}

/** Why a stack cannot go into slots [start, end) of an inventory: "Firebox does not take Copper Ore", "No room for ...". */
export function refusalText(inventory: Inventory, item: string, start: number, end: number, label: string): string {
  const name = itemOrNull(item)?.name ?? item;
  let accepts = false;
  for (let i = start; i < end && !accepts; i++) accepts = inventory.accepts(item, i);
  return accepts ? `No room for ${name} in the ${label.toLowerCase()} - take something out first` : `${label} does not take ${name}`;
}

export const LOCKED_TEXT = 'That slot is locked - unlock it first';

/** The rules, without any DOM. Indices are inventory slot indices. */
export class SlotInteraction {
  readonly groups = new Map<string, Group>();
  picked: SlotPick | null = null;
  /** Why the last 'refused' outcome happened, in words (null after any other outcome). */
  refusal: string | null = null;
  /** The player's moves, one step back. Cleared when the bag closes; never saved. */
  readonly history = new MoveHistory();

  addGroup(spec: { id: string; label: string; inventory: Inventory; start?: number; size: number; quickTo?: readonly QuickTarget[]; sections?: () => readonly Section[] }): void {
    this.groups.set(spec.id, {
      id: spec.id,
      label: spec.label,
      inventory: spec.inventory,
      start: spec.start ?? 0,
      size: spec.size,
      quickTo: spec.quickTo,
      sections: spec.sections,
    });
  }

  removeGroup(id: string): void {
    this.groups.delete(id);
    if (this.picked?.group === id) this.picked = null;
  }

  /** Tap / click. */
  primary(groupId: string, index: number): SlotOutcome {
    const target = this.groups.get(groupId);
    if (!target) return 'none';
    const pick = this.picked;
    if (!pick) return this.pick(target, index, false);
    if (pick.group === groupId && pick.index === index) {
      this.picked = null;
      return 'cancelled';
    }
    const source = this.groups.get(pick.group);
    if (!source || !source.inventory.slots[pick.index]) {
      this.picked = null;
      return this.pick(target, index, false);
    }
    if (source.inventory.locked.has(pick.index) || target.inventory.locked.has(index)) return this.locked();
    const moved = this.history.record([source.inventory, target.inventory], () =>
      pick.half ? moveHalf(source.inventory, pick.index, target.inventory, index) : moveStack(source.inventory, pick.index, target.inventory, index),
    );
    if (moved > 0) {
      this.picked = null;
      return 'moved';
    }
    // The target cannot take it (accept rules): treat the tap as choosing that slot instead, if it holds something.
    if (target.inventory.slots[index]) return this.pick(target, index, false);
    return this.refuse(source.inventory, pick.index, target, index, index + 1);
  }

  /** Right-click / long-press: pick half, or drop one item while keeping the pick. */
  secondary(groupId: string, index: number): SlotOutcome {
    const target = this.groups.get(groupId);
    if (!target) return 'none';
    const pick = this.picked;
    if (!pick) return this.pick(target, index, true);
    if (pick.group === groupId && pick.index === index) {
      if (pick.half) {
        this.picked = null;
        return 'cancelled';
      }
      pick.half = true;
      return 'picked';
    }
    const source = this.groups.get(pick.group);
    if (!source) return 'none';
    if (source.inventory.locked.has(pick.index) || target.inventory.locked.has(index)) return this.locked();
    const moved = this.history.record([source.inventory, target.inventory], () => moveOne(source.inventory, pick.index, target.inventory, index));
    if (moved === 0) return this.refuse(source.inventory, pick.index, target, index, index + 1);
    if (!source.inventory.slots[pick.index]) this.picked = null;
    return 'moved';
  }

  /**
   * Double-tap / shift-click / two-finger tap / the action bar. In the bag (a group with sections) the whole stack goes
   * round the sections (hotbar, pockets); elsewhere it goes to the group's quick-move destinations.
   */
  quickMove(groupId: string, index: number): SlotOutcome {
    const from = this.groups.get(groupId);
    if (!from || !from.inventory.slots[index]) return 'none';
    if (from.inventory.locked.has(index)) return this.locked();
    const stack = from.inventory.slots[index]!;
    if (from.sections) {
      const sections = from.sections();
      const moved = this.history.record([from.inventory], () => sectionMove(from.inventory, index, sections));
      if (this.picked && this.picked.group === groupId && this.picked.index === index) this.picked = null;
      if (moved > 0) return 'moved';
      this.refusal = `No room for ${itemOrNull(stack.item)?.name ?? stack.item} in the rest of the bag`;
      return 'refused';
    }
    let moved = 0;
    const targets = this.quickTargets(from);
    this.history.record([from.inventory, ...targets.map((t) => t.inventory)], () => {
      for (const t of targets) {
        if (!from.inventory.slots[index]) break;
        moved += quickMove(from.inventory, index, t.inventory, t.start, t.end);
      }
    });
    if (this.picked && this.picked.group === groupId && this.picked.index === index) this.picked = null;
    if (moved > 0) return 'moved';
    const first = targets[0];
    return first ? this.refuse(from.inventory, index, first.group, first.start, first.end) : 'refused';
  }

  /** Moves the picked stack to one destination group (the action bar's "Move to" buttons). */
  sendPicked(groupId: string): SlotOutcome {
    const pick = this.picked;
    const from = pick ? this.groups.get(pick.group) : undefined;
    const to = this.groups.get(groupId);
    if (!pick || !from || !to || !from.inventory.slots[pick.index]) return 'none';
    if (from.inventory.locked.has(pick.index)) return this.locked();
    const moved = this.history.record([from.inventory, to.inventory], () => quickMove(from.inventory, pick.index, to.inventory, to.start, to.start + to.size));
    if (!from.inventory.slots[pick.index]) this.picked = null;
    return moved > 0 ? 'moved' : this.refuse(from.inventory, pick.index, to, to.start, to.start + to.size);
  }

  /** "Move all like this": every other stack of the picked item goes to the quick-move destinations (favourites stay). */
  moveAll(groupId: string, index: number): SlotOutcome {
    const from = this.groups.get(groupId);
    const stack = from?.inventory.slots[index];
    if (!from || !stack) return 'none';
    if (from.inventory.locked.has(index)) return this.locked();
    const targets = this.quickTargets(from).filter((t) => t.group !== from || t.start !== from.start);
    const moved = this.history.record([from.inventory, ...targets.map((t) => t.inventory)], () =>
      moveAllOf(from.inventory, stack.item, targets.map((t) => ({ inventory: t.inventory, start: t.start, end: t.end }))),
    );
    if (this.picked && this.picked.group === groupId && !from.inventory.slots[this.picked.index]) this.picked = null;
    return moved > 0 ? 'moved' : 'refused';
  }

  /**
   * Spreads the picked stack over several slots (the drag): even shares over the empty or matching ones, in order.
   * Nothing moves when no target can take any of it; the stack stays where it was picked from.
   */
  spread(targets: readonly { group: string; index: number }[]): SlotOutcome {
    const pick = this.picked;
    const source = pick ? this.groups.get(pick.group) : undefined;
    if (!pick || !source || !source.inventory.slots[pick.index] || pick.half) return 'none';
    if (source.inventory.locked.has(pick.index)) return this.locked();
    const resolved: SlotTarget[] = [];
    for (const t of targets) {
      const g = this.groups.get(t.group);
      if (g) resolved.push({ inventory: g.inventory, slot: t.index });
    }
    const moved = this.history.record([source.inventory, ...resolved.map((r) => r.inventory)], () => distributeStack(source.inventory, pick.index, resolved));
    if (!source.inventory.slots[pick.index]) this.picked = null;
    return moved > 0 ? 'moved' : 'refused';
  }

  /** Whether the picked stack could be spread into this slot (a drag target). */
  canSpread(groupId: string, index: number): boolean {
    const pick = this.picked;
    const source = pick ? this.groups.get(pick.group) : undefined;
    const target = this.groups.get(groupId);
    const stack = pick && source ? source.inventory.slots[pick.index] : null;
    if (!pick || pick.half || !target || !stack || (pick.group === groupId && pick.index === index)) return false;
    if (!target.inventory.accepts(stack.item, index)) return false;
    const there = target.inventory.slots[index];
    return !there || canMerge(there, stack);
  }

  /** How many items "Gather matching" would pull into this slot right now (0: no button). */
  gatherCount(groupId: string, index: number): number {
    const g = this.groups.get(groupId);
    if (!g || !g.inventory.slots[index]) return 0;
    const [start, end] = this.rangeOf(g, index);
    return gatherable(g.inventory, index, start, end);
  }

  /** Gathers every matching stack of the item into this slot, within its section (the pocket, the hotbar). */
  gather(groupId: string, index: number): SlotOutcome {
    const g = this.groups.get(groupId);
    if (!g || !g.inventory.slots[index]) return 'none';
    if (g.inventory.locked.has(index)) return this.locked();
    const [start, end] = this.rangeOf(g, index);
    const moved = this.history.record([g.inventory], () => gatherMatching(g.inventory, index, start, end));
    if (moved > 0) return 'moved';
    this.refusal = 'Nothing else like this to gather here';
    return 'refused';
  }

  /** Locks or unlocks a slot of the bag. Returns whether it is locked now (null when there is no such group). */
  lock(groupId: string, index: number): boolean | null {
    const g = this.groups.get(groupId);
    return g ? toggleLock(g.inventory, index) : null;
  }

  /** Sews the Belt Pouch in this slot into the bag: one pocket more. */
  sewPocket(groupId: string, index: number): SlotOutcome {
    const g = this.groups.get(groupId);
    if (!g || !g.inventory.slots[index]) return 'none';
    if (sewPocket(g.inventory, index)) {
      if (this.picked && this.picked.group === groupId && !g.inventory.slots[index]) this.picked = null;
      return 'moved';
    }
    this.refusal = canAddPocket(pocketsOf(g.inventory)) ? 'No pocket can be cut from the pack' : 'The pack already has all its pockets';
    return 'refused';
  }

  /** One step back: the last move of the bag. */
  undo(): SlotOutcome {
    if (!this.history.undo()) return 'none';
    this.validate();
    return 'moved';
  }

  /** Quick-move destinations of a group, resolved to inventory ranges. */
  quickTargets(from: Group): { group: Group; inventory: Inventory; start: number; end: number }[] {
    const specs: readonly QuickTarget[] =
      from.quickTo ??
      (() => {
        const others = [...this.groups.values()].filter((g) => g.inventory !== from.inventory).map((g) => g.id);
        return others.length > 0 ? others : [...this.groups.values()].filter((g) => g !== from).map((g) => g.id);
      })();
    const out: { group: Group; inventory: Inventory; start: number; end: number }[] = [];
    for (const spec of specs) {
      const group = this.groups.get(typeof spec === 'string' ? spec : spec.group);
      if (!group) continue;
      if (typeof spec === 'string') out.push({ group, inventory: group.inventory, start: group.start, end: group.start + group.size });
      else out.push({ group, inventory: group.inventory, start: spec.start, end: spec.end });
    }
    return out;
  }

  /** Could the picked stack be put into this slot (drop, merge or swap)? Used to highlight targets. */
  canDrop(groupId: string, index: number): boolean {
    const pick = this.picked;
    const source = pick ? this.groups.get(pick.group) : undefined;
    const target = this.groups.get(groupId);
    const stack = pick && source ? source.inventory.slots[pick.index] : null;
    if (!pick || !source || !target || !stack || (pick.group === groupId && pick.index === index)) return false;
    if (!target.inventory.accepts(stack.item, index)) return false;
    const there = target.inventory.slots[index];
    if (!there || canMerge(there, stack)) return true;
    return !pick.half && source.inventory.accepts(there.item, pick.index);
  }

  /** Drops a pick whose slot emptied underneath it (a furnace burnt the fuel the player had picked). */
  validate(): void {
    const pick = this.picked;
    if (pick && !this.groups.get(pick.group)?.inventory.slots[pick.index]) this.picked = null;
  }

  /** The section a slot is moved within: its pocket in the bag, otherwise the group's own range. */
  private rangeOf(g: Group, index: number): [number, number] {
    const sec = g.sections?.().find((s) => index >= s.start && index < s.end);
    return sec ? [sec.start, sec.end] : [g.start, g.start + g.size];
  }

  private locked(): SlotOutcome {
    this.refusal = LOCKED_TEXT;
    return 'refused';
  }

  private refuse(from: Inventory, index: number, to: Group, start: number, end: number): SlotOutcome {
    const stack = from.slots[index];
    this.refusal = stack ? refusalText(to.inventory, stack.item, start, end, to.label) : null;
    return 'refused';
  }

  private pick(group: Group, index: number, half: boolean): SlotOutcome {
    if (!group.inventory.slots[index]) return 'none';
    this.picked = { group: group.id, index, half };
    return 'picked';
  }
}

const DOUBLE_TAP_MS = 380;
/** Two fingers down within this long of a tap make the tap a bulk move (the two-finger tap of a phone). */
const TWO_FINGER_MS = 700;
/** How far a press must travel before it is a drag rather than a tap. */
const DRAG_PX = 10;

interface Binding {
  spec: SlotGroupSpec;
  start: number;
  tips: Dispose[];
}

export interface SlotBinding {
  unbind(): void;
}

/** Lets the player's own slots drop items into the world: Q over a slot, and Drop buttons in the carry bar. */
export interface SlotDropper {
  /** Only this inventory's slots can be dropped from (the player's pack, not a crate). */
  inventory: Inventory;
  /** Drops `count` out of the slot; returns how many left. */
  drop(slot: number, count: number): number;
}

interface Cell {
  group: string;
  index: number;
}

interface Drag {
  origin: Cell;
  id: number;
  x: number;
  y: number;
  active: boolean;
  targets: Map<string, Cell>;
  off: () => void;
}

/** The DOM side: drives ItemSlots from inventories and turns their taps into SlotInteraction calls. */
export class SlotController {
  readonly logic = new SlotInteraction();
  /** Picked item, "To ..." buttons and a put-back button; hidden while nothing is picked. GameUI docks it over the
   * window footer unless the screen placed it somewhere itself. */
  readonly actionBar: HTMLDivElement;
  /** Called after every refresh (the bag's Undo button and sort toggle follow the moves). */
  readonly refreshed = new Set<() => void>();
  private readonly bus: GameBus;
  private readonly tooltip: Tooltip | null;
  private readonly bindings = new Map<string, Binding>();
  private readonly disposer = new Disposer();
  private readonly ghost: HTMLDivElement;
  private readonly ghostIcon = new ItemIcon();
  private readonly barIcon = new ItemIcon();
  private readonly barText: HTMLSpanElement;
  private readonly barNote: HTMLSpanElement;
  private readonly barMoves: HTMLDivElement;
  private barKey = '';
  private lastTap = { group: '', index: -1, at: -Infinity };
  /** Called after every move the player makes here (screens update have/need figures). */
  onChange: (() => void) | null = null;
  /** Set by GameUI: dropping from the player's pack (null: nothing can be dropped here). */
  dropper: SlotDropper | null = null;
  /** The slot under the mouse (or last touched), for the Q key. */
  private hover: { group: string; index: number } | null = null;
  private qAll = false;
  private readonly cells = new WeakMap<Element, Cell>();
  private readonly touches = new Set<number>();
  private twoFingerAt = -Infinity;
  private drag: Drag | null = null;

  /**
   * `ghostLayer` holds the icon that follows a mouse while something is picked (normally the tooltip layer);
   * `tooltip` shows item cards on hover / keyboard focus, and on touch long-press (which also picks half, as before).
   */
  constructor(bus: GameBus, ghostLayer: HTMLElement | null = null, tooltip: Tooltip | null = null) {
    this.bus = bus;
    this.tooltip = tooltip;
    this.barText = h('span', { class: 'hw-carry__name' });
    this.barNote = h('span', { class: 'hw-carry__note' });
    this.barMoves = h('div', { class: 'hw-carry__moves' });
    const cancel = new IconButton({ icon: 'close', label: 'Put it back', onClick: () => this.cancel() });
    this.actionBar = h(
      'div',
      { class: 'hw-carry', attrs: { role: 'status' } },
      this.barIcon.el,
      h('span', { class: 'hw-carry__text' }, this.barText, this.barNote),
      this.barMoves,
      cancel.el,
    );
    this.actionBar.hidden = true;
    this.ghost = h('div', { class: 'hw-slot-ghost', attrs: { 'aria-hidden': 'true' } }, this.ghostIcon.el);
    this.ghost.hidden = true;
    if (ghostLayer) {
      ghostLayer.appendChild(this.ghost);
      this.disposer.add(listen(document, 'pointermove', (ev) => this.moveGhost(ev), { passive: true }));
    }
    this.disposer.add(() => this.ghost.remove());
    // Q over a slot of the pack drops one of it; Shift+Q, or holding Q, the whole stack. Ctrl+Z steps back one move.
    this.disposer.add(listen(document, 'keydown', (ev) => this.onKey(ev)));
    this.disposer.add(
      listen(document, 'keyup', (ev) => {
        if (ev.code === 'KeyQ') this.qAll = false;
      }),
    );
    // Two fingers on the screen at once: a tap made while they are down is a bulk move (see onPrimary).
    this.disposer.add(
      listen(document, 'pointerdown', (ev) => {
        if (ev.pointerType !== 'touch') return;
        this.touches.add(ev.pointerId);
        if (this.touches.size >= 2) this.twoFingerAt = performance.now();
      }),
    );
    const release = (ev: PointerEvent): void => void this.touches.delete(ev.pointerId);
    this.disposer.add(listen(document, 'pointerup', release));
    this.disposer.add(listen(document, 'pointercancel', release));
  }

  get picked(): Readonly<SlotPick> | null {
    return this.logic.picked;
  }

  /** Whether one step of undo is waiting. */
  get canUndo(): boolean {
    return this.logic.history.canUndo;
  }

  bind(spec: SlotGroupSpec): SlotBinding {
    const start = spec.start ?? 0;
    this.logic.addGroup({ id: spec.id, label: spec.label, inventory: spec.inventory, start, size: spec.views.length, quickTo: spec.quickTo, sections: spec.sections });
    const tips: Dispose[] = [];
    this.bindings.set(spec.id, { spec, start, tips });
    spec.views.forEach((view, k) => {
      const cell: Cell = { group: spec.id, index: start + k };
      this.cells.set(view.el, cell);
      view.setHandlers({
        onPrimary: (_slot, ev) => this.onPrimary(spec.id, start + k, ev),
        onSecondary: () => this.after(this.logic.secondary(spec.id, start + k)),
      });
      tips.push(
        listen(view.el, 'pointerenter', () => (this.hover = { group: spec.id, index: start + k })),
        listen(view.el, 'pointerleave', () => {
          if (this.hover?.group === spec.id && this.hover.index === start + k) this.hover = null;
        }),
        listen(view.el, 'pointerdown', (ev) => this.dragStart(cell, ev)),
      );
      if (this.tooltip) {
        // The long-press that opens the card on touch has just picked this slot (half), so its own pick still shows it.
        const source = (): TooltipCard | null => {
          const stack = spec.inventory.slots[start + k];
          const pick = this.logic.picked;
          return stack && (!pick || (pick.group === spec.id && pick.index === start + k)) ? itemCard(stack) : null;
        };
        tips.push(this.tooltip.attach(view.el, source));
      }
    });
    this.refresh();
    return {
      unbind: () => {
        for (const off of tips) off();
        for (const view of spec.views) view.setHandlers({});
        this.bindings.delete(spec.id);
        this.logic.removeGroup(spec.id);
        this.refresh();
      },
    };
  }

  /** Re-reads every bound inventory; only slots that changed touch the DOM. */
  refresh(): void {
    this.logic.validate();
    const pick = this.logic.picked;
    for (const { spec, start } of this.bindings.values()) {
      const slots = spec.inventory.slots;
      spec.views.forEach((view, k) => {
        const i = start + k;
        view.set(slotView(slots[i]));
        view.setSelected(pick !== null && pick.group === spec.id && pick.index === i);
        view.setHighlight(pick !== null && (this.logic.canDrop(spec.id, i) || this.isDragTarget(spec.id, i)));
        view.setFavourite(isFavourite(spec.inventory, i));
        view.setLocked(spec.inventory.locked.has(i));
      });
    }
    this.renderBar();
    for (const fn of this.refreshed) fn();
  }

  cancel(): void {
    if (!this.logic.picked) return;
    this.logic.picked = null;
    this.refresh();
  }

  /** Undoes the bag's last move (Ctrl+Z, the Undo button). Returns whether anything was undone. */
  undo(): boolean {
    if (this.logic.undo() !== 'moved') return false;
    this.refresh();
    this.onChange?.();
    return true;
  }

  /** Forgets the last move (the bag closed). */
  clearHistory(): void {
    this.logic.history.clear();
  }

  dispose(): void {
    this.drag?.off();
    this.drag = null;
    for (const b of this.bindings.values()) {
      for (const off of b.tips) off();
      for (const v of b.spec.views) v.setHandlers({});
    }
    this.bindings.clear();
    this.disposer.dispose();
  }

  /** Drops from the pack slot at (group, index). Returns how many left the pack. */
  private dropFrom(group: string, index: number, all: boolean): number {
    const dropper = this.dropper;
    const g = this.logic.groups.get(group);
    if (!dropper || !g || g.inventory !== dropper.inventory) return 0;
    const stack = g.inventory.slots[index];
    if (!stack) return 0;
    if (g.inventory.locked.has(index)) {
      this.bus.emit('toast', { text: LOCKED_TEXT, kind: 'warn' });
      return 0;
    }
    const n = dropper.drop(index, all ? stack.count : 1);
    if (n > 0) {
      if (this.logic.picked && this.logic.picked.group === group && this.logic.picked.index === index && !g.inventory.slots[index]) this.logic.picked = null;
      this.refresh();
      this.onChange?.();
    }
    return n;
  }

  private onKey(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (ev.code === 'KeyZ' && (ev.ctrlKey || ev.metaKey) && !ev.shiftKey && !ev.altKey && !typing && this.logic.history.canUndo) {
      ev.preventDefault();
      this.undo();
      return;
    }
    if (ev.code !== 'KeyQ' || ev.ctrlKey || ev.metaKey || ev.altKey || !this.hover) return;
    ev.preventDefault();
    if (ev.repeat) {
      // Holding the key: the rest of the stack, once.
      if (!this.qAll) {
        this.qAll = true;
        this.dropFrom(this.hover.group, this.hover.index, true);
      }
      return;
    }
    this.dropFrom(this.hover.group, this.hover.index, ev.shiftKey);
  }

  private onPrimary(group: string, index: number, ev: Event): void {
    const now = performance.now();
    if ((ev instanceof MouseEvent && ev.shiftKey) || now - this.twoFingerAt < TWO_FINGER_MS) {
      this.logic.picked = null;
      this.after(this.logic.quickMove(group, index));
      return;
    }
    // A double tap is a tap that picked a slot, followed quickly by a second tap on the same slot (which would
    // otherwise put it back): the second tap sends the stack to the other inventory instead.
    const last = this.lastTap;
    this.lastTap = { group: '', index: -1, at: -Infinity };
    if (last.group === group && last.index === index && now - last.at < DOUBLE_TAP_MS) {
      this.logic.picked = null;
      this.after(this.logic.quickMove(group, index));
      return;
    }
    const outcome = this.logic.primary(group, index);
    if (outcome === 'picked') this.lastTap = { group, index, at: now };
    this.after(outcome);
  }

  /**
   * A press on the held slot starts a drag. Nothing moves while it is dragged: on release over one or more empty or
   * matching slots the stack is spread over them; released anywhere else it simply stays in its origin slot.
   */
  private dragStart(origin: Cell, ev: PointerEvent): void {
    const pick = this.logic.picked;
    if (!pick || pick.half || pick.group !== origin.group || pick.index !== origin.index || ev.button > 0) return;
    const off = [
      listen(document, 'pointermove', (e) => this.dragMove(e), { passive: true }),
      listen(document, 'pointerup', (e) => this.dragEnd(e)),
      listen(document, 'pointercancel', (e) => this.dragEnd(e)),
    ];
    this.drag = { origin, id: ev.pointerId, x: ev.clientX, y: ev.clientY, active: false, targets: new Map(), off: () => off.forEach((f) => f()) };
  }

  private dragMove(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.id) return;
    if (!d.active) {
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < DRAG_PX) return;
      d.active = true;
    }
    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.hw-slot') ?? null;
    const cell = el ? this.cells.get(el) : undefined;
    if (!cell || !this.logic.canSpread(cell.group, cell.index)) return;
    const key = `${cell.group}|${cell.index}`;
    if (d.targets.has(key)) return;
    d.targets.set(key, cell);
    this.refresh();
  }

  private dragEnd(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.id) return;
    this.drag = null;
    d.off();
    if (!d.active) return; // a plain tap: the click does the work
    // The release that ends a drag must not also click the slot it ends on.
    const stop = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    if (d.targets.size === 0) {
      this.refresh();
      return;
    }
    this.after(this.logic.spread([...d.targets.values()]));
  }

  private isDragTarget(groupId: string, index: number): boolean {
    return this.drag?.active === true && this.drag.targets.has(`${groupId}|${index}`);
  }

  private after(outcome: SlotOutcome): void {
    if (outcome === 'none') return;
    const why = outcome === 'refused' ? this.logic.refusal : null;
    this.logic.refusal = null;
    if (why) this.bus.emit('toast', { text: why, kind: 'warn' });
    this.bus.emit('sfx', { name: outcome === 'refused' ? 'error' : 'ui_click', volume: outcome === 'moved' ? 1 : 0.6 });
    this.refresh();
    if (outcome === 'moved') this.onChange?.();
  }

  private renderBar(): void {
    const pick = this.logic.picked;
    const group = pick ? this.logic.groups.get(pick.group) : undefined;
    const stack = pick && group ? group.inventory.slots[pick.index] : null;
    this.actionBar.hidden = !stack;
    this.ghost.hidden = !stack || this.ghost.dataset.mouse === undefined;
    if (!pick || !group || !stack) {
      this.barKey = '';
      return;
    }
    const name = itemOrNull(stack.item) ? stackName(stack) : stack.item;
    const amount = pick.half ? Math.ceil(stack.count / 2) : stack.count;
    setText(this.barText, `${amount > 1 ? `${amount} ` : ''}${name}${pick.half ? ' (half)' : ''}`);
    // Touch has no item card: the carry bar is where a phone player learns what a food restores.
    const food = foodLine(stack.item);
    const locked = group.inventory.locked.has(pick.index);
    const note = [food, locked ? 'Locked: sorting, moves and drops skip this slot' : null].filter(Boolean).join(' - ');
    setText(this.barNote, note);
    this.barNote.hidden = note === '';
    this.barIcon.set(stack.item);
    this.ghostIcon.set(stack.item);
    const targets = this.logic.quickTargets(group).filter((t) => t.group !== group || t.start !== group.start);
    const bag = this.dropper !== null && group.inventory === this.dropper.inventory;
    const canDrop = bag;
    const fav = isFavourite(group.inventory, pick.index);
    const gather = this.logic.gatherCount(group.id, pick.index);
    const sew = bag && stack.item === POUCH_ITEM && canAddPocket(pocketsOf(group.inventory));
    const key = [
      pick.group,
      pick.index,
      stack.item,
      targets.map((t) => t.group.id).join(','),
      canDrop ? (stack.count > 1 ? 2 : 1) : 0,
      fav ? 1 : 0,
      locked ? 1 : 0,
      gather > 0 ? 1 : 0,
      sew ? 1 : 0,
      group.inventory.count(stack.item) > stack.count ? 1 : 0,
    ].join('|');
    if (key === this.barKey) return;
    this.barKey = key;
    const seen = new Set<string>();
    const buttons: HTMLElement[] = [];
    if (!locked) {
      for (const t of targets) {
        if (seen.has(t.group.id)) continue;
        seen.add(t.group.id);
        let accepts = false;
        for (let i = t.start; i < t.end && !accepts; i++) accepts = t.inventory.accepts(stack.item, i);
        if (!accepts) continue;
        const id = t.group.id;
        buttons.push(new Button({ label: `To ${t.group.label}`, size: 'sm', onClick: () => this.after(this.logic.sendPicked(id)) }).el);
      }
      if (buttons.length > 0 && group.inventory.count(stack.item) > stack.count) {
        const { index } = pick;
        buttons.push(new Button({ label: 'Move all like this', size: 'sm', onClick: () => this.after(this.logic.moveAll(group.id, index)) }).el);
      }
      if (gather > 0) {
        const { index } = pick;
        buttons.push(new Button({ label: 'Gather matching', size: 'sm', onClick: () => this.after(this.logic.gather(group.id, index)) }).el);
      }
      if (sew) {
        const { index } = pick;
        buttons.push(new Button({ label: 'Sew in pocket', size: 'sm', onClick: () => this.after(this.logic.sewPocket(group.id, index)) }).el);
      }
    }
    {
      const { index: favIndex } = pick;
      buttons.push(new Button({ label: fav ? 'Unfavourite' : 'Favourite', size: 'sm', onClick: () => { toggleFavourite(group.inventory, favIndex); this.barKey = ''; this.refresh(); this.onChange?.(); } }).el);
    }
    if (bag) {
      const { index: lockIndex } = pick;
      buttons.push(new Button({ label: locked ? 'Unlock' : 'Lock', size: 'sm', onClick: () => { this.logic.lock(group.id, lockIndex); this.barKey = ''; this.refresh(); } }).el);
    }
    if (canDrop && !locked) {
      const { group: gid, index } = pick;
      buttons.push(new Button({ label: 'Drop', size: 'sm', onClick: () => this.dropFrom(gid, index, stack.count <= 1) }).el);
      if (stack.count > 1) buttons.push(new Button({ label: 'Drop all', size: 'sm', onClick: () => this.dropFrom(gid, index, true) }).el);
    }
    this.barMoves.replaceChildren(...buttons);
  }

  private moveGhost(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') {
      delete this.ghost.dataset.mouse;
      this.ghost.hidden = true;
      return;
    }
    this.ghost.dataset.mouse = '';
    this.ghost.hidden = this.logic.picked === null;
    if (!this.ghost.hidden) this.ghost.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 10}px)`;
  }
}
