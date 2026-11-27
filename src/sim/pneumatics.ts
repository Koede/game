/**
 * Pneumatic tubes: items shot through the air network from crate to crate. Two air members do it (BlockSpec.air
 * role 'station', src/content/blocksPneumatic.ts):
 *
 * - A Pneumatic Sender touching a crate shoots one capsule a second: the first stack in the crate, at most
 *   PNEU_CAPSULE_MAX items, for PNEU_CAPSULE_L litres of the network's air when it holds PNEU_MIN_BAR.
 * - It goes to a Pneumatic Receiver on the same network whose crate has room: first one whose crate already holds that
 *   item (so a row of receivers sorts a base), else the nearest one with room. Never back into the crate it came from.
 * - Its flight takes PNEU_FLIGHT_BASE_S plus the Manhattan distance at PNEU_BLOCKS_PER_S. Capsules on their way live on
 *   the receiver's own entity (kind 'tube_station'), so a save keeps them. On arrival what fits goes into the crate;
 *   the rest waits in the receiver and tries again each shot. A receiver that is broken spills what it held.
 *
 * Room is promised when a capsule leaves (counting every capsule on its way), so two senders never overfill a crate.
 */
import { PNEU_BLOCKS_PER_S, PNEU_CAPSULE_L, PNEU_CAPSULE_MAX, PNEU_FLIGHT_BASE_S, PNEU_MIN_BAR, PNEU_SEND_INTERVAL_S } from '../core/constants';
import type { GameBus } from '../core/context';
import type { BlockDef, BlockEntity, ItemStack, IWorld, Slot } from '../core/types';
import type { AirNets } from './airNet';
import { addToSlots, roomInSlots, type MachineEntity } from './entities';
import { cellKey, keyX, keyY, keyZ, stepKey } from './pipeState';

export const TUBE_STATION_ENTITY = 'tube_station';

/** One capsule on its way: the stack it carries and the seconds left (0 or less: arrived, waiting for room). */
export interface Capsule extends ItemStack {
  t: number;
}

/** A receiver's saved entity: what is on its way to it. */
export interface TubeStationEntity extends BlockEntity {
  kind: 'tube_station';
  inbound: Capsule[];
}

export const isTubeStation = (e: BlockEntity | undefined): e is TubeStationEntity => e !== undefined && e.kind === TUBE_STATION_ENTITY;

export interface PneumaticHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly air: AirNets;
  /** The crate at a cell, or null. */
  crateAt(x: number, y: number, z: number): MachineEntity | null;
  /** A crate's slots changed (open screens refresh). */
  touch(e: MachineEntity): void;
  /** Items that have nowhere to go (a receiver was broken): they spill as drops. */
  spill(x: number, y: number, z: number, stacks: Slot[]): void;
}

/** What a Use on a station says. */
export interface StationView {
  kind: 'send' | 'receive';
  bar: number;
  /** Capsules on their way to it (receivers). */
  inbound: number;
  status: string;
}

const fmt = (bar: number): string => (Math.round(bar * 10) / 10).toString();
const plain = (s: ItemStack): boolean => s.durability === undefined && s.quality === undefined && s.enchants === undefined;

export class Pneumatics {
  /** Receivers with a saved entity, by cell key. */
  private readonly stations = new Map<number, TubeStationEntity>();
  private clock = 0;
  /** Capsules fired and delivered since the world loaded (diagnostics and tests). */
  fired = 0;
  delivered = 0;

  constructor(private readonly host: PneumaticHost) {}

  /** Forgets everything and picks the saved receivers up again (after a save was loaded into the world). */
  resync(): void {
    this.stations.clear();
    this.clock = 0;
    for (const e of this.host.world.entities()) {
      if (!isTubeStation(e)) continue;
      if (!Array.isArray(e.inbound)) e.inbound = [];
      e.inbound = e.inbound.filter((c) => c && typeof c.item === 'string' && Number.isFinite(c.count) && c.count > 0);
      for (const c of e.inbound) if (!Number.isFinite(c.t)) c.t = 0;
      this.stations.set(cellKey(e.x, e.y, e.z), e);
    }
  }

  /** A block changed: a receiver that is gone spills what was on its way to it. */
  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    if (from.air?.role !== 'station' || to.air?.station === from.air.station) return;
    const key = cellKey(x, y, z);
    const e = this.stations.get(key);
    if (!e) return;
    this.stations.delete(key);
    this.host.world.removeEntity(x, y, z);
    const stacks: Slot[] = e.inbound.map(({ t: _t, ...stack }) => stack);
    if (stacks.length > 0) this.host.spill(x, y, z, stacks);
  }

  /** The crate a station touches (the first of its six faces in Face order), or null. */
  crateOf(key: number): MachineEntity | null {
    for (let d = 0; d < 6; d++) {
      const n = stepKey(key, d);
      if (n < 0) continue;
      const c = this.host.crateAt(keyX(n), keyY(n), keyZ(n));
      if (c) return c;
    }
    return null;
  }

  view(x: number, y: number, z: number): StationView | null {
    const spec = this.host.world.getBlock(x, y, z).air;
    if (!spec || spec.role !== 'station') return null;
    const kind = spec.station ?? 'send';
    const bar = this.host.air.barAt(x, y, z);
    const key = cellKey(x, y, z);
    const crate = this.crateOf(key);
    const inbound = this.stations.get(key)?.inbound.length ?? 0;
    let status: string;
    if (!crate) status = 'Place it against a crate';
    else if (kind === 'receive') status = inbound > 0 ? `${inbound} capsule${inbound === 1 ? '' : 's'} on the way - ${fmt(bar)} bar` : `Waiting for capsules - ${fmt(bar)} bar`;
    else if (bar < PNEU_MIN_BAR) status = `Needs ${PNEU_MIN_BAR} bar - has ${fmt(bar)}`;
    else if (!this.receivers(key).length) status = `No receiver on this network - ${fmt(bar)} bar`;
    else status = crate.slots.some((s) => s) ? `Sending - ${fmt(bar)} bar` : `Crate is empty - ${fmt(bar)} bar`;
    return { kind, bar, inbound, status };
  }

  /** Receivers on the network of the station at `key` (never itself). */
  private receivers(key: number): number[] {
    const net = this.host.air.netAt(keyX(key), keyY(key), keyZ(key));
    if (!net) return [];
    const { world } = this.host;
    return net.stations.filter((k) => k !== key && world.getBlock(keyX(k), keyY(k), keyZ(k)).air?.station === 'receive');
  }

  /** Every capsule on its way to a crate, by crate, as item -> count (so room is never promised twice). */
  private promised(): Map<MachineEntity, Map<string, number>> {
    const out = new Map<MachineEntity, Map<string, number>>();
    for (const [key, e] of this.stations) {
      if (e.inbound.length === 0) continue;
      const crate = this.crateOf(key);
      if (!crate) continue;
      let m = out.get(crate);
      if (!m) out.set(crate, (m = new Map()));
      for (const c of e.inbound) m.set(c.item, (m.get(c.item) ?? 0) + c.count);
    }
    return out;
  }

  tick(dt: number): void {
    for (const [key, e] of this.stations) {
      for (const c of e.inbound) c.t -= dt;
      if (e.inbound.some((c) => c.t <= 0)) this.unload(key, e);
    }
    this.clock += dt;
    if (this.clock < PNEU_SEND_INTERVAL_S) return;
    this.clock -= PNEU_SEND_INTERVAL_S;
    for (const net of this.host.air.nets) {
      if (net.stations.length < 2) continue;
      for (const k of [...net.stations]) {
        if (this.host.world.getBlock(keyX(k), keyY(k), keyZ(k)).air?.station === 'send') this.fire(k);
      }
    }
  }

  /** Puts every arrived capsule of a receiver into its crate; what does not fit waits there. */
  private unload(key: number, e: TubeStationEntity): void {
    const crate = this.crateOf(key);
    if (!crate) return;
    let changed = false;
    for (let i = 0; i < e.inbound.length; i++) {
      const c = e.inbound[i];
      if (c.t > 0) continue;
      const left = insert(crate.slots, c);
      if (left === c.count) continue;
      changed = true;
      if (left > 0) c.count = left;
      else {
        e.inbound.splice(i--, 1);
        this.delivered++;
        this.host.bus.emit('sfx', { name: 'pipe_clunk', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 });
      }
    }
    if (changed) this.host.touch(crate);
  }

  /** A sender's shot: the first stack of its crate that a receiver has room for. */
  private fire(key: number): boolean {
    const from = this.crateOf(key);
    if (!from) return false;
    const x = keyX(key);
    const y = keyY(key);
    const z = keyZ(key);
    const receivers = this.receivers(key);
    if (receivers.length === 0 || this.host.air.barAt(x, y, z) < PNEU_MIN_BAR) return false;
    const promised = this.promised();
    for (let i = 0; i < from.slots.length; i++) {
      const s = from.slots[i];
      if (!s) continue;
      const pick = this.pickReceiver(receivers, from, s, key, promised);
      if (!pick) continue;
      if (!this.host.air.spend(x, y, z, PNEU_CAPSULE_L, PNEU_MIN_BAR)) return false;
      const n = Math.min(s.count, PNEU_CAPSULE_MAX, pick.room);
      const { count: _count, ...rest } = s;
      const dist = Math.abs(keyX(pick.key) - x) + Math.abs(keyY(pick.key) - y) + Math.abs(keyZ(pick.key) - z);
      const capsule: Capsule = { ...rest, count: n, t: PNEU_FLIGHT_BASE_S + dist / PNEU_BLOCKS_PER_S };
      if (s.count > n) s.count -= n;
      else from.slots[i] = null;
      this.entityOf(pick.key).inbound.push(capsule);
      this.fired++;
      this.host.touch(from);
      this.host.bus.emit('sfx', { name: 'steam_hiss', x: x + 0.5, y: y + 0.5, z: z + 0.5, volume: 0.5, pitch: 1.6 });
      return true;
    }
    return false;
  }

  private pickReceiver(
    receivers: readonly number[], from: MachineEntity, s: ItemStack, key: number, promised: Map<MachineEntity, Map<string, number>>,
  ): { key: number; room: number } | null {
    let best: { key: number; room: number; holds: boolean; d: number } | null = null;
    for (const r of receivers) {
      const crate = this.crateOf(r);
      if (!crate || crate === from) continue;
      const room = (plain(s) ? roomInSlots(crate.slots, s.item) : crate.slots.filter((c) => !c).length) - (promised.get(crate)?.get(s.item) ?? 0);
      if (room <= 0) continue;
      const holds = crate.slots.some((c) => c?.item === s.item);
      const d = Math.abs(keyX(r) - keyX(key)) + Math.abs(keyY(r) - keyY(key)) + Math.abs(keyZ(r) - keyZ(key));
      if (!best || (holds && !best.holds) || (holds === best.holds && d < best.d)) best = { key: r, room, holds, d };
    }
    return best;
  }

  private entityOf(key: number): TubeStationEntity {
    let e = this.stations.get(key);
    if (!e) {
      e = { kind: TUBE_STATION_ENTITY, x: keyX(key), y: keyY(key), z: keyZ(key), inbound: [] };
      this.host.world.setEntity(e);
      this.stations.set(key, e);
    }
    return e;
  }
}

/** Puts a capsule's stack into crate slots; returns how many did not fit. A tool (durability, quality, enchants) takes an empty slot whole. */
function insert(slots: Slot[], c: Capsule): number {
  const { t: _t, ...stack } = c;
  if (plain(stack)) return addToSlots(slots, stack.item, stack.count);
  const i = slots.indexOf(null);
  if (i < 0) return stack.count;
  slots[i] = stack;
  return 0;
}
