import { describe, expect, it } from 'vitest';
import {
  DT,
  MOB_CHUNK_SPAWN_CHANCE,
  MOB_KEEPALIVE_AFTER_S,
  MOB_KEEPALIVE_MIN_DISTANCE,
  MOB_LOADED_CAP,
  MOB_SPAWN_GUARANTEE_RADIUS,
} from '../core/constants';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { CHUNK_SIZE, type BiomeKey } from '../core/types';
import { World } from '../world';
import { MobManager } from './manager';
import { rollChunk } from './spawning';
import { KEEPALIVE_VIEW_HALF_ANGLE } from './spawner';
import { FlatWorld, TestClock, testPlayer } from './testKit';

const signature = (mobs: MobManager): string[] =>
  mobs.all.map((m) => `${m.spec.key}@${m.x.toFixed(2)},${m.y.toFixed(2)},${m.z.toFixed(2)}`).sort();

describe('first-load chunk rolls', () => {
  it('roll about MOB_CHUNK_SPAWN_CHANCE of the columns, with whole groups of a species of the biome', () => {
    const world = new FlatWorld();
    let groups = 0;
    let animals = 0;
    for (let cz = -20; cz < 20; cz++) {
      for (let cx = -25; cx < 25; cx++) {
        const plan = rollChunk(world, 77, cx, cz, () => 'woodland');
        if (!plan) continue;
        groups++;
        animals += plan.spots.length;
        expect(plan.spots.length).toBeGreaterThanOrEqual(plan.species.group[0]);
        expect(plan.spots.length).toBeLessThanOrEqual(plan.species.group[1]);
        for (const s of plan.spots) expect(s.y).toBe(11);
      }
    }
    const rate = groups / 2000;
    expect(rate).toBeGreaterThan(MOB_CHUNK_SPAWN_CHANCE * 0.8);
    expect(rate).toBeLessThan(MOB_CHUNK_SPAWN_CHANCE * 1.2);
    expect(animals / groups).toBeGreaterThan(2);
  });

  it('only picks species that live in the biome and never spawns where nothing does', () => {
    const world = new FlatWorld();
    const species = new Set<string>();
    for (let cx = 0; cx < 400; cx++) {
      const plan = rollChunk(world, 5, cx, 7, () => 'frostfell');
      if (plan) species.add(plan.species.key);
    }
    expect([...species].sort()).toEqual(['goat', 'snow_ox']);
    for (let cx = 0; cx < 400; cx++) expect(rollChunk(world, 5, cx, 7, () => 'nowhere' as BiomeKey)).toBeNull();
  });

  it('is deterministic and independent of the order chunks load in (real terrain)', () => {
    const seed = 424242;
    const runIn = (order: 'near-first' | 'far-first'): string[] => {
      const bus = createBus();
      const world = new World(seed, bus);
      const spawn = world.spawnPoint();
      const mobs = new MobManager(world, bus, new TestClock(), seed);
      const player = testPlayer(spawn.x + 0.5, spawn.y, spawn.z + 0.5);
      if (order === 'near-first') world.ensureLoadedAround(spawn.x, spawn.z, 4);
      else {
        world.ensureLoadedAround(spawn.x + 4 * CHUNK_SIZE, spawn.z - 4 * CHUNK_SIZE, 0);
        world.ensureLoadedAround(spawn.x - 3 * CHUNK_SIZE, spawn.z + 3 * CHUNK_SIZE, 1);
        world.ensureLoadedAround(spawn.x, spawn.z, 4);
      }
      mobs.tick(DT, player);
      const sig = signature(mobs);
      world.dispose();
      return sig;
    };
    const a = runIn('near-first');
    const b = runIn('far-first');
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(runIn('near-first')).toEqual(a);
  });

  it('does not roll a column twice, even after it unloads and loads again', () => {
    const bus = createBus();
    const world = new FlatWorld(10, 1, bus);
    const mobs = new MobManager(world, bus, new TestClock(), 3, { biomeAt: () => 'woodland', spawn: null });
    const p = testPlayer(0, 11, 0);
    mobs.tick(DT, p);
    const first = mobs.all.length;
    expect(first).toBeGreaterThan(0);
    for (let cx = -3; cx <= 3; cx++) {
      world.setLoaded(cx, 0, false);
      world.setLoaded(cx, 0, true);
    }
    mobs.tick(DT, p);
    expect(mobs.all.length).toBe(first);
  });
});

describe('spawn guarantee', () => {
  for (const seed of [11, 2024, 987654321]) {
    it(`puts a hen group and another group within ${MOB_SPAWN_GUARANTEE_RADIUS} blocks of spawn (seed ${seed})`, () => {
      const bus = createBus();
      const world = new World(seed, bus);
      const spawn = world.spawnPoint();
      const mobs = new MobManager(world, bus, new TestClock(), seed);
      world.ensureLoadedAround(spawn.x, spawn.z, 4);
      mobs.tick(DT, testPlayer(spawn.x + 0.5, spawn.y, spawn.z + 0.5));
      const near = mobs.all.filter((m) => Math.hypot(m.x - spawn.x - 0.5, m.z - spawn.z - 0.5) <= MOB_SPAWN_GUARANTEE_RADIUS);
      expect(near.some((m) => m.spec.key === 'hen')).toBe(true);
      expect(near.some((m) => m.spec.key !== 'hen')).toBe(true);
      expect(mobs.spawning.guaranteed).toBe(true);
      // Every animal stands on the ground, out of liquid.
      for (const m of mobs.all) {
        const below = world.getBlock(Math.floor(m.x), Math.floor(m.y) - 1, Math.floor(m.z));
        expect(below.solid).toBe(true);
        expect(world.getBlock(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z)).liquid).toBeNull();
      }
      world.dispose();
    });
  }

  it('waits until the whole spawn area is loaded', () => {
    const bus = createBus();
    const world = new World(11, bus);
    const spawn = world.spawnPoint();
    const mobs = new MobManager(world, bus, new TestClock(), 11);
    world.ensureLoadedAround(spawn.x, spawn.z, 1);
    mobs.tick(DT, testPlayer(spawn.x, spawn.y, spawn.z));
    expect(mobs.spawning.guaranteed).toBe(false);
    world.dispose();
  });
});

describe('keep-alive spawning', () => {
  const setup = () => {
    const bus = createBus();
    const world = new FlatWorld(10, 1, bus);
    const clock = new TestClock();
    const mobs = new MobManager(world, bus, clock, 8, { biomeAt: () => 'woodland', spawn: null });
    // Mark the neighbourhood as rolled so only keep-alive can add animals.
    for (let cz = -12; cz <= 12; cz++) for (let cx = -12; cx <= 12; cx++) mobs.spawning.rolled.add(cxKey(cx, cz));
    return { world, clock, mobs };
  };
  const cxKey = (cx: number, cz: number): number => (cx + 0x100000) * 0x200000 + (cz + 0x100000);

  it('spawns one group out of sight after 120 s of daytime with too few adults', () => {
    const { mobs } = setup();
    const p = testPlayer(0.5, 11, 0.5);
    p.yaw = 0; // looking north (-z)
    for (let t = 0; t < MOB_KEEPALIVE_AFTER_S - 2; t += DT) mobs.tick(DT, p);
    expect(mobs.all).toHaveLength(0);
    for (let t = 0; t < 4; t += DT) mobs.tick(DT, p);
    expect(mobs.all.length).toBeGreaterThanOrEqual(2);
    const species = new Set(mobs.all.map((m) => m.spec.key));
    expect(species.size).toBe(1);
    for (const m of mobs.all) {
      const dx = m.x - p.x;
      const dz = m.z - p.z;
      const d = Math.hypot(dx, dz);
      expect(d).toBeGreaterThan(MOB_KEEPALIVE_MIN_DISTANCE - 4);
      // Not inside the view cone around -z.
      expect(-dz / d).toBeLessThan(Math.cos(KEEPALIVE_VIEW_HALF_ANGLE) + 0.15);
    }
  });

  it('does not count the night', () => {
    const { clock, mobs } = setup();
    clock.light = 0.08;
    const p = testPlayer(0.5, 11, 0.5);
    for (let t = 0; t < 300; t += DT) mobs.tick(DT, p);
    expect(mobs.all).toHaveLength(0);
  });

  it('respects the loaded cap', () => {
    const { mobs } = setup();
    for (let i = 0; i < MOB_LOADED_CAP; i++) mobs.add(creature('hen'), { x: 200 + i, y: 11, z: 200, yaw: 0 });
    expect(mobs.room(1)).toBe(false);
    const p = testPlayer(0.5, 11, 0.5);
    for (let t = 0; t < MOB_KEEPALIVE_AFTER_S + 10; t += DT) mobs.tick(DT, p);
    expect(mobs.all).toHaveLength(MOB_LOADED_CAP);
  });
});
