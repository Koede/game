import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { WORLD_HEIGHT } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game';
import { createIntent, type Intent } from '../player/input/intent';
import { OBJECTIVES } from '../core/registry';
import { CANISTER_S, CEILING, CLIMB, DRIFT_DOWN, MAX_FORWARD, TANK_S, createAirship, flyAirship, shipFromSnapshot, snapshotOfShip } from './airship';
import { AirshipManager, CHART_GOAL, FLAG_CHARTED_LANDS, FLAG_FLEW_AIRSHIP, wrapAirshipSource } from './airshipManager';
import { ARRIVE_R, SkyChart, compassOf, regionName, sightsAround, spotRadius } from './skyChart';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-30, 9, -120, 30, 9, 30, 'grass');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 8.5 });
  player.yaw = 0;
  player.pitch = 0;
  const flags: string[] = [];
  const toasts: string[] = [];
  bus.on('flag', (e) => flags.push(e.flag));
  bus.on('toast', (e) => toasts.push(e.text));
  const ships = new AirshipManager({ world, bus, player, biomeAt: (x) => (x < 0 ? 'frostfell' : 'woodland') });
  const hold = (item: string, count = 1): void => player.inventory.set(player.selectedSlot, { item, count });
  const count = (item: string): number => player.inventory.slots.reduce((a, s) => a + (s?.item === item ? s.count : 0), 0);
  const intent = (patch: Partial<Intent> = {}): Intent => Object.assign(createIntent(), patch);
  /** Runs `seconds` of frames with the same controls. */
  const run = (seconds: number, patch: Partial<Intent> = {}): void => {
    for (let t = 0; t < seconds; t += 0.05) ships.handle(intent(patch), 0.05);
  };
  return { bus, world, player, ships, flags, toasts, hold, count, intent, run };
}

describe('airship flight', () => {
  it('hovers where it is with fuel, climbs and sinks on the trim, and stops at the ceiling', () => {
    const r = rig();
    const s = createAirship(1, 0.5, 40, 0.5, 0, TANK_S);
    s.onGround = false;
    for (let i = 0; i < 40; i++) flyAirship(r.world, s, { throttle: 0, turn: 0, climb: 0 }, 0.05);
    expect(s.y).toBeCloseTo(40, 3);
    for (let i = 0; i < 60; i++) flyAirship(r.world, s, { throttle: 0, turn: 0, climb: 1 }, 0.05);
    expect(s.y).toBeGreaterThan(40 + CLIMB * 2);
    const high = s.y;
    for (let i = 0; i < 80; i++) flyAirship(r.world, s, { throttle: 0, turn: 0, climb: -1 }, 0.05);
    expect(s.y).toBeLessThan(high - 3);
    s.y = CEILING - 1;
    for (let i = 0; i < 100; i++) flyAirship(r.world, s, { throttle: 0, turn: 0, climb: 1 }, 0.05);
    expect(s.y).toBeLessThanOrEqual(CEILING + 1e-9);
    expect(s.fuel).toBeLessThan(TANK_S);
  });

  it('throttle pushes it along its heading up to top speed, the rudder turns it, and a hill stops it', () => {
    const r = rig();
    const s = createAirship(1, 0.5, 12, 0.5, 0, TANK_S);
    for (let i = 0; i < 100; i++) flyAirship(r.world, s, { throttle: 1, turn: 0, climb: 0 }, 0.05);
    expect(s.speed).toBeCloseTo(MAX_FORWARD, 1);
    expect(s.z).toBeLessThan(-20); // yaw 0 flies to -Z
    const yaw = s.yaw;
    for (let i = 0; i < 20; i++) flyAirship(r.world, s, { throttle: 1, turn: 1, climb: 0 }, 0.05);
    expect(s.yaw).toBeLessThan(yaw - 0.3); // right rudder turns right (negative yaw)
    // A wall of stone dead ahead.
    const w = createAirship(2, 0.5, 12, 20.5, 0, TANK_S);
    r.world.fill(-5, 10, 14, 5, 20, 14, 'stone');
    for (let i = 0; i < 60; i++) flyAirship(r.world, w, { throttle: 1, turn: 0, climb: 0 }, 0.05);
    expect(w.z - 1.3).toBeGreaterThanOrEqual(15 - 1e-6);
  });

  it('with an empty tank it can neither steer nor climb and sinks gently to the ground', () => {
    const r = rig();
    const s = createAirship(1, 0.5, 30, 0.5, 0, 0);
    s.onGround = false;
    for (let i = 0; i < 10; i++) flyAirship(r.world, s, { throttle: 1, turn: 1, climb: 1 }, 0.05);
    expect(s.speed).toBe(0);
    expect(s.yaw).toBe(0);
    expect(s.vy).toBeGreaterThanOrEqual(-DRIFT_DOWN - 1e-9);
    expect(s.vy).toBeLessThan(0);
    for (let i = 0; i < 400; i++) flyAirship(r.world, s, { throttle: 0, turn: 0, climb: 0 }, 0.05);
    expect(s.y).toBeCloseTo(10, 3);
    expect(s.onGround).toBe(true);
  });

  it('is saved and loaded, and damaged data is dropped', () => {
    const s = createAirship(3, 1.5, 70, -2.5, 0.4, 123);
    const back = shipFromSnapshot(JSON.parse(JSON.stringify(snapshotOfShip(s))))!;
    expect([back.id, back.x, back.y, back.z, back.yaw, back.fuel]).toEqual([3, 1.5, 70, -2.5, 0.4, 123]);
    expect(shipFromSnapshot({ id: 1, x: 'a' })).toBeNull();
    expect(shipFromSnapshot(null)).toBeNull();
    expect(shipFromSnapshot({ ...snapshotOfShip(s), fuel: 1e9 })!.fuel).toBe(TANK_S);
  });
});

describe('the sky chart', () => {
  it('sees further the higher the ship is, nothing from low down', () => {
    expect(spotRadius(30)).toBe(0);
    expect(spotRadius(60)).toBeGreaterThan(0);
    expect(spotRadius(100)).toBeGreaterThan(spotRadius(70));
    expect(spotRadius(WORLD_HEIGHT + 30)).toBeLessThanOrEqual(240);
  });

  it('spots structures, ruins and named regions from the seed alone, the same every time', () => {
    const biome = (x: number): 'woodland' | 'dunes' => (x < 0 ? 'dunes' : 'woodland');
    const a = sightsAround(12345, 0, 0, 240, biome);
    const b = sightsAround(12345, 0, 0, 240, biome);
    expect(a).toEqual(b);
    expect(a.some((e) => e.kind === 'region')).toBe(true);
    expect(a.length).toBeGreaterThan(3);
    for (const e of a) expect(Math.hypot(e.x, e.z)).toBeLessThanOrEqual(240);
    expect(sightsAround(12345, 0, 0, 0, biome)).toEqual([]);
    expect(regionName(1, 2, 3, 'marsh')).toMatch(/^the \w+ (Marsh|Fen|Mires|Reedlands)$/);
    expect(regionName(1, 2, 3, 'marsh')).toBe(regionName(1, 2, 3, 'marsh'));
  });

  it('keeps each sight once, reaches what the ship comes close to and moves the course on', () => {
    const c = new SkyChart();
    const sights = [
      { id: 'a', kind: 'landmark' as const, name: 'the A', x: 100, z: 0 },
      { id: 'b', kind: 'ruin' as const, name: 'the B', x: 300, z: 0 },
    ];
    expect(c.spot(sights).length).toBe(2);
    expect(c.spot(sights).length).toBe(0);
    expect(c.nextCourse(0, 0)?.id).toBe('a');
    expect(c.nextCourse(0, 0)?.id).toBe('b');
    expect(c.nextCourse(0, 0)?.id).toBe('a');
    expect(c.arrive(100 - ARRIVE_R + 1, 0).map((e) => e.id)).toEqual(['a']);
    expect(c.course).toBe('b');
    const back = new SkyChart();
    back.load(JSON.parse(JSON.stringify(c.toJSON())));
    expect(back.get('a')?.reached).toBe(true);
    expect(back.course).toBe('b');
    back.load({ entries: [{ id: 7 }], course: 'x' });
    expect(back.size).toBe(0);
  });

  it('names compass points with north at -Z', () => {
    expect(compassOf(0, -10)).toBe('N');
    expect(compassOf(10, 0)).toBe('E');
    expect(compassOf(0, 10)).toBe('S');
    expect(compassOf(-10, -10)).toBe('NW');
  });
});

describe('the airship manager', () => {
  it('moors a ship from the item on open ground, refuses where there is no room, refuels and packs it up', () => {
    const r = rig();
    r.hold('airship');
    r.player.pitch = -0.6;
    r.ships.handle(r.intent({ use: true }), 0.7);
    expect(r.ships.ships.size).toBe(1);
    expect(r.count('airship')).toBe(0);
    const s = [...r.ships.ships.values()][0];
    r.player.pitch = 0;
    r.player.position.z = s.z + 3.2;
    r.hold('fuel_canister', 2);
    r.ships.handle(r.intent({ use: true }), 0.7);
    expect(s.fuel).toBe(CANISTER_S);
    expect(r.count('fuel_canister')).toBe(1);
    r.player.inventory.set(r.player.selectedSlot, null);
    r.ships.handle(r.intent({ use: true, place: true }), 0.7);
    expect(r.ships.ships.size).toBe(0);
    expect(r.count('airship')).toBe(1);
    // A low roof: no room for the envelope.
    r.world.fill(-30, 13, -30, 30, 13, 30, 'stone');
    r.hold('airship');
    r.player.pitch = -0.6;
    r.player.position.z = 8.5;
    r.ships.handle(r.intent({ use: true }), 0.7);
    expect(r.ships.ships.size).toBe(0);
    expect(r.toasts.join(' ')).toMatch(/No room/);
  });

  it('boards, flies with the controls, will not let the pilot off in mid-air, and lets them off on the ground', () => {
    const r = rig();
    const s = r.ships.place(0.5, 10, 5.5, 0, TANK_S)!;
    r.ships.handle(r.intent({ use: true }), 0.05);
    expect(r.ships.flying).toBe(s);
    r.run(1); // the use cooldown runs out
    const z0 = s.z;
    r.run(4, { jump: true, moveZ: 1 });
    expect(s.y).toBeGreaterThan(16);
    expect(s.z).toBeLessThan(z0 - 5);
    // The player rides in the gondola, the controller gets nothing to walk with.
    expect(Math.abs(r.player.position.y - (s.y + 0.25))).toBeLessThan(1e-6);
    const out = r.ships.handle(r.intent({ use: true, moveZ: 1, jump: true }), 0.05);
    expect(out.moveZ).toBe(0);
    expect(out.jump).toBe(false);
    expect(r.ships.flying).toBe(s);
    expect(r.toasts.join(' ')).toMatch(/Too high to step off/);
    // Sink with Mine (the touch Down button) until near the ground, then step off.
    r.run(12, { mine: true });
    expect(s.y).toBeLessThan(11);
    r.ships.handle(r.intent({ use: true }), 0.05);
    expect(r.ships.flying).toBeNull();
    expect(r.player.position.y).toBeGreaterThanOrEqual(10);
    expect(r.player.position.y).toBeLessThan(11.5);
  });

  it('a stray tap on the world does not get the pilot off; dying does', () => {
    const r = rig();
    const s = r.ships.place(0.5, 10, 5.5, 0, TANK_S)!;
    r.ships.board(s);
    r.run(1);
    r.ships.handle(r.intent({ use: true, worldTap: true }), 0.05);
    expect(r.ships.flying).toBe(s);
    r.player.dead = true;
    r.ships.handle(r.intent(), 0.05);
    expect(r.ships.flying).toBeNull();
  });

  it('spots from high up: raises the flight flag, charts new places with a toast, and the chart flag at the goal', () => {
    const r = rig();
    const s = r.ships.place(0.5, 10, 5.5, 0, TANK_S)!;
    r.ships.board(s);
    s.y = 120;
    s.onGround = false;
    const fresh = r.ships.lookout(s);
    expect(r.flags).toContain(FLAG_FLEW_AIRSHIP);
    expect(fresh.length).toBeGreaterThan(0);
    expect(r.ships.chart.size).toBe(fresh.length);
    expect(r.toasts.some((t) => /Spotted|New region spotted/.test(t))).toBe(true);
    expect(r.ships.chart.courseEntry()).not.toBeNull();
    if (r.ships.chart.size >= CHART_GOAL) expect(r.flags).toContain(FLAG_CHARTED_LANDS);
    const st = r.ships.status()!;
    expect(st.charted).toBe(r.ships.chart.size);
    expect(st.course?.name).toBeTruthy();
    expect(st.canLand).toBe(false);
    // Low down nothing new is seen and no flight flag.
    const r2 = rig();
    const s2 = r2.ships.place(0.5, 10, 5.5, 0, TANK_S)!;
    r2.ships.lookout(s2);
    expect(r2.flags).not.toContain(FLAG_FLEW_AIRSHIP);
    expect(r2.ships.chart.size).toBe(0);
  });

  it('saves the ships and the chart with the world; a ship loaded aloft sinks back to the ground', () => {
    const r = rig();
    const s = r.ships.place(0.5, 10, 5.5, 0.3, 200)!;
    s.y = 20;
    r.ships.chart.spot([{ id: 'x', kind: 'region', name: 'the Grey Weald', x: 50, z: 50 }]);
    const r2 = rig();
    r2.ships.load(JSON.parse(JSON.stringify(r.ships.toJSON())));
    const back = [...r2.ships.ships.values()][0];
    expect(back.fuel).toBe(200);
    expect(r2.ships.chart.get('x')?.name).toBe('the Grey Weald');
    r2.run(8);
    expect(back.y).toBeCloseTo(10, 3);
    r2.ships.load(undefined);
    expect(r2.ships.ships.size).toBe(0);
  });

  it('leaves the input alone while another vehicle is busy, and wraps an intent source', () => {
    const bus = createBus();
    const world = new FakeWorld(bus);
    world.fill(-30, 9, -30, 30, 9, 30, 'grass');
    const player = new PlayerState(bus, { x: 0.5, y: 10, z: 8.5 });
    const ships = new AirshipManager({ world, bus, player, biomeAt: () => 'woodland', busy: () => true });
    ships.place(0.5, 10, 5.5, 0, TANK_S);
    const src = { frame: (_dt: number): Intent => Object.assign(createIntent(), { use: true }), name: 'src' };
    const wrapped = wrapAirshipSource(src, ships);
    expect(wrapped.frame(0.05).use).toBe(true);
    expect(ships.flying).toBeNull();
    expect(wrapped.name).toBe('src');
  });

  it('has its two goals in the Atomic Age, after superalloy', () => {
    const ids = OBJECTIVES.map((o) => o.id);
    const at = ids.indexOf('make_superalloy');
    expect(ids.slice(at + 1, at + 3)).toEqual(['fly_airship', 'chart_lands']);
    expect(OBJECTIVES.find((o) => o.id === 'fly_airship')!.condition).toEqual({ type: 'flag', flag: FLAG_FLEW_AIRSHIP });
    expect(OBJECTIVES.find((o) => o.id === 'chart_lands')!.condition).toEqual({ type: 'flag', flag: FLAG_CHARTED_LANDS });
  });
});
