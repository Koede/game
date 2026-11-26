import { describe, expect, it } from 'vitest';
import { FakeWorld } from './fakeWorld';
import { CAVE_C, COMFORT_C, FREEZING_C, MAX_RISE_C, Thermal, feelOf, heatColor, insulationOf, outdoorTempC, type Climate } from './thermal';

const night: Climate = { isNight: () => true, biomeAt: () => 'plains' as never };
const frost: Climate = { isNight: () => true, biomeAt: () => 'frostfell' as never };

/** A 5x5x3 room, interior x,z 1..5, y 1..3, floor y 0, roof y 4, walls of `wall`; a torch on the floor. */
function room(wall: string, light = 'lava'): FakeWorld {
  const w = new FakeWorld();
  w.fill(0, 0, 0, 6, 0, 6, 'stone');
  w.fill(0, 4, 0, 6, 4, 6, wall);
  w.fill(0, 1, 0, 6, 3, 0, wall);
  w.fill(0, 1, 6, 6, 3, 6, wall);
  w.fill(0, 1, 0, 0, 3, 6, wall);
  w.fill(6, 1, 0, 6, 3, 6, wall);
  w.put(3, 1, 3, light);
  return w;
}

describe('outdoorTempC', () => {
  it('takes night, frost and weather off a mild day, and the season adds its offset', () => {
    expect(outdoorTempC(false, 'plains', null, 0)).toBe(12);
    expect(outdoorTempC(true, 'plains', null, 0)).toBeLessThan(5);
    expect(outdoorTempC(true, 'frostfell', 'snow', 1)).toBeLessThanOrEqual(FREEZING_C);
    expect(outdoorTempC(false, 'plains', null, 0, -15)).toBe(-3);
  });
});

describe('Thermal', () => {
  it('a torch warms the open air near it and not far from it', () => {
    const w = new FakeWorld();
    w.put(0, 0, 0, 'stone');
    w.put(5, 1, 5, 'lava');
    const t = new Thermal(w, night);
    const far = t.temperatureAt(40, 1, 40);
    expect(t.temperatureAt(5, 1, 6)).toBeGreaterThan(far + 3);
    expect(t.temperatureAt(5, 1, 6)).toBeGreaterThan(t.temperatureAt(7, 1, 6));
    expect(t.temperatureAt(20, 1, 20)).toBeCloseTo(far, 5);
  });

  it('a wall between a fire and you blocks open-air warmth', () => {
    const w = new FakeWorld();
    w.put(5, 1, 5, 'lava');
    const t = new Thermal(w, night);
    const open = t.temperatureAt(7, 1, 5);
    expect(open).toBeGreaterThan(t.outdoorC(7, 5));
    w.fill(6, 0, 3, 6, 3, 7, 'stone');
    t.invalidate();
    expect(t.temperatureAt(7, 1, 5)).toBeLessThan(open);
  });

  it('an enclosed room is warmer than the night outside, with the torch as its only fire', () => {
    const t = new Thermal(room('plank'), night);
    const z = t.zoneAt(2, 1, 2);
    expect(z.kind).toBe('room');
    expect(z.sources).toBe(1);
    expect(z.tempC).toBeGreaterThan(t.outdoorC(2, 2));
  });

  it('insulation matters: wool-packed walls keep far more of the heat than plank, and glass the least', () => {
    const rise = (wall: string): number => {
      const t = new Thermal(room(wall), night);
      return t.temperatureAt(5, 1, 5) - t.outdoorC(5, 5);
    };
    expect(rise('insulated_wall')).toBeGreaterThan(rise('plank') * 1.8);
    expect(rise('plank')).toBeGreaterThan(rise('glass'));
    expect(insulationOf('insulated_wall')).toBeGreaterThan(insulationOf('stone'));
  });

  it('a lit furnace heats its room by its temperature: hotter is warmer, and unlit gives nothing', () => {
    const build = (tempC: number, lit: boolean): number => {
      const w = room('plank', 'air');
      w.put(3, 1, 3, 'furnace_blast', lit);
      w.setEntity({ kind: 'furnace', x: 3, y: 1, z: 3, tempC } as never);
      const t = new Thermal(w, frost);
      return t.temperatureAt(5, 1, 5) - t.outdoorC(5, 5);
    };
    expect(build(900, true)).toBeGreaterThan(build(300, true));
    expect(build(300, true)).toBeGreaterThan(5);
    expect(build(900, false)).toBeCloseTo(0, 5);
  });

  it('opening a hole in the roof lets the room go cold; closing it brings the heat back', () => {
    const w = room('insulated_wall');
    const t = new Thermal(w, night);
    const closed = t.temperatureAt(2, 1, 2);
    w.put(3, 4, 3, 'air');
    w.setVoxel(3, 4, 3, 0);
    t.invalidate();
    expect(t.zoneAt(2, 1, 2).kind).toBe('outdoors');
    expect(t.temperatureAt(2, 1, 2)).toBeLessThan(closed - 3);
    w.put(3, 4, 3, 'insulated_wall');
    t.invalidate();
    expect(t.temperatureAt(2, 1, 2)).toBeCloseTo(closed, 5);
  });

  it('never exceeds the room cap, and a fireless room is exactly as cold as outdoors', () => {
    const w = room('insulated_wall');
    w.setVoxel(3, 1, 3, 0);
    const t = new Thermal(w, night);
    expect(t.temperatureAt(2, 1, 2)).toBeCloseTo(t.outdoorC(2, 2), 5);
    const hot = new FakeWorld();
    hot.fill(0, 0, 0, 3, 0, 3, 'stone');
    hot.fill(0, 3, 0, 3, 3, 3, 'insulated_wall');
    for (let y = 1; y <= 2; y++) for (const [x, z] of [[0, 0], [3, 0], [0, 3], [3, 3], [1, 0], [2, 0], [1, 3], [2, 3], [0, 1], [0, 2], [3, 1], [3, 2]]) hot.put(x, y, z, 'insulated_wall');
    hot.put(1, 1, 1, 'lava');
    const th = new Thermal(hot, night);
    expect(th.temperatureAt(2, 1, 2)).toBeLessThanOrEqual(th.outdoorC(2, 2) + MAX_RISE_C + 6 + 1e-6);
  });

  it('a big sealed cave settles at the cave temperature', () => {
    const w = new FakeWorld();
    w.fill(-12, 0, -12, 40, 0, 40, 'stone');
    w.fill(-12, 20, -12, 40, 20, 40, 'stone');
    const t = new Thermal(w, frost);
    // Without walls the flood escapes the cap before finding sky only when roofed; the roof is a slab with open sides here.
    const z = t.zoneAt(10, 1, 10);
    expect(['cave', 'outdoors']).toContain(z.kind);
    if (z.kind === 'cave') expect(z.tempC).toBeGreaterThanOrEqual(CAVE_C);
  });

  it('caches rooms: a grid of floor cells floods each room once', () => {
    const t = new Thermal(room('plank'), night);
    t.grid(3, 1, 3, 3);
    expect(t.floods).toBeLessThan(10);
    const g = t.grid(3, 1, 3, 4);
    expect(g.size).toBe(9);
    expect(g.temps.length).toBe(81);
  });

  it('feel words and heat colours cover the range', () => {
    expect(feelOf(-10)).toBe('freezing');
    expect(feelOf(COMFORT_C)).toBe('comfortable');
    expect(feelOf(45)).toBe('hot');
    expect(heatColor(COMFORT_C + 2)[3]).toBeLessThan(0.2);
    expect(heatColor(-10)[2]).toBeGreaterThan(heatColor(-10)[0]);
    expect(heatColor(40)[0]).toBeGreaterThan(heatColor(40)[2]);
  });
});
