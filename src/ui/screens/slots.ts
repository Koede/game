/**
 * Slot interaction, identical on every screen. Selection model: a tap PICKS a slot (its stack stays where it is,
 * highlighted), the next tap on another slot drops / merges / swaps it there. Nothing is ever held "in the air",
 * so nothing can be lost when a screen closes or a machine changes a slot underneath the player's finger.
 *
 * SlotInteraction is the DOM-free rule set (unit-tested); SlotController wires it to ItemSlots, adds the mouse
 * ghost, double-tap / shift-click quick move and the action bar with "Move to ..." buttons for touch.
 */
import type { GameBus } from '../../core/context';
import { itemOrNull } from '../../core/registry';
import { canMerge, fullDurability, type Inventory } from '../../game/inventory';
import { moveHalf, moveOne, moveStack, quickMove } from '../../game/transfer';
import { Disposer, h, listen, setText } from '../kit/dom';
import { Button, IconButton } from '../kit/controls';
import { ItemIcon } from '../kit/icons';
import type { ItemSlot, SlotView } from '../kit/slot';

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
}

/** The rules, without any DOM. Indices are inventory slot indices. */
export class SlotInteraction {
  readonly groups = new Map<string, Group>();
  picked: SlotPick | null = null;

  addGroup(spec: { id: string; label: string; inventory: Inventory; start?: number; size: number; quickTo?: readonly QuickTarget[] }): void {
    this.groups.set(spec.id, { id: spec.id, label: spec.label, inventory: spec.inventory, start: spec.start ?? 0, size: spec.size, quickTo: spec.quickTo });
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
    const moved = pick.half
      ? moveHalf(source.inventory, pick.index, target.inventory, index)
      : moveStack(source.inventory, pick.index, target.inventory, index);
    if (moved > 0) {
      this.picked = null;
      return 'moved';
    }
    // The target cannot take it (accept rules): treat the tap as choosing that slot instead, if it holds something.
    if (target.inventory.slots[index]) return this.pick(target, index, false);
    return 'refused';
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
    const moved = moveOne(source.inventory, pick.index, target.inventory, index);
    if (moved === 0) return 'refused';
    if (!source.inventory.slots[pick.index]) this.picked = null;
    return 'moved';
  }

  /** Double-tap / shift-click / the action bar: sends the stack to the group's quick-move destinations. */
  quickMove(groupId: string, index: number): SlotOutcome {
    const from = this.groups.get(groupId);
    if (!from || !from.inventory.slots[index]) return 'none';
    let moved = 0;
    for (const t of this.quickTargets(from)) {
      if (!from.inventory.slots[index]) break;
      moved += quickMove(from.inventory, index, t.inventory, t.start, t.end);
    }
    if (this.picked && this.picked.group === groupId && this.picked.index === index) this.picked = null;
    return moved > 0 ? 'moved' : 'refused';
  }

  /** Moves the picked stack to one destination group (the action bar's "Move to" buttons). */
  sendPicked(groupId: string): SlotOutcome {
    const pick = this.picked;
    const from = pick ? this.groups.get(pick.group) : undefined;
    const to = this.groups.get(groupId);
    if (!pick || !from || !to || !from.inventory.slots[pick.index]) return 'none';
    const moved = quickMove(from.inventory, pick.index, to.inventory, to.start, to.start + to.size);
    if (!from.inventory.slots[pick.index]) this.picked = null;
    return moved > 0 ? 'moved' : 'refused';
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

  private pick(group: Group, index: number, half: boolean): SlotOutcome {
    if (!group.inventory.slots[index]) return 'none';
    this.picked = { group: group.id, index, half };
    return 'picked';
  }
}

const DOUBLE_TAP_MS = 380;

interface Binding {
  spec: SlotGroupSpec;
  start: number;
}

export interface SlotBinding {
  unbind(): void;
}

/** The DOM side: drives ItemSlots from inventories and turns their taps into SlotInteraction calls. */
export class SlotController {
  readonly logic = new SlotInteraction();
  /** Picked item, "Move to ..." buttons and Cancel. Hidden while nothing is picked; place it in your layout. */
  readonly actionBar: HTMLDivElement;
  private readonly bus: GameBus;
  private readonly bindings = new Map<string, Binding>();
  private readonly disposer = new Disposer();
  private readonly ghost: HTMLDivElement;
  private readonly ghostIcon = new ItemIcon();
  private readonly barIcon = new ItemIcon();
  private readonly barText: HTMLSpanElement;
  private readonly barMoves: HTMLDivElement;
  private barKey = '';
  private lastTap = { group: '', index: -1, at: -Infinity };
  /** Called after every move the player makes here (screens update have/need figures). */
  onChange: (() => void) | null = null;

  /** `ghostLayer` holds the icon that follows a mouse while something is picked (normally the tooltip layer). */
  constructor(bus: GameBus, ghostLayer: HTMLElement | null = null) {
    this.bus = bus;
    this.barText = h('span', { class: 'hw-carry__text' });
    this.barMoves = h('div', { class: 'hw-carry__moves' });
    const cancel = new IconButton({ icon: 'close', label: 'Put it back', onClick: () => this.cancel() });
    this.actionBar = h('div', { class: 'hw-carry', attrs: { role: 'status' } }, this.barIcon.el, this.barText, this.barMoves, cancel.el);
    this.actionBar.hidden = true;
    this.ghost = h('div', { class: 'hw-slot-ghost', attrs: { 'aria-hidden': 'true' } }, this.ghostIcon.el);
    this.ghost.hidden = true;
    if (ghostLayer) {
      ghostLayer.appendChild(this.ghost);
      this.disposer.add(listen(document, 'pointermove', (ev) => this.moveGhost(ev), { passive: true }));
    }
    this.disposer.add(() => this.ghost.remove());
  }

  get picked(): Readonly<SlotPick> | null {
    return this.logic.picked;
  }

  bind(spec: SlotGroupSpec): SlotBinding {
    const start = spec.start ?? 0;
    this.logic.addGroup({ id: spec.id, label: spec.label, inventory: spec.inventory, start, size: spec.views.length, quickTo: spec.quickTo });
    this.bindings.set(spec.id, { spec, start });
    spec.views.forEach((view, k) => {
      view.setHandlers({
        onPrimary: (_slot, ev) => this.onPrimary(spec.id, start + k, ev),
        onSecondary: () => this.after(this.logic.secondary(spec.id, start + k)),
      });
    });
    this.refresh();
    return {
      unbind: () => {
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
        view.setHighlight(pick !== null && this.logic.canDrop(spec.id, i));
      });
    }
    this.renderBar();
  }

  cancel(): void {
    if (!this.logic.picked) return;
    this.logic.picked = null;
    this.refresh();
  }

  dispose(): void {
    for (const id of [...this.bindings.keys()]) this.bindings.get(id)?.spec.views.forEach((v) => v.setHandlers({}));
    this.bindings.clear();
    this.disposer.dispose();
  }

  private onPrimary(group: string, index: number, ev: Event): void {
    const now = performance.now();
    if (ev instanceof MouseEvent && ev.shiftKey) {
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

  private after(outcome: SlotOutcome): void {
    if (outcome === 'none') return;
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
    const name = itemOrNull(stack.item)?.name ?? stack.item;
    const amount = pick.half ? Math.ceil(stack.count / 2) : stack.count;
    setText(this.barText, `${amount > 1 ? `${amount} ` : ''}${name}${pick.half ? ' (half)' : ''}`);
    this.barIcon.set(stack.item);
    this.ghostIcon.set(stack.item);
    const targets = this.logic.quickTargets(group).filter((t) => t.group !== group || t.start !== group.start);
    const key = `${pick.group}|${pick.index}|${stack.item}|${targets.map((t) => t.group.id).join(',')}`;
    if (key === this.barKey) return;
    this.barKey = key;
    const seen = new Set<string>();
    const buttons: HTMLElement[] = [];
    for (const t of targets) {
      if (seen.has(t.group.id)) continue;
      seen.add(t.group.id);
      let accepts = false;
      for (let i = t.start; i < t.end && !accepts; i++) accepts = t.inventory.accepts(stack.item, i);
      if (!accepts) continue;
      const id = t.group.id;
      buttons.push(new Button({ label: `To ${t.group.label}`, size: 'sm', onClick: () => this.after(this.logic.sendPicked(id)) }).el);
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

/** How a stored stack is shown in a slot (tool wear as a 0..1 fraction). */
export function slotView(stack: { item: string; count: number; durability?: number } | null | undefined): SlotView | null {
  if (!stack) return null;
  const full = stack.durability !== undefined ? fullDurability(stack.item) : undefined;
  return {
    item: stack.item,
    count: stack.count,
    durability: full && stack.durability !== undefined ? stack.durability / full : undefined,
    name: itemOrNull(stack.item)?.name,
  };
}
