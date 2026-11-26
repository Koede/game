/**
 * The town builder (docs/plans/orrin-builds-a-town.md, sections 2 and 3-of-phase-2): Orrin raises the planned buildings one by one
 * through the world. Pure over a small host interface (see TownHost), so it is testable without the game.
 *
 * - Pace: DAY_BUDGET cells per day, spent during the day phase; a turned day (sleep, time away) credits the rest of the day.
 * - Order: each building's cells run clearing, frame, walls, roof, finish, bottom-up within a stage. Progress has two counters:
 *   `cell` (how far the budget has reached) and `laid` (how far placement has got). Placement lags the budget when a chunk is not
 *   loaded or the bay is short, and catches up in batches (MAX_PER_TICK) when it can.
 * - Materials: every placed block is taken from the storage bay's stock. Digging a movable block out of the way puts its drops into
 *   the bay. With too little stock Orrin waits, and `missing()` names what the current stage still needs. `deliver()` adds stock.
 * - Protection: a cell the player (or anything but the world's generation) changed is never overwritten or dug; a plot with too
 *   many such cells, or with unbuildable ground, is dropped and the next plot is used.
 * - Stilts: columns under the footprint are filled with stone from the bay up to the base row, so a house on a slope stands on
 *   tall footings instead of a flattened pad. Nothing is levelled for free.
 */
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import { blockOrNull } from '../core/registry';
import { phaseAt } from '../game/clock';
import { buildableKey, planTown, RELIEF_MAX, type PlannedBuilding, type Surface, type TownPlan } from './townPlan';
import { footprintOf, rotateCell, townTemplate, TOWN_STAGES, type TownTemplate } from './townTemplates';

/** Cells Orrin reaches per day of working time. */
export const DAY_BUDGET = 32;
/** Most cells a plot may have in the way (player-edited, or blocks that are not movable) before it is dropped. */
export const MAX_BLOCKED = 6;
/** Most cells placed in one tick (a few hundred at most, so a catch-up does not stall a frame). */
export const MAX_PER_TICK = 300;
/** Seconds between attempts to plan a town when no site suits yet. */
export const PLAN_RETRY_S = 10;
/** Owed budget is kept to this many days, so a long absence catches up without an unbounded burst. */
const MAX_OWED_DAYS = 4;
/** Blocks Orrin digs out of the way (grass, plants, dirt bumps, loose stone) when they are not the player's. */
export const MOVABLE = new Set(['grass', 'tall_grass', 'fern', 'dry_shrub', 'dirt', 'gravel', 'stone', 'rubble', 'snow', 'sand', 'clay', 'ember_poppy', 'skybell', 'frost_lily']);

/** What the builder needs from the game. */
export interface TownHost {
  day(): number;
  timeOfDay(): number;
  /** The top solid block of a column; null when it is not loaded. */
  townSurface(x: number, z: number): Surface | null;
  /** The block key at a cell; null when its chunk is not loaded. */
  townBlock(x: number, y: number, z: number): string | null;
  /** True when the player (or anything but the world's generation) changed the cell. */
  townEdited(x: number, y: number, z: number): boolean;
  /** Sets a block (or 'air') with the 'town' change source. False when the chunk is not loaded. */
  townPlace(x: number, y: number, z: number, block: string, facing: number): boolean;
}

/** One cell of a building in the world: a placement, or a dig (block 'air' that clears movable blocks). */
export interface TownJob {
  x: number;
  y: number;
  z: number;
  dig: boolean;
  block: string;
  facing: number;
  /** Index into TOWN_STAGES. */
  stage: number;
}

export interface TownItem {
  item: string;
  count: number;
}

export interface TownSnapshot {
  v: 1;
  plan: { site: [number, number]; buildings: PlannedBuilding[] } | null;
  building: number;
  /** The base row of the current building, its ground heights under the footprint, and the progress counters. */
  base: number | null;
  ground: number[];
  stage: number;
  cell: number;
  laid: number;
  lastDay: number;
  owed: number;
  accrued: number;
  blocked: number;
  bay: Record<string, number>;
}

const STAGE_INDEX = new Map(TOWN_STAGES.map((s, i) => [s, i]));

/**
 * The cells of a planned building at `base`, given the ground under its footprint (index i * d + j, rotated footprint). Stilts and
 * digs come first in their stages, then the template's own cells, in stage order and bottom-up.
 */
export function buildCells(t: TownTemplate, b: PlannedBuilding, base: number, ground: readonly number[]): TownJob[] {
  const f = footprintOf(t, b.rot);
  const out: TownJob[] = [];
  for (let i = 0; i < f.w; i++) {
    for (let j = 0; j < f.d; j++) {
      const g = ground[i * f.d + j];
      const x = b.x + i;
      const z = b.z + j;
      if (g >= base) for (let y = base; y <= g; y++) out.push({ x, y, z, dig: true, block: 'air', facing: 0, stage: 0 });
      else for (let y = g + 1; y < base; y++) out.push({ x, y, z, dig: false, block: 'stone_brick', facing: 0, stage: 1 });
    }
  }
  for (const c of t.cells) {
    const r = rotateCell(c.x, c.z, t.w, t.d, b.rot, c.facing);
    const job = { x: b.x + r.x, y: base + c.y, z: b.z + r.z, facing: r.facing, stage: STAGE_INDEX.get(c.stage) ?? 0 };
    if (c.block === 'air') out.push({ ...job, dig: true, block: 'air', facing: 0 });
    else out.push({ ...job, dig: false, block: c.block });
  }
  return out.sort((p, q) => p.stage - q.stage || p.y - q.y || p.z - q.z || p.x - q.x);
}

/** Whether a cell is in the way: the player's, or a block that is neither movable nor the target. */
function blockedCell(c: TownJob, key: string, edited: boolean): boolean {
  if (c.dig) return key !== 'air' && (!MOVABLE.has(key) || edited);
  if (key === c.block) return false;
  return edited || !(key === 'air' || MOVABLE.has(key));
}

export class TownBuilder {
  private plan: TownPlan | null = null;
  private building = 0;
  private base: number | null = null;
  private ground: number[] = [];
  private cells: TownJob[] = [];
  private cell = 0;
  private laid = 0;
  private lastDay = 0;
  private owed = 0;
  private accrued = 0;
  /** Cells skipped because the player's or an unmovable block was in the way. */
  blocked = 0;
  private readonly bay = new Map<string, number>();
  private planWait = 0;

  /** The plan (site and buildings), or null while no site has been found. */
  get planned(): TownPlan | null {
    return this.plan;
  }

  /** True once every planned building is finished or dropped. */
  get done(): boolean {
    return this.plan !== null && this.building >= this.plan.buildings.length;
  }

  /** The building being raised now (its template key), or null. */
  get currentTemplate(): string | null {
    return this.plan && !this.done ? this.plan.buildings[this.building].template : null;
  }

  /** The stage index of the cell being laid, or -1 when nothing is in progress. */
  stage(): number {
    if (this.base === null || this.cells.length === 0) return -1;
    const c = this.cells[Math.min(this.laid, this.cells.length - 1)];
    return c.stage;
  }

  /** The storage bay's stock (a copy). */
  stock(): Record<string, number> {
    return Object.fromEntries(this.bay);
  }

  /** Puts materials into the storage bay (the player's delivery, or later a board's). Returns how many were taken in. */
  deliver(item: string, count: number): number {
    if (!item || !(count > 0)) return 0;
    const n = Math.floor(count);
    this.bay.set(item, (this.bay.get(item) ?? 0) + n);
    return n;
  }

  /** What the current stage still needs from the bay beyond its stock: the blocks left in the stage, less what the bay holds. */
  missing(): TownItem[] {
    if (this.base === null || this.laid >= this.cells.length) return [];
    const st = this.cells[this.laid].stage;
    const need = new Map<string, number>();
    for (let i = this.laid; i < this.cells.length && this.cells[i].stage === st; i++) {
      const c = this.cells[i];
      if (!c.dig) need.set(c.block, (need.get(c.block) ?? 0) + 1);
    }
    const out: TownItem[] = [];
    for (const [item, n] of need) {
      const short = n - (this.bay.get(item) ?? 0);
      if (short > 0) out.push({ item, count: short });
    }
    return out.sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
  }

  /**
   * One game tick. `seed` and `origin` (a generic anchor: the tavern centre now, a camp later) plan the town the first time, and
   * again whenever no site suits.
   */
  tick(dt: number, host: TownHost, seed: number, origin: readonly [number, number]): void {
    if (!this.plan) {
      this.planWait -= dt;
      if (this.planWait > 0) return;
      this.planWait = PLAN_RETRY_S;
      this.plan = planTown(seed, origin, (x, z) => host.townSurface(x, z));
      if (!this.plan) return;
    }
    const day = host.day();
    if (this.lastDay === 0) this.lastDay = day;
    if (day !== this.lastDay) {
      // The day that ended credits what it did not spend (a sleep through the evening, say), and any days skipped outright.
      this.owed += Math.max(0, DAY_BUDGET - this.accrued) + DAY_BUDGET * Math.max(0, day - this.lastDay - 1);
      this.accrued = 0;
      this.lastDay = day;
    }
    if (phaseAt(host.timeOfDay()) === 'day') {
      const add = (DAY_BUDGET * dt) / (DAY_LENGTH_S * (SUNSET_AT - 2 * TWILIGHT));
      this.accrued += add;
      this.owed += add;
    }
    this.owed = Math.min(this.owed, MAX_OWED_DAYS * DAY_BUDGET);
    this.work(host);
  }

  private work(host: TownHost): void {
    for (let guard = 0; guard < 64 && this.plan && !this.done; guard++) {
      if (this.base === null) {
        const r = this.start(host);
        if (r === 'wait') return;
        if (r === 'skip') {
          this.nextBuilding();
          continue;
        }
      }
      while (this.cell < this.cells.length && this.owed >= 1) {
        this.cell++;
        this.owed -= 1;
      }
      let placed = 0;
      while (this.laid < this.cell && placed < MAX_PER_TICK) {
        if (this.attempt(host, this.cells[this.laid]) === 'wait') return;
        this.laid++;
        placed++;
      }
      if (this.laid >= this.cells.length && this.cell >= this.cells.length) {
        this.nextBuilding();
        continue;
      }
      return;
    }
  }

  private nextBuilding(): void {
    this.building++;
    this.base = null;
    this.ground = [];
    this.cells = [];
    this.cell = 0;
    this.laid = 0;
  }

  /** Reads the footprint and fixes the base row and the cells; 'wait' when a chunk is unknown, 'skip' when the plot is no good. */
  private start(host: TownHost): 'ok' | 'wait' | 'skip' {
    const b = this.plan!.buildings[this.building];
    const t = townTemplate(b.template);
    if (!t) return 'skip';
    const f = footprintOf(t, b.rot);
    const ground: number[] = [];
    let lo = Infinity;
    let hi = -Infinity;
    let topEdits = 0;
    for (let i = 0; i < f.w; i++) {
      for (let j = 0; j < f.d; j++) {
        const s = host.townSurface(b.x + i, b.z + j);
        if (s === null) return 'wait';
        if (!buildableKey(s.key)) return 'skip';
        if (host.townEdited(b.x + i, s.y, b.z + j)) topEdits++;
        ground.push(s.y);
        lo = Math.min(lo, s.y);
        hi = Math.max(hi, s.y);
      }
    }
    if (hi - lo > RELIEF_MAX || topEdits > MAX_BLOCKED) return 'skip';
    const base = lo + 1;
    const cells = buildCells(t, b, base, ground);
    let blockedHere = 0;
    for (const c of cells) {
      const key = host.townBlock(c.x, c.y, c.z);
      if (key === null) return 'wait';
      if (blockedCell(c, key, host.townEdited(c.x, c.y, c.z))) blockedHere++;
    }
    if (blockedHere > MAX_BLOCKED) return 'skip';
    this.base = base;
    this.ground = ground;
    this.cells = cells;
    this.cell = 0;
    this.laid = 0;
    return 'ok';
  }

  /** Lays one cell. 'wait' when its chunk is unloaded or the bay lacks the block; otherwise done (placed, dug, or skipped as blocked). */
  private attempt(host: TownHost, c: TownJob): 'done' | 'wait' {
    const key = host.townBlock(c.x, c.y, c.z);
    if (key === null) return 'wait';
    const edited = host.townEdited(c.x, c.y, c.z);
    if (c.dig) {
      if (key === 'air') return 'done';
      if (!MOVABLE.has(key) || edited) {
        this.blocked++;
        return 'done';
      }
      return this.digOut(host, c, key) ? 'done' : 'wait';
    }
    if (key === c.block) return 'done';
    if (blockedCell(c, key, edited)) {
      this.blocked++;
      return 'done';
    }
    if ((this.bay.get(c.block) ?? 0) < 1) return 'wait';
    if (key !== 'air' && !this.digOut(host, c, key)) return 'wait';
    this.take(c.block, 1);
    if (!host.townPlace(c.x, c.y, c.z, c.block, c.facing)) {
      this.add(c.block, 1);
      return 'wait';
    }
    return 'done';
  }

  /** Clears a movable block: its drops go into the bay. False when the chunk would not take it. */
  private digOut(host: TownHost, c: TownJob, key: string): boolean {
    if (!host.townPlace(c.x, c.y, c.z, 'air', 0)) return false;
    for (const d of blockOrNull(key)?.drops ?? []) {
      if ((d.chance ?? 1) < 1) continue;
      const n = typeof d.count === 'number' ? d.count : d.count[0];
      this.add(d.item, n);
    }
    return true;
  }

  private add(item: string, n: number): void {
    if (n > 0) this.bay.set(item, (this.bay.get(item) ?? 0) + n);
  }

  private take(item: string, n: number): void {
    this.bay.set(item, (this.bay.get(item) ?? 0) - n);
  }

  toJSON(): TownSnapshot | undefined {
    if (!this.plan) return undefined;
    const r3 = (n: number): number => Math.round(n * 1000) / 1000;
    return {
      v: 1,
      plan: { site: [...this.plan.site] as [number, number], buildings: this.plan.buildings.map((b) => ({ ...b })) },
      building: this.building,
      base: this.base,
      ground: [...this.ground],
      stage: this.stage(),
      cell: this.cell,
      laid: this.laid,
      lastDay: this.lastDay,
      owed: r3(this.owed),
      accrued: r3(this.accrued),
      blocked: this.blocked,
      bay: this.stock(),
    };
  }

  /** Restores a snapshot. Missing or malformed data starts a fresh town (an old save has none). */
  load(raw: unknown): void {
    this.plan = null;
    this.building = 0;
    this.base = null;
    this.ground = [];
    this.cells = [];
    this.cell = 0;
    this.laid = 0;
    this.lastDay = 0;
    this.owed = 0;
    this.accrued = 0;
    this.blocked = 0;
    this.bay.clear();
    this.planWait = 0;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<TownSnapshot>;
    const int = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0);
    const p = r.plan;
    if (!p || typeof p !== 'object' || !Array.isArray(p.site) || !Array.isArray(p.buildings)) return;
    const buildings: PlannedBuilding[] = [];
    for (const b of p.buildings) {
      if (!b || typeof b !== 'object' || !townTemplate(b.template) || ![b.x, b.z, b.rot].every(Number.isFinite)) return;
      buildings.push({ template: b.template, x: b.x, z: b.z, rot: ((b.rot % 4) + 4) % 4 });
    }
    if (!(Number.isFinite(p.site[0]) && Number.isFinite(p.site[1]))) return;
    this.plan = { site: [p.site[0], p.site[1]], buildings };
    this.building = Math.min(int(r.building), buildings.length);
    this.lastDay = int(r.lastDay);
    this.owed = num(r.owed);
    this.accrued = num(r.accrued);
    this.blocked = int(r.blocked);
    for (const [k, v] of Object.entries(r.bay ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v > 0) this.bay.set(k, Math.floor(v));
    const b = this.done ? null : buildings[this.building];
    const t = b ? townTemplate(b.template) : null;
    const base = r.base;
    if (b && t && typeof base === 'number' && Number.isFinite(base) && Array.isArray(r.ground)) {
      const f = footprintOf(t, b.rot);
      if (r.ground.length === f.w * f.d && r.ground.every(Number.isFinite)) {
        this.base = base;
        this.ground = [...r.ground];
        this.cells = buildCells(t, b, base, this.ground);
        this.cell = Math.min(int(r.cell), this.cells.length);
        this.laid = Math.min(int(r.laid), this.cell);
      }
    }
  }
}
