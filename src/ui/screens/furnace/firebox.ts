/**
 * The FIREBOX panel, visible whatever tab is open: the big thermometer, the live flame, fuel slots with the burn
 * bar, Light / Douse, the PUMP button for the bellows, the electric heating switch (tier 3+), the one-line
 * status, and "Rest until dawn" at night.
 *
 * On a phone (the screen sets data-compact on its layout) the panel folds to a strip - temperature, a small flame,
 * the fuel slots, Pump (or Light) and the status - so the tabs keep the room; a tap on the strip or its chevron
 * unfolds the whole panel. furnace.css lays both out.
 */
import type { GameBus } from '../../../core/context';
import type { RecipeDef } from '../../../core/types';
import type { GameClock } from '../../../game/clock';
import type { PlayerState } from '../../../game/playerState';
import type { FurnaceSlots, FurnaceView } from '../../../sim';
import { Button, Toggle } from '../../kit/controls';
import { h, setAttr, setFlag, setText } from '../../kit/dom';
import { glyph } from '../../kit/icons';
import type { Inventory } from '../../../game/inventory';
import { formatWatts } from '../../kit/format';
import { Meter, Thermometer } from '../../kit/gauges';
import { SlotGrid } from '../../kit/slot';
import type { QuickTarget, SlotBinding, SlotController } from '../slots';
import { Flame } from './flame';
import { bestFuelSlot, burnFraction, fuelLoadCount, burnText, flameLook, statusTone, thermoNotches } from './furnaceText';
import { fuelQueueHint } from './fuelText';
import { pretty, type ScreenSim } from './simApi';

export interface FireboxDeps {
  sim: ScreenSim;
  pos: { x: number; y: number; z: number };
  bus: GameBus;
  player: PlayerState;
  clock: GameClock;
  slots: SlotController;
  /** Where quick move sends fuel taken out of the firebox (the player's bag). */
  toBag: readonly QuickTarget[];
  /** After any action: refresh the screen on the next frame. */
  changed: () => void;
  /** "Add fuel" leaves logs alone (the goal is baking them into charcoal). */
  spareSmeltable: () => boolean;
}

/** Whether the phone strip is unfolded (kept for the session). */
let rememberOpen = false;

/** One word under the temperature: where it is heading. */
export const trendText = (view: FurnaceView): string =>
  view.ignited ? 'Held by the star' : view.trend === 'rising' ? 'Rising' : view.trend === 'falling' ? 'Falling' : 'Steady';

/** The one button worth pressing next (the firebox highlights it): fuel, then light, then the bellows. */
export type NextAction = 'fuel' | 'light' | 'pump' | null;
export function nextAction(view: FurnaceView, packHasFuel: boolean): NextAction {
  if (view.ignited) return null;
  if (!view.lit) return view.fuelItems > 0 || packHasFuel ? 'light' : null;
  return view.tempC < view.targetC - 25 && view.draft < 0.5 ? 'pump' : null;
}

export class FireboxPanel {
  readonly el: HTMLElement;
  private readonly deps: FireboxDeps;
  private readonly thermo: Thermometer;
  private readonly flame = new Flame();
  private readonly fuelHost: HTMLDivElement;
  private readonly burn: Meter;
  private readonly lightBtn: Button;
  private readonly pumpBtn: Button;
  private readonly addFuel: Button;
  private readonly elecRow: HTMLDivElement;
  private readonly elecToggle: Toggle;
  private readonly elecMeter: Meter;
  private readonly statusEl: HTMLParagraphElement;
  private readonly hintEl: HTMLParagraphElement;
  private readonly foldBtn: HTMLButtonElement;
  private readonly restBtn: Button;
  private fuelInv: Inventory | null = null;
  private fuelGrid: SlotGrid | null = null;
  private fuelBinding: SlotBinding | null = null;
  private fuelSize = -1;
  private notchKey = '';
  private lit = false;
  private ignited = false;
  private maxC = 0;

  constructor(deps: FireboxDeps) {
    this.deps = deps;
    const { sim, pos } = deps;
    this.thermo = new Thermometer({ min: 0, max: 800, value: 20 });
    this.fuelHost = h('div', { class: 'hw-fbx__fuelslots' });
    this.burn = new Meter({ label: 'Firebox', tone: 'heat', value: 0, max: 1, text: '' });
    this.addFuel = new Button({ label: 'Add fuel', icon: 'flame', kind: 'quiet', size: 'sm', onClick: () => this.loadFuel() });
    this.addFuel.el.setAttribute('aria-label', 'Add fuel from your pack');
    this.addFuel.el.title = 'Add fuel from your pack';
    this.lightBtn = new Button({ label: 'Light', kind: 'primary', onClick: () => this.lightOrDouse() });
    this.lightBtn.el.classList.add('hw-fbx__light');
    const keys = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
    this.pumpBtn = new Button({ label: 'Pump', kind: 'primary', size: 'lg', hint: keys ? 'Bellows (P)' : 'Bellows', onClick: () => this.pump() });
    this.pumpBtn.el.classList.add('hw-fbx__pump');
    this.elecToggle = new Toggle({
      label: 'Electric heating',
      tone: 'power',
      onText: 'Electric on',
      offText: 'Electric off',
      onChange: (on) => this.report(sim.setElectric(pos.x, pos.y, pos.z, on)),
    });
    this.elecMeter = new Meter({ label: '', tone: 'power', value: 0, max: 1 });
    this.elecRow = h(
      'div',
      { class: 'hw-fbx__elec' },
      this.elecToggle.el,
      this.elecMeter.el,
    );
    this.statusEl = h('p', { class: 'hw-fbx__status', attrs: { role: 'status' } });
    this.hintEl = h('p', { class: 'hw-fbx__hint' });
    this.hintEl.hidden = true;
    this.foldBtn = h(
      'button',
      { class: 'hw-fbx__fold', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Show the whole firebox' } },
      glyph('chevron', 14),
    );
    this.foldBtn.addEventListener('click', () => this.setOpen(!this.open));
    this.restBtn = new Button({ label: 'Rest until dawn', kind: 'quiet', size: 'sm', block: true, onClick: () => this.rest() });
    this.el = h(
      'section',
      { class: 'hw-fbx', attrs: { 'aria-label': 'Firebox' } },
      h('div', { class: 'hw-fbx__thermo' }, this.thermo.el),
      h(
        'div',
        { class: 'hw-fbx__controls' },
        h('div', { class: 'hw-fbx__mouth' }, this.flame.el),
        h('div', { class: 'hw-fbx__fuel' }, this.fuelHost, this.addFuel.el),
        this.burn.el,
        h('div', { class: 'hw-fbx__btns' }, this.lightBtn.el, this.pumpBtn.el),
        this.elecRow,
      ),
      this.statusEl,
      this.hintEl,
      this.restBtn.el,
      this.foldBtn,
    );
    // On the folded strip, a tap on the temperature or the flame unfolds the panel (CSS shows the strip only).
    for (const part of [this.el.querySelector('.hw-fbx__thermo'), this.el.querySelector('.hw-fbx__mouth')]) {
      part?.addEventListener('click', () => {
        if (!this.open && this.el.closest('[data-compact]')) this.setOpen(true);
      });
    }
    this.setOpen(rememberOpen);
    this.flame.start();
  }

  /** (Re)binds the fuel slots; called on open and whenever the tier changes the slot count. */
  bindSlots(slots: FurnaceSlots): void {
    if (slots.fuel.size === this.fuelSize) return;
    this.fuelSize = slots.fuel.size;
    this.fuelBinding?.unbind();
    this.fuelGrid?.dispose();
    const grid = new SlotGrid({ count: slots.fuel.size, columns: slots.fuel.size, label: 'Fuel', minSlotPx: 44 });
    grid.slots.forEach((s, i) => s.el.setAttribute('aria-label', `Fuel slot ${i + 1}`));
    for (const s of grid.slots) s.el.querySelector('.hw-slot__hint')?.remove();
    this.fuelGrid = grid;
    this.fuelInv = slots.fuel;
    this.fuelHost.replaceChildren(grid.el);
    this.fuelBinding = this.deps.slots.bind({ id: 'fuel', label: 'Firebox', inventory: slots.fuel, views: grid.slots, quickTo: this.deps.toBag });
  }

  update(view: FurnaceView, selected: RecipeDef | null): void {
    if (view.maxTempC !== this.maxC) {
      this.maxC = view.maxTempC;
      this.thermo.setRange(0, view.maxTempC);
    }
    this.thermo.set(view.tempC);
    this.thermo.setCaption(trendText(view));
    const notches = thermoNotches(view, selected);
    const key = JSON.stringify(notches);
    if (key !== this.notchKey) {
      this.notchKey = key;
      this.thermo.setNotches(notches);
    }
    this.flame.set(flameLook(view));

    const [burnLabel, burnReading] = burnText(view);
    this.burn.setLabel(burnLabel);
    this.burn.set(burnFraction(view), 1, burnReading);
    this.ignited = view.ignited;
    this.lit = view.lit;
    this.lightBtn.el.hidden = view.ignited;
    this.pumpBtn.el.hidden = view.ignited;
    this.addFuel.el.hidden = view.ignited;
    if (view.lit) {
      this.lightBtn.setLabel('Douse');
      this.lightBtn.setKind('quiet');
      this.lightBtn.setDisabled(false);
    } else {
      this.lightBtn.setLabel('Light');
      this.lightBtn.setKind('primary');
      // Light also loads fuel from the pack when the firebox is empty: one tap from a cold start.
      this.lightBtn.setDisabled(view.fuelItems === 0 && !this.packHasFuel(), 'No fuel');
    }
    this.pumpBtn.setDisabled(!view.lit && !view.hot, 'Not lit');

    this.elecRow.hidden = !view.electric.available || view.ignited;
    if (view.electric.available) {
      const e = view.electric;
      this.elecToggle.set(e.on);
      this.elecMeter.setLabel(!e.on ? 'Switched off' : !e.networked ? 'No network' : `${formatWatts(e.deliveredW)} in`);
      this.elecMeter.set(e.on && e.networked ? e.satisfaction : 0, 1);
      this.elecMeter.setTone(e.on && e.demandW > 0 && e.satisfaction < 0.999 ? 'warn' : 'power');
    }

    const next = nextAction(view, this.packHasFuel());
    setAttr(this.lightBtn.el, 'data-next', next === 'light' ? 'true' : null);
    setAttr(this.pumpBtn.el, 'data-next', next === 'pump' ? 'true' : null);
    setAttr(this.el, 'data-next', next);

    setText(this.statusEl, pretty(view.status));
    setAttr(this.statusEl, 'data-tone', statusTone(view));
    const hint = this.fuelInv && !view.ignited ? fuelQueueHint(view.burnItem, this.fuelInv.slots) : null;
    setText(this.hintEl, hint ?? '');
    this.hintEl.hidden = hint === null;
    setFlag(this.el, 'lit', view.lit);
    this.restBtn.el.hidden = !this.deps.clock.isNight;
    this.restBtn.setDisabled(!view.canRest.ok, view.canRest.ok ? '' : pretty(view.canRest.reason));
  }

  get open(): boolean {
    return this.el.hasAttribute('data-open');
  }

  /** Unfolds (or folds back) the phone strip. Wider layouts always show the whole panel. */
  setOpen(open: boolean): void {
    rememberOpen = open;
    setFlag(this.el, 'open', open);
    setAttr(this.foldBtn, 'aria-expanded', String(open));
    setAttr(this.foldBtn, 'aria-label', open ? 'Fold the firebox to a strip' : 'Show the whole firebox');
  }

  /** The bellows (also bound to the P key by the screen). */
  pump(): void {
    if (this.ignited) return;
    const { sim, pos } = this.deps;
    const result = sim.pump(pos.x, pos.y, pos.z);
    if (!result.ok) {
      this.report(result);
      return;
    }
    this.flame.pump();
    const el = this.pumpBtn.el;
    el.removeAttribute('data-kick');
    void el.offsetWidth;
    el.setAttribute('data-kick', '');
    try {
      navigator.vibrate?.(18);
    } catch {
      // Vibration is optional (and refused inside some frames).
    }
    this.deps.changed();
  }

  dispose(): void {
    this.fuelBinding?.unbind();
    this.fuelGrid?.dispose();
    this.flame.dispose();
    this.thermo.dispose();
    for (const b of [this.lightBtn, this.pumpBtn, this.addFuel, this.restBtn]) b.dispose();
  }

  private lightOrDouse(): void {
    const { sim, pos } = this.deps;
    if (this.lit) {
      this.report(sim.douse(pos.x, pos.y, pos.z));
      return;
    }
    // Nothing in the firebox: take the cheapest sensible fuel from the pack first, so Light is the whole job.
    const slots = sim.furnaceSlots(pos.x, pos.y, pos.z);
    if (slots && slots.fuel.slots.every((s) => s === null)) this.loadFuel();
    this.report(sim.light(pos.x, pos.y, pos.z));
  }

  private packHasFuel(): boolean {
    return bestFuelSlot(this.deps.player.inventory.slots, { spareSmeltable: this.deps.spareSmeltable(), maxTempC: this.maxC || undefined }) >= 0;
  }

  /** One tap: about two minutes of the cheapest sensible fuel, never the logs the charcoal goal needs (unless nothing else burns). */
  private loadFuel(): void {
    const { sim, pos, player, bus } = this.deps;
    const slots = sim.furnaceSlots(pos.x, pos.y, pos.z);
    const bag = player.inventory;
    const from = bestFuelSlot(bag.slots, { spareSmeltable: this.deps.spareSmeltable(), maxTempC: this.maxC || undefined });
    const stack = from >= 0 ? bag.slots[from] : null;
    if (!slots || !stack) {
      this.report({ ok: false, reason: 'Nothing in your pack burns - logs, planks, sticks, charcoal or coal' });
      return;
    }
    const want = fuelLoadCount(stack.item, stack.count);
    const moved = bag.batch(() =>
      slots.fuel.batch(() => {
        const n = want - slots.fuel.add(stack.item, want, stack.durability);
        if (n > 0) bag.removeAt(from, n);
        return n;
      }),
    );
    if (moved === 0) this.report({ ok: false, reason: 'The firebox is full - it holds other fuel' });
    else {
      bus.emit('sfx', { name: 'fuel_add' });
      this.deps.changed();
    }
  }

  private rest(): void {
    const { sim, pos } = this.deps;
    this.report(sim.rest(pos.x, pos.y, pos.z));
  }

  private report(result: { ok: true } | { ok: false; reason: string }): void {
    if (!result.ok) {
      this.deps.bus.emit('toast', { text: pretty(result.reason), kind: 'warn' });
      this.deps.bus.emit('sfx', { name: 'error' });
    }
    this.deps.changed();
  }
}
