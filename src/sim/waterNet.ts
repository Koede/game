/**
 * The Bronze Age water network (docs/api/plumbing.md). Its own graph, like the air network (airNet.ts) and apart from
 * the Forge's fluid pipes: every touching block with `BlockSpec.plumb`, and every boiler Water Port a member touches,
 * joins one network. A network keeps one number, `waterL`, at most the summed `volumeL` of its members.
 *
 * - Members: water_pipe (carries), cistern (stores; open to the sky it catches rain), hand_pump (lifts water it
 *   touches), sprinkler (waters the crops round it). A Water Port is a member with no room: it takes water out.
 * - A hand pump must touch still water. Each Use is a stroke (PLUMB_STROKE_L); a workshop shaft turning it lifts
 *   PLUMB_PUMP_L_PER_RPM a second per rpm (`WaterHost.shaftRpm`, the same seam the air compressor uses). Water with two
 *   sources beside it never runs dry; a lone source is used up after LITRES_PER_BUCKET litres, like the Forge pump.
 * - A sprinkler sprays SPRINKLER_L_PER_S while its network holds any water. While it sprays, crops within
 *   SPRINKLER_RADIUS across and up to SPRINKLER_REACH_DOWN below count as watered (`irrigated`), roofed or not.
 * - Floods run on place/remove only (dirty cells rebuild on the next tick or query). Water is kept across a rebuild
 *   by giving each cell the fill fraction of the network it came from.
 * - Saved as one 'water' entity per network, at its lowest cell (`WaterEntity`); `resync` floods from them again.
 */
import {
  CISTERN_RAIN_L_PER_S, LITRES_PER_BUCKET, PLUMB_PORT_L_PER_S, PLUMB_PUMP_L_PER_RPM, PLUMB_STROKE_COOLDOWN_S, PLUMB_STROKE_L,
  SPRINKLER_L_PER_S, SPRINKLER_RADIUS, SPRINKLER_REACH_DOWN,
} from '../core/constants';
import type { GameBus } from '../core/context';
import { joinsPlumbing } from '../core/registry';
import type { BlockDef, BlockEntity, IWorld, PlumbSpec } from '../core/types';
import { AIR, CHUNK_SIZE, FACE_DIRS, WORLD_HEIGHT, withActive, voxelActive } from '../core/types';
import { isLiquidSource, refillsAsSource } from '../world/water';
import { cellKey, keyX, keyY, keyZ, stepKey } from './pipeState';

export const WATER_ENTITY = 'water';

/** A saved network: its water, kept at the lowest cell of the network. */
export interface WaterEntity extends BlockEntity {
  kind: 'water';
  waterL: number;
}

export const isWaterEntity = (e: BlockEntity | undefined): e is WaterEntity => e !== undefined && e.kind === WATER_ENTITY;

/** What the networks need from the world around them. */
export interface WaterHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  /** rpm of the workshop shaft turning the hand pump at x, y, z (0: none). */
  shaftRpm?(x: number, y: number, z: number): number;
  /** Whether rain falls at this position now (the weather; the caller checked the open sky). */
  rainAt?(x: number, y: number, z: number): boolean;
}

export interface WaterNet {
  id: number;
  keys: number[];
  capL: number;
  waterL: number;
  pumps: number[];
  sprinklers: number[];
  cisterns: number[];
  ports: number[];
  frontier: Set<number>;
  /** Litres in and out last tick, per second (the view). */
  inLPerS: number;
  outLPerS: number;
}

/** What a reader sees of one plumbing block. */
export interface WaterView {
  block: string;
  name: string;
  role: PlumbSpec['role'] | 'port';
  waterL: number;
  capL: number;
  /** One sentence for the player ("Spraying - 300 of 450 L in the line"). */
  status: string;
}

const chunkKey = (cx: number, cz: number): number => cx * 65536 + cz;
const fmtL = (l: number): string => `${Math.round(l).toLocaleString('en-US')} L`;

/** Whether the touching water at (x, y, z) is a still source. */
function stillWater(world: IWorld, x: number, y: number, z: number): boolean {
  return world.getBlock(x, y, z).liquid === 'water' && isLiquidSource(world.getVoxel(x, y, z));
}

export class WaterNets {
  readonly nets: WaterNet[] = [];
  private readonly byCell = new Map<number, WaterNet>();
  private readonly dirty = new Set<number>();
  private readonly pending = new Map<number, number>();
  private readonly saved = new Set<number>();
  /** Sprinklers that sprayed on the last tick (cell keys). */
  private readonly spraying = new Set<number>();
  /** Litres each pump has drawn from a lone source (cell key of the pump). */
  private readonly drawn = new Map<number, number>();
  /** Cisterns under open sky, refreshed once a second. */
  private readonly openSky = new Set<number>();
  private nextId = 1;
  private strokeCool = 0;
  private second = 1;
  private sprayClock = 0;

  constructor(private readonly host: WaterHost) {}

  // ---- lifecycle --------------------------------------------------------------------------------------------------

  resync(): void {
    this.nets.length = 0;
    this.byCell.clear();
    this.dirty.clear();
    this.pending.clear();
    this.saved.clear();
    this.spraying.clear();
    for (const e of this.host.world.entities()) {
      if (!isWaterEntity(e)) continue;
      const waterL = Number.isFinite(e.waterL) && e.waterL > 0 ? e.waterL : 0;
      this.pending.set(cellKey(e.x, e.y, e.z), waterL);
      this.saved.add(cellKey(e.x, e.y, e.z));
    }
    this.seedPending();
  }

  private seedPending(): void {
    const { world } = this.host;
    for (const [key, waterL] of [...this.pending]) {
      if (!world.isLoaded(keyX(key), keyZ(key))) continue;
      this.pending.delete(key);
      if (!this.member(key)) {
        this.saved.delete(key);
        world.removeEntity(keyX(key), keyY(key), keyZ(key));
        continue;
      }
      let net = this.byCell.get(key);
      if (!net) net = this.flood(key, null);
      net.waterL = Math.min(net.capL, net.waterL + waterL);
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

  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    if (from.id === to.id) return;
    const key = cellKey(x, y, z);
    let touches = joinsPlumbing(from) || joinsPlumbing(to);
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

  private def(key: number): BlockDef {
    return this.host.world.getBlock(keyX(key), keyY(key), keyZ(key));
  }

  /** Whether the cell is a member: a plumbing block, or a port next to a plumbing block. */
  private member(key: number): boolean {
    const def = this.def(key);
    if (def.plumb) return true;
    if (!joinsPlumbing(def)) return false;
    for (let d = 0; d < 6; d++) {
      const n = stepKey(key, d);
      if (n >= 0 && this.def(n).plumb) return true;
    }
    return false;
  }

  flush(): void {
    if (this.dirty.size === 0) return;
    const seeds = [...this.dirty];
    this.dirty.clear();
    const fills = new Map<number, number>();
    const old = new Set<WaterNet>();
    for (const s of seeds) {
      const n = this.byCell.get(s);
      if (n) old.add(n);
    }
    for (const n of old) this.dissolve(n, fills);
    // Lines flood from their plumbing blocks; a port only ever joins the line of a plumbing block beside it.
    for (const s of seeds) if (!this.byCell.has(s) && this.def(s).plumb) this.flood(s, fills);
    for (const s of seeds) {
      if (this.byCell.has(s) || !this.member(s)) continue;
      for (let d = 0; d < 6; d++) {
        const n = stepKey(s, d);
        if (n < 0 || !this.def(n).plumb) continue;
        const net = this.byCell.get(n);
        if (net) this.dissolve(net, fills);
        this.flood(n, fills);
        break;
      }
    }
  }

  /** Takes a network apart, remembering each cell's fill. */
  private dissolve(n: WaterNet, fills: Map<number, number>): void {
    const fill = n.capL > 0 ? n.waterL / n.capL : 0;
    for (const k of n.keys) {
      fills.set(k, fill);
      this.byCell.delete(k);
    }
    this.nets.splice(this.nets.indexOf(n), 1);
  }

  private flood(start: number, fills: ReadonlyMap<number, number> | null): WaterNet {
    const { world } = this.host;
    const net: WaterNet = {
      id: this.nextId++, keys: [], capL: 0, waterL: 0, pumps: [], sprinklers: [], cisterns: [], ports: [],
      frontier: new Set(), inLPerS: 0, outLPerS: 0,
    };
    const stack = [start];
    this.byCell.set(start, net);
    while (stack.length > 0) {
      const k = stack.pop() as number;
      const spec = this.def(k).plumb;
      net.keys.push(k);
      if (!spec) {
        // A port: it joins, holds nothing and carries the line no further (a boiler wall is not a pipe).
        net.ports.push(k);
        continue;
      }
      net.capL += spec.volumeL;
      if (fills) net.waterL += (fills.get(k) ?? 0) * spec.volumeL;
      if (spec.role === 'pump') net.pumps.push(k);
      else if (spec.role === 'sprinkler') net.sprinklers.push(k);
      else if (spec.role === 'cistern') net.cisterns.push(k);
      for (let d = 0; d < 6; d++) {
        const n = stepKey(k, d);
        if (n < 0) continue;
        const nx = keyX(n);
        const nz = keyZ(n);
        if (!world.isLoaded(nx, nz)) {
          net.frontier.add(chunkKey(Math.floor(nx / CHUNK_SIZE), Math.floor(nz / CHUNK_SIZE)));
          continue;
        }
        if (!joinsPlumbing(world.getBlock(nx, keyY(n), nz)) || this.byCell.has(n)) continue;
        this.byCell.set(n, net);
        stack.push(n);
      }
    }
    net.waterL = Math.min(net.waterL, net.capL);
    this.nets.push(net);
    return net;
  }

  // ---- queries ----------------------------------------------------------------------------------------------------

  netAt(x: number, y: number, z: number): WaterNet | null {
    this.flush();
    return this.byCell.get(cellKey(x, y, z)) ?? null;
  }

  /** The still water a hand pump at this cell touches, or null. */
  private pumpWater(key: number): [number, number, number] | null {
    const x = keyX(key);
    const y = keyY(key);
    const z = keyZ(key);
    for (const [dx, dy, dz] of FACE_DIRS) if (stillWater(this.host.world, x + dx, y + dy, z + dz)) return [x + dx, y + dy, z + dz];
    return null;
  }

  /** Whether a sprinkler sprays now (at this cell). */
  isSpraying(x: number, y: number, z: number): boolean {
    return this.spraying.has(cellKey(x, y, z));
  }

  /** Sprinklers spraying now, as [x, y, z] (the renderer's droplets, tests). */
  sprayingAt(): Array<[number, number, number]> {
    return [...this.spraying].map((k) => [keyX(k), keyY(k), keyZ(k)]);
  }

  /** Whether a crop at (x, y, z) is watered by a spraying sprinkler. Cheap: sprinklers are few. */
  irrigated(x: number, y: number, z: number): boolean {
    for (const k of this.spraying) {
      const dy = keyY(k) - y;
      if (dy < 0 || dy > SPRINKLER_REACH_DOWN) continue;
      if (Math.abs(keyX(k) - x) <= SPRINKLER_RADIUS && Math.abs(keyZ(k) - z) <= SPRINKLER_RADIUS) return true;
    }
    return false;
  }

  view(x: number, y: number, z: number): WaterView | null {
    const def = this.host.world.getBlock(x, y, z);
    const net = this.netAt(x, y, z);
    if (!def.plumb && !(net && joinsPlumbing(def))) return null;
    const waterL = net?.waterL ?? 0;
    const capL = net?.capL ?? def.plumb?.volumeL ?? 0;
    const line = `${fmtL(waterL)} of ${fmtL(capL)} in the line`;
    const role: WaterView['role'] = def.plumb?.role ?? 'port';
    let status: string;
    switch (role) {
      case 'pump': {
        const key = cellKey(x, y, z);
        const rpm = this.host.shaftRpm?.(x, y, z) ?? 0;
        status = !this.pumpWater(key) ? 'Must touch still water'
          : waterL >= capL - 0.5 ? `Full - ${line}`
          : rpm > 0 ? `Pumping ${fmtL(rpm * PLUMB_PUMP_L_PER_RPM)}/s - ${line}`
          : `Use to pump - ${line}`;
        break;
      }
      case 'sprinkler':
        status = this.isSpraying(x, y, z) ? `Watering crops - ${line}` : 'Dry - pump water into its line';
        break;
      case 'cistern':
        status = this.openSky.has(cellKey(x, y, z)) ? `${line} - catches rain` : line;
        break;
      case 'port':
        status = waterL > 0 ? `Filling the boiler - ${line}` : 'No water in the line';
        break;
      default:
        status = waterL > 0 ? line : 'Empty';
    }
    return { block: def.key, name: def.name, role, waterL, capL, status };
  }

  // ---- actions ----------------------------------------------------------------------------------------------------

  /** A stroke of a hand pump's handle. False when it was too soon, the pump touches no still water, or it is full. */
  stroke(x: number, y: number, z: number): boolean {
    const key = cellKey(x, y, z);
    const net = this.netAt(x, y, z);
    if (!net || !net.pumps.includes(key) || this.strokeCool > 0 || !this.pumpWater(key)) return false;
    if (net.waterL >= net.capL - 0.5) return false;
    this.strokeCool = PLUMB_STROKE_COOLDOWN_S;
    net.waterL = Math.min(net.capL, net.waterL + this.lift(key, PLUMB_STROKE_L));
    return true;
  }

  /** Takes up to `litres` out of the line a port at (x, y, z) belongs to; returns what it took. */
  draw(x: number, y: number, z: number, litres: number): number {
    const net = this.netAt(x, y, z);
    if (!net || litres <= 0) return 0;
    const n = Math.min(litres, net.waterL);
    net.waterL -= n;
    return n;
  }

  /** The most a Water Port takes from its line in `dt` seconds. */
  static portRate(dt: number): number {
    return PLUMB_PORT_L_PER_S * dt;
  }

  // ---- ticking ----------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.seedPending();
    this.flush();
    if (this.strokeCool > 0) this.strokeCool -= dt;
    this.second += dt;
    const everySecond = this.second >= 1;
    if (everySecond) {
      this.second = 0;
      this.refreshSky();
    }
    const nowSpraying = new Set<number>();
    for (const net of this.nets) {
      if (!this.host.world.isLoaded(keyX(net.keys[0]), keyZ(net.keys[0]))) continue;
      let gained = 0;
      for (const p of net.pumps) {
        const rpm = this.host.shaftRpm?.(keyX(p), keyY(p), keyZ(p)) ?? 0;
        if (rpm > 0 && this.pumpWater(p)) gained += this.lift(p, rpm * PLUMB_PUMP_L_PER_RPM * dt);
      }
      for (const c of net.cisterns) {
        if (this.openSky.has(c) && this.host.rainAt?.(keyX(c), keyY(c) + 1, keyZ(c))) gained += CISTERN_RAIN_L_PER_S * dt;
      }
      net.waterL = Math.min(net.capL, net.waterL + gained);
      let used = 0;
      for (const s of net.sprinklers) {
        const need = SPRINKLER_L_PER_S * dt;
        if (net.waterL < need) break;
        net.waterL -= need;
        used += need;
        nowSpraying.add(s);
      }
      net.inLPerS = dt > 0 ? gained / dt : 0;
      net.outLPerS = dt > 0 ? used / dt : 0;
    }
    this.setSpraying(nowSpraying);
    this.sprayClock += dt;
    if (this.sprayClock >= 0.5) {
      this.sprayClock = 0;
      for (const k of this.spraying) this.host.bus.emit('water:spray', { x: keyX(k), y: keyY(k), z: keyZ(k) });
    }
    if (everySecond) this.save();
  }

  /** Lifts `litres` through the pump at `p`, using up a lone source block now and then. Returns the litres. */
  private lift(p: number, litres: number): number {
    const src = this.pumpWater(p);
    if (!src || litres <= 0) return 0;
    const [x, y, z] = src;
    if (refillsAsSource(this.host.world, x, y, z)) return litres;
    let d = (this.drawn.get(p) ?? 0) + litres;
    if (d >= LITRES_PER_BUCKET) {
      d -= LITRES_PER_BUCKET;
      this.host.world.setVoxel(x, y, z, AIR, 'sim');
    }
    this.drawn.set(p, d);
    return litres;
  }

  /** Sprinkler voxels show their spray texture while they spray. */
  private setSpraying(now: Set<number>): void {
    const { world } = this.host;
    const flip = (k: number, on: boolean): void => {
      const x = keyX(k);
      const y = keyY(k);
      const z = keyZ(k);
      if (!world.isLoaded(x, z) || world.getBlock(x, y, z).plumb?.role !== 'sprinkler') return;
      const v = world.getVoxel(x, y, z);
      if (voxelActive(v) !== on) world.setVoxel(x, y, z, withActive(v, on), 'sim');
    };
    for (const k of this.spraying) if (!now.has(k)) flip(k, false);
    for (const k of now) if (!this.spraying.has(k)) flip(k, true);
    this.spraying.clear();
    for (const k of now) this.spraying.add(k);
  }

  private refreshSky(): void {
    const { world } = this.host;
    this.openSky.clear();
    for (const net of this.nets) {
      for (const c of net.cisterns) {
        const x = keyX(c);
        const z = keyZ(c);
        let open = true;
        for (let y = keyY(c) + 1; y < WORLD_HEIGHT && open; y++) {
          const b = world.getBlock(x, y, z);
          if (b.solid || b.liquid) open = false;
        }
        if (open) this.openSky.add(c);
      }
    }
  }

  save(): void {
    this.flush();
    const { world } = this.host;
    const keep = new Set<number>();
    for (const net of this.nets) {
      let anchor = -1;
      for (const k of net.keys) if (this.def(k).plumb && (anchor < 0 || k < anchor)) anchor = k;
      if (anchor < 0) continue;
      if (net.waterL <= 0.5 && !this.saved.has(anchor)) continue;
      keep.add(anchor);
      let e = world.getEntity(keyX(anchor), keyY(anchor), keyZ(anchor));
      if (e && !isWaterEntity(e)) continue;
      if (!e) {
        e = { kind: WATER_ENTITY, x: keyX(anchor), y: keyY(anchor), z: keyZ(anchor), waterL: net.waterL } as WaterEntity;
        world.setEntity(e);
      }
      (e as WaterEntity).waterL = Math.round(net.waterL * 100) / 100;
    }
    for (const k of [...this.saved]) {
      if (keep.has(k) || this.pending.has(k)) continue;
      this.saved.delete(k);
      const e = world.getEntity(keyX(k), keyY(k), keyZ(k));
      if (isWaterEntity(e)) world.removeEntity(keyX(k), keyY(k), keyZ(k));
    }
    for (const k of keep) this.saved.add(k);
  }
}
