import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { GameClock } from '../game/clock';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import { createWeatherState } from '../game/weather';
import { AmbienceProbe, furnaceHeatLevel, FURNACE_HEARING } from './ambience';

function setup() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-20, 0, -20, 20, 39, 20, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 40, z: 0.5 });
  const clock = new GameClock(bus);
  return { bus, world, player, clock, probe: new AmbienceProbe(world, player, clock) };
}

const furnace = (x: number, y: number, z: number, tempC: number, lit: boolean) => ({
  kind: 'furnace', x, y, z, tier: 1, tempC, lit, draft: 0, ignited: false, electric: true, deliveredW: 0, ignition: 'idle', ignitionProgressS: 0,
});

describe('AmbienceProbe', () => {
  it('is silent by a cold, unlit furnace and roars by a hot one', () => {
    expect(furnaceHeatLevel(20, false, false)).toBe(0);
    expect(furnaceHeatLevel(20, true, false)).toBeGreaterThan(0);
    expect(furnaceHeatLevel(800, true, false)).toBeGreaterThan(furnaceHeatLevel(300, true, false));
    expect(furnaceHeatLevel(100, false, true)).toBe(1);
  });

  it('follows the nearest furnace that makes a sound', () => {
    const { world, probe } = setup();
    world.setEntity(furnace(3, 40, 0, 20, false));
    world.setEntity(furnace(8, 40, 0, 900, true));
    const s = probe.update(0.016);
    expect(s.furnaceHeat).toBeCloseTo(furnaceHeatLevel(900, true, false), 6);
    expect(s.furnaceDistance).toBeGreaterThan(7);
    expect(s.furnaceDistance).toBeLessThan(9);
  });

  it('hears nothing beyond the hearing range', () => {
    const { world, probe } = setup();
    world.setEntity(furnace(FURNACE_HEARING + 5, 40, 0, 900, true));
    expect(probe.update(0.016).furnaceHeat).toBe(0);
  });

  it('hums for running machines only', () => {
    const { world, probe } = setup();
    world.put(4, 40, 0, 'crusher', true);
    world.setEntity({ kind: 'crusher', x: 4, y: 40, z: 0, on: true });
    expect(probe.update(0.016).machineHum).toBeGreaterThan(0);
    world.setVoxel(4, 40, 0, makeVoxel(blockId('crusher')));
    probe.invalidate();
    expect(probe.update(0.016).machineHum).toBe(0);
  });

  it('reports wind by altitude and shelter, night, water and cold', () => {
    const { world, player, clock, probe } = setup();
    let s = probe.update(0.016);
    const lowWind = s.wind;
    player.position.y = 80;
    probe.invalidate();
    const highWind = probe.update(0.016).wind;
    expect(highWind).toBeGreaterThan(lowWind);
    world.fill(-1, 90, -1, 1, 90, 1, 'stone');
    probe.invalidate();
    expect(probe.update(0.016).wind).toBeLessThan(highWind);
    clock.setTimeOfDay(0.8);
    player.headInWater = true;
    player.warmth = 10;
    s = probe.update(0.016);
    expect(s.night).toBe(true);
    expect(s.underwater).toBe(true);
    expect(s.cold).toBeCloseTo(0.8, 6);
  });

  it('feeds the rain bed, storm gusts and the roof from the weather', () => {
    const { world, player, clock } = setup();
    const w = createWeatherState();
    const probe = new AmbienceProbe(world, player, clock, w);
    Object.assign(w, { kind: 'rain', previous: 'rain', blend: 1, precipitation: 'rain', intensity: 0.6 });
    let s = probe.update(0.016);
    expect(s.rain).toBeCloseTo(0.6);
    expect(s.storm).toBe(0);
    expect(s.sheltered).toBe(false);
    Object.assign(w, { kind: 'storm', previous: 'rain', blend: 0.5, intensity: 0.8 });
    s = probe.update(0.016);
    expect(s.storm).toBeCloseTo(0.5);
    Object.assign(w, { kind: 'storm', previous: 'storm', blend: 1, precipitation: 'snow', intensity: 1 });
    s = probe.update(0.016);
    expect(s.rain).toBe(0);
    expect(s.storm).toBe(1);
    Object.assign(w, { kind: 'rain', previous: 'rain', precipitation: 'dust', intensity: 0.6 });
    expect(probe.update(0.016).storm).toBeCloseTo(0.6);
    world.fill(-3, 45, -3, 3, 45, 3, 'plank');
    probe.invalidate();
    expect(probe.update(0.016).sheltered).toBe(true);
  });

  it('hears turning workshop parts, louder when nearer, and nothing when none turn', () => {
    const { bus, world, player, clock } = setup();
    let parts: Array<[number, number]> = [];
    const workshop = {
      turningNear: (px: number, pz: number, radius: number, weight: number) =>
        parts.reduce((sum, [x, z]) => sum + Math.max(0, weight * (1 - Math.hypot(x - px, z - pz) / radius)), 0),
    };
    const probe = new AmbienceProbe(world, player, clock, null, workshop);
    expect(probe.update(0.016).turning).toBe(0);
    parts = [[10, 0]];
    probe.invalidate();
    const far = probe.update(0.016).turning;
    parts = [[2, 0]];
    probe.invalidate();
    const near = probe.update(0.016).turning;
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    void bus;
  });
});
