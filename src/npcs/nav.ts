/**
 * Walking routes (docs/api/npcs.md): the tavern's people follow a path of free floor cells (doors, gaps in the bar, round the
 * pillars) instead of walking in a straight line through walls. Cells are tavern-local integer x, z; a cell is walkable when
 * it has a floor and two free blocks of height (checked against the layout, so it never drifts from what the player sees).
 */
import { layoutBlocks, TAVERN_D, TAVERN_W, YARD_D } from './tavern';

export type Cell = readonly [number, number];

let grid: boolean[][] | null = null;

function build(): boolean[][] {
  const at = new Map<string, string>();
  for (const b of layoutBlocks()) at.set(`${b.x},${b.y},${b.z}`, b.block);
  const solid = (x: number, y: number, z: number): boolean => {
    const k = at.get(`${x},${y},${z}`);
    // People open doors as they walk through them (docs/api/door.md).
    return k !== undefined && k !== 'air' && k !== 'wooden_door';
  };
  const g: boolean[][] = [];
  for (let z = 0; z < TAVERN_D + YARD_D; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < TAVERN_W; x++) row.push(solid(x, 0, z) && !solid(x, 1, z) && !solid(x, 2, z));
    g.push(row);
  }
  return g;
}

export function walkable(x: number, z: number): boolean {
  grid ??= build();
  return grid[z]?.[x] === true;
}

/** The walkable cell nearest to a point (ties: first found), or null when there is none. */
export function nearestCell(x: number, z: number): Cell | null {
  const cx = Math.round(x);
  const cz = Math.round(z);
  if (walkable(cx, cz)) return [cx, cz];
  let best: Cell | null = null;
  let bd = Infinity;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (!walkable(cx + dx, cz + dz)) continue;
    const d = (cx + dx - x) ** 2 + (cz + dz - z) ** 2;
    if (d < bd) { bd = d; best = [cx + dx, cz + dz]; }
  }
  return best;
}

const STEPS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Shortest route of cells from `from` to `to` (both walkable), start excluded; diagonals never cut a corner. Null when cut off. */
export function findPath(from: Cell, to: Cell): Cell[] | null {
  if (!walkable(from[0], from[1]) || !walkable(to[0], to[1])) return null;
  if (from[0] === to[0] && from[1] === to[1]) return [];
  const key = (x: number, z: number): number => z * 64 + x;
  const prev = new Map<number, number>([[key(from[0], from[1]), -1]]);
  let frontier: Cell[] = [from];
  while (frontier.length) {
    const next: Cell[] = [];
    for (const [x, z] of frontier) {
      for (const [dx, dz] of STEPS) {
        const nx = x + dx;
        const nz = z + dz;
        if (!walkable(nx, nz) || prev.has(key(nx, nz))) continue;
        if (dx !== 0 && dz !== 0 && (!walkable(x + dx, z) || !walkable(x, z + dz))) continue;
        prev.set(key(nx, nz), key(x, z));
        if (nx === to[0] && nz === to[1]) {
          const out: Cell[] = [];
          for (let k = key(nx, nz); k !== -1; k = prev.get(k) as number) {
            if (k === key(from[0], from[1])) break;
            out.push([k % 64, Math.floor(k / 64)]);
          }
          return out.reverse();
        }
        next.push([nx, nz]);
      }
    }
    frontier = next;
  }
  return null;
}
