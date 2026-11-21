/** The Starhearth ignition panel (GRID tab, tier 5): what it takes, how far along it is, the button that starts it. */
import type { GameBus } from '../../../core/context';
import type { FurnaceView, NetworkStats } from '../../../sim';
import { Button } from '../../kit/controls';
import { h, setAttr, setText } from '../../kit/dom';
import { formatJoules, formatWatts } from '../../kit/format';
import { Badge, Meter } from '../../kit/gauges';
import { IGNITION_TEMP_C } from './furnaceText';
import { pretty, type ScreenSim } from './simApi';

export class IgnitionPanel {
  readonly el: HTMLElement;
  private readonly intro: HTMLParagraphElement;
  private readonly heat = new Badge({ text: '', tone: 'heat' });
  private readonly grid = new Badge({ text: '', tone: 'power' });
  private readonly meter = new Meter({ label: 'Ignition', tone: 'power', value: 0, max: 1 });
  private readonly button: Button;

  constructor(opts: { sim: ScreenSim; pos: { x: number; y: number; z: number }; bus: GameBus; changed: () => void }) {
    const { sim, pos, bus } = opts;
    this.intro = h('p', { class: 'hw-ign__intro' });
    this.button = new Button({
      label: 'Ignite the Starhearth',
      kind: 'power',
      size: 'lg',
      block: true,
      holdMs: 900,
      onClick: () => {
        const r = sim.startIgnition(pos.x, pos.y, pos.z);
        if (!r.ok) {
          bus.emit('toast', { text: pretty(r.reason), kind: 'warn' });
          bus.emit('sfx', { name: 'error' });
        }
        opts.changed();
      },
    });
    this.el = h(
      'section',
      { class: 'hw-ign', attrs: { 'aria-label': 'Starhearth ignition' } },
      h('h3', { class: 'hw-ign__title', text: 'Starhearth ignition' }),
      this.intro,
      h('div', { class: 'hw-ign__checks' }, this.heat.el, this.grid.el),
      this.meter.el,
      this.button.el,
    );
  }

  update(view: FurnaceView, net: NetworkStats | null): void {
    const ig = view.ignition;
    setAttr(this.el, 'data-state', view.ignited ? 'done' : ig.state);
    const secs = ig.seconds;
    setText(
      this.intro,
      view.ignited
        ? `A star burns in the hearth. It holds ${Math.round(view.tempC)} °C on its own and feeds the grid.`
        : ig.state === 'failed'
          ? `The ignition failed: the power dropped. Every second of the ${secs} s needs ${formatWatts(ig.powerW)} - add generation or storage and try again.`
          : `Hold ${IGNITION_TEMP_C} °C, then feed it ${formatWatts(ig.powerW)} for ${secs} s without a break. If power falls below 95% for more than 2 s, it fails.`,
    );
    this.heat.update({ text: `${IGNITION_TEMP_C} °C - now ${Math.floor(view.tempC)}`, tone: 'heat', met: view.ignited || view.tempC >= IGNITION_TEMP_C });
    const supply = net ? net.generationW : 0;
    this.grid.update({
      text: net ? `${formatWatts(supply)} generation${net.capacityJ > 0 ? `, ${formatJoules(net.storedJ)} stored` : ''}` : 'No network',
      tone: 'power',
      met: view.ignited || (net !== null && (supply > 0 || net.storedJ > 0)),
    });
    this.heat.el.hidden = view.ignited;
    this.grid.el.hidden = view.ignited;
    const running = ig.state === 'running';
    this.meter.el.hidden = !running && !view.ignited;
    this.meter.set(view.ignited ? 1 : ig.progress, 1, view.ignited ? 'Ignited' : `${Math.round(ig.progress * 100)}% - ${Math.ceil((1 - ig.progress) * secs)} s left`);
    this.button.el.hidden = view.ignited || running;
    this.button.setDisabled(!ig.canStart.ok, ig.canStart.ok ? '' : pretty(ig.canStart.reason));
  }

  dispose(): void {
    this.button.dispose();
  }
}
