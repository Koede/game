/**
 * Multiblock hearths at run time (spec 17.3): when each controller's hearth is scanned, what changes when it forms
 * or comes apart (stats, the shell's active bits, events and toasts, power links through its ports, the furnace
 * every shell block stands for), and the per-tick bits (running tuyeres, lava in the fluid hatches).
 *
 * Scans run on the tick after a block change within the shell's box + 1 (an unformed controller watches everything
 * it could reach); an unformed controller also retries every HEARTH_RESCAN_S while the player is within
 * HEARTH_RESCAN_RANGE or its screen is open; a formed one re-reads one cell of its box every HEARTH_VERIFY_TICKS
 * ticks as a safety net.
 */
import { HEARTH_RESCAN_RANGE, HEARTH_RESCAN_S, HEARTH_VERIFY_TICKS, PLAYER_HEIGHT } from '../core/constants';
import type { GameBus } from '../core/context';
import { machine } from '../core/registry';
import { CHUNK_SIZE, voxelActive, voxelFacing, voxelId, withActive, type Facing, type IWorld } from '../core/types';
import type { PlayerState } from '../game/playerState';
import { posKey, type ExtraFuel, type FurnaceEntity, type MachineEntity, type SimNode } from './entities';
import {
  CellRole, HEARTH_REACH, frameOf, hearthName, isElectrode, isFacePart, reachLoaded, scanHearth, structureOf, wallTierOf,
  type HearthBox, type HearthScan, type Pos,
} from './hearthScan';
import { defaultTargetTier } from './hearthView';
import { furnaceStats, type HearthSummary } from './hearthStats';

const LAVA_PER_LOAD = machine('fluid_hatch').params?.lavaLPerFuel ?? 1000;
/** Shell machines whose active bit the hearth owns (the controller and blowers keep their own meaning). */
const PART_KINDS = new Set(['item_hatch', 'fluid_hatch', 'power_port']);

/** What the hearths need from the simulation. */
export interface HearthHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  /** Tracked machine nodes by position key. */
  readonly byKey: ReadonlyMap<string, SimNode>;
  /** Sets a machine node's active flag (and its voxel) when it differs. */
  setActive(node: SimNode, active: boolean): void;
  /** A formed shell changed: power links (ports) and what touches it (heat engines, blowers) must be refreshed. */
  shellChanged(min: Pos, max: Pos): void;
}

/** The runtime of one controller's hearth. */
export class Hearth implements ExtraFuel {
  /** The last scan (null before the first). */
  scan: HearthScan | null = null;
  /** The scan the present formed state came from (null while not formed, or before the first scan after a load). */
  formedScan: HearthScan | null = null;
  /** The box of the hearth it last formed (kept after it comes apart, to report the gap that broke it). */
  lastBox: HearthBox | null = null;
  /** Scan on the next tick (once the chunks around it are loaded). */
  due = true;
  /** Scans run so far (a diagnostic: the schedule's tests count them). */
  scans = 0;
  /** Nodes of the formed hearth's parts, resolved when it formed. */
  blowers: SimNode[] = [];
  fluidHatches: SimNode[] = [];
  itemHatches: SimNode[] = [];
  ports: SimNode[] = [];
  /** Box, tier and parts of the formed state, to tell a real change from a scan that confirms it. */
  signature = '';
  private retryS = 0;
  private sweepTick = 0;
  private sweepAt = 0;
  // What the stats were last computed from.
  private statsTier = 0;
  private statsHearth: HearthSummary | null | undefined = undefined;
  private statsTuyeres = -1;

  constructor(readonly node: SimNode) {}

  get e(): FurnaceEntity {
    return this.node.e as FurnaceEntity;
  }

  get formed(): boolean {
    return this.e.hearth !== null;
  }

  lavaUnits(): number {
    let n = 0;
    for (const h of this.fluidHatches) {
      const f = (h.e as MachineEntity).fluidIn;
      if (f && f.fluid === 'lava') n += Math.floor(f.litres / LAVA_PER_LOAD);
    }
    return n;
  }

  takeLava(): boolean {
    for (const h of this.fluidHatches) {
      const m = h.e as MachineEntity;
      const f = m.fluidIn;
      if (!f || f.fluid !== 'lava' || f.litres < LAVA_PER_LOAD) continue;
      f.litres -= LAVA_PER_LOAD;
      if (f.litres <= 0) m.fluidIn = null;
      return true;
    }
    return false;
  }

  /** Whether a block change here can matter: within the shell + 1 once formed, anywhere it could reach otherwise. */
  watches(x: number, y: number, z: number): boolean {
    const h = this.e.hearth;
    if (h) return x >= h.min[0] - 1 && x <= h.max[0] + 1 && y >= h.min[1] - 1 && y <= h.max[1] + 1 && z >= h.min[2] - 1 && z <= h.max[2] + 1;
    const e = this.e;
    const r = HEARTH_REACH + 1;
    return Math.abs(x - e.x) <= r && Math.abs(z - e.z) <= r && Math.abs(y - e.y) <= r;
  }

  /** Per tick: the unformed retry timer (`near`: the player or the open screen is here) and the formed sweep. */
  schedule(world: IWorld, dt: number, near: boolean): void {
    if (this.due) return;
    if (!this.formed) {
      this.retryS += dt;
      if (this.retryS >= HEARTH_RESCAN_S) {
        this.retryS = 0;
        if (near) this.due = true;
      }
      return;
    }
    const cells = this.formedScan?.cells;
    if (!cells) {
      this.due = true; // formed from a save: confirm it
      return;
    }
    if (++this.sweepTick < HEARTH_VERIFY_TICKS) return;
    this.sweepTick = 0;
    const i = this.sweepAt;
    this.sweepAt = (i + 5) % cells.length;
    if (voxelId(world.getVoxel(cells[i], cells[i + 1], cells[i + 2])) !== cells[i + 3]) this.due = true;
  }

  /** Effective stats from the tier, the formed hearth and the tuyeres running now; grows the crucibles when needed. */
  refreshStats(): void {
    const e = this.e;
    let tuyeres = 0;
    for (const b of this.blowers) if (b.active) tuyeres++;
    if (this.node.fs && this.statsTier === e.tier && this.statsHearth === e.hearth && this.statsTuyeres === tuyeres) return;
    this.statsTier = e.tier;
    this.statsHearth = e.hearth;
    this.statsTuyeres = tuyeres;
    const fs = furnaceStats(e.tier, e.hearth, tuyeres, this.node.fs ?? undefined);
    this.node.fs = fs;
    e.effTier = fs.tier;
    while (e.crucibleIn.length < fs.crucibles) {
      e.crucibleIn.push(null);
      e.crucibleOut.push(null);
      e.crucibleProgress.push(0);
      e.crucibleRecipe.push(null);
      e.crucibleMelt.push(null);
      e.crucibleMoltenS.push(0);
      e.crucibleMix.push([0, 0]);
    }
  }
}

function summaryOf(scan: HearthScan): HearthSummary | null {
  if (scan.structuralTier < 2 || !scan.box || !scan.inner) return null;
  const c = scan.cells;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < c.length; i += 5) {
    for (let k = 0; k < 3; k++) {
      if (c[i + k] < min[k]) min[k] = c[i + k];
      if (c[i + k] > max[k]) max[k] = c[i + k];
    }
  }
  return { tier: scan.structuralTier, inner: [scan.inner[0], scan.inner[1], scan.inner[2]], closed: scan.closed, windows: scan.windows, min, max };
}

/** The box of a formed hearth from its saved summary (a loaded game knows no scan yet). */
function boxOfSummary(e: FurnaceEntity, facing: Facing, h: HearthSummary): HearthBox {
  const f = frameOf(facing);
  const us = [h.min[0], h.max[0]].flatMap((x) => [h.min[2], h.max[2]].map((z) => (x - e.x) * f.ux + (z - e.z) * f.uz));
  const vs = [h.min[0], h.max[0]].flatMap((x) => [h.min[2], h.max[2]].map((z) => (x - e.x) * f.vx + (z - e.z) * f.vz));
  const y0 = h.min[1] + 1;
  return {
    cx: e.x, cy: e.y, cz: e.z, ...f, u0: Math.min(...us) + 1, u1: Math.max(...us) - 1, depth: Math.max(...vs) - 1,
    y0, y1: y0 + h.inner[2] - 1, closed: h.closed,
  };
}

const boxText = (h: HearthSummary): string => `${h.tier}|${h.min.join(',')}|${h.max.join(',')}`;

export class HearthSet {
  readonly list: Hearth[] = [];
  private readonly byKey = new Map<string, Hearth>();
  /** Shell cells of formed hearths -> their hearth (controllers are not in it). */
  private readonly shell = new Map<string, Hearth>();
  /** Power links: a formed hearth's controller <-> each of its power ports (position key -> x, y, z, x, y, z, ...). */
  readonly links = new Map<string, number[]>();
  /** Position key of the furnace whose screen is open, or null. */
  screenAt: string | null = null;

  constructor(private readonly host: HearthHost) {}

  clear(): void {
    this.list.length = 0;
    this.byKey.clear();
    this.shell.clear();
    this.links.clear();
  }

  get(key: string): Hearth | undefined {
    return this.byKey.get(key);
  }

  /** The formed hearth a shell block at this position belongs to (controllers are not shell blocks here). */
  shellOwner(key: string): Hearth | undefined {
    return this.shell.get(key);
  }

  /** Starts following a furnace node. A saved formed state holds until the first scan confirms or changes it. */
  track(node: SimNode): Hearth {
    const e = node.e as FurnaceEntity;
    if (e.hearth === undefined) e.hearth = null;
    const h = new Hearth(node);
    node.extraFuel = h;
    this.list.push(h);
    this.byKey.set(node.key, h);
    h.refreshStats();
    return h;
  }

  /** The furnace is gone: its hearth comes apart quietly (bits cleared, `hearth:unformed`, no toast). */
  untrack(node: SimNode): void {
    const h = this.byKey.get(node.key);
    if (!h) return;
    if (h.formed) this.apply(h, null, null, false);
    this.byKey.delete(node.key);
    this.list.splice(this.list.indexOf(h), 1);
    node.extraFuel = null;
  }

  /** A block changed at x, y, z: every hearth watching that spot scans on the next tick. */
  blockChanged(x: number, y: number, z: number): void {
    for (const h of this.list) if (!h.due && h.watches(x, y, z)) h.due = true;
  }

  /** A chunk arrived or left: hearths that could reach into it look again. */
  chunkChanged(cx: number, cz: number): void {
    const r = HEARTH_REACH;
    for (const h of this.list) {
      const { x, z } = h.e;
      if (x + r >= cx * CHUNK_SIZE && x - r < (cx + 1) * CHUNK_SIZE && z + r >= cz * CHUNK_SIZE && z - r < (cz + 1) * CHUNK_SIZE) h.due = true;
    }
  }

  /** Once per tick, before the machines: timers, due scans, running tuyeres and stats. */
  tick(dt: number): void {
    const { world, player } = this.host;
    const p = player.position;
    const r2 = HEARTH_RESCAN_RANGE * HEARTH_RESCAN_RANGE;
    for (const h of this.list) {
      let near = false;
      if (!h.due && !h.formed) {
        const e = h.e;
        const dx = p.x - (e.x + 0.5);
        const dy = p.y + PLAYER_HEIGHT / 2 - (e.y + 0.5);
        const dz = p.z - (e.z + 0.5);
        near = dx * dx + dy * dy + dz * dz <= r2 || this.screenAt === h.node.key;
      }
      h.schedule(world, dt, near);
    }
    this.validate();
    for (const h of this.list) h.refreshStats();
  }

  /** Runs every due scan whose chunks are loaded (views and actions call it too, so they see edits at once). */
  validate(): void {
    for (const h of this.list) {
      if (!h.due) continue;
      const { world } = this.host;
      const e = h.e;
      if (!reachLoaded(world, e.x, e.z)) continue;
      h.due = false;
      h.scans++;
      const facing = voxelFacing(world.getVoxel(e.x, e.y, e.z));
      const prev = h.lastBox ?? (e.hearth ? boxOfSummary(e, facing, e.hearth) : null);
      const want = structureOf(defaultTargetTier(e)).maxInner;
      const scan = scanHearth(world, e.x, e.y, e.z, facing, { prev, maxAcross: Math.max(want[0], want[1]) });
      h.scan = scan;
      const next = summaryOf(scan);
      this.apply(h, next, next ? scan : null, true);
    }
  }

  /**
   * Takes a verdict: `next` is the formed state (null: not formed) from `scan`. Forming, a new tier or box, and
   * coming apart are announced when `announce`; the shell map, active bits, parts and links follow.
   */
  private apply(h: Hearth, next: HearthSummary | null, scan: HearthScan | null, announce: boolean): void {
    const { bus } = this.host;
    const e = h.e;
    const prev = e.hearth;
    for (const [key, owner] of this.shell) if (owner === h) this.shell.delete(key);
    this.unlink(h);
    e.hearth = next;
    h.formedScan = scan;
    if (next && scan) {
      h.lastBox = scan.box;
      h.blowers = this.nodesAt(scan.blowers);
      h.fluidHatches = this.nodesAt(scan.fluidHatches);
      h.itemHatches = this.nodesAt(scan.itemHatches);
      h.ports = this.nodesAt(scan.ports);
      const c = scan.cells;
      for (let i = 0; i < c.length; i += 5) {
        const role = c[i + 4];
        if (role !== CellRole.Interior && role !== CellRole.Controller) this.shell.set(posKey(c[i], c[i + 1], c[i + 2]), h);
      }
      this.setBits(scan);
      this.link(h);
    } else {
      h.blowers = [];
      h.fluidHatches = [];
      h.itemHatches = [];
      h.ports = [];
    }
    if (prev) this.clearBits(prev);
    h.refreshStats();

    const signature = next ? `${boxText(next)}|${h.ports.map((p) => p.key).join(';')}|${h.blowers.map((b) => b.key).join(';')}` : '';
    if (signature !== h.signature) {
      h.signature = signature;
      const a = prev ?? next;
      const b = next ?? prev;
      if (a && b) {
        this.host.shellChanged(
          [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
          [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
        );
      }
    }
    const pos = { x: e.x, y: e.y, z: e.z };
    if (!announce) {
      if (prev && !next) bus.emit('hearth:unformed', pos);
      return;
    }
    if (next && (!prev || boxText(prev) !== boxText(next))) {
      bus.emit('hearth:formed', { ...pos, tier: next.tier, min: [...next.min], max: [...next.max] });
      bus.emit('sfx', { name: 'hearth_formed', ...pos });
      bus.emit('toast', { text: `${hearthName(next.tier)} formed`, kind: 'good' });
    } else if (!next && prev) {
      bus.emit('hearth:unformed', pos);
      const why = h.scan?.problems[0]?.text;
      const reason = why ? ` - ${why.charAt(0).toLowerCase()}${why.slice(1)}` : '';
      bus.emit('toast', { text: `The ${hearthName(prev.tier)} came apart${reason}`, kind: 'warn' });
    }
  }

  private nodesAt(list: readonly Pos[]): SimNode[] {
    const out: SimNode[] = [];
    for (const [x, y, z] of list) {
      const n = this.host.byKey.get(posKey(x, y, z));
      if (n) out.push(n);
    }
    return out;
  }

  /** Sets the active bit of every shell block the hearth owns, writing only where it differs. */
  private setBits(scan: HearthScan): void {
    const c = scan.cells;
    for (let i = 0; i < c.length; i += 5) {
      const role = c[i + 4];
      if (role !== CellRole.Interior && role !== CellRole.Controller) this.setBit(c[i], c[i + 1], c[i + 2], true);
    }
  }

  /** Clears the bits a formed box had set, except where a block now belongs to a formed shell (this or another). */
  private clearBits(box: HearthSummary): void {
    for (let y = box.min[1]; y <= box.max[1]; y++) {
      for (let z = box.min[2]; z <= box.max[2]; z++) {
        for (let x = box.min[0]; x <= box.max[0]; x++) if (!this.shell.has(posKey(x, y, z))) this.setBit(x, y, z, false);
      }
    }
  }

  private setBit(x: number, y: number, z: number, on: boolean): void {
    const { world, byKey } = this.host;
    const node = byKey.get(posKey(x, y, z));
    if (node) {
      if (PART_KINDS.has(node.e.kind)) this.host.setActive(node, on);
      return;
    }
    const v = world.getVoxel(x, y, z);
    if (voxelActive(v) === on) return;
    const id = voxelId(v);
    if (wallTierOf(id) > 0 || isFacePart(id) || isElectrode(id)) world.setVoxel(x, y, z, withActive(v, on), 'sim');
  }

  private link(h: Hearth): void {
    if (h.ports.length === 0) return;
    const e = h.e;
    const toPorts: number[] = [];
    for (const p of h.ports) {
      toPorts.push(p.e.x, p.e.y, p.e.z);
      this.links.set(p.key, [e.x, e.y, e.z]);
    }
    this.links.set(h.node.key, toPorts);
  }

  private unlink(h: Hearth): void {
    const to = this.links.get(h.node.key);
    if (!to) return;
    this.links.delete(h.node.key);
    for (let i = 0; i < to.length; i += 3) this.links.delete(posKey(to[i], to[i + 1], to[i + 2]));
  }
}
