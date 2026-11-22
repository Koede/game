/**
 * The SMELT tab: one row per crucible (input slot, recipe and progress, required temperature, output slot), then
 * every smelt recipe of the game as a reference list with a one-tap Load button.
 */
import type { GameBus } from '../../../core/context';
import { recipe as recipeById } from '../../../core/registry';
import type { Inventory } from '../../../game/inventory';
import { quickMove } from '../../../game/transfer';
import { MOLTEN_WINDOW_S } from '../../../core/constants';
import type { Slot } from '../../../core/types';
import type { CrucibleView, FurnaceSlots, FurnaceView } from '../../../sim';
import { h, prefersReducedMotion, setAttr, setText } from '../../kit/dom';
import { heatColor } from '../../kit/format';
import { Button } from '../../kit/controls';
import { Badge, Meter } from '../../kit/gauges';
import { ItemSlot } from '../../kit/slot';
import type { QuickTarget, SlotBinding, SlotController } from '../slots';
import { castView, choicesKey } from './castText';
import { nameOf } from './forgeRows';
import { clockText, slotOf } from './furnaceText';
import { pretty } from './simApi';

interface CrucibleRow {
  el: HTMLElement;
  pour: HTMLDivElement;
  moltenMeter: Meter;
  pourButtons: HTMLDivElement;
  pourHint: HTMLParagraphElement;
  buttons: Button[];
  choices: string;
  input: ItemSlot;
  output: ItemSlot;
  name: HTMLSpanElement;
  badge: Badge;
  meter: Meter;
}

const crucibleState = (c: CrucibleView): string =>
  c.moltenS > 0 ? 'molten' : c.active ? 'active' : c.status.startsWith('Needs') && c.requiredC !== null ? 'cold' : c.output && !c.input ? 'done' : c.input ? 'blocked' : 'idle';

export class SmeltTab {
  readonly el: HTMLElement;
  private readonly slots: SlotController;
  private readonly toBag: readonly QuickTarget[];
  private readonly bus: GameBus;
  private readonly sources: () => readonly Inventory[];
  private readonly crucibleHost: HTMLDivElement;
  private rows: CrucibleRow[] = [];
  private bindings: SlotBinding[] = [];
  private furnaceSlots: FurnaceSlots | null = null;
  private readonly pour: (index: number, key: string) => void;

  constructor(opts: {
    slots: SlotController; toBag: readonly QuickTarget[]; bus: GameBus; sources: () => readonly Inventory[]; changed: () => void;
    /** Pours crucible `index` into the mould (or alloy pot ingot) `key`; says why not through a toast. */
    pour: (index: number, key: string) => void;
  }) {
    this.pour = opts.pour;
    this.slots = opts.slots;
    this.toBag = opts.toBag;
    this.bus = opts.bus;
    this.sources = opts.sources;
    this.crucibleHost = h('div', { class: 'hw-cru-list' });
    this.el = h(
      'div',
      { class: 'hw-smelt' },
      this.crucibleHost,
    );
  }

  /** (Re)builds the crucible rows when their number changes (furnace upgrade). */
  bindSlots(slots: FurnaceSlots): void {
    this.furnaceSlots = slots;
    if (slots.crucibleIn.size === this.rows.length) return;
    for (const b of this.bindings) b.unbind();
    for (const row of this.rows) {
      row.input.dispose();
      row.output.dispose();
      for (const b of row.buttons) b.dispose();
    }
    this.rows = [];
    for (let i = 0; i < slots.crucibleIn.size; i++) this.rows.push(this.buildRow(i));
    this.crucibleHost.replaceChildren(...this.rows.map((r) => r.el));
    this.bindings = [
      this.slots.bind({ id: 'cru-in', label: 'Crucible', inventory: slots.crucibleIn, views: this.rows.map((r) => r.input), quickTo: this.toBag }),
      this.slots.bind({ id: 'cru-out', label: 'Crucible out', inventory: slots.crucibleOut, views: this.rows.map((r) => r.output), quickTo: this.toBag }),
    ];
  }

  update(view: FurnaceView): void {
    const pack = this.sources()[0]?.slots ?? [];
    view.crucibles.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      setAttr(row.el, 'data-state', crucibleState(c));
      setText(row.name, c.recipe ? nameOf(c.recipe.output.item) : c.input ? nameOf(c.input.item) : `Crucible ${i + 1}`);
      row.badge.el.hidden = c.requiredC === null;
      if (c.requiredC !== null) {
        row.badge.update({ text: `${c.requiredC} °C`, tone: 'heat', met: view.tempC >= c.requiredC, swatch: heatColor(c.requiredC) });
      }
      row.meter.setLabel(c.active ? 'Smelting' : pretty(c.status));
      row.meter.setTone(c.active ? 'heat' : crucibleState(c) === 'cold' ? 'warn' : crucibleState(c) === 'done' ? 'good' : 'neutral');
      row.meter.set(c.progress, 1, c.active ? clockText(c.secondsLeft) : '');
      this.updatePour(row, i, c, pack);
    });
  }

  dispose(): void {
    for (const b of this.bindings) b.unbind();
    for (const row of this.rows) {
      row.input.dispose();
      row.output.dispose();
      for (const b of row.buttons) b.dispose();
    }
  }

  private buildRow(i: number): CrucibleRow {
    const input = new ItemSlot({ size: 'lg', hint: 'In', label: `Crucible ${i + 1} input` });
    const output = new ItemSlot({ size: 'lg', hint: 'Out', label: `Crucible ${i + 1} output` });
    const name = h('span', { class: 'hw-cru__name' });
    const badge = new Badge({ text: '', tone: 'heat' });
    const meter = new Meter({ label: 'Empty', tone: 'neutral', value: 0, max: 1, text: '' });
    const moltenMeter = new Meter({ label: 'Molten', tone: 'heat', value: 0, max: MOLTEN_WINDOW_S, text: '' });
    const pourButtons = h('div', { class: 'hw-cru__pourbtns' });
    const pourHint = h('p', { class: 'hw-cru__hint' });
    const pour = h('div', { class: 'hw-cru__pour' }, moltenMeter.el, pourButtons, pourHint);
    pour.hidden = true;
    const el = h(
      'article',
      { class: 'hw-cru' },
      input.el,
      h('div', { class: 'hw-cru__body' }, h('div', { class: 'hw-cru__top' }, name, badge.el), meter.el),
      h('span', { class: 'hw-cru__arrow', attrs: { 'aria-hidden': 'true' } }),
      output.el,
      pour,
    );
    return { el, input, output, name, badge, meter, pour, moltenMeter, pourButtons, pourHint, buttons: [], choices: '' };
  }

  /** The molten countdown and the pour buttons of one crucible (rebuilt only when the choices change). */
  private updatePour(row: CrucibleRow, index: number, c: CrucibleView, pack: readonly Slot[]): void {
    const cast = castView(c, pack);
    row.pour.hidden = !cast.show;
    setAttr(row.el, 'data-molten', cast.molten ? 'true' : null);
    if (!cast.show) return;
    row.moltenMeter.setLabel(cast.meterLabel);
    row.moltenMeter.setTone(cast.molten ? 'heat' : 'neutral');
    row.moltenMeter.set(cast.molten ? cast.left : 0, cast.window, cast.meterText);
    setText(row.pourHint, cast.hint);
    const key = choicesKey(cast.choices);
    if (key !== row.choices) {
      row.choices = key;
      for (const b of row.buttons) b.dispose();
      row.buttons = cast.choices.map((choice) => new Button({
        label: choice.label, hint: choice.sub, kind: cast.molten ? 'primary' : 'default', size: 'md', block: true,
        onClick: () => this.pour(index, choice.key),
      }));
      cast.choices.forEach((choice, k) => row.buttons[k].setDisabled(!choice.enabled, choice.sub));
      row.pourButtons.replaceChildren(...row.buttons.map((b) => b.el));
    }
  }

  /** Load: a stack of the recipe's input from the pack (or a nearby crate) into the crucibles. */
  load(recipeId: string): void {
    const target = this.furnaceSlots?.crucibleIn;
    const item = recipeById(recipeId)?.inputs[0].item;
    if (!target || !item) return;
    for (const inv of this.sources()) {
      const from = slotOf(inv.slots, item);
      if (from < 0) continue;
      if (quickMove(inv, from, target) > 0) {
        this.bus.emit('sfx', { name: 'fuel_add' });
        // Show the crucible that took it: the list is below the crucibles.
        const pane = this.el.parentElement;
        if (pane && pane.scrollTop > 0) pane.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        return;
      }
      break;
    }
    this.bus.emit('toast', { text: `No free crucible for ${nameOf(item)} - take something out first`, kind: 'warn' });
    this.bus.emit('sfx', { name: 'error' });
  }
}
