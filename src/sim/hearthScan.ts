/**
 * The cuboid scan of a multiblock hearth (spec 17.1 and 17.3). Pure reads of the world: from the cell behind the
 * controller it walks the hollow inside to find the walls, the floor and the ceiling (or an open top), classifies
 * every cell of the box as interior, wall face, edge, floor or ceiling, checks each against the rules and reports
 * what it found: the box, the parts, every cell it saw (for the formed state's active bits and the safety sweep),
 * up to HEARTH_MAX_PROBLEMS problems in plain words, and the structural tier - the highest tier whose rules are all
 * met (a higher tier's wall block satisfies every lower tier, so the weakest wall block caps it).
 */
import { FIRST_HEARTH_TIER, HEARTH_CEILING_PARTS, HEARTH_FACE_PARTS, HEARTH_MAX_PROBLEMS } from '../core/constants';
import { interiorFits, type Interior } from '../core/hearth';
import { BLOCKS, FURNACE_TIERS, block, hearthWallTier } from '../core/registry';
import { FACE_DIRS, FACING_TO_FACE, voxelId, type Facing, type HearthStructureSpec, type IWorld } from '../core/types';

export type HearthProblemCode =
  /** The cell behind the controller is not hollow (or the furnace faces into the hearth). */
  | 'behind'
  /** No wall within reach across or along the inside. */
  | 'open'
  /** No floor within reach under the inside. */
  | 'no_floor'
  /** Walls keep going up with no ceiling and no open top within reach. */
  | 'too_tall'
  | 'interior'
  | 'missing'
  | 'wrong_block'
  | 'edge_part'
  | 'electrode_place'
  | 'controller'
  // ---- against one tier's rules ----
  | 'size'
  | 'ceiling'
  | 'wall_tier'
  | 'electrodes'
  | 'ports';

export interface HearthProblem {
  code: HearthProblemCode;
  x: number;
  y: number;
  z: number;
  text: string;
}

/** Where a cell sits in the box. */
export const enum CellRole {
  Interior = 0,
  WallFace = 1,
  /** Vertical corner of two walls, or the ring of the floor or ceiling: an edge. */
  Edge = 2,
  FloorFace = 3,
  CeilingFace = 4,
  Controller = 5,
}

/**
 * The box of a hearth in the controller's frame: u runs along its wall (lateral), v into the hearth (depth), y up.
 * The controller is at u = 0, v = 0, y = cy; the inside spans u0..u1, 1..depth, y0..y1.
 */
export interface HearthBox {
  cx: number;
  cy: number;
  cz: number;
  ux: number;
  uz: number;
  vx: number;
  vz: number;
  u0: number;
  u1: number;
  depth: number;
  y0: number;
  y1: number;
  closed: boolean;
}

/** Cells of one part of the shell, for the checklist: how many there are and what stands in them. */
export interface CellTally {
  total: number;
  /** Valid parts (windows, hatches, ports, blowers, electrodes) in face cells. */
  parts: number;
  /** Cells with a hard problem (gap, wrong block, part on an edge, other controller). */
  bad: number;
  /** Cells holding a wall block, by the block's wall tier (index 2..5). */
  byTier: number[];
}

export type Pos = readonly [number, number, number];

export interface HearthScan {
  box: HearthBox | null;
  /** [across, deep, high] of the inside; null without a box. */
  inner: Interior | null;
  closed: boolean;
  /** Problems no tier can form with (capped at HEARTH_MAX_PROBLEMS); `problemCount` counts them all. */
  problems: HearthProblem[];
  problemCount: number;
  /** Lowest wall tier among the cells holding wall blocks (0 when none do). */
  wallTier: number;
  windows: number;
  electrodes: Pos[];
  ports: Pos[];
  itemHatches: Pos[];
  fluidHatches: Pos[];
  blowers: Pos[];
  /** Every cell of the box (shell, controller and inside): x, y, z, block id, CellRole - five numbers per cell. */
  cells: number[];
  floor: CellTally;
  walls: CellTally;
  ceiling: CellTally;
  /** Highest tier (2..5) whose rules are all met, 0 when none: the hearth is formed at this tier. */
  structuralTier: number;
  /** A neutral word when there is nothing to judge yet ("No hearth built around this furnace yet"), else null. */
  note: string | null;
}

/** What the caller knows beyond the world: the last formed box, and the inside limit of the tier it plans for. */
export interface ScanOptions {
  /** The box of the hearth this controller last formed: a gap in it is reported where it is (spec 17.3). */
  prev?: HearthBox | null;
  /** Largest inside across of the tier the furnace is heading for (quoted when no walls close); default MAX_ACROSS. */
  maxAcross?: number;
}

/** The neutral note of a furnace with nothing of a hearth around it. */
export const NO_HEARTH_YET = 'No hearth built around this furnace yet';

/** Largest inside of any tier: the scan walks no farther. */
export const MAX_ACROSS = Math.max(...FURNACE_TIERS.map((t) => (t.structure ? Math.max(t.structure.maxInner[0], t.structure.maxInner[1]) : 0)));
export const MAX_HIGH = Math.max(...FURNACE_TIERS.map((t) => t.structure?.maxInner[2] ?? 0));
/** How far from the controller any shell cell can be, horizontally and vertically. */
export const HEARTH_REACH = MAX_ACROSS + 1;

const n = BLOCKS.length;
const WALL_TIER = new Int8Array(n);
const FACE_PART = new Uint8Array(n);
const ELECTRODE = new Uint8Array(n);
const FURNACE = new Uint8Array(n);
const SOLID = new Uint8Array(n);
const GAP = new Uint8Array(n);
for (const b of BLOCKS) {
  WALL_TIER[b.id] = hearthWallTier(b.key);
  FACE_PART[b.id] = HEARTH_FACE_PARTS.includes(b.key) ? 1 : 0;
  ELECTRODE[b.id] = HEARTH_CEILING_PARTS.includes(b.key) ? 1 : 0;
  FURNACE[b.id] = b.machine === 'furnace' ? 1 : 0;
  SOLID[b.id] = b.solid ? 1 : 0;
  GAP[b.id] = b.id === 0 || (!b.solid && b.replaceable) ? 1 : 0;
}
const GLASS = block('glass').id;
const PORT = block('power_port').id;
const ITEM_HATCH = block('item_hatch').id;
const FLUID_HATCH = block('fluid_hatch').id;
const BLOWER = block('blower').id;

/** The wall tier of a block id (0: not a wall block). */
export const wallTierOf = (id: number): number => WALL_TIER[id];
/** Whether a block id is a solid block. */
export const isSolid = (id: number): boolean => SOLID[id] === 1;
/** Whether a block id may stand in a face cell in place of wall (glass, hatches, ports, blowers). */
export const isFacePart = (id: number): boolean => FACE_PART[id] === 1;
export const isElectrode = (id: number): boolean => ELECTRODE[id] === 1;
/** Air, or a non-solid block anything may be placed into (plants, liquids): an empty shell cell. */
export const isGap = (id: number): boolean => GAP[id] === 1;

/** The box's world position of local (u, v, y). */
export const boxX = (b: HearthBox, u: number, v: number): number => b.cx + u * b.ux + v * b.vx;
export const boxZ = (b: HearthBox, u: number, v: number): number => b.cz + u * b.uz + v * b.vz;

/** The controller's frame: v points from its front into the hearth, u along its wall. */
export function frameOf(facing: Facing): { ux: number; uz: number; vx: number; vz: number } {
  const [fx, , fz] = FACE_DIRS[FACING_TO_FACE[facing]];
  const vx = -fx;
  const vz = -fz;
  return { ux: vz, uz: -vx, vx, vz };
}

/**
 * The floor cell right under the controller when the furnace sits on the lowest inside layer: walled in by the furnace
 * above and the ground around, it can hardly be reached, so it counts as frame whatever solid block stands there.
 */
export const underController = (b: HearthBox, u: number, v: number, y: number): boolean => u === 0 && v === 0 && y === b.cy - 1 && b.y0 === b.cy;

/** Role of local cell (u, v, y) in a box, or -1 outside it. */
export function cellRole(b: HearthBox, u: number, v: number, y: number): number {
  if (u < b.u0 - 1 || u > b.u1 + 1 || v < 0 || v > b.depth + 1 || y < b.y0 - 1 || y > b.y1 + (b.closed ? 1 : 0)) return -1;
  const uIn = u >= b.u0 && u <= b.u1;
  const vIn = v >= 1 && v <= b.depth;
  if (y === b.y0 - 1) return uIn && vIn ? CellRole.FloorFace : CellRole.Edge;
  if (y > b.y1) return uIn && vIn ? CellRole.CeilingFace : CellRole.Edge;
  if (uIn && vIn) return CellRole.Interior;
  if (u === 0 && v === 0 && y === b.cy) return CellRole.Controller;
  return !uIn && !vIn ? CellRole.Edge : CellRole.WallFace;
}

/** Whether every chunk column a hearth around this controller could reach holds voxel data. */
export function reachLoaded(world: IWorld, x: number, z: number): boolean {
  const r = HEARTH_REACH;
  return world.isLoaded(x - r, z - r) && world.isLoaded(x + r, z - r) && world.isLoaded(x - r, z + r) && world.isLoaded(x + r, z + r);
}

const tally = (): CellTally => ({ total: 0, parts: 0, bad: 0, byTier: [0, 0, 0, 0, 0, 0] });

function emptyScan(): HearthScan {
  return {
    box: null, inner: null, closed: false, problems: [], problemCount: 0, wallTier: 0, windows: 0, electrodes: [], ports: [],
    itemHatches: [], fluidHatches: [], blowers: [], cells: [], floor: tally(), walls: tally(), ceiling: tally(), structuralTier: 0,
    note: null,
  };
}

function add(scan: HearthScan, code: HearthProblemCode, x: number, y: number, z: number, text: string): void {
  scan.problemCount++;
  if (scan.problems.length < HEARTH_MAX_PROBLEMS) scan.problems.push({ code, x, y, z, text });
}

/** Finds the box around the hollow behind the controller, or reports why there is none. */
function findBox(world: IWorld, x: number, y: number, z: number, facing: Facing, scan: HearthScan, maxAcross: number): HearthBox | null {
  const f = frameOf(facing);
  const solid = (u: number, v: number, yy: number): boolean => SOLID[voxelId(world.getVoxel(x + u * f.ux + v * f.vx, yy, z + u * f.uz + v * f.vz))] === 1;
  const bx = x + f.vx;
  const bz = z + f.vz;
  if (solid(0, 1, y)) {
    add(scan, 'behind', bx, y, bz, 'The block behind the furnace must be the hollow inside - its front faces out');
    return null;
  }
  const walk = (du: number, dv: number, from: number): number => {
    for (let k = 1; k <= MAX_ACROSS; k++) if (solid(du * k, from + dv * k, y)) return k - 1;
    return -1;
  };
  const right = walk(1, 0, 1);
  const left = walk(-1, 0, 1);
  const deep = walk(0, 1, 1);
  if (right < 0 || left < 0 || deep < 0 || right + left + 1 > MAX_ACROSS) {
    // No wall block beside the furnace or around the cell behind it: no hearth is being built (a hill or a house
    // farther off is not a hearth wall).
    if (!solid(1, 0, y) && !solid(-1, 0, y) && !solid(1, 1, y) && !solid(-1, 1, y) && !solid(0, 2, y)) {
      scan.note = NO_HEARTH_YET;
      return null;
    }
    add(scan, 'open', bx, y, bz, `The walls do not close around the inside - it can be at most ${maxAcross} blocks across`);
    return null;
  }
  let y0 = -1;
  for (let k = 1; k <= MAX_HIGH && y - k >= 0; k++) {
    if (solid(0, 1, y - k)) {
      y0 = y - k + 1;
      break;
    }
  }
  if (y0 < 0) {
    add(scan, 'no_floor', bx, y - 1, bz, 'No floor under the hearth');
    return null;
  }
  const b: HearthBox = { cx: x, cy: y, cz: z, ...f, u0: -left, u1: right, depth: deep + 1, y0, y1: y, closed: false };
  const area = (right + left + 1) * b.depth;
  // A layer of wall needs at least half its ring built: a block resting on the rim (a steam engine on the furnace,
  // a torch) leaves an open top open.
  const ringCells = 2 * (right + left + 1 + b.depth) + 4;
  for (let yy = y + 1; yy <= y0 + MAX_HIGH; yy++) {
    let lid = 0;
    let ring = 0;
    for (let v = 0; v <= b.depth + 1; v++) {
      for (let u = b.u0 - 1; u <= b.u1 + 1; u++) {
        const inside = v >= 1 && v <= b.depth && u >= b.u0 && u <= b.u1;
        if (inside) lid += solid(u, v, yy) ? 1 : 0;
        else ring += voxelId(world.getVoxel(boxX(b, u, v), yy, boxZ(b, u, v))) !== 0 ? 1 : 0;
      }
    }
    if (lid * 2 >= area) {
      b.closed = true;
      return b;
    }
    if (ring * 2 < ringCells) return b;
    b.y1 = yy;
  }
  add(scan, 'too_tall', bx, y0 + MAX_HIGH, bz, `Too tall - the inside can be at most ${MAX_HIGH} blocks high`);
  return null;
}

/**
 * Scans the hearth around the controller at x, y, z facing `facing`. The caller makes sure the chunks are loaded. When
 * no hearth forms and the last formed box (`options.prev`) still mostly stands with a gap in it, that box is reported
 * instead: the gap is what broke it, not whatever the walk through the gap ran into.
 */
export function scanHearth(world: IWorld, x: number, y: number, z: number, facing: Facing, options: ScanOptions = {}): HearthScan {
  const scan = emptyScan();
  const b = findBox(world, x, y, z, facing, scan, options.maxAcross ?? MAX_ACROSS);
  if (b) classify(world, b, scan);
  const prev = options.prev ?? null;
  if (scan.structuralTier > 0 || !prev || prev.cx !== x || prev.cy !== y || prev.cz !== z || (b && sameBox(b, prev))) return scan;
  const f = frameOf(facing);
  if (prev.ux !== f.ux || prev.uz !== f.uz) return scan;
  const old = emptyScan();
  classify(world, prev, old);
  const shell = old.floor.total + old.walls.total + old.ceiling.total;
  const gaps = countGaps(old);
  return gaps > 0 && (shell - gaps) * 2 >= shell ? old : scan;
}

const sameBox = (a: HearthBox, b: HearthBox): boolean =>
  a.u0 === b.u0 && a.u1 === b.u1 && a.depth === b.depth && a.y0 === b.y0 && a.y1 === b.y1 && a.closed === b.closed;

/** Empty shell cells of a classified box (its problem list is capped; this counts every cell). */
function countGaps(scan: HearthScan): number {
  let n = 0;
  const c = scan.cells;
  for (let i = 0; i < c.length; i += 5) if (c[i + 4] !== CellRole.Interior && c[i + 4] !== CellRole.Controller && GAP[c[i + 3]]) n++;
  return n;
}

/** Classifies every cell of a box against the rules, filling the scan; sets the structural tier. */
function classify(world: IWorld, b: HearthBox, scan: HearthScan): void {
  scan.box = b;
  scan.closed = b.closed;
  scan.inner = [b.u1 - b.u0 + 1, b.depth, b.y1 - b.y0 + 1];
  let wallTier = 9;
  const top = b.y1 + (b.closed ? 1 : 0);
  for (let yy = b.y0 - 1; yy <= top; yy++) {
    for (let v = 0; v <= b.depth + 1; v++) {
      for (let u = b.u0 - 1; u <= b.u1 + 1; u++) {
        const wx = boxX(b, u, v);
        const wz = boxZ(b, u, v);
        const id = voxelId(world.getVoxel(wx, yy, wz));
        const role = cellRole(b, u, v, yy);
        scan.cells.push(wx, yy, wz, id, role);
        if (role === CellRole.Controller) continue;
        if (role === CellRole.Interior) {
          if (id !== 0) add(scan, 'interior', wx, yy, wz, 'Interior must be empty');
          continue;
        }
        const t = role === CellRole.FloorFace || (role === CellRole.Edge && yy < b.y0) ? scan.floor
          : role === CellRole.CeilingFace || (role === CellRole.Edge && yy > b.y1) ? scan.ceiling : scan.walls;
        t.total++;
        // Under the controller any solid block will do (it is not counted towards any tier).
        if (SOLID[id] && underController(b, u, v, yy)) continue;
        const name = (): string => BLOCKS[id].name;
        let bad = '';
        let code: HearthProblemCode = 'wrong_block';
        if (WALL_TIER[id] > 0) {
          t.byTier[WALL_TIER[id]]++;
          if (WALL_TIER[id] < wallTier) wallTier = WALL_TIER[id];
          continue;
        } else if (GAP[id]) {
          code = 'missing';
          bad = `${t === scan.floor ? 'Floor' : t === scan.ceiling ? 'Ceiling' : 'Wall'} has a gap`;
        } else if (FURNACE[id]) {
          code = 'controller';
          bad = 'Another furnace is part of this wall';
        } else if (FACE_PART[id] || ELECTRODE[id]) {
          if (role === CellRole.Edge) {
            code = 'edge_part';
            bad = `${name()} cannot sit on an edge`;
          } else if (ELECTRODE[id] && role !== CellRole.CeilingFace) {
            code = 'electrode_place';
            bad = `${name()}s only work in the ceiling`;
          } else {
            t.parts++;
            const p: Pos = [wx, yy, wz];
            if (id === GLASS) scan.windows++;
            else if (id === PORT) scan.ports.push(p);
            else if (id === ITEM_HATCH) scan.itemHatches.push(p);
            else if (id === FLUID_HATCH) scan.fluidHatches.push(p);
            else if (id === BLOWER) scan.blowers.push(p);
            else scan.electrodes.push(p);
            continue;
          }
        } else {
          bad = `${name()} cannot be part of the ${role === CellRole.FloorFace ? 'floor' : role === CellRole.CeilingFace ? 'ceiling' : 'wall'}`;
        }
        t.bad++;
        add(scan, code, wx, yy, wz, bad);
      }
    }
  }
  scan.wallTier = wallTier === 9 ? 0 : wallTier;
  if (scan.problemCount === 0) {
    for (let tier = FURNACE_TIERS.length; tier >= FIRST_HEARTH_TIER && scan.structuralTier === 0; tier--) {
      if (tierProblems(scan, tier, 1).length === 0) scan.structuralTier = tier;
    }
  }
}

/** Structure rules of a tier (throws for the single-block tiers, which have none). */
export function structureOf(tier: number): HearthStructureSpec {
  const s = FURNACE_TIERS[tier - 1]?.structure;
  if (!s) throw new Error(`furnace tier ${tier} has no hearth structure`);
  return s;
}

/** "Blast hearth", "Arc hearth", ... "Starhearth" (the tier's name with "Furnace" turned into "hearth"). */
export const hearthName = (tier: number): string => FURNACE_TIERS[tier - 1].name.replace(/ Furnace$/, ' hearth');

const plural = (count: number, name: string): string => `${count} ${name}${count === 1 ? '' : 's'}`;
/** "a" or "an" before a name. */
export const article = (name: string): string => (/^[AEIOU]/i.test(name) ? 'an' : 'a');

/**
 * What keeps a scanned box from forming at one tier, beyond its hard problems: interior size, ceiling, wall blocks
 * below the tier, electrodes and power ports. At most `max` problems.
 */
export function tierProblems(scan: HearthScan, tier: number, max = HEARTH_MAX_PROBLEMS): HearthProblem[] {
  const out: HearthProblem[] = [];
  const b = scan.box;
  const inner = scan.inner;
  if (!b || !inner) return out;
  const s = structureOf(tier);
  const name = hearthName(tier);
  const bx = b.cx + b.vx;
  const bz = b.cz + b.vz;
  const push = (code: HearthProblemCode, x: number, y: number, z: number, text: string): boolean => {
    if (out.length < max) out.push({ code, x, y, z, text });
    return out.length < max;
  };
  if (!interiorFits(s, inner)) {
    const small = inner[2] < s.minInner[2] || Math.max(inner[0], inner[1]) < Math.max(s.minInner[0], s.minInner[1])
      || Math.min(inner[0], inner[1]) < Math.min(s.minInner[0], s.minInner[1]);
    const dims = (d: readonly number[]): string => `${d[0]}x${d[1]}x${d[2]}`;
    if (!push('size', b.cx, b.cy, b.cz, small
      ? `Too small for ${article(name)} ${name} - the inside must be at least ${dims(s.minInner)}`
      : `Too big for ${article(name)} ${name} - the inside can be at most ${dims(s.maxInner)}`)) return out;
  }
  if (s.ceiling === 'required' && !b.closed && !push('ceiling', bx, b.y1 + 1, bz, `${article(name) === 'an' ? 'An' : 'A'} ${name} needs a ceiling`)) return out;
  const electrodes = (s.electrodes ?? 0) - scan.electrodes.length;
  if (electrodes > 0 && !push('electrodes', bx, b.y1 + 1, bz, `Needs ${plural(electrodes, 'more Arc Electrode')}`)) return out;
  const ports = (s.powerPorts ?? 0) - scan.ports.length;
  if (ports > 0 && !push('ports', b.cx, b.cy, b.cz, `Needs ${plural(ports, 'more Power Port')}`)) return out;
  if (scan.wallTier > 0 && scan.wallTier < tier) {
    const wall = block(s.wall[0]).name;
    const c = scan.cells;
    for (let i = 0; i < c.length; i += 5) {
      const t = WALL_TIER[c[i + 3]];
      if (t > 0 && t < tier && !push('wall_tier', c[i], c[i + 1], c[i + 2], `Wall is not ${wall}`)) return out;
    }
  }
  return out;
}

/** Hard problems plus a tier's own, at most HEARTH_MAX_PROBLEMS. */
export function problemsFor(scan: HearthScan, tier: number): HearthProblem[] {
  const out = scan.problems.slice(0, HEARTH_MAX_PROBLEMS);
  if (out.length < HEARTH_MAX_PROBLEMS) out.push(...tierProblems(scan, tier, HEARTH_MAX_PROBLEMS - out.length));
  return out;
}
