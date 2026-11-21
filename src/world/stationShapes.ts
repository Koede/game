/**
 * The hand stations' shapes (EMBER_PLAN 2): small boxes where a cube would be wrong - a stump, a quern's lower stone,
 * an anvil, a loom frame, a drying rack. The stations are ordinary `cube` (and, for the low ones, `slab`) blocks in the content; this table, keyed by
 * block key, makes the mesher draw them as several boxes instead (blockTables.ts STATION; meshStation.ts draws). Collision, aiming and the
 * Use rules still treat the whole cell, which is easier to hit with a thumb; only the drawing and the target outline
 * (`stationBounds`) follow the real shape.
 *
 * Boxes are in sixteenths of the cell, in the block's NORTH-facing frame (front towards -Z). A voxel facing East,
 * South or West turns the boxes about the cell centre; each face keeps the texture of the face it lands on, so a
 * front texture (the loom) ends up on the facing side. Moving parts (a quern's runner stone, a hammer, a shuttle) are
 * not here: src/render/handwork draws them on top, driven by the stroke events.
 */
import type { Facing } from '../core/types';

/** [minX, minY, minZ, maxX, maxY, maxZ] in sixteenths. */
export type Box16 = readonly [number, number, number, number, number, number];

const post = (x: number, z: number, h: number, w = 2): Box16 => [x, 0, z, x + w, h, z + w];

/** Bowl walls around a hollow `inner` wide, `h` tall, standing on a floor `floor` thick. */
function bowl(min: number, max: number, floor: number, h: number, wall: number): Box16[] {
  return [
    [min, 0, min, max, floor, max],
    [min, floor, min, max, h, min + wall],
    [min, floor, max - wall, max, h, max],
    [min, floor, min + wall, min + wall, h, max - wall],
    [max - wall, floor, min + wall, max, h, max - wall],
  ];
}

export const STATION_BOXES: Readonly<Record<string, readonly Box16[]>> = {
  // A stump: slightly narrower than the cell, a notch of bark at the foot.
  chopping_block: [[1, 0, 1, 15, 11, 15], [0, 0, 5, 16, 2, 11]],
  chopping_block_pine: [[1, 0, 1, 15, 11, 15], [0, 0, 5, 16, 2, 11]],
  // The bedstone and a raised lip; the runner stone and its handle are an animated part.
  hand_quern: [[2, 0, 2, 14, 6, 14], [3, 6, 3, 13, 7, 13]],
  // Block, waist, face and horn: an anvil seen from the side, its long axis along X.
  stone_anvil: [[3, 0, 4, 13, 4, 12], [5, 4, 5, 11, 8, 11], [1, 8, 4, 15, 12, 12], [0, 9, 6, 2, 11, 10]],
  mortar: bowl(3, 13, 3, 8, 2),
  clay_table: [[0, 9, 0, 16, 12, 16], post(1, 1, 9, 3), post(12, 1, 9, 3), post(1, 12, 9, 3), post(12, 12, 9, 3)],
  // Four posts, top and cloth beams front and back, and the warp sheet between; the shuttle is a moving part.
  loom: [
    post(1, 1, 15), post(13, 1, 15), post(1, 13, 15), post(13, 13, 15),
    [3, 12, 1, 13, 14, 3], [3, 12, 13, 13, 14, 15], [3, 3, 1, 13, 5, 3], [3, 3, 13, 13, 5, 15],
    [3, 5, 7, 13, 12, 9],
  ],
  // Two forked posts and two cross poles: bundles hang from the upper pole (moving parts).
  drying_rack: [post(1, 7, 15), post(13, 7, 15), [3, 12, 7, 13, 14, 9], [3, 6, 7, 13, 8, 9]],
  tanning_trough: [
    [1, 0, 2, 15, 2, 14], [1, 2, 2, 15, 8, 4], [1, 2, 12, 15, 8, 14], [1, 2, 4, 3, 8, 12], [13, 2, 4, 15, 8, 12],
  ],
  // A low bench with a top and four legs; moulds stand on it.
  casting_bench: [[0, 9, 0, 16, 12, 16], post(1, 1, 9, 3), post(12, 1, 9, 3), post(1, 12, 9, 3), post(12, 12, 9, 3)],
  alloy_pot: bowl(3, 13, 2, 8, 2),
};

/** Stations whose moving parts stand above the static boxes: the target outline reaches the top of the part (sixteenths). */
const PART_TOP: Readonly<Record<string, number>> = { hand_quern: 12, mortar: 14 };

const keys = Object.keys(STATION_BOXES);
/** Whether a block key is drawn from the table. */
export const isStationShape = (key: string): boolean => key in STATION_BOXES;
/** Table index + 1 of a key (0 = not a station), the value blockTables stores per block id. */
export const stationIndex = (key: string): number => keys.indexOf(key) + 1;
export const stationBoxesByIndex = (index: number): readonly Box16[] => STATION_BOXES[keys[index - 1]];

/** The part of the cell the shape fills, in 0..1: for the target outline. Null for keys not in the table. */
export function stationBounds(key: string): readonly [number, number, number, number, number, number] | null {
  const boxes = STATION_BOXES[key];
  if (!boxes) return null;
  const out = [16, 16, 16, 0, 0, 0];
  for (const b of boxes) for (let i = 0; i < 3; i++) {
    out[i] = Math.min(out[i], b[i]);
    out[i + 3] = Math.max(out[i + 3], b[i + 3]);
  }
  out[4] = Math.max(out[4], PART_TOP[key] ?? 0);
  return out.map((n) => n / 16) as unknown as [number, number, number, number, number, number];
}

/** Turns a box (sixteenths) about the cell centre to the facing; North is the identity, East sends -Z to +X. */
export function turnBox(b: Box16, facing: Facing, out: number[]): void {
  const [x0, y0, z0, x1, y1, z1] = b;
  let ax = x0, az = z0, bx = x1, bz = z1;
  for (let k = 0; k < facing; k++) {
    // (x, z) -> (16 - z, x)
    const nax = 16 - bz, naz = ax, nbx = 16 - az, nbz = bx;
    ax = nax; az = naz; bx = nbx; bz = nbz;
  }
  out[0] = Math.min(ax, bx); out[2] = Math.min(az, bz);
  out[3] = Math.max(ax, bx); out[5] = Math.max(az, bz);
  out[1] = y0;
  out[4] = y1;
}

