/**
 * Where the guards of an Old Works ruin stand (spec 19.3): RUIN_WARDENS forge wardens on the room's floor and, on
 * RUIN_SENTRY_CHANCE of the ruins, a kiln sentry on top of a wall. Pure functions of the seed and the ruin's site, so
 * every ruin always gets the same guards; the mob manager creates them once (when the whole ruin is loaded), saves
 * them and never respawns them. Heights are left to the caller: it reads the actual blocks (the player may have
 * built or dug there) and stands each guard on the first floor with room for it.
 */
import { RUIN_SENTRY_CHANCE, RUIN_WARDENS } from '../core/constants';
import { hash32, hashFloat } from '../core/math';
import { ruinsNear, type RuinSite } from './ruins';

const SALT_WARDENS = 0x67617264;
const SALT_SENTRY = 0x73656e74;
/** Fallen stones lie this far outside the walls (ruins.ts SKIRT): the ruin's blocks stay inside these bounds. */
const SKIRT = 2;

export interface RuinCell {
  x: number;
  z: number;
}

export interface RuinGuardPlan {
  /** Stable id of the ruin ("x0,z0" of its walls). */
  key: string;
  /** Centre of the room (block centre) and the y of its floor blocks (guards stand at floor + 1 or above). */
  x: number;
  z: number;
  floor: number;
  /** Block bounds of everything the ruin drew (walls and fallen stones), inclusive. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Cells inside the room for the forge wardens (RUIN_WARDENS of them). */
  wardens: RuinCell[];
  /** Wall cells for the kiln sentry in order of preference (corners first: they stand tallest); empty: no sentry. */
  sentry: RuinCell[];
}

/** The door cell's wall middle and the cold furnace's (opposite wall): never a guard's cell. */
function doorAndFurnace(r: RuinSite): [RuinCell, RuinCell] {
  const mx = r.x0 + (r.w >> 1);
  const mz = r.z0 + (r.d >> 1);
  switch (r.door) {
    case 0: return [{ x: mx, z: r.z0 }, { x: mx, z: r.z0 + r.d - 1 }];
    case 1: return [{ x: r.x0 + r.w - 1, z: mz }, { x: r.x0, z: mz }];
    case 2: return [{ x: mx, z: r.z0 + r.d - 1 }, { x: mx, z: r.z0 }];
    default: return [{ x: r.x0, z: mz }, { x: r.x0 + r.w - 1, z: mz }];
  }
}

/** Shuffles `cells` in place with a hash of (seed, ruin, salt). */
function shuffle(cells: RuinCell[], seed: number, r: RuinSite, salt: number): RuinCell[] {
  for (let i = cells.length - 1; i > 0; i--) {
    const j = hash32(seed ^ salt, r.x0, r.z0, i) % (i + 1);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/** The guard plan of one ruin. */
export function ruinGuardPlan(seed: number, r: RuinSite): RuinGuardPlan {
  const [door, furnace] = doorAndFurnace(r);
  const near = (c: RuinCell, o: RuinCell, d: number): boolean => Math.abs(c.x - o.x) + Math.abs(c.z - o.z) <= d;
  const inside: RuinCell[] = [];
  for (let z = r.z0 + 1; z < r.z0 + r.d - 1; z++) {
    for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) {
      const c = { x, z };
      if ((x === r.crateX && z === r.crateZ) || near(c, door, 1) || near(c, furnace, 1)) continue;
      inside.push(c);
    }
  }
  const count = RUIN_WARDENS[0] + (hash32(seed ^ SALT_WARDENS, r.x0, r.z0) % (RUIN_WARDENS[1] - RUIN_WARDENS[0] + 1));
  const wardens = shuffle(inside, seed, r, SALT_WARDENS).slice(0, count);

  const sentry: RuinCell[] = [];
  if (hashFloat(seed ^ SALT_SENTRY, r.x0, r.z0) < RUIN_SENTRY_CHANCE) {
    const corners: RuinCell[] = [];
    const sides: RuinCell[] = [];
    for (let z = r.z0; z < r.z0 + r.d; z++) {
      for (let x = r.x0; x < r.x0 + r.w; x++) {
        const edgeX = x === r.x0 || x === r.x0 + r.w - 1;
        const edgeZ = z === r.z0 || z === r.z0 + r.d - 1;
        if (!edgeX && !edgeZ) continue;
        const c = { x, z };
        if (near(c, door, 0) || near(c, furnace, 0)) continue;
        (edgeX && edgeZ ? corners : sides).push(c);
      }
    }
    sentry.push(...shuffle(corners, seed, r, SALT_SENTRY), ...shuffle(sides, seed, r, SALT_SENTRY + 1));
  }
  return {
    key: `${r.x0},${r.z0}`,
    x: r.x0 + r.w / 2,
    z: r.z0 + r.d / 2,
    floor: r.floor,
    x0: r.x0 - SKIRT,
    z0: r.z0 - SKIRT,
    x1: r.x0 + r.w - 1 + SKIRT,
    z1: r.z0 + r.d - 1 + SKIRT,
    wardens,
    sentry,
  };
}

/** Guard plans of every ruin whose blocks fall inside chunk (cx, cz). */
export function ruinGuardPlans(seed: number, cx: number, cz: number): RuinGuardPlan[] {
  return ruinsNear(seed, cx, cz).map((r) => ruinGuardPlan(seed, r));
}
