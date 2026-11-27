/**
 * Replanting (docs/api/felling.md): a sapling the player plants grows into a real tree after a few days, and a felled
 * tree's stump now and then puts up a sapling of its own beside it. DOM-free; GameState ticks it with the clock.
 *
 * Planted trees are written into the world as ordinary log and leaf voxels (the generated forest comes from the seed,
 * a planted one cannot), so the only saved state is the list of saplings and stumps still waiting, with the day each began.
 */
import type { GameBus } from '../core/context';
import { blockId } from '../core/registry';
import { AIR, makeVoxel, voxelId, type IWorld } from '../core/types';

/** Whole days a sapling stands before it becomes a tree. */
export const GROW_DAYS = 3;
/** Whole days a stump rests before it may sprout, then the chance each day. */
export const STUMP_REST_DAYS = 3;
export const STUMP_SPROUT_CHANCE = 0.2;
/** A stump that never sprouts is left alone after this many days. */
export const STUMP_GIVE_UP_DAYS = 20;
/** Clear air a tree needs above the sapling, in blocks. */
const HEADROOM = 9;

export type Kind = 'oak' | 'pine';
type Entry = { x: number; y: number; z: number; day: number; stump: boolean; kind: Kind };

const ID = {
  oakSapling: blockId('oak_sapling'), pineSapling: blockId('pine_sapling'),
  oakStump: blockId('oak_stump'), pineStump: blockId('pine_stump'),
  oakLog: blockId('oak_log'), pineLog: blockId('pine_log'),
  oakLeaves: blockId('oak_leaves'), pineLeaves: blockId('pine_leaves'),
};

const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export interface SaplingHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  day(): number;
  rng(): number;
}

export class Saplings {
  private readonly entries = new Map<string, Entry>();
  private lastDay: number;
  private readonly off: () => void;

  constructor(private readonly host: SaplingHost) {
    this.lastDay = host.day();
    this.off = host.bus.on('block:changed', (e) => {
      if (e.source === 'load') return;
      const k = keyOf(e.x, e.y, e.z);
      const to = voxelId(e.to);
      const kind: Kind | null = to === ID.oakSapling || to === ID.oakStump ? 'oak' : to === ID.pineSapling || to === ID.pineStump ? 'pine' : null;
      if (kind) this.entries.set(k, { x: e.x, y: e.y, z: e.z, day: this.host.day(), stump: to === ID.oakStump || to === ID.pineStump, kind });
      else this.entries.delete(k);
    });
  }

  get size(): number { return this.entries.size; }
  dispose(): void { this.off(); }

  /** Call every tick; the work happens once when the clock day turns. */
  tick(): void {
    const day = this.host.day();
    if (day === this.lastDay) return;
    this.lastDay = day;
    this.advance(day);
  }

  /** One day's growth for every sapling and stump whose chunk is loaded. */
  advance(day: number): void {
    const { world } = this.host;
    for (const [k, e] of [...this.entries]) {
      if (!world.isLoaded(e.x, e.z)) continue;
      const id = voxelId(world.getVoxel(e.x, e.y, e.z));
      const want = e.stump ? (e.kind === 'oak' ? ID.oakStump : ID.pineStump) : e.kind === 'oak' ? ID.oakSapling : ID.pineSapling;
      if (id !== want) { this.entries.delete(k); continue; }
      const age = day - e.day;
      if (e.stump) {
        if (age >= STUMP_GIVE_UP_DAYS) this.entries.delete(k);
        else if (age >= STUMP_REST_DAYS && this.host.rng() < STUMP_SPROUT_CHANCE) this.sprout(e);
      } else if (age >= GROW_DAYS && this.grow(e)) this.entries.delete(k);
    }
  }

  /** A sapling on soil beside the stump, if there is a free spot. */
  private sprout(e: Entry): void {
    const { world } = this.host;
    const sapling = e.kind === 'oak' ? ID.oakSapling : ID.pineSapling;
    const spots: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    const start = Math.floor(this.host.rng() * spots.length);
    for (let i = 0; i < spots.length; i++) {
      const [dx, dz] = spots[(start + i) % spots.length];
      const x = e.x + dx, z = e.z + dz;
      if (!world.isLoaded(x, z)) continue;
      const below = world.getBlock(x, e.y - 1, z).key;
      if ((below === 'grass' || below === 'dirt') && world.getVoxel(x, e.y, z) === AIR) {
        world.setVoxel(x, e.y, z, makeVoxel(sapling), 'sim');
        return;
      }
    }
  }

  private clear(x: number, y: number, z: number): boolean {
    const b = this.host.world.getBlock(x, y, z);
    return b.replaceable || voxelId(this.host.world.getVoxel(x, y, z)) === 0 || b.shape === 'cross';
  }

  /** Writes the tree. False (the sapling keeps waiting) when it has no room or no sky. */
  private grow(e: Entry): boolean {
    const { world } = this.host;
    for (let h = 1; h <= HEADROOM; h++) if (!this.clear(e.x, e.y + h, e.z)) return false;
    const pine = e.kind === 'pine';
    const trunk = pine ? 6 + Math.floor(this.host.rng() * 3) : 4 + Math.floor(this.host.rng() * 3);
    const log = makeVoxel(pine ? ID.pineLog : ID.oakLog);
    const leaf = makeVoxel(pine ? ID.pineLeaves : ID.oakLeaves);
    const top = e.y + trunk;
    const leaves: Array<[number, number, number]> = [];
    if (pine) {
      for (let y = e.y + 2; y <= top + 1; y++) {
        const k = top + 1 - y;
        const r = k === 0 ? 0 : k < 3 ? 1 : k % 2 === 1 ? 2 : 1;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + (r > 1 ? 1 : 0)) leaves.push([e.x + dx, y, e.z + dz]);
      }
    } else {
      for (let y = top - 2; y <= top + 1; y++) {
        const k = top + 1 - y;
        const r = k < 2 ? 1 : 2;
        const limit = k === 0 ? 1 : r === 1 ? 2 : 5;
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= limit) leaves.push([e.x + dx, y, e.z + dz]);
      }
    }
    for (const [x, y, z] of leaves) if (!world.isLoaded(x, z)) return false;
    for (const [x, y, z] of leaves) if (this.clear(x, y, z)) world.setVoxel(x, y, z, leaf, 'sim');
    for (let y = e.y; y <= top; y++) world.setVoxel(e.x, y, e.z, log, 'sim');
    return true;
  }

  toJSON(): Array<[number, number, number, number, number, number]> {
    return [...this.entries.values()].map((e) => [e.x, e.y, e.z, e.day, e.stump ? 1 : 0, e.kind === 'pine' ? 1 : 0]);
  }

  load(raw: unknown): void {
    this.entries.clear();
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      if (!Array.isArray(r) || r.length !== 6 || !r.every(Number.isInteger)) continue;
      const [x, y, z, day, stump, pine] = r as number[];
      this.entries.set(keyOf(x, y, z), { x, y, z, day, stump: stump === 1, kind: pine === 1 ? 'pine' : 'oak' });
    }
  }
}
