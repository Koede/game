import { afterEach, describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { Thermal } from '../game/thermal';
import { SEASON_OFFSET_C } from '../app/state';
import { isCrop, type CropEntity } from './cropRules';
import {
  COLD_FRAME_SCALE, CROP_SEASON, DAYS_PER_SEASON, FROST_C, GREENHOUSE_GROWTH, GREENHOUSE_SCALE, GREENHOUSE_WARM_C,
  cropScale, seasonOf, shelterOf,
} from './seasons';
import { setTemperatureProvider } from './temperature';
import { makeKit, type Kit } from './testKit';

const WINTER_DAY = DAYS_PER_SEASON * 3 + 2;
const NOON = 0.3;

describe('greenhouse rules', () => {
  it('names where a crop stands: open, a heated greenhouse, a cold roof or frozen', () => {
    expect(shelterOf('winter', true, undefined, false)).toBe('open');
    expect(shelterOf('winter', true, undefined, true)).toBe('frozen');
    expect(shelterOf('winter', false, GREENHOUSE_WARM_C, true)).toBe('greenhouse');
    expect(shelterOf('winter', false, GREENHOUSE_WARM_C - 1, true)).toBe('cold');
    expect(shelterOf('winter', false, FROST_C - 1, true)).toBe('frozen');
    expect(shelterOf('winter', false, FROST_C - 1, false)).toBe('cold');
    expect(shelterOf('autumn', false, FROST_C - 1, true)).toBe('cold');
  });

  it('a heated greenhouse grows at spring pace or better in every season, on every world', () => {
    for (const crop of Object.keys(CROP_SEASON)) {
      for (const hard of [false, true]) {
        expect(cropScale('winter', crop, false, hard, false, 18), crop).toBe(GREENHOUSE_GROWTH);
      }
      expect(cropScale('winter', crop, false, false, true)).toBeLessThan(GREENHOUSE_GROWTH);
    }
    expect(cropScale('summer', 'wheat', false, false, false, 25)).toBe(CROP_SEASON.wheat.summer);
  });

  it('a cold roof only keeps the snow off; a hard winter slows it and frost below 0 C stops it', () => {
    expect(cropScale('winter', 'wheat', false, false, false, 4)).toBe(CROP_SEASON.wheat.winter);
    expect(cropScale('winter', 'wheat', false, true, false, 4)).toBe(COLD_FRAME_SCALE);
    expect(cropScale('winter', 'wheat', false, true, false, -3)).toBe(0);
    expect(cropScale('winter', 'wheat', false, true, false)).toBe(GREENHOUSE_SCALE);
  });
});

/** A glass house over a 3x3 farmland bed (x, z -1..1, soil y 10, crops y 11), walls and roof of glass, water in the bed. */
function greenhouse(kit: Kit): CropEntity {
  const w = kit.world;
  w.fill(-2, 9, -2, 2, 9, 2, 'stone');
  w.fill(-1, 10, -1, 1, 10, 1, 'farmland');
  w.put(0, 10, 1, 'water');
  w.fill(-2, 10, -2, 2, 12, -2, 'glass');
  w.fill(-2, 10, 2, 2, 12, 2, 'glass');
  w.fill(-2, 10, -2, -2, 12, 2, 'glass');
  w.fill(2, 10, -2, 2, 12, 2, 'glass');
  w.fill(-2, 13, -2, 2, 13, 2, 'glass');
  w.put(0, 11, 0, 'wheat_0');
  const e = w.getEntity(0, 11, 0);
  if (!isCrop(e)) throw new Error('no crop');
  return e;
}

function winterKit(): { kit: Kit; thermal: Thermal } {
  const kit = makeKit();
  kit.clock.day = WINTER_DAY;
  kit.clock.timeOfDay = NOON;
  kit.sim.hardWinter = true;
  expect(seasonOf(kit.clock.day)).toBe('winter');
  const thermal = new Thermal(kit.world, {
    isNight: () => kit.clock.isNight,
    biomeAt: () => 'plains' as never,
    seasonOffsetC: () => SEASON_OFFSET_C.winter,
  }, kit.bus);
  setTemperatureProvider((q) => thermal.temperatureAt(q.x, q.y + 0.9, q.z));
  return { kit, thermal };
}

const grow = (kit: Kit, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds / DT); i++) kit.sim.tick(DT);
};

describe('greenhouse in a hard winter (heat zones)', () => {
  afterEach(() => setTemperatureProvider(null));

  it('unheated glass keeps a crop alive but slow; a fire inside makes it grow at full pace', () => {
    const { kit } = winterKit();
    const e = greenhouse(kit);
    const cold = kit.sim.cropView(0, 11, 0)!;
    expect(cold.exposed).toBe(false);
    expect(cold.shelter).toBe('cold');
    expect(cold.tempC!).toBeLessThan(GREENHOUSE_WARM_C);
    grow(kit, 10);
    expect(e.growS).toBeCloseTo(10 * COLD_FRAME_SCALE, 1);

    kit.world.put(-1, 10, -1, 'lava');
    const warm = kit.sim.cropView(0, 11, 0)!;
    expect(warm.shelter).toBe('greenhouse');
    expect(warm.tempC!).toBeGreaterThanOrEqual(GREENHOUSE_WARM_C);
    const before = e.growS;
    grow(kit, 10);
    expect(e.growS - before).toBeCloseTo(10 * GREENHOUSE_GROWTH, 1);
  });

  it('an open field next door stays frozen', () => {
    const { kit } = winterKit();
    greenhouse(kit);
    kit.world.put(6, 10, 0, 'farmland');
    kit.world.put(6, 11, 0, 'wheat_0');
    const open = kit.sim.cropView(6, 11, 0)!;
    expect(open.exposed).toBe(true);
    expect(open.shelter).toBe('frozen');
    expect(open.rate).toBe(0);
  });
});
