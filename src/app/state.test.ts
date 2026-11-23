import { describe, expect, it } from 'vitest';
import { blockId, creature } from '../core/registry';
import { Facing, makeVoxel } from '../core/types';
import { isWorldSave } from '../save/document';
import { isFurnace } from '../sim';
import { GameState, seedFrom } from './state';

/** A world with a lit clay furnace next to the player and a few things in the pack. */
function playedState(): { state: GameState; fx: number; fy: number; fz: number } {
  const state = GameState.create(7, 'seven');
  const p = state.player.position;
  const fx = Math.floor(p.x) + 2;
  const fz = Math.floor(p.z);
  const fy = state.world.surfaceY(fx, fz) + 1;
  expect(state.world.setVoxel(fx, fy, fz, makeVoxel(blockId('furnace_clay'), Facing.West), 'player')).toBe(true);
  const slots = state.sim.furnaceSlots(fx, fy, fz);
  expect(slots).not.toBeNull();
  slots!.fuel.add('oak_log', 6);
  slots!.crucibleIn.add('tin_ore', 3);
  expect(state.sim.light(fx, fy, fz)).toEqual({ ok: true });
  state.player.give('plank', 7);
  state.player.give('flint_pickaxe', 1);
  state.bus.emit('block:broken', { x: 0, y: 0, z: 0, voxel: makeVoxel(blockId('oak_log')) });
  for (let i = 0; i < 400; i++) state.tick();
  return { state, fx, fy, fz };
}

describe('GameState', () => {
  it('starts a new world at the spawn point, on the ground, at early morning', () => {
    const state = GameState.create(11, null);
    const spawn = state.world.spawnPoint();
    expect(state.player.position).toEqual({ x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5 });
    expect(state.world.isLoaded(spawn.x, spawn.z)).toBe(true);
    expect(state.clock.timeOfDay).toBeCloseTo(0.05, 5);
    expect(state.objectives.current?.id).toBe('gather_logs');
    state.dispose();
  });

  it('round-trips a session through JSON and continues identically', () => {
    const { state, fx, fy, fz } = playedState();
    const furnace = state.sim.furnaceAt(fx, fy, fz)!;
    expect(furnace.lit).toBe(true);
    expect(furnace.tempC).toBeGreaterThan(100);

    const save = JSON.parse(JSON.stringify(state.toSave())) as unknown;
    expect(isWorldSave(save)).toBe(true);
    if (!isWorldSave(save)) return;
    const copy = GameState.restore(save);
    copy.prepareAroundPlayer(1);

    expect(copy.world.seed).toBe(state.world.seed);
    expect(copy.seedText).toBe('seven');
    expect(copy.player.position).toEqual(state.player.position);
    expect(copy.player.inventory.toJSON()).toEqual(state.player.inventory.toJSON());
    expect(copy.player.home).toEqual({ x: fx, y: fy, z: fz });
    expect(copy.clock.toJSON()).toEqual(state.clock.toJSON());
    expect(copy.objectives.toJSON()).toEqual(state.objectives.toJSON());
    expect(copy.playTimeS).toBeCloseTo(state.playTimeS, 9);
    expect(state.journal.seenCells).toBeGreaterThan(0);
    expect(copy.journal.seenCells).toBe(state.journal.seenCells);
    expect(copy.achievements.toJSON()).toEqual(state.achievements.toJSON());
    expect(state.achievements.has('first_steps')).toBe(true);
    expect(copy.world.getVoxel(fx, fy, fz)).toBe(state.world.getVoxel(fx, fy, fz));
    const restored = copy.sim.furnaceAt(fx, fy, fz)!;
    expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(JSON.stringify(furnace)));

    for (let i = 0; i < 300; i++) {
      state.tick();
      copy.tick();
    }
    const a = state.sim.furnaceAt(fx, fy, fz)!;
    const b = copy.sim.furnaceAt(fx, fy, fz)!;
    expect(b.tempC).toBeCloseTo(a.tempC, 6);
    expect(b.crucibleOut).toEqual(a.crucibleOut);
    expect(b.fuel).toEqual(a.fuel);
    expect(copy.player.warmth).toBeCloseTo(state.player.warmth, 6);
    // The test's furnace, the tavern's fireplace and the hermit's fire.
    expect([...copy.world.entities()].filter(isFurnace)).toHaveLength(3);
    state.dispose();
    copy.dispose();
  });

  it('ticks flowing water, saves it mid-flow and continues it identically (spec 18.2)', () => {
    const state = GameState.create(7, 'seven');
    const p = state.player.position;
    const x = Math.floor(p.x) + 3;
    const z = Math.floor(p.z) + 3;
    const y = state.world.surfaceY(x, z) + 6;
    // A hanging source a few blocks above the ground: it pours down and spreads.
    expect(state.world.setVoxel(x, y, z, makeVoxel(blockId('water')), 'player')).toBe(true);
    for (let i = 0; i < 40; i++) state.tick();
    expect(state.world.water.stats().changes).toBeGreaterThan(3);
    expect(state.world.water.stats().pending).toBeGreaterThan(0);
    const save = JSON.parse(JSON.stringify(state.toSave())) as unknown;
    if (!isWorldSave(save)) throw new Error('not a world save');
    const copy = GameState.restore(save);
    copy.prepareAroundPlayer(1);
    for (let i = 0; i < 300; i++) {
      state.tick();
      copy.tick();
    }
    for (let dy = -8; dy <= 0; dy++) {
      for (let dz = -9; dz <= 9; dz++) {
        for (let dx = -9; dx <= 9; dx++) expect(copy.world.getVoxel(x + dx, y + dy, z + dz)).toBe(state.world.getVoxel(x + dx, y + dy, z + dz));
      }
    }
    expect(copy.world.water.stats().changes).toBeGreaterThan(0);
    state.dispose();
    copy.dispose();
  });

  it('saves the weather, continues it identically, and loads saves made before the weather existed', () => {
    const { state } = playedState();
    state.weather.force('storm', state.clock.worldTimeS);
    for (let i = 0; i < 200; i++) state.tick();
    expect(state.weather.state.kind).toBe('storm');
    expect(state.sim.weather.wind).toBeCloseTo(1.5, 1);
    expect(state.survival.weather).toBe(state.weather.state);
    const save = JSON.parse(JSON.stringify(state.toSave())) as unknown;
    if (!isWorldSave(save)) throw new Error('not a save');
    expect(save.weather?.forced?.kind).toBe('storm');
    const copy = GameState.restore(save);
    expect(copy.weather.state).toEqual(state.weather.state);
    for (let i = 0; i < 300; i++) {
      state.tick();
      copy.tick();
    }
    expect(copy.weather.state).toEqual(state.weather.state);

    const old = { ...save };
    delete old.weather;
    expect(isWorldSave(old)).toBe(true);
    const fresh = GameState.restore(old);
    expect(fresh.weather.state.kind).toBe(fresh.weather.schedule.at(fresh.clock.worldTimeS).kind);
    const broken = GameState.restore({ ...save, weather: { state: 'storm' } as never });
    expect(broken.weather.override).toBeNull();
    for (const s of [state, copy, fresh, broken]) s.dispose();
  });

  it('runs the animals: spawned around the player, saved, restored, and old saves without them still load', () => {
    const { state } = playedState();
    // The spawn guarantee and the chunk rolls put animals around a new world's spawn once its area is loaded.
    state.prepareAroundPlayer(3);
    for (let i = 0; i < 40; i++) state.tick();
    expect(state.mobs.all.length).toBeGreaterThan(0);
    const save = JSON.parse(JSON.stringify(state.toSave())) as unknown;
    if (!isWorldSave(save)) throw new Error('not a save');
    expect(save.mobs?.mobs.length).toBe(state.mobs.all.length);
    const copy = GameState.restore(save);
    expect(copy.mobs.toJSON()).toEqual(state.mobs.toJSON());

    const old = { ...save };
    delete old.mobs;
    expect(isWorldSave(old)).toBe(true);
    const fresh = GameState.restore(old);
    expect(fresh.mobs.all).toHaveLength(0);
    const broken = GameState.restore({ ...save, mobs: { version: 1, mobs: 'goats' } as never });
    expect(broken.mobs.all).toHaveLength(0);
    for (const s of [state, copy, fresh, broken]) s.dispose();
  });

  it('drops what an animal the player kills carries as items that fly to the player', () => {
    const state = GameState.create(7, null);
    const p = state.player.position;
    const hen = state.mobs.add(creature('hen'), { x: p.x + 2, y: p.y, z: p.z, yaw: 0 });
    const before = state.player.inventory.count('raw_fowl');
    const r = state.mobs.hit(hen.id, 99, p.x, p.z);
    expect(r).toEqual({ ok: true, health: 0, killed: true });
    for (let i = 0; i < 40; i++) state.tick(); // the animal tips over and its drop falls
    const [lying] = state.player.ground.items;
    expect(lying?.item).toBe('raw_fowl');
    expect(state.player.inventory.count('raw_fowl')).toBe(before); // it lies there until the player walks up
    p.x = lying.x;
    p.z = lying.z;
    p.y = lying.y;
    for (let i = 0; i < 20; i++) state.tick();
    expect(state.player.inventory.count('raw_fowl')).toBe(before + 1);
    state.dispose();
  });

  it('toSaveJson is the same save, serialised once from the live entities', () => {
    const { state, fx, fy, fz } = playedState();
    const text = state.toSaveJson();
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(state.toSave())));
    // toSave() stays a copy: changing the live furnace afterwards does not change a snapshot taken before.
    const snap = state.toSave();
    const before = JSON.stringify(snap);
    for (let i = 0; i < 40; i++) state.tick();
    expect(state.world.getEntity(fx, fy, fz)).toBeDefined();
    expect(JSON.stringify(snap)).toBe(before);
    expect(isWorldSave(JSON.parse(text))).toBe(true);
    state.dispose();
  });

  it('refuses a broken world snapshot without side effects', () => {
    const { state } = playedState();
    const save = state.toSave();
    const bad = { ...save, world: { ...save.world, version: 99 } };
    expect(() => GameState.restore(bad)).toThrow();
    state.dispose();
  });

  it('turns a new player towards open ground', () => {
    const state = GameState.create(3, null);
    expect(Number.isFinite(state.player.yaw)).toBe(true);
    expect(Math.abs(state.player.yaw)).toBeLessThanOrEqual(Math.PI);
    state.dispose();
  });
});

describe('seedFrom', () => {
  it('uses numbers as they are, hashes words, and picks a random seed for nothing', () => {
    expect(seedFrom('42')).toBe(42);
    expect(seedFrom(' hearth ')).toBe(seedFrom('hearth'));
    expect(seedFrom('hearth')).not.toBe(seedFrom('watt'));
    expect(seedFrom(null, () => 0.5)).toBe(Math.floor(0.5 * 0xffffffff));
    expect(seedFrom('', () => 0)).toBe(0);
  });
});
