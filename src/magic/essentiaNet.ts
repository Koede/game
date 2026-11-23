/**
 * Which jars a consumer of essentia can draw from (docs/api/magic.md): jars within `radius` blocks of it, plus every jar
 * joined to it through essentia tubes (a tube touching the consumer, tubes touching tubes, jars touching any tube). Pure
 * over a block lookup, so tests run it on a map. Searches are capped at MAX_TUBES tubes.
 */
import type { Aspect, Aspects } from './aspects';

export const JAR_BLOCKS: ReadonlySet<string> = new Set(['essentia_jar', 'void_jar']);
export const TUBE = 'essentia_tube';
/** A linked mirror joins the essentia line it touches to its partner's, wherever that is. */
export const MIRROR = 'linked_mirror';
export const MAX_TUBES = 256;

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export type BlockAt = (x: number, y: number, z: number) => string;
/** The partner cell of a linked mirror at x, y, z, or null. */
export type MirrorLink = (x: number, y: number, z: number) => [number, number, number] | null;

/** Cells of the jars a consumer at x, y, z reaches; `radius` 1 = touching only. */
export function jarsFor(blockAt: BlockAt, x: number, y: number, z: number, radius: number, link?: MirrorLink): [number, number, number][] {
  const found = new Map<string, [number, number, number]>();
  const r = Math.max(1, radius);
  for (let dy = -r; dy <= r; dy++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (r === 1 && Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) continue;
        if (JAR_BLOCKS.has(blockAt(x + dx, y + dy, z + dz))) found.set(k3(x + dx, y + dy, z + dz), [x + dx, y + dy, z + dz]);
      }
  // Tubes touching the consumer, and everything joined to them.
  const seen = new Set<string>();
  const queue: [number, number, number][] = [];
  const join = (c: [number, number, number]): void => {
    const kc = k3(...c);
    if (seen.has(kc)) return;
    seen.add(kc);
    queue.push(c);
    const to = blockAt(...c) === MIRROR ? link?.(...c) : null;
    if (to && !seen.has(k3(...to)) && blockAt(...to) === MIRROR) join(to);
  };
  for (const [dx, dy, dz] of DIRS) {
    const c: [number, number, number] = [x + dx, y + dy, z + dz];
    const b = blockAt(...c);
    if (b === TUBE || (b === MIRROR && link)) join(c);
  }
  while (queue.length && seen.size <= MAX_TUBES) {
    const [tx, ty, tz] = queue.pop() as [number, number, number];
    for (const [dx, dy, dz] of DIRS) {
      const c: [number, number, number] = [tx + dx, ty + dy, tz + dz];
      const kc = k3(...c);
      const b = blockAt(...c);
      if (JAR_BLOCKS.has(b)) found.set(kc, c);
      else if ((b === TUBE || (b === MIRROR && link)) && !seen.has(kc)) join(c);
    }
  }
  return [...found.values()];
}

/** What is short of `cost` given what is available (empty = enough). */
export function shortfall(cost: Aspects, have: Aspects): Aspects {
  const out: Aspects = {};
  for (const [a, n] of Object.entries(cost) as [Aspect, number][]) {
    const left = n - (have[a] ?? 0);
    if (left > 0) out[a] = left;
  }
  return out;
}
