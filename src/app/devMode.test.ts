import { describe, expect, it } from 'vitest';
import { MAX_AIR_S, MAX_FOOD, MAX_HEALTH, MAX_WARMTH } from '../core/constants';
import { createBus } from '../core/context';
import { parseGameMode } from '../core/gameMode';
import { block } from '../core/registry';
import { Interaction } from '../player/interaction';
import { PlayerPhysics } from '../player/physics';
import { createRayHit, raycast } from '../player/raycast';
import { flatWorld, makePlayer } from '../player/testKit';
import { isWorldSave, normalizeDocument } from '../save/document';
import { GameState } from './state';

describe('game mode flag', () => {
  it('parses unknown values as survival', () => {
    expect(parseGameMode('dev')).toBe('dev');
    for (const raw of [undefined, null, 'survival', 'creative', 3, {}]) expect(parseGameMode(raw)).toBe('survival');
  });

  it('round-trips a dev world through the save, also as JSON text', () => {
    const state = GameState.create(5, 'dev-seed', { mode: 'dev' });
    expect(state.mode).toBe('dev');
    expect(state.player.dev).toBe(true);
    const save = JSON.parse(state.toSaveJson());
    expect(save.mode).toBe('dev');
    expect(isWorldSave(save)).toBe(true);
    const back = GameState.restore(save);
    expect(back.mode).toBe('dev');
    expect(back.player.dev).toBe(true);
    expect(back.toSave().mode).toBe('dev');
    state.dispose();
    back.dispose();
  });

  it('survival worlds write no mode and old saves (no field) load as survival', () => {
    const state = GameState.create(5, null);
    expect(state.mode).toBe('survival');
    expect(state.player.dev).toBe(false);
    const save = state.toSave();
    expect('mode' in save).toBe(false);
    const back = GameState.restore(JSON.parse(JSON.stringify(save)));
    expect(back.mode).toBe('survival');
    expect(back.player.dev).toBe(false);
    state.dispose();
    back.dispose();
  });

  it('a damaged mode value in a stored document is dropped, not trusted', () => {
    const state = GameState.create(5, null, { mode: 'dev' });
    const world = JSON.parse(state.toSaveJson());
    const doc = normalizeDocument({ settings: {}, world: { ...world, mode: 'dev' } });
    expect(doc?.world?.mode).toBe('dev');
    const odd = normalizeDocument({ settings: {}, world: { ...world, mode: 'godmode' } });
    expect(odd?.world).not.toBeNull();
    expect(odd?.world?.mode).toBeUndefined();
    state.dispose();
  });
});

describe('dev rules', () => {
  it('no damage of any kind, no starving, no freezing, no drowning', () => {
    const state = GameState.create(9, null, { mode: 'dev' });
    const p = state.player;
    p.damage(15, 'fall');
    p.damage(5, 'lava');
    expect(p.health).toBe(MAX_HEALTH);
    p.food = 0;
    p.warmth = 0;
    p.air = 0;
    for (let i = 0; i < 200; i++) state.tick();
    expect(p.health).toBe(MAX_HEALTH);
    expect(p.food).toBe(MAX_FOOD);
    expect(p.warmth).toBe(MAX_WARMTH);
    expect(p.air).toBe(MAX_AIR_S);
    expect(p.dead).toBe(false);
    state.dispose();
  });

  it('survival is unchanged: damage and hunger still happen', () => {
    const state = GameState.create(9, null);
    state.player.damage(5, 'fall');
    expect(state.player.health).toBe(MAX_HEALTH - 5);
    state.player.food = 3;
    for (let i = 0; i < 40; i++) state.tick();
    expect(state.player.food).toBeLessThan(MAX_FOOD);
    state.dispose();
  });

  it('tools never wear in dev mode and wear in survival', () => {
    for (const dev of [true, false]) {
      const player = makePlayer(createBus());
      player.dev = dev;
      player.give('flint_pickaxe', 1);
      player.selectSlot(0);
      const before = player.heldStack()?.durability;
      expect(before).toBeGreaterThan(3);
      expect(player.wearHeldTool(3)).toBe(false);
      expect(player.heldStack()?.durability).toBe(dev ? before : before! - 3);
    }
  });

  it('placing does not use the block up in dev mode (unless free placing is off), and does in survival', () => {
    const run = (dev: boolean, free = true): number => {
      const bus = createBus();
      const world = flatWorld(bus);
      const player = makePlayer(bus);
      player.dev = dev;
      player.devFreePlace = free;
      player.inventory.set(player.selectedSlot, { item: 'stone', count: 5 });
      const physics = new PlayerPhysics(world, player);
      const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
      const hit = raycast(world, 0.5, player.eyeY, 0.5, 2, 9.5 - player.eyeY, 0, 5, false, createRayHit());
      expect(interaction.use(hit)).toBe('placed');
      expect(world.getBlock(2, 9, 0).key).toBe(block('stone').key);
      return player.inventory.count('stone');
    };
    expect(run(true)).toBe(5);
    expect(run(true, false)).toBe(4);
    expect(run(false)).toBe(4);
  });
});

describe('switching Dev Mode in a running world', () => {
  it('turns on and off any time: rules, flight and the save follow', () => {
    const state = GameState.create(5, 'five');
    const toasts: string[] = [];
    state.bus.on('toast', (t) => toasts.push(t.text));
    expect(state.mode).toBe('survival');
    expect(state.player.dev).toBe(false);
    expect('mode' in state.toSave()).toBe(false);
    state.setMode('dev');
    expect(state.mode).toBe('dev');
    expect(state.player.dev).toBe(true);
    expect(state.toSave().mode).toBe('dev');
    state.player.flying = true;
    state.player.devFreePlace = false;
    state.player.health = 3;
    state.tick();
    expect(state.player.health).toBe(MAX_HEALTH);
    state.setMode('survival');
    expect(state.player.dev).toBe(false);
    expect(state.player.flying).toBe(false);
    expect(state.player.devFreePlace).toBe(true);
    expect('mode' in state.toSave()).toBe(false);
    state.player.health = 3;
    state.tick();
    expect(state.player.health).toBeLessThanOrEqual(3.01);
    expect(toasts).toEqual(['Dev Mode on', 'Dev Mode off - back to survival']);
    state.dispose();
  });
});
