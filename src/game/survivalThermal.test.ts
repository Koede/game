import { describe, expect, it } from 'vitest';
import { DT, MAX_WARMTH } from '../core/constants';
import { createBus } from '../core/context';
import type { BiomeKey } from '../core/types';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';
import { Survival } from './survival';
import { Thermal } from './thermal';

const NIGHT = 0.8;

/** A player at (0.5, 10, 0.5) on a stone floor under a sealed box of `wall` with a lava pool as the fire, or in the open. */
function rig(opts: { box: string | null; hard: boolean; biome?: BiomeKey; fire?: boolean }) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  if (opts.box) {
    world.fill(-3, 13, -3, 3, 13, 3, opts.box);
    for (const [x0, z0, x1, z1] of [[-3, -3, 3, -3], [-3, 3, 3, 3], [-3, -3, -3, 3], [3, -3, 3, 3]] as const) world.fill(x0, 10, z0, x1, 12, z1, opts.box);
    if (opts.fire !== false) world.put(2, 10, 2, 'lava');
  }
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const clock = new GameClock(bus, NIGHT);
  const biome: BiomeKey = opts.biome ?? ('woodland' as BiomeKey);
  const survival = new Survival(world, player, clock, () => biome);
  survival.thermal = new Thermal(world, { isNight: () => true, biomeAt: () => biome }, bus);
  survival.hard = opts.hard;
  player.warmth = 60;
  const run = (s: number): void => {
    for (let i = Math.round(s / DT); i > 0; i--) {
      survival.thermal?.tick(DT);
      survival.tick(DT);
    }
  };
  return { survival, player, run };
}

describe('Survival with the thermal model', () => {
  it('a warm sealed room stops the night draining warmth, on normal and on hard', () => {
    for (const hard of [false, true]) {
      const r = rig({ box: 'insulated_wall', hard });
      r.run(5);
      expect(r.survival.temperatureC).toBeGreaterThanOrEqual(15);
      expect(r.player.warmth).toBeGreaterThan(60);
    }
  });

  it('a cold night outdoors costs extra warmth on hard and not on normal', () => {
    const normal = rig({ box: null, hard: false });
    const hard = rig({ box: null, hard: true });
    normal.run(20);
    hard.run(20);
    expect(normal.player.warmth).toBeCloseTo(60 - 0.3 * 20, 0);
    expect(hard.player.warmth).toBeLessThan(normal.player.warmth - 1);
  });

  it('a cold unheated room is no better than outdoors on hard (insulation only keeps heat that is there)', () => {
    const cold = rig({ box: 'insulated_wall', hard: true, fire: false });
    cold.run(10);
    expect(cold.survival.temperatureC!).toBeLessThan(5);
    expect(cold.player.warmth).toBeLessThan(60);
  });

  it('frostfell at night is freezing on hard: the cold names itself as frost', () => {
    const r = rig({ box: null, hard: true, biome: 'frostfell' as BiomeKey });
    r.run(5);
    expect(r.survival.temperatureC!).toBeLessThanOrEqual(-5);
    expect(r.survival.coldCause).toBe('frost');
    expect(r.player.warmth).toBeLessThan(MAX_WARMTH);
  });

  it('without a thermal model nothing changes (old harnesses)', () => {
    const bus = createBus();
    const world = new FakeWorld(bus);
    world.fill(-8, 9, -8, 8, 9, 8, 'stone');
    const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
    const survival = new Survival(world, player, new GameClock(bus, NIGHT), () => 'woodland' as BiomeKey);
    survival.hard = true;
    player.warmth = 60;
    for (let i = Math.round(10 / DT); i > 0; i--) survival.tick(DT);
    expect(player.warmth).toBeCloseTo(57, 5);
    expect(survival.temperatureC).toBeNull();
  });
});
