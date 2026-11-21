/**
 * Which jars a consumer of essentia can draw from (docs/api/magic.md): jars within `radius` blocks of it, plus every jar
 * joined to it through essentia tubes (a tube touching the consumer, tubes touching tubes, jars touching any tube). Pure
 * over a block lookup, so tests run it on a map. Searches are capped at MAX_TUBES tubes.
 */
import type { Aspect, Aspects } from './aspects';

export const JAR_BLOCKS: ReadonlySet<string> = new Set(['essentia_jar', 'void_jar']);
export const TUBE = 'essentia_tube';
export const MAX_TUBES = 256;

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export type BlockAt = (x: number, y: number, z: number) => string;

/** Cells of the jars a consumer at x, y, z reaches; `radius` 1 = touching only. */
export function jarsFor(blockAt: BlockAt, x: number, y: number, z: number, radius: number): [number, number, number][] {
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
  for (const [dx, dy, dz] of DIRS) {
    const c: [number, number, number] = [x + dx, y + dy, z + dz];
    if (blockAt(...c) === TUBE) {
      seen.add(k3(...c));
      queue.push(c);
    }
  }
  while (queue.length && seen.size <= MAX_TUBES) {
    const [tx, ty, tz] = queue.pop() as [number, number, number];
    for (const [dx, dy, dz] of DIRS) {
      const c: [number, number, number] = [tx + dx, ty + dy, tz + dz];
      const kc = k3(...c);
      const b = blockAt(...c);
      if (JAR_BLOCKS.has(b)) found.set(kc, c);
      else if (b === TUBE && !seen.has(kc)) {
        seen.add(kc);
        queue.push(c);
      }
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
