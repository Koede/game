/**
 * Blueprints in play (docs/api/blueprint.md): the Builder's Square tool, the saved blueprints and the builds under way.
 * Holding the square, Use (a tap on a phone, right click with a mouse) on a block marks corner 1, then corner 2; the HUD's
 * build chip shows the box and its materials and Save confirms. In place mode a tap picks the low corner of a copy of the
 * selected blueprint and Raise confirms: a builder automaton then raises it (BuildJob), taking blocks from the chest nearest
 * the site and, when that chest is part of a storage network (Simulation.storageNetwork), from every chest of the network.
 * Persisted under `extras.blueprints`. DOM-free; the chip is src/ui/hud/buildChip.ts, the wiring src/app.
 */
import type { GameBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import type { IWorld, ItemAmount } from '../core/types';
import { BuildJob, captureBlueprint, materialsOf, type Blueprint, type MaterialSource } from './blueprint';
import type { Chest } from './storage';

export const BLUEPRINT_TOOL = 'builders_square';
/** The longest side of a box the square captures. */
export const BLUEPRINT_MAX_SIDE = 24;
export const MAX_SAVED_BLUEPRINTS = 12;
export const MAX_BUILD_JOBS = 4;
/** Seconds between retries of a build that waits for materials. */
export const RETRY_S = 2;
/** Builders per job: one automaton works each site. */
export const BUILDERS_PER_JOB = 1;

export type Cell = [number, number, number];
export type BlueprintMode = 'capture' | 'place';
/** Chests near a point, nearest first (Simulation.storageNetwork). */
export type ChestsNear = (x: number, y: number, z: number) => Chest[];

export interface ToolHit {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
}

export interface BlueprintResult {
  ok: boolean;
  text: string;
}

/**
 * Takes blocks from a list of chests in order (the bound chest first, then the rest of its network). Returned blocks go
 * back to the first chest with room. The list is fetched on first use, so an idle tick never scans the machines.
 */
export class NetworkSource implements MaterialSource {
  private list: Chest[] | null = null;

  constructor(private readonly fetch: () => Chest[]) {}

  get chests(): Chest[] {
    return (this.list ??= this.fetch());
  }

  remove(item: string, count: number): number {
    let taken = 0;
    for (const c of this.chests) {
      if (taken >= count) break;
      taken += c.inv.remove(item, count - taken);
    }
    return taken;
  }

  add(item: string, count: number): number {
    let left = count;
    for (const c of this.chests) {
      if (left <= 0) break;
      left = c.inv.add(item, left);
    }
    return left;
  }

  count(item: string): number {
    return this.chests.reduce((n, c) => n + c.inv.count(item), 0);
  }
}

export interface Site {
  job: BuildJob;
  /** The crate the builder works from; its network supplies the rest. Null while no chest stands near the site. */
  chest: Cell | null;
  retryS: number;
  /** The item the waiting was announced for (one toast per shortage). */
  told: string | null;
}

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

export function materialsText(list: readonly ItemAmount[], max = 4): string {
  const shown = list.slice(0, max).map((m) => `${m.count} ${nameOf(m.item)}`);
  if (list.length > max) shown.push(`+${list.length - max} more`);
  return shown.join(', ');
}

const cellOf = (raw: unknown): Cell | null =>
  Array.isArray(raw) && raw.length === 3 && raw.every((n) => Number.isFinite(n)) ? [Math.floor(raw[0]), Math.floor(raw[1]), Math.floor(raw[2])] : null;
const sameCell = (c: Chest, p: Cell): boolean => c.id === `${p[0]},${p[1]},${p[2]}`;
const parseId = (id: string): Cell | null => cellOf(id.split(',').map(Number));

export class Blueprints {
  readonly saved: Blueprint[] = [];
  readonly sites: Site[] = [];
  selected = 0;
  mode: BlueprintMode = 'capture';
  cornerA: Cell | null = null;
  cornerB: Cell | null = null;
  /** Low corner of the copy being placed (place mode). */
  origin: Cell | null = null;
  /** Bumped on every change the chip shows (corners, saves, mode, sites starting or ending). */
  revision = 0;

  constructor(
    private readonly bus: GameBus,
    private readonly chestsNear: ChestsNear,
  ) {}

  get current(): Blueprint | null {
    return this.saved[this.selected] ?? null;
  }

  /** Use with the square in hand: marks a corner (capture) or the site (place). Null when the square is not held. */
  use(hit: ToolHit | null, held: { item: string } | null): 'worked' | 'refused' | null {
    if (held?.item !== BLUEPRINT_TOOL) return null;
    if (!hit) return 'refused';
    const r = this.tap(hit);
    this.bus.emit('toast', { text: r.text, kind: r.ok ? 'info' : 'warn' });
    return r.ok ? 'worked' : 'refused';
  }

  /** One tap on a block. Capture: corner 1, corner 2, then a third tap starts a new box. Place: the site (on the hit face). */
  tap(hit: ToolHit): BlueprintResult {
    this.revision++;
    if (this.mode === 'place') {
      const bp = this.current;
      if (!bp) return { ok: false, text: 'No blueprint saved yet' };
      this.origin = [hit.px, hit.py, hit.pz];
      return { ok: true, text: `${bp.name} goes here - Raise to build it (${materialsText(materialsOf(bp))})` };
    }
    const p: Cell = [hit.x, hit.y, hit.z];
    if (!this.cornerA || this.cornerB) {
      this.cornerA = p;
      this.cornerB = null;
      return { ok: true, text: 'Corner 1 set - tap the opposite corner' };
    }
    this.cornerB = p;
    const s = this.boxSize();
    if (s && Math.max(...s) > BLUEPRINT_MAX_SIDE) {
      this.cornerB = null;
      return { ok: false, text: `Too big: ${s.join('x')} (the most is ${BLUEPRINT_MAX_SIDE} a side)` };
    }
    return { ok: true, text: `Box ${s?.join('x')} - Save it as a blueprint` };
  }

  /** Size of the marked box (corner 2 or, while it is awaited, corner 1 alone). */
  boxSize(): Cell | null {
    const a = this.cornerA;
    if (!a) return null;
    const b = this.cornerB ?? a;
    return [Math.abs(a[0] - b[0]) + 1, Math.abs(a[1] - b[1]) + 1, Math.abs(a[2] - b[2]) + 1];
  }

  /** The box to outline: the capture box, or the footprint of the copy being placed. Inclusive corners. */
  outline(): { lo: Cell; hi: Cell } | null {
    if (this.mode === 'place') {
      const bp = this.current;
      const o = this.origin;
      if (!bp || !o) return null;
      return { lo: o, hi: [o[0] + bp.size[0] - 1, o[1] + bp.size[1] - 1, o[2] + bp.size[2] - 1] };
    }
    const a = this.cornerA;
    if (!a) return null;
    const b = this.cornerB ?? a;
    return { lo: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], hi: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] };
  }

  /** What the marked box would need (before saving), or what the selected blueprint needs. */
  materials(world: IWorld): ItemAmount[] {
    if (this.mode === 'capture' && this.cornerA && this.cornerB) {
      const bp = captureBlueprint(world, this.cornerA, this.cornerB);
      return bp ? materialsOf(bp) : [];
    }
    const bp = this.current;
    return bp ? materialsOf(bp) : [];
  }

  /** Confirm: saves the marked box (capture) or starts the build at the site (place). */
  confirm(world: IWorld): BlueprintResult {
    this.revision++;
    return this.mode === 'capture' ? this.save(world) : this.raise();
  }

  save(world: IWorld, name?: string): BlueprintResult {
    const a = this.cornerA;
    const b = this.cornerB;
    if (!a || !b) return { ok: false, text: 'Tap two corners first' };
    const bp = captureBlueprint(world, a, b, name ?? this.nextName());
    if (!bp) return { ok: false, text: 'Nothing to save there (or more than 4096 blocks)' };
    if (this.saved.length >= MAX_SAVED_BLUEPRINTS) this.saved.shift();
    this.saved.push(bp);
    this.selected = this.saved.length - 1;
    this.cornerA = null;
    this.cornerB = null;
    this.revision++;
    return { ok: true, text: `Saved ${bp.name}: ${materialsText(materialsOf(bp))}` };
  }

  /** Starts a build of the selected blueprint at the site, worked from the nearest chest. */
  raise(): BlueprintResult {
    const bp = this.current;
    const o = this.origin;
    if (!bp) return { ok: false, text: 'No blueprint saved yet' };
    if (!o) return { ok: false, text: 'Tap where the build goes first' };
    if (this.sites.length >= MAX_BUILD_JOBS) return { ok: false, text: `${MAX_BUILD_JOBS} builds are already under way` };
    const near = this.chestsNear(o[0], o[1], o[2]);
    if (near.length === 0) return { ok: false, text: 'Place a chest near the site: the builder takes blocks from it' };
    const chest = parseId(near[0].id);
    this.sites.push({ job: new BuildJob(bp, o), chest, retryS: 0, told: null });
    this.origin = null;
    this.revision++;
    return { ok: true, text: `A builder starts on ${bp.name}` };
  }

  cancel(): void {
    this.cornerA = null;
    this.cornerB = null;
    this.origin = null;
    this.revision++;
  }

  setMode(mode: BlueprintMode): void {
    if (mode === this.mode) return;
    this.cancel();
    this.mode = mode;
  }

  /** Selects the next saved blueprint (wraps). */
  cycle(): void {
    if (this.saved.length === 0) return;
    this.selected = (this.selected + 1) % this.saved.length;
    this.origin = null;
    this.revision++;
  }

  /** Stops a build (blocks already placed stay). */
  stop(index: number): void {
    if (this.sites.splice(index, 1).length > 0) this.revision++;
  }

  private nextName(): string {
    let n = this.saved.length + 1;
    while (this.saved.some((b) => b.name === `Blueprint ${n}`)) n++;
    return `Blueprint ${n}`;
  }

  /** The chests a site draws from: its own chest first, then that chest's network. Rebinds when the chest is gone. */
  private sourceOf(site: Site): NetworkSource {
    return new NetworkSource(() => {
      if (site.chest) {
        const c = site.chest;
        const net = this.chestsNear(c[0], c[1], c[2]);
        if (net.length > 0 && sameCell(net[0], c)) return net;
      }
      const o = site.job.origin;
      const near = this.chestsNear(o[0], o[1], o[2]);
      site.chest = near.length > 0 ? parseId(near[0].id) : null;
      if (!site.chest) return [];
      const c = site.chest;
      return this.chestsNear(c[0], c[1], c[2]);
    });
  }

  tick(dt: number, world: IWorld): void {
    for (let i = this.sites.length - 1; i >= 0; i--) {
      const site = this.sites[i];
      const job = site.job;
      if (job.state === 'waiting') {
        site.retryS -= dt;
        if (site.retryS > 0) continue;
        site.retryS = RETRY_S;
        job.resume();
      }
      job.tick(dt, world, this.sourceOf(site), BUILDERS_PER_JOB);
      if (job.state === 'done') {
        this.sites.splice(i, 1);
        this.revision++;
        this.bus.emit('toast', { text: `${job.bp.name} is built (${job.placed} blocks placed)`, kind: 'good' });
        continue;
      }
      if (job.state === 'waiting' && job.missing !== site.told) {
        site.told = job.missing;
        site.retryS = RETRY_S;
        this.revision++;
        const where = site.chest ? 'the chests near the site' : 'a chest near the site (there is none)';
        this.bus.emit('toast', { text: `${job.bp.name} waits for ${nameOf(job.missing ?? '')} in ${where}`, kind: 'warn' });
      } else if (job.state === 'building' && site.told) {
        site.told = null;
        this.revision++;
      }
    }
  }

  toJSON(): unknown {
    return {
      saved: this.saved,
      selected: this.selected,
      sites: this.sites.map((s) => ({ job: s.job.toJSON(), chest: s.chest })),
    };
  }

  load(raw: unknown): void {
    this.saved.length = 0;
    this.sites.length = 0;
    this.cancel();
    if (!raw || typeof raw !== 'object') return;
    const r = raw as { saved?: unknown; selected?: unknown; sites?: unknown };
    if (Array.isArray(r.saved)) {
      for (const b of r.saved.slice(-MAX_SAVED_BLUEPRINTS)) {
        // BuildJob.fromJSON is the one validator of a blueprint's cells.
        const job = BuildJob.fromJSON({ bp: b as Blueprint, origin: [0, 0, 0], next: 0, placed: 0, skipped: 0 });
        if (job && job.bp.cells.length > 0 && Array.isArray(job.bp.size)) this.saved.push(job.bp);
      }
    }
    this.selected = Math.min(Math.max(0, Math.floor(Number(r.selected)) || 0), Math.max(0, this.saved.length - 1));
    if (Array.isArray(r.sites)) {
      for (const s of r.sites.slice(0, MAX_BUILD_JOBS)) {
        const job = BuildJob.fromJSON((s as { job?: never })?.job);
        if (job && job.state !== 'done') this.sites.push({ job, chest: cellOf((s as { chest?: unknown }).chest), retryS: 0, told: null });
      }
    }
  }
}

export interface GhostCell {
  x: number;
  y: number;
  z: number;
  block: string;
  state: 'missing' | 'wrong';
}

/** The cells on the twelve edges of a box (inclusive corners), at most `cap`: the picking outline. */
export function edgeCells(lo: Cell, hi: Cell, block: string, cap = 512): GhostCell[] {
  const out: GhostCell[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number, z: number): void => {
    const k = `${x},${y},${z}`;
    if (out.length >= cap || seen.has(k)) return;
    seen.add(k);
    out.push({ x, y, z, block, state: 'missing' });
  };
  for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) for (let x = lo[0]; x <= hi[0]; x++) add(x, y, z);
  for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) for (let y = lo[1]; y <= hi[1]; y++) add(x, y, z);
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (let z = lo[2]; z <= hi[2]; z++) add(x, y, z);
  return out;
}

/**
 * The ghost of a copy of `bp` at `origin`: blue where a block is still to go, red where something else stands in the way.
 * Cells already right are left out. When the build has more than `cap` cells to show, only its outline.
 */
export function siteGhost(world: IWorld, bp: Blueprint, origin: Cell, cap = 512): GhostCell[] {
  const out: GhostCell[] = [];
  for (const c of bp.cells) {
    const x = origin[0] + c.dx;
    const y = origin[1] + c.dy;
    const z = origin[2] + c.dz;
    const here = world.getBlock(x, y, z);
    if (here.key === c.block) continue;
    if (out.length >= cap) return edgeCells(origin, [origin[0] + bp.size[0] - 1, origin[1] + bp.size[1] - 1, origin[2] + bp.size[2] - 1], 'glass', cap);
    out.push({ x, y, z, block: c.block, state: here.id === 0 || here.liquid !== null ? 'missing' : 'wrong' });
  }
  return out;
}
