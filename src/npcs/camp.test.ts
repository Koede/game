import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { createBus } from '../core/context';
import { blockOf } from '../core/registry';
import { CAMP_D, CAMP_FIRES, CAMP_ROUTINES, CAMP_START, CAMP_W } from './camp';
import { NPCS } from './data';
import { NpcManager } from './manager';
import { walkable } from './nav';
import { settledWorld } from './settledWorld';

const names = (state: GameState): string[] => state.npcs.views().map((v) => v.name);
const everyone = NPCS.map((n) => n.id);

describe('a new world starts at a camp', () => {
  it('has no tavern: only Gruk lives there, and he is the one drawn and talkable', () => {
    const state = GameState.create(31, null);
    expect(state.npcs.camp).toBe(true);
    expect(state.npcs.hasTavern).toBe(false);
    expect(names(state)).toEqual(['Gruk']);
    for (const id of ['mara', 'rosa', 'orrin', 'veyra', 'bram']) expect(state.npcs.isPresent(id), id).toBe(false);
    state.dispose();
  });

  it('builds the cart, a lit campfire and two bedrolls, and the player and Gruk start beside them', () => {
    const state = GameState.create(32, null);
    const o = state.npcs.at!;
    expect(blockOf(state.world.getVoxel(o[0] + 1, o[1] + 1, o[2] + 1)).key).toBe('plank'); // the cart's low body
    expect(blockOf(state.world.getVoxel(o[0] + 0, o[1] + 1, o[2] + 0)).key).toBe('oak_log'); // a wheel
    // Nothing of the cart hangs over head height (the old cart had a plank bed at y + 2 that read as a roof).
    for (let x = 0; x <= 3; x++) for (let z = 0; z <= 2; z++) expect(blockOf(state.world.getVoxel(o[0] + x, o[1] + 3, o[2] + z)).key).toBe('air');
    expect(blockOf(state.world.getVoxel(o[0] + 7, o[1] + 1, o[2] + 1)).key).toBe('wool_bedding');
    expect(blockOf(state.world.getVoxel(o[0] + 7, o[1] + 1, o[2] + 3)).key).toBe('wool_bedding');
    const [fx, fy, fz] = CAMP_FIRES[0];
    expect(blockOf(state.world.getVoxel(o[0] + fx, o[1] + fy, o[2] + fz)).key).toBe('furnace_clay');
    for (let i = 0; i < 200; i++) state.tick();
    expect(state.sim.furnaceAt(o[0] + fx, o[1] + fy, o[2] + fz)?.lit).toBe(true);
    const gruk = state.npcs.views().find((v) => v.name === 'Gruk')!;
    expect(gruk.x - o[0]).toBeGreaterThanOrEqual(0);
    expect(gruk.x - o[0]).toBeLessThan(CAMP_W);
    expect(gruk.z - o[2]).toBeGreaterThanOrEqual(0);
    expect(gruk.z - o[2]).toBeLessThan(CAMP_D);
    expect(state.player.position.x).toBeCloseTo(o[0] + CAMP_START[0] + 0.5, 5);
    state.dispose();
  });

  it('keeps Gruk at the camp: his routine spots are walkable camp cells', () => {
    for (const [phase, [x, , z]] of Object.entries(CAMP_ROUTINES.gruk)) expect(walkable(x, z, true), phase).toBe(true);
  });

  it('gives the wooden tools on first talk, as before', () => {
    const state = GameState.create(33, null);
    const gruk = NPCS.find((n) => n.id === 'gruk')!;
    state.npcs.speak(gruk);
    expect(state.player.inventory.count('wooden_pickaxe')).toBeGreaterThan(0);
    expect(state.player.inventory.count('wooden_axe')).toBeGreaterThan(0);
    state.dispose();
  });
});

describe('the people-gated features are off while their person is away', () => {
  it('favours are pinned only for people who live here', () => {
    const state = GameState.create(41, null);
    state.npcs.tick(0.1);
    const pinned = state.npcs.pinnedFavours();
    expect(pinned.length).toBeGreaterThan(0);
    expect(pinned.every((f) => f.who === 'gruk')).toBe(true);
    state.dispose();
  });

  it('gossip needs two people: none is overheard in a camp with one', () => {
    const state = GameState.create(42, null);
    for (let i = 0; i < 1200; i++) state.npcs.tick(0.5);
    expect(state.npcs.overheard()).toBeNull();
    state.dispose();
  });

  it('Rosa, Veyra and Old Bram do not talk or sell while absent', () => {
    const state = GameState.create(43, null);
    for (const id of ['rosa', 'veyra', 'bram']) {
      const npc = NPCS.find((n) => n.id === id)!;
      expect(state.npcs.speak(npc), id).toBe('');
    }
    expect(state.npcs.serviceMenu('rosa').pitch(state.npcs.servicePort('rosa'))).toBeNull();
    expect(state.npcs.serviceMenu('veyra').pitch(state.npcs.servicePort('veyra'))).toBeNull();
    state.dispose();
  });

  it("Gruk's hire and sparring are off while he is away", () => {
    const m = new NpcManager(createBus());
    m.load({ v: 1, at: [100, 40, 100], greeted: true, gifted: [], spoken: {}, present: ['mara'] });
    const gruk = NPCS.find((n) => n.id === 'gruk')!;
    expect(m.speak(gruk)).toBe('');
    expect(m.serviceMenu('gruk').pitch(m.servicePort('gruk'))).toBeNull();
  });

  it('the festival needs three people: off in the camp on a festival night, on in a settled world', () => {
    const camp = GameState.create(44, null);
    camp.clock.day = 6; // the last day of the first season (the Sowing Fair)
    camp.clock.setTimeOfDay(0.9);
    for (let i = 0; i < 4; i++) camp.npcs.tick(0.1);
    expect(camp.npcs.festivalNow()).toBe(false);
    camp.dispose();
    const settled = settledWorld(45);
    settled.clock.day = 6;
    settled.clock.setTimeOfDay(0.9);
    for (let i = 0; i < 4; i++) settled.npcs.tick(0.1);
    expect(settled.npcs.festivalNow()).toBe(true);
    settled.dispose();
  });

  it('the wandering trader does not visit a camp', () => {
    const state = GameState.create(46, null);
    for (let day = 1; day <= 40; day++) {
      state.clock.day = day;
      state.npcs.tick(0.1);
      expect(state.npcs.trader(), `day ${day}`).toBeNull();
    }
    state.dispose();
  });

  it('the jukebox and the party button need the tavern', () => {
    const state = GameState.create(47, null);
    expect(state.npcs.useFixture('jukebox')).toBeNull();
    expect(state.npcs.useFixture('party')).toBeNull();
    state.dispose();
  });

  it('advice for an absent specialist falls back to the builder (the general advice)', () => {
    const state = GameState.create(48, null);
    const general = state.npcs.advice('artificer');
    expect(general).not.toBeNull();
    for (const role of ['witch', 'barkeep', 'alchemist'] as const) expect(state.npcs.advice(role), role).toBe(general);
    state.dispose();
  });
});

describe('who lives here is saved', () => {
  it('an old save (no present field) keeps its tavern and all six people', () => {
    const m = new NpcManager(createBus());
    m.load({ v: 1, at: [100, 40, 100], greeted: true, gifted: [], spoken: {} });
    expect(m.hasTavern).toBe(true);
    for (const id of everyone) expect(m.isPresent(id), id).toBe(true);
  });

  it('a camp saves Gruk alone and restores as a camp', () => {
    const state = GameState.create(51, null);
    const save = JSON.parse(JSON.stringify(state.toSave())) as { world: { extras: { npcs: { present: string[]; camp: boolean } } } };
    expect(save.world.extras.npcs.present).toEqual(['gruk']);
    expect(save.world.extras.npcs.camp).toBe(true);
    const again = GameState.restore(save as never);
    expect(again.npcs.camp).toBe(true);
    expect(again.npcs.isPresent('rosa')).toBe(false);
    expect(names(again)).toEqual(['Gruk']);
    again.dispose();
    state.dispose();
  });

  it('a settled world saves everyone with the tavern', () => {
    const state = settledWorld(52);
    const save = JSON.parse(JSON.stringify(state.toSave())) as { world: { extras: { npcs: { present: string[]; camp: boolean } } } };
    expect([...save.world.extras.npcs.present].sort()).toEqual([...everyone].sort());
    expect(save.world.extras.npcs.camp).toBe(false);
    const again = GameState.restore(save as never);
    expect(again.npcs.hasTavern).toBe(true);
    again.dispose();
    state.dispose();
  });

  it('present round-trips through the snapshot and drops unknown ids', () => {
    const m = new NpcManager(createBus());
    m.load({ v: 1, at: [1, 1, 1], greeted: false, gifted: [], spoken: {}, present: ['gruk', 'mara', 'nobody'] });
    expect(m.toJSON().present).toEqual(['gruk', 'mara']);
    expect(m.toJSON().camp).toBe(false);
  });
});
