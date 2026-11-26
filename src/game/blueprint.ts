/**
 * Blueprint mode (docs/api/blueprint.md): save a build as a Blueprint, then let builders raise a copy from a source of
 * materials. Capture keeps every block that has an item, machines included (they get fresh entities when placed), and
 * skips air and liquids. A BuildJob places cells bottom-up, one block per builder per BUILD_INTERVAL_S, taking one matching
 * item from the source for each; it waits, naming what is missing, when the source runs dry. `rotateBlueprint` turns a
 * blueprint in quarter turns and `checkSite` says which cells a placement could fill. Pure over IWorld; DOM-free.
 */
import { blockOrNull } from '../core/registry';
import { makeVoxel, voxelId, type ChangeSource, type IWorld } from '../core/types';
import type { ItemAmount } from '../core/types';
import { itemOfBlock } from './buildTools';

export const BUILD_INTERVAL_S = 0.6;
export const MAX_BLUEPRINT_CELLS = 4096;
/** The longest side of a saved box. */
export const MAX_BLUEPRINT_SIDE = 32;

/** Where a job takes its items from: a chest or the pack (Inventory fits), or a free supply in Dev Mode. */
export interface MaterialSource {
  remove(item: string, count: number): number;
  add(item: string, count: number): number;
}

/** A source that never runs dry (Dev Mode free placing). */
export const FREE_SOURCE: MaterialSource = { remove: (_i, n) => n, add: () => 0 };

export interface BlueprintCell {
  dx: number;
  dy: number;
  dz: number;
  block: string;
  facing: number;
  /** The item that places the block; absent in older saves (then the block key). */
  item?: string;
}

export interface Blueprint {
  name: string;
  size: [number, number, number];
  cells: BlueprintCell[];
}

/** Saves the box between two corners (inclusive, any order). Null when the box is empty or too big. */
export function captureBlueprint(world: IWorld, a: readonly [number, number, number], b: readonly [number, number, number], name = 'Blueprint'): Blueprint | null {
  const lo = [0, 1, 2].map((i) => Math.min(a[i], b[i]));
  const hi = [0, 1, 2].map((i) => Math.max(a[i], b[i]));
  if ([0, 1, 2].some((i) => hi[i] - lo[i] + 1 > MAX_BLUEPRINT_SIDE)) return null;
  const cells: BlueprintCell[] = [];
  for (let y = lo[1]; y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let x = lo[0]; x <= hi[0]; x++) {
        const v = world.getVoxel(x, y, z);
        const def = blockOrNull(world.getBlock(x, y, z).key);
        if (!def || voxelId(v) === 0 || def.liquid !== null) continue;
        const item = itemOfBlock(def.key);
        if (!item) continue;
        cells.push({ dx: x - lo[0], dy: y - lo[1], dz: z - lo[2], block: def.key, facing: (v >> 10) & 3, item });
        if (cells.length > MAX_BLUEPRINT_CELLS) return null;
      }
    }
  }
  if (cells.length === 0) return null;
  return { name, size: [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], cells };
}

/** The item a cell costs. */
export const itemOfCell = (c: BlueprintCell): string => c.item ?? c.block;

/** The blueprint turned `turns` quarter turns clockwise seen from above (the low corner stays the low corner). Facings turn with it. */
export function rotateBlueprint(bp: Blueprint, turns: number): Blueprint {
  const t = ((Math.round(turns) % 4) + 4) % 4;
  if (t === 0) return bp;
  let size: [number, number, number] = [...bp.size];
  let cells = bp.cells;
  for (let i = 0; i < t; i++) {
    const [sx, sy, sz] = size;
    cells = cells.map((c) => ({ ...c, dx: sz - 1 - c.dz, dz: c.dx, facing: (c.facing + 1) & 3 }));
    size = [sz, sy, sx];
  }
  return { name: bp.name, size, cells };
}

export type SiteState = 'free' | 'right' | 'blocked';

export interface SiteCell {
  x: number;
  y: number;
  z: number;
  block: string;
  state: SiteState;
}

/** What each cell of `bp` placed at `origin` would meet: free to fill, already the right block, or blocked by something else. */
export function checkSite(world: IWorld, bp: Blueprint, origin: readonly [number, number, number]): SiteCell[] {
  return bp.cells.map((c) => {
    const x = origin[0] + c.dx;
    const y = origin[1] + c.dy;
    const z = origin[2] + c.dz;
    const here = world.getBlock(x, y, z);
    const state: SiteState = here.key === c.block ? 'right' : voxelId(world.getVoxel(x, y, z)) !== 0 && here.liquid === null ? 'blocked' : 'free';
    return { x, y, z, block: c.block, state };
  });
}

/** What a build needs: one item per cell, merged. */
export function materialsOf(bp: Blueprint): ItemAmount[] {
  const m = new Map<string, number>();
  for (const c of bp.cells) m.set(itemOfCell(c), (m.get(itemOfCell(c)) ?? 0) + 1);
  return [...m].map(([item, count]) => ({ item, count })).sort((x, y) => y.count - x.count || x.item.localeCompare(y.item));
}

export type JobState = 'building' | 'waiting' | 'done';

export class BuildJob {
  private order: BlueprintCell[];
  private next = 0;
  private acc = 0;
  /** Cells that were already right, or blocked by something else and skipped. */
  skipped = 0;
  placed = 0;
  /** The item the chest ran out of, while waiting. */
  missing: string | null = null;

  constructor(readonly bp: Blueprint, readonly origin: readonly [number, number, number]) {
    this.order = [...bp.cells].sort((p, q) => p.dy - q.dy || p.dz - q.dz || p.dx - q.dx);
  }

  get total(): number {
    return this.order.length;
  }

  get state(): JobState {
    return this.next >= this.order.length ? 'done' : this.missing ? 'waiting' : 'building';
  }

  get progress(): number {
    return this.order.length === 0 ? 1 : this.next / this.order.length;
  }

  /** Advances `builders` workers by `dt` seconds. Returns how many blocks were placed. */
  tick(dt: number, world: IWorld, chest: MaterialSource, builders = 1, source?: ChangeSource): number {
    if (this.state === 'done') return 0;
    this.acc += dt * Math.max(0, builders);
    let placed = 0;
    while (this.acc >= BUILD_INTERVAL_S && this.next < this.order.length) {
      const c = this.order[this.next];
      const x = this.origin[0] + c.dx;
      const y = this.origin[1] + c.dy;
      const z = this.origin[2] + c.dz;
      const here = world.getBlock(x, y, z);
      if (here.key === c.block) {
        this.next++;
        this.skipped++;
        continue;
      }
      if (voxelId(world.getVoxel(x, y, z)) !== 0 && here.liquid === null) {
        this.next++;
        this.skipped++;
        continue;
      }
      const def = blockOrNull(c.block);
      const item = itemOfCell(c);
      if (!def || chest.remove(item, 1) < 1) {
        this.missing = item;
        this.acc = Math.min(this.acc, BUILD_INTERVAL_S);
        return placed;
      }
      this.missing = null;
      if (!world.setVoxel(x, y, z, makeVoxel(def.id, c.facing as never), source)) {
        chest.add(item, 1);
        return placed;
      }
      this.acc -= BUILD_INTERVAL_S;
      this.next++;
      this.placed++;
      placed++;
    }
    return placed;
  }

  /** Retry after the chest was restocked. */
  resume(): void {
    this.missing = null;
  }

  toJSON(): { bp: Blueprint; origin: [number, number, number]; next: number; placed: number; skipped: number } {
    return { bp: this.bp, origin: [...this.origin], next: this.next, placed: this.placed, skipped: this.skipped };
  }

  static fromJSON(raw: ReturnType<BuildJob['toJSON']> | null | undefined): BuildJob | null {
    if (!raw?.bp || !Array.isArray(raw.bp.cells) || !Array.isArray(raw.origin)) return null;
    const cells = raw.bp.cells.filter((c) => blockOrNull(c.block) && [c.dx, c.dy, c.dz].every(Number.isFinite));
    const job = new BuildJob({ name: String(raw.bp.name ?? 'Blueprint'), size: raw.bp.size, cells }, raw.origin);
    job.next = Math.max(0, Math.min(job.total, Math.floor(raw.next) || 0));
    job.placed = Math.max(0, Math.floor(raw.placed) || 0);
    job.skipped = Math.max(0, Math.floor(raw.skipped) || 0);
    return job;
  }
}
