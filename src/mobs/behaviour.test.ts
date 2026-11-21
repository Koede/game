import { describe, expect, it } from 'vitest';
import { DT, MOB_BREED_COOLDOWN_S, MOB_DEATH_S, MOB_EAGER_S, MOB_FLEE_S, MOB_GROW_UP_S } from '../core/constants';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { MobManager } from './manager';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { Mob, MobDeath, MobPlayer } from './types';

function setup() {
  const bus = createBus();
  const world = new FlatWorld(10, 1234, bus);
  const clock = new TestClock();
  const mobs = new MobManager(world, bus, clock, 99, { naturalSpawning: false, biomeAt: () => 'woodland', spawn: null });
  return { bus, world, clock, mobs };
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

const farPlayer = (): ReturnType<typeof testPlayer> => testPlayer(500, 11, 500);

describe('calm life', () => {
  it('cycles through idle, graze and wander and actually moves', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 0.5, 0.5);
    const seen = new Set<string>();
    let travelled = 0;
    run(mobs, farPlayer(), 240, () => {
      seen.add(goat.state);
      travelled += Math.hypot(goat.x - goat.px, goat.z - goat.pz);
    });
    expect(seen).toEqual(new Set(['idle', 'graze', 'wander']));
    expect(travelled).toBeGreaterThan(10);
    expect(goat.y).toBeCloseTo(11, 2);
  });

  it('lowers its head while grazing', () => {
    const { mobs } = setup();
    const boar = add(mobs, 'boar', 0.5, 0.5);
    let grazedHead = 0;
    run(mobs, farPlayer(), 120, () => {
      if (boar.state === 'graze') grazedHead = Math.max(grazedHead, boar.head);
    });
    expect(grazedHead).toBeGreaterThan(0.95);
  });

  it('never wanders into water or down a drop deeper than two blocks', () => {
    const { world, mobs } = setup();
    // A pond to the east, a 4-deep pit to the west, a 2-deep dip to the south (allowed), apart from each other.
    world.fill(4, 8, -6, 9, 10, 6, 'water');
    world.fill(-10, 7, -6, -5, 10, 6, 'air');
    world.fill(-1, 9, 4, 2, 10, 9, 'air');
    const herd = [add(mobs, 'hen', 0.5, 0.5), add(mobs, 'goat', 0.5, -1.5), add(mobs, 'boar', -0.5, 1.5), add(mobs, 'hen', 1.5, -0.5, true)];
    let wet = 0;
    let lowest = Infinity;
    run(mobs, farPlayer(), 900, () => {
      for (const m of herd) {
        if (m.inLiquid) wet++;
        lowest = Math.min(lowest, m.y);
      }
    });
    expect(wet).toBe(0);
    expect(lowest).toBeGreaterThan(9 - 0.01);
  });
});

describe('flee', () => {
  it('runs directly away from the player at 1.6x speed for MOB_FLEE_S, then calms down', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 0.5, 0.5);
    const player = testPlayer(-2.5, 11, 0.5);
    expect(mobs.hit(goat.id, 1, player.x, player.z).ok).toBe(true);
    expect(goat.state === 'flee' || goat.fleeS > 0).toBe(true);
    run(mobs, player, 2);
    expect(goat.state).toBe('flee');
    expect(goat.x).toBeGreaterThan(5);
    expect(goat.speed).toBeGreaterThan(goat.spec.speed * 1.5);
    run(mobs, player, MOB_FLEE_S);
    expect(goat.state).not.toBe('flee');
    expect(goat.fleeS).toBe(0);
  });

  it('veers along a wall instead of running into it', () => {
    const { world, mobs } = setup();
    world.fill(4, 11, -20, 4, 13, 20, 'stone');
    const hen = add(mobs, 'hen', 2.5, 0.5);
    const player = testPlayer(-1, 11, 0.5);
    mobs.hit(hen.id, 1, player.x, player.z);
    run(mobs, player, 3);
    expect(Math.abs(hen.z - 0.5)).toBeGreaterThan(3);
  });
});

describe('follow', () => {
  it('follows a player holding a liked item to about two blocks away', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 7.5, 0.5);
    const player = testPlayer(0.5, 11, 0.5, 'wheat');
    run(mobs, player, 6);
    expect(goat.state).toBe('follow');
    const d = Math.hypot(goat.x - player.x, goat.z - player.z);
    expect(d).toBeGreaterThan(1.6);
    expect(d).toBeLessThan(2.6);
  });

  it('ignores items it does not like and players out of range', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 7.5, 0.5);
    run(mobs, testPlayer(0.5, 11, 0.5, 'potato'), 3);
    expect(goat.state).not.toBe('follow');
    const far = add(mobs, 'boar', 30.5, 0.5);
    run(mobs, testPlayer(0.5, 11, 0.5, 'carrot'), 3);
    expect(far.state).not.toBe('follow');
  });
});

describe('feeding and breeding', () => {
  it('refuses with reasons and accepts liked food once', () => {
    const { mobs } = setup();
    const hen = add(mobs, 'hen', 0.5, 0.5);
    const chick = add(mobs, 'hen', 3.5, 0.5, true);
    expect(mobs.feed(hen.id, 'wheat')).toEqual({ ok: false, reason: 'Hens eat wheat seeds' });
    expect(mobs.feed(chick.id, 'wheat_seeds')).toEqual({ ok: false, reason: 'This hen is too young' });
    expect(mobs.feed(hen.id, 'wheat_seeds')).toEqual({ ok: true });
    expect(hen.eagerS).toBe(MOB_EAGER_S);
    expect(mobs.feed(hen.id, 'wheat_seeds').ok).toBe(false);
    expect(mobs.feed(12345, 'wheat_seeds')).toEqual({ ok: false, reason: 'Nothing to feed' });
  });

  it('two eager adults meet and make a baby; both rest for the cooldown', () => {
    const { bus, mobs } = setup();
    const a = add(mobs, 'boar', 0.5, 0.5);
    const b = add(mobs, 'boar', 5.5, 3.5);
    const spawned: string[] = [];
    bus.on('mob:spawned', (e) => spawned.push(e.species));
    mobs.feed(a.id, 'potato');
    mobs.feed(b.id, 'carrot');
    run(mobs, farPlayer(), 12);
    expect(spawned).toEqual(['boar']);
    const baby = mobs.all.find((m) => m.baby)!;
    expect(baby).toBeDefined();
    expect(a.eagerS).toBe(0);
    expect(b.eagerS).toBe(0);
    expect(a.cooldownS).toBeGreaterThan(MOB_BREED_COOLDOWN_S - 12);
    expect(mobs.feed(a.id, 'potato').ok).toBe(false);
    // The baby grows up after MOB_GROW_UP_S.
    run(mobs, farPlayer(), MOB_GROW_UP_S + 1);
    expect(baby.baby).toBe(false);
  });

  it('an eager animal alone does not breed, and eagerness wears off', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 0.5, 0.5);
    add(mobs, 'hen', 2.5, 0.5);
    mobs.feed(goat.id, 'wheat');
    run(mobs, farPlayer(), MOB_EAGER_S + 1);
    expect(goat.eagerS).toBe(0);
    expect(mobs.all.length).toBe(2);
  });
});

describe('hits and death', () => {
  it('knocks back, flashes, cools down between hits, dies and hands out drops after the tip-over', () => {
    const { bus, mobs } = setup();
    const hen = add(mobs, 'hen', 0.5, 0.5);
    const player = testPlayer(-1.5, 11, 0.5);
    const hurt: number[] = [];
    const died: number[] = [];
    const deaths: MobDeath[] = [];
    bus.on('mob:hurt', (e) => hurt.push(e.health));
    bus.on('mob:died', (e) => died.push(e.id));
    mobs.onDeath((d) => deaths.push(d));

    expect(mobs.hit(hen.id, 1, player.x, player.z)).toEqual({ ok: true, health: 3, killed: false });
    expect(mobs.hit(hen.id, 1, player.x, player.z)).toEqual({ ok: false, reason: 'cooldown' });
    expect(mobs.views(1)[0]?.flash ?? 1).toBeGreaterThan(0);
    run(mobs, player, 0.5);
    expect(hen.x).toBeGreaterThan(1.5);
    expect(mobs.hit(hen.id, 5, player.x, player.z)).toEqual({ ok: true, health: 0, killed: true });
    expect(hurt).toEqual([3, 0]);
    expect(mobs.raycast(player.x, 11.3, 0.5, 1, 0, 0, 20)).toBeNull();
    expect(mobs.describe(hen.id)).toBe('');
    run(mobs, player, MOB_DEATH_S - 0.1);
    expect(deaths).toEqual([]);
    run(mobs, player, 0.15);
    expect(died).toEqual([hen.id]);
    expect(deaths).toHaveLength(1);
    expect(deaths[0]).toMatchObject({ species: 'hen', cause: 'player', drops: [{ item: 'raw_fowl', count: 1 }] });
    expect(mobs.hit(hen.id, 1, 0, 0)).toEqual({ ok: false, reason: 'dead' });
    run(mobs, player, 1);
    expect(mobs.get(hen.id)).toBeUndefined();
  });

  it('babies drop nothing', () => {
    const { mobs } = setup();
    const piglet = add(mobs, 'boar', 0.5, 0.5, true);
    const deaths: MobDeath[] = [];
    mobs.onDeath((d) => deaths.push(d));
    mobs.hit(piglet.id, 50, 0, 0);
    run(mobs, farPlayer(), 1);
    expect(deaths[0].drops).toEqual([]);
  });

  it('drops follow the species table', () => {
    const { mobs } = setup();
    const totals = new Map<string, number>();
    mobs.onDeath((d) => {
      for (const s of d.drops) totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
    });
    for (let i = 0; i < 60; i++) mobs.hit(add(mobs, 'goat', i * 3 + 0.5, 0.5).id, 99, 0, 0);
    run(mobs, farPlayer(), 1);
    const mutton = totals.get('raw_mutton') ?? 0;
    const hide = totals.get('hide') ?? 0;
    expect(mutton).toBeGreaterThanOrEqual(60);
    expect(mutton).toBeLessThanOrEqual(120);
    expect(hide).toBeGreaterThan(15);
    expect(hide).toBeLessThan(45);
  });

  it('lava burns an animal to death with no drops for anyone', () => {
    const { world, mobs } = setup();
    world.fill(-1, 10, -1, 1, 10, 1, 'lava');
    const hen = add(mobs, 'hen', 0.5, 0.5);
    const deaths: MobDeath[] = [];
    mobs.onDeath((d) => deaths.push(d));
    run(mobs, farPlayer(), 8);
    expect(deaths).toHaveLength(1);
    expect(deaths[0]).toMatchObject({ id: hen.id, cause: 'world', drops: [] });
  });

  it('animals that fall out of the world are removed', () => {
    const { world, mobs } = setup();
    for (let y = 0; y <= 10; y++) world.put(0, y, 0, 'air');
    const hen = add(mobs, 'hen', 0.5, 0.5);
    // Below y 0 the world is solid, so dig a shaft that ends in the void is impossible: move it there directly.
    hen.y = -9;
    run(mobs, farPlayer(), 0.1);
    expect(mobs.get(hen.id)).toBeUndefined();
  });
});

describe('water, frozen chunks, calls', () => {
  it('swims to the shore and climbs out', () => {
    const { world, mobs } = setup();
    world.fill(-3, 7, -3, 3, 10, 3, 'water');
    const goat = add(mobs, 'goat', 0.5, 0.5);
    goat.y = 10;
    let swam = false;
    run(mobs, farPlayer(), 25, () => {
      if (goat.state === 'swim') swam = true;
    });
    expect(swam).toBe(true);
    expect(goat.inLiquid).toBe(false);
    expect(goat.y).toBeCloseTo(11, 2);
  });

  it('freezes animals in unloaded chunks and resumes them', () => {
    const { world, mobs } = setup();
    const hen = add(mobs, 'hen', -8.5, -8.5);
    mobs.feed(hen.id, 'wheat_seeds');
    world.setLoaded(-1, -1, false);
    run(mobs, farPlayer(), 10);
    expect(hen.eagerS).toBe(MOB_EAGER_S);
    expect(hen.ageS).toBe(0);
    expect(mobs.loaded).toHaveLength(0);
    world.setLoaded(-1, -1, true);
    run(mobs, farPlayer(), 1);
    expect(hen.eagerS).toBeLessThan(MOB_EAGER_S);
    expect(mobs.loaded).toHaveLength(1);
  });

  it('makes its call every 8-20 s near the player, positioned, and stays quiet far away', () => {
    const { bus, mobs } = setup();
    const hen = add(mobs, 'hen', 0.5, 0.5);
    const calls: { x?: number; z?: number }[] = [];
    bus.on('sfx', (e) => {
      if (e.name === 'hen') calls.push(e);
    });
    run(mobs, testPlayer(5, 11, 5), 100);
    expect(calls.length).toBeGreaterThanOrEqual(5);
    expect(calls.length).toBeLessThanOrEqual(13);
    expect(calls[0].x).toBeTypeOf('number');
    calls.length = 0;
    run(mobs, farPlayer(), 100);
    expect(calls).toHaveLength(0);
    expect(hen.state).not.toBe('dying');
  });
});

describe('targeting', () => {
  it('raycasts the nearest box, honours max distance, and works at negative coordinates', () => {
    const { mobs } = setup();
    const near = add(mobs, 'goat', -3.5, -10.5);
    add(mobs, 'boar', -6.5, -10.5);
    mobs.tick(DT, farPlayer());
    const hit = mobs.raycast(0, 11.5, -10.5, -1, 0, 0, 10);
    expect(hit?.id).toBe(near.id);
    expect(hit!.distance).toBeCloseTo(3.5 - 0.4 - 0.08, 2);
    expect(mobs.raycast(0, 11.5, -10.5, -1, 0, 0, 2)).toBeNull();
    expect(mobs.raycast(0, 11.5, -10.5, 1, 0, 0, 10)).toBeNull();
    expect(mobs.raycast(-3.5, 20, -10.5, 0, -1, 0, 10)?.id).toBe(near.id);
  });

  it('describes animals for the HUD', () => {
    const { mobs } = setup();
    const goat = add(mobs, 'goat', 0.5, 0.5);
    const kid = add(mobs, 'goat', 3.5, 0.5, true);
    expect(mobs.describe(goat.id)).toBe('Goat - 8/8');
    mobs.hit(goat.id, 2.5, 0, 0);
    expect(mobs.describe(goat.id)).toBe('Goat - 6/8');
    expect(mobs.describe(kid.id)).toBe('Young Goat - 8/8');
  });
});
