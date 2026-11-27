/** The daily routine of the animals: home, sleep at night, shelter in storms and winter, herding, old saves. */
import { describe, expect, it } from 'vitest';
import { DT, SUNSET_AT } from '../core/constants';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { MobManager } from './manager';
import { restoreMobs, saveMobs } from './persistence';
import { routinePhase, wantNow, type MobSky } from './routine';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { Mob, MobPlayer } from './types';

const NIGHT = SUNSET_AT + 0.1;
const CLEAR: MobSky = { storm: false, winter: false };

function setup(time = 0.3, sky: MobSky = CLEAR) {
  const world = new FlatWorld(10, 1234);
  const clock = new TestClock(time);
  const mobs = new MobManager(world, createBus(), clock, 99, { naturalSpawning: false, biomeAt: () => 'woodland', spawn: null });
  const state = { ...sky };
  mobs.skyFn = (out) => Object.assign(out, state);
  return { world, clock, mobs, sky: state };
}
const add = (mobs: MobManager, species: string, x: number, z: number, baby = false): Mob => mobs.add(creature(species), { x, y: 11, z, yaw: 0 }, baby);
function run(mobs: MobManager, player: MobPlayer, seconds: number): void {
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) mobs.tick(DT, player);
}
const far = testPlayer(80, 11, 80);
const dist = (m: Mob, x: number, z: number): number => Math.hypot(m.x - x, m.z - z);

describe('phases and wants', () => {
  it('cuts the day like the game clock', () => {
    expect(routinePhase(0.01)).toBe('dawn');
    expect(routinePhase(0.3)).toBe('day');
    expect(routinePhase(SUNSET_AT - 0.01)).toBe('dusk');
    expect(routinePhase(NIGHT)).toBe('night');
  });
  it('shelters in storms and winter nights, sleeps otherwise at night', () => {
    expect(wantNow('day', CLEAR)).toBe('free');
    expect(wantNow('dusk', CLEAR)).toBe('gather');
    expect(wantNow('night', CLEAR)).toBe('sleep');
    expect(wantNow('day', { storm: true, winter: false })).toBe('shelter');
    expect(wantNow('night', { storm: false, winter: true })).toBe('shelter');
    expect(wantNow('day', { storm: false, winter: true })).toBe('free');
  });
});

describe('home and sleep', () => {
  it('keeps within range of home by day', () => {
    const { mobs } = setup();
    const m = add(mobs, 'goat', 0.5, 0.5);
    m.homeX = 0.5;
    m.homeZ = 0.5;
    for (let i = 0; i < 12; i++) {
      run(mobs, far, 20);
      expect(dist(m, 0.5, 0.5)).toBeLessThan(26);
    }
  });
  it('walks home and sleeps there at night, and wakes at dawn', () => {
    const { mobs, clock } = setup(NIGHT);
    const m = add(mobs, 'goat', 10.5, 0.5);
    m.homeX = 0.5;
    m.homeZ = 0.5;
    run(mobs, far, 40);
    expect(m.state).toBe('sleep');
    expect(dist(m, 0.5, 0.5)).toBeLessThan(4);
    expect(Math.hypot(m.vx, m.vz)).toBeLessThan(0.05);
    clock.timeOfDay = 0.2;
    run(mobs, far, 8);
    expect(m.state).not.toBe('sleep');
  });
  it('wakes when the player comes close, and can still be milked and sheared asleep', () => {
    const { mobs } = setup(NIGHT);
    const m = add(mobs, 'goat', 0.5, 0.5);
    run(mobs, far, 10);
    expect(m.state).toBe('sleep');
    expect(mobs.harvest(m.id, 'milk').ok).toBe(true);
    expect(m.state).toBe('idle');
    expect(mobs.harvest(m.id, 'wool').ok).toBe(true);
    run(mobs, far, 10);
    expect(m.state).toBe('sleep');
    run(mobs, testPlayer(1.5, 11, 0.5), 2);
    expect(m.state).not.toBe('sleep');
  });
  it('feeding moves the home to the yard', () => {
    const { mobs } = setup();
    const m = add(mobs, 'goat', 5.5, 5.5);
    expect(mobs.feed(m.id, 'wheat').ok).toBe(true);
    expect([m.homeX, m.homeZ]).toEqual([m.x, m.z]);
  });
});

describe('shelter', () => {
  function shed(world: FlatWorld): void {
    // A roof on four posts at x 12..14, z 0..2.
    world.fill(12, 11, 0, 14, 14, 2, 'air');
    for (const [x, z] of [[12, 0], [14, 0], [12, 2], [14, 2]]) world.fill(x, 11, z, x, 13, z, 'stone');
    world.fill(12, 14, 0, 14, 14, 2, 'stone');
  }
  it('goes under a roof in a storm and comes out when it passes', () => {
    const { mobs, world, sky } = setup(0.3, { storm: true, winter: false });
    shed(world);
    const m = add(mobs, 'goat', 4.5, 1.5);
    run(mobs, far, 30);
    expect(m.state).toBe('shelter');
    expect(m.x).toBeGreaterThan(11.9);
    expect(m.x).toBeLessThan(15);
    sky.storm = false;
    run(mobs, far, 5);
    expect(m.state).not.toBe('shelter');
  });
  it('ignores the weather when there is no roof within reach', () => {
    const { mobs } = setup(0.3, { storm: true, winter: false });
    const m = add(mobs, 'goat', 4.5, 1.5);
    run(mobs, far, 20);
    expect(m.state).not.toBe('shelter');
  });
  it('shelters in winter nights rather than sleeping in the open', () => {
    const { mobs, world } = setup(NIGHT, { storm: false, winter: true });
    shed(world);
    const m = add(mobs, 'goat', 4.5, 1.5);
    run(mobs, far, 30);
    expect(m.state).toBe('shelter');
  });
});

describe('herding and saves', () => {
  it('a grown animal far from its herd rejoins it', () => {
    const { mobs } = setup();
    const a = add(mobs, 'goat', 0.5, 0.5);
    const b = add(mobs, 'goat', 1.5, 0.5);
    const c = add(mobs, 'goat', 14.5, 0.5);
    for (const m of [a, b, c]) {
      m.homeX = 7.5;
      m.homeZ = 0.5;
    }
    run(mobs, far, 60);
    expect(dist(c, a.x, a.z)).toBeLessThan(14);
  });
  it('saves home points; an old save places an animal at its position', () => {
    const { mobs } = setup();
    const m = add(mobs, 'goat', 3.5, 4.5);
    m.homeX = 7;
    m.homeZ = 8;
    const snap = JSON.parse(JSON.stringify(saveMobs(mobs.all, 5, (mobs as unknown as { spawner: never }).spawner)));
    expect(restoreMobs(snap, Math.random).mobs[0].homeX).toBe(7);
    delete snap.mobs[0].hx;
    delete snap.mobs[0].hz;
    const old = restoreMobs(snap, Math.random).mobs[0];
    expect([old.homeX, old.homeZ]).toEqual([3.5, 4.5]);
  });
});
