/**
 * The blueprint book (docs/api/blueprint.md): the layouts the player owns, and the build jobs Gruk has been given. Saved in the
 * player snapshot as `blueprints` (missing in older saves: empty). Pure and DOM-free; the world is only touched by `tickJobs`.
 *
 * Blueprints come from three places: the player saving a box of their own build (BlueprintTools), `grant` (ruins, daily goals and
 * the like call it with a catalog id or a finished Blueprint), and the catalog below. A blueprint is owned once: granting one
 * already held (same id) says so and adds nothing.
 */
import { blockOrNull } from '../core/registry';
import type { IWorld } from '../core/types';
import { BuildJob, FREE_SOURCE, MAX_BLUEPRINT_CELLS, type Blueprint, type BlueprintCell, type MaterialSource } from './blueprint';

/** Blueprints held at most. */
export const MAX_BLUEPRINTS = 24;
/** Jobs Gruk works on at once. */
export const MAX_JOBS = 3;
/** Hands at work on a job: Gruk and one helper. */
export const JOB_BUILDERS = 2;
/** Jobs work only while the player is this close (blocks), so the chunks are loaded and the pack is the stock. */
export const JOB_RANGE = 48;

export type BlueprintOrigin = 'saved' | 'granted';

export interface BlueprintEntry {
  id: string;
  bp: Blueprint;
  origin: BlueprintOrigin;
}

export interface BlueprintJob {
  id: number;
  /** The entry the job was started from (its name shows in the list even if the entry is deleted). */
  name: string;
  job: BuildJob;
}

export interface BlueprintBookSnapshot {
  entries: BlueprintEntry[];
  jobs: { id: number; name: string; job: ReturnType<BuildJob['toJSON']> }[];
  nextId: number;
}

export interface GrantResult {
  ok: boolean;
  /** True when the blueprint was added (false: already held, full, or unknown). */
  added: boolean;
  text: string;
}

const cellsOf = (parts: [string, number, number, number, number, number, number][]): BlueprintCell[] => {
  const out: BlueprintCell[] = [];
  for (const [block, x0, y0, z0, x1, y1, z1] of parts) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push({ dx: x, dy: y, dz: z, block, facing: 0, item: block });
  }
  return out;
};

/** Hollow box: floor, four walls, flat roof. */
function hut(name: string, w: number, h: number, d: number, wall: string, roof: string): Blueprint {
  const cells = cellsOf([
    [wall, 0, 0, 0, w - 1, 0, d - 1],
    [wall, 0, 1, 0, w - 1, h - 1, 0],
    [wall, 0, 1, d - 1, w - 1, h - 1, d - 1],
    [wall, 0, 1, 1, 0, h - 1, d - 2],
    [wall, w - 1, 1, 1, w - 1, h - 1, d - 2],
    [roof, 0, h, 0, w - 1, h, d - 1],
  ]);
  return { name, size: [w, h + 1, d], cells };
}

/** The layouts the world can hand out by id (`grantBlueprint`). Data: add an entry and it can be granted. */
export const BLUEPRINT_CATALOG: Readonly<Record<string, () => Blueprint>> = {
  stone_hut: () => hut('Stone Hut', 5, 3, 5, 'stone', 'plank'),
  plank_shed: () => hut('Plank Shed', 4, 3, 3, 'plank', 'plank'),
  storage_row: () => ({ name: 'Storage Row', size: [5, 1, 1], cells: cellsOf([['crate', 0, 0, 0, 4, 0, 0]]) }),
};

/** A stable id for a catalog blueprint, so granting it twice is noticed. */
const catalogId = (key: string): string => `catalog:${key}`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A blueprint read back from a save: cells with unknown blocks are dropped, a damaged one is null. */
export function cleanBlueprint(raw: unknown): Blueprint | null {
  if (!isRecord(raw) || !Array.isArray(raw.cells) || !Array.isArray(raw.size) || raw.size.length !== 3) return null;
  const size = raw.size.map((n) => Math.max(1, Math.floor(Number(n)) || 1)) as [number, number, number];
  const cells: BlueprintCell[] = [];
  for (const c of raw.cells.slice(0, MAX_BLUEPRINT_CELLS)) {
    if (!isRecord(c) || typeof c.block !== 'string' || !blockOrNull(c.block)) continue;
    const dx = Math.floor(Number(c.dx));
    const dy = Math.floor(Number(c.dy));
    const dz = Math.floor(Number(c.dz));
    if (![dx, dy, dz].every(Number.isFinite) || dx < 0 || dy < 0 || dz < 0 || dx >= size[0] || dy >= size[1] || dz >= size[2]) continue;
    cells.push({ dx, dy, dz, block: c.block, facing: (Math.floor(Number(c.facing)) || 0) & 3, ...(typeof c.item === 'string' ? { item: c.item } : {}) });
  }
  if (cells.length === 0) return null;
  return { name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : 'Blueprint', size, cells };
}

export class BlueprintBook {
  entries: BlueprintEntry[] = [];
  jobs: BlueprintJob[] = [];
  private nextId = 1;

  get(id: string): BlueprintEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  /** Keeps a blueprint the player saved. Null when the book is full. */
  add(bp: Blueprint, origin: BlueprintOrigin = 'saved', id?: string): BlueprintEntry | null {
    if (this.entries.length >= MAX_BLUEPRINTS) return null;
    const entry: BlueprintEntry = { id: id ?? `bp${this.nextId++}`, bp, origin };
    this.entries.push(entry);
    return entry;
  }

  remove(id: string): boolean {
    const n = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    return this.entries.length < n;
  }

  rename(id: string, name: string): boolean {
    const e = this.get(id);
    const clean = name.trim().slice(0, 32);
    if (!e || !clean) return false;
    e.bp = { ...e.bp, name: clean };
    return true;
  }

  /**
   * The API other systems call to hand the player a blueprint (loot, daily goals): `what` is a catalog id (`stone_hut`) or a
   * finished Blueprint (it then needs an `id` of its own for the duplicate check, else it is always added).
   */
  grant(what: string | Blueprint, id?: string): GrantResult {
    let bp: Blueprint | null;
    let key: string | undefined;
    if (typeof what === 'string') {
      const make = BLUEPRINT_CATALOG[what];
      if (!make) return { ok: false, added: false, text: 'Unknown blueprint' };
      bp = make();
      key = catalogId(what);
    } else {
      bp = cleanBlueprint(what);
      key = id;
    }
    if (!bp) return { ok: false, added: false, text: 'That blueprint is damaged' };
    if (key && this.get(key)) return { ok: true, added: false, text: `You already have the ${bp.name} blueprint` };
    const entry = this.add(bp, 'granted', key);
    if (!entry) return { ok: false, added: false, text: 'The blueprint book is full' };
    return { ok: true, added: true, text: `New blueprint: ${bp.name}` };
  }

  /** Hands a blueprint to Gruk to raise with its low corner at `origin`. Null when he already has his hands full. */
  commission(bp: Blueprint, origin: readonly [number, number, number]): BlueprintJob | null {
    if (this.jobs.length >= MAX_JOBS) return null;
    const j: BlueprintJob = { id: this.nextId++, name: bp.name, job: new BuildJob(bp, origin) };
    this.jobs.push(j);
    return j;
  }

  cancelJob(id: number): boolean {
    const n = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    return this.jobs.length < n;
  }

  toJSON(): BlueprintBookSnapshot {
    return {
      entries: this.entries.map((e) => ({ id: e.id, bp: e.bp, origin: e.origin })),
      jobs: this.jobs.map((j) => ({ id: j.id, name: j.name, job: j.job.toJSON() })),
      nextId: this.nextId,
    };
  }

  load(s: Partial<BlueprintBookSnapshot> | undefined): void {
    this.entries = [];
    this.jobs = [];
    this.nextId = 1;
    if (!isRecord(s)) return;
    const seen = new Set<string>();
    for (const e of Array.isArray(s.entries) ? s.entries : []) {
      if (!isRecord(e) || typeof e.id !== 'string' || seen.has(e.id) || this.entries.length >= MAX_BLUEPRINTS) continue;
      const bp = cleanBlueprint(e.bp);
      if (!bp) continue;
      seen.add(e.id);
      this.entries.push({ id: e.id, bp, origin: e.origin === 'granted' ? 'granted' : 'saved' });
    }
    for (const j of Array.isArray(s.jobs) ? s.jobs : []) {
      if (!isRecord(j) || this.jobs.length >= MAX_JOBS) continue;
      const job = BuildJob.fromJSON(j.job as ReturnType<BuildJob['toJSON']>);
      if (job && job.total > 0) this.jobs.push({ id: Math.floor(Number(j.id)) || 0, name: typeof j.name === 'string' ? j.name.slice(0, 32) : job.bp.name, job });
    }
    const top = Math.max(0, ...this.jobs.map((j) => j.id));
    this.nextId = Math.max(1, Math.floor(Number(s.nextId)) || 1, top + 1);
  }
}

export interface JobReport {
  /** Jobs that finished this tick (removed from the book). */
  finished: string[];
  /** Jobs that ran dry this tick: name and the item they lack (reported once, until restocked). */
  dry: { name: string; item: string }[];
}

/**
 * Works every job for `dt` seconds with the player's pack (or a free supply) as the stock. A job pauses while the player is farther
 * than JOB_RANGE from its site, and a dry job is retried as soon as the stock has the item again.
 */
export function tickJobs(book: BlueprintBook, dt: number, world: IWorld, stock: MaterialSource, at: { x: number; z: number }, free = false): JobReport {
  const report: JobReport = { finished: [], dry: [] };
  const src = free ? FREE_SOURCE : stock;
  for (const j of [...book.jobs]) {
    const o = j.job.origin;
    const cx = o[0] + j.job.bp.size[0] / 2;
    const cz = o[2] + j.job.bp.size[2] / 2;
    if (Math.hypot(cx - at.x, cz - at.z) > JOB_RANGE) continue;
    const before = j.job.missing;
    if (before) j.job.resume();
    j.job.tick(dt, world, src, JOB_BUILDERS, 'player');
    if (j.job.state === 'done') {
      book.cancelJob(j.id);
      report.finished.push(j.name);
    } else if (j.job.missing && !before) report.dry.push({ name: j.name, item: j.job.missing });
  }
  return report;
}
