/**
 * The body of a machine screen, by role: a headline figure and status for everything; then a fuel slot
 * (burners), input -> progress -> output (processors), charge (storage), depth and buffer (bore rig), the core
 * gauge and rod slot (fission pile). Placement hint and problem are always shown.
 */
import { block, itemOrNull, machine, recipesAt } from '../../../core/registry';
import type { Inventory } from '../../../game/inventory';
import type { MachineView } from '../../../sim';
import { h, setAttr, setText } from '../../kit/dom';
import { formatDuration, formatWatts } from '../../kit/format';
import { Meter, StatFigure, Thermometer } from '../../kit/gauges';
import { ItemIcon } from '../../kit/icons';
import { ItemSlot, SlotGrid } from '../../kit/slot';
import type { QuickTarget, SlotBinding, SlotController } from '../slots';
import { pretty } from '../furnace/simApi';
import { FluidTanks } from './fluidTanks';
import { usesWaterBeside } from './fluidText';
import { fuelText, headline, machineTone, subline, type MachineLayout } from './machineText';

const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;

/** Phone-sized viewport (the kit's breakpoint): long reference lists start folded. */
const phone = (): boolean => typeof matchMedia === 'function' && matchMedia('(max-width: 719.98px), (max-height: 519.98px)').matches;

/** The block item a machine kind is placed with (for its icon). */
export const machineItem = (kind: string): string => block(machine(kind).blocks[0]).itemKey ?? kind;

export class MachinePanel {
  readonly el: HTMLElement;
  private readonly layout: MachineLayout;
  private readonly figure: StatFigure;
  private fuel: HTMLParagraphElement | null = null;
  private readonly status: HTMLParagraphElement;
  private readonly problem: HTMLParagraphElement;
  private readonly hint: HTMLParagraphElement;
  private readonly extra: HTMLDivElement;
  private readonly bindings: SlotBinding[] = [];
  private readonly slotViews: ItemSlot[] = [];
  private readonly grids: SlotGrid[] = [];
  private meter: Meter | null = null;
  private second: Meter | null = null;
  private thermo: Thermometer | null = null;
  private recipeLine: HTMLSpanElement | null = null;
  /** Wear (src/sim/wear.ts): condition meter and the Repair button, for machines that wear. */
  private readonly care: HTMLDivElement;
  private readonly condition: Meter;
  private readonly repairBtn: HTMLButtonElement;
  /** Machines with fluid ports: their buffers. */
  private readonly tanks: FluidTanks | null;

  constructor(view: MachineView, layout: MachineLayout, slots: SlotController, inventory: Inventory | null, toBag: readonly QuickTarget[], onRepair?: () => void) {
    this.layout = layout;
    this.condition = new Meter({ label: 'Condition', tone: 'power' });
    this.repairBtn = h('button', { class: 'hw-btn', attrs: { type: 'button' }, on: { click: () => onRepair?.() } });
    this.care = h('div', { class: 'hw-mach__care' }, this.condition.el, this.repairBtn);
    this.care.hidden = view.wear === null;
    this.figure = new StatFigure({ caption: headline(view, layout).caption, size: 'lg' });
    const icon = new ItemIcon(machineItem(view.kind));
    icon.el.classList.add('hw-mach__icon');
    this.status = h('p', { class: 'hw-mach__status', attrs: { role: 'status' } });
    this.problem = h('p', { class: 'hw-mach__problem', attrs: { 'data-tone': 'bad' } });
    this.hint = h('p', { class: 'hw-mach__hint' });
    this.extra = h('div', { class: 'hw-mach__extra' });
    this.tanks = view.fluids ? new FluidTanks(view.kind) : null;
    this.figure.el.hidden = layout === 'part';
    this.el = h(
      'section',
      { class: 'hw-mach', attrs: { 'data-layout': layout } },
      h('div', { class: 'hw-mach__head' }, icon.el, this.figure.el),
      this.status,
      this.problem,
      this.care,
      this.tanks?.el ?? null,
      this.extra,
      this.hint,
    );
    this.build(view, slots, inventory, toBag);
  }

  update(view: MachineView): void {
    const head = headline(view, this.layout);
    this.figure.set(head.reading);
    this.figure.setNote(subline(view, this.layout));
    this.figure.setTone(this.layout === 'storage' || this.layout === 'generator' || this.layout === 'burner' || this.layout === 'fission' ? 'power' : 'neutral');
    if (this.tanks && view.fluids) this.tanks.update(view.fluids, usesWaterBeside(view));
    setText(this.status, pretty(view.status || (view.on ? 'Ready' : 'Switched off')));
    setAttr(this.status, 'data-tone', machineTone(view));
    this.care.hidden = view.wear === null;
    if (view.wear !== null) {
      const left = 1 - view.wear;
      this.condition.set(left, 1, `${Math.round(left * 100)}% - ${view.condition === 'kept' ? 'well kept, runs faster' : view.condition}`);
      this.repairBtn.hidden = view.repairCost <= 0;
      setText(this.repairBtn, `Repair (${view.repairCost} ${nameOf('iron_ingot')})`);
    }
    this.problem.hidden = view.problem === null;
    setText(this.problem, view.problem ?? '');
    this.hint.hidden = view.hint === null;
    setText(this.hint, view.hint ? `Placement: ${pretty(view.hint)}` : '');
    switch (this.layout) {
      case 'burner':
        if (this.fuel) setText(this.fuel, fuelText(view));
        break;
      case 'processor':
        if (this.recipeLine) setText(this.recipeLine, view.recipe ? `Making ${nameOf(view.recipe.output.item)}` : 'Idle');
        this.meter?.set(view.progress, 1, view.recipe ? `${Math.round(view.progress * 100)}%` : '');
        this.second?.set(view.demandW > 0 ? view.satisfaction : 0, 1, view.demandW > 0 ? `${formatWatts(view.demandW * view.satisfaction)} of ${formatWatts(view.demandW)}` : 'Idle');
        break;
      case 'consumer':
        this.meter?.set(view.demandW > 0 ? view.satisfaction : 0, 1, view.demandW > 0 ? `${Math.round(view.satisfaction * 100)}%` : 'Idle');
        break;
      case 'storage':
        this.meter?.set(view.storedJ, view.capacityJ);
        break;
      case 'bore':
        if (this.recipeLine) setText(this.recipeLine, `Depth: y ${view.depthY}`);
        this.meter?.set(view.progress, 1, view.demandW > 0 ? `${Math.round(view.progress * 100)}%` : '');
        break;
      case 'fission':
        this.thermo?.set(view.coreC);
        this.thermo?.setCaption(view.cooled ? 'Cooled by water' : 'NOT COOLED - needs water on 2 sides');
        if (this.fuel) setText(this.fuel, fuelText(view));
        break;
      default:
        break;
    }
  }

  dispose(): void {
    for (const b of this.bindings) b.unbind();
    for (const s of this.slotViews) s.dispose();
    for (const g of this.grids) g.dispose();
    this.thermo?.dispose();
  }

  private slot(hint: string, label: string): ItemSlot {
    const s = new ItemSlot({ size: 'lg', hint, label });
    this.slotViews.push(s);
    return s;
  }

  private build(view: MachineView, slots: SlotController, inv: Inventory | null, toBag: readonly QuickTarget[]): void {
    const spec = machine(view.kind);
    const label = spec.name;
    switch (this.layout) {
      case 'burner': {
        const fuel = this.slot('Fuel', `${label} fuel`);
        this.fuel = h('p', { class: 'hw-mach__fuel hw-num' });
        const fuels = (spec.fuels ?? []).map(nameOf);
        const accepts = fuels.length > 4 ? 'Burns logs, planks, sticks, charcoal, coal or coke' : `Burns ${fuels.join(', ')}`;
        this.extra.append(
          h('div', { class: 'hw-mach__row' }, fuel.el, h('div', { class: 'hw-mach__grow' }, h('span', { class: 'hw-heading', text: 'Fuel left' }), this.fuel, h('p', { class: 'hw-mach__note', text: accepts }))),
        );
        if (inv) this.bindings.push(slots.bind({ id: 'machine', label, inventory: inv, views: [fuel], quickTo: toBag }));
        break;
      }
      case 'processor': {
        const input = this.slot('In', `${label} input`);
        const output = this.slot('Out', `${label} output`);
        this.recipeLine = h('span', { class: 'hw-mach__recipe' });
        this.meter = new Meter({ label: 'Progress', tone: 'power' });
        this.second = new Meter({ label: 'Power', tone: 'power' });
        this.extra.append(
          h('div', { class: 'hw-mach__row' }, input.el, h('div', { class: 'hw-mach__grow' }, this.recipeLine, this.meter.el), output.el),
          this.second.el,
          h(
            'details',
            { class: 'hw-mach__more', attrs: { open: !phone() } },
            h('summary', { class: 'hw-heading', text: `Recipes (${recipesAt(view.kind).length})` }),
            h(
            'ul',
            { class: 'hw-mach__recipes' },
            recipesAt(view.kind).map((r) =>
              h(
                'li',
                { class: 'hw-mach__rec' },
                new ItemIcon(r.inputs[0].item).el,
                h('span', { class: 'hw-mach__recname', text: `${r.inputs[0].count > 1 ? `${r.inputs[0].count} ` : ''}${nameOf(r.inputs[0].item)} → ${r.output.count > 1 ? `${r.output.count} ` : ''}${nameOf(r.output.item)}` }),
                h('span', { class: 'hw-num hw-mach__rectime', text: formatDuration(r.timeS) }),
              ),
            ),
            ),
          ),
        );
        if (inv) {
          this.bindings.push(slots.bind({ id: 'machine-in', label: `${label} input`, inventory: inv, views: [input], start: 0, quickTo: toBag }));
          this.bindings.push(slots.bind({ id: 'machine-out', label: `${label} output`, inventory: inv, views: [output], start: 1, quickTo: toBag }));
        }
        break;
      }
      case 'consumer':
        this.meter = new Meter({ label: 'Power supplied', tone: 'power' });
        this.extra.append(this.meter.el, h('p', { class: 'hw-mach__note', text: pretty(spec.desc) }));
        break;
      case 'storage':
        this.meter = new Meter({ label: 'Charge', tone: 'power' });
        this.extra.append(this.meter.el, h('p', { class: 'hw-mach__note', text: pretty(spec.desc) }));
        break;
      case 'bore': {
        this.recipeLine = h('span', { class: 'hw-mach__recipe' });
        this.meter = new Meter({ label: 'Current block', tone: 'power' });
        const grid = new SlotGrid({ count: view.slots.length, columns: 9, label: 'Buffer', minSlotPx: 36 });
        this.grids.push(grid);
        this.extra.append(this.recipeLine, this.meter.el, h('h3', { class: 'hw-heading', text: 'Buffer' }), grid.el);
        if (inv) this.bindings.push(slots.bind({ id: 'machine', label: 'Buffer', inventory: inv, views: grid.slots, quickTo: toBag }));
        break;
      }
      case 'fission': {
        const p = spec.params ?? {};
        this.thermo = new Thermometer({
          min: 0,
          max: (p.meltdownTempC ?? 1200) + 100,
          notches: [
            { tempC: p.runTempC ?? 600, label: 'Running' },
            { tempC: p.warnTempC ?? 900, label: 'Danger' },
            { tempC: p.meltdownTempC ?? 1200, label: 'Meltdown', kind: 'limit' },
          ],
        });
        const rod = this.slot('Rod', 'Fuel rod');
        this.fuel = h('p', { class: 'hw-mach__fuel hw-num' });
        this.extra.append(
          h(
            'div',
            { class: 'hw-mach__fission' },
            h('div', { class: 'hw-mach__core' }, this.thermo.el),
            h('div', { class: 'hw-mach__grow' }, rod.el, h('span', { class: 'hw-heading', text: 'Rod energy left' }), this.fuel),
          ),
        );
        if (inv) this.bindings.push(slots.bind({ id: 'machine', label: 'Fuel rod', inventory: inv, views: [rod], quickTo: toBag }));
        break;
      }
      default:
        this.extra.append(h('p', { class: 'hw-mach__note', text: pretty(spec.desc) }));
        break;
    }
  }
}
