/** The fluid buffers of a machine screen (spec 16.2): one bar per buffer in the fluid's colour, and the flow. */
import type { MachineFluidView } from '../../../sim';
import { h, setFlag, setText } from '../../kit/dom';
import { Meter } from '../../kit/gauges';
import { flowText, tankRows, type TankRow } from './fluidText';

interface TankEl {
  id: TankRow['id'];
  el: HTMLDivElement;
  swatch: HTMLSpanElement;
  meter: Meter;
}

export class FluidTanks {
  readonly el: HTMLElement;
  private readonly kind: string;
  private readonly host: HTMLDivElement;
  private readonly flow: HTMLParagraphElement;
  private readonly tanks: TankEl[] = [];

  constructor(kind: string) {
    this.kind = kind;
    this.host = h('div', { class: 'hw-tanks' });
    this.flow = h('p', { class: 'hw-tank__rate hw-num' });
    this.el = h('section', { class: 'hw-mach__tanks', attrs: { 'aria-label': 'Fluids' } }, h('span', { class: 'hw-heading', text: 'Fluids' }), this.host, this.flow);
  }

  update(view: MachineFluidView): void {
    const rows = tankRows(this.kind, view);
    while (this.tanks.length > rows.length) this.tanks.pop()?.el.remove();
    rows.forEach((r, i) => {
      let t = this.tanks[i];
      if (!t || t.id !== r.id) {
        const swatch = h('span', { class: 'hw-pipe__swatch' });
        const meter = new Meter({ label: '', tone: 'neutral' });
        meter.el.classList.add('hw-tank__bar');
        const made: TankEl = { id: r.id, el: h('div', { class: 'hw-tank' }, swatch, meter.el), swatch, meter };
        if (t) t.el.replaceWith(made.el);
        else this.host.appendChild(made.el);
        this.tanks[i] = made;
        t = made;
      }
      t.meter.setLabel(r.label);
      t.meter.set(r.litres, Math.max(1, r.capacityL), r.text);
      const colour = r.colour ?? '';
      if (t.el.style.getPropertyValue('--hw-pipe-fluid') !== colour) {
        if (r.colour) t.el.style.setProperty('--hw-pipe-fluid', r.colour);
        else t.el.style.removeProperty('--hw-pipe-fluid');
        t.swatch.style.backgroundColor = r.colour ?? '';
      }
      setFlag(t.swatch, 'glow', r.glow && r.colour !== null);
      setFlag(t.el, 'empty', r.colour === null);
      t.el.classList.toggle('hw-tank__empty', r.colour === null);
    });
    const flow = flowText(this.kind, view);
    setText(this.flow, flow);
    this.flow.hidden = flow === '';
  }
}
