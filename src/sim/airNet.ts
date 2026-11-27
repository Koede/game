/**
 * The Bronze Age air network (BRONZE_PLAN 4.4 and 5.3). Its own graph, apart from the item and fluid pipes in
 * pipeGraph.ts (which treats every non-item pipe as a fluid pipe): every touching block that has `BlockSpec.air` joins
 * one network. A network keeps one number, `airL`; bar = airL / volumeL, at most AIR_MAX_BAR.
 *
 * - Members: air_tube (carries), air_tank (stores), air_compressor (source), blast_nozzle (user).
 * - A compressor makes 2 L/s per rpm of its shaft from 32 rpm, and nothing at 6 bar. The shaft itself belongs to the
 *   steam work: `AirHost.shaftRpm` is the seam (0 until a shaft turns it). Until then a Use on the compressor works the
 *   piston by hand (`crank`): AIR_CRANK_L a stroke, so the first Blast hearth can be built before the first engine.
 * - Leaks: a tube whose run ends in open air (exactly one tube-side neighbour that is a member, and the cell straight
 *   across from it is neither a member nor solid) leaks AIR_LEAK_L_PER_S x bar / AIR_MAX_BAR.
 * - Users: `feed` takes a user's litres for the time that passed when its network holds its minimum pressure.
 * - Floods run on place/remove only (dirty cells rebuild on the next tick or query), never every tick. Pressure is
 *   kept across a rebuild by weighting each cell with the bar of the network it came from.
 * - Saved as one 'air' entity per network, at its lowest cell (`AirEntity`); `resync` floods from them again.
 */
import { AIR_COMPRESSOR_L_PER_RPM, AIR_COMPRESSOR_MIN_RPM, AIR_CRANK_COOLDOWN_S, AIR_CRANK_L, AIR_LEAK_L_PER_S, AIR_MAX_BAR } from '../core/constants';
import type { GameBus } from '../core/context';
import type { AirSpec, BlockDef, BlockEntity, IWorld } from '../core/types';
import { CHUNK_SIZE } from '../core/types';
import { cellKey, keyX, keyY, keyZ, stepKey } from './pipeState';

export const AIR_ENTITY = 'air';

/** A saved network: its air, kept at the lowest cell of the network. */
export interface AirEntity extends BlockEntity {
  kind: 'air';
  airL: number;
}

export const isAirEntity = (e: BlockEntity | undefined): e is AirEntity => e !== undefined && e.kind === AIR_ENTITY;

/** What the networks need from the world around them. */
export interface AirHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  /** rpm of the shaft that turns the compressor at x, y, z (0: none). The steam work plugs its shafts in here. */
  shaftRpm?(x: number, y: number, z: number): number;
}

export interface AirNet {
  id: number;
  /** Cell keys of every member, and their summed volume. */
  keys: number[];
  volumeL: number;
  airL: number;
  /** Tube ends open to the air (see the file comment). */
  leaks: number;
  sources: number[];
  /** Pneumatic tube stations (senders and receivers, src/sim/pneumatics.ts). */
  stations: number[];
  /** Litres still to push in from hand strokes. */
  cranked: number;
  /** Chunk columns of unloaded cells the flood met: when one loads, the network is flooded again. */
  frontier: Set<number>;
  /** Litres made and lost last second (diagnostics and the view). */
  madeLPerS: number;
  lostLPerS: number;
}

/** What a reader sees of one air block (src/sim/views). */
export interface AirView {
  block: string;
  name: string;
  role: AirSpec['role'];
  bar: number;
  airL: number;
  volumeL: number;
  /** One sentence for the player ("Needs 2 bar - has 1.2"). */
  status: string;
}

const chunkKey = (cx: number, cz: number): number => cx * 65536 + cz;
const barOf = (n: AirNet): number => (n.volumeL > 0 ? Math.min(AIR_MAX_BAR, n.airL / n.volumeL) : 0);
const fmt = (bar: number): string => (Math.round(bar * 10) / 10).toString();

export class AirNets {
  readonly nets: AirNet[] = [];
  private readonly byCell = new Map<number, AirNet>();
  private readonly dirty = new Set<number>();
  /** Saved networks whose chunk was not loaded yet: cell key -> litres. */
  private readonly pending = new Map<number, number>();
  /** Cells that hold our saved entities now. */
  private readonly saved = new Set<number>();
  private nextId = 1;
  private strokeCool = 0;
  private second = 0;

  constructor(private readonly host: AirHost) {}

  // ---- lifecycle --------------------------------------------------------------------------------------------------

  /** Forgets everything and floods again from the saved networks (after a save was loaded into the world). */
  resync(): void {
    this.nets.length = 0;
    this.byCell.clear();
    this.dirty.clear();
    this.pending.clear();
    this.saved.clear();
    for (const e of this.host.world.entities()) {
      if (!isAirEntity(e)) continue;
      const airL = Number.isFinite(e.airL) && e.airL > 0 ? e.airL : 0;
      this.pending.set(cellKey(e.x, e.y, e.z), airL);
      this.saved.add(cellKey(e.x, e.y, e.z));
    }
    this.seedPending();
  }

  /** Tries the saved networks whose columns are loaded now; the rest wait. */
  private seedPending(): void {
    const { world } = this.host;
    for (const [key, airL] of [...this.pending]) {
      if (!world.isLoaded(keyX(key), keyZ(key))) continue;
      this.pending.delete(key);
      if (!this.at(key)) {
        // Its block is gone (an edit made while it was away): the saved air goes with it.
        this.saved.delete(key);
        world.removeEntity(keyX(key), keyY(key), keyZ(key));
        continue;
      }
      let net = this.byCell.get(key);
      if (!net) net = this.flood(key, null);
      net.airL = Math.min(net.volumeL * AIR_MAX_BAR, net.airL + airL);
    }
  }

  chunkLoaded(cx: number, cz: number): void {
    this.seedPending();
    const ck = chunkKey(cx, cz);
    for (const net of this.nets) {
      if (!net.frontier.has(ck)) continue;
      for (const key of net.keys) this.dirty.add(key);
    }
  }

  // ---- world changes ----------------------------------------------------------------------------------------------

  /** A block's id changed: members and what touches them rebuild their networks on the next tick or query. */
  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    const key = cellKey(x, y, z);
    let touches = from.air !== null || to.air !== null;
    for (let d = 0; d < 6 && !touches; d++) {
      const n = stepKey(key, d);
      touches = n >= 0 && this.byCell.has(n);
    }
    if (!touches) return;
    this.dirty.add(key);
    for (let d = 0; d < 6; d++) {
      const n = stepKey(key, d);
      if (n >= 0) this.dirty.add(n);
    }
  }

  private at(key: number): AirSpec | null {
    return this.host.world.getBlock(keyX(key), keyY(key), keyZ(key)).air;
  }

  /** Rebuilds the networks around every dirty cell, keeping the pressure they had. */
  flush(): void {
    if (this.dirty.size === 0) return;
    const seeds = [...this.dirty];
    this.dirty.clear();
    // The old networks the seeds touched dissolve; each of their cells remembers its bar.
    const bars = new Map<number, number>();
    const old = new Set<AirNet>();
    for (const s of seeds) {
      const n = this.byCell.get(s);
      if (n) old.add(n);
    }
    for (const n of old) {
      const bar = n.volumeL > 0 ? n.airL / n.volumeL : 0;
      for (const k of n.keys) {
        bars.set(k, bar);
        this.byCell.delete(k);
      }
      this.nets.splice(this.nets.indexOf(n), 1);
    }
    for (const s of seeds) if (!this.byCell.has(s) && this.at(s)) this.flood(s, bars);
    // A network that lost every cell takes its saved entity with it (the sync pass writes the others).
  }

  /** Floods the network around `start`; `bars` (the old pressure by cell) sets its air, none = empty. */
  private flood(start: number, bars: ReadonlyMap<number, number> | null): AirNet {
    const { world } = this.host;
    const net: AirNet = {
      id: this.nextId++, keys: [], volumeL: 0, airL: 0, leaks: 0, sources: [], stations: [], cranked: 0, frontier: new Set(), madeLPerS: 0, lostLPerS: 0,
    };
    const stack = [start];
    this.byCell.set(start, net);
    while (stack.length > 0) {
      const k = stack.pop() as number;
      const spec = this.at(k) as AirSpec;
      net.keys.push(k);
      net.volumeL += spec.volumeL;
      if (bars) net.airL += (bars.get(k) ?? 0) * spec.volumeL;
      if (spec.role === 'source') net.sources.push(k);
      if (spec.role === 'station') net.stations.push(k);
      let joined = 0;
      let lastDir = -1;
      for (let d = 0; d < 6; d++) {
        const n = stepKey(k, d);
        if (n < 0) continue;
        const nx = keyX(n);
        const nz = keyZ(n);
        if (!world.isLoaded(nx, nz)) {
          net.frontier.add(chunkKey(Math.floor(nx / CHUNK_SIZE), Math.floor(nz / CHUNK_SIZE)));
          continue;
        }
        if (!world.getBlock(nx, keyY(n), nz).air) continue;
        joined++;
        lastDir = d;
        if (!this.byCell.has(n)) {
          this.byCell.set(n, net);
          stack.push(n);
        }
      }
      if (spec.role === 'tube' && joined === 1 && this.opensToAir(k, lastDir)) net.leaks++;
    }
    net.airL = Math.min(net.airL, net.volumeL * AIR_MAX_BAR);
    this.nets.push(net);
    return net;
  }

  /** Whether the tube at `k`, joined only towards `dir`, ends in open air on the side across from it. */
  private opensToAir(k: number, dir: number): boolean {
    const across = stepKey(k, dir ^ 1);
    if (across < 0) return false;
    const b = this.host.world.getBlock(keyX(across), keyY(across), keyZ(across));
    return b.air === null && !b.solid;
  }

  // ---- queries ----------------------------------------------------------------------------------------------------

  netAt(x: number, y: number, z: number): AirNet | null {
    this.flush();
    return this.byCell.get(cellKey(x, y, z)) ?? null;
  }

  /** Bar of the network at a cell (0 when it is in none). */
  barAt(x: number, y: number, z: number): number {
    const n = this.netAt(x, y, z);
    return n ? barOf(n) : 0;
  }

  view(x: number, y: number, z: number): AirView | null {
    const def = this.host.world.getBlock(x, y, z);
    const spec = def.air;
    if (!spec) return null;
    const net = this.netAt(x, y, z);
    const bar = net ? barOf(net) : 0;
    let status: string;
    switch (spec.role) {
      case 'user':
        status = bar >= (spec.minBar ?? 0) ? `Fed - ${fmt(bar)} bar` : `Needs ${fmt(spec.minBar ?? 0)} bar - has ${fmt(bar)}`;
        break;
      case 'source': {
        const rpm = this.host.shaftRpm?.(x, y, z) ?? 0;
        status = bar >= AIR_MAX_BAR ? `Stalled at ${AIR_MAX_BAR} bar`
          : rpm >= AIR_COMPRESSOR_MIN_RPM ? `Compressing at ${fmt(bar)} bar`
          : `${fmt(bar)} bar - Use to pump by hand`;
        break;
      }
      case 'tube':
        status = net && net.leaks > 0 ? `${fmt(bar)} bar - an open end leaks air` : `${fmt(bar)} bar`;
        break;
      default:
        status = `${fmt(bar)} of ${AIR_MAX_BAR} bar`;
    }
    return { block: def.key, name: def.name, role: spec.role, bar, airL: net?.airL ?? 0, volumeL: net?.volumeL ?? spec.volumeL, status };
  }

  // ---- actions ----------------------------------------------------------------------------------------------------

  /** A stroke of the hand crank on a compressor. False when it was too soon, or there is no compressor. */
  crank(x: number, y: number, z: number): boolean {
    const net = this.netAt(x, y, z);
    if (!net || !net.sources.includes(cellKey(x, y, z)) || this.strokeCool > 0) return false;
    this.strokeCool = AIR_CRANK_COOLDOWN_S;
    net.cranked += AIR_CRANK_L;
    return true;
  }

  /**
   * A user takes `useLPerS x dt` litres. True when its network holds the minimum pressure and had the air; the
   * hearths ask each tick for every nozzle of a burning furnace.
   */
  feed(x: number, y: number, z: number, dt: number): boolean {
    const spec = this.host.world.getBlock(x, y, z).air;
    if (!spec || spec.role !== 'user') return false;
    const net = this.netAt(x, y, z);
    if (!net || barOf(net) < (spec.minBar ?? 0)) return false;
    const need = (spec.useLPerS ?? 0) * dt;
    if (net.airL < need) return false;
    net.airL -= need;
    return true;
  }

  /** Takes `litres` from the network at a cell when it holds `minBar`: a pneumatic sender's shot. */
  spend(x: number, y: number, z: number, litres: number, minBar: number): boolean {
    const net = this.netAt(x, y, z);
    if (!net || barOf(net) < minBar || net.airL < litres) return false;
    net.airL -= litres;
    return true;
  }

  // ---- ticking ----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.seedPending();
    this.flush();
    if (this.strokeCool > 0) this.strokeCool -= dt;
    const cap = (n: AirNet): number => n.volumeL * AIR_MAX_BAR;
    for (const net of this.nets) {
      let made = 0;
      for (const s of net.sources) {
        const rpm = this.host.shaftRpm?.(keyX(s), keyY(s), keyZ(s)) ?? 0;
        if (rpm >= AIR_COMPRESSOR_MIN_RPM && net.airL < cap(net)) made += AIR_COMPRESSOR_L_PER_RPM * rpm * dt;
      }
      if (net.cranked > 0) {
        const take = Math.min(net.cranked, Math.max(0, cap(net) - net.airL));
        net.cranked = 0;
        made += take;
      }
      const bar = barOf(net);
      const lost = net.leaks > 0 && net.airL > 0 ? Math.min(net.airL, net.leaks * AIR_LEAK_L_PER_S * (bar / AIR_MAX_BAR) * dt) : 0;
      net.airL = Math.max(0, Math.min(cap(net), net.airL + made - lost));
      net.madeLPerS = made / dt;
      net.lostLPerS = lost / dt;
    }
    this.second += dt;
    if (this.second >= 1) {
      this.second = 0;
      this.save();
    }
  }

  /** Writes each network's air to its anchor entity and drops the entities of networks that are gone. */
  save(): void {
    this.flush();
    const { world } = this.host;
    const keep = new Set<number>();
    for (const net of this.nets) {
      if (net.airL <= 0.5 && !this.saved.has(net.keys[0])) continue;
      // A station cell keeps its own entity (its capsules on the way, pneumatics.ts): the air is saved on another member.
      let anchor = -1;
      for (const k of net.keys) if ((anchor < 0 || k < anchor) && !net.stations.includes(k)) anchor = k;
      if (anchor < 0) continue;
      keep.add(anchor);
      let e = world.getEntity(keyX(anchor), keyY(anchor), keyZ(anchor));
      if (!isAirEntity(e)) {
        e = { kind: AIR_ENTITY, x: keyX(anchor), y: keyY(anchor), z: keyZ(anchor), airL: net.airL } as AirEntity;
        world.setEntity(e);
      }
      (e as AirEntity).airL = Math.round(net.airL * 100) / 100;
    }
    for (const k of [...this.saved]) {
      if (keep.has(k) || this.pending.has(k)) continue;
      this.saved.delete(k);
      const e = world.getEntity(keyX(k), keyY(k), keyZ(k));
      if (isAirEntity(e)) world.removeEntity(keyX(k), keyY(k), keyZ(k));
    }
    for (const k of keep) this.saved.add(k);
  }
}
