/**
 * The water flow engine (spec 18.2): a scheduled cellular update, never a scan of the world. Every voxel change the
 * World makes wakes the water cells at and around it; each woken cell is looked at FLOW_DELAY_TICKS later (so water
 * visibly spreads a block at a time), at most FLOW_MAX_PER_TICK a tick in wake-up order, and never across into a
 * chunk that is not loaded (such cells wait for that chunk). A flowing cell takes its state from its neighbours
 * (falling under water, a source between two sources over solid ground, else one level weaker than its strongest
 * resting neighbour, else gone); then any water cell pours down into open space or, resting, spreads sideways towards
 * the nearest drop within FLOW_SEEK_DISTANCE. Writes go through the World as 'sim' edits, which wake the next cells.
 */
import { blockId } from '../core/registry';
import { WORLD_HEIGHT, voxelId, voxelIndex, type ChangeSource, type Voxel } from '../core/types';
import { chunkCoord, chunkKey, keyChunkX, keyChunkZ, localCoord } from './chunk';
import {
  MAX_FLOW_LEVEL, WATER_FALLING, WATER_SOURCE, flowingWater, isFallingWater, isFlowingWater, isOpenForWater, isWater,
  waterLevel,
} from './water';

/** Ticks between a change and the look at the water it touched (5 ticks = 0.25 s per step of spread). */
export const FLOW_DELAY_TICKS = 5;
/** Cells looked at per tick at most; the rest carry over to the next tick. */
export const FLOW_MAX_PER_TICK = 256;
/** How far (in blocks) sideways spreading looks for a drop to run towards. */
export const FLOW_SEEK_DISTANCE = 4;

/** What the engine needs from its World. */
export interface FlowHost {
  /** The live voxels of a loaded chunk, or null. */
  chunk(cx: number, cz: number): Uint16Array | null;
  setVoxel(x: number, y: number, z: number, voxel: Voxel, source: ChangeSource): boolean;
}

/**
 * The pending work, saved with the world: `queue` holds (x, y, z, ticks until due) per waiting cell in wake-up order,
 * `deferred` holds (chunk x, chunk z, x, y, z) per cell waiting for that chunk to load.
 */
export interface WaterSnapshot {
  queue: number[];
  deferred: number[];
}

export interface FlowStats {
  /** Cells waiting in the queue, and cells waiting for an unloaded chunk. */
  pending: number;
  deferred: number;
  /** Cells looked at, and voxels changed, since the world was created or loaded. */
  updates: number;
  changes: number;
  /** Milliseconds the last tick took, and the most any tick took. */
  lastTickMs: number;
  maxTickMs: number;
}

const BLOCKED: Voxel = blockId('corestone');
const HDX = [1, -1, 0, 0];
const HDZ = [0, 0, 1, -1];
const BIAS = 1 << 20;
const SPAN = 1 << 21;
/** One number per cell (|x|, |z| < 2^20). */
const cellKey = (x: number, y: number, z: number): number => ((x + BIAS) * SPAN + (z + BIAS)) * 128 + y;

// Scratch for the drop search: a (2R+1)^2 grid around the spreading cell.
const R = FLOW_SEEK_DISTANCE;
const W = 2 * R + 1;
const CLOSED = 255;
const depthOf = new Uint8Array(W * W);
const masks = new Uint8Array(W * W);
const layerA = new Int32Array(W * W);
const layerB = new Int32Array(W * W);

export class WaterFlow {
  private now = 0;
  private keys: number[] = [];
  private dues: number[] = [];
  private head = 0;
  private readonly pending = new Set<number>();
  private readonly waiting = new Map<number, Set<number>>();
  private cacheKey = Number.NaN;
  private cacheVoxels: Uint16Array | null = null;
  private inTick = false;
  private readonly counters: FlowStats = { pending: 0, deferred: 0, updates: 0, changes: 0, lastTickMs: 0, maxTickMs: 0 };

  constructor(private readonly host: FlowHost) {}

  /** The World changed a voxel: wake the water at and around it (restoring a save or a ruin crate wakes nothing). */
  changed(x: number, y: number, z: number, from: Voxel, to: Voxel, source: ChangeSource): void {
    if (source === 'load') return;
    if (this.inTick) this.counters.changes++;
    // A machine switching its active flag is no change to the water.
    if (voxelId(from) === voxelId(to) && !isWater(to)) return;
    if (isWater(to)) this.schedule(x, y, z);
    for (let d = 0; d < 4; d++) if (isWater(this.get(x + HDX[d], y, z + HDZ[d]))) this.schedule(x + HDX[d], y, z + HDZ[d]);
    if (isWater(this.get(x, y + 1, z))) this.schedule(x, y + 1, z);
    if (y > 0 && isWater(this.get(x, y - 1, z))) this.schedule(x, y - 1, z);
  }

  /** A chunk arrived: the cells that waited for it are looked at again. */
  chunkLoaded(cx: number, cz: number): void {
    const key = chunkKey(cx, cz);
    const cells = this.waiting.get(key);
    if (!cells) return;
    this.waiting.delete(key);
    for (const k of cells) this.scheduleKey(k);
  }

  /** One fixed 20 Hz step: looks at the cells that are due, oldest first, at most FLOW_MAX_PER_TICK. */
  tick(): void {
    const start = performance.now();
    this.now++;
    this.inTick = true;
    this.cacheKey = Number.NaN;
    try {
      let n = 0;
      while (this.head < this.keys.length && n < FLOW_MAX_PER_TICK && this.dues[this.head] <= this.now) {
        const key = this.keys[this.head++];
        this.pending.delete(key);
        this.evaluate(key);
        n++;
      }
      this.counters.updates += n;
      if (this.head > 1024 && this.head * 2 > this.keys.length) {
        this.keys = this.keys.slice(this.head);
        this.dues = this.dues.slice(this.head);
        this.head = 0;
      }
    } finally {
      this.inTick = false;
      this.cacheVoxels = null;
      this.cacheKey = Number.NaN;
    }
    const ms = performance.now() - start;
    this.counters.lastTickMs = ms;
    this.counters.maxTickMs = Math.max(this.counters.maxTickMs, ms);
  }

  stats(): FlowStats {
    let deferred = 0;
    for (const s of this.waiting.values()) deferred += s.size;
    return { ...this.counters, pending: this.keys.length - this.head, deferred };
  }

  toJSON(): WaterSnapshot {
    const queue: number[] = [];
    for (let i = this.head; i < this.keys.length; i++) {
      const { x, y, z } = decode(this.keys[i]);
      queue.push(x, y, z, Math.max(0, this.dues[i] - this.now));
    }
    const deferred: number[] = [];
    for (const [ck, cells] of this.waiting) {
      for (const k of cells) {
        const { x, y, z } = decode(k);
        deferred.push(keyChunkX(ck), keyChunkZ(ck), x, y, z);
      }
    }
    return { queue, deferred };
  }

  /** Replaces all pending work with a snapshot's (an older save without one: nothing pending). Throws on bad data. */
  load(snapshot: WaterSnapshot | undefined): void {
    checkWaterSnapshot(snapshot);
    const queue = snapshot?.queue ?? [];
    const deferred = snapshot?.deferred ?? [];
    this.clear();
    for (let i = 0; i < queue.length; i += 4) this.push(cellKey(queue[i], queue[i + 1], queue[i + 2]), queue[i + 3]);
    for (let i = 0; i < deferred.length; i += 5) this.defer(chunkKey(deferred[i], deferred[i + 1]), cellKey(deferred[i + 2], deferred[i + 3], deferred[i + 4]));
  }

  /** Forgets all pending work and the counters. */
  clear(): void {
    this.now = 0;
    this.keys = [];
    this.dues = [];
    this.head = 0;
    this.pending.clear();
    this.waiting.clear();
    Object.assign(this.counters, { updates: 0, changes: 0, lastTickMs: 0, maxTickMs: 0 });
  }

  // ---- the rules ---------------------------------------------------------------------------------------------------

  private evaluate(key: number): void {
    const { x, y, z } = decode(key);
    // Every read below stays within the cell's column and its four neighbours: all of them must be loaded.
    if (!this.loaded(x, z, key)) return;
    for (let d = 0; d < 4; d++) if (!this.loaded(x + HDX[d], z + HDZ[d], key)) return;
    let v = this.get(x, y, z);
    if (!isWater(v)) return;
    if (v !== WATER_SOURCE) {
      const next = this.desired(x, y, z);
      if (next !== v) {
        this.host.setVoxel(x, y, z, next, 'sim');
        if (!isWater(next)) return;
        v = next;
      }
    }
    this.spread(x, y, z, v);
  }

  /** What a non-source cell should hold, from its neighbours: falling, a new source, flowing water, or air. */
  private desired(x: number, y: number, z: number): Voxel {
    if (isWater(this.get(x, y + 1, z))) return WATER_FALLING;
    let sources = 0;
    let best = MAX_FLOW_LEVEL + 1;
    for (let d = 0; d < 4; d++) {
      const nx = x + HDX[d];
      const nz = z + HDZ[d];
      const n = this.get(nx, y, nz);
      if (!isWater(n)) continue;
      if (n === WATER_SOURCE) sources++;
      if (this.spreadsSideways(nx, y, nz, n)) best = Math.min(best, spreadLevel(n));
    }
    if (sources >= 2) {
      const below = this.get(x, y - 1, z);
      if (below === WATER_SOURCE || (!isWater(below) && !isOpenForWater(below))) return WATER_SOURCE;
    }
    return best <= MAX_FLOW_LEVEL ? flowingWater(best) : 0;
  }

  /**
   * Water resting on something solid, or a source on water, spreads sideways (and a level-7 cell no further). Water
   * that can still fall does not, nor does flowing water that has landed on a source: it joins that body.
   */
  private spreadsSideways(x: number, y: number, z: number, v: Voxel): boolean {
    const below = this.get(x, y - 1, z);
    if (isOpenForWater(below) || isFlowingWater(below)) return false;
    if (below === WATER_SOURCE && v !== WATER_SOURCE) return false;
    return spreadLevel(v) <= MAX_FLOW_LEVEL;
  }

  private spread(x: number, y: number, z: number, v: Voxel): void {
    const below = this.get(x, y - 1, z);
    if (isOpenForWater(below) || (isFlowingWater(below) && !isFallingWater(below))) {
      this.host.setVoxel(x, y - 1, z, WATER_FALLING, 'sim');
      return;
    }
    if (!this.spreadsSideways(x, y, z, v)) return;
    const level = spreadLevel(v);
    // Cells this water could fill or strengthen; the drop search only matters when there are any.
    let targets = 0;
    for (let d = 0; d < 4; d++) {
      const t = this.get(x + HDX[d], y, z + HDZ[d]);
      if (isOpenForWater(t) || (isFlowingWater(t) && !isFallingWater(t) && waterLevel(t) > level)) targets |= 1 << d;
    }
    if (targets === 0) return;
    const dirs = this.seek(x, y, z) & targets;
    for (let d = 0; d < 4; d++) {
      if (((dirs >> d) & 1) === 0) continue;
      const tx = x + HDX[d];
      const tz = z + HDZ[d];
      const t = this.get(tx, y, tz);
      const next = this.desired(tx, y, tz);
      if (next !== t && isWater(next)) this.host.setVoxel(tx, y, tz, next, 'sim');
    }
  }

  /**
   * The sideways directions (bit d for HDX/HDZ[d]) water at x, y, z spreads to: those whose path through open cells
   * reaches a drop soonest, within FLOW_SEEK_DISTANCE; every open direction when no drop is that near.
   */
  private seek(x: number, y: number, z: number): number {
    // depthOf: 0 unseen, 255 closed, else the path length that reached the cell first.
    depthOf.fill(0);
    let open = 0;
    let count = 0;
    const centre = R * W + R;
    depthOf[centre] = CLOSED;
    for (let d = 0; d < 4; d++) {
      const c = centre + HDZ[d] * W + HDX[d];
      if (!this.passable(this.get(x + HDX[d], y, z + HDZ[d]))) {
        depthOf[c] = CLOSED;
        continue;
      }
      depthOf[c] = 1;
      masks[c] = 1 << d;
      layerA[count++] = c;
      open |= 1 << d;
    }
    let layer = layerA;
    let next = layerB;
    for (let depth = 1; depth <= R && count > 0; depth++) {
      let found = 0;
      for (let i = 0; i < count; i++) {
        const c = layer[i];
        if (this.hole(x + (c % W) - R, y, z + Math.floor(c / W) - R)) found |= masks[c];
      }
      if (found !== 0) return found;
      if (depth === R) break;
      let nextCount = 0;
      for (let i = 0; i < count; i++) {
        const c = layer[i];
        const cx = (c % W) - R;
        const cz = Math.floor(c / W) - R;
        for (let d = 0; d < 4; d++) {
          const ox = cx + HDX[d];
          const oz = cz + HDZ[d];
          if (Math.abs(ox) + Math.abs(oz) > R) continue;
          const o = (oz + R) * W + ox + R;
          const seenAt = depthOf[o];
          // Reached at the same distance through another first step: both directions lead there.
          if (seenAt === depth + 1) masks[o] |= masks[c];
          if (seenAt !== 0) continue;
          if (!this.passable(this.get(x + ox, y, z + oz))) {
            depthOf[o] = CLOSED;
            continue;
          }
          depthOf[o] = depth + 1;
          masks[o] = masks[c];
          next[nextCount++] = o;
        }
      }
      const swap = layer;
      layer = next;
      next = swap;
      count = nextCount;
    }
    return open;
  }

  /** Water can run through this cell: open, or water that is not a source. */
  private passable(v: Voxel): boolean {
    return isOpenForWater(v) || isFlowingWater(v);
  }

  /** A drop: the cell below is open or water. */
  private hole(x: number, y: number, z: number): boolean {
    const below = this.get(x, y - 1, z);
    return isOpenForWater(below) || isWater(below);
  }

  // ---- queue and voxel access ---------------------------------------------------------------------------------------

  private schedule(x: number, y: number, z: number): void {
    this.scheduleKey(cellKey(x, y, z));
  }

  private scheduleKey(key: number): void {
    if (this.pending.has(key)) return;
    this.push(key, FLOW_DELAY_TICKS);
  }

  private push(key: number, delay: number): void {
    this.pending.add(key);
    this.keys.push(key);
    this.dues.push(this.now + delay);
  }

  private defer(chunk: number, key: number): void {
    let cells = this.waiting.get(chunk);
    if (!cells) this.waiting.set(chunk, (cells = new Set()));
    cells.add(key);
  }

  /** True when the column's chunk is loaded; otherwise the cell waits for it. */
  private loaded(x: number, z: number, key: number): boolean {
    const cx = chunkCoord(x);
    const cz = chunkCoord(z);
    if (this.host.chunk(cx, cz)) return true;
    this.defer(chunkKey(cx, cz), key);
    return false;
  }

  /** Voxel at a cell; corestone below the world and in unloaded chunks (water never goes there), air above. */
  private get(x: number, y: number, z: number): Voxel {
    if (y < 0) return BLOCKED;
    if (y >= WORLD_HEIGHT) return 0;
    const cx = chunkCoord(x);
    const cz = chunkCoord(z);
    const k = chunkKey(cx, cz);
    let voxels: Uint16Array | null;
    if (this.inTick && k === this.cacheKey) voxels = this.cacheVoxels;
    else {
      voxels = this.host.chunk(cx, cz);
      if (this.inTick) {
        this.cacheKey = k;
        this.cacheVoxels = voxels;
      }
    }
    return voxels ? voxels[voxelIndex(localCoord(x), y, localCoord(z))] : BLOCKED;
  }
}

/** Throws when a saved water snapshot is unusable (absent is fine: an older save). */
export function checkWaterSnapshot(snapshot: WaterSnapshot | undefined): void {
  if (snapshot === undefined) return;
  const { queue, deferred } = snapshot;
  if (!Array.isArray(queue) || !Array.isArray(deferred) || queue.length % 4 !== 0 || deferred.length % 5 !== 0
    || !queue.every(Number.isInteger) || !deferred.every(Number.isInteger)) {
    throw new Error('world: malformed water snapshot');
  }
}

/** The level a water cell gives the cells beside it: a source or a landed fall gives 1, flowing level L gives L + 1. */
const spreadLevel = (v: Voxel): number => (v === WATER_SOURCE || isFallingWater(v) ? 1 : waterLevel(v) + 1);

/** Scratch cell written by decode (no allocation per update). */
const at = { x: 0, y: 0, z: 0 };
function decode(key: number): typeof at {
  at.y = key % 128;
  const rest = (key - at.y) / 128;
  at.z = (rest % SPAN) - BIAS;
  at.x = Math.floor(rest / SPAN) - BIAS;
  return at;
}
