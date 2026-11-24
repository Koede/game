/**
 * The rig scan of the glass distillery (docs/DISTILLERY_PLAN.md 1, 3, 9). Pure: it reads blocks only.
 *
 * A rig is every chemistry block connected to another through a face (a flood fill, capped at MAX_MODULES). Where a
 * block stands says what it does, so the scan derives everything from positions:
 *   - a STILL is a boiling flask standing on a still base, with its column above it: column segments straight up, then
 *     the HEAD condenser on top of the last one (or right on the flask: a pot still). A condenser beside a segment is
 *     a SIDE DRAW at that height. Stack height = the number of cuts.
 *   - LIQUID edges: condensers, receivers, tubes and vessels pour down and sideways, never up. A flask or a vessel
 *     takes liquid from the side only through a glass tube (so a receiver beside a flask never drains back into it).
 *     An edge both ends may pour along is a level-sharing edge (tube runs, a receiver beside a tube).
 *   - modifiers: an airlock cap seals the vessel under it; a cooling jacket cools the condensers it touches.
 * Problems are reported like the hearth's STRUCTURE tab: a code, a sentence and the cells to highlight.
 */
import { CHEM, MAX_MODULES, MAX_SEGMENTS, chemKindOf, type ChemKind } from '../core/distill';
import type { IWorld } from '../core/types';
import { posKey } from './entities';

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export interface RigModule extends Cell {
  key: string;
  kind: ChemKind;
}

export interface SideDraw {
  /** 1-based segment the condenser stands beside. */
  h: number;
  condenser: string;
}

export interface Still {
  flask: string;
  base: string | null;
  /** Column segments bottom to top. */
  segments: string[];
  draws: SideDraw[];
  head: string | null;
  /** Reflux head on top of the column, if any. */
  reflux: string | null;
  /** A vacuum cap sits on this stack, so boiling points are scaled. */
  vacuum: boolean;
}

export interface LiquidEdge {
  from: string;
  to: string;
  /** Both ends may pour into each other: levels are shared instead of the upper one emptying. */
  shared: boolean;
}

export type RigProblemCode = 'no_base' | 'no_condenser' | 'drips_nowhere' | 'too_tall' | 'loose_segment' | 'shared_condenser' | 'too_many';

export interface RigProblem {
  code: RigProblemCode;
  text: string;
  cells: string[];
}

export interface Rig {
  /** Module keys (posKey) in scan order. */
  modules: Map<string, RigModule>;
  stills: Still[];
  edges: LiquidEdge[];
  /** Vessel key -> sealed by an airlock cap. */
  sealed: Set<string>;
  /** Condenser key -> jacket keys touching it. */
  jackets: Map<string, string[]>;
  problems: RigProblem[];
}

/** Face order everywhere: down, up, then the sides N, E, S, W. */
const DIRS: ReadonlyArray<readonly [number, number, number]> = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];

const MAX_PROBLEMS = 8;

export function moduleAt(world: IWorld, x: number, y: number, z: number): RigModule | null {
  const kind = chemKindOf(world.getBlock(x, y, z).key);
  return kind ? { x, y, z, kind, key: posKey(x, y, z) } : null;
}

/** Whether `kind` pours liquid towards a neighbour in direction d (index into DIRS). */
const pours = (kind: ChemKind, d: number): boolean =>
  (kind === CHEM.filter && d === 0)
  || (kind === CHEM.funnel && d === 0)
  || (d !== 1 && (kind === CHEM.condenser || kind === CHEM.receiver || kind === CHEM.tube || kind === CHEM.vessel));

/** Whether `kind` takes liquid from a neighbour `from` lying in direction d of it (index into DIRS). */
function takes(kind: ChemKind, d: number, from: ChemKind): boolean {
  if (kind === CHEM.filter) return d === 1;
  if (kind === CHEM.funnel) return d === 1 || (d >= 2 && from === CHEM.tube);
  if (kind === CHEM.receiver || kind === CHEM.tube) return d === 1 || d >= 2;
  if (kind === CHEM.vessel) return d === 1 || (d >= 2 && from === CHEM.tube);
  if (kind === CHEM.flask) return (d === 1 || d >= 2) && from === CHEM.tube;
  return false;
}

/** Direction index from a to b (they touch). */
function dirOf(a: Cell, b: Cell): number {
  return DIRS.findIndex(([dx, dy, dz]) => a.x + dx === b.x && a.y + dy === b.y && a.z + dz === b.z);
}

/** Scans the rig containing the chemistry block at x, y, z (null when there is none there). */
export function scanRig(world: IWorld, x: number, y: number, z: number): Rig | null {
  const start = moduleAt(world, x, y, z);
  if (!start) return null;
  const modules = new Map<string, RigModule>([[start.key, start]]);
  const queue: RigModule[] = [start];
  let overflow = false;
  for (let i = 0; i < queue.length; i++) {
    const m = queue[i];
    for (const [dx, dy, dz] of DIRS) {
      const n = moduleAt(world, m.x + dx, m.y + dy, m.z + dz);
      if (!n || modules.has(n.key)) continue;
      if (modules.size >= MAX_MODULES) {
        overflow = true;
        continue;
      }
      modules.set(n.key, n);
      queue.push(n);
    }
  }
  const at = (c: Cell, d: number): RigModule | null => {
    const [dx, dy, dz] = DIRS[d];
    return modules.get(posKey(c.x + dx, c.y + dy, c.z + dz)) ?? null;
  };
  const problems: RigProblem[] = [];
  const problem = (code: RigProblemCode, text: string, cells: string[]): void => {
    if (problems.length < MAX_PROBLEMS) problems.push({ code, text, cells });
  };
  if (overflow) problem('too_many', `A rig holds at most ${MAX_MODULES} pieces of glassware`, [start.key]);

  // Stills: a flask, its base, its column, its condensers.
  const stills: Still[] = [];
  const condenserOwner = new Map<string, string>();
  const inStack = new Set<string>();
  const claim = (condenser: RigModule, still: Still): boolean => {
    const owner = condenserOwner.get(condenser.key);
    if (owner && owner !== still.flask) {
      problem('shared_condenser', 'This condenser touches two columns: give each its own', [condenser.key]);
      return false;
    }
    condenserOwner.set(condenser.key, still.flask);
    return true;
  };
  for (const m of modules.values()) {
    if (m.kind !== CHEM.flask) continue;
    const below = at(m, 0);
    const still: Still = { flask: m.key, base: below?.kind === CHEM.base ? below.key : null, segments: [], draws: [], head: null, reflux: null, vacuum: false };
    if (!still.base) problem('no_base', 'The Boiling Flask needs a Still Base under it', [m.key]);
    let top: RigModule = m;
    for (let up = at(m, 1); up && up.kind === CHEM.segment; up = at(up, 1)) {
      still.segments.push(up.key);
      inStack.add(up.key);
      top = up;
    }
    const aboveColumn = at(top, 1);
    if (aboveColumn?.kind === CHEM.reflux) {
      still.reflux = aboveColumn.key;
      top = aboveColumn;
    }
    if (still.segments.length > MAX_SEGMENTS) problem('too_tall', `A column holds ${MAX_SEGMENTS} segments at most`, still.segments.slice(MAX_SEGMENTS));
    still.segments.forEach((key, i) => {
      const seg = modules.get(key)!;
      for (let d = 2; d < 6; d++) {
        const side = at(seg, d);
        if (side?.kind === CHEM.condenser && claim(side, still)) {
          still.draws.push({ h: i + 1, condenser: side.key });
          break;
        }
      }
    });
    const head = at(top, 1);
    if (head?.kind === CHEM.condenser && claim(head, still)) still.head = head.key;
    if (!still.head && still.reflux) {
      const reflux = modules.get(still.reflux)!;
      for (let d = 2; d < 6; d++) {
        const side = at(reflux, d);
        if (side?.kind === CHEM.condenser && claim(side, still)) {
          still.head = side.key;
          break;
        }
      }
    }
    if (!still.head && still.draws.length === 0) problem('no_condenser', 'The vapour has nowhere to go: put a Condenser Coil on top', [top.key]);
    const capped = (key: string | null): boolean => {
      if (!key) return false;
      const cell = modules.get(key);
      return !!cell && at(cell, 1)?.kind === CHEM.vacuum;
    };
    still.vacuum = capped(still.flask) || still.segments.some((key) => capped(key)) || capped(still.reflux) || capped(still.head);
    stills.push(still);
  }
  for (const m of modules.values()) {
    if (m.kind === CHEM.segment && !inStack.has(m.key)) problem('loose_segment', 'A Column Segment must stand on a flask or another segment', [m.key]);
  }

  // Liquid edges.
  const edges: LiquidEdge[] = [];
  const seen = new Set<string>();
  for (const a of modules.values()) {
    for (let d = 0; d < 6; d++) {
      if (!pours(a.kind, d)) continue;
      const b = at(a, d);
      if (!b) continue;
      const back = dirOf(b, a);
      if (!takes(b.kind, back, a.kind)) continue;
      const shared = pours(b.kind, back) && takes(a.kind, d, b.kind);
      const id = shared ? [a.key, b.key].sort().join('|') : `${a.key}>${b.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push({ from: a.key, to: b.key, shared });
    }
  }
  for (const key of condenserOwner.keys()) {
    if (!edges.some((e) => e.from === key)) problem('drips_nowhere', 'This condenser drips onto nothing: set a Receiver or a Glass Tube beside or below it', [key]);
  }

  // Modifiers.
  const sealed = new Set<string>();
  const jackets = new Map<string, string[]>();
  for (const m of modules.values()) {
    if (m.kind === CHEM.vessel && at(m, 1)?.kind === CHEM.airlock) sealed.add(m.key);
    if (m.kind === CHEM.condenser) {
      const list: string[] = [];
      for (let d = 0; d < 6; d++) {
        const n = at(m, d);
        if (n?.kind === CHEM.jacket) list.push(n.key);
      }
      if (list.length) jackets.set(m.key, list);
    }
  }
  return { modules, stills, edges, sealed, jackets, problems };
}

/** Every rig among the given chemistry cells (each scanned once). */
export function scanAll(world: IWorld, cells: Iterable<Cell>): Rig[] {
  const done = new Set<string>();
  const rigs: Rig[] = [];
  for (const c of cells) {
    if (done.has(posKey(c.x, c.y, c.z))) continue;
    const rig = scanRig(world, c.x, c.y, c.z);
    if (!rig) continue;
    for (const k of rig.modules.keys()) done.add(k);
    rigs.push(rig);
  }
  return rigs;
}
