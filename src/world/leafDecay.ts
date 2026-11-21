/**
 * Leaf decay: leaves that no longer hang on a log fall away. A scheduled update like the water flow (flow.ts), never
 * a scan of the world. Removing a log wakes the leaves that were reachable from it through other leaves (at most
 * LEAF_LOG_DISTANCE steps); each woken leaf is looked at after its own random delay (LEAF_DELAY_MIN..MAX ticks), at
 * most LEAF_MAX_PER_TICK a tick. When it is looked at, a bounded search through leaf cells asks "is a log within
 * LEAF_LOG_DISTANCE steps?"; if so the leaf stays (it belongs to another tree, or the same one still standing),
 * otherwise it is replaced by air as a 'sim' edit, its drop table is rolled and reported (`host.decayed`), and the
 * leaves around it, which may have lost their last way to a log, are woken with a short delay so a crown peels
 * away over a few seconds instead of vanishing at once.
 *
 * A search that touches a chunk that is not loaded counts as supported (never decay what cannot be seen). Pending
 * work is saved with the world (`toJSON` / `load`).
 */
import { BLOCKS, blockId } from '../core/registry';
import { AIR, WORLD_HEIGHT, voxelId, type ChangeSource, type ItemAmount, type Voxel } from '../core/types';

/** A leaf stays while a log is at most this many steps away through leaves (the usual rule; 1 = touching a log). */
export const LEAF_LOG_DISTANCE = 6;
/** Ticks (20 Hz) a woken leaf waits before it is looked at: a random value in [MIN, MAX]. */
export const LEAF_DELAY_MIN = 8;
export const LEAF_DELAY_MAX = 48;
/** The follow-up delay of leaves woken by a decaying neighbour: a random value in [MIN, MAX]. */
export const LEAF_PEEL_MIN = 2;
export const LEAF_PEEL_MAX = 12;
/** Leaves looked at per tick at most; the rest carry over to the next tick. */
export const LEAF_MAX_PER_TICK = 24;

/** What the engine needs from its World. */
export interface LeafHost {
  getVoxel(x: number, y: number, z: number): Voxel;
  isLoaded(x: number, z: number): boolean;
  setVoxel(x: number, y: number, z: number, voxel: Voxel, source: ChangeSource): boolean;
  /** A leaf voxel was removed by decay (its drops are for the host to hand out). */
  decayed(x: number, y: number, z: number, voxel: Voxel): void;
}

/** Pending work, saved with the world: (x, y, z, ticks until due) per waiting leaf. */
export interface LeafSnapshot {
  queue: number[];
}

export interface LeafStats {
  /** Leaves waiting to be looked at. */
  pending: number;
  /** Leaves looked at, and leaves removed, since the world was created or loaded. */
  checked: number;
  removed: number;
  lastTickMs: number;
  maxTickMs: number;
}

const LOG_IDS = new Set<number>([blockId('oak_log'), blockId('pine_log')]);
const LEAF_IDS = new Set<number>([blockId('oak_leaves'), blockId('pine_leaves')]);
export const isLogVoxel = (v: Voxel): boolean => LOG_IDS.has(voxelId(v));
export const isLeafVoxel = (v: Voxel): boolean => LEAF_IDS.has(voxelId(v));

/** The drop table of a leaf voxel rolled with `rng` (the same rule as breaking it: chance, count ranges, summed by item). */
export function rollLeafDrops(voxel: Voxel, rng: () => number): ItemAmount[] {
  const out: ItemAmount[] = [];
  const spec = BLOCKS[voxelId(voxel)];
  for (const d of spec?.drops ?? []) {
    if (d.chance !== undefined && d.chance < 1 && rng() >= d.chance) continue;
    const count = typeof d.count === 'number' ? d.count : d.count[0] + Math.floor(rng() * (d.count[1] - d.count[0] + 1));
    if (count <= 0) continue;
    const known = out.find((o) => o.item === d.item);
    if (known) known.count += count;
    else out.push({ item: d.item, count });
  }
  return out;
}

const DX = [1, -1, 0, 0, 0, 0];
const DY = [0, 0, 1, -1, 0, 0];
const DZ = [0, 0, 0, 0, 1, -1];
const BIAS = 1 << 20;
const SPAN = 1 << 21;
const cellKey = (x: number, y: number, z: number): number => ((x + BIAS) * SPAN + (z + BIAS)) * 128 + y;
const decode = (k: number): { x: number; y: number; z: number } => {
  const y = k % 128;
  const rest = (k - y) / 128;
  const zb = rest % SPAN;
  return { x: (rest - zb) / SPAN - BIAS, y, z: zb - BIAS };
};

export class LeafDecay {
  private now = 0;
  /** Cells waiting by due tick. */
  private readonly buckets = new Map<number, number[]>();
  private readonly pending = new Set<number>();
  private readonly counters: LeafStats = { pending: 0, checked: 0, removed: 0, lastTickMs: 0, maxTickMs: 0 };
  // Scratch for the searches.
  private readonly seen = new Set<number>();
  private frontier: number[] = [];
  private next: number[] = [];

  constructor(private readonly host: LeafHost, private readonly rng: () => number = Math.random) {}

  /** The World changed a voxel: a log that went away wakes the leaves that may have hung on it. */
  changed(x: number, y: number, z: number, from: Voxel, to: Voxel, source: ChangeSource): void {
    if (source === 'load') return;
    if (isLogVoxel(from) && !isLogVoxel(to)) this.wakeAround(x, y, z, LEAF_DELAY_MIN, LEAF_DELAY_MAX);
  }

  /** Wakes every leaf reachable from (x, y, z) through leaves in at most LEAF_LOG_DISTANCE steps. */
  private wakeAround(x: number, y: number, z: number, lo: number, hi: number): void {
    const seen = this.seen;
    seen.clear();
    seen.add(cellKey(x, y, z));
    this.frontier.length = 0;
    this.frontier.push(x, y, z);
    for (let step = 1; step <= LEAF_LOG_DISTANCE && this.frontier.length > 0; step++) {
      this.next.length = 0;
      for (let i = 0; i < this.frontier.length; i += 3) {
        const cx = this.frontier[i];
        const cy = this.frontier[i + 1];
        const cz = this.frontier[i + 2];
        for (let d = 0; d < 6; d++) {
          const nx = cx + DX[d];
          const ny = cy + DY[d];
          const nz = cz + DZ[d];
          if (ny < 0 || ny >= WORLD_HEIGHT) continue;
          const k = cellKey(nx, ny, nz);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!isLeafVoxel(this.host.getVoxel(nx, ny, nz))) continue;
          this.schedule(k, lo, hi);
          this.next.push(nx, ny, nz);
        }
      }
      const t = this.frontier;
      this.frontier = this.next;
      this.next = t;
    }
    seen.clear();
  }

  private schedule(key: number, lo: number, hi: number): void {
    if (this.pending.has(key)) return;
    this.push(key, lo + Math.floor(this.rng() * (hi - lo + 1)));
  }

  private push(key: number, delay: number): void {
    const due = this.now + Math.max(1, delay);
    let bucket = this.buckets.get(due);
    if (!bucket) this.buckets.set(due, (bucket = []));
    bucket.push(key);
    this.pending.add(key);
  }

  /** One fixed 20 Hz step: looks at the leaves that are due, at most LEAF_MAX_PER_TICK. */
  tick(): void {
    this.now++;
    const bucket = this.buckets.get(this.now);
    if (!bucket) return;
    const start = performance.now();
    this.buckets.delete(this.now);
    const n = Math.min(bucket.length, LEAF_MAX_PER_TICK);
    for (let i = 0; i < n; i++) this.evaluate(bucket[i]);
    // What did not fit carries over, keeping its order.
    for (let i = n; i < bucket.length; i++) {
      this.pending.delete(bucket[i]);
      this.push(bucket[i], 1);
    }
    const ms = performance.now() - start;
    this.counters.lastTickMs = ms;
    this.counters.maxTickMs = Math.max(this.counters.maxTickMs, ms);
  }

  private evaluate(key: number): void {
    this.pending.delete(key);
    this.counters.checked++;
    const { x, y, z } = decode(key);
    if (!this.host.isLoaded(x, z)) return;
    const voxel = this.host.getVoxel(x, y, z);
    if (!isLeafVoxel(voxel) || this.supported(x, y, z)) return;
    if (!this.host.setVoxel(x, y, z, AIR, 'sim')) return;
    this.counters.removed++;
    this.host.decayed(x, y, z, voxel);
    this.wakeAround(x, y, z, LEAF_PEEL_MIN, LEAF_PEEL_MAX);
  }

  /** True when a log is within LEAF_LOG_DISTANCE steps through leaves, or the search met an unloaded chunk. */
  supported(x: number, y: number, z: number): boolean {
    const seen = this.seen;
    seen.clear();
    seen.add(cellKey(x, y, z));
    this.frontier.length = 0;
    this.frontier.push(x, y, z);
    let found = false;
    for (let step = 1; step <= LEAF_LOG_DISTANCE && !found && this.frontier.length > 0; step++) {
      this.next.length = 0;
      for (let i = 0; i < this.frontier.length && !found; i += 3) {
        const cx = this.frontier[i];
        const cy = this.frontier[i + 1];
        const cz = this.frontier[i + 2];
        for (let d = 0; d < 6; d++) {
          const nx = cx + DX[d];
          const ny = cy + DY[d];
          const nz = cz + DZ[d];
          if (ny < 0 || ny >= WORLD_HEIGHT) continue;
          const k = cellKey(nx, ny, nz);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!this.host.isLoaded(nx, nz)) {
            found = true;
            break;
          }
          const v = this.host.getVoxel(nx, ny, nz);
          if (isLogVoxel(v)) {
            found = true;
            break;
          }
          if (isLeafVoxel(v)) this.next.push(nx, ny, nz);
        }
      }
      const t = this.frontier;
      this.frontier = this.next;
      this.next = t;
    }
    seen.clear();
    return found;
  }

  stats(): LeafStats {
    let pending = 0;
    for (const b of this.buckets.values()) pending += b.length;
    return { ...this.counters, pending };
  }

  toJSON(): LeafSnapshot {
    const queue: number[] = [];
    for (const [due, keys] of this.buckets) {
      for (const k of keys) {
        const { x, y, z } = decode(k);
        queue.push(x, y, z, Math.max(1, due - this.now));
      }
    }
    return { queue };
  }

  /** Replaces all pending work (undefined = an older save: nothing pending). Throws on bad data, changing nothing. */
  load(snapshot: LeafSnapshot | undefined): void {
    checkLeafSnapshot(snapshot);
    this.clear();
    const q = snapshot?.queue ?? [];
    for (let i = 0; i < q.length; i += 4) {
      const k = cellKey(q[i], q[i + 1], q[i + 2]);
      if (!this.pending.has(k)) this.push(k, q[i + 3]);
    }
  }

  clear(): void {
    this.now = 0;
    this.buckets.clear();
    this.pending.clear();
    Object.assign(this.counters, { checked: 0, removed: 0, lastTickMs: 0, maxTickMs: 0 });
  }
}

export function checkLeafSnapshot(snapshot: LeafSnapshot | undefined): void {
  if (snapshot === undefined) return;
  const q = snapshot.queue;
  if (!Array.isArray(q) || q.length % 4 !== 0 || !q.every((n) => Number.isInteger(n))) throw new Error('leaf decay: malformed snapshot');
  for (let i = 0; i < q.length; i += 4) {
    if (q[i + 1] < 0 || q[i + 1] >= WORLD_HEIGHT || Math.abs(q[i]) >= BIAS || Math.abs(q[i + 2]) >= BIAS) throw new Error('leaf decay: cell out of range');
  }
}
