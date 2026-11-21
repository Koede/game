/**
 * Fluid networks (spec 16.4): a network holds ONE fluid and an amount, up to the capacity of its pipes. Pulling ends
 * drain their block up to the pipe's rate; the network then fills pushing ends by priority, splitting equally inside
 * a priority. A cold pipe anywhere in the network refuses hot fluids ("Too hot for this pipe"). An empty network
 * forgets its fluid.
 */
import { MACHINES, fluid as fluidSpec } from '../core/registry';
import type { BlockEntity, FluidKey } from '../core/types';
import type { FluidEndpoint } from './endpoints';
import { PipeNet, type Port } from './pipeNet';
import { passes, type FluidStore } from './pipeState';

/** What a fluid network needs from the transport that owns it. */
export interface FluidEnv {
  fluidEndpoint(port: Port): FluidEndpoint | null;
}

/** Below this many litres a network counts as empty (floating-point dust). */
const EMPTY_L = 1e-6;

export class FluidNet extends PipeNet {
  /** What it holds; the same object lives on the anchor entity. */
  store: FluidStore = { fluid: null, litres: 0 };
  capacity = 0;
  /** The fluid it moved last (it may flow straight through and hold none at the end of a tick). */
  lastFluid: FluidKey | null = null;
  private order: Port[] = [];
  private orderOf: string | null = null;
  private readonly limits: number[] = [];
  private readonly takers: Port[] = [];
  /** Blocks pulled from this tick: fluid never goes straight back into them. */
  private readonly sources: BlockEntity[] = [];

  constructor() {
    super('fluid');
  }

  /** Whether this network may carry a fluid at all (hot fluids need every pipe hot). */
  carries(key: FluidKey): boolean {
    return this.hot || !fluidSpec(key).hot;
  }

  /** One tick; returns the litres it pulled in (what flowed through it, even when none is left in the pipes). */
  tick(env: FluidEnv, dt: number): number {
    const store = this.store;
    const before = store.litres;
    let pulled = 0;
    this.sources.length = 0;
    for (const port of this.ports) if (port.cfg.mode === 'pull') pulled += this.pull(env, port, dt);
    if (store.litres > EMPTY_L && store.fluid) this.push(env, store.fluid, dt);
    if (store.litres <= EMPTY_L) {
      store.litres = 0;
      store.fluid = null;
    }
    return pulled + Math.max(0, before - store.litres);
  }

  /** Every second: the litres each end moved become its shown rate. */
  sample(): void {
    for (const p of this.ports) {
      p.rateL = p.litres;
      p.litres = 0;
    }
  }

  private pull(env: FluidEnv, port: Port, dt: number): number {
    const ep = env.fluidEndpoint(port);
    if (!ep) {
      port.state = 'no_endpoint';
      return 0;
    }
    const offer = ep.offer();
    if (!offer || offer.litres <= 0) {
      port.state = 'empty';
      port.subject = null;
      return 0;
    }
    port.subject = offer.fluid;
    const store = this.store;
    if (!passes(port.cfg, offer.fluid)) port.state = 'filtered';
    else if (!this.carries(offer.fluid)) port.state = 'too_hot';
    else if (store.fluid !== null && store.fluid !== offer.fluid) {
      port.state = 'other_fluid';
      port.subject = store.fluid;
    } else {
      const room = this.capacity - store.litres;
      if (room <= EMPTY_L) {
        port.state = this.anyTaker(env, offer.fluid, ep.entity) ? 'dest_full' : 'no_dest';
        return 0;
      }
      const got = ep.drain(offer.fluid, Math.min(port.rate * dt, room, offer.litres));
      if (got > 0) {
        store.fluid = offer.fluid;
        this.lastFluid = offer.fluid;
        store.litres += got;
        port.litres += got;
        port.state = 'moving';
        if (!this.sources.includes(ep.entity)) this.sources.push(ep.entity);
      }
      return got;
    }
    return 0;
  }

  /** Whether a pushing end of this network would ever take the fluid (for "No destination"). */
  private anyTaker(env: FluidEnv, key: FluidKey, source: BlockEntity): boolean {
    for (const q of this.ports) {
      if (q.cfg.mode !== 'push' || !passes(q.cfg, key)) continue;
      const qe = env.fluidEndpoint(q);
      if (qe && qe.entity !== source && takes(qe, key)) return true;
    }
    return false;
  }

  /** Pushing ends by priority, highest first (re-sorted only when settings change). */
  private pushOrder(): Port[] {
    let sig = '';
    for (const p of this.ports) sig += p.cfg.mode === 'push' ? `${p.cfg.priority},` : 'x,';
    if (sig !== this.orderOf) {
      this.orderOf = sig;
      this.order = this.ports.filter((p) => p.cfg.mode === 'push').sort((a, b) => b.cfg.priority - a.cfg.priority);
    }
    return this.order;
  }

  private push(env: FluidEnv, key: FluidKey, dt: number): void {
    const store = this.store;
    const order = this.pushOrder();
    const takers = this.takers;
    const limits = this.limits;
    for (let i = 0; i < order.length && store.litres > EMPTY_L;) {
      const pri = order[i].cfg.priority;
      takers.length = 0;
      limits.length = 0;
      for (; i < order.length && order[i].cfg.priority === pri; i++) {
        const port = order[i];
        const ep = env.fluidEndpoint(port);
        if (!ep) {
          port.state = 'no_endpoint';
          continue;
        }
        port.subject = key;
        if (this.sources.includes(ep.entity)) {
          port.state = 'waiting';
          continue;
        }
        if (!passes(port.cfg, key)) {
          port.state = 'filtered';
          continue;
        }
        const room = ep.room(key);
        if (room <= 0) {
          port.state = takes(ep, key) ? 'full' : 'refuses';
          continue;
        }
        takers.push(port);
        limits.push(Math.min(port.rate * dt, room));
      }
      // Equal split inside the priority: whoever needs less than an equal share leaves the rest to the others.
      let left = takers.length;
      while (left > 0 && store.litres > EMPTY_L) {
        let smallest = -1;
        for (let k = 0; k < takers.length; k++) if (limits[k] >= 0 && (smallest < 0 || limits[k] < limits[smallest])) smallest = k;
        const share = Math.min(limits[smallest], store.litres / left);
        const port = takers[smallest];
        const ep = env.fluidEndpoint(port) as FluidEndpoint;
        const put = ep.fill(key, share);
        store.litres -= put;
        port.litres += put;
        port.state = put > 0 ? 'moving' : 'full';
        limits[smallest] = -1;
        left--;
      }
    }
  }
}

/** Whether an endpoint takes a fluid at all (it may be full of it right now). */
export const takes = (ep: FluidEndpoint, key: FluidKey): boolean => MACHINES.get(ep.entity.kind)?.fluids?.accepts?.includes(key) ?? false;
