/**
 * The FIREBOX panel, visible whatever tab is open: the big thermometer, the live flame, fuel slots with the burn
 * bar, Light / Douse, the PUMP button for the bellows, the electric heating switch (tier 3+), the one-line
 * status, and "Rest until dawn" at night.
 */
import type { GameBus } from '../../../core/context';
import type { RecipeDef } from '../../../core/types';
import type { GameClock } from '../../../game/clock';
import type { PlayerState } from '../../../game/playerState';
import { quickMove } from '../../../game/transfer';
import type { FurnaceSlots, FurnaceView } from '../../../sim';
import { Button, Toggle } from '../../kit/controls';
import { h, setAttr, setText } from '../../kit/dom';
import { formatPercent, formatTemp, formatWatts } from '../../kit/format';
import { Meter, Thermometer } from '../../kit/gauges';
import { SlotGrid } from '../../kit/slot';
import type { QuickTarget, SlotBinding, SlotController } from '../slots';
import { Flame } from './flame';
import { bestFuelSlot, burnFraction, burnText, flameLook, statusTone, thermoNotches } from './furnaceText';
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
}

/** Readings listed under the controls where there is room (desktop). */
const FACTS = ['Flame', 'Heading for', 'Tier maximum', 'Heat to machines'];

const trendText = (view: FurnaceView): string => {
  if (view.ignited) return 'Held by the star';
  const rate = Math.abs(view.rateCPerS);
  const r = rate >= 10 ? rate.toFixed(0) : rate.toFixed(1);
  return view.trend === 'rising' ? `Rising ${r} °C/s` : view.trend === 'falling' ? `Falling ${r} °C/s` : 'Steady';
};

export class FireboxPanel {
  readonly el: HTMLElement;
  private readonly deps: FireboxDeps;
  private readonly thermo: Thermometer;
  private readonly flame = new Flame();
  private readonly draftEl: HTMLSpanElement;
  private readonly fuelHost: HTMLDivElement;
  private readonly burn: Meter;
  private readonly lightBtn: Button;
  private readonly pumpBtn: Button;
  private readonly addFuel: Button;
  private readonly elecRow: HTMLDivElement;
  private readonly elecToggle: Toggle;
  private readonly elecMeter: Meter;
  private readonly facts: HTMLDListElement;
  private readonly factValues: HTMLElement[] = [];
  private readonly statusEl: HTMLParagraphElement;
  private readonly restBtn: Button;
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
    this.draftEl = h('span', { class: 'hw-fbx__draft hw-num' });
    this.fuelHost = h('div', { class: 'hw-fbx__fuelslots' });
    this.burn = new Meter({ label: 'Firebox', tone: 'heat', value: 0, max: 1, text: '' });
    this.addFuel = new Button({ label: 'Add fuel', kind: 'quiet', size: 'sm', onClick: () => this.loadFuel() });
    this.lightBtn = new Button({ label: 'Light', kind: 'primary', onClick: () => this.lightOrDouse() });
    this.pumpBtn = new Button({ label: 'Pump', kind: 'primary', size: 'lg', hint: 'Bellows', onClick: () => this.pump() });
    this.pumpBtn.el.classList.add('hw-fbx__pump');
    this.elecToggle = new Toggle({
      label: 'Electric heating',
      tone: 'power',
      onChange: (on) => this.report(sim.setElectric(pos.x, pos.y, pos.z, on)),
    });
    this.elecMeter = new Meter({ label: '', tone: 'power', value: 0, max: 1 });
    this.elecRow = h(
      'div',
      { class: 'hw-fbx__elec' },
      h('div', { class: 'hw-fbx__elechead' }, h('span', { class: 'hw-fbx__eleclabel', text: 'Electric' }), this.elecToggle.el),
      this.elecMeter.el,
    );
    this.facts = h(
      'dl',
      { class: 'hw-fbx__facts' },
      FACTS.map((label) => {
        const value = h('dd', { class: 'hw-num' });
        this.factValues.push(value);
        return h('div', null, h('dt', { text: label }), value);
      }),
    );
    this.statusEl = h('p', { class: 'hw-fbx__status', attrs: { role: 'status' } });
    this.restBtn = new Button({ label: 'Rest until dawn', kind: 'quiet', size: 'sm', block: true, onClick: () => this.rest() });
    this.el = h(
      'section',
      { class: 'hw-fbx', attrs: { 'aria-label': 'Firebox' } },
      h('div', { class: 'hw-fbx__thermo' }, this.thermo.el),
      h(
        'div',
        { class: 'hw-fbx__controls' },
        h('div', { class: 'hw-fbx__mouth' }, this.flame.el, this.draftEl),
        h('div', { class: 'hw-fbx__fuel' }, this.fuelHost, this.addFuel.el),
        this.burn.el,
        h('div', { class: 'hw-fbx__btns' }, this.lightBtn.el, this.pumpBtn.el),
        this.elecRow,
        this.facts,
      ),
      this.statusEl,
      this.restBtn.el,
    );
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
    setText(this.draftEl, view.ignited ? '' : `Draft ${formatPercent(view.draft)}`);
    setAttr(this.draftEl, 'data-strong', view.draft > 0.5 ? 'true' : null);

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
      this.lightBtn.setDisabled(view.fuelItems === 0, 'No fuel');
    }
    this.pumpBtn.setDisabled(!view.lit && !view.hot, 'Light it first');

    this.elecRow.hidden = !view.electric.available || view.ignited;
    if (view.electric.available) {
      const e = view.electric;
      this.elecToggle.set(e.on);
      this.elecMeter.setLabel(!e.on ? 'Switched off' : !e.networked ? 'No network' : `${formatWatts(e.deliveredW)} of ${formatWatts(e.demandW)}`);
      this.elecMeter.set(e.on && e.networked ? e.satisfaction : 0, 1);
      this.elecMeter.setTone(e.on && e.demandW > 0 && e.satisfaction < 0.999 ? 'warn' : 'power');
    }

    const facts = [
      view.flameC !== null ? formatTemp(view.flameC) : 'No fire',
      view.ignited ? 'Held' : formatTemp(view.targetC),
      formatTemp(view.maxTempC),
      view.extractW > 0 ? formatWatts(view.extractW) : 'None',
    ];
    facts.forEach((text, i) => setText(this.factValues[i], text));

    setText(this.statusEl, pretty(view.status));
    setAttr(this.statusEl, 'data-tone', statusTone(view));
    this.restBtn.el.hidden = !this.deps.clock.isNight;
    this.restBtn.setDisabled(!view.canRest.ok, view.canRest.ok ? '' : pretty(view.canRest.reason));
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
    this.report(this.lit ? sim.douse(pos.x, pos.y, pos.z) : sim.light(pos.x, pos.y, pos.z));
  }

  private loadFuel(): void {
    const { sim, pos, player, bus } = this.deps;
    const slots = sim.furnaceSlots(pos.x, pos.y, pos.z);
    const from = bestFuelSlot(player.inventory.slots);
    if (!slots || from < 0) {
      this.report({ ok: false, reason: 'Nothing in your pack burns - logs, planks, sticks, charcoal or coal' });
      return;
    }
    const moved = quickMove(player.inventory, from, slots.fuel);
    if (moved === 0) this.report({ ok: false, reason: 'The firebox is full' });
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
