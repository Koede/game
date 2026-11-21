import { describe, expect, it } from 'vitest';
import { DT, MOB_LOADED_CAP } from '../core/constants';
import { createBus } from '../core/context';
import { creature } from '../core/registry';
import { World } from '../world';
import { MobManager } from './manager';
import { hitDamage } from './mob';
import { spawnCell } from './terrain';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { MobsSnapshot } from './types';

function manager(world = new FlatWorld(), natural = false) {
  const bus = createBus();
  return new MobManager(world, bus, new TestClock(), 5, { naturalSpawning: natural, biomeAt: () => 'woodland', spawn: null });
}

describe('save and load', () => {
  it('round-trips every animal and the spawning state through JSON', () => {
    const a = manager(new FlatWorld(), true);
    const p = testPlayer(0.5, 11, 0.5);
    a.tick(DT, p);
    const goat = a.add(creature('goat'), { x: -20.25, y: 11, z: -33.5, yaw: 1.25 });
    const kid = a.add(creature('goat'), { x: -22.5, y: 11, z: -33.5, yaw: 0 }, true);
    a.feed(goat.id, 'wheat');
    a.hit(goat.id, 3, -30, -33.5);
    for (let i = 0; i < 40; i++) a.tick(DT, p);
    const snap = JSON.parse(JSON.stringify(a.toJSON())) as MobsSnapshot;
    expect(snap.rolled.length).toBeGreaterThan(100);

    const b = manager(new FlatWorld(), true);
    b.load(snap);
    expect(b.toJSON()).toEqual(snap);
    const g = b.get(goat.id)!;
    expect(g.health).toBe(5);
    expect(g.x).toBeCloseTo(goat.x, 2);
    expect(g.eagerS).toBe(0); // being hurt ends eagerness
    expect(b.get(kid.id)!.baby).toBe(true);
    // Rolled columns are not rolled again, and new ids never collide with saved ones.
    const count = b.all.length;
    b.tick(DT, p);
    expect(b.all.length).toBe(count);
    const fresh = b.add(creature('hen'), { x: 0.5, y: 11, z: 0.5, yaw: 0 });
    expect(snap.mobs.some((m) => m.id === fresh.id)).toBe(false);
  });

  it('leaves corpses out and skips unknown species', () => {
    const a = manager();
    const hen = a.add(creature('hen'), { x: 0.5, y: 11, z: 0.5, yaw: 0 });
    a.add(creature('boar'), { x: 3.5, y: 11, z: 0.5, yaw: 0 });
    a.hit(hen.id, 10, 0, 0);
    const snap = a.toJSON();
    expect(snap.mobs.map((m) => m.species)).toEqual(['boar']);
    snap.mobs.push({ ...snap.mobs[0], id: 99, species: 'dragon' });
    const b = manager();
    b.load(snap);
    expect(b.all.map((m) => m.spec.key)).toEqual(['boar']);
  });

  it('throws on malformed or newer snapshots without changing anything', () => {
    const b = manager();
    b.add(creature('hen'), { x: 0.5, y: 11, z: 0.5, yaw: 0 });
    expect(() => b.load({ version: 2 } as unknown as MobsSnapshot)).toThrow();
    expect(() => b.load({ version: 1, mobs: [], rolled: [1], nextId: 1, guaranteed: false, keepAliveS: 0 })).toThrow();
    expect(b.all).toHaveLength(1);
  });
});

describe('hit damage', () => {
  it('follows the spec table', () => {
    expect(hitDamage(null)).toBe(1);
    expect(hitDamage('stick')).toBe(1);
    expect(hitDamage('flint_axe')).toBe(3);
    expect(hitDamage('iron_axe')).toBe(5);
    expect(hitDamage('bronze_pickaxe')).toBe(3);
    expect(hitDamage('steel_shovel')).toBe(5);
    expect(hitDamage('iron_hoe')).toBe(1);
    expect(hitDamage('power_drill')).toBe(6);
  });
});

describe('performance', () => {
  it(`ticks ${MOB_LOADED_CAP} animals on real terrain well under 0.5 ms`, () => {
    const bus = createBus();
    const world = new World(31337, bus);
    const spawn = world.spawnPoint();
    world.ensureLoadedAround(spawn.x, spawn.z, 3);
    const mobs = new MobManager(world, bus, new TestClock(), 1, { naturalSpawning: false });
    const species = ['hen', 'goat', 'boar'];
    let placed = 0;
    for (let r = 0; r < 40 && placed < MOB_LOADED_CAP; r++) {
      for (let i = 0; i < 16 && placed < MOB_LOADED_CAP; i++) {
        const x = spawn.x + Math.round(Math.cos(i * 0.39) * r * 1.3);
        const z = spawn.z + Math.round(Math.sin(i * 0.39) * r * 1.3);
        const spec = creature(species[placed % 3]);
        const y = spawnCell(world, x, z, 2);
        if (y < 0) continue;
        mobs.add(spec, { x: x + 0.5, y, z: z + 0.5, yaw: i }, placed % 7 === 0);
        placed++;
      }
    }
    expect(placed).toBe(MOB_LOADED_CAP);
    // Someone holding wheat nearby keeps the goats following: the busiest path.
    const p = testPlayer(spawn.x + 0.5, spawn.y, spawn.z + 0.5, 'wheat');
    for (let i = 0; i < 400; i++) mobs.tick(DT, p);
    const n = 1000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) mobs.tick(DT, p);
    const ms = (performance.now() - t0) / n;
    console.log(`[mobs] ${mobs.loaded.length} animals: ${ms.toFixed(3)} ms per tick`);
    expect(mobs.loaded.length).toBe(MOB_LOADED_CAP);
    expect(ms).toBeLessThan(0.5);
    world.dispose();
  });
});
