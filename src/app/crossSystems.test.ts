/**
 * Bugs where systems cross: each test runs two merged systems against each other in a real GameState (or the
 * small rig the pair needs) and asserts the one rule that was broken. Pairs: winter x water (ponds, flow, pumps and
 * boilers, crops), winter x saves, winter x heat zones, storms/disasters x chunk streaming.
 */
import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { makeVoxel, voxelId } from '../core/types';
import { createBus } from '../core/context';
import { Disasters, type BoilerProbe, type FlueProbe } from '../game/disasters';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import { Thermal } from '../game/thermal';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { WATER_SOURCE, flowingWater, isWaterSource } from '../world/water';
import { SUNSET_AT } from '../core/constants';
import { CLOCK_TIMER_PRESETS } from '../workshop/clockTower';
import { TIMER_PRESETS } from '../workshop/signals';
import { GameState } from './state';

const WINTER = DAYS_PER_SEASON * 3 + 3;
const SPRING = DAYS_PER_SEASON * 4 + 2;
const ICE = blockId('ice');
const WATER = blockId('water');

/** A fresh world with the player's camp ground levelled for a pond at (+6, +6). */
function pondRig() {
  const s = GameState.create(5, null);
  const p = s.player.position;
  const x = Math.floor(p.x) + 6;
  const z = Math.floor(p.z) + 6;
  const y = s.world.surfaceY(x, z);
  const at = (dx: number, dz: number): readonly [number, number, number] => [x + dx, s.world.surfaceY(x + dx, z + dz), z + dz];
  const run = (day: number, ticks = 700): void => {
    s.clock.day = day;
    for (let i = 0; i < ticks; i++) s.tick();
  };
  const id = (c: readonly [number, number, number]): number => voxelId(s.world.getVoxel(...c));
  return { s, x, y, z, at, run, id };
}

describe('winter x water', () => {
  it('a one-deep pond that froze in winter thaws in spring (ground under it, not water)', () => {
    const r = pondRig();
    r.s.world.setVoxel(...r.at(0, 0), makeVoxel(WATER), 'player');
    r.run(WINTER);
    expect(r.id(r.at(0, 0))).toBe(ICE);
    r.run(SPRING);
    expect(r.id(r.at(0, 0))).toBe(WATER);
    r.s.dispose();
  });

  it('shallow ice stays tracked across a save, so it still thaws after loading', () => {
    const r = pondRig();
    r.s.world.setVoxel(...r.at(0, 0), makeVoxel(WATER), 'player');
    r.run(WINTER);
    expect(r.id(r.at(0, 0))).toBe(ICE);
    const copy = GameState.restore(JSON.parse(JSON.stringify(r.s.toSave())));
    copy.prepareAroundPlayer(1);
    copy.clock.day = SPRING;
    for (let i = 0; i < 700; i++) copy.tick();
    expect(voxelId(copy.world.getVoxel(...r.at(0, 0)))).toBe(WATER);
    copy.dispose();
    r.s.dispose();
  });

  it('flowing water does not freeze, so thawing can never turn a channel into a spring', () => {
    const r = pondRig();
    r.s.world.setVoxel(...r.at(0, 0), flowingWater(3), 'player');
    r.s.world.setVoxel(...r.at(1, 0), WATER_SOURCE, 'player');
    r.run(WINTER);
    expect(isWaterSource(r.s.world.getVoxel(...r.at(1, 0)))).toBe(false); // the still cell froze
    expect(r.id(r.at(1, 0))).toBe(ICE);
    const flowing = r.s.world.getVoxel(...r.at(0, 0));
    expect(voxelId(flowing)).not.toBe(ICE);
    r.s.dispose();
  });

  it('water that a pump, hand pump or boiler water port draws from stays open through winter', () => {
    const r = pondRig();
    const cells = [[0, 'pump'], [4, 'water_port'], [12, 'hand_pump']] as const;
    const spots = cells.map(([dx]) => r.at(dx, 0));
    const pond = r.at(8, 0); // a pond nobody draws from
    for (const w of [...spots, pond]) r.s.world.setVoxel(...w, makeVoxel(WATER), 'player');
    cells.forEach(([, key], i) => {
      const [x, y, z] = spots[i];
      r.s.world.setVoxel(x, y + 1, z, makeVoxel(blockId(key)), 'player');
    });
    r.run(WINTER);
    expect(spots.map((c) => r.id(c))).toEqual([WATER, WATER, WATER]);
    expect(r.id(pond)).toBe(ICE);
    r.s.dispose();
  });
});

describe('winter x heat zones', () => {
  it('water freezing and thawing does not empty the room cache every tick', () => {
    const bus = createBus();
    const world = new FakeWorld(bus);
    // A closed stone room (interior 1..5) with a pond cell outside it.
    world.fill(0, 0, 0, 6, 0, 6, 'stone');
    world.fill(0, 4, 0, 6, 4, 6, 'stone');
    world.fill(0, 1, 0, 6, 3, 0, 'stone');
    world.fill(0, 1, 6, 6, 3, 6, 'stone');
    world.fill(0, 1, 0, 0, 3, 6, 'stone');
    world.fill(6, 1, 0, 6, 3, 6, 'stone');
    world.put(3, 1, 3, 'lava');
    world.put(10, 1, 10, 'water');
    const thermal = new Thermal(world, { isNight: () => true, biomeAt: () => 'plains' as never }, bus);
    thermal.temperatureAt(2, 1, 2);
    const before = thermal.floods;
    expect(before).toBeGreaterThan(0);
    world.setVoxel(10, 1, 10, ICE, 'sim');
    world.setVoxel(10, 1, 10, WATER, 'sim');
    thermal.temperatureAt(2, 1, 2);
    expect(thermal.floods).toBe(before); // cache kept
    world.setVoxel(3, 2, 3, makeVoxel(blockId('stone')), 'player'); // a real change still clears it
    thermal.temperatureAt(2, 1, 2);
    expect(thermal.floods).toBeGreaterThan(before);
    thermal.dispose();
  });
});

describe('storms and disasters x chunk streaming', () => {
  it('a boiler or furnace in an unloaded chunk keeps its pressure and soot instead of resetting', () => {
    const bus = createBus();
    const world = new FakeWorld(bus);
    world.fill(-20, 5, -20, 20, 5, 20, 'grass');
    const player = new PlayerState(bus, { x: 15.5, y: 6, z: 15.5 });
    const boiler: BoilerProbe = { x: 0, y: 6, z: 0, loaded: true, fill: 1, tempC: 500, vent: (l) => l };
    const furnace: FlueProbe = { x: 0, y: 6, z: 5, lit: true, tempC: 500, burnItem: 'oak_log', loaded: true, extinguish() { this.lit = false; } };
    const d = new Disasters({
      world, bus, player, difficulty: () => 'normal', weather: () => ({ kind: 'clear', intensity: 0 }) as never, rng: () => 0,
      furnaces: () => [furnace], boilers: () => [boiler], cables: () => undefined, valveNear: () => false, burst: () => undefined,
    });
    for (let i = 0; i < 40; i++) d.tick(0.5);
    const p = d.pressureAt(0, 6, 0);
    const s = d.sootAt(0, 6, 5);
    expect(p).toBeGreaterThan(0);
    expect(s).toBeGreaterThan(0);
    boiler.loaded = false;
    furnace.loaded = false;
    for (let i = 0; i < 20; i++) d.tick(0.5);
    expect(d.pressureAt(0, 6, 0)).toBe(p);
    expect(d.sootAt(0, 6, 5)).toBe(s);
  });
});

describe('telegraph and radio x grid, storms', () => {
  /** A geothermal tap on lava feeding a cable run that ends beside a radio mast, on flat stone near the camp. */
  function mastRig() {
    const s = GameState.create(5, null);
    const p = s.player.position;
    const x0 = Math.floor(p.x) + 4;
    const z0 = Math.floor(p.z) + 4;
    const y = s.world.surfaceY(x0, z0) + 3;
    const put = (x: number, yy: number, z: number, key: string): void => void s.world.setVoxel(x, yy, z, makeVoxel(blockId(key)), 'player');
    for (let x = x0 - 1; x <= x0 + 8; x++) for (let z = z0 - 1; z <= z0 + 1; z++) put(x, y - 1, z, 'stone');
    put(x0, y - 1, z0, 'lava');
    put(x0, y, z0, 'geothermal_tap');
    for (let x = x0 + 1; x <= x0 + 4; x++) put(x, y, z0, 'copper_cable');
    put(x0 + 5, y, z0, 'radio_mast');
    return { s, x0, y, z0, put, mast: [x0 + 5, y, z0] as const, run: (n: number) => { for (let i = 0; i < n; i++) s.tick(); } };
  }

  it('a mast on a live grid is on air; a strike that cuts the cable takes it off, relaying it puts it back', () => {
    const r = mastRig();
    r.run(80);
    expect(r.s.telegraph.onAir(...r.mast)).toBe(true);
    r.s.world.setVoxel(r.x0 + 2, r.y, r.z0, 0, 'sim'); // what a lightning strike does
    r.run(80);
    expect(r.s.telegraph.onAir(...r.mast)).toBe(false);
    r.put(r.x0 + 2, r.y, r.z0, 'copper_cable');
    r.run(80);
    expect(r.s.telegraph.onAir(...r.mast)).toBe(true);
    r.s.dispose();
  });

  it('a storm-bell office hears a forced storm, and the warning names the cover-your-wiring advice once', () => {
    const r = mastRig();
    const [mx, my, mz] = r.mast;
    r.put(mx + 1, my, mz, 'telegraph_office');
    const toasts: string[] = [];
    r.s.bus.on('toast', (e) => toasts.push(e.text));
    r.run(40);
    expect(r.s.telegraph.busy(mx + 1, my, mz)).toBe(false);
    r.s.weather.force('storm', r.s.clock.worldTimeS, true);
    r.run(80);
    expect(r.s.telegraph.busy(mx + 1, my, mz)).toBe(true);
    expect(toasts.filter((t) => /Telegram: A storm is on us/.test(t))).toHaveLength(1);
    r.s.dispose();
  });
});

describe('clock tower x signal timers (real clock)', () => {
  it('a timer by a tower set to "by night" lights its lamp after sunset and darkens it at dawn, saved or not', () => {
    const s = GameState.create(5, null);
    const p = s.player.position;
    const x = Math.floor(p.x) + 4;
    const z = Math.floor(p.z) + 4;
    const y = s.world.surfaceY(x, z) + 1;
    const put = (dx: number, key: string): void => void s.world.setVoxel(x + dx, y, z, makeVoxel(blockId(key)), 'player');
    put(0, 'signal_timer');
    put(1, 'signal_lamp');
    put(2, 'clock_tower');
    s.clock.timeOfDay = 0.3;
    for (let i = 0; i < 20; i++) s.tick();
    const night = CLOCK_TIMER_PRESETS.findIndex((c) => c.key === 'night');
    for (let i = 0; i < TIMER_PRESETS.length + night; i++) s.workshop.use(x, y, z, null, () => undefined);
    for (let i = 0; i < 20; i++) s.tick();
    expect(s.workshop.describe(x + 1, y, z)).toContain('off');
    s.clock.timeOfDay = SUNSET_AT + 0.02;
    for (let i = 0; i < 20; i++) s.tick();
    expect(s.workshop.describe(x + 1, y, z)).toContain('on');
    const copy = GameState.restore(JSON.parse(JSON.stringify(s.toSave())));
    copy.prepareAroundPlayer(1);
    for (let i = 0; i < 20; i++) copy.tick();
    expect(copy.workshop.describe(x + 1, y, z)).toContain('on');
    copy.dispose();
    s.clock.timeOfDay = 0.3; // dawn has come
    for (let i = 0; i < 20; i++) s.tick();
    expect(s.workshop.describe(x + 1, y, z)).toContain('off');
    s.dispose();
  });
});
