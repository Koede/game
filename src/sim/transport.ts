/**
 * Item and fluid transport (spec 16): owns the pipe networks, rebuilds them where pipes or endpoints change, ticks
 * them at 20 Hz, keeps their content (fluid amounts, packets in flight) on the networks' anchor pipe entities so it is
 * saved with the world, and sets the pipes' active bit while a network carries something. The player's actions
 * (wrench, pipe screen, buckets) are in transportActions.ts, the views in transportViews.ts.
 */
import { TICK_RATE } from '../core/constants';
import type { GameBus } from '../core/context';
import { blockOf, isFluidEndpoint, isItemEndpoint } from '../core/registry';
import { OPPOSITE_FACE, voxelActive, withActive, type BlockDef, type BlockEntity, type Face, type IWorld } from '../core/types';
import type { PlayerState } from '../game/playerState';
import type { FluidEndpoint, ItemEndpoint } from './endpoints';
import type { MachineEntity } from './entities';
import { FluidNet, type FluidEnv } from './fluidNet';
import { ItemNet, type ItemEnv, type Packet } from './itemNet';
import { PipeGraph, type Rebuild } from './pipeGraph';
import type { PipeNet, Port } from './pipeNet';
import { cellKey, isPipeEntity, keyX, keyY, keyZ, pipeEntityEmpty, PIPE_ENTITY, type PipeEntity, type SavedPacket } from './pipeState';
import { chunkKey } from './power';
import { tankColumn, tankStackEndpoint } from './tanks';

/** What transport needs from the simulation. */
export interface TransportHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  itemEndpoint(x: number, y: number, z: number, face: Face): ItemEndpoint | null;
  fluidEndpoint(x: number, y: number, z: number, face: Face): FluidEndpoint | null;
  machineAt(x: number, y: number, z: number): MachineEntity | null;
}

/** An item network keeps its pipes lit this long after its last packet. */
const ITEM_BUSY_HOLD_S = 2;

export class Transport {
  readonly graph: PipeGraph;
  /** Seconds of transport time (packets, port timers). */
  time = 0;
  ticks = 0;
  /** Bumped whenever an endpoint may have changed: ports look theirs up again. */
  private gen = 0;
  private readonly entities = new Map<number, PipeEntity>();
  private readonly reservations = new Map<BlockEntity, Map<string, number>>();
  readonly itemEnv: ItemEnv;
  readonly fluidEnv: FluidEnv;
  private readonly offs: Array<() => void> = [];

  constructor(private readonly host: TransportHost) {
    this.graph = new PipeGraph({
      world: host.world,
      entity: (key) => this.entities.get(key),
      pruned: (e) => this.tidy(e),
    });
    const self = this;
    this.itemEnv = {
      get time() {
        return self.time;
      },
      itemEndpoint: (port) => this.itemEndpointOf(port),
      reserved: (entity, item) => this.reservations.get(entity)?.get(item) ?? 0,
      reserve: (entity, item, delta) => this.reserve(entity, item, delta),
    };
    this.fluidEnv = { fluidEndpoint: (port) => this.fluidEndpointOf(port) };
    const bump = (): void => {
      this.gen++;
    };
    this.offs.push(host.bus.on('hearth:formed', bump), host.bus.on('hearth:unformed', bump));
  }

  get bus(): GameBus {
    return this.host.bus;
  }

  blockAt(x: number, y: number, z: number): BlockDef {
    return this.host.world.getBlock(x, y, z);
  }

  /** Something about the pipe at this cell changed (a wrenched joint): rebuild around it. */
  changed(key: number): void {
    this.gen++;
    this.graph.changed(key);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  get items(): readonly ItemNet[] {
    return this.graph.items;
  }

  get fluids(): readonly FluidNet[] {
    return this.graph.fluids;
  }

  /** Forgets every network and finds the pipe entities again (after a save was loaded into the world). */
  resync(): void {
    this.graph.clear();
    this.entities.clear();
    this.reservations.clear();
    this.gen++;
    for (const e of this.host.world.entities()) {
      if (!isPipeEntity(e)) continue;
      const key = cellKey(e.x, e.y, e.z);
      this.entities.set(key, e);
      this.graph.seed(key);
    }
  }

  // ---- world changes ----------------------------------------------------------------------------------------------

  /** A block's id changed: pipes and endpoints rebuild their networks (on the next tick or query). */
  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    const pipe = from.pipe !== null || to.pipe !== null;
    if (!pipe && !isItemEndpoint(from) && !isItemEndpoint(to) && !isFluidEndpoint(from) && !isFluidEndpoint(to)) return;
    const key = cellKey(x, y, z);
    if (from.pipe && (!to.pipe || to.pipe.family !== from.pipe.family)) {
      const e = this.entities.get(key);
      if (e) this.removeEntity(e);
    }
    this.gen++;
    this.graph.changed(key);
  }

  /** A chunk column arrived: networks that could not see into it are flooded again, saved pipes in it are found. */
  chunkLoaded(cx: number, cz: number): void {
    const ck = chunkKey(cx, cz);
    for (const list of [this.graph.items, this.graph.fluids] as PipeNet[][]) for (const net of list) if (net.frontier.has(ck)) this.graph.redo(net);
    for (const [key, e] of this.entities) {
      if (Math.floor(e.x / 16) === cx && Math.floor(e.z / 16) === cz && !this.graph.cellNet.has(key)) this.graph.seed(key);
    }
    this.gen++;
  }

  // ---- ticking ----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.ticks++;
    this.time += dt;
    this.refresh();
    for (const net of this.graph.items) {
      if (net.ports.length > 0 || net.packets.length > 0) net.tick(this.itemEnv, dt);
      const busy = this.time - net.busyAt < ITEM_BUSY_HOLD_S;
      if (busy !== net.carrying) this.setCarrying(net, busy);
    }
    const second = this.ticks % TICK_RATE === 0;
    for (const net of this.graph.fluids) {
      const had = net.store.litres > 0;
      if (net.ports.length > 0 && net.tick(this.fluidEnv, dt) > 0) net.busyAt = this.time;
      if (second) net.sample();
      const has = net.store.litres > 0;
      const busy = has || this.time - net.busyAt < 1;
      if (busy !== net.carrying) this.setCarrying(net, busy);
      // A joint refused for what this network held can close once it ran dry.
      if (had && !has && net.refused) this.graph.redo(net);
    }
  }

  /** Brings the networks up to date with the blocks (ticks, views and actions call this first). */
  refresh(): void {
    if (this.graph.dirty) this.apply(this.graph.rebuild());
  }

  private apply(r: Rebuild): void {
    this.gen++;
    const moving: Array<{ p: Packet; net: ItemNet }> = [];
    const oldAnchors: PipeEntity[] = [];
    for (const old of r.dissolved) {
      if (old instanceof ItemNet) {
        for (const p of old.packets) {
          old.release(this.itemEnv, p);
          moving.push({ p, net: old });
        }
      }
      if (old.anchor) {
        delete old.anchor.store;
        delete old.anchor.packets;
        oldAnchors.push(old.anchor);
      }
    }
    for (const net of r.built) {
      const orphans = r.orphans.get(net) ?? [];
      if (net instanceof FluidNet) this.fillFrom(net, r.shares.get(net), orphans);
      net.refused = net.joints.some((j) => j.reason !== 'cut');
      if (net instanceof ItemNet) {
        for (const o of orphans) {
          const at = net.index.get(cellKey(o.x, o.y, o.z)) ?? 0;
          for (const rec of o.packets ?? []) if (net.size > 0) net.adopt(this.itemEnv, rec, at, true);
          delete o.packets;
        }
      }
      for (const o of orphans) oldAnchors.push(o);
    }
    for (const { p, net: old } of moving) {
      const key = old.keys[p.here];
      const now = this.graph.cellNet.get(key);
      const at = now instanceof ItemNet ? now.index.get(key) : undefined;
      if (now instanceof ItemNet && at !== undefined) now.adopt(this.itemEnv, p.rec, at, false);
      else this.spill(p.rec);
    }
    for (const net of r.built) this.anchor(net);
    for (const e of oldAnchors) this.tidy(e);
    for (const net of r.built) {
      const busy = net instanceof FluidNet ? net.store.litres > 0 : (net as ItemNet).packets.length > 0;
      if (busy && net instanceof ItemNet) net.busyAt = this.time;
      this.setCarrying(net, busy, true);
    }
  }

  /** A new fluid network's content: its share of each dissolved network it took pipes from, plus saved content. */
  private fillFrom(net: FluidNet, shares: Map<PipeNet, number> | undefined, orphans: PipeEntity[]): void {
    let litres = 0;
    let fluid = net.store.fluid;
    for (const [old, n] of shares ?? []) {
      if (!(old instanceof FluidNet) || old.store.litres <= 0) continue;
      litres += (old.store.litres * n) / (old.keys.length + old.overflow.length);
      fluid = old.store.fluid;
    }
    for (const o of orphans) {
      if (o.store && o.store.litres > 0 && o.store.fluid) {
        litres += o.store.litres;
        fluid = o.store.fluid;
      }
      delete o.store;
    }
    litres = Math.min(litres, net.capacity);
    net.store = { fluid: litres > 0 ? fluid : null, litres: litres > 0 ? litres : 0 };
  }

  /** Puts a network's content on one of its pipes' entities (networks with no ports and nothing in them keep none). */
  private anchor(net: PipeNet): void {
    const content = net instanceof FluidNet ? net.store.litres > 0 : (net as ItemNet).saved.length > 0;
    if (!content && net.ports.length === 0) {
      net.anchor = null;
      return;
    }
    let best = -1;
    for (const k of net.keys) if (this.entities.has(k) && (best < 0 || k < best)) best = k;
    if (best < 0) for (const k of net.keys) if (best < 0 || k < best) best = k;
    if (best < 0) {
      net.anchor = null;
      return;
    }
    const e = this.ensureEntity(best);
    net.anchor = e;
    if (net instanceof FluidNet) e.store = net.store;
    else e.packets = (net as ItemNet).saved;
  }

  /** Items whose pipe is gone: into the block they were going to, else back where they came from, else to the player. */
  private spill(rec: SavedPacket): void {
    let left = rec.count;
    for (const at of [rec.to, rec.from]) {
      if (left <= 0) break;
      const d = at[3];
      const ep = this.host.itemEndpoint(at[0] + DX[d], at[1] + DY[d], at[2] + DZ[d], OPPOSITE_FACE[d]);
      if (ep) left -= ep.insert(rec.item, left, rec.durability);
    }
    if (left > 0) this.host.player.give(rec.item, left, rec.durability);
  }

  private setCarrying(net: PipeNet, on: boolean, force = false): void {
    if (net.carrying === on && !force) return;
    net.carrying = on;
    const world = this.host.world;
    for (const list of [net.keys, net.overflow]) {
      for (const k of list) {
        const x = keyX(k);
        const y = keyY(k);
        const z = keyZ(k);
        const v = world.getVoxel(x, y, z);
        if (blockOf(v).pipe && voxelActive(v) !== on) world.setVoxel(x, y, z, withActive(v, on), 'sim');
      }
    }
  }

  // ---- endpoints, reservations, entities ---------------------------------------------------------------------------

  itemEndpointOf(port: Port): ItemEndpoint | null {
    if (port.epGen !== this.gen) {
      port.ep = this.host.itemEndpoint(port.ex, port.ey, port.ez, OPPOSITE_FACE[port.dir]);
      port.epGen = this.gen;
    }
    return port.ep as ItemEndpoint | null;
  }

  fluidEndpointOf(port: Port): FluidEndpoint | null {
    if (port.epGen !== this.gen) {
      port.ep = this.fluidEndpointAt(port.ex, port.ey, port.ez, OPPOSITE_FACE[port.dir]);
      port.epGen = this.gen;
    }
    return port.ep as FluidEndpoint | null;
  }

  /** The fluid side of a block; a tank stands for its whole stack. */
  fluidEndpointAt(x: number, y: number, z: number, face: Face): FluidEndpoint | null {
    const m = this.host.machineAt(x, y, z);
    if (m && m.kind === 'tank') return tankStackEndpoint(tankColumn(this.tankAt, x, y, z));
    return this.host.fluidEndpoint(x, y, z, face);
  }

  readonly tankAt = (x: number, y: number, z: number): MachineEntity | null => {
    const m = this.host.machineAt(x, y, z);
    return m && m.kind === 'tank' ? m : null;
  };

  private reserve(entity: BlockEntity, item: string, delta: number): void {
    let m = this.reservations.get(entity);
    if (!m) this.reservations.set(entity, (m = new Map()));
    const v = (m.get(item) ?? 0) + delta;
    if (v > 0) m.set(item, v);
    else m.delete(item);
    if (m.size === 0) this.reservations.delete(entity);
  }

  entityAt(key: number): PipeEntity | undefined {
    return this.entities.get(key);
  }

  ensureEntity(key: number): PipeEntity {
    let e = this.entities.get(key);
    if (!e) {
      e = { kind: PIPE_ENTITY, x: keyX(key), y: keyY(key), z: keyZ(key) };
      this.entities.set(key, e);
      this.host.world.setEntity(e);
    }
    return e;
  }

  /** Drops a pipe entity that remembers nothing any more. */
  tidy(e: PipeEntity): void {
    if (pipeEntityEmpty(e)) this.removeEntity(e);
  }

  private removeEntity(e: PipeEntity): void {
    const key = cellKey(e.x, e.y, e.z);
    if (this.entities.get(key) === e) this.entities.delete(key);
    if (this.host.world.getEntity(e.x, e.y, e.z) === e) this.host.world.removeEntity(e.x, e.y, e.z);
  }

  /** The network a pipe at x, y, z belongs to (after bringing them up to date), or null. */
  netAt(x: number, y: number, z: number): PipeNet | null {
    this.refresh();
    return this.graph.cellNet.get(cellKey(x, y, z)) ?? null;
  }
}

const DX = [1, -1, 0, 0, 0, 0];
const DY = [0, 0, 1, -1, 0, 0];
const DZ = [0, 0, 0, 0, 1, -1];
