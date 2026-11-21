/**
 * The STRUCTURE tab's data (spec 17.4): the hearth's status, a checklist with counts, the problems in plain words,
 * and for a chosen target tier and interior size the materials list and the exact cells of a ghost preview - which
 * position needs which block, and which hold the wrong one. Built on demand from the last scan; never per tick.
 */
import type { Interior } from '../core/hearth';
import { BLOCKS, FURNACE_TIERS } from '../core/registry';
import { voxelFacing, voxelId, type Facing, type IWorld } from '../core/types';
import { tally } from '../game/crafting';
import type { Inventory } from '../game/inventory';
import type { FurnaceEntity } from './entities';
import {
  CellRole, boxX, boxZ, cellRole, frameOf, hearthName, isElectrode, isFacePart, isGap, isSolid, problemsFor, structureOf, underController,
  wallTierOf,
  type HearthBox, type HearthProblem, type HearthScan,
} from './hearthScan';

/**
 * What the player asks the preview for: a tier and, optionally, an inside size [across, deep, high] and a sideways
 * position (`offset`: the inside's first column along the furnace's wall, from -(across - 1) to 0; 0 puts the furnace
 * at the inside's left end as seen from inside). Without an offset the plan takes the placement that needs the fewest
 * changes, keeping clear of machines and pipes.
 */
export interface StructureTarget {
  tier: number;
  inner?: [number, number, number];
  offset?: number;
}

/** A machine or pipe standing where the plan needs something else: it has to move. */
export interface PlanMachine {
  x: number;
  y: number;
  z: number;
  block: string;
  name: string;
}

export type GhostState = 'ok' | 'missing' | 'wrong';
export type GhostRole = 'wall' | 'edge' | 'floor' | 'ceiling' | 'interior';

/** One cell of the preview. Interior cells are only listed when something is in the way. */
export interface GhostCell {
  x: number;
  y: number;
  z: number;
  role: GhostRole;
  /** Block key wanted here ('air' inside). */
  want: string;
  /** Block key there now. */
  has: string;
  /** ok: it already counts; missing: empty, place `want`; wrong: something else stands there - break it first. */
  state: GhostState;
}

export interface MaterialRow {
  item: string;
  /** Blocks of this kind the whole shell takes, how many already stand, how many are still to place. */
  need: number;
  placed: number;
  missing: number;
  /** In the pack and the crates near the furnace. */
  have: number;
  ok: boolean;
}

export interface StructureCheck {
  key: 'floor' | 'walls' | 'ceiling' | 'interior' | 'electrodes' | 'ports';
  label: string;
  have: number;
  need: number;
  ok: boolean;
}

export interface TierChoice {
  tier: number;
  name: string;
  /** Wall block key of the tier (higher tiers' walls also count). */
  wall: string;
  minInner: [number, number, number];
  maxInner: [number, number, number];
  ceiling: 'optional' | 'required';
  electrodes: number;
  ports: number;
}

export interface StructureView {
  x: number;
  y: number;
  z: number;
  /** The furnace block's tier, the tier it runs at, and the formed hearth's tier (0: not formed). */
  controllerTier: number;
  effectiveTier: number;
  formed: boolean;
  tier: number;
  name: string | null;
  /** What the last scan found: inside size and whether it has a ceiling (null inner: no box found). */
  inner: [number, number, number] | null;
  closed: boolean;
  windows: number;
  /** "Formed - Blast hearth 3x3x2" or "Not formed". */
  status: string;
  /** A neutral word when nothing of a hearth is built yet ("No hearth built around this furnace yet"), else null. */
  note: string | null;
  /** Up to 8, for the target tier. Each names a block position to highlight. */
  problems: HearthProblem[];
  /** Every tier with a hearth, for the target picker. */
  tiers: TierChoice[];
  target: {
    tier: number;
    name: string;
    inner: [number, number, number];
    closed: boolean;
    /** Inclusive world corners of the target shell. */
    min: [number, number, number];
    max: [number, number, number];
    checklist: StructureCheck[];
    materials: MaterialRow[];
    cells: GhostCell[];
    /** Every cell is right: it forms at this tier (once its other rules hold, e.g. the tier's ports). */
    ready: boolean;
    /** The plan's sideways position (StructureTarget.offset) and the range it can take: for "Shift left / right". */
    offset: number;
    offsets: [number, number];
    /** Machines and pipes in the way of the plan (in its shell or inside): they have to move. */
    machines: PlanMachine[];
  };
}

export const TIER_CHOICES: readonly TierChoice[] = FURNACE_TIERS.filter((t) => t.structure).map((t) => {
  const s = structureOf(t.tier);
  return {
    tier: t.tier, name: hearthName(t.tier), wall: s.wall[0], minInner: [...s.minInner], maxInner: [...s.maxInner], ceiling: s.ceiling,
    electrodes: s.electrodes ?? 0, ports: s.powerPorts ?? 0,
  };
});

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

/** The tier the preview shows by default: the one the furnace needs now, else the next upgrade's. */
export function defaultTargetTier(e: FurnaceEntity): number {
  const have = e.hearth?.tier ?? 0;
  const max = FURNACE_TIERS.length;
  if (have < Math.max(2, e.tier)) return Math.max(2, Math.min(max, e.tier));
  return Math.min(max, e.tier + 1);
}

/**
 * What a block in a cell of a planned box costs: 0 it counts, 1 empty or a lower tier's wall, 3 any other wrong block,
 * 20 a machine or pipe in the way.
 */
function cellCost(b: HearthBox, u: number, v: number, y: number, role: number, id: number, tier: number): number {
  if (role === CellRole.Controller) return 0;
  if (role === CellRole.Interior) return id === 0 ? 0 : inTheWay(id) ? 20 : 3;
  if (wallTierOf(id) >= tier || (isSolid(id) && underController(b, u, v, y))) return 0;
  // An empty cell, or a lower tier's wall block to swap: one block to place either way.
  if (isGap(id) || wallTierOf(id) > 0) return 1;
  const face = role === CellRole.WallFace || role === CellRole.FloorFace || role === CellRole.CeilingFace;
  if ((face && isFacePart(id)) || (role === CellRole.CeilingFace && isElectrode(id))) return 0;
  return inTheWay(id) ? 20 : 3;
}

/** A machine or a pipe: something built that the player would have to move, not just a block to swap. */
const inTheWay = (id: number): boolean => BLOCKS[id].machine !== null || BLOCKS[id].pipe !== null;

/** Total cost of a planned box (see cellCost). */
function boxCost(world: IWorld, b: HearthBox, tier: number): number {
  let cost = 0;
  for (let y = b.y0 - 1; y <= b.y1 + (b.closed ? 1 : 0); y++) {
    for (let v = 0; v <= b.depth + 1; v++) {
      for (let u = b.u0 - 1; u <= b.u1 + 1; u++) {
        cost += cellCost(b, u, v, y, cellRole(b, u, v, y), voxelId(world.getVoxel(boxX(b, u, v), y, boxZ(b, u, v))), tier);
      }
    }
  }
  return cost;
}

/**
 * The box the preview fills, sized from the request (else the scanned box, else the tier's smallest) within the tier's
 * bounds. Its position: the requested offset, else of every placement that keeps the furnace in a wall face (sideways,
 * and up and down when it is taller than one layer) the one needing the fewest changes - away from machines and
 * pipes - with ties going to the scanned box's position or one centred on the furnace.
 */
function targetBox(world: IWorld, e: FurnaceEntity, facing: Facing, scan: HearthScan | null, target: StructureTarget, tier: number): HearthBox {
  const s = structureOf(tier);
  const sb = scan?.box ?? null;
  const inner = target.inner;
  const want: [number, number, number] = inner ? [inner[0], inner[1], inner[2]] : scan?.inner ? [...scan.inner] : [...s.minInner];
  const across = clampInt(want[0], s.minInner[0], s.maxInner[0]);
  const deep = clampInt(want[1], s.minInner[1], s.maxInner[1]);
  const high = clampInt(want[2], s.minInner[2], s.maxInner[2]);
  const closed = s.ceiling === 'required' || (sb !== null && sb.closed);
  const frame = frameOf(facing);
  const at = (u0: number, y0: number): HearthBox => ({ cx: e.x, cy: e.y, cz: e.z, ...frame, u0, u1: u0 + across - 1, depth: deep, y0, y1: y0 + high - 1, closed });
  const homeU = sb ? clampInt(sb.u0, -(across - 1), 0) : -Math.floor((across - 1) / 2);
  const homeY = clampInt(sb ? sb.y0 : e.y, e.y - high + 1, e.y);
  const us = target.offset !== undefined ? [clampInt(target.offset, -(across - 1), 0)] : Array.from({ length: across }, (_, i) => (i === 0 ? 0 : -i));
  let best = at(homeU, homeY);
  let bestCost = Infinity;
  for (const u0 of us) {
    for (let y0 = e.y; y0 >= e.y - high + 1; y0--) {
      if (y0 - 1 < 0) continue;
      const b = at(u0, y0);
      // A small pull towards the usual position settles ties.
      const cost = boxCost(world, b, tier) + 0.01 * (Math.abs(u0 - homeU) + Math.abs(y0 - homeY));
      if (cost < bestCost) {
        best = b;
        bestCost = cost;
      }
    }
  }
  return best;
}

const ROLE_OF: Record<number, GhostRole> = {
  [CellRole.Interior]: 'interior', [CellRole.WallFace]: 'wall', [CellRole.Edge]: 'edge', [CellRole.FloorFace]: 'floor', [CellRole.CeilingFace]: 'ceiling',
};

interface Slot {
  x: number;
  y: number;
  z: number;
  role: number;
  id: number;
  /** Distance used to pick where missing electrodes and ports should go. */
  d: number;
  want: string;
  /** Counts as it stands and is not part of the materials (any solid block under the furnace). */
  free: boolean;
}

export function structureView(
  world: IWorld, e: FurnaceEntity, scan: HearthScan | null, sources: readonly Inventory[], target?: StructureTarget,
): StructureView {
  const h = e.hearth;
  const tier = clampInt(target?.tier ?? defaultTargetTier(e), 2, FURNACE_TIERS.length);
  const s = structureOf(tier);
  const wall = s.wall[0];
  const facing = voxelFacing(world.getVoxel(e.x, e.y, e.z));
  const b = targetBox(world, e, facing, scan, target ?? { tier }, tier);
  const machines: PlanMachine[] = [];
  const blocked = (x: number, y: number, z: number, id: number): void => {
    if (inTheWay(id)) machines.push({ x, y, z, block: BLOCKS[id].key, name: BLOCKS[id].name });
  };
  const midU = (b.u0 + b.u1) / 2;
  const midV = (b.depth + 1) / 2;
  const cells: Slot[] = [];
  const interiorWrong: GhostCell[] = [];
  let interiorTotal = 0;
  for (let y = b.y0 - 1; y <= b.y1 + (b.closed ? 1 : 0); y++) {
    for (let v = 0; v <= b.depth + 1; v++) {
      for (let u = b.u0 - 1; u <= b.u1 + 1; u++) {
        const role = cellRole(b, u, v, y);
        if (role === CellRole.Controller) continue;
        const x = boxX(b, u, v);
        const z = boxZ(b, u, v);
        const id = voxelId(world.getVoxel(x, y, z));
        if (role === CellRole.Interior) {
          interiorTotal++;
          if (id !== 0) {
            interiorWrong.push({ x, y, z, role: 'interior', want: 'air', has: BLOCKS[id].key, state: 'wrong' });
            blocked(x, y, z, id);
          }
          continue;
        }
        const face = role === CellRole.WallFace || role === CellRole.FloorFace || role === CellRole.CeilingFace;
        const free = isSolid(id) && wallTierOf(id) < tier && underController(b, u, v, y);
        const keep = free || (face && isFacePart(id)) || (role === CellRole.CeilingFace && isElectrode(id));
        const d = role === CellRole.CeilingFace ? Math.abs(u - midU) + Math.abs(v - midV) : Math.abs(u) + Math.abs(y - b.cy) + v;
        if (!keep && wallTierOf(id) === 0) blocked(x, y, z, id);
        cells.push({ x, y, z, role, id, d, want: keep ? BLOCKS[id].key : wall, free });
      }
    }
  }
  // Electrodes and ports still missing go where they cost least: empty cells first, then nearest the middle of the
  // ceiling (electrodes) or the furnace (ports).
  const place = (key: string, need: number, role: number): void => {
    let have = 0;
    for (const c of cells) if (c.want === key) have++;
    const free = cells.filter((c) => c.role === role && c.want === wall).sort((p, q) => Number(isGap(q.id)) - Number(isGap(p.id)) || p.d - q.d);
    for (let i = 0; i < need - have && i < free.length; i++) free[i].want = key;
  };
  place('electrode', s.electrodes ?? 0, CellRole.CeilingFace);
  place('power_port', s.powerPorts ?? 0, CellRole.WallFace);

  const ghost: GhostCell[] = [];
  const need = new Map<string, number>();
  const placed = new Map<string, number>();
  const checks = { floor: [0, 0], walls: [0, 0], ceiling: [0, 0] };
  for (const c of cells) {
    const ok = c.want === wall ? wallTierOf(c.id) >= tier : BLOCKS[c.id].key === c.want;
    const state: GhostState = ok ? 'ok' : isGap(c.id) ? 'missing' : 'wrong';
    ghost.push({ x: c.x, y: c.y, z: c.z, role: ROLE_OF[c.role], want: c.want, has: BLOCKS[c.id].key, state });
    if (!c.free) {
      need.set(c.want, (need.get(c.want) ?? 0) + 1);
      if (ok) placed.set(c.want, (placed.get(c.want) ?? 0) + 1);
    }
    const part = c.role === CellRole.FloorFace || (c.role === CellRole.Edge && c.y < b.y0) ? checks.floor
      : c.role === CellRole.CeilingFace || (c.role === CellRole.Edge && c.y > b.y1) ? checks.ceiling : checks.walls;
    part[1]++;
    if (ok) part[0]++;
  }
  ghost.push(...interiorWrong);

  const counts = tally(sources);
  const materials: MaterialRow[] = [...need.entries()].map(([item, n]) => {
    const done = placed.get(item) ?? 0;
    const have = counts.get(item) ?? 0;
    return { item, need: n, placed: done, missing: n - done, have, ok: have >= n - done };
  });
  const checklist: StructureCheck[] = [];
  const check = (key: StructureCheck['key'], label: string, have: number, n: number): void => {
    checklist.push({ key, label, have, need: n, ok: have >= n });
  };
  check('floor', 'Floor', checks.floor[0], checks.floor[1]);
  check('walls', 'Walls', checks.walls[0], checks.walls[1]);
  if (b.closed) check('ceiling', 'Ceiling', checks.ceiling[0], checks.ceiling[1]);
  check('interior', 'Inside empty', interiorTotal - interiorWrong.length, interiorTotal);
  if (s.electrodes) check('electrodes', 'Electrodes', placed.get('electrode') ?? 0, s.electrodes);
  if (s.powerPorts) check('ports', 'Power ports', placed.get('power_port') ?? 0, s.powerPorts);

  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); z0 = Math.min(z0, c.z);
    x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); z1 = Math.max(z1, c.z);
  }
  const name = h ? hearthName(h.tier) : null;
  return {
    x: e.x, y: e.y, z: e.z, controllerTier: e.tier, effectiveTier: e.effTier, formed: h !== null, tier: h?.tier ?? 0, name,
    inner: scan?.inner ? [...scan.inner] : null, closed: scan?.closed ?? false, windows: scan?.windows ?? 0,
    status: h && name ? `Formed - ${name} ${h.inner[0]}x${h.inner[1]}x${h.inner[2]}` : 'Not formed', note: scan?.note ?? null,
    problems: scan ? problemsFor(scan, tier) : [],
    tiers: TIER_CHOICES.map((t) => ({ ...t, minInner: [...t.minInner], maxInner: [...t.maxInner] })),
    target: {
      tier, name: hearthName(tier), inner: [b.u1 - b.u0 + 1, b.depth, b.y1 - b.y0 + 1], closed: b.closed,
      min: [x0, y0, z0], max: [x1, y1, z1], checklist, materials, cells: ghost,
      ready: ghost.every((c) => c.state === 'ok'), offset: b.u0 || 0, offsets: [b.u0 - b.u1 || 0, 0], machines,
    },
  };
}
