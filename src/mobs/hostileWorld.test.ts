import { describe, expect, it } from 'vitest';
import {
  DT,
  HOSTILE_CAP,
  HOSTILE_SPAWN_MAX_DISTANCE,
  HOSTILE_SPAWN_MIN_DISTANCE,
  RUIN_GUARD_LEASH,
  RUIN_SENTRY_CHANCE,
} from '../core/constants';
import { createBus } from '../core/context';
import { creature, CREATURES } from '../core/registry';
import { World } from '../world';
import { ruinGuardPlan } from '../world/ruinGuards';
import { spawnRuin, squareRuin, type RuinSite } from '../world/ruins';
import { arena, type Arena } from './hostileKit';
import { MobManager } from './manager';
import { SPAWN_VIEW_HALF_ANGLE } from './hostileSpawner';
import { blockLightAt } from './sight';
import { spawnCell, clearanceOf } from './terrain';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { Mob, MobsSnapshot } from './types';

/** Runs `seconds` with night spawning on; returns every automaton as it appeared (a copy of its spot). */
function spawnRun(a: Arena, seconds: number, each?: () => void): Array<{ key: string; x: number; y: number; z: number }> {
  a.mobs.hostiles.naturalSpawning = true;
  const seen: Array<{ key: string; x: number; y: number; z: number }> = [];
  a.bus.on('mob:spawned', ({ id }) => {
    const m = a.mobs.get(id)!;
    seen.push({ key: m.spec.key, x: m.x, y: m.y, z: m.z });
  });
  a.run(seconds, each);
  return seen;
}

describe('night spawning', () => {
  it('spawns surface types 24-40 blocks away, out of view, up to the Normal cap', () => {
    const a = arena();
    let most = 0;
    const seen = spawnRun(a, 120, () => {
      most = Math.max(most, a.mobs.hostiles.loadedCount);
    });
    expect(seen.length).toBeGreaterThan(5);
    expect(most).toBeLessThanOrEqual(HOSTILE_CAP.normal);
    expect(most).toBe(HOSTILE_CAP.normal);
    const cos = Math.cos(SPAWN_VIEW_HALF_ANGLE);
    for (const s of seen) {
      expect(['cinder_mite', 'bellows_hound', 'forge_warden']).toContain(s.key);
      const dx = s.x - a.player.x;
      const dz = s.z - a.player.z;
      const d = Math.hypot(dx, dz);
      // Group members stand up to 2 blocks from the first.
      expect(d).toBeGreaterThan(HOSTILE_SPAWN_MIN_DISTANCE - 3.5);
      expect(d).toBeLessThan(HOSTILE_SPAWN_MAX_DISTANCE + 3.5);
      // The player looks north (-Z): on flat open ground nothing appears inside the view cone.
      expect(-dz / d).toBeLessThan(cos + 0.1);
    }
  });

  it('Hard raises the cap by half; Peaceful spawns nothing', () => {
    const hard = arena({ difficulty: 'hard' });
    let most = 0;
    spawnRun(hard, 150, () => {
      most = Math.max(most, hard.mobs.hostiles.loadedCount);
    });
    expect(most).toBe(HOSTILE_CAP.hard);
    const calm = arena({ difficulty: 'peaceful' });
    expect(spawnRun(calm, 60)).toHaveLength(0);
  });

  it('never under open sky by day; in the dark below a roof it spawns deep types', () => {
    const day = arena({ light: 0.7 });
    expect(spawnRun(day, 60)).toHaveLength(0);

    const roofed = arena({ light: 0.7 });
    roofed.world.fill(-50, 14, -50, 50, 14, 50, 'stone');
    const seen = spawnRun(roofed, 80);
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(['cinder_mite', 'slag_colossus']).toContain(s.key);
    expect(seen.filter((s) => s.key === 'slag_colossus').length).toBeLessThanOrEqual(1);
  });

  it('torchlight and safe zones keep spawns away', () => {
    const lit = arena();
    for (let x = -48; x <= 48; x += 4) for (let z = -48; z <= 48; z += 4) lit.world.put(x, 11, z, 'torch');
    expect(blockLightAt(lit.world, 2, 11, 2, 7)).toBeGreaterThanOrEqual(7);
    expect(spawnRun(lit, 40)).toHaveLength(0);

    const warded = arena();
    warded.zones.push({ x0: -100, z0: -100, x1: 100, z1: 100 });
    expect(spawnRun(warded, 40)).toHaveLength(0);
  });

  it('arc drones appear over high ground only in a storm or on a moonless night', () => {
    const clear = arena({ ground: 50, sky: { storm: false, moonPhase: 4 } });
    expect(spawnRun(clear, 80).some((s) => s.key === 'arc_drone')).toBe(false);
    const storm = arena({ ground: 50, sky: { storm: true, moonPhase: 4 } });
    // Clear the field now and then so the spawner keeps picking.
    const seen = spawnRun(storm, 120, () => {
      if (storm.mobs.hostiles.loadedCount < 6) return;
      storm.mobs.setDifficulty('peaceful');
      storm.mobs.setDifficulty('normal');
    });
    const drones = seen.filter((s) => s.key === 'arc_drone');
    expect(drones.length).toBeGreaterThan(0);
    for (const d of drones) expect(d.y).toBeGreaterThanOrEqual(53);
  });
});

/** The spawn ruin of the first seed from `from` whose guard plan has a kiln sentry. */
function seedWithSentry(from: number): { seed: number; ruin: RuinSite } {
  for (let seed = from; seed < from + 200; seed++) {
    const ruin = spawnRuin(seed);
    if (ruin && ruinGuardPlan(seed, ruin).sentry.length > 0) return { seed, ruin };
  }
  throw new Error('no seed');
}

describe('ruin guards', () => {
  it('plans are deterministic: 1-2 wardens inside the walls, a sentry on about half of the ruins', () => {
    let ruins = 0;
    let sentries = 0;
    for (let sx = -6; sx <= 6; sx++) {
      for (let sz = -6; sz <= 6; sz++) {
        const r = squareRuin(4242, sx, sz);
        if (!r) continue;
        ruins++;
        const p = ruinGuardPlan(4242, r);
        expect(ruinGuardPlan(4242, r)).toEqual(p);
        expect(p.wardens.length).toBeGreaterThanOrEqual(1);
        expect(p.wardens.length).toBeLessThanOrEqual(2);
        for (const c of p.wardens) {
          expect(c.x).toBeGreaterThan(r.x0);
          expect(c.x).toBeLessThan(r.x0 + r.w - 1);
          expect(c.z).toBeGreaterThan(r.z0);
          expect(c.z).toBeLessThan(r.z0 + r.d - 1);
          expect(c.x === r.crateX && c.z === r.crateZ).toBe(false);
        }
        if (p.sentry.length > 0) sentries++;
      }
    }
    expect(ruins).toBeGreaterThan(60);
    expect(sentries / ruins).toBeGreaterThan(RUIN_SENTRY_CHANCE - 0.15);
    expect(sentries / ruins).toBeLessThan(RUIN_SENTRY_CHANCE + 0.15);
  });

  it('are created once when the ruin loads, saved, never respawned, and keep watch by day', () => {
    const { seed, ruin } = seedWithSentry(7);
    const bus = createBus();
    const world = new World(seed, bus);
    world.ensureLoadedAround(ruin.x0, ruin.z0, 3);
    const clock = new TestClock(0.5, 1);
    const mobs = new MobManager(world, bus, clock, seed, { naturalSpawning: false, spawn: null });
    const player = testPlayer(ruin.x0 + 0.5, ruin.floor + 1, ruin.z0 - 30);
    mobs.tick(DT, player);
    const guards = mobs.hostiles.all.filter((m) => m.hostile!.role === 'guard');
    const turrets = mobs.hostiles.all.filter((m) => m.hostile!.role === 'turret');
    expect(guards.length).toBeGreaterThanOrEqual(1);
    expect(guards.length).toBeLessThanOrEqual(2);
    expect(turrets).toHaveLength(1);
    for (const g of guards) {
      expect(g.spec.key).toBe('forge_warden');
      expect(g.x).toBeGreaterThan(ruin.x0);
      expect(g.x).toBeLessThan(ruin.x0 + ruin.w);
      expect(g.y).toBeGreaterThanOrEqual(ruin.floor + 1);
    }
    expect(turrets[0].spec.key).toBe('kiln_sentry');
    expect(turrets[0].y).toBeGreaterThanOrEqual(ruin.floor + 3);

    // A day passes with the player near: none winds down, the wardens stay on their leash.
    player.z = ruin.z0 - 8;
    for (let i = 0; i < 20 * 30; i++) mobs.tick(DT, player);
    for (const g of [...guards, ...turrets]) {
      expect(g.hostile!.mode).not.toBe('dormant');
      expect(Math.hypot(g.x - g.hostile!.homeX, g.z - g.hostile!.homeZ)).toBeLessThan(RUIN_GUARD_LEASH + 2);
    }
    expect(turrets[0].x).toBe(turrets[0].px);

    // Saved and loaded: the same guards, and the ruin is never guarded again.
    const saved = JSON.parse(JSON.stringify(mobs.toJSON())) as MobsSnapshot;
    const again = new MobManager(world, bus, clock, seed, { naturalSpawning: false, spawn: null });
    again.load(saved);
    again.tick(DT, player);
    again.tick(DT, player);
    expect(again.hostiles.all.length).toBe(guards.length + turrets.length);
    expect(again.hostiles.all.every((m) => m.hostile!.ruin === `${ruin.x0},${ruin.z0}`)).toBe(true);
    // Killed guards stay dead.
    for (const g of again.hostiles.all.slice()) for (let i = 0; i < 40 && again.get(g.id)?.state !== 'dying'; i++) {
      g.hitCooldownS = 0;
      again.hit(g.id, 5, g.x, g.z + 1);
    }
    for (let i = 0; i < 40; i++) again.tick(DT, player);
    expect(again.hostiles.all).toHaveLength(0);
    const third = new MobManager(world, bus, clock, seed, { naturalSpawning: false, spawn: null });
    third.load(JSON.parse(JSON.stringify(again.toJSON())) as MobsSnapshot);
    for (let i = 0; i < 25; i++) third.tick(DT, player);
    expect(third.hostiles.all).toHaveLength(0);
  });

  it('are kept on Peaceful but neither simulated nor shown', () => {
    const { seed, ruin } = seedWithSentry(7);
    const bus = createBus();
    const world = new World(seed, bus);
    world.ensureLoadedAround(ruin.x0, ruin.z0, 3);
    const mobs = new MobManager(world, bus, new TestClock(0.9, 0.05), seed, { naturalSpawning: false, spawn: null, difficulty: 'peaceful' });
    const player = testPlayer(ruin.x0 + 0.5, ruin.floor + 1, ruin.z0 - 4);
    for (let i = 0; i < 40; i++) mobs.tick(DT, player);
    expect(mobs.hostiles.all.length).toBeGreaterThan(0);
    expect(mobs.views(1)).toHaveLength(0);
    expect(mobs.toJSON().hostiles!.mobs.length).toBe(mobs.hostiles.all.length);
    mobs.setDifficulty('normal');
    mobs.tick(DT, player);
    expect(mobs.views(1).length).toBe(mobs.hostiles.all.length);
  });
});

describe('save and load', () => {
  it('round-trips automatons with animals: roles, homes, dormancy, health, ids', () => {
    const a = arena({ light: 0.6 });
    a.player.z = 40;
    const mite = a.spawn('cinder_mite', 0.5, 11, 0.5);
    a.mobs.add(creature('hen'), { x: 5.5, y: 11, z: 5.5, yaw: 0 });
    const guard = a.mobs.hostiles.add(creature('forge_warden'), 10.5, 11, 0.5, 1, 'guard', '3,4', { x: 9, y: 11, z: 2 });
    a.run(3);
    expect(mite.hostile!.mode).toBe('dormant');
    guard.hitCooldownS = 0;
    a.mobs.hit(guard.id, 2, 10.5, 30);
    const json = JSON.parse(JSON.stringify(a.mobs.toJSON())) as MobsSnapshot;
    const b = new MobManager(new FlatWorld(), createBus(), new TestClock(0.9, 0.6), 1, { naturalSpawning: false, spawn: null });
    b.load(json);
    const mine = (m: Mob | undefined) => m && { key: m.spec.key, x: Math.round(m.x * 100), z: Math.round(m.z * 100), health: m.health, h: m.hostile && { role: m.hostile.role, home: [m.hostile.homeX, m.hostile.homeZ], ruin: m.hostile.ruin, dormant: m.hostile.mode === 'dormant' } };
    expect(mine(b.get(mite.id))).toEqual(mine(a.mobs.get(mite.id)));
    expect(mine(b.get(guard.id))).toEqual(mine(a.mobs.get(guard.id)));
    expect(b.get(guard.id)!.health).toBeLessThan(16);
    expect(b.all.map((m) => m.spec.key)).toEqual(['hen']);
    // New ids never collide with restored ones.
    const fresh = b.add(creature('cinder_mite'), { x: 0.5, y: 11, z: 9.5, yaw: 0 });
    expect([mite.id, guard.id]).not.toContain(fresh.id);
  });

  it('loads saves made before the automatons had behaviour', () => {
    const a = arena();
    a.mobs.add(creature('goat'), { x: 2.5, y: 11, z: 2.5, yaw: 0 });
    const json = JSON.parse(JSON.stringify(a.mobs.toJSON())) as MobsSnapshot;
    delete json.hostiles;
    const b = arena();
    b.mobs.load(json);
    expect(b.mobs.all).toHaveLength(1);
    expect(b.mobs.hostiles.all).toHaveLength(0);
    expect(() => b.mobs.load({ ...json, hostiles: { guarded: 'x' } as never })).toThrow();
  });
});

describe('performance', () => {
  it('10 automatons + 8 bolts + 40 animals tick in under 0.8 ms (real terrain)', () => {
    const seed = 20251121;
    const bus = createBus();
    const world = new World(seed, bus);
    const spawn = world.spawnPoint();
    world.ensureLoadedAround(spawn.x, spawn.z, 4);
    const mobs = new MobManager(world, bus, new TestClock(0.9, 0.05), seed, { naturalSpawning: false, spawn: null });
    const player = testPlayer(spawn.x + 0.5, spawn.y, spawn.z + 0.5);
    const animals = CREATURES;
    let n = 0;
    for (let r = 4; n < 40 && r < 60; r++) {
      for (let a = 0; a < 12 && n < 40; a++) {
        const x = Math.floor(spawn.x + Math.cos(a * 0.52 + r) * r);
        const z = Math.floor(spawn.z + Math.sin(a * 0.52 + r) * r);
        const spec = animals[n % animals.length];
        const y = spawnCell(world, x, z, clearanceOf(spec.size.h));
        if (y < 0) continue;
        mobs.add(spec, { x: x + 0.5, y, z: z + 0.5, yaw: 0 });
        n++;
      }
    }
    expect(mobs.all.length).toBe(40);
    const kinds = ['cinder_mite', 'cinder_mite', 'cinder_mite', 'forge_warden', 'forge_warden', 'bellows_hound', 'bellows_hound', 'arc_drone', 'kiln_sentry', 'slag_colossus'];
    let k = 0;
    for (let r = 8; k < kinds.length && r < 40; r++) {
      const x = Math.floor(spawn.x + Math.cos(r * 1.7) * r);
      const z = Math.floor(spawn.z + Math.sin(r * 1.7) * r);
      const spec = creature(kinds[k]);
      const y = spawnCell(world, x, z, clearanceOf(spec.size.h));
      if (y < 0) continue;
      mobs.add(spec, { x: x + 0.5, y: y + (spec.hostile?.flying ? 2 : 0), z: z + 0.5, yaw: 0 });
      k++;
    }
    expect(mobs.hostiles.all.length).toBe(10);
    const bolts = mobs.hostiles.projectiles;
    const keepBolts = () => {
      while (bolts.all.length < 8) bolts.fire(bus, { id: 1, species: 'kiln_sentry' }, player.x + 20, spawn.y + 30, player.z, 0, 6, 0, 0);
    };
    for (let i = 0; i < 100; i++) {
      keepBolts();
      mobs.tick(DT, player);
    }
    // Best of three rounds: a timing test must not fail because another test file is running alongside.
    let ms = Infinity;
    for (let round = 0, i = 0; round < 3; round++) {
      let total = 0;
      for (let k = 0; k < 200; k++, i++) {
        keepBolts();
        // The player walks in a small circle so senses, steering and attacks keep working.
        player.x = spawn.x + 0.5 + Math.cos(i / 40) * 3;
        player.z = spawn.z + 0.5 + Math.sin(i / 40) * 3;
        const t0 = performance.now();
        mobs.tick(DT, player);
        total += performance.now() - t0;
      }
      ms = Math.min(ms, total / 200);
    }
    console.log(`[mobs perf] ${mobs.loaded.length} animals + ${mobs.hostiles.active.length} automatons + ${bolts.all.length} bolts: ${ms.toFixed(3)} ms/tick`);
    expect(mobs.hostiles.active.length).toBeGreaterThanOrEqual(8);
    expect(ms).toBeLessThan(0.8);
  });
});
