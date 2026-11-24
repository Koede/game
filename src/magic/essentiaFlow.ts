/**
 * Essentia on the move, for the eye (docs/api/magic.md): every unit a consumer draws from a jar is logged as a FLOW from
 * that jar to the consumer, held for FLOW_HOLD_S so a steady draw (an infusion every 0.4 s, a siphon or servant every
 * second) reads as one unbroken stream. The renderer asks `flowPath` for the cells the stream runs through (jar, the
 * tubes, the consumer); a jar drawn through the air (an altar's reach) has no path and gets `arcRoute` instead. Pure: the
 * log is plain data and the searches run over a block lookup, so tests run them on a map.
 */
import type { Aspect, Aspects } from './aspects';
import { aspectInfo } from './aspects';
import { MIRROR, TUBE, type BlockAt, type MirrorLink } from './essentiaNet';

export type Cell = readonly [number, number, number];
export interface EssentiaFlow { from: Cell; to: Cell; aspect: Aspect; left: number }

/** Seconds a stream keeps flowing after its last unit. */
export const FLOW_HOLD_S = 1.5;
/** At most this many streams are kept (oldest dropped). */
export const MAX_FLOWS = 24;
const MAX_PATH_TUBES = 256;

const same = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export class FlowLog {
  readonly flows: EssentiaFlow[] = [];

  /** A unit of `aspect` left the jar at `from` for the consumer at `to`. */
  record(from: Cell, to: Cell, aspect: Aspect): void {
    const f = this.flows.find((g) => same(g.from, from) && same(g.to, to));
    if (f) {
      f.aspect = aspect;
      f.left = FLOW_HOLD_S;
      return;
    }
    if (this.flows.length >= MAX_FLOWS) this.flows.shift();
    this.flows.push({ from: [from[0], from[1], from[2]], to: [to[0], to[1], to[2]], aspect, left: FLOW_HOLD_S });
  }

  tick(dt: number): void {
    for (let i = this.flows.length - 1; i >= 0; i--) {
      this.flows[i].left -= dt;
      if (this.flows[i].left <= 0) this.flows.splice(i, 1);
    }
  }

  /** Whether essentia is leaving the jar at x, y, z. */
  draining(x: number, y: number, z: number): boolean {
    return this.flows.some((f) => f.from[0] === x && f.from[1] === y && f.from[2] === z);
  }
}

const DIRS: Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const key = (c: Cell): string => `${c[0]},${c[1]},${c[2]}`;
const touching = (a: Cell, b: Cell): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1;

/**
 * Cells a stream runs through from the jar at `from` to the consumer at `to`: [from, ...tubes, to]. A jar touching its
 * consumer gives [from, to]. Linked mirrors appear as two cells that do not touch (the stream jumps). null when the jar
 * is not joined to the consumer by tubes (drawn through the air).
 */
export function flowPath(blockAt: BlockAt, from: Cell, to: Cell, link?: MirrorLink): Cell[] | null {
  if (touching(from, to)) return [from, to];
  const isLine = (c: Cell): boolean => {
    const b = blockAt(c[0], c[1], c[2]);
    return b === TUBE || (b === MIRROR && !!link);
  };
  const parent = new Map<string, Cell | null>();
  const queue: Cell[] = [];
  for (const [dx, dy, dz] of DIRS) {
    const c: Cell = [from[0] + dx, from[1] + dy, from[2] + dz];
    if (isLine(c) && !parent.has(key(c))) {
      parent.set(key(c), null);
      queue.push(c);
    }
  }
  for (let head = 0; head < queue.length && parent.size <= MAX_PATH_TUBES; head++) {
    const c = queue[head];
    if (touching(c, to)) {
      const out: Cell[] = [to];
      for (let p: Cell | null = c; p; p = parent.get(key(p)) ?? null) out.push(p);
      out.push(from);
      return out.reverse();
    }
    const next: Cell[] = DIRS.map(([dx, dy, dz]) => [c[0] + dx, c[1] + dy, c[2] + dz] as Cell);
    if (blockAt(c[0], c[1], c[2]) === MIRROR) {
      const m = link?.(c[0], c[1], c[2]);
      if (m) next.push(m);
    }
    for (const n of next) {
      if (parent.has(key(n)) || !isLine(n)) continue;
      parent.set(key(n), c);
      queue.push(n);
    }
  }
  return null;
}

/**
 * Waypoints (world units) of a stream through the air from a point above a jar to a point above its consumer: up to a
 * crest `lift` above the higher end, across in x, across in z, then down. Straight runs only, so each leg is one box.
 */
export function arcRoute(ax: number, ay: number, az: number, bx: number, by: number, bz: number, lift: number): [number, number, number][] {
  const top = Math.max(ay, by) + lift;
  const pts: [number, number, number][] = [[ax, ay, az], [ax, top, az], [bx, top, az], [bx, top, bz], [bx, by, bz]];
  // Drop zero-length legs.
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1] || p[2] !== pts[i - 1][2]);
}

const hexOf = (a: Aspect): number => parseInt(aspectInfo(a).color.slice(1), 16);

/** The aspect a pot holds most of, or null. */
export function dominant(ess: Aspects): Aspect | null {
  let best: Aspect | null = null;
  for (const [a, n] of Object.entries(ess) as [Aspect, number][]) if (n > 0 && (!best || n > (ess[best] ?? 0))) best = a;
  return best;
}

/**
 * Colour of a crucible's liquid: water tinted by the essentia in it, weighted by amount, the tint growing as the pot
 * fills (`total` / `cap`, never quite hiding the water's sheen).
 */
export function crucibleColour(ess: Aspects, water: number, cap: number): number {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [a, units] of Object.entries(ess) as [Aspect, number][]) {
    if (!(units > 0)) continue;
    const h = hexOf(a);
    r += ((h >> 16) & 255) * units;
    g += ((h >> 8) & 255) * units;
    b += (h & 255) * units;
    n += units;
  }
  if (n === 0) return water;
  const k = Math.min(0.85, 0.35 + 0.5 * Math.min(1, n / cap));
  const mixC = (w: number, e: number): number => Math.round(w + (e / n - w) * k);
  return (mixC((water >> 16) & 255, r) << 16) | (mixC((water >> 8) & 255, g) << 8) | mixC(water & 255, b);
}
