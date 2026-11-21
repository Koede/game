/**
 * Wellsprings (docs/OVERHAUL_PLAN.md B.3): floating crystals where the land wells up with one aspect. Where they are follows
 * from the world seed and the chunk alone (nothing to save but how much was drawn): about one chunk in NODE_RARITY has
 * one, at a hashed cell of the chunk, NODE_HEIGHT above the ground. Seven in ten are primal, the rest compound.
 */
import { COMPOUNDS, PRIMALS, type Aspect } from './aspects';

export const NODE_RARITY = 10;
export const NODE_HEIGHT = 2.5;
/** Units a wellspring holds when full; it refills one unit every NODE_REGEN_S. */
export const NODE_POOL = 32;
export const NODE_REGEN_S = 15;
/** How near a rod must be (blocks) to draw from it. */
export const NODE_REACH = 6;

export interface NodeSite { key: string; x: number; z: number; aspect: Aspect }

function hash(seed: number, a: number, b: number, salt: number): number {
  let h = (seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The wellspring of chunk cx, cz (16 x 16 columns), or null. */
export function nodeInChunk(seed: number, cx: number, cz: number): NodeSite | null {
  if (hash(seed, cx, cz, 1) >= 1 / NODE_RARITY) return null;
  const x = cx * 16 + 2 + Math.floor(hash(seed, cx, cz, 2) * 12);
  const z = cz * 16 + 2 + Math.floor(hash(seed, cx, cz, 3) * 12);
  const primal = hash(seed, cx, cz, 4) < 0.7;
  const list: readonly Aspect[] = primal ? PRIMALS : COMPOUNDS;
  const aspect = list[Math.floor(hash(seed, cx, cz, 5) * list.length)];
  return { key: `${cx},${cz}`, x, z, aspect };
}

/** Every wellspring whose chunk lies within `radius` chunks of the column x, z. */
export function nodesNear(seed: number, x: number, z: number, radius: number): NodeSite[] {
  const ccx = Math.floor(x / 16);
  const ccz = Math.floor(z / 16);
  const out: NodeSite[] = [];
  for (let cz = ccz - radius; cz <= ccz + radius; cz++)
    for (let cx = ccx - radius; cx <= ccx + radius; cx++) {
      const n = nodeInChunk(seed, cx, cz);
      if (n) out.push(n);
    }
  return out;
}

/** "north-east" from (fromX, fromZ) to (toX, toZ); north is -Z. */
export function compass(fromX: number, fromZ: number, toX: number, toZ: number): string {
  const a = Math.atan2(toX - fromX, -(toZ - fromZ));
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
