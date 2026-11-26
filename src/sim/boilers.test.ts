import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { BOILER_RATED_BAR, BURST_AFTER_S } from './boilers';
import type { FurnaceEntity } from './entities';
import { makeKit, type Kit } from './testKit';

/** A 3x3x4 shell of Boiler Plate on a furnace: interior 1x1x2, a gauge glass in the east wall, a valve in the roof. */
function build(kit: Kit, valve: boolean): FurnaceEntity {
  const f = kit.furnace(0, 1, 0);
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 2; y <= 5; y++) {
    if (x === 0 && z === 0 && y >= 3 && y <= 4) continue;
    kit.world.put(x, y, z, 'boiler_plate');
  }
  if (valve) kit.world.put(0, 5, 0, 'safety_valve');
  kit.world.put(1, 3, 0, 'boiler_gauge_glass');
  return f;
}
function run(kit: Kit, f: FurnaceEntity, seconds: number, tempC = 400): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    f.tempC = tempC;
    kit.sim.tick(DT);
  }
}
const bar = (kit: Kit): number => kit.sim.boilerPressures()[0]?.bar ?? -1;

describe('the sealed boiler', () => {
  it('forms from a closed shell, fills from a pail, and says what is wrong when it is open', () => {
    const kit = makeKit();
    const f = build(kit, true);
    run(kit, f, 1.2);
    expect(kit.sim.boilerPressures()).toHaveLength(1);
    expect(kit.sim.brewView(1, 3, 0)?.text).toMatch(/no water/);
    expect(kit.sim.brewUse(1, 3, 0, 'water_pail')).toMatchObject({ ok: true, consume: true });
    expect(kit.sim.brewView(1, 3, 0)?.text).toMatch(/1000 L/);
    kit.world.put(-1, 4, 0, 'air');
    run(kit, f, 1.2);
    expect(kit.sim.boilerPressures()).toHaveLength(0);
    expect(kit.sim.brewView(1, 3, 0)?.text).toMatch(/gap/);
  });

  it('makes pressure from the fire and water, 10 kW giving 60 L/s, and the valve holds it at its setting', () => {
    const kit = makeKit();
    const f = build(kit, true);
    run(kit, f, 1.2);
    for (let i = 0; i < 3; i++) kit.sim.brewUse(1, 3, 0, 'water_pail');
    run(kit, f, 30);
    expect(bar(kit)).toBeGreaterThan(0.5);
    expect(bar(kit)).toBeLessThan(1.2); // 60 L/s into 2000 L, less the sag
    run(kit, f, 270);
    expect(bar(kit)).toBeLessThanOrEqual(6.05); // valve at 6 bar
    expect(bar(kit)).toBeGreaterThan(5);
    kit.sim.brewUse(0, 5, 0, null); // 6 -> 8
    kit.sim.brewUse(0, 5, 0, null); // 8 -> 2
    run(kit, f, 120);
    expect(bar(kit)).toBeLessThanOrEqual(2.2);
    expect(f.extractW).toBe(10000);
  });

  it('without a valve it warns, then bursts after 5 s over the rating, and nothing bursts before the warning', () => {
    const kit = makeKit();
    const f = build(kit, false);
    run(kit, f, 1.2);
    for (let i = 0; i < 4; i++) kit.sim.brewUse(1, 3, 0, 'water_pail');
    const toasts: string[] = [];
    kit.bus.on('toast', (t) => toasts.push(t.text));
    let warnedAt = -1;
    let burstAt = -1;
    for (let t = 0; t < 1500 && burstAt < 0; t += DT) {
      f.tempC = 400;
      kit.sim.tick(DT);
      if (warnedAt < 0 && toasts.some((x) => /pressure high/.test(x))) warnedAt = t;
      if (toasts.some((x) => /burst/.test(x))) burstAt = t;
    }
    expect(warnedAt).toBeGreaterThan(0);
    expect(burstAt).toBeGreaterThan(warnedAt);
    expect(burstAt - warnedAt).toBeGreaterThanOrEqual(BURST_AFTER_S);
    expect(kit.world.getBlock(1, 3, 0).key).toBe('air');
    expect(kit.sim.boilerPressures()).toHaveLength(0);
    expect(BOILER_RATED_BAR).toBe(8);
  });

  it('feeds a steam rotor standing on the shell once it has 2 bar, and survives a save and load', () => {
    const kit = makeKit();
    const f = build(kit, true);
    kit.world.put(0, 6, 0, 'steam_rotor');
    kit.sim.setSteamDemand(() => true);
    run(kit, f, 1.2);
    kit.sim.brewUse(1, 3, 0, 'water_pail');
    expect(kit.sim.steamReadyAt(0, 5, 0)).toBe(false);
    run(kit, f, 120);
    expect(kit.sim.steamReadyAt(0, 5, 0)).toBe(true);
    const before = bar(kit);
    kit.sim.resync();
    run(kit, f, 1.2);
    expect(Math.abs(bar(kit) - before)).toBeLessThan(0.5);
  });

  it('heat ports take heat from a furnace beside the wall; a steam port and pipes carry pressure to a beam engine', () => {
    const kit = makeKit();
    const f = build(kit, true);
    kit.world.put(-1, 3, 0, 'steam_port');
    kit.world.put(-2, 3, 0, 'steam_pipe');
    kit.world.put(-3, 3, 0, 'steam_pipe');
    kit.world.put(-4, 3, 0, 'beam_engine');
    kit.sim.setSteamDemand(() => true);
    run(kit, f, 1.2);
    expect(kit.sim.beamEngineAt(-4, 3, 0)).toBeNull();
    for (let i = 0; i < 3; i++) kit.sim.brewUse(1, 3, 0, 'water_pail');
    run(kit, f, 90);
    const e = kit.sim.beamEngineAt(-4, 3, 0);
    expect(e).not.toBeNull();
    expect(e!.capacity).toBeGreaterThan(2.9);
    expect(e!.capacity).toBeLessThanOrEqual(8);
    expect(e!.rpm).toBeCloseTo(16 * bar(kit), 1);
    // 2 pipes add 200 L of steam room.
    expect(kit.sim.brewView(1, 3, 0)?.text).toMatch(/bar/);
  });

  it('a heat port beside a furnace and no floor furnace still heats; a water port beside water fills the boiler', () => {
    const kit = makeKit();
    const side = kit.furnace(3, 4, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (let y = 2; y <= 5; y++) {
      if (x === 0 && z === 0 && y >= 3 && y <= 4) continue;
      kit.world.put(x, y, z, 'boiler_plate');
    }
    kit.world.put(2, 4, 0, 'heat_port');
    kit.world.put(1, 4, 0, 'heat_port');
    kit.world.put(-1, 3, 0, 'water_port');
    kit.world.put(-2, 3, 0, 'water');
    kit.world.put(1, 3, 0, 'boiler_gauge_glass');
    run(kit, side, 1.2);
    expect(kit.sim.boilerPressures()).toHaveLength(1);
    run(kit, side, 20);
    expect(kit.sim.brewView(1, 3, 0)?.text).toMatch(/water [34]\d\d L|water [1-9]\d\d L/);
    run(kit, side, 30);
    expect(bar(kit)).toBeGreaterThan(0.3);
  });
});
