/**
 * Crop growth (spec 12.4). Crops are block entities of kind 'crop' but not machines: they never join a power
 * network, a machine list or a machine view, make no sound and give nothing back when broken (the block's own
 * drops are the harvest).
 *
 * Each crop caches what it sees - farmland below, open sky, water in reach, a lit lamp in reach - and refreshes a
 * part only when a block change could alter it. Only crops that can grow are visited each tick: the others sleep
 * until a block change, a lamp, a loaded chunk or the next sunrise wakes them.
 */
import type { GameBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { CHUNK_SIZE, WORLD_HEIGHT, voxelId, withId, type BlockDef, type BlockEntity, type IWorld } from '../core/types';
import {
  HYDRATION_R, LAMP_R, MIN_SUNLIGHT, STAGE_OF, cropStage, growthRate, isHydrated, isLit, isPlant,
  type CropContext, type CropEntity, type CropNode, type CropView, type StageInfo,
} from './cropRules';
import { posKey } from './entities';

/**
 * World reads spent on refreshing cached facts per tick at most (a dry crop's water scan alone is 162 reads), so
 * loading a big farm is spread over a few ticks instead of costing one long one.
 */
const REFRESH_READS_PER_TICK = 1500;
const WATER_READS = 2 * (2 * HYDRATION_R + 1) ** 2;

const FARMLAND = blockId('farmland');
/** Water, and ice: a frozen pond still keeps the soil beside it moist (winter must not dry the greenhouse). */
const IS_WATER: boolean[] = BLOCKS.map((b) => b.liquid === 'water' || b.key === 'ice');
const IS_OPAQUE: boolean[] = BLOCKS.map((b) => b.opaque);
/** Blocks that keep the rain off whatever is under them (the same rule as openSkyAbove in src/game/weather). */
const STOPS_RAIN: boolean[] = BLOCKS.map((b) => b.solid || b.liquid !== null);

const DIRTY_SOIL = 1;
const DIRTY_SKY = 2;
const DIRTY_WATER = 4;
const DIRTY_LAMP = 8;
const DIRTY_ALL = 15;

/** Numeric key of a block column (|z| < 2^21). */
const colKey = (x: number, z: number): number => x * 4194304 + z;

export class CropField {
  private readonly byKey = new Map<string, CropNode>();
  private readonly columns = new Map<number, CropNode[]>();
  private readonly awake: CropNode[] = [];
  /** Positions of every lamp that is lit (powered and running). */
  private readonly lamps = new Map<string, readonly [number, number, number]>();
  private readonly ctx: CropContext = { sunUp: false, wetAt: null, scale: null };
  private sunWasUp: boolean | null = null;

  constructor(private readonly world: IWorld, private readonly bus: GameBus) {}

  get count(): number {
    return this.byKey.size;
  }

  /** Crops visited on the next tick (the rest sleep). */
  get awakeCount(): number {
    return this.awake.length;
  }

  /** Forgets every crop and lamp (before a resync). */
  clear(): void {
    this.byKey.clear();
    this.columns.clear();
    this.awake.length = 0;
    this.lamps.clear();
    this.sunWasUp = null;
  }

  /** Starts following a crop entity stored in the world (after loading). */
  track(stored: BlockEntity): CropNode {
    const e = stored as CropEntity;
    if (typeof e.growS !== 'number' || !Number.isFinite(e.growS)) e.growS = 0;
    const node: CropNode = { e, key: posKey(e.x, e.y, e.z), info: null, soil: false, sky: false, rain: false, water: false, lamp: false, dirty: DIRTY_ALL, slot: -1, waitS: 0 };
    this.byKey.set(node.key, node);
    const ck = colKey(e.x, e.z);
    const col = this.columns.get(ck);
    if (col) col.push(node);
    else this.columns.set(ck, [node]);
    this.wake(node);
    return node;
  }

  /** A crop block now stands at x,y,z: keep its crop (a stage swap), adopt the stored entity, or plant a new one. */
  place(x: number, y: number, z: number, def: BlockDef): void {
    const c = this.byKey.get(posKey(x, y, z));
    if (c) {
      c.info = cropStage(def);
      this.wake(c);
      return;
    }
    const stored = this.world.getEntity(x, y, z);
    const info = cropStage(def);
    const kind = info?.wild ? info.crop : 'crop';
    if (isPlant(stored) && stored.kind === kind) this.track(stored);
    else {
      const e: CropEntity = { kind, x, y, z, growS: 0 };
      this.world.setEntity(e);
      this.track(e);
    }
  }

  /** The crop block at x,y,z is gone (harvested, trampled, blown up): forget it. Nothing is handed back. */
  remove(x: number, y: number, z: number): void {
    const c = this.byKey.get(posKey(x, y, z));
    if (!c) return;
    this.sleep(c);
    this.byKey.delete(c.key);
    const ck = colKey(x, z);
    const col = this.columns.get(ck);
    if (col) {
      col.splice(col.indexOf(c), 1);
      if (col.length === 0) this.columns.delete(ck);
    }
    if (this.world.getEntity(x, y, z) === c.e) this.world.removeEntity(x, y, z);
  }

  /** A block changed: mark the crops whose cached facts it can alter. */
  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    if (this.byKey.size === 0) return;
    const col = this.columns.get(colKey(x, z));
    if (col) {
      const opacity = from.opaque !== to.opaque || STOPS_RAIN[from.id] !== STOPS_RAIN[to.id];
      for (const c of col) {
        if (c.e.y === y + 1) this.touch(c, DIRTY_SOIL);
        else if (opacity && c.e.y < y) this.touch(c, DIRTY_SKY);
      }
    }
    if (IS_WATER[from.id] !== IS_WATER[to.id]) {
      this.around(x, z, HYDRATION_R, (c) => {
        if (c.e.y === y || c.e.y === y + 1) this.touch(c, DIRTY_WATER);
      });
    }
  }

  /** A chunk column was loaded or unloaded: crops in it, or with water reach into it, look again. */
  chunkChanged(cx: number, cz: number): void {
    if (this.byKey.size === 0) return;
    const x0 = cx * CHUNK_SIZE - HYDRATION_R;
    const z0 = cz * CHUNK_SIZE - HYDRATION_R;
    const x1 = (cx + 1) * CHUNK_SIZE - 1 + HYDRATION_R;
    const z1 = (cz + 1) * CHUNK_SIZE - 1 + HYDRATION_R;
    for (const c of this.byKey.values()) {
      if (c.e.x >= x0 && c.e.x <= x1 && c.e.z >= z0 && c.e.z <= z1) this.touch(c, DIRTY_ALL);
    }
  }

  /** A lamp at x,y,z started or stopped shining (or was placed lit, or removed). */
  lampChanged(x: number, y: number, z: number, lit: boolean): void {
    const key = posKey(x, y, z);
    if (lit === this.lamps.has(key)) return;
    if (lit) this.lamps.set(key, [x, y, z]);
    else this.lamps.delete(key);
    this.around(x, z, LAMP_R, (c) => {
      const dy = c.e.y - y;
      if (Math.abs(dy) <= LAMP_R) this.touch(c, DIRTY_LAMP);
    });
  }

  /**
   * Advances every crop that can grow. `sunlight` is the clock's sunlight factor of this tick; `wetAt` says where
   * rain soaks exposed crops this tick (null: nowhere).
   */
  tick(dt: number, sunlight: number, wetAt: CropContext['wetAt'] = null, scale: CropContext['scale'] = null): void {
    const up = sunlight >= MIN_SUNLIGHT;
    if (up && this.sunWasUp === false) {
      // Sunrise: crops that slept through the dark under open sky look again.
      for (const c of this.byKey.values()) if (c.sky && c.soil && c.info !== null && c.info.next >= 0) this.wake(c);
    }
    this.sunWasUp = up;
    this.ctx.sunUp = up;
    this.ctx.wetAt = wetAt;
    this.ctx.scale = scale;
    const { awake, ctx } = this;
    let budget = REFRESH_READS_PER_TICK;
    // Backwards: a crop going to sleep swaps the last (already visited) crop into its place.
    for (let i = awake.length - 1; i >= 0; i--) {
      const c = awake[i];
      if (c.dirty !== 0) {
        if (budget <= 0) {
          c.waitS += dt;
          continue;
        }
        if (!this.world.isLoaded(c.e.x, c.e.z)) {
          // Stays dirty: 'chunk:loaded' wakes it.
          this.sleep(c);
          continue;
        }
        budget -= this.refresh(c);
      }
      const rate = growthRate(c, ctx);
      if (rate <= 0) this.sleep(c);
      else this.grow(c, rate * (dt + c.waitS));
      c.waitS = 0;
    }
  }

  /** What the crop at x,y,z is doing, or null when there is none (or its chunk has not been seen yet). */
  view(x: number, y: number, z: number, sunlight: number, wetAt: CropContext['wetAt'] = null, scale: CropContext['scale'] = null): CropView | null {
    const c = this.byKey.get(posKey(x, y, z));
    if (!c) return null;
    if (c.dirty !== 0 && this.world.isLoaded(x, z)) this.refresh(c);
    const info = c.info;
    if (info === null) return null;
    const ctx: CropContext = { sunUp: sunlight >= MIN_SUNLIGHT, wetAt, scale };
    const ripe = info.next < 0;
    const lit = info.wild || isLit(c, ctx);
    const hydrated = info.wild || isHydrated(c, ctx);
    const rate = growthRate(c, ctx);
    const stageS = info.stageS;
    const left = ripe ? 0 : stageS - c.e.growS;
    const status = ripe ? 'Ripe' : info.wild ? 'Fruiting again'
      : !c.soil ? 'Needs farmland' : !lit ? 'Needs light' : `Growing - stage ${info.stage + 1} of ${info.stages}`;
    return {
      x, y, z, crop: info.crop, name: this.world.getBlock(x, y, z).name, stage: info.stage, stages: info.stages, ripe,
      soil: info.wild || c.soil, lit, hydrated, rate, progress: ripe ? 1 : Math.min(1, c.e.growS / stageS),
      nextStageS: ripe ? 0 : rate > 0 ? Math.max(0, left) / rate : Infinity,
      ripeInS: ripe ? 0 : rate > 0 ? (Math.max(0, left) + (info.stages - 2 - info.stage) * stageS) / rate : Infinity,
      status,
    };
  }

  // ---- internals ------------------------------------------------------------------------------------------------

  private grow(c: CropNode, amount: number): void {
    const e = c.e;
    e.growS += amount;
    const info = c.info;
    if (info === null || e.growS < info.stageS || info.next < 0) return;
    const v = this.world.getVoxel(e.x, e.y, e.z);
    if (!this.world.setVoxel(e.x, e.y, e.z, withId(v, info.next), 'sim')) return;
    const next = STAGE_OF[info.next] as StageInfo;
    c.info = next;
    e.growS = next.next < 0 ? 0 : e.growS - info.stageS;
    this.bus.emit('crop:grew', { x: e.x, y: e.y, z: e.z, stage: next.stage });
  }

  /** Recomputes the dirty facts of a crop; returns roughly how many world reads it took. */
  private refresh(c: CropNode): number {
    const { world } = this;
    const { x, y, z } = c.e;
    const d = c.dirty;
    let reads = 2;
    c.dirty = 0;
    c.info = STAGE_OF[voxelId(world.getVoxel(x, y, z))] ?? null;
    if (c.info?.wild) return reads; // a bush needs nothing around it
    if (d & DIRTY_SOIL) c.soil = voxelId(world.getVoxel(x, y - 1, z)) === FARMLAND;
    if (d & DIRTY_SKY) {
      c.sky = true;
      c.rain = true;
      for (let yy = y + 1; yy < WORLD_HEIGHT && (c.sky || c.rain); yy++) {
        reads++;
        const id = voxelId(world.getVoxel(x, yy, z));
        if (IS_OPAQUE[id]) c.sky = false;
        if (STOPS_RAIN[id]) c.rain = false;
      }
    }
    if (d & DIRTY_WATER) {
      c.water = waterNear(world, x, y, z);
      reads += WATER_READS;
    }
    if (d & DIRTY_LAMP) {
      c.lamp = false;
      const r2 = LAMP_R * LAMP_R;
      for (const [lx, ly, lz] of this.lamps.values()) {
        if ((lx - x) ** 2 + (ly - y) ** 2 + (lz - z) ** 2 <= r2) {
          c.lamp = true;
          break;
        }
      }
    }
    return reads;
  }

  private touch(c: CropNode, bits: number): void {
    c.dirty |= bits;
    this.wake(c);
  }

  private wake(c: CropNode): void {
    if (c.slot >= 0) return;
    c.slot = this.awake.length;
    this.awake.push(c);
  }

  private sleep(c: CropNode): void {
    c.waitS = 0;
    if (c.slot < 0) return;
    const last = this.awake.pop() as CropNode;
    if (last !== c) {
      this.awake[c.slot] = last;
      last.slot = c.slot;
    }
    c.slot = -1;
  }

  /** Calls `fn` for every crop in the columns within `r` blocks (Chebyshev, horizontally) of x,z. */
  private around(x: number, z: number, r: number, fn: (c: CropNode) => void): void {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const col = this.columns.get(colKey(x + dx, z + dz));
        if (col) for (const c of col) fn(c);
      }
    }
  }
}

/** Water within hydrationRadius horizontally at the crop's y or y - 1. */
function waterNear(world: IWorld, x: number, y: number, z: number): boolean {
  for (let yy = y - 1; yy <= y; yy++) {
    for (let dz = -HYDRATION_R; dz <= HYDRATION_R; dz++) {
      for (let dx = -HYDRATION_R; dx <= HYDRATION_R; dx++) {
        if (IS_WATER[voxelId(world.getVoxel(x + dx, yy, z + dz))]) return true;
      }
    }
  }
  return false;
}
