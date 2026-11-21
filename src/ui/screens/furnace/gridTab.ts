/** The GRID tab: the network this furnace is on (and, at tier 5, the Starhearth ignition panel above it). */
import type { GameBus } from '../../../core/context';
import type { FurnaceView, NetworkStats } from '../../../sim';
import { h } from '../../kit/dom';
import { lonelyFurnaceText } from '../machines/machineText';
import { NetworkPanel } from '../machines/networkPanel';
import { IgnitionPanel } from './ignition';
import type { ScreenSim } from './simApi';

export class GridTab {
  readonly el: HTMLElement;
  private readonly sim: ScreenSim;
  private readonly pos: { x: number; y: number; z: number };
  private readonly net = new NetworkPanel();
  private readonly ignition: IgnitionPanel;

  constructor(opts: { sim: ScreenSim; pos: { x: number; y: number; z: number }; bus: GameBus; changed: () => void }) {
    this.sim = opts.sim;
    this.pos = opts.pos;
    this.ignition = new IgnitionPanel(opts);
    this.ignition.el.hidden = true;
    this.el = h('div', { class: 'hw-gridtab' }, this.ignition.el, this.net.el);
  }

  /** The furnace's network is in brown-out or overload (the tab badge). */
  alert(view: FurnaceView): boolean {
    if (!view.electric.available && view.tier < 2) return false;
    const net = this.network();
    return net !== null && net.state !== 'ok';
  }

  update(view: FurnaceView): void {
    const net = this.network();
    this.ignition.el.hidden = view.tier < 5;
    if (view.tier >= 5) this.ignition.update(view, net);
    this.net.setEmptyText(lonelyFurnaceText(view.tier));
    this.net.update(net, net !== null && net.members.length <= 1);
  }

  dispose(): void {
    this.net.dispose();
    this.ignition.dispose();
  }

  private network(): NetworkStats | null {
    return this.sim.networkAt(this.pos.x, this.pos.y, this.pos.z);
  }
}
