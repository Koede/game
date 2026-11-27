/**
 * Belt lanes (docs/api/belts.md): visible item lanes with sorting, and underground runs. A BeltGrid holds cells in a
 * plane-free map keyed by position. Each belt cell carries at most one item, which advances `BELT_SPEED` cells per
 * second and moves on when the next cell is free. Sorters send matching items out of their side, tunnels jump items
 * under whatever lies between two ends, sinks drop items into an Inventory and sources feed from one. Pure; DOM-free.
 */
import type { Inventory } from './inventory';

/** 0 +x (east), 1 +z (south), 2 -x (west), 3 -z (north). */
export type Dir = 0 | 1 | 2 | 3;
export const BELT_SPEED = 2;
/** Farthest an underground tunnel jumps, in cells. */
export const TUNNEL_RANGE = 8;
const STEP: readonly (readonly [number, number, number])[] = [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];

export type Cell =
  | { kind: 'belt'; dir: Dir }
  /** Items matching `filter` leave through `side` (-1 left, +1 right of the direction of travel), the rest go on. */
  | { kind: 'sorter'; dir: Dir; filter: string[]; side: -1 | 1; deny?: boolean }
  /** An entrance: the item reappears at the nearest tunnel exit ahead (same direction), up to TUNNEL_RANGE cells away. */
  | { kind: 'tunnel_in'; dir: Dir }
  | { kind: 'tunnel_out'; dir: Dir }
  | { kind: 'sink'; inv: Inventory }
  | { kind: 'source'; dir: Dir; inv: Inventory; item?: string; everyS: number };

interface Carried {
  item: string;
  count: number;
  /** 0..1 along the cell. */
  t: number;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class BeltGrid {
  private readonly cells = new Map<string, { x: number; y: number; z: number; cell: Cell }>();
  private readonly load = new Map<string, Carried>();
  private readonly timers = new Map<string, number>();
  /** Items that arrived at sinks, by item. */
  readonly delivered = new Map<string, number>();

  set(x: number, y: number, z: number, cell: Cell): void {
    this.cells.set(key(x, y, z), { x, y, z, cell });
  }

  remove(x: number, y: number, z: number): void {
    this.cells.delete(key(x, y, z));
    this.load.delete(key(x, y, z));
  }

  get(x: number, y: number, z: number): Cell | null {
    return this.cells.get(key(x, y, z))?.cell ?? null;
  }

  /** Everything riding a lane right now with its position for drawing (cell centre plus travel along the lane). */
  items(): { item: string; count: number; x: number; y: number; z: number }[] {
    const out: { item: string; count: number; x: number; y: number; z: number }[] = [];
    for (const [k, c] of this.load) {
      const e = this.cells.get(k);
      if (!e) continue;
      const dir = 'dir' in e.cell ? e.cell.dir : 0;
      const [dx, , dz] = STEP[dir];
      out.push({ item: c.item, count: c.count, x: e.x + 0.5 + dx * (c.t - 0.5), y: e.y, z: e.z + 0.5 + dz * (c.t - 0.5) });
    }
    return out;
  }

  /** Items on belts in total. */
  get riding(): number {
    let n = 0;
    for (const c of this.load.values()) n += c.count;
    return n;
  }

  private accept(x: number, y: number, z: number, from: Dir, c: Carried): boolean {
    const k = key(x, y, z);
    const e = this.cells.get(k);
    if (!e) return false;
    const cell = e.cell;
    if (cell.kind === 'sink') {
      const left = cell.inv.add(c.item, c.count);
      if (left === c.count) return false;
      this.delivered.set(c.item, (this.delivered.get(c.item) ?? 0) + c.count - left);
      c.count = left;
      return left === 0;
    }
    if (cell.kind === 'source') return false;
    if (this.load.has(k)) return false;
    void from;
    this.load.set(k, { item: c.item, count: c.count, t: 0 });
    return true;
  }

  /** Where an item at cell `e` should go next: the cell it enters, after sorter, tunnel and direction rules. */
  private route(e: { x: number; y: number; z: number; cell: Cell }, item: string): { x: number; y: number; z: number; dir: Dir } | null {
    const cell = e.cell;
    if (!('dir' in cell)) return null;
    let dir = cell.dir;
    if (cell.kind === 'sorter') {
      const hit = cell.filter.includes(item) !== !!cell.deny;
      if (hit) dir = ((cell.dir + (cell.side === 1 ? 1 : 3)) & 3) as Dir;
    }
    if (cell.kind === 'tunnel_in') {
      const [dx, , dz] = STEP[cell.dir];
      for (let i = 2; i <= TUNNEL_RANGE; i++) {
        const t = this.cells.get(key(e.x + dx * i, e.y, e.z + dz * i));
        if (t?.cell.kind === 'tunnel_out' && t.cell.dir === cell.dir) return { x: t.x, y: t.y, z: t.z, dir: cell.dir };
      }
      return null;
    }
    const [dx, dy, dz] = STEP[dir];
    return { x: e.x + dx, y: e.y + dy, z: e.z + dz, dir };
  }

  tick(dt: number): void {
    // Sources first, so what they emit starts moving this tick.
    for (const [k, e] of this.cells) {
      if (e.cell.kind !== 'source') continue;
      const t = (this.timers.get(k) ?? 0) + dt;
      if (t < e.cell.everyS) {
        this.timers.set(k, t);
        continue;
      }
      const src = e.cell;
      const slot = src.inv.slots.findIndex((s) => s && (!src.item || s.item === src.item));
      const stack = slot >= 0 ? src.inv.slots[slot] : null;
      const next = this.route(e, stack?.item ?? '');
      if (stack && next && this.accept(next.x, next.y, next.z, next.dir, { item: stack.item, count: 1, t: 0 })) {
        src.inv.removeAt(slot, 1);
        this.timers.set(k, 0);
      } else this.timers.set(k, src.everyS);
    }
    // Move items, front-most cells first is not needed: a blocked item simply waits at t = 1.
    for (const [k, c] of [...this.load]) {
      const e = this.cells.get(k);
      if (!e) {
        this.load.delete(k);
        continue;
      }
      c.t = Math.min(1, c.t + dt * BELT_SPEED);
      if (c.t < 1) continue;
      const next = this.route(e, c.item);
      if (next && this.accept(next.x, next.y, next.z, next.dir, c)) this.load.delete(k);
    }
  }
}
