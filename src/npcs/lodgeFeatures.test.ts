import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { LODGE_SPAWN, LODGE_PATH } from './lodge';
import { NpcManager } from './manager';
import { GUEST_BEDS } from './tavern';
import type { TownSnapshot } from './townBuilder';

/** A town with the storage bay and the lodge planned (the lodge second), the lodge at `stage` (in progress) or finished. */
function town(stage: number, done = false, building = 1): TownSnapshot {
  return {
    v: 1,
    plan: {
      site: [60, 63],
      buildings: [
        { template: 'storage_bay', x: 46, z: 60, rot: 1 },
        { template: 'lodge', x: 54, z: 44, rot: 0 },
        { template: 'well_plaza', x: 56, z: 59, rot: 0 },
      ],
    },
    building,
    base: building === 1 ? 11 : null,
    ground: building === 1 ? new Array(13 * 15).fill(10) : [],
    stage: 0,
    cell: 0,
    laid: 0,
    lastDay: 1,
    owed: 0,
    accrued: 0,
    blocked: 0,
    bay: {},
    lodge: { stage, base: 11, done },
  };
}

const ORIGIN = [54, 11, 44];

/** A manager loaded from a save with the given town, the camp left (or not) and the lodge's origin. */
function managerWith(t: TownSnapshot | undefined, camp: boolean, at: number[] | null = ORIGIN) {
  const m = new NpcManager(createBus());
  m.load({ v: 1, at, greeted: true, gifted: [], spoken: {}, present: ['gruk'], camp, town: t });
  return m;
}

describe('the lodge stages switch features on', () => {
  it('the tavern does not exist for the trader or festival until the last stage is finished', () => {
    for (let s = 1; s < LODGE_PATH.length; s++) {
      const m = managerWith(town(s), false);
      expect(m.tavernLevel, `stage ${s} in progress`).toBe(s);
      expect(m.hasTavern, `stage ${s} in progress`).toBe(false);
    }
  });

  it('the last stage (the upper floor and tavern) finished turns the tavern on: hasTavern follows the lodge, not the camp flag', () => {
    // Stage 4 (the full tavern) built: the builder has moved past the lodge.
    const m = managerWith(town(0, false, 2), false);
    expect(m.tavernLevel).toBe(5);
    expect(m.hasTavern).toBe(true);
    // The same when the lodge reports itself done (a settle).
    expect(managerWith(town(0, true, 1), false).hasTavern).toBe(true);
  });

  it('a camp keeps the tavern off until settle; the camp is not the tavern', () => {
    const m = managerWith(undefined, true);
    expect(m.tavernLevel).toBe(0);
    expect(m.hasTavern).toBe(false);
  });

  it('an old save with no lodge in its plan has its tavern, as before', () => {
    const old: TownSnapshot = { ...town(0), plan: { site: [60, 63], buildings: [{ template: 'storage_bay', x: 46, z: 60, rot: 1 }] }, building: 0, base: null, ground: [], lodge: undefined };
    const m = managerWith(old, false);
    expect(m.tavernLevel).toBe(5);
    expect(m.hasTavern).toBe(true);
    expect(managerWith(undefined, false).hasTavern).toBe(true);
  });
});

describe('the player wakes in the lodge bedroom', () => {
  it('no bedroom spawn while the camp stands; the lodge bedroom from its first stage on', () => {
    expect(managerWith(town(0), true).bedSpawn()).toBeNull();
    const m = managerWith(town(1), false);
    const s = m.bedSpawn()!;
    expect(s.x).toBeCloseTo(ORIGIN[0] + LODGE_SPAWN[0] + 0.5);
    expect(s.y).toBeCloseTo(ORIGIN[1] + LODGE_SPAWN[1]);
    expect(s.z).toBeCloseTo(ORIGIN[2] + LODGE_SPAWN[2] + 0.5);
  });

  it('once the upper floor stands, the wake point is the guest bed (the first bedroom is taken down)', () => {
    const m = managerWith(town(0, false, 2), false);
    const s = m.bedSpawn()!;
    expect(s.x).toBeCloseTo(ORIGIN[0] + GUEST_BEDS[0][0]);
    expect(s.z).toBeCloseTo(ORIGIN[2] + GUEST_BEDS[0][2]);
  });
});
