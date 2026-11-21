/** Living with the caps and the land: breeding at a full herd, exploring far, hazards, healing, crowding. */
import { describe, expect, it } from 'vitest';
import {
  DT,
  MOB_BREED_COOLDOWN_S,
  MOB_DESPAWN_DISTANCE,
  MOB_LOADED_CAP,
  MOB_STORED_CAP,
  MOB_STORED_SOFT_CAP,
  PLAYER_WIDTH,
} from '../core/constants';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { CHUNK_SIZE } from '../core/types';
import { crowdRadius } from './crowd';
import { MobManager, NO_ROOM } from './manager';
import { columnKey } from './spawner';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { Mob, MobPlayer } from './types';

function setup(world = new FlatWorld(10, 1234), natural = false) {
  const bus = createBus();
  const mobs = new MobManager(world, bus, new TestClock(), 99, { naturalSpawning: natural, biomeAt: () => 'woodland', spawn: null });
  const toasts: string[] = [];
  const hurts: number[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  bus.on('mob:hurt', (e) => hurts.push(e.id));
  return { bus, world, mobs, toasts, hurts };
}

const add = (mobs: MobManager, species: string, x: number, z: number, baby = false): Mob =>
  mobs.add(creature(species), { x, y: 11, z, yaw: 0 }, baby);

function run(mobs: MobManager, player: MobPlayer, seconds: number, each?: () => void): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    mobs.tick(DT, player);
    each?.();
  }
}

/** Flat land loaded only within `r` chunks of a centre the test moves (like the World around the player). */
class WindowWorld extends FlatWorld {
  cx = 0;
  cz = 0;
  constructor(readonly r: number) {
    super(10, 77);
  }
  override isLoaded(x: number, z: number): boolean {
    const cx = Math.floor(Math.floor(x) / CHUNK_SIZE);
    const cz = Math.floor(Math.floor(z) / CHUNK_SIZE);
    return Math.abs(cx - this.cx) <= this.r && Math.abs(cz - this.cz) <= this.r;
  }
}

describe('breeding with a full herd', () => {
  it('two fed hens make a chick even when MOB_LOADED_CAP wild animals are loaded', () => {
    const { mobs, toasts } = setup();
    const player = testPlayer(0.5, 11, -6);
    const wild: Mob[] = [];
    for (let i = 0; i < MOB_LOADED_CAP - 2; i++) wild.push(add(mobs, 'goat', 60.5 + (i % 10) * 3, -30.5 + Math.floor(i / 10) * 20));
    const a = add(mobs, 'hen', 0.5, 0.5);
    const b = add(mobs, 'hen', 2.5, 0.5);
    run(mobs, player, DT);
    expect(mobs.loaded).toHaveLength(MOB_LOADED_CAP);
    expect(mobs.room(1)).toBe(false);
    expect(mobs.feed(a.id, 'wheat_seeds')).toEqual({ ok: true });
    expect(toasts).toEqual(['This hen is eager: feed another hen nearby']);
    expect(mobs.feed(b.id, 'wheat_seeds')).toEqual({ ok: true });
    expect(toasts).toHaveLength(1); // a partner was waiting: no second hint
    run(mobs, player, 12);
    const chicks = mobs.all.filter((m) => m.baby);
    expect(chicks).toHaveLength(1);
    expect(chicks[0].tame).toBe(true);
    expect(a.cooldownS).toBeGreaterThan(MOB_BREED_COOLDOWN_S - 12);
    expect(toasts).toHaveLength(1);
    // The farthest wild animal made way, so the simulated herd stays at the cap.
    expect(mobs.all).toHaveLength(MOB_LOADED_CAP);
    expect(wild.filter((w) => mobs.get(w.id) === undefined)).toHaveLength(1);
  });

  it('refuses the food before it is eaten when no baby could be stored, and keeps no cooldown', () => {
    const { mobs } = setup();
    for (let i = 0; i < MOB_STORED_CAP - 2; i++) add(mobs, 'hen', 40.5 + (i % 20) * 2, 40.5 + Math.floor(i / 20) * 2).tame = true;
    const a = add(mobs, 'hen', 0.5, 0.5);
    const b = add(mobs, 'hen', 2.5, 0.5);
    expect(mobs.feed(a.id, 'wheat_seeds')).toEqual({ ok: false, reason: NO_ROOM });
    expect(a.eagerS).toBe(0);
    expect(a.cooldownS).toBe(0);
    expect(b.cooldownS).toBe(0);
  });

  it('retires a far-off frozen wild animal to make room in a full save', () => {
    const { world, mobs } = setup();
    world.setLoaded(20, 0, false);
    for (let i = 0; i < MOB_STORED_CAP - 2; i++) add(mobs, 'hen', 20 * CHUNK_SIZE + 0.5 + (i % 15), 0.5 + Math.floor(i / 15) * 0.7);
    const a = add(mobs, 'hen', 0.5, 0.5);
    add(mobs, 'hen', 2.5, 0.5);
    expect(mobs.feed(a.id, 'wheat_seeds')).toEqual({ ok: true });
    expect(mobs.all).toHaveLength(MOB_STORED_CAP - 1);
  });
});

describe('exploring far', () => {
  it('animals keep appearing around a player who walks 4000 blocks, and the world behind refills', () => {
    const world = new WindowWorld(6);
    const { bus, mobs } = setup(world, true);
    const spawned: { id: number; x: number }[] = [];
    bus.on('mob:spawned', (e) => spawned.push({ id: e.id, x: mobs.get(e.id)?.x ?? NaN }));
    const player = testPlayer(8.5, 11, 8.5);
    let maxStored = 0;
    const startCols: number[] = [];
    for (let x = 0; x <= 4000; x += CHUNK_SIZE) {
      player.x = x + 8.5;
      world.cx = Math.floor(player.x / CHUNK_SIZE);
      run(mobs, player, 1);
      maxStored = Math.max(maxStored, mobs.all.length);
      if (x === 0) for (const k of mobs.spawning.rolled) startCols.push(k);
    }
    // Spawning never stopped: plenty of animals appeared over the last 1000 blocks and some are loaded now.
    expect(spawned.filter((s) => s.x > 3000).length).toBeGreaterThan(30);
    expect(mobs.loaded.length).toBeGreaterThan(10);
    // The save stays bounded: far-off wild animals were retired.
    expect(maxStored).toBeLessThan(MOB_STORED_CAP);
    expect(mobs.all.every((m) => m.tame || world.isLoaded(m.x, m.z) || Math.abs(m.x - player.x) < 4000)).toBe(true);
    // Columns near the start whose animals were all retired roll again when the player comes back.
    expect(startCols.some((k) => !mobs.spawning.rolled.has(k))).toBe(true);
    player.x = 8.5;
    world.cx = 0;
    run(mobs, player, 2);
    const near = mobs.loaded.filter((m) => Math.abs(m.x - player.x) < 64 && Math.abs(m.z - player.z) < 64);
    expect(near.length).toBeGreaterThan(5);
  });

  it('never retires the player\'s animals, babies or animals near the player', () => {
    const world = new WindowWorld(2);
    const { mobs } = setup(world);
    const player = testPlayer(8.5, 11, 8.5);
    const keep: Mob[] = [];
    const far = 10 * CHUNK_SIZE;
    for (let i = 0; i < MOB_STORED_SOFT_CAP + 30; i++) {
      const m = add(mobs, 'hen', far + 0.5 + (i % 15), 0.5 + Math.floor(i / 15) * 0.7, i % 3 === 1);
      if (i % 3 === 0) m.tame = true;
      if (i % 3 !== 2) keep.push(m);
    }
    // Close but unloaded wild animals (within MOB_DESPAWN_DISTANCE) stay too.
    const close = add(mobs, 'hen', MOB_DESPAWN_DISTANCE - 20, 0.5);
    run(mobs, player, 6);
    for (const m of keep) expect(mobs.get(m.id)).toBe(m);
    expect(mobs.get(close.id)).toBe(close);
    expect(mobs.all.length).toBeLessThan(MOB_STORED_SOFT_CAP + 31);
  });

  it('a column refused for lack of room rolls later instead of staying empty forever', () => {
    const { mobs } = setup(new FlatWorld(10, 1234), true);
    for (let i = 0; i < MOB_LOADED_CAP; i++) add(mobs, 'hen', 200.5 + i, 200.5);
    const player = testPlayer(0.5, 11, 0.5);
    run(mobs, player, 1);
    expect(mobs.all).toHaveLength(MOB_LOADED_CAP);
    const waiting = mobs.spawning.rolled.size;
    // Room again (the hens are hunted): the waiting columns roll on the next sweep.
    for (const m of [...mobs.all]) mobs.hit(m.id, 99, 0, 0);
    run(mobs, player, 3);
    expect(mobs.all.length).toBeGreaterThan(0);
    expect(mobs.spawning.rolled.size).toBeGreaterThan(waiting);
    expect(mobs.spawning.rolled.has(columnKey(0, 0))).toBe(true);
  });
});

describe('hazards', () => {
  it('hens wandering for 10 minutes among cacti are not hurt', () => {
    const { world, mobs, hurts } = setup();
    world.fill(-20, 10, -20, 20, 10, 20, 'sand');
    for (let x = -18; x <= 18; x += 4) for (let z = -18; z <= 18; z += 4) world.fill(x, 11, z, x, 12, z, 'cactus');
    // Hens start two blocks from the nearest cacti.
    for (let i = 0; i < 12; i++) add(mobs, 'hen', -15.5 + (i % 4) * 8, -15.5 + Math.floor(i / 4) * 8);
    run(mobs, testPlayer(500, 11, 500), 600);
    expect(hurts).toEqual([]);
    expect(mobs.all.every((m) => m.state !== 'dying')).toBe(true);
  });

  it('goats and boars beside a lava pool keep clear of it', () => {
    const { world, mobs, hurts } = setup();
    world.fill(-3, 10, -3, 3, 11, 3, 'lava'); // the surface at foot level
    const herd = [add(mobs, 'goat', 5.5, 0.5), add(mobs, 'boar', -5.5, 0.5), add(mobs, 'goat', 0.5, 5.5), add(mobs, 'boar', 0.5, -5.5)];
    run(mobs, testPlayer(500, 11, 500), 600);
    expect(hurts).toEqual([]);
    for (const m of herd) expect(mobs.get(m.id)?.state).not.toBe('dying');
  });

  it('heals slowly once left alone', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 0.5, 0.5);
    mobs.hit(goat.id, 3, -2, 0.5);
    const far = testPlayer(500, 11, 500);
    run(mobs, far, 35);
    expect(goat.health).toBe(5);
    run(mobs, far, 10);
    expect(goat.health).toBe(6);
    run(mobs, far, 61);
    expect(goat.health).toBe(8);
  });
});

describe('crowding', () => {
  it('a flock following the player spreads around them instead of stacking', () => {
    const { mobs } = setup();
    const hens = [0, 1, 2, 3, 4, 5].map((i) => add(mobs, 'hen', 6.5 + (i % 2) * 0.1, 0.5 + i * 0.1));
    const player = testPlayer(0.5, 11, 0.5, 'wheat_seeds');
    run(mobs, player, 10);
    let closest = Infinity;
    for (let i = 0; i < hens.length; i++) {
      for (let j = i + 1; j < hens.length; j++) closest = Math.min(closest, Math.hypot(hens[i].x - hens[j].x, hens[i].z - hens[j].z));
    }
    expect(closest).toBeGreaterThan(crowdRadius(hens[0]) * 1.6);
    // None is squeezed in towards the player's face either: all stay about two blocks off, body to body.
    for (const h of hens) {
      const gap = Math.hypot(h.x - player.x, h.z - player.z) - h.spec.size.w / 2 - PLAYER_WIDTH / 2;
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(3.5);
    }
  });

  it('a breeding pair stands face to face without their heads inside each other', () => {
    const { mobs } = setup();
    const a = add(mobs, 'hen', 0.5, 0.5);
    const b = add(mobs, 'hen', 4.5, 0.5);
    mobs.feed(a.id, 'wheat_seeds');
    mobs.feed(b.id, 'wheat_seeds');
    let closest = Infinity;
    run(mobs, testPlayer(500, 11, 500), 6, () => {
      if (a.state === 'breed') closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
    });
    expect(mobs.all.some((m) => m.baby)).toBe(true);
    // Each hen's beak reaches 0.47 blocks ahead of its feet.
    expect(closest).toBeGreaterThan(0.9);
  });

  it('does not push an animal off a cliff edge', () => {
    const { world, mobs } = setup();
    world.fill(1, 5, -5, 10, 10, 5, 'air'); // a 6-deep drop east of x = 1
    const edge = add(mobs, 'boar', 0.55, 0.5);
    add(mobs, 'boar', 0.45, 0.5);
    run(mobs, testPlayer(-500, 11, 500), 20);
    expect(edge.y).toBeCloseTo(11, 2);
  });
});
