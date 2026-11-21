import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { GameClock } from '../game/clock';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
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
});
