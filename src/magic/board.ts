/**
 * The research board, Thaumcraft style (docs/api/magic.md): a hexagon of hex cells (radius 2, 3 or 4 by the research's
 * complexity) with fixed anchor aspects on it and ink blots where nothing can go. The player writes aspects into free
 * cells; the board is solved when every anchor is joined to every other through neighbouring cells whose aspects LINK
 * (one is a direct component of the other; an aspect never links to itself). `solveBoard` proves a board can be solved
 * with given aspects and finds the fewest-token answer it can for a hint. Pure functions.
 *
 * Cells: axial hex coordinates (q, r) with |q|, |r|, |q + r| <= radius, numbered row by row (r from -radius), left to right.
 */
import { linkable, type Aspect } from './aspects';

export interface BoardAnchor { cell: number; aspect: Aspect }
export interface BoardSpec { radius: number; anchors: readonly BoardAnchor[]; blocked?: readonly number[] }
/** Placed tokens: cell index -> aspect. */
export type BoardTokens = Record<number, Aspect>;

const layouts = new Map<number, { coords: [number, number][]; index: Map<string, number> }>();
function layout(radius: number): { coords: [number, number][]; index: Map<string, number> } {
  let l = layouts.get(radius);
  if (!l) {
    const coords: [number, number][] = [];
    const index = new Map<string, number>();
    for (let r = -radius; r <= radius; r++) {
      for (let q = Math.max(-radius, -r - radius); q <= Math.min(radius, -r + radius); q++) {
        index.set(`${q},${r}`, coords.length);
        coords.push([q, r]);
      }
    }
    l = { coords, index };
    layouts.set(radius, l);
  }
  return l;
}

export const cellCount = (radius: number): number => layout(radius).coords.length;
/** The cell at axial (q, r), or -1 off the board. */
export const hexCell = (radius: number, q: number, r: number): number => layout(radius).index.get(`${q},${r}`) ?? -1;
export const hexCoord = (radius: number, cell: number): [number, number] => layout(radius).coords[cell];

/** The six corners of the hexagon, clockwise from the left: left, top-left, top-right, right, bottom-right, bottom-left. */
export function corner(radius: number, i: number): number {
  const R = radius;
  const c: [number, number][] = [[-R, 0], [0, -R], [R, -R], [R, 0], [0, R], [-R, R]];
  const [q, r] = c[((i % 6) + 6) % 6];
  return hexCell(R, q, r);
}

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

export function neighbours(spec: { radius: number }, cell: number): number[] {
  const [q, r] = hexCoord(spec.radius, cell);
  const out: number[] = [];
  for (const [dq, dr] of DIRS) {
    const n = hexCell(spec.radius, q + dq, r + dr);
    if (n >= 0) out.push(n);
  }
  return out;
}

/** Whether a free cell may hold a token (on the board, not an anchor, not an ink blot). */
export function cellFree(spec: BoardSpec, cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= cellCount(spec.radius)) return false;
  if (spec.anchors.some((a) => a.cell === cell)) return false;
  return !(spec.blocked ?? []).includes(cell);
}

/** Every occupied cell's aspect: anchors plus tokens. */
export function boardAspects(spec: BoardSpec, tokens: BoardTokens): Map<number, Aspect> {
  const m = new Map<number, Aspect>();
  for (const [c, a] of Object.entries(tokens)) if (cellFree(spec, Number(c))) m.set(Number(c), a);
  for (const a of spec.anchors) m.set(a.cell, a.aspect);
  return m;
}

/** Cells reachable from `start` through linked occupied neighbours. */
export function linkedFrom(spec: BoardSpec, tokens: BoardTokens, start: number): Set<number> {
  const at = boardAspects(spec, tokens);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const c = queue.pop() as number;
    const a = at.get(c);
    if (!a) continue;
    for (const n of neighbours(spec, c)) {
      const b = at.get(n);
      if (b && !seen.has(n) && linkable(a, b)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

export function boardSolved(spec: BoardSpec, tokens: BoardTokens): boolean {
  if (spec.anchors.length < 2) return true;
  const linked = linkedFrom(spec, tokens, spec.anchors[0].cell);
  return spec.anchors.every((a) => linked.has(a.cell));
}

/**
 * A full set of tokens that solves the board with only `aspects` (keeping `keep` where it can), or null. Anchors are
 * joined one by one to the growing network by a shortest linked path (BFS over cell x aspect states); every order of the
 * anchors is tried and the answer with the fewest tokens is kept.
 */
export function solveBoard(spec: BoardSpec, aspects: readonly Aspect[], keep: BoardTokens = {}): BoardTokens | null {
  if (spec.anchors.length < 2) return { ...keep };
  let best: BoardTokens | null = null;
  const rest = spec.anchors.slice(1).map((_, i) => i + 1);
  for (const order of permutations(rest)) {
    const tokens: BoardTokens = { ...keep };
    let ok = true;
    for (const i of order) {
      const net = linkedFrom(spec, tokens, spec.anchors[0].cell);
      if (net.has(spec.anchors[i].cell)) continue;
      const path = shortestLink(spec, tokens, spec.anchors[i], net, aspects);
      if (!path) { ok = false; break; }
      for (const [c, a] of path) tokens[c] = a;
    }
    if (ok && boardSolved(spec, tokens) && (!best || Object.keys(tokens).length < Object.keys(best).length)) best = tokens;
  }
  return best;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  const out: T[][] = [];
  xs.forEach((x, i) => { for (const p of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]); });
  return out;
}

function shortestLink(spec: BoardSpec, tokens: BoardTokens, from: BoardAnchor, net: Set<number>, aspects: readonly Aspect[]): [number, Aspect][] | null {
  const at = boardAspects(spec, tokens);
  type State = { cell: number; aspect: Aspect; prev: State | null };
  const key = (c: number, a: Aspect): string => `${c}:${a}`;
  const seen = new Set<string>([key(from.cell, from.aspect)]);
  let frontier: State[] = [{ cell: from.cell, aspect: from.aspect, prev: null }];
  while (frontier.length) {
    const next: State[] = [];
    for (const s of frontier) {
      for (const n of neighbours(spec, s.cell)) {
        const there = at.get(n);
        if (there !== undefined) {
          if (!linkable(s.aspect, there)) continue;
          if (net.has(n)) {
            const out: [number, Aspect][] = [];
            for (let p: State | null = s; p && p.prev; p = p.prev) if (cellFree(spec, p.cell) && tokens[p.cell] === undefined) out.push([p.cell, p.aspect]);
            return out.reverse();
          }
          if (!seen.has(key(n, there))) {
            seen.add(key(n, there));
            next.push({ cell: n, aspect: there, prev: s });
          }
          continue;
        }
        if (!cellFree(spec, n)) continue;
        for (const a of aspects) {
          if (!linkable(s.aspect, a) || seen.has(key(n, a))) continue;
          seen.add(key(n, a));
          next.push({ cell: n, aspect: a, prev: s });
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** One helpful token the player has not placed yet (from a solution that keeps their tokens when it can). */
export function boardHint(spec: BoardSpec, tokens: BoardTokens, aspects: readonly Aspect[]): { cell: number; aspect: Aspect } | null {
  const solution = solveBoard(spec, aspects, tokens) ?? solveBoard(spec, aspects);
  if (!solution) return null;
  for (const [c, a] of Object.entries(solution)) if (tokens[Number(c)] !== a) return { cell: Number(c), aspect: a };
  return null;
}
