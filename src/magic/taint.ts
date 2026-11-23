/**
 * Taint (docs/api/magic.md): spreading corruption. A tainted cell is a `tainted_soil` block standing where grass, dirt or
 * sand was; the field remembers what it replaced so a cleansing focus can put it back. It starts from flux (a crucible that
 * overflows) and from unstable infusions, creeps over open surfaces a little each second up to MAX_CELLS, and each cell
 * drags its chunk's aura down (src/magic/aura.ts). Optional all through: no recipe, objective or solver step needs it.
 */
import { blockId } from '../core/registry';
import { makeVoxel, type IWorld } from '../core/types';

export const TAINT_BLOCK = 'tainted_soil';
/** What taint may eat: open natural surface only. */
export const CONVERTIBLE: ReadonlySet<string> = new Set(['grass', 'dirt', 'sand']);
export const MAX_CELLS = 300;
/** Cells considered per spread call (one per second), and the chance each spreads. */
export const SPREAD_BUDGET = 24;
export const SPREAD_CHANCE = 0.25;
/** Aura pushed down by each new cell, and back up by each cleansed one. */
export const CELL_AURA = 0.012;

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const parse3 = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];
const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class TaintField {
  /** Cell -> the block key it replaced. */
  readonly cells = new Map<string, string>();
  private cursor = 0;
  private relocating = false;

  constructor(private readonly world: IWorld, private readonly rng: () => number) {}

  get size(): number {
    return this.cells.size;
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(k3(x, y, z));
  }

  /** A surface cell taint may eat: a convertible block with open air above. */
  private eatable(x: number, y: number, z: number): boolean {
    if (!this.world.isLoaded(x, z)) return false;
    if (!CONVERTIBLE.has(this.world.getBlock(x, y, z).key)) return false;
    return !this.world.getBlock(x, y + 1, z).solid;
  }

  private eat(x: number, y: number, z: number): boolean {
    if (this.cells.size >= MAX_CELLS || !this.eatable(x, y, z)) return false;
    const was = this.world.getBlock(x, y, z).key;
    this.relocating = true;
    try {
      if (!this.world.setVoxel(x, y, z, makeVoxel(blockId(TAINT_BLOCK)), 'sim')) return false;
    } finally {
      this.relocating = false;
    }
    this.cells.set(k3(x, y, z), was);
    return true;
  }

  /** Seeds up to `n` cells on the open surface within `radius` of x, y, z, nearest first (no randomness). Returns cells made. */
  seed(x: number, y: number, z: number, n: number, radius = 3): number {
    const found: [number, number, number, number][] = [];
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++)
        for (let dy = -2; dy <= 2; dy++) if (this.eatable(x + dx, y + dy, z + dz)) found.push([x + dx, y + dy, z + dz, dx * dx + dz * dz + dy * dy]);
    found.sort((a, b) => a[3] - b[3] || a[0] - b[0] || a[2] - b[2]);
    let made = 0;
    for (const [cx, cy, cz] of found) {
      if (made >= n) break;
      if (this.eat(cx, cy, cz)) made++;
    }
    return made;
  }

  /** One round of creeping: a slice of the cells may eat a neighbour. Returns the new cells. */
  spread(): [number, number, number][] {
    const keys = [...this.cells.keys()];
    const out: [number, number, number][] = [];
    if (!keys.length) return out;
    for (let i = 0; i < Math.min(SPREAD_BUDGET, keys.length); i++) {
      const k = keys[(this.cursor + i) % keys.length];
      if (this.rng() >= SPREAD_CHANCE) continue;
      const [x, y, z] = parse3(k);
      const [dx, dz] = SIDES[Math.floor(this.rng() * SIDES.length) % SIDES.length];
      for (const dy of [0, 1, -1]) {
        if (this.eat(x + dx, y + dy, z + dz)) {
          out.push([x + dx, y + dy, z + dz]);
          break;
        }
      }
    }
    this.cursor = (this.cursor + SPREAD_BUDGET) % Math.max(1, keys.length);
    return out;
  }

  /** Puts back every tainted cell within `radius` (horizontal) of x, y, z; returns the cells restored. */
  cleanse(x: number, y: number, z: number, radius = 2): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const [k, was] of [...this.cells]) {
      const [cx, cy, cz] = parse3(k);
      if (Math.abs(cx - x) > radius || Math.abs(cz - z) > radius || Math.abs(cy - y) > 2) continue;
      this.restore(k, was);
      out.push([cx, cy, cz]);
    }
    return out;
  }

  private restore(k: string, was: string): void {
    const [x, y, z] = parse3(k);
    this.cells.delete(k);
    if (this.world.getBlock(x, y, z).key !== TAINT_BLOCK) return;
    this.relocating = true;
    try {
      this.world.setVoxel(x, y, z, makeVoxel(blockId(was === TAINT_BLOCK ? 'dirt' : was)), 'sim');
    } finally {
      this.relocating = false;
    }
  }

  /** A block changed: a tainted cell that is no longer tainted soil (mined, built over) leaves the field. */
  changed(x: number, y: number, z: number, key: string): void {
    if (this.relocating) return;
    if (key !== TAINT_BLOCK) this.cells.delete(k3(x, y, z));
  }

  toJSON(): [number, number, number, string][] {
    return [...this.cells].map(([k, v]) => [...parse3(k), v] as [number, number, number, string]);
  }

  load(rows: unknown): void {
    this.cells.clear();
    for (const r of Array.isArray(rows) ? rows.slice(0, MAX_CELLS) : []) {
      if (Array.isArray(r) && r.length === 4 && r.slice(0, 3).every((n) => Number.isFinite(n)) && typeof r[3] === 'string') this.cells.set(k3(r[0], r[1], r[2]), r[3]);
    }
  }
}
