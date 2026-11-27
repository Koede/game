/**
 * The keepers' lighthouses (docs/api/optics.md): a banded round tower on a shore, a spiral stair round a centre post, a gallery,
 * and a glass lantern room whose plinth waits for a Lighthouse Lamp. The crate by the door holds lenses and a lamp.
 *
 * A lighthouse is not one of the biome structure types (STRUCTURE_DEFS): it only takes a grid square that has no other
 * structure, so adding it never moves or changes a structure an older world already has. Its site needs dry, low, level
 * ground right by open water (src/world/structures.ts squareStructure asks `lighthouseSite` last).
 */
import { blockId } from '../core/registry';
import { STRUCTURE_BLOCKS as B, type Canvas, type StructureDef } from './structureDefs';
import { DUNES, FROSTFELL, MARSH, WATER_TOP, WOODLAND } from './terrain';

export const LIGHTHOUSE_KEY = 'lighthouse';
/** Size of the footprint; the tower is centred in it. */
const SIZE = 7;
const MID = 3;
/** Local y of the gallery floor and of the plinth the lamp stands on. */
export const GALLERY_Y = 11;
export const PLINTH_Y = 12;
/** Chance a free square by the water gets a lighthouse. */
export const LIGHTHOUSE_CHANCE = 0.6;
/** A lighthouse keeps this far from the spawn point. */
export const LIGHTHOUSE_SPAWN_CLEAR = 48;
/** Ground of the site: dry, at most this far above the water, and level within LEVEL blocks. */
export const SHORE_MAX_HEIGHT = 6;
const LEVEL = 2;
/** At least this many of the SHORE_SAMPLES cells round the site, SHORE_R blocks out, are open water. */
const SHORE_SAMPLES = 16;
const SHORE_WET = 4;
const SHORE_R = [8, 12] as const;

/** The eight cells round the centre post, in the order the stair climbs them (from the doorway, clockwise from above). */
const RING: ReadonlyArray<readonly [number, number]> = [[3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3], [2, 2]];
/** Stair steps: step i is at RING[i % 8], local y = i; the last step reaches the gallery floor. */
const STEPS = GALLERY_Y;

const dist = (x: number, z: number): number => Math.hypot(x - MID, z - MID);

function build(c: Canvas): void {
  const lime = blockId('limestone');
  const brick = B.brick;
  const band = (y: number): number => (Math.floor(y / 3) % 2 === 0 ? lime : brick);
  c.floor(0, 0, SIZE - 1, SIZE - 1, () => B.stoneBrick);
  // The tower: a thick round wall in red and white bands, with a few slit windows.
  c.fill(0, 0, 0, SIZE - 1, GALLERY_Y - 1, SIZE - 1, (x, y, z) => {
    const d = dist(x, z);
    if (d < 1.8 || d > 3.2) return -1;
    const slit = y % 4 === 2 && ((x === MID && (z === 0 || z === SIZE - 1)) || (z === MID && (x === 0 || x === SIZE - 1)));
    return slit ? B.glass : band(y);
  });
  // The doorway on the north side, into the foot of the stair.
  for (const z of [0, 1]) c.gap(MID, z, 0, 1);
  // The centre post and the stair round it.
  c.pillar(MID, MID, 0, PLINTH_Y + 1, B.stoneBrick);
  for (let i = 0; i < STEPS; i++) {
    const [x, z] = RING[i % RING.length];
    c.set(x, i, z, B.plank);
  }
  // The cells inside the wall are open air already (drawStructure clears the site), so each step has head room to the next turn.
  // The gallery floor, open over the last two steps.
  c.fill(0, GALLERY_Y, 0, SIZE - 1, GALLERY_Y, SIZE - 1, (x, _y, z) => (dist(x, z) <= 3.6 ? B.stoneBrick : -1));
  for (const i of [STEPS - 2, STEPS - 1]) {
    const [x, z] = RING[i % RING.length];
    c.set(x, GALLERY_Y, z, B.air);
    c.set(x, GALLERY_Y + 1, z, B.air);
  }
  // A low rail round the gallery.
  c.fill(0, GALLERY_Y + 1, 0, SIZE - 1, GALLERY_Y + 1, SIZE - 1, (x, _y, z) => {
    const d = dist(x, z);
    return d > 2.9 && d <= 3.6 && !(x === MID && z === 0) ? B.stoneBrick : -1;
  });
  // The lantern room: glass all round, a doorway onto the gallery, a brick cap, and the plinth's top left free for the lamp.
  c.fill(1, PLINTH_Y, 1, SIZE - 2, PLINTH_Y + 2, SIZE - 2, (x, _y, z) => {
    const d = dist(x, z);
    if (d < 1.8) return x === MID && z === MID ? -1 : B.air;
    return d <= 2.9 ? B.glass : -1;
  });
  c.gap(MID, 1, PLINTH_Y, PLINTH_Y + 1);
  c.set(MID, PLINTH_Y + 1, MID, B.air);
  c.fill(1, PLINTH_Y + 3, 1, SIZE - 2, PLINTH_Y + 3, SIZE - 2, (x, _y, z) => (dist(x, z) <= 2.9 ? brick : -1));
  c.set(MID, PLINTH_Y + 4, MID, brick);
}

export const LIGHTHOUSE: StructureDef = {
  key: LIGHTHOUSE_KEY,
  name: 'Old Lighthouse',
  desc: 'A banded tower on the shore where a keeper once kept a lamp burning. The stair still climbs to an empty lantern room; the crate by its door holds lenses.',
  // Every shore but the Scar's (its pools are lava). Only read by checks: the lighthouse is not in STRUCTURE_DEFS.
  biomes: [WOODLAND, DUNES, FROSTFELL, MARSH],
  w: SIZE,
  d: SIZE,
  age: 0,
  crate: [1, 0],
  guards: [],
  floor: 'biome',
  build,
};

/** What the shore test reads of a column. */
export interface ShoreColumn {
  height: number;
  /** Liquid code (terrain.ts LIQUID_*) and whether it is water. */
  wet: boolean;
  dry: boolean;
}

/**
 * Whether a lighthouse fits with its centre at (cx, cz): `column(x, z)` samples the terrain. The footprint and a ring
 * round it are dry and level, low over the water, and open water lies within SHORE_R on at least SHORE_WET of SHORE_SAMPLES sides.
 * Returns the floor height or -1.
 */
export function lighthouseFloor(cx: number, cz: number, column: (x: number, z: number) => ShoreColumn): number {
  const heights: number[] = [];
  for (let dz = -MID - 1; dz <= MID + 1; dz += 2) {
    for (let dx = -MID - 1; dx <= MID + 1; dx += 2) {
      const c = column(cx + dx, cz + dz);
      if (!c.dry || c.height <= WATER_TOP || c.height > WATER_TOP + SHORE_MAX_HEIGHT) return -1;
      heights.push(c.height);
    }
  }
  heights.sort((a, b) => a - b);
  if (heights[heights.length - 1] - heights[0] > LEVEL) return -1;
  let wet = 0;
  for (let i = 0; i < SHORE_SAMPLES; i++) {
    const a = (i / SHORE_SAMPLES) * Math.PI * 2;
    if (SHORE_R.some((r) => column(Math.round(cx + Math.cos(a) * r), Math.round(cz + Math.sin(a) * r)).wet)) wet++;
  }
  if (wet < SHORE_WET) return -1;
  const at = column(cx, cz);
  return at.height;
}
