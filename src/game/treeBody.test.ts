import { describe, expect, it } from 'vitest';
import { GRAVITY } from './groundItems';
import {
  initialBody,
  pointOf,
  poseOf,
  rodInertia,
  rodProfile,
  runFall,
  stepBody,
  STEP_S,
  type Pivot,
  type Terrain,
} from './treeBody';

// A flat world: the ground top is at height 0 (cells y <= -1 solid); the stump is an air-like pivot at y = 1 (the trunk's start).
const flat: Terrain = { solidAt: (_x, y) => y <= -1 };
const pivot: Pivot = { px: 0.5, pz: 0.5, py: 1, dx: 1, dz: 0 };

/** A wall of solid cells across the fall line at world x in [x0, x0+1), up to height `top`. */
function wall(x0: number, top: number): Terrain {
  return { solidAt: (x, y) => y <= -1 || (x === x0 && y >= 0 && y < top) };
}

/** Far end of the rod in the fall direction, plane units. */
function tipS(trunk: number, canopy: number, b: ReturnType<typeof initialBody>): number {
  const segs = rodProfile(trunk, canopy);
  const inertia = rodInertia(segs);
  return pointOf(b, inertia, segs[segs.length - 1].r).s;
}

describe('rod inertia', () => {
  it('puts the centre of mass past the middle for a canopy-heavy rod', () => {
    const inertia = rodInertia(rodProfile(6, 2));
    expect(inertia.mass).toBe(10);
    expect(inertia.rc).toBeCloseTo(4.6, 6);
    expect(inertia.iCom).toBeGreaterThan(0);
    expect(inertia.iPivot).toBeGreaterThan(inertia.iCom);
  });

  it('is finite for an empty or single-segment rod', () => {
    expect(rodInertia([]).iCom).toBeGreaterThan(0);
    expect(Number.isFinite(rodInertia([{ r: 0.5, m: 1 }]).iCom)).toBe(true);
  });
});

describe('the pivot phase', () => {
  it('starts upright, tilts under gravity alone, and accelerates as it tips', () => {
    const segs = rodProfile(6, 2);
    const inertia = rodInertia(segs);
    let b = initialBody(0.02, 0);
    const angles: number[] = [];
    for (let n = 0; n < 40; n++) {
      b = stepBody(b, segs, inertia, pivot, flat);
      angles.push(b.theta);
    }
    expect(angles[0]).toBeGreaterThan(0.02);
    // Gaining speed: the second half of a short window turns faster than the first.
    const early = angles[9] - angles[0];
    const late = angles[39] - angles[30];
    expect(late).toBeGreaterThan(early);
  });

  it('lets go when the centre of mass passes below the stump (theta reaches pi/2)', () => {
    const segs = rodProfile(6, 2);
    const inertia = rodInertia(segs);
    let b = initialBody();
    let released = false;
    for (let n = 0; n < 60 * 6 && !released; n++) {
      b = stepBody(b, segs, inertia, pivot, { solidAt: () => false });
      released = !b.pivoted;
    }
    expect(released).toBe(true);
    expect(Math.cos(b.theta)).toBeLessThanOrEqual(0.02);
  });
});

describe('the fall on flat ground', () => {
  it('comes to rest on the ground, away from the stump, and stays put', () => {
    const segs = rodProfile(6, 2);
    const end = runFall(initialBody(), segs, pivot, flat);
    expect(end.rest).toBe(true);
    expect(end.landedAt).toBeGreaterThan(0.5);
    const inertia = rodInertia(segs);
    const again = stepBody(end, segs, inertia, pivot, flat);
    expect(again).toBe(end);
    // The crown reaches well out along the fall direction and lies on the ground (height above the ground ~ rod radius).
    const reach = tipS(6, 2, end);
    expect(reach).toBeGreaterThan(5);
    expect(reach).toBeLessThan(9);
    const pose = poseOf(end, inertia, pivot);
    expect(pose.oy).toBeLessThan(pivot.py + 0.2);
  });

  it('a tall tree takes longer to come down than a short one', () => {
    const short = runFall(initialBody(), rodProfile(3, 1), pivot, flat);
    const tall = runFall(initialBody(), rodProfile(10, 2), pivot, flat);
    expect(tall.landedAt).toBeGreaterThan(short.landedAt);
  });

  it('after release the tip reaches the ground within a ballistic time bound', () => {
    // The centre of mass starts at pivot height with no horizontal speed; the far tip, spinning about it, is
    // rc + reach below it at most, so the ballistic time for the COM to drop rc + 1 is an upper bound.
    const segs = rodProfile(6, 2);
    const inertia = rodInertia(segs);
    let b = initialBody();
    while (b.pivoted) b = stepBody(b, segs, inertia, pivot, { solidAt: () => false });
    const releasedAt = b.t;
    const end = runFall(b, segs, pivot, flat);
    const ballisticMax = Math.sqrt((2 * (inertia.rc + 1)) / GRAVITY) + 0.5;
    expect(end.landedAt - releasedAt).toBeGreaterThan(0);
    expect(end.landedAt - releasedAt).toBeLessThan(ballisticMax);
  });
});

describe('a wall', () => {
  it('shortens the fall: the crown stops against it', () => {
    const segs = rodProfile(6, 2);
    const free = runFall(initialBody(), segs, pivot, flat);
    const walled = runFall(initialBody(), segs, pivot, wall(3, 4));
    expect(walled.rest).toBe(true);
    expect(tipS(6, 2, walled)).toBeLessThan(tipS(6, 2, free) - 0.5);
  });
});

describe('impact', () => {
  it('records the speed of the fastest point at the first contact', () => {
    const end = runFall(initialBody(), rodProfile(6, 2), pivot, flat);
    expect(end.impactSpeed).toBeGreaterThan(0);
    expect(end.impactSpeed).toBeLessThan(40);
  });

  it('a step is a fixed 1/60 s', () => {
    expect(STEP_S).toBeCloseTo(1 / 60, 9);
  });
});
