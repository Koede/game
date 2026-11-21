/**
 * The research board (docs/OVERHAUL_PLAN.md B.6): a 5 x 5 grid with fixed anchor aspects. The player places aspect tokens
 * on free cells; the board is solved when every anchor is joined to every other through 4-neighbour steps between KIN
 * aspects (equal, or one a component of the other). `solveBoard` proves a board can be solved with given aspects and
 * gives hints. Pure functions; cells are indices y * BOARD_W + x.
 */
import { kin, type Aspect } from './aspects';

export const BOARD_W = 5;
export const BOARD_H = 5;
export const BOARD_CELLS = BOARD_W * BOARD_H;

export interface BoardAnchor { cell: number; aspect: Aspect }
export interface BoardSpec { anchors: readonly BoardAnchor[]; blocked?: readonly number[] }
/** Placed tokens: cell index -> aspect. */
export type BoardTokens = Record<number, Aspect>;

export const cellAt = (x: number, y: number): number => y * BOARD_W + x;

export function neighbours(cell: number): number[] {
  const x = cell % BOARD_W;
  const y = Math.floor(cell / BOARD_W);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < BOARD_W - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - BOARD_W);
  if (y < BOARD_H - 1) out.push(cell + BOARD_W);
  return out;
}

/** Whether a free cell may hold a token (not an anchor, not blocked, on the board). */
export function cellFree(spec: BoardSpec, cell: number): boolean {
  if (!(cell >= 0 && cell < BOARD_CELLS) || !Number.isInteger(cell)) return false;
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

/** Cells reachable from `start` through kin-linked occupied neighbours. */
export function linkedFrom(spec: BoardSpec, tokens: BoardTokens, start: number): Set<number> {
  const at = boardAspects(spec, tokens);
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const c = queue.pop() as number;
    const a = at.get(c);
    if (!a) continue;
    for (const n of neighbours(c)) {
      const b = at.get(n);
      if (b && !seen.has(n) && kin(a, b)) { seen.add(n); queue.push(n); }
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
 * A full set of tokens that solves the board with only `aspects`, or null. Anchors are joined one by one to the growing
 * network by a shortest kin path (BFS over cell x aspect states); not always minimal, always valid.
 */
export function solveBoard(spec: BoardSpec, aspects: readonly Aspect[]): BoardTokens | null {
  const tokens: BoardTokens = {};
  if (spec.anchors.length < 2) return tokens;
  for (let i = 1; i < spec.anchors.length; i++) {
    const net = linkedFrom(spec, tokens, spec.anchors[0].cell);
    if (net.has(spec.anchors[i].cell)) continue;
    const path = shortestLink(spec, tokens, spec.anchors[i], net, aspects);
    if (!path) return null;
    for (const [c, a] of path) tokens[c] = a;
  }
  return boardSolved(spec, tokens) ? tokens : null;
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
      for (const n of neighbours(s.cell)) {
        const there = at.get(n);
        if (there !== undefined) {
          if (!kin(s.aspect, there)) continue;
          if (net.has(n)) {
            const out: [number, Aspect][] = [];
            for (let p: State | null = s; p && p.prev; p = p.prev) if (cellFree(spec, p.cell)) out.push([p.cell, p.aspect]);
            return out.reverse();
          }
          // Another anchor (or a placed token) not yet joined: walk through it with its own aspect.
          if (!seen.has(key(n, there))) {
            seen.add(key(n, there));
            next.push({ cell: n, aspect: there, prev: s });
          }
          continue;
        }
        if (!cellFree(spec, n)) continue;
        for (const a of aspects) {
          if (!kin(s.aspect, a) || seen.has(key(n, a))) continue;
          seen.add(key(n, a));
          next.push({ cell: n, aspect: a, prev: s });
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** One helpful token the player has not placed yet (from a fresh solution that keeps their tokens if it can). */
export function boardHint(spec: BoardSpec, tokens: BoardTokens, aspects: readonly Aspect[]): { cell: number; aspect: Aspect } | null {
  const solution = solveBoard(spec, aspects);
  if (!solution) return null;
  for (const [c, a] of Object.entries(solution)) if (tokens[Number(c)] !== a) return { cell: Number(c), aspect: a };
  return null;
}
