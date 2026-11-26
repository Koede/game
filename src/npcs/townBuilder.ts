/**
 * The town builder (docs/plans/orrin-builds-a-town.md, sections 2 and 3-of-phase-2): Gruk raises the planned buildings one by one
 * through the world. Pure over a small host interface (see TownHost), so it is testable without the game.
 *
 * - Pace: DAY_BUDGET cells per day, spent during the day phase; a turned day (sleep, time away) credits the rest of the day.
 * - Order: each building's cells run clearing, frame, walls, roof, finish, bottom-up within a stage. Progress has two counters:
 *   `cell` (how far the budget has reached) and `laid` (how far placement has got). Placement lags the budget when a chunk is not
 *   loaded or the bay is short, and catches up in batches (MAX_PER_TICK) when it can.
 * - Materials: every placed block is taken from the storage bay's stock. Digging a movable block out of the way puts its drops into
 *   the bay. With too little stock Gruk waits, and `missing()` names what the current stage still needs. `deliver()` adds stock.
 * - Protection: a cell the player (or anything but the world's generation) changed is never overwritten or dug; a plot with too
 *   many such cells, or with unbuildable ground, is dropped and the next plot is used.
 * - Stilts: columns under the footprint are filled with stone from the bay up to the base row, so a house on a slope stands on
 *   tall footings instead of a flattened pad. Nothing is levelled for free.
 */
import { DAY_LENGTH_S, SUNSET_AT, TWILIGHT } from '../core/constants';
import { hash32, mulberry32 } from '../core/math';
import { blockOrNull } from '../core/registry';
import type { Slot } from '../core/types';
import { phaseAt } from '../game/clock';
import { rollDrops } from '../game/mining';
import { festivalDay } from './festival';
import { buildableKey, planTown, RELIEF_MAX, type PlannedBuilding, type Surface, type TownPlan } from './townPlan';
import { footprintOf, rotateCell, townTemplate, TOWN_STAGES, type TownTemplate } from './townTemplates';
import type { BuildBoardSnapshot } from './buildBoard';
import { LODGE_D, LODGE_PATH, LODGE_W, lodgeTemplate, lodgeVolume, stageBlocks } from './lodge';

/** The NPC who builds the town (the owner's choice: Gruk, the orc smith). Trust for the build board is paid to this id. */
export const BUILDER_ID = 'gruk';

/** Cells Gruk reaches per day of working time. */
export const DAY_BUDGET = 32;
/** Most cells a plot may have in the way (player-edited, or blocks that are not movable) before it is dropped. */
export const MAX_BLOCKED = 6;
/** Most cells placed in one tick (a few hundred at most, so a catch-up does not stall a frame). */
export const MAX_PER_TICK = 300;
/** Seconds between attempts to plan a town when no site suits yet. */
export const PLAN_RETRY_S = 10;
/** Owed budget is kept to this many days, so a long absence catches up without an unbounded burst. */
const MAX_OWED_DAYS = 4;
/** Most days after a turned day that are counted one by one for skipped working days (the owed cap makes the rest moot). */
const MAX_GAP_DAYS = 16;
/** Blocks Gruk digs out of the way (grass, plants, dirt bumps, loose stone) when they are not the player's. */
export const MOVABLE = new Set(['grass', 'tall_grass', 'fern', 'dry_shrub', 'dirt', 'gravel', 'stone', 'rubble', 'snow', 'sand', 'clay', 'ember_poppy', 'skybell', 'frost_lily']);

/** The storage bay's crate as the builder sees it: its slots (read) and what it can take or give up (Inventory fits). */
export interface StockCrate {
  readonly slots: readonly Slot[];
  add(item: string, count: number): number;
  remove(item: string, count: number): number;
}

/**
 * Gruk rests on festival days (festival.ts): no digging, no placing, and no budget earned. Only while a festival can run at all
 * (`festivals`, the manager's gate: the tavern and three people); at the camp a festival day is a working day.
 */
export const workDay = (day: number, festivals = true): boolean => !(festivals && festivalDay(day));

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
  /** True while Gruk is away (hired to follow the player): building pauses and the time away earns no budget. */
  away?(): boolean;
  /** Whether a festival can run (the tavern and three people). Without it every festival day is a rest day, as before. */
  festivals?(): boolean;
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

/** A building Gruk has finished: its template, its origin and rotation, and the base row it stood on. */
export interface FinishedBuilding {
  template: string;
  x: number;
  z: number;
  rot: number;
  base: number;
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
  /** The building board (buildBoard.ts); written by the manager, optional so older saves load. */
  board?: BuildBoardSnapshot;
  /** Items the player took out of the bay's crate and has not put back: a later deposit of them pays nothing (optional). */
  taken?: Record<string, number>;
  /**
   * The lodge's progress (lodge.ts): the stage in progress (0..4), the floor row it stands on, and whether it was settled (dev skip).
   * Optional: a town without a lodge in its plan (every older save) has none.
   */
  lodge?: { stage: number; base: number | null; done: boolean };
}

const STAGE_INDEX = new Map(TOWN_STAGES.map((s, i) => [s, i]));

/**
 * The cells of a planned building at `base`, given the ground under its footprint (index i * d + j, rotated footprint). Stilts and
 * digs come first in their stages, then the template's own cells, in stage order and bottom-up.
 */
export function buildCells(t: TownTemplate, b: PlannedBuilding, base: number, ground: readonly number[], footing = true): TownJob[] {
  const f = footprintOf(t, b.rot);
  const out: TownJob[] = [];
  for (let i = 0; footing && i < f.w; i++) {
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

/**
 * Whether Gruk may move a natural block out of the way: the MOVABLE ground blocks, and any loose growth that is not solid (wild
 * crops, flowers, mushrooms, ferns), and leaves (trimming overhanging branches). Logs, ores, liquids and machines stay. The caller
 * already refuses player-edited cells.
 */
export function movable(key: string): boolean {
  if (MOVABLE.has(key)) return true;
  // Overhanging branches are trimmed (leaves only: a trunk is never felled).
  if (key.endsWith('_leaves')) return true;
  const def = blockOrNull(key);
  return !!def && key !== 'air' && !def.solid && def.liquid === null && !def.machine;
}

/** Whether a cell is in the way: the player's, or a block that is neither movable nor the target. */
function blockedCell(c: TownJob, key: string, edited: boolean): boolean {
  if (c.dig) return key !== 'air' && (!movable(key) || edited);
  if (key === c.block) return false;
  return edited || !(key === 'air' || movable(key));
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
  private finishedQ: FinishedBuilding[] = [];
  /** The world seed (kept from the last tick): digs roll their drops from it and the cell. */
  private seed = 0;
  /** The crate's counts as the last sync left them (null until the crate is seen). */
  private seen: Map<string, number> | null = null;
  /** The template Gruk waits on because no planned building is unlocked yet, or null. */
  private waiting: string | null = null;
  /** Why plots were skipped, newest last (for the debug read; not saved). */
  private skips: string[] = [];
  /** Plots the storage bay has been tried on (so it never swaps back and forth). Not saved: a reload simply tries again. */
  private tried = new Set<string>();
  private skipWhy = '';
  /** The lodge (lodge.ts) in progress: its stage (0..4), its floor row, and whether it was settled by the dev skip. */
  private lodgeStage = 0;
  private lodgeBase: number | null = null;
  private lodgeDone = false;
  /**
   * What Gruk himself left in the cells of the lodge (and the air he cleared over the plot): the block each should hold. A cell
   * that still holds that block is not the player's, so a later stage may replace it.
   */
  private owned = new Map<string, string>();
  /** Items the player took out of the crate and has not put back (see `repay`). */
  private readonly taken = new Map<string, number>();

  /** `unlocked` says whether a template may start now (reputation, see buildBoard.ts). Everything is unlocked by default. */
  constructor(private readonly unlocked: (template: string) => boolean = () => true) {}

  /** The base row of the building in progress (null when none has started). */
  buildBase(): number | null {
    return this.base;
  }

  /** The planned building at the head of the queue (the one being raised, or next), or null. */
  currentPlace(): PlannedBuilding | null {
    return this.plan && !this.done ? this.plan.buildings[this.building] : null;
  }

  /** How far the budget and placement have got in the building in progress, and its cell count (for the debug read). */
  progress(): { cell: number; laid: number; cells: number; blocked: number; skips: string[]; next: { x: number; y: number; z: number; block: string; dig: boolean; stage: number } | null } {
    const c = this.cells[this.laid] ?? null;
    return { cell: this.cell, laid: this.laid, cells: this.cells.length, blocked: this.blocked, skips: this.skips, next: c ? { x: c.x, y: c.y, z: c.z, block: c.block, dig: c.dig, stage: c.stage } : null };
  }

  /** The template Gruk waits on because nothing planned is unlocked, or null. */
  waitingOn(): string | null {
    return this.waiting;
  }

  /** The buildings finished since the last call (the board and the town's reputation take them). */
  takeFinished(): FinishedBuilding[] {
    const out = this.finishedQ;
    this.finishedQ = [];
    return out;
  }

  /** The plan (site and buildings), or null while no site has been found. */
  get planned(): TownPlan | null {
    return this.plan;
  }

  /** True once every planned building is finished or dropped. */
  get done(): boolean {
    return this.plan !== null && this.building >= this.plan.buildings.length;
  }

  /** The building being raised now (its template key; the lodge's current stage key), or null. */
  get currentTemplate(): string | null {
    if (!this.plan || this.done) return null;
    const t = this.plan.buildings[this.building].template;
    return t === 'lodge' ? LODGE_PATH[this.lodgeStage] : t;
  }

  /** The plan's index of the lodge, or -1 (no lodge in this town: every older save). */
  private lodgeIndex(): number {
    return this.plan ? this.plan.buildings.findIndex((b) => b.template === 'lodge') : -1;
  }

  /** Whether the town's plan has a lodge (the new worlds do; older towns do not). */
  hasLodge(): boolean {
    return this.lodgeIndex() >= 0;
  }

  /**
   * How many lodge stages are finished: 0 before the lodge, 1 once it stands, up to 5 (the full tavern). A town with no lodge
   * reads 0, and a settled one 5.
   */
  lodgeLevel(): number {
    const idx = this.lodgeIndex();
    if (idx < 0) return 0;
    if (this.lodgeDone || this.building > idx) return LODGE_PATH.length;
    return this.building === idx ? this.lodgeStage : 0;
  }

  /** The lodge's origin in the world (the plot corner at its floor row), once its first stage has started; null before. */
  lodgeOrigin(): [number, number, number] | null {
    const idx = this.lodgeIndex();
    if (idx < 0 || this.lodgeBase === null) return null;
    const b = this.plan!.buildings[idx];
    return [b.x, this.lodgeBase, b.z];
  }

  /**
   * Settles the lodge at once (the dev skip builds the full tavern itself, so Gruk leaves the lodge's stages alone). Any stage in
   * progress is dropped; the lodge counts as finished.
   */
  finishLodge(): void {
    this.lodgeDone = true;
    const idx = this.lodgeIndex();
    if (idx >= 0 && this.building === idx) this.nextBuilding();
    this.lodgeStage = 0;
  }

  /** Cells Gruk owns: the footing and the air over the plot (clear), then what the stages before `k` placed. */
  private ownedFor(k: number, b: PlannedBuilding, base: number, ground: readonly number[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const [x, y, z] of lodgeVolume()) m.set(`${b.x + x},${base + y},${b.z + z}`, 'air');
    // The footing alone (stilts and digs under and over the base row), built from an empty template.
    const footing = buildCells({ key: '', name: '', w: LODGE_W, d: LODGE_D, door: { x: 0, z: 0, facing: 0 }, cells: [] }, b, base, ground, true);
    for (const j of footing) m.set(`${j.x},${j.y},${j.z}`, j.dig ? 'air' : j.block);
    for (let s = 0; s < k; s++) for (const c of stageBlocks(s)) m.set(`${b.x + c.x},${base + c.y},${b.z + c.z}`, c.block);
    return m;
  }

  /** The cells of the lodge's stage k: the first stage with its footing, the later ones only what they change. */
  private lodgeCells(k: number, b: PlannedBuilding, base: number, ground: readonly number[]): TownJob[] {
    return buildCells(lodgeTemplate(k), b, base, ground, k === 0);
  }

  /** Whether the player (or anything but the lodge's own work) changed a cell: Gruk's own blocks do not count. */
  private edited(host: TownHost, x: number, y: number, z: number, key: string): boolean {
    return host.townEdited(x, y, z) && this.owned.get(`${x},${y},${z}`) !== key;
  }

  /** The stage index of the cell being laid, or -1 when nothing is in progress. */
  stage(): number {
    if (this.base === null || this.cells.length === 0) return -1;
    const c = this.cells[Math.min(this.laid, this.cells.length - 1)];
    return c.stage;
  }

  /**
   * Reconciles the storage bay's stock with its crate. Counts the player put in or took out since the last look change the stock;
   * then the crate is brought to the stock (whatever does not fit stays in the stock). Null when there is no crate: the stock stays.
   * Returns what the player put in (the manager pays the part that matches a bounty through the board); a take-out is remembered
   * (`repay`), so putting the same items back pays nothing.
   */
  syncCrate(crate: StockCrate | null): TownItem[] {
    const put: TownItem[] = [];
    if (!crate) {
      this.seen = null;
      return put;
    }
    const counts = (): Map<string, number> => {
      const m = new Map<string, number>();
      for (const s of crate.slots) if (s) m.set(s.item, (m.get(s.item) ?? 0) + s.count);
      return m;
    };
    const cur = counts();
    if (this.seen === null) this.seen = cur;
    for (const item of new Set([...cur.keys(), ...this.seen.keys()])) {
      const d = (cur.get(item) ?? 0) - (this.seen.get(item) ?? 0);
      if (d > 0) {
        this.add(item, d);
        put.push({ item, count: d });
      } else if (d < 0) {
        this.bay.set(item, Math.max(0, (this.bay.get(item) ?? 0) + d));
        this.taken.set(item, (this.taken.get(item) ?? 0) - d);
      }
    }
    for (const item of new Set([...this.bay.keys(), ...cur.keys()])) {
      const want = this.bay.get(item) ?? 0;
      const have = cur.get(item) ?? 0;
      if (want > have) crate.add(item, want - have);
      else if (want < have) crate.remove(item, have - want);
    }
    this.seen = counts();
    return put;
  }

  /**
   * Of `count` of `item` going into the bay, the part that is new: items the player took out of the crate earlier are put back
   * first and count for nothing (so a take-out and a put-back cannot be paid twice). Uses up that much of the take-out record.
   */
  repay(item: string, count: number): number {
    const owe = this.taken.get(item) ?? 0;
    const back = Math.min(owe, Math.max(0, count));
    if (owe - back > 0) this.taken.set(item, owe - back);
    else this.taken.delete(item);
    return Math.max(0, count) - back;
  }

  /** How many of `item` the player took out of the crate and has not put back. */
  takenOut(item: string): number {
    return this.taken.get(item) ?? 0;
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
    this.seed = seed;
    if (!this.plan) {
      this.planWait -= dt;
      if (this.planWait > 0) return;
      this.planWait = PLAN_RETRY_S;
      this.plan = planTown(seed, origin, (x, z) => host.townSurface(x, z));
      if (!this.plan) return;
    }
    const day = host.day();
    const fests = host.festivals ? host.festivals() : true;
    const away = host.away ? host.away() : false;
    if (this.lastDay === 0) this.lastDay = day;
    if (day !== this.lastDay) {
      // The day that ended credits what it did not spend (a sleep through the evening, say), and each working day skipped
      // outright. A festival day is a rest day: it earns nothing (only while a festival can run).
      let credit = workDay(this.lastDay, fests) ? Math.max(0, DAY_BUDGET - this.accrued) : 0;
      for (let d = this.lastDay + 1; d < day && d <= this.lastDay + MAX_GAP_DAYS; d++) if (workDay(d, fests)) credit += DAY_BUDGET;
      this.owed += credit;
      this.accrued = 0;
      this.lastDay = day;
    }
    if (phaseAt(host.timeOfDay()) === 'day' && workDay(day, fests)) {
      const add = (DAY_BUDGET * dt) / (DAY_LENGTH_S * (SUNSET_AT - 2 * TWILIGHT));
      this.accrued += add;
      // Away (hired): the working time passes as if spent, so the end of the day credits none of it back.
      if (!away) this.owed += add;
    }
    this.owed = Math.min(this.owed, MAX_OWED_DAYS * DAY_BUDGET);
    if (away) return;
    this.work(host);
  }

  private work(host: TownHost): void {
    for (let guard = 0; guard < 64 && this.plan && !this.done; guard++) {
      if (this.base === null) {
        // A lodge settled by the dev skip is not built on its plot.
        if (this.lodgeDone && this.plan.buildings[this.building].template === 'lodge') {
          this.nextBuilding();
          continue;
        }
        // A locked building is passed over: the next unlocked one in the queue is brought to the front (the plan is saved).
        const at = this.nextUnlocked();
        if (at < 0) {
          this.waiting = this.plan.buildings[this.building].template;
          return;
        }
        this.waiting = null;
        if (at !== this.building) {
          const b = this.plan.buildings;
          [b[this.building], b[at]] = [b[at], b[this.building]];
        }
        const r = this.start(host);
        if (r === 'wait') return;
        if (r === 'skip') {
          this.skips = [...this.skips, `${this.plan.buildings[this.building].template}: ${this.skipWhy}`].slice(-8);
          // The storage bay is never dropped (the board and every later building need it): it swaps plots with a later building
          // whose plot can hold it, and is tried there next.
          if (this.plan.buildings[this.building].template === 'storage_bay' && this.moveBay()) continue;
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
        const b = this.plan!.buildings[this.building];
        this.finishedQ.push({ template: this.currentTemplate ?? b.template, x: b.x, z: b.z, rot: b.rot, base: this.base ?? 0 });
        if (b.template === 'lodge' && this.lodgeStage < LODGE_PATH.length - 1) {
          // The next room of the lodge: the same plot and floor row, the cells of that stage only.
          this.lodgeStage++;
          this.cells = this.lodgeCells(this.lodgeStage, b, this.base ?? 0, this.ground);
          this.owned = this.ownedFor(this.lodgeStage, b, this.base ?? 0, this.ground);
          this.cell = 0;
          this.laid = 0;
          continue;
        }
        this.nextBuilding();
        continue;
      }
      return;
    }
  }

  /** Index of the first planned building, from the head of the queue, that may start now; -1 when none may. */
  private nextUnlocked(): number {
    if (!this.plan) return -1;
    for (let i = this.building; i < this.plan.buildings.length; i++) if (this.unlocked(this.plan.buildings[i].template)) return i;
    return -1;
  }

  /** Swaps the storage bay's plot with the next later plot big enough for it (the bay keeps its place in the queue). */
  private moveBay(): boolean {
    if (!this.plan) return false;
    const b = this.plan.buildings;
    const bay = b[this.building];
    const need = townTemplate('storage_bay');
    if (!need) return false;
    for (let j = this.building + 1; j < b.length; j++) {
      const t = townTemplate(b[j].template);
      if (!t || this.tried.has(`${b[j].x},${b[j].z}`)) continue;
      const fits = (w: number, d: number): boolean => w >= need.w && d >= need.d;
      const fp = footprintOf(t, b[j].rot);
      if (!fits(fp.w, fp.d) && !fits(fp.d, fp.w)) continue;
      this.tried.add(`${bay.x},${bay.z}`);
      // The bay takes the larger plot, rotated to fit; the other building takes the bay's old plot (it may be skipped there).
      const rot = fits(fp.w, fp.d) ? 0 : 1;
      const other = { template: b[j].template, x: bay.x, z: bay.z, rot: bay.rot };
      b[this.building] = { template: 'storage_bay', x: b[j].x, z: b[j].z, rot };
      b[j] = other;
      this.base = null;
      return true;
    }
    return false;
  }

  private nextBuilding(): void {
    this.building++;
    this.base = null;
    this.ground = [];
    this.owned = new Map();
    this.cells = [];
    this.cell = 0;
    this.laid = 0;
  }

  /** Reads the footprint and fixes the base row and the cells; 'wait' when a chunk is unknown, 'skip' when the plot is no good. */
  private start(host: TownHost): 'ok' | 'wait' | 'skip' {
    const b = this.plan!.buildings[this.building];
    const t = townTemplate(b.template);
    if (!t) {
      this.skipWhy = 'no template';
      return 'skip';
    }
    const f = footprintOf(t, b.rot);
    const ground: number[] = [];
    let lo = Infinity;
    let hi = -Infinity;
    let topEdits = 0;
    for (let i = 0; i < f.w; i++) {
      for (let j = 0; j < f.d; j++) {
        const s = host.townSurface(b.x + i, b.z + j);
        if (s === null) return 'wait';
        if (!buildableKey(s.key)) {
          this.skipWhy = `ground is ${s.key} at ${b.x + i},${b.z + j}`;
          return 'skip';
        }
        if (host.townEdited(b.x + i, s.y, b.z + j)) topEdits++;
        ground.push(s.y);
        lo = Math.min(lo, s.y);
        hi = Math.max(hi, s.y);
      }
    }
    if (hi - lo > RELIEF_MAX || topEdits > MAX_BLOCKED) {
      this.skipWhy = `relief ${hi - lo}, edited tops ${topEdits}`;
      return 'skip';
    }
    const base = lo + 1;
    const cells = buildCells(t, b, base, ground);
    const lodge = b.template === 'lodge';
    this.owned = lodge ? this.ownedFor(0, b, base, ground) : new Map();
    let blockedHere = 0;
    for (const c of cells) {
      const key = host.townBlock(c.x, c.y, c.z);
      if (key === null) return 'wait';
      if (blockedCell(c, key, this.edited(host, c.x, c.y, c.z, key))) blockedHere++;
    }
    // The lodge's air over the plot is cleared before it starts (no budget: the plot is cleared, not built). Anything in the way
    // that is not movable, or was changed by the player, counts against the plot like any other blocked cell.
    const clear: [number, number, number][] = [];
    if (lodge) {
      const inTemplate = new Set(cells.map((c) => `${c.x},${c.y},${c.z}`));
      for (const [x, y, z] of lodgeVolume()) {
        const wx = b.x + x;
        const wy = base + y;
        const wz = b.z + z;
        if (inTemplate.has(`${wx},${wy},${wz}`)) continue;
        const key = host.townBlock(wx, wy, wz);
        if (key === null) return 'wait';
        if (key === 'air') continue;
        if (!movable(key) || host.townEdited(wx, wy, wz)) blockedHere++;
        else clear.push([wx, wy, wz]);
      }
    }
    if (blockedHere > MAX_BLOCKED) {
      this.skipWhy = `${blockedHere} cells in the way`;
      return 'skip';
    }
    for (const [x, y, z] of clear) host.townPlace(x, y, z, 'air', 0);
    this.base = base;
    this.ground = ground;
    this.cells = cells;
    this.cell = 0;
    this.laid = 0;
    if (lodge) this.lodgeBase = base;
    return 'ok';
  }

  /** Lays one cell. 'wait' when its chunk is unloaded or the bay lacks the block; otherwise done (placed, dug, or skipped as blocked). */
  private attempt(host: TownHost, c: TownJob): 'done' | 'wait' {
    const key = host.townBlock(c.x, c.y, c.z);
    if (key === null) return 'wait';
    // A block Gruk himself left here (the lodge's earlier stages) may be dug or replaced; the player's blocks may not.
    const own = this.owned.get(`${c.x},${c.y},${c.z}`) === key;
    const edited = own ? false : host.townEdited(c.x, c.y, c.z);
    if (c.dig) {
      if (key === 'air') return 'done';
      if (!own && (!movable(key) || edited)) {
        this.blocked++;
        return 'done';
      }
      return this.digOut(host, c, key) ? 'done' : 'wait';
    }
    if (key === c.block) return 'done';
    if (!own && blockedCell(c, key, edited)) {
      this.blocked++;
      this.skips = [...this.skips, `blocked ${c.block} at ${c.x},${c.y},${c.z}: found ${key}${edited ? ' (edited)' : ''}`].slice(-8);
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

  /**
   * Clears a movable block: its drops go into the bay. Chance drops are rolled with a generator seeded from the world seed and the
   * cell, so a dig gives the same result every time and the stock is right on average. False when the chunk would not take it.
   */
  private digOut(host: TownHost, c: TownJob, key: string): boolean {
    if (!host.townPlace(c.x, c.y, c.z, 'air', 0)) return false;
    const def = blockOrNull(key);
    if (def) for (const d of rollDrops(def, mulberry32(hash32(this.seed, c.x, c.y, c.z)))) this.add(d.item, d.count);
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
      taken: this.taken.size > 0 ? Object.fromEntries(this.taken) : undefined,
      lodge: this.hasLodge() ? { stage: this.lodgeStage, base: this.lodgeBase, done: this.lodgeDone } : undefined,
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
    this.taken.clear();
    this.planWait = 0;
    this.finishedQ = [];
    this.seen = null;
    this.waiting = null;
    this.lodgeStage = 0;
    this.lodgeBase = null;
    this.lodgeDone = false;
    this.owned = new Map();
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
    for (const [k, v] of Object.entries(r.taken ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v > 0) this.taken.set(k, Math.floor(v));
    const lg = r.lodge;
    if (lg && typeof lg === 'object') {
      this.lodgeStage = Math.min(LODGE_PATH.length - 1, int(lg.stage));
      this.lodgeBase = typeof lg.base === 'number' && Number.isFinite(lg.base) ? lg.base : null;
      this.lodgeDone = lg.done === true;
    }
    const b = this.done ? null : buildings[this.building];
    const isLodge = b?.template === 'lodge';
    const t = b ? townTemplate(isLodge ? LODGE_PATH[this.lodgeStage] : b.template) : null;
    const base = r.base;
    if (b && t && typeof base === 'number' && Number.isFinite(base) && Array.isArray(r.ground)) {
      const f = footprintOf(t, b.rot);
      if (r.ground.length === f.w * f.d && r.ground.every(Number.isFinite)) {
        this.base = base;
        this.ground = [...r.ground];
        this.cells = isLodge ? this.lodgeCells(this.lodgeStage, b, base, this.ground) : buildCells(t, b, base, this.ground);
        this.owned = isLodge ? this.ownedFor(this.lodgeStage, b, base, this.ground) : new Map();
        this.cell = Math.min(int(r.cell), this.cells.length);
        this.laid = Math.min(int(r.laid), this.cell);
      }
    }
  }
}
