import { describe, expect, it } from 'vitest';
import { AMBIENT_TEMP_C, DT, FURNACE_WET_LOSS_MULT } from '../core/constants';
import { furnaceTier, machine } from '../core/registry';
import type { BiomeKey, WeatherKind, WeatherState } from '../core/types';
import { createWeatherState } from '../game/weather';
import type { CropEntity } from './cropRules';
import { isCrop } from './cropRules';
import { fire, makeKit, type Kit } from './testKit';

const CROP = machine('crop').params as Record<string, number>;

/** A kit whose simulation follows a weather state the test sets directly, over a world of one biome. */
function weatherKit(biome: BiomeKey = 'woodland') {
  const kit = makeKit();
  const w: WeatherState = createWeatherState();
  const env = { biome };
  kit.sim.useWeather(w, () => env.biome);
  const set = (kind: WeatherKind, previous: WeatherKind = kind, blend = 1): void => {
    Object.assign(w, { kind, previous, blend });
  };
  return { kit, w, env, set };
}

function live(kit: Kit, seconds: number): void {
  for (let i = Math.round(seconds / DT); i > 0; i--) {
    kit.clock.tick(DT);
    kit.sim.tick(DT);
  }
}

describe('weather and power (spec 15)', () => {
  it('halves solar output under clouds and cuts it to a fifth in rain, storm, snow and dust; eases across a change', () => {
    const { kit, set, env } = weatherKit();
    const panel = kit.machine('solar_panel', 0, 5, 0);
    const out = (): number => {
      kit.run(DT);
      return panel.availW;
    };
    expect(out()).toBe(300);
    set('cloudy');
    expect(out()).toBeCloseTo(150);
    set('rain');
    expect(out()).toBeCloseTo(60);
    set('storm');
    expect(out()).toBeCloseTo(60);
    env.biome = 'dunes';
    expect(out()).toBeCloseTo(60);
    set('cloudy', 'clear', 0.5);
    expect(out()).toBeCloseTo(225);
  });

  it('lifts wind turbines to 1.5x in a storm and leaves them alone in any other weather', () => {
    const { kit, set } = weatherKit();
    const turbine = kit.machine('wind_turbine', 0, 80, 0);
    kit.run(DT);
    const calm = turbine.availW;
    expect(calm).toBeGreaterThan(0);
    set('rain');
    kit.run(DT);
    // The wind wanders with time; one tick later it has barely moved.
    expect(turbine.availW / calm).toBeCloseTo(1, 3);
    set('storm');
    kit.run(DT);
    expect(turbine.availW / calm).toBeCloseTo(1.5, 3);
    set('storm', 'clear', 0.5);
    kit.run(DT);
    expect(turbine.availW / calm).toBeCloseTo(1.25, 2);
  });

  it('does nothing without a weather source (old behaviour)', () => {
    const kit = makeKit();
    const panel = kit.machine('solar_panel', 0, 5, 0);
    kit.run(DT);
    expect(panel.availW).toBe(300);
  });
});

describe('weather and the furnace (spec 15)', () => {
  /** Temperature after cooling for `seconds` from a steady fire, with the given weather and roof. */
  function cooled(kind: WeatherKind, opts: { roof?: boolean; biome?: BiomeKey } = {}): { tempC: number; view: string; chilled: boolean } {
    const { kit, set } = weatherKit(opts.biome);
    const e = kit.furnace(0, 1, 0);
    if (opts.roof) kit.world.put(0, 6, 0, 'stone');
    fire(kit, e, 'oak_log', 4);
    kit.run(100);
    kit.sim.douse(0, 1, 0);
    set(kind);
    const t0 = e.tempC;
    const tier = furnaceTier(1);
    kit.run(tier.heatCapacityJ / tier.lossWPerC / 4);
    const v = kit.sim.furnaceView(0, 1, 0);
    return { tempC: (e.tempC - AMBIENT_TEMP_C) / (t0 - AMBIENT_TEMP_C), view: v?.status ?? '', chilled: v?.rainChilled ?? false };
  }

  it('loses heat 1.5x faster in rain or snow under open sky', () => {
    const dry = cooled('clear');
    const wet = cooled('rain');
    expect(Math.log(wet.tempC) / Math.log(dry.tempC)).toBeCloseTo(FURNACE_WET_LOSS_MULT, 1);
    expect(wet.chilled).toBe(true);
    expect(dry.chilled).toBe(false);
    const snow = cooled('storm', { biome: 'frostfell' });
    expect(snow.chilled).toBe(true);
    expect(snow.tempC).toBeCloseTo(wet.tempC, 3);
  });

  it('is spared by a roof, by dust in the dunes and by cloud without rain', () => {
    const dry = cooled('clear').tempC;
    expect(cooled('rain', { roof: true }).tempC).toBeCloseTo(dry, 6);
    expect(cooled('storm', { biome: 'dunes' }).tempC).toBeCloseTo(dry, 6);
    expect(cooled('cloudy').tempC).toBeCloseTo(dry, 6);
  });

  it('notices a roof built over it while it rains', () => {
    const { kit, set } = weatherKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'charcoal', 20);
    set('rain');
    kit.run(1);
    expect(kit.sim.furnaceView(0, 1, 0)?.rainChilled).toBe(true);
    expect(kit.sim.furnaceView(0, 1, 0)?.status).toMatch(/rain chills it/);
    kit.world.put(0, 9, 0, 'plank');
    kit.run(DT);
    expect(kit.sim.furnaceView(0, 1, 0)?.rainChilled).toBe(false);
  });

  it('settles lower in the rain and says so in the estimate', () => {
    const { kit, set } = weatherKit();
    const e = kit.furnace(0, 1, 0);
    fire(kit, e, 'oak_log', 40);
    kit.run(1);
    const dryTarget = kit.sim.furnaceView(0, 1, 0)!.targetC;
    set('rain');
    kit.run(DT);
    expect(kit.sim.furnaceView(0, 1, 0)!.targetC).toBeLessThanOrEqual(dryTarget);
  });
});

describe('weather and crops (spec 15)', () => {
  function plant(kit: Kit, x: number, y: number, z: number): CropEntity {
    kit.world.put(x, y - 1, z, 'farmland');
    kit.world.put(x, y, z, 'wheat_0');
    const e = kit.world.getEntity(x, y, z);
    if (!isCrop(e)) throw new Error('no crop');
    return e;
  }

  it('waters crops under open sky while it rains (full rate instead of dryRate)', () => {
    const { kit, set } = weatherKit();
    kit.clock.timeOfDay = 0.05;
    const e = plant(kit, 0, 11, 0);
    live(kit, 10);
    expect(e.growS).toBeCloseTo(10 * CROP.dryRate, 3);
    expect(kit.sim.cropView(0, 11, 0)?.hydrated).toBe(false);
    set('rain');
    const before = e.growS;
    live(kit, 10);
    expect(e.growS - before).toBeCloseTo(10, 3);
    expect(kit.sim.cropView(0, 11, 0)).toMatchObject({ hydrated: true, rate: 1 });
  });

  it('does not water crops under a roof, in drizzle or in dust', () => {
    const { kit, set, env } = weatherKit();
    kit.clock.timeOfDay = 0.05;
    const roofed = plant(kit, 0, 11, 0);
    kit.world.put(0, 20, 0, 'glass');
    const open = plant(kit, 4, 11, 0);
    set('rain');
    // A glass roof keeps the rain off but lets the daylight through.
    live(kit, 10);
    expect(roofed.growS).toBeCloseTo(10 * CROP.dryRate, 3);
    expect(open.growS).toBeCloseTo(10, 3);
    set('rain', 'clear', 0.2);
    const drizzle = open.growS;
    live(kit, 1);
    expect(open.growS - drizzle).toBeCloseTo(CROP.dryRate, 3);
    env.biome = 'dunes';
    kit.sim.useWeather(null, null);
    const w = createWeatherState();
    Object.assign(w, { kind: 'storm', previous: 'storm' });
    kit.sim.useWeather(w, () => 'dunes');
    const dust = open.growS;
    live(kit, 1);
    expect(open.growS - dust).toBeCloseTo(CROP.dryRate, 3);
  });
});
