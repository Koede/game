import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { WeatherState } from '../core/types';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';
import { RAIN_FILL_S, Weathering } from './weathering';

function rig(precipitation: WeatherState['precipitation'], intensity: number, roof = false) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-2, 5, -2, 2, 5, 2, 'grass');
  if (roof) world.fill(-2, 14, -2, 2, 14, 2, 'plank');
  const player = new PlayerState(bus, { x: 0.5, y: 6, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  let day = 1;
  const w = { precipitation, intensity } as WeatherState;
  const wt = new Weathering({ world, bus, player, day: () => day, weather: () => w });
  return { player, toasts, wt, setDay: (d: number) => { day = d; } };
}

describe('weathering', () => {
  it('fills a held bucket after steady rain in the open', () => {
    const r = rig('rain', 0.8);
    r.player.inventory.set(r.player.selectedSlot, { item: 'pail', count: 2 });
    for (let i = 0; i < RAIN_FILL_S + 1; i++) r.wt.tick(1);
    expect(r.player.inventory.count('water_pail')).toBe(1);
    expect(r.player.inventory.count('pail')).toBe(1);
    expect(r.toasts.at(-1)).toMatch(/filled your bucket/);
  });

  it('does not fill under a roof, in snow, or in a drizzle', () => {
    for (const r of [rig('rain', 0.8, true), rig('snow', 0.8), rig('rain', 0.1)]) {
      r.player.inventory.set(r.player.selectedSlot, { item: 'pail', count: 1 });
      for (let i = 0; i < 60; i++) r.wt.tick(1);
      expect(r.player.inventory.count('water_pail')).toBe(0);
    }
  });

  it('announces a new season once and labels the day', () => {
    const r = rig('none', 0);
    r.wt.tick(1);
    expect(r.toasts).toHaveLength(0);
    r.setDay(DAYS_PER_SEASON + 1);
    r.wt.tick(1);
    r.wt.tick(1);
    expect(r.toasts).toHaveLength(1);
    expect(r.toasts[0]).toMatch(/^Summer/);
    expect(r.wt.label()).toBe('Day 1 of Summer');
  });
});
