import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
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
    expect([...copy.world.entities()].filter(isFurnace)).toHaveLength(1);
    state.dispose();
    copy.dispose();
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
