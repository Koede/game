/**
 * Fallen logs (docs/plans/tree-felling.md, phase 2): a felled trunk that lies on the ground as a saved entity, not as
 * blocks. Its length is the trunk blocks left; each axe cut takes one piece off the tip (game/treeFell.ts cutPiece),
 * which drops as normal log items. The log's pose is the rod's pivot and angle where the fall ended (treeBody.ts),
 * so drawing and aiming follow the same geometry as the fall.
 *
 * A log only ages while its chunk is loaded (it is frozen with its chunk, like everything else in the world) and never
 * while something is built or kept near it (a block entity within PROTECT_RADIUS). It warns LOG_WARN_S before it goes
 * and goes after LOG_LIFE_S of such time (one in-game day, core/constants DAY_LENGTH_S). DOM-free.
 */
import { DAY_LENGTH_S } from '../core/constants';
import { block as blockByKey } from '../core/registry';
import type { BlockDef, IWorld, ItemAmount } from '../core/types';
import { rollDrops } from './mining';
import type { PlayerState } from './playerState';
import { cutPiece } from './treeFell';

/** How long a fallen log lies before it rots (seconds of loaded, unprotected time). */
export const LOG_LIFE_S = DAY_LENGTH_S;
/** Seconds before the end at which the log warns the player. */
export const LOG_WARN_S = 60;
/** Within this many blocks of a block entity (a machine, a crate) a log never ages. */
export const PROTECT_RADIUS = 14;
/** Log radius for aiming, blocks. */
export const LOG_RADIUS = 0.5;

export interface FallenLog {
  id: number;
  /** Log block key (oak_log, pine_log): the drops come from it. */
  logKey: string;
  /** Trunk blocks left. */
  length: number;
  /** Trunk blocks it had when it fell (the rest is cut away). */
  original: number;
  /** Rest pose: the rod's bottom end in world coordinates, the horizontal fall direction and the angle from vertical. */
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dz: number;
  theta: number;
  /** Seconds it has lain in loaded, unprotected chunks. */
  age: number;
  warned: boolean;
}

export type FallenInput = Omit<FallenLog, 'id' | 'age' | 'warned' | 'original'> & { original?: number };

export interface FallenEvent {
  kind: 'warn' | 'gone';
  log: FallenLog;
}

/** Where the rod's axis runs: from the bottom end (o) along the rod direction (up the trunk at the pose's angle). */
export function rodAxis(log: FallenLog): { ux: number; uy: number; uz: number } {
  return { ux: log.dx * Math.sin(log.theta), uy: Math.cos(log.theta), uz: log.dz * Math.sin(log.theta) };
}

/** World position of the trunk's tip (the far end of the remaining length). */
export function fallenTip(log: FallenLog): { x: number; y: number; z: number } {
  const u = rodAxis(log);
  return { x: log.ox + u.ux * log.length, y: log.oy + u.uy * log.length, z: log.oz + u.uz * log.length };
}

export interface FallenAim {
  log: FallenLog;
  distance: number;
  /** The cell of the tip: the target block the mining works on. */
  x: number;
  y: number;
  z: number;
}

/**
 * The first fallen log the ray (origin o, unit direction d) meets within `maxDist`, sampling the ray every 1/20 block
 * and testing the distance to each log's axis against LOG_RADIUS. Null when none.
 */
export function aimFallen(logs: readonly FallenLog[], o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxDist: number): FallenAim | null {
  if (logs.length === 0) return null;
  const step = 0.05;
  for (let t = 0; t <= maxDist; t += step) {
    const px = o.x + d.x * t;
    const py = o.y + d.y * t;
    const pz = o.z + d.z * t;
    for (const log of logs) {
      if (log.length <= 0) continue;
      const u = rodAxis(log);
      const rx = px - log.ox;
      const ry = py - log.oy;
      const rz = pz - log.oz;
      const along = Math.max(0, Math.min(log.length, rx * u.ux + ry * u.uy + rz * u.uz));
      const cx = rx - u.ux * along;
      const cy = ry - u.uy * along;
      const cz = rz - u.uz * along;
      if (Math.hypot(cx, cy, cz) <= LOG_RADIUS) {
        const tip = fallenTip(log);
        return { log, distance: t, x: Math.floor(tip.x - u.ux * 0.5), y: Math.floor(tip.y - u.uy * 0.5), z: Math.floor(tip.z - u.uz * 0.5) };
      }
    }
  }
  return null;
}

export class FallenLogs {
  private logs: FallenLog[] = [];
  private nextId = 1;

  constructor(private readonly world: IWorld) {}

  list(): readonly FallenLog[] {
    return this.logs;
  }

  get(id: number): FallenLog | undefined {
    return this.logs.find((l) => l.id === id);
  }

  /** Lays a new log down; returns it. */
  add(input: FallenInput): FallenLog {
    const log: FallenLog = { ...input, id: this.nextId++, original: input.original ?? input.length, age: 0, warned: false };
    this.logs.push(log);
    return log;
  }

  /**
   * One axe cut on a fallen log: the piece off its tip (cutPiece), as the log items it is worth. Returns the drops, the
   * tip cell's world position, and whether the log is gone (its last piece was cut). Null for an unknown id or an
   * empty log.
   */
  cut(id: number, rng: () => number): { take: number; drops: ItemAmount[]; at: { x: number; y: number; z: number }; gone: boolean; logDef: BlockDef } | null {
    const log = this.get(id);
    if (!log || log.length <= 0) return null;
    const { take, remaining } = cutPiece(log.length);
    const logDef = blockByKey(log.logKey);
    const drops: ItemAmount[] = [];
    for (let i = 0; i < take; i++) mergeDrops(drops, rollDrops(logDef, rng));
    const u = rodAxis(log);
    const at = { x: log.ox + u.ux * (log.length - 0.5), y: log.oy + u.uy * (log.length - 0.5), z: log.oz + u.uz * (log.length - 0.5) };
    log.length = remaining;
    const gone = remaining <= 0;
    if (gone) this.logs = this.logs.filter((l) => l.id !== id);
    return { take, drops, at, gone, logDef };
  }

  /**
   * Ages the logs in loaded, unprotected chunks; returns the warnings and the logs that rotted away this tick.
   * `protectedAt(x, z)` says a log lies where it must not age (near a build or a machine).
   */
  tick(dt: number, protectedAt: (x: number, z: number) => boolean): FallenEvent[] {
    const events: FallenEvent[] = [];
    for (const log of [...this.logs]) {
      if (!this.world.isLoaded(Math.floor(log.ox), Math.floor(log.oz))) continue;
      if (protectedAt(log.ox, log.oz)) continue;
      log.age += dt;
      if (!log.warned && log.age >= LOG_LIFE_S - LOG_WARN_S) {
        log.warned = true;
        events.push({ kind: 'warn', log });
      }
      if (log.age >= LOG_LIFE_S) {
        this.logs = this.logs.filter((l) => l.id !== log.id);
        events.push({ kind: 'gone', log });
      }
    }
    return events;
  }

  toJSON(): FallenLog[] {
    return this.logs.map((l) => ({ ...l }));
  }

  /** Loads a saved list; a damaged entry is skipped, never a reason to lose the others. */
  load(raw: unknown): void {
    this.logs = [];
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      if (!isLog(r)) continue;
      this.logs.push({ ...r });
      this.nextId = Math.max(this.nextId, r.id + 1);
    }
  }
}

/** Adds `drops` into `into`, summing the same items. */
export function mergeDrops(into: ItemAmount[], drops: ItemAmount[]): void {
  for (const d of drops) {
    const known = into.find((x) => x.item === d.item);
    if (known) known.count += d.count;
    else into.push({ item: d.item, count: d.count });
  }
}

function isLog(v: unknown): v is FallenLog {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  const nums = ['id', 'length', 'original', 'ox', 'oy', 'oz', 'dx', 'dz', 'theta', 'age'] as const;
  return typeof r.logKey === 'string' && typeof r.warned === 'boolean' && nums.every((k) => typeof r[k] === 'number' && Number.isFinite(r[k] as number));
}

/** Drops the player's cut drops and reports the cut (the drop position is the tip). */
export function dropCut(player: PlayerState, cut: { drops: ItemAmount[]; at: { x: number; y: number; z: number } }): void {
  player.dropAll(cut.drops, { x: cut.at.x, y: cut.at.y + 0.25, z: cut.at.z });
}
