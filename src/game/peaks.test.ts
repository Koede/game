import { describe, expect, it } from 'vitest';
import { DT, WARMTH_DRAIN_WATER } from '../core/constants';
import { createBus } from '../core/context';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { PEAK_DRAIN, PEAK_FULL_Y, PEAK_START_Y, peakDrain } from './peaks';
import { PlayerState } from './playerState';
import { Survival } from './survival';

function rig(y: number, timeOfDay = 0.3) {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, y - 1, -8, 8, y - 1, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y, z: 0.5 });
  const clock = new GameClock(bus, timeOfDay);
  clock.day = 3;
  const survival = new Survival(world, player, clock, () => 'woodland');
  const run = (s: number): void => { for (let i = Math.round(s / DT); i > 0; i--) survival.tick(DT); };
  return { world, player, survival, run };
}

describe('cold peaks', () => {
  it('drains nothing below the start, ramps up smoothly and caps', () => {
    expect(peakDrain(PEAK_START_Y)).toBe(0);
    expect(peakDrain(PEAK_START_Y + 1)).toBeGreaterThan(0);
    expect(peakDrain((PEAK_START_Y + PEAK_FULL_Y) / 2)).toBeCloseTo(PEAK_DRAIN / 2);
    expect(peakDrain(200)).toBe(PEAK_DRAIN);
  });

  it('chills a climber by day and names the frost', () => {
    const low = rig(20);
    low.run(10);
    expect(low.player.warmth).toBe(100);
    const high = rig(PEAK_FULL_Y + 2);
    high.run(10);
    expect(high.player.warmth).toBeCloseTo(100 - PEAK_DRAIN * 10, 1);
    expect(high.survival.coldCause).toBe('frost');
  });
});

describe('hot springs warm the bather', () => {
  it('cold water drains, but water beside a steam vent warms', () => {
    const cold = rig(20);
    cold.player.inWater = true;
    cold.run(5);
    expect(cold.survival.warmthRate).toBeCloseTo(-WARMTH_DRAIN_WATER);
    const spring = rig(20);
    spring.world.put(2, 19, 0, 'steam_vent', false);
    spring.player.inWater = true;
    spring.run(5);
    expect(spring.survival.warmthRate).toBeGreaterThan(0);
  });
});
