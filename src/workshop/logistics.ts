/**
 * Item and fluid logistics of the Bronze workshop (docs/OVERHAUL_PLAN.md A.5-A.7, docs/api/workshop.md): depots, funnels,
 * chutes, basins with mixers and presses, spouts and item drains, deployers, mechanical arms and drills.
 *
 * Every cell that can hold or pass items answers three questions in one place: `accept` (how much of an item it takes),
 * `take` (pull a stack out) and `peek` (what is inside). Crates are read straight from their block entity. Movers
 * (funnel, chute, arm) only ever use those three, so any new container works with all of them.
 */
import type { GameBus } from '../core/context';
import { BASIN_RECIPES, basinCard } from '../content/basinWorkshop';
import { blockId, blockOrNull, fluidInBucket, fluidOrNull, itemOrNull } from '../core/registry';
import { Facing, makeVoxel, voxelFacing, type IWorld } from '../core/types';
import { trunkAbove } from '../game/felling';
import { rollDrops } from '../game/mining';
import type { GroundItems } from '../game/groundItems';
import { stackLimit } from '../game/inventory';

/** Block kinds this module owns state for. */
export const LOGI_KINDS = ['funnel', 'chute', 'depot', 'basin', 'spout', 'item_drain', 'mixer', 'mech_press', 'deployer', 'mech_arm', 'mech_drill', 'saw_arm', 'vacuum_collector', 'item_vault', 'tally_board', 'skiff'] as const;
const LOGI = new Set<string>(LOGI_KINDS);
export const isLogistic = (kind: string): boolean => LOGI.has(kind);
/** Logistic kinds that need shaft power (they are also kinetic parts). */
export const POWERED = new Set(['mixer', 'mech_press', 'deployer', 'mech_arm', 'mech_drill', 'saw_arm', 'vacuum_collector']);
/** Cells ground items resting on top are taken into. */
const TAKES_GROUND = new Set(['depot', 'basin', 'funnel', 'chute', 'deployer', 'item_drain', 'item_vault', 'tally_board', 'skiff']);

export const BASIN_LITRES = 1000;
export const BASIN_ITEM_KINDS = 2;
export const CELL_CAP = 16;
export const MOVE_S = 0.25;
export const ARM_CYCLE_S = 1.5;
export const ARM_REACH = 3;
export const ARM_TARGETS = 4;
export const DEPLOYER_CYCLE_S = 2;
export const DRILL_MIN_S = 0.5;
export const DRILL_HARDNESS_S = 1.2;
export const SPOUT_S = 1;
export const SAW_ARM_CYCLE_S = 3;
export const SAW_ARM_MAX_LOGS = 48;
export const VACUUM_RADIUS = 4;
export const VAULT_STACKS = 108;

/** The result of a deployer / drill action: nothing, done and the held item kept, or done and one item used up. */
export type ActResult = false | 'used' | 'consumed';
export interface MachineActAction { item: string; target: [number, number, number]; face: Facing; mode: 'auto' | 'use' | 'strike' | 'place' | 'mine' }

export interface LogiHost {
  readonly world: IWorld;
  readonly ground: GroundItems;
  readonly bus: GameBus;
  rng(): number;
  /** True when the signal layer lets a machine at the cell work. */
  gate(x: number, y: number, z: number): boolean;
  /** Absolute rpm of the kinetic part at the cell (0 = still or not a part). */
  rpmAt(x: number, y: number, z: number): number;
  twinAccept(x: number, y: number, z: number, item: string, n: number, commit: boolean): number;
  act(): ((a: MachineActAction) => ActResult | null | undefined) | null;
  /** Fluid blocks of the pipe network (tanks, machine ports) reached with a bucket: spouts and drains use them. */
  fluidBlock(): { is(x: number, y: number, z: number): boolean; use(x: number, y: number, z: number, item: string): string | null } | null;
}

export interface Cell {
  kind: string;
  x: number;
  y: number;
  z: number;
  items: Record<string, number>;
  fluid: { key: string; litres: number } | null;
  filter: string | null;
  /** Seconds into the current move / cycle / job. */
  timer: number;
  /** Mixer / press / drill progress, seconds of work done. */
  progress: number;
  src: string | null;
  targets: string[];
  rr: number;
  /** 0..1 of the swing, for the renderer. */
  phase: number;
}

export interface LogiSnapshot { cells: [number, number, number, string, Record<string, number>, { key: string; litres: number } | null, string | null, string | null, string[]][] }

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const parse = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];
export const FACE_DELTA: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };
const FLUIDS_EMPTY = new Set(['pail', 'bronze_bucket', 'empty_canister']);
const total = (m: Record<string, number>): number => Object.values(m).reduce((s, n) => s + n, 0);

interface CrateLike { kind: string; slots: ({ item: string; count: number; durability?: number } | null)[] }

export class Logistics {
  readonly cells = new Map<string, Cell>();
  /** The arm being configured with the wrench. */
  private configuring: string | null = null;

  constructor(private readonly host: LogiHost) {}

  // ---- Tracking ---------------------------------------------------------------------------------------

  noteBlock(x: number, y: number, z: number, kind: string): void {
    const key = k3(x, y, z);
    if (LOGI.has(kind)) {
      if (this.cells.get(key)?.kind !== kind) this.cells.set(key, { kind, x, y, z, items: {}, fluid: null, filter: null, timer: 0, progress: 0, src: null, targets: [], rr: 0, phase: 0 });
      return;
    }
    const c = this.cells.get(key);
    if (!c) return;
    for (const [item, n] of Object.entries(c.items)) if (n > 0) this.host.ground.spawn(item, n, x + 0.5, y + 0.5, z + 0.5);
    this.cells.delete(key);
    if (this.configuring === key) this.configuring = null;
  }

  // ---- Item primitives --------------------------------------------------------------------------------

  private crateAt(x: number, y: number, z: number): CrateLike | null {
    const e = (this.host.world as { getEntity?: (x: number, y: number, z: number) => unknown }).getEntity?.(x, y, z) as CrateLike | undefined;
    return e && e.kind === 'crate' && Array.isArray(e.slots) ? e : null;
  }

  /** How many of `item` the cell takes (and takes them when `commit`). */
  accept(x: number, y: number, z: number, item: string, n: number, commit = true): number {
    if (n <= 0 || !itemOrNull(item)) return 0;
    const block = this.host.world.getBlock(x, y, z).key;
    const c = this.cells.get(k3(x, y, z));
    if (block === 'conveyor_belt') {
      if (commit) this.host.ground.spawn(item, n, x + 0.5, y + 0.6, z + 0.5, { scatter: false, delayS: 0.5 });
      return n;
    }
    const crate = this.crateAt(x, y, z);
    if (crate) return this.acceptCrate(crate, item, n, commit);
    if (!c) return this.host.twinAccept(x, y, z, item, n, commit);
    switch (c.kind) {
      case 'skiff':
      case 'depot': {
        const kinds = Object.keys(c.items);
        if (kinds.length && kinds[0] !== item) return 0;
        const take = Math.min(n, stackLimit(item) - (c.items[item] ?? 0));
        if (take > 0 && commit) c.items[item] = (c.items[item] ?? 0) + take;
        return Math.max(0, take);
      }
      case 'basin': {
        if (!(item in c.items) && Object.keys(c.items).length >= BASIN_ITEM_KINDS) return 0;
        const take = Math.min(n, CELL_CAP - (c.items[item] ?? 0));
        if (take > 0 && commit) c.items[item] = (c.items[item] ?? 0) + take;
        return Math.max(0, take);
      }
      case 'funnel':
      case 'chute':
      case 'tally_board':
      case 'vacuum_collector': {
        if (c.filter && c.filter !== item) return 0;
        const take = Math.min(n, CELL_CAP - total(c.items));
        if (take > 0 && commit) c.items[item] = (c.items[item] ?? 0) + take;
        return Math.max(0, take);
      }
      case 'deployer': {
        const kinds = Object.keys(c.items);
        if (kinds.length && kinds[0] !== item) return 0;
        const take = Math.min(n, CELL_CAP - total(c.items));
        if (take > 0 && commit) c.items[item] = (c.items[item] ?? 0) + take;
        return Math.max(0, take);
      }
      case 'item_vault': {
        const limit = stackLimit(item);
        let stacks = 0;
        for (const [it, n] of Object.entries(c.items)) stacks += Math.ceil(n / stackLimit(it));
        const have = c.items[item] ?? 0;
        const room = (VAULT_STACKS - stacks) * limit + (have % limit === 0 ? 0 : limit - (have % limit));
        const take = Math.min(n, room);
        if (take > 0 && commit) c.items[item] = have + take;
        return Math.max(0, take);
      }
      case 'item_drain': {
        const f = fluidInBucket(item);
        const basin = this.cells.get(k3(x, y - 1, z));
        const fb = this.host.fluidBlock();
        if (f?.bucket && basin?.kind !== 'basin' && fb?.is(x, y - 1, z)) {
          if (total(c.items) >= CELL_CAP) return 0;
          if (!commit) return 1;
          const back = fb.use(x, y - 1, z, item);
          if (!back) return 0;
          c.items[back] = (c.items[back] ?? 0) + 1;
          return 1;
        }
        if (!f || !f.bucket || basin?.kind !== 'basin') return 0;
        if (basin.fluid && basin.fluid.key !== f.key) return 0;
        if ((basin.fluid?.litres ?? 0) + 1000 > BASIN_LITRES) return 0;
        if (total(c.items) >= CELL_CAP) return 0;
        if (commit) {
          basin.fluid = { key: f.key, litres: (basin.fluid?.litres ?? 0) + 1000 };
          c.items[f.bucket.empty] = (c.items[f.bucket.empty] ?? 0) + 1;
        }
        return 1;
      }
      default: return 0;
    }
  }

  private acceptCrate(crate: CrateLike, item: string, n: number, commit: boolean): number {
    const limit = stackLimit(item);
    let left = n;
    for (const s of crate.slots) {
      if (s && s.item === item && s.durability === undefined && s.count < limit && left > 0) {
        const t = Math.min(limit - s.count, left);
        if (commit) s.count += t;
        left -= t;
      }
    }
    for (let i = 0; i < crate.slots.length && left > 0; i++) {
      if (crate.slots[i]) continue;
      const t = Math.min(limit, left);
      if (commit) crate.slots[i] = { item, count: t };
      left -= t;
    }
    return n - left;
  }

  /** What the cell holds that can be pulled out. */
  peek(x: number, y: number, z: number): { item: string; count: number }[] {
    const crate = this.crateAt(x, y, z);
    if (crate) {
      const out: { item: string; count: number }[] = [];
      for (const s of crate.slots) if (s && s.durability === undefined) out.push({ item: s.item, count: s.count });
      return out;
    }
    const c = this.cells.get(k3(x, y, z));
    if (!c) return [];
    if (!['depot', 'basin', 'funnel', 'chute', 'deployer', 'item_drain', 'item_vault', 'vacuum_collector', 'skiff'].includes(c.kind)) return [];
    return Object.entries(c.items).filter(([, n]) => n > 0).map(([item, count]) => ({ item, count }));
  }

  /** Pulls up to `max` of `item` (or of whatever is there when null) out of the cell. */
  take(x: number, y: number, z: number, item: string | null, max = CELL_CAP): { item: string; count: number } | null {
    const crate = this.crateAt(x, y, z);
    if (crate) {
      for (let i = 0; i < crate.slots.length; i++) {
        const s = crate.slots[i];
        if (!s || s.durability !== undefined || (item && s.item !== item)) continue;
        const t = Math.min(max, s.count);
        s.count -= t;
        const got = { item: s.item, count: t };
        if (s.count <= 0) crate.slots[i] = null;
        return got;
      }
      return null;
    }
    const c = this.cells.get(k3(x, y, z));
    if (!c) return null;
    for (const [it, count] of Object.entries(c.items)) {
      if (count <= 0 || (item && it !== item)) continue;
      const t = Math.min(max, count);
      c.items[it] -= t;
      if (c.items[it] <= 0) delete c.items[it];
      return { item: it, count: t };
    }
    return null;
  }

  // ---- Use by the player ------------------------------------------------------------------------------

  use(x: number, y: number, z: number, held: { item: string; count: number } | null, takeHeld: (n: number) => void): 'worked' | 'refused' | null {
    const c = this.cells.get(k3(x, y, z));
    if (!c) return null;
    const placing = !!(held && blockOrNull(held.item));
    if (held?.item === 'wrench' && (c.kind === 'mech_arm' || this.configuring)) return this.wrench(c, x, y, z);
    if (placing) return null;
    switch (c.kind) {
      case 'tally_board':
        c.rr = 0;
        this.host.bus.emit('toast', { text: 'Count reset', kind: 'info' });
        return 'worked';
      case 'funnel':
      case 'chute':
        c.filter = held ? held.item : null;
        this.host.bus.emit('toast', { text: held ? `Filter: ${itemOrNull(held.item)?.name ?? held.item}` : 'Filter cleared', kind: 'info' });
        return 'worked';
      case 'basin': {
        const f = held ? fluidInBucket(held.item) : null;
        if (held && f?.bucket) {
          if ((c.fluid && c.fluid.key !== f.key) || (c.fluid?.litres ?? 0) + 1000 > BASIN_LITRES) {
            this.host.bus.emit('toast', { text: 'The basin cannot take that', kind: 'info' });
            return 'refused';
          }
          c.fluid = { key: f.key, litres: (c.fluid?.litres ?? 0) + 1000 };
          takeHeld(1);
          this.host.ground.spawn(f.bucket.empty, 1, x + 0.5, y + 1.1, z + 0.5, { scatter: false, delayS: 0.2 });
          return 'worked';
        }
        return this.putOrTake(c, x, y, z, held, takeHeld);
      }
      case 'depot':
      case 'skiff':
      case 'deployer':
        return this.putOrTake(c, x, y, z, held, takeHeld);
      case 'item_vault': {
        if (held) return this.putOrTake(c, x, y, z, held, takeHeld);
        const [best] = Object.entries(c.items).sort((a, b) => b[1] - a[1]);
        if (!best) return 'worked';
        const n = Math.min(best[1], stackLimit(best[0]));
        c.items[best[0]] -= n;
        if (c.items[best[0]] <= 0) delete c.items[best[0]];
        this.host.ground.spawn(best[0], n, x + 0.5, y + 1.1, z + 0.5, { scatter: false, delayS: 0.1 });
        return 'worked';
      }
      default: return null;
    }
  }

  private putOrTake(c: Cell, x: number, y: number, z: number, held: { item: string; count: number } | null, takeHeld: (n: number) => void): 'worked' | 'refused' {
    if (held) {
      const n = this.accept(x, y, z, held.item, held.count);
      if (n <= 0) return 'refused';
      takeHeld(n);
      return 'worked';
    }
    for (const [item, n] of Object.entries(c.items)) {
      this.host.ground.spawn(item, n, x + 0.5, y + 1.1, z + 0.5, { scatter: false, delayS: 0.1 });
      delete c.items[item];
    }
    return 'worked';
  }

  /** Wrench on an arm starts / ends configuring; on another block while configuring it sets the source then targets. */
  private wrench(c: Cell, x: number, y: number, z: number): 'worked' | 'refused' {
    const arm = this.configuring ? this.cells.get(this.configuring) : null;
    if (c.kind === 'mech_arm' && (!arm || arm === c)) {
      if (arm === c) {
        this.configuring = null;
        this.host.bus.emit('toast', { text: `Arm set: ${c.src ? 'source' : 'no source'}, ${c.targets.length} target${c.targets.length === 1 ? '' : 's'}`, kind: 'info' });
      } else {
        this.configuring = k3(x, y, z);
        c.src = null;
        c.targets = [];
        this.host.bus.emit('toast', { text: 'Wrench the SOURCE block, then up to 4 targets, then the arm again', kind: 'info' });
      }
      return 'worked';
    }
    if (!arm) return 'refused';
    if (Math.max(Math.abs(x - arm.x), Math.abs(y - arm.y), Math.abs(z - arm.z)) > ARM_REACH) {
      this.host.bus.emit('toast', { text: 'Too far from the arm (3 blocks)', kind: 'info' });
      return 'refused';
    }
    const key = k3(x, y, z);
    if (!arm.src) {
      arm.src = key;
      this.host.bus.emit('toast', { text: 'Source set. Now the targets', kind: 'info' });
    } else if (arm.targets.length < ARM_TARGETS && !arm.targets.includes(key)) {
      arm.targets.push(key);
      this.host.bus.emit('toast', { text: `Target ${arm.targets.length} set`, kind: 'info' });
    } else return 'refused';
    return 'worked';
  }

  // ---- Simulation -------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.intakeGround();
    for (const c of this.cells.values()) {
      if (POWERED.has(c.kind) && !this.host.gate(c.x, c.y, c.z)) {
        c.phase = Math.max(0, c.phase - dt);
        continue;
      }
      switch (c.kind) {
        case 'funnel':
        case 'chute':
        case 'tally_board':
        case 'item_drain':
          this.mover(c, dt);
          break;
        case 'mixer':
        case 'mech_press':
          this.process(c, dt);
          break;
        case 'mech_arm':
          this.arm(c, dt);
          break;
        case 'deployer':
          this.deployer(c, dt);
          break;
        case 'mech_drill':
          this.drill(c, dt);
          break;
        case 'spout':
          this.spout(c, dt);
          break;
        case 'saw_arm':
          this.sawArm(c, dt);
          break;
        case 'vacuum_collector':
          this.vacuum(c, dt);
          this.mover(c, dt);
          break;
        default:
      }
    }
  }

  /** Ground items resting on top of a depot, basin, funnel, chute, deployer or drain are taken in. */
  private intakeGround(): void {
    const items = this.host.ground.items;
    for (const e of items) {
      if (e.count <= 0 || e.homing) continue;
      const x = Math.floor(e.x);
      const z = Math.floor(e.z);
      const y = Math.floor(e.y - 0.08);
      const c = this.cells.get(k3(x, y, z));
      if (!c || !TAKES_GROUND.has(c.kind) || e.delayS > 0.4) continue;
      const n = this.accept(x, y, z, e.item, e.count);
      e.count -= n;
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].count <= 0) items.splice(i, 1);
  }

  /** Funnels pass items to the cell in front, chutes down, drains hand the empties on. Funnels and chutes also pull from behind / above. */
  private mover(c: Cell, dt: number): void {
    c.timer += dt;
    if (c.timer < MOVE_S) return;
    c.timer = 0;
    const [fx, fz] = FACE_DELTA[voxelFacing(this.host.world.getVoxel(c.x, c.y, c.z))];
    const dest: [number, number, number] = c.kind === 'chute' ? [c.x, c.y - 1, c.z] : [c.x + fx, c.y, c.z + fz];
    if (c.kind !== 'item_drain' && c.kind !== 'vacuum_collector' && total(c.items) < CELL_CAP) {
      const from: [number, number, number] = c.kind === 'chute' ? [c.x, c.y + 1, c.z] : [c.x - fx, c.y, c.z - fz];
      const got = this.take(...from, c.filter, 8);
      if (got) {
        const n = this.accept(c.x, c.y, c.z, got.item, got.count);
        if (n < got.count) this.accept(...from, got.item, got.count - n);
      }
    }
    for (const [item, count] of Object.entries(c.items)) {
      if (count <= 0 || (c.filter && c.filter !== item)) continue;
      const n = Math.min(count, 4);
      let moved = this.accept(...dest, item, n);
      if (moved <= 0 && !this.host.world.getBlock(...dest).solid) {
        this.host.ground.spawn(item, n, dest[0] + 0.5, dest[1] + (c.kind === 'chute' ? 0.9 : 0.3), dest[2] + 0.5, { scatter: false, vx: fx * 1.5, vy: 0.5, vz: fz * 1.5, delayS: 0.6 });
        moved = n;
      }
      if (moved > 0) {
        if (c.kind === 'tally_board') c.rr += moved;
        c.items[item] -= moved;
        if (c.items[item] <= 0) delete c.items[item];
        break;
      }
    }
  }

  /** Mixer and press: work the basin below. */
  private process(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    const basin = this.cells.get(k3(c.x, c.y - 1, c.z));
    c.phase = rpm > 0 ? (c.phase + (dt * rpm) / 32) % 1 : c.phase;
    if (!basin || basin.kind !== 'basin' || rpm <= 0) {
      c.progress = 0;
      return;
    }
    const r = BASIN_RECIPES.find((x) => x.machine === c.kind && rpm >= x.minRpm
      && Object.entries(x.items).every(([i, n]) => (basin.items[i] ?? 0) >= n)
      && (!x.fluid || (basin.fluid?.key === x.fluid.key && basin.fluid.litres >= x.fluid.litres)));
    if (!r) {
      c.progress = 0;
      return;
    }
    c.progress += (dt * rpm) / 16;
    if (c.progress < r.seconds) return;
    // The output needs room (two item kinds at most), else the machine waits.
    const after = { ...basin.items };
    for (const [i, n] of Object.entries(r.items)) {
      after[i] -= n;
      if (after[i] <= 0) delete after[i];
    }
    if (!(r.output.item in after) && Object.keys(after).length >= BASIN_ITEM_KINDS) return;
    c.progress = 0;
    basin.items = after;
    basin.items[r.output.item] = Math.min(CELL_CAP, (basin.items[r.output.item] ?? 0) + r.output.count);
    if (r.fluid && basin.fluid) {
      basin.fluid.litres -= r.fluid.litres;
      if (basin.fluid.litres <= 0) basin.fluid = null;
    }
    this.host.bus.emit('item:made', { item: r.output.item, count: r.output.count, station: c.kind, recipeId: r.id });
    this.host.bus.emit('sfx', { name: 'dig_wood', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, pitch: 0.8, volume: 0.4 });
  }

  private arm(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    if (rpm <= 0 || !c.src || c.targets.length === 0) {
      c.phase = Math.max(0, c.phase - dt);
      return;
    }
    c.timer += (dt * rpm) / 16;
    c.phase = Math.min(1, c.timer / ARM_CYCLE_S);
    if (c.timer < ARM_CYCLE_S) return;
    c.timer = 0;
    const src = parse(c.src);
    for (const entry of this.peek(...src)) {
      for (let k = 0; k < c.targets.length; k++) {
        const t = parse(c.targets[(c.rr + k) % c.targets.length]);
        const room = this.accept(...t, entry.item, Math.min(entry.count, CELL_CAP), false);
        if (room <= 0) continue;
        const got = this.take(...src, entry.item, room);
        if (!got) continue;
        const n = this.accept(...t, got.item, got.count);
        if (n < got.count) this.accept(...src, got.item, got.count - n);
        c.rr = (c.rr + k + 1) % c.targets.length;
        this.host.bus.emit('sfx', { name: 'dig_wood', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, pitch: 1.5, volume: 0.3 });
        return;
      }
    }
  }

  private deployer(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    if (rpm <= 0) return;
    c.timer += (dt * rpm) / 16;
    c.phase = Math.min(1, c.timer / DEPLOYER_CYCLE_S);
    if (c.timer < DEPLOYER_CYCLE_S) return;
    c.timer = 0;
    const [item] = Object.keys(c.items);
    if (!item) return;
    const facing = voxelFacing(this.host.world.getVoxel(c.x, c.y, c.z));
    const [fx, fz] = FACE_DELTA[facing];
    const target: [number, number, number] = [c.x + fx, c.y, c.z + fz];
    const result = this.act({ item, target, face: facing, mode: 'auto' });
    if (result === 'consumed') {
      c.items[item] -= 1;
      if (c.items[item] <= 0) delete c.items[item];
    }
  }

  /** The Game's hook first (hoes, hand stations); else placing blocks and breaking them. */
  act(a: MachineActAction): ActResult {
    const hooked = this.host.act()?.(a);
    if (hooked !== undefined && hooked !== null) return hooked;
    const [x, y, z] = a.target;
    const block = this.host.world.getBlock(x, y, z);
    const asBlock = blockOrNull(a.item);
    if (a.mode === 'mine' || (a.mode === 'auto' && !asBlock && block.solid)) {
      if (!block.solid || block.hardness < 0 || !Number.isFinite(block.hardness) || block.key === 'bedrock' || block.minTier > 1) return false;
      for (const d of rollDrops(block, () => this.host.rng())) this.host.ground.spawn(d.item, d.count, x + 0.5, y + 0.5, z + 0.5, { scatter: false });
      this.host.world.setVoxel(x, y, z, 0, 'sim');
      this.host.bus.emit('sfx', { name: 'dig_stone', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      return 'used';
    }
    if (asBlock && !block.solid && !block.liquid) {
      this.host.world.setVoxel(x, y, z, makeVoxel(blockId(asBlock.key), a.face), 'sim');
      this.host.bus.emit('sfx', { name: 'place', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
      return 'consumed';
    }
    return false;
  }

  private drill(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    if (rpm <= 0) return;
    c.phase = (c.phase + (dt * rpm) / 8) % 1;
    const facing = voxelFacing(this.host.world.getVoxel(c.x, c.y, c.z));
    const [fx, fz] = FACE_DELTA[facing];
    const target: [number, number, number] = [c.x + fx, c.y, c.z + fz];
    const block = this.host.world.getBlock(...target);
    if (!block.solid || block.key === 'bedrock' || !Number.isFinite(block.hardness) || block.hardness < 0 || this.cells.has(k3(...target))) {
      c.progress = 0;
      return;
    }
    c.progress += (dt * rpm) / 16;
    if (c.progress < Math.max(DRILL_MIN_S, block.hardness * DRILL_HARDNESS_S)) return;
    c.progress = 0;
    this.act({ item: '', target, face: facing, mode: 'mine' });
  }

  private spout(c: Cell, dt: number): void {
    const basin = this.cells.get(k3(c.x, c.y + 1, c.z));
    const fb = this.host.fluidBlock();
    if (basin?.kind !== 'basin' && fb?.is(c.x, c.y + 1, c.z)) {
      this.spoutFromTank(c, dt, fb);
      return;
    }
    if (basin?.kind !== 'basin' || !basin.fluid || basin.fluid.litres < 1000) {
      c.progress = 0;
      return;
    }
    const f = fluidOrNull(basin.fluid.key);
    if (!f?.bucket) return;
    const below = this.cells.get(k3(c.x, c.y - 1, c.z));
    const depot = below?.kind === 'depot' && below.items[f.bucket.empty] ? below : null;
    const ground = depot ? null : this.host.ground.items.find((e) => e.count > 0 && e.item === f.bucket!.empty && Math.floor(e.x) === c.x && Math.floor(e.z) === c.z && e.y < c.y && e.y > c.y - 1.6);
    if (!depot && !ground) {
      c.progress = 0;
      return;
    }
    c.progress += dt;
    if (c.progress < SPOUT_S) return;
    c.progress = 0;
    basin.fluid.litres -= 1000;
    if (basin.fluid.litres <= 0) basin.fluid = null;
    if (depot) {
      depot.items[f.bucket.empty] -= 1;
      if (depot.items[f.bucket.empty] <= 0) delete depot.items[f.bucket.empty];
      depot.items[f.bucket.full] = (depot.items[f.bucket.full] ?? 0) + 1;
    } else if (ground) {
      ground.count -= 1;
      this.host.ground.spawn(f.bucket.full, 1, ground.x, ground.y + 0.1, ground.z, { scatter: false, delayS: 0.2 });
    }
    this.host.bus.emit('sfx', { name: 'splash', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, volume: 0.4 });
  }

  /** A spout under a tank of the pipe network: fills whatever empty bucket or canister waits below with what the tank holds. */
  private spoutFromTank(c: Cell, dt: number, fb: { use(x: number, y: number, z: number, item: string): string | null }): void {
    const below = this.cells.get(k3(c.x, c.y - 1, c.z));
    const holders: { item: string; take: () => void; give: (item: string) => void }[] = [];
    if (below?.kind === 'depot') {
      for (const item of Object.keys(below.items)) holders.push({ item, take: () => { below.items[item] -= 1; if (below.items[item] <= 0) delete below.items[item]; }, give: (i) => { below.items[i] = (below.items[i] ?? 0) + 1; } });
    }
    for (const e of this.host.ground.items) {
      if (e.count > 0 && Math.floor(e.x) === c.x && Math.floor(e.z) === c.z && e.y < c.y && e.y > c.y - 1.6) {
        holders.push({ item: e.item, take: () => { e.count -= 1; }, give: (i) => { this.host.ground.spawn(i, 1, e.x, e.y + 0.1, e.z, { scatter: false, delayS: 0.2 }); } });
      }
    }
    const empties = holders.filter((h) => FLUIDS_EMPTY.has(h.item));
    if (empties.length === 0) {
      c.progress = 0;
      return;
    }
    c.progress += dt;
    if (c.progress < SPOUT_S) return;
    c.progress = 0;
    for (const h of empties) {
      const filled = fb.use(c.x, c.y + 1, c.z, h.item);
      if (!filled) continue;
      h.take();
      h.give(filled);
      this.host.bus.emit('sfx', { name: 'splash', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, volume: 0.4 });
      return;
    }
  }

  /** Saw arm: fells the whole tree in front (no fuel), its logs drop where they stood. */
  private sawArm(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    if (rpm <= 0) return;
    const facing = voxelFacing(this.host.world.getVoxel(c.x, c.y, c.z));
    const [fx, fz] = FACE_DELTA[facing];
    const tx = c.x + fx;
    const tz = c.z + fz;
    const cells = trunkAbove(this.host.world, tx, c.y, tz, SAW_ARM_MAX_LOGS);
    if (cells.length === 0) {
      c.progress = 0;
      c.phase = Math.max(0, c.phase - dt);
      return;
    }
    c.progress += (dt * rpm) / 16;
    c.phase = (c.phase + (dt * rpm) / 6) % 1;
    if (c.progress < SAW_ARM_CYCLE_S) return;
    c.progress = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const l = cells[i];
      const block = this.host.world.getBlock(l.x, l.y, l.z);
      for (const d of rollDrops(block, () => this.host.rng())) this.host.ground.spawn(d.item, d.count, l.x + 0.5, l.y + 0.5, l.z + 0.5, { scatter: false, vx: -fx, vz: -fz, vy: 1.5 });
      this.host.world.setVoxel(l.x, l.y, l.z, 0, 'sim');
    }
    this.host.bus.emit('sfx', { name: 'tree_fall', x: tx + 0.5, y: c.y + 0.5, z: tz + 0.5 });
  }

  /** Vacuum collector: pulls loose items within VACUUM_RADIUS toward itself and takes them in. */
  private vacuum(c: Cell, dt: number): void {
    const rpm = this.host.rpmAt(c.x, c.y, c.z);
    c.phase = rpm > 0 ? (c.phase + (dt * rpm) / 8) % 1 : c.phase;
    if (rpm <= 0) return;
    const cx = c.x + 0.5;
    const cy = c.y + 0.5;
    const cz = c.z + 0.5;
    const speed = 3 * (rpm / 16);
    for (const e of this.host.ground.items) {
      if (e.count <= 0 || e.homing) continue;
      const dx = cx - e.x;
      const dy = cy - e.y;
      const dz = cz - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > VACUUM_RADIUS) continue;
      if (d < 0.8) {
        const n = this.accept(c.x, c.y, c.z, e.item, e.count);
        e.count -= n;
        continue;
      }
      const step = Math.min(d, speed * dt);
      e.x += (dx / d) * step;
      e.y += (dy / d) * step * 0.6;
      e.z += (dz / d) * step;
      e.vx = 0;
      e.vz = 0;
    }
    const items = this.host.ground.items;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].count <= 0) items.splice(i, 1);
  }

  /** The cells moved (contraptions): their state goes to the new place and arm references follow. */
  relocate(map: ReadonlyMap<string, [number, number, number]>): void {
    const moved: [string, Cell][] = [];
    for (const [from, to] of map) {
      const c = this.cells.get(from);
      if (!c) continue;
      this.cells.delete(from);
      [c.x, c.y, c.z] = to;
      moved.push([k3(...to), c]);
    }
    for (const [k, c] of moved) this.cells.set(k, c);
    const fix = (k: string | null): string | null => {
      if (!k) return k;
      const to = map.get(k);
      return to ? k3(...to) : k;
    };
    for (const c of this.cells.values()) {
      c.src = fix(c.src);
      c.targets = c.targets.map((t) => fix(t) as string);
    }
    if (this.configuring) this.configuring = fix(this.configuring);
  }

  // ---- Views and saves --------------------------------------------------------------------------------

  describe(x: number, y: number, z: number): string | null {
    const c = this.cells.get(k3(x, y, z));
    if (!c) return null;
    const name = blockOrNull(c.kind)?.name ?? c.kind;
    const bits: string[] = [];
    const held = Object.entries(c.items).filter(([, n]) => n > 0).map(([i, n]) => `${n} ${itemOrNull(i)?.name ?? i}`);
    if (held.length) bits.push(held.join(', '));
    if (c.fluid) bits.push(`${c.fluid.litres} L ${fluidOrNull(c.fluid.key)?.name ?? c.fluid.key}`);
    if (c.kind === 'tally_board') bits.push(`${c.rr} passed`);
    if (c.filter) bits.push(`filter ${itemOrNull(c.filter)?.name ?? c.filter}`);
    if (c.kind === 'mech_arm') bits.push(c.src ? `${c.targets.length} target${c.targets.length === 1 ? '' : 's'}` : 'not set: use a wrench');
    if (POWERED.has(c.kind) && this.host.rpmAt(x, y, z) <= 0) bits.push('still');
    if ((c.kind === 'mixer' || c.kind === 'mech_press') && c.progress > 0) bits.push(`working ${Math.round(c.progress * 10) / 10} s`);
    if ((c.kind === 'mixer' || c.kind === 'mech_press') && c.progress <= 0) {
      const cards = BASIN_RECIPES.filter((r) => r.machine === c.kind).map(basinCard);
      if (cards.length) bits.push(`makes: ${cards.join('; ')}`);
    }
    return `${name}${bits.length ? ` - ${bits.join(', ')}` : ' - empty'}`;
  }

  toJSON(): LogiSnapshot {
    const cells: LogiSnapshot['cells'] = [];
    for (const c of this.cells.values()) cells.push([c.x, c.y, c.z, c.kind, { ...c.items }, c.fluid, c.filter, c.src, c.kind === 'tally_board' ? [String(c.rr)] : [...c.targets]]);
    return { cells };
  }

  load(raw: unknown): void {
    this.cells.clear();
    this.configuring = null;
    const rows = (raw as Partial<LogiSnapshot> | null)?.cells;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!Array.isArray(row) || row.length !== 9) continue;
      const [x, y, z, kind, items, fluid, filter, src, targets] = row;
      if (![x, y, z].every(Number.isInteger) || typeof kind !== 'string' || !LOGI.has(kind)) continue;
      this.noteBlock(x, y, z, kind);
      const c = this.cells.get(k3(x, y, z)) as Cell;
      for (const [i, n] of Object.entries(items ?? {})) if (itemOrNull(i) && typeof n === 'number' && n > 0) c.items[i] = Math.min(CELL_CAP * 4, Math.floor(n));
      if (fluid && typeof fluid.key === 'string' && fluidOrNull(fluid.key) && typeof fluid.litres === 'number') c.fluid = { key: fluid.key, litres: Math.max(0, Math.min(BASIN_LITRES, fluid.litres)) };
      c.filter = typeof filter === 'string' && itemOrNull(filter) ? filter : null;
      c.src = typeof src === 'string' ? src : null;
      c.targets = Array.isArray(targets) ? targets.filter((t) => typeof t === 'string').slice(0, ARM_TARGETS) : [];
      if (kind === 'tally_board') {
        c.rr = Number(c.targets[0]) || 0;
        c.targets = [];
      }
    }
  }

  /** Drops cells whose block is gone (called by the Workshop's verify). */
  verify(): void {
    for (const [key, c] of [...this.cells]) {
      if (!this.host.world.isLoaded(c.x, c.z)) continue;
      if (this.host.world.getBlock(c.x, c.y, c.z).key !== c.kind) this.cells.delete(key);
    }
  }
}
