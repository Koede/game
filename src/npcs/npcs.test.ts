import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockOf } from '../core/registry';
import { GameState } from '../app/state';
import { paintNpc, SPRITE_H, SPRITE_W } from '../render/npcs/sprites';
import { NPCS, TAVERN_D, TAVERN_H, TAVERN_START, TAVERN_W, layoutBlocks, NpcManager } from './index';

describe('the tavern layout', () => {
  const blocks = layoutBlocks();
  const at = (x: number, y: number, z: number): string | undefined => [...blocks].reverse().find((b) => b.x === x && b.y === y && b.z === z)?.block;

  it('fits its box and uses only real blocks', () => {
    for (const b of blocks) {
      expect(b.x >= 0 && b.x < TAVERN_W && b.y >= 0 && b.y <= TAVERN_H && b.z >= 0 && b.z < TAVERN_D, `${b.block} ${b.x},${b.y},${b.z}`).toBe(true);
    }
    const keys = new Set(blocks.map((b) => b.block));
    for (const k of keys) expect(['air', 'plank', 'stone_brick', 'oak_log', 'glass', 'crate', 'torch', 'chopping_block', 'furnace_clay', 'brick', 'workbench']).toContain(k);
  });

  it('leaves the start cell, the door and every person free to stand in', () => {
    const [sx, sy, sz] = TAVERN_START;
    for (const [x, y, z] of [[sx, sy, sz], [sx, sy + 1, sz], [6, 1, 0], [6, 2, 0], [6, 1, 1]]) {
      const b = at(x, y, z);
      expect(b === undefined || b === 'air', `${x},${y},${z} is ${b}`).toBe(true);
    }
    for (const n of NPCS) {
      for (const dy of [0, 1]) {
        const b = at(n.at[0], n.at[1] + dy, n.at[2]);
        expect(b === undefined || b === 'air', `${n.name} stands in ${b}`).toBe(true);
      }
      expect(at(n.at[0], n.at[1] - 1, n.at[2]), `${n.name} has a floor`).toBe('plank');
    }
  });

  it('has a roof, a floor, a bar, a fireplace and windows', () => {
    expect(at(6, TAVERN_H, 4)).toBe('plank');
    expect(at(6, 0, 4)).toBe('plank');
    expect(at(5, 1, 5)).toBe('plank');
    expect(at(11, 1, 2)).toBe('furnace_clay');
    expect(blocks.filter((b) => b.block === 'glass').length).toBeGreaterThanOrEqual(8);
  });
});

describe('talking', () => {
  function rig() {
    const bus = createBus();
    const given: Array<[string, number]> = [];
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    const npcs = new NpcManager(bus);
    let goal: string | null = 'gather_logs';
    npcs.bind({ give: (item, n) => (given.push([item, n]), n), currentGoal: () => goal });
    npcs.at = [100, 40, 100];
    return { npcs, given, toasts, setGoal: (g: string | null) => (goal = g) };
  }

  it('finds a person under the crosshair and nobody behind a wall of air', () => {
    const { npcs } = rig();
    const mara = npcs.views().find((v) => v.id === 'mara')!;
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1)?.npc.id).toBe('mara');
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, -1)).toBeNull();
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 8, 0, 0, 1)).toBeNull(); // out of reach
  });

  it('does not read the whole script while Use is held', () => {
    const { npcs, toasts } = rig();
    const mara = npcs.views().find((v) => v.id === 'mara')!;
    for (let i = 0; i < 5; i++) expect(npcs.talk(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1)).toBe(true);
    expect(toasts).toHaveLength(1);
    npcs.tick(1);
    npcs.talk(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1);
    expect(toasts).toHaveLength(2);
  });

  it('gives each gift once, then goal hints and rotating lines', () => {
    const { npcs, given, toasts, setGoal } = rig();
    const gruk = NPCS.find((n) => n.id === 'gruk')!;
    npcs.speak(gruk);
    expect(given).toEqual([['wooden_pickaxe', 1], ['wooden_axe', 1]]);
    npcs.speak(gruk);
    expect(given).toHaveLength(2);
    expect(toasts[0]).toContain('Wooden tools');
    setGoal('make_bronze');
    npcs.speak(gruk);
    expect(toasts[2]).toContain('Copper and tin');
    npcs.speak(gruk);
    expect(toasts[3]).not.toContain('Copper and tin');
  });

  it('greets once and round-trips through the save', () => {
    const { npcs, toasts } = rig();
    npcs.greet();
    npcs.greet();
    expect(toasts.filter((t) => t.includes('tavern'))).toHaveLength(1);
    npcs.speak(NPCS[0]);
    const back = rig().npcs;
    back.load(JSON.parse(JSON.stringify(npcs.toJSON())));
    expect(back.at).toEqual([100, 40, 100]);
    expect(back.greeted).toBe(true);
    expect(back.toJSON().gifted).toEqual(['mara']);
    back.load({ at: 'bad', gifted: 5, spoken: { x: 'y' } });
    expect(back.at).toBeNull();
    expect(back.toJSON().gifted).toEqual([]);
  });
});

describe('the sprites', () => {
  it('draw an outlined, mostly transparent figure for each person', () => {
    for (const kind of ['witch', 'barkeep', 'orc'] as const) {
      const img = paintNpc(kind);
      expect([img.w, img.h, img.data.length]).toEqual([SPRITE_W, SPRITE_H, SPRITE_W * SPRITE_H * 4]);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) opaque++;
      expect(opaque, kind).toBeGreaterThan(250);
      expect(opaque, kind).toBeLessThan(SPRITE_W * SPRITE_H * 0.75);
    }
    expect(paintNpc('witch').data).not.toEqual(paintNpc('orc').data);
  });
});

describe('a new world opens in the tavern', () => {
  it('builds the hall round the spawn, stands the player inside facing the bar, and saves it', () => {
    const state = GameState.create(21, 'tavern');
    const o = state.npcs.at!;
    expect(o).not.toBeNull();
    const p = state.player.position;
    expect([Math.floor(p.x) - o[0], Math.floor(p.z) - o[2]]).toEqual([TAVERN_START[0], TAVERN_START[2]]);
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1], o[2] + 4)).key).toBe('plank');
    expect(blockOf(state.world.getVoxel(o[0] + 5, o[1] + 1, o[2] + 5)).key).toBe('plank');
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1] + 1, o[2] + 2)).key).toBe('air');
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1] + TAVERN_H, o[2] + 4)).key).toBe('plank');
    expect(state.npcs.views().map((v) => v.name)).toEqual(['Mara', 'Rosa', 'Gruk']);
    const save = state.toSave();
    expect((save.world.extras as { npcs?: { at: number[] } }).npcs?.at).toEqual(o);
    const again = GameState.restore(JSON.parse(JSON.stringify(save)));
    expect(again.npcs.at).toEqual(o);
    again.dispose();
    state.dispose();
  });
});
