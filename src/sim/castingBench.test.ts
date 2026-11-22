import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { FLAG_FIRST_POUR, MOLTEN_WINDOW_S, MOULD_POURS } from '../core/constants';
import { block, blockId, isItemEndpoint, machine, pipeJoins } from '../core/registry';
import { Face, makeVoxel } from '../core/types';
import { pipeArmMask } from '../player/pipeAim';
import { isWorldSave, SAVE_VERSION } from '../save/document';
import type { FurnaceEntity, MachineEntity } from './entities';
import { sanitizeEntity } from './sanitize';
import { makeKit, type Kit } from './testKit';

function hold(kit: Kit, item: string, durability?: number): void {
  kit.player.inventory.set(kit.player.selectedSlot, durability === undefined ? { item, count: 1 } : { item, count: 1, durability });
}

function bench(kit: Kit, x: number, y: number, z: number): MachineEntity {
  kit.world.put(x, y, z, 'casting_bench');
  const e = kit.world.getEntity(x, y, z) as MachineEntity;
  if (!e || e.kind !== 'casting_bench') throw new Error(`no casting bench at ${x},${y},${z}`);
  return e;
}

function furnace(kit: Kit, x = 0, y = 1, z = 0): FurnaceEntity {
  return kit.furnace(x, y, z);
}

const molten = (e: FurnaceEntity, ingot: string, count: number): void => {
  e.crucibleMelt[0] = { item: ingot, count };
  e.crucibleMoltenS[0] = MOLTEN_WINDOW_S;
};

describe('setting and taking moulds', () => {
  it('takes four moulds, pours left and all, and refuses a fifth', () => {
    const kit = makeKit();
    const e = bench(kit, 1, 1, 0);
    expect(e.slots).toHaveLength(4);
    expect(machine('casting_bench').slots).toBe(4);
    for (let i = 0; i < 4; i++) {
      hold(kit, i === 3 ? 'hoe_mould' : 'ingot_mould', 30 - i);
      expect(kit.sim.useBench(1, 1, 0, kit.player.heldStack()?.item ?? null)).toEqual({ ok: true });
    }
    expect(e.slots.map((s) => s && { item: s.item, durability: s.durability })).toEqual([
      { item: 'ingot_mould', durability: 30 },
      { item: 'ingot_mould', durability: 29 },
      { item: 'ingot_mould', durability: 28 },
      { item: 'hoe_mould', durability: 27 },
    ]);
    hold(kit, 'axe_mould', 11);
    expect(kit.sim.useBench(1, 1, 0, 'axe_mould')).toEqual({ ok: false, reason: 'The casting bench holds 4 moulds' });
    expect(kit.player.heldStack()).toMatchObject({ item: 'axe_mould', durability: 11 });
    expect(e.slots[3]?.item).toBe('hoe_mould');
  });

  it('an empty hand takes the last mould back, and an empty bench says so', () => {
    const kit = makeKit();
    const e = bench(kit, 1, 1, 0);
    hold(kit, 'ingot_mould', 8);
    kit.sim.useBench(1, 1, 0, 'ingot_mould');
    hold(kit, 'pickaxe_mould', 3);
    kit.sim.useBench(1, 1, 0, 'pickaxe_mould');
    kit.player.inventory.set(kit.player.selectedSlot, null);
    expect(kit.sim.useBench(1, 1, 0, null)).toEqual({ ok: true });
    expect(e.slots[0]).toMatchObject({ item: 'ingot_mould', durability: 8 });
    expect(e.slots[1]).toBeNull();
    expect(kit.player.inventory.slots.find((s) => s?.item === 'pickaxe_mould')).toMatchObject({ durability: 3 });
    kit.player.inventory.set(0, null);
    expect(kit.sim.useBench(1, 1, 0, null)).toEqual({ ok: true });
    expect(kit.sim.useBench(1, 1, 0, null)).toEqual({ ok: false, reason: 'The casting bench is empty' });
  });

  it('leaves the mould where it is when the pack is full', () => {
    const kit = makeKit();
    const e = bench(kit, 1, 1, 0);
    hold(kit, 'ingot_mould', 6);
    kit.sim.useBench(1, 1, 0, 'ingot_mould');
    const inv = kit.player.inventory;
    for (let i = 0; i < inv.size; i++) if (!inv.slots[i]) inv.slots[i] = { item: 'dirt', count: 1 };
    expect(kit.sim.useBench(1, 1, 0, null)).toEqual({ ok: false, reason: 'Your pack is full' });
    expect(e.slots[0]).toMatchObject({ item: 'ingot_mould', durability: 6 });
  });

  it('does not consume a held item that is not a mould', () => {
    const kit = makeKit();
    bench(kit, 1, 1, 0);
    hold(kit, 'stone_brick');
    kit.player.heldStack()!.count = 4;
    expect(kit.sim.useBench(1, 1, 0, 'stone_brick')).toBeNull();
    expect(kit.player.heldStack()?.count).toBe(4);
  });
});

describe('pouring from a furnace', () => {
  it('one Use at distance 4 fills two ingot moulds and leaves the pool short by two', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 10);
    const e = bench(kit, 4, 1, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1 };
    e.slots[1] = { item: 'ingot_mould', count: 1 };
    const poured = kit.record('cast:poured');
    const made = kit.record('item:made');
    const flags = kit.record('flag');
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: true });
    expect(kit.player.inventory.count('copper_ingot')).toBe(2);
    expect(f.crucibleMelt[0]).toEqual({ item: 'copper_ingot', count: 8 });
    expect(poured).toEqual([
      expect.objectContaining({ mould: 'ingot_mould', metal: 'copper', item: 'copper_ingot', count: 1, at: 'bench' }),
      expect.objectContaining({ mould: 'ingot_mould', metal: 'copper', item: 'copper_ingot', count: 1, at: 'bench' }),
    ]);
    expect(made).toEqual([
      { item: 'copper_ingot', count: 1, station: 'furnace', recipeId: 'cast:ingot_mould' },
      { item: 'copper_ingot', count: 1, station: 'furnace', recipeId: 'cast:ingot_mould' },
    ]);
    expect(flags.filter((g) => g.flag === FLAG_FIRST_POUR)).toHaveLength(1);
    expect(e.slots[0]?.durability).toBe(MOULD_POURS - 1);
    expect(e.slots[1]?.durability).toBe(MOULD_POURS - 1);
  });

  it('a bench five blocks away does not pour, so the screen can open', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 10);
    const e = bench(kit, 5, 1, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1 };
    const poured = kit.record('cast:poured');
    expect(kit.sim.pourBench(0, 1, 0, 0)).toBeNull();
    expect(f.crucibleMelt[0]?.count).toBe(10);
    expect(poured).toEqual([]);
    expect(kit.player.inventory.count('copper_ingot')).toBe(0);
  });

  it('skips a bronze-only mould and still casts the ingot mould after it', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 10);
    const e = bench(kit, 1, 1, 0);
    e.slots[0] = { item: 'pickaxe_mould', count: 1, durability: 40 };
    e.slots[2] = { item: 'ingot_mould', count: 1, durability: 40 };
    const poured = kit.record('cast:poured');
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: true });
    expect(kit.player.inventory.count('copper_ingot')).toBe(1);
    expect(f.crucibleMelt[0]?.count).toBe(9);
    expect(e.slots[0]).toMatchObject({ item: 'pickaxe_mould', durability: 40 });
    expect(e.slots[2]?.durability).toBe(39);
    expect(poured).toEqual([expect.objectContaining({ mould: 'ingot_mould', count: 1, at: 'bench' })]);
  });

  it('refuses a mould that needs more metal than the pool holds, and keeps the pool', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'bronze_ingot', 2);
    const e = bench(kit, 0, 1, 4);
    e.slots[0] = { item: 'pickaxe_mould', count: 1 };
    const poured = kit.record('cast:poured');
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: false, reason: 'Needs 3 molten Bronze Ingot - there is 2' });
    expect(f.crucibleMelt[0]).toEqual({ item: 'bronze_ingot', count: 2 });
    expect(poured).toEqual([]);
    expect(e.slots[0]?.durability).toBeUndefined();
  });

  it('stops when a later mould needs more than what the earlier casts left', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'bronze_ingot', 3);
    const e = bench(kit, 2, 1, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1 };
    e.slots[1] = { item: 'pickaxe_mould', count: 1 };
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: false, reason: 'Needs 3 molten Bronze Ingot - there is 2' });
    expect(kit.player.inventory.count('bronze_ingot')).toBe(1);
    expect(f.crucibleMelt[0]).toEqual({ item: 'bronze_ingot', count: 2 });
    expect(e.slots[0]?.durability).toBe(MOULD_POURS - 1);
    expect(e.slots[1]?.durability).toBeUndefined();
  });

  it('stops when the pack fills, and keeps the casts already poured', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 4);
    const e = bench(kit, 1, 2, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1 };
    e.slots[1] = { item: 'ingot_mould', count: 1 };
    const inv = kit.player.inventory;
    for (let i = 0; i < inv.size; i++) inv.slots[i] = { item: 'dirt', count: 1 };
    inv.slots[0] = { item: 'copper_ingot', count: 98 };
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: false, reason: 'Your pack is full' });
    expect(inv.count('copper_ingot')).toBe(99);
    expect(f.crucibleMelt[0]?.count).toBe(3);
    expect(e.slots[0]?.durability).toBe(MOULD_POURS - 1);
    expect(e.slots[1]?.durability).toBeUndefined();
  });

  it('a mould on its last pour breaks and the socket clears', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 3);
    const e = bench(kit, 0, 5, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1, durability: 1 };
    const broke = kit.record('tool:broke');
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: true });
    expect(e.slots[0]).toBeNull();
    expect(broke).toEqual([{ item: 'ingot_mould' }]);
    expect(kit.player.inventory.count('copper_ingot')).toBe(1);
    expect(f.crucibleMelt[0]?.count).toBe(2);
  });

  it('every mould the wrong metal names the first one, and the pool stays', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 6);
    const e = bench(kit, 1, 1, 1);
    e.slots[0] = { item: 'pickaxe_mould', count: 1 };
    e.slots[1] = { item: 'axe_mould', count: 1 };
    expect(kit.sim.pourBench(0, 1, 0, 0)).toEqual({ ok: false, reason: 'This mould does not take Copper Ingot' });
    expect(f.crucibleMelt[0]?.count).toBe(6);
    expect(e.slots.map((s) => s?.durability)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('the nearer bench wins, and a tie goes to the smaller coordinates', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 5);
    const far = bench(kit, 4, 1, 0);
    const near = bench(kit, 1, 1, 0);
    far.slots[0] = { item: 'ingot_mould', count: 1, durability: 10 };
    near.slots[0] = { item: 'ingot_mould', count: 1, durability: 10 };
    expect(kit.sim.pourBench(0, 1, 0, 0)?.ok).toBe(true);
    expect(near.slots[0]?.durability).toBe(9);
    expect(far.slots[0]?.durability).toBe(10);
    near.slots[0] = null;
    const lowX = bench(kit, 0, 1, 4);
    lowX.slots[0] = { item: 'ingot_mould', count: 1, durability: 4 };
    expect(kit.sim.pourBench(0, 1, 0, 0)?.ok).toBe(true);
    expect(lowX.slots[0]?.durability).toBe(3);
    expect(far.slots[0]?.durability).toBe(10);
  });

  it('a mould in the hand still pours the whole pool and leaves the bench alone', () => {
    const kit = makeKit();
    const f = furnace(kit);
    molten(f, 'copper_ingot', 5);
    hold(kit, 'ingot_mould');
    const e = bench(kit, 1, 1, 0);
    e.slots[0] = { item: 'ingot_mould', count: 1, durability: 40 };
    const poured = kit.record('cast:poured');
    expect(kit.sim.pourCrucible(0, 1, 0, 0, 'ingot_mould').ok).toBe(true);
    expect(kit.player.inventory.count('copper_ingot')).toBeGreaterThan(1);
    expect(poured).toEqual([expect.objectContaining({ count: 5, at: 'furnace' })]);
    expect(e.slots[0]?.durability).toBe(40);
  });
});

describe('pipes and saves', () => {
  it('an item pipe grows no arm toward the bench', () => {
    expect(machine('casting_bench').itemPipes).toBe(false);
    expect(isItemEndpoint(block('casting_bench'))).toBe(false);
    expect(pipeJoins(block('item_pipe'), block('casting_bench'))).toBe(false);
    expect(pipeJoins(block('fast_item_pipe'), block('casting_bench'))).toBe(false);
    const kit = makeKit();
    kit.world.put(0, 2, 0, 'item_pipe');
    kit.world.put(1, 2, 0, 'casting_bench');
    kit.world.put(0, 2, -1, 'crate');
    const arms = pipeArmMask(kit.world, 0, 2, 0);
    expect(arms & (1 << Face.PX)).toBe(0);
    expect(arms & (1 << Face.NZ)).toBe(1 << Face.NZ);
  });

  it('keeps the four sockets through a save and load, without a new save version', () => {
    expect(SAVE_VERSION).toBe(2); // the six-age migration made it 2; the bench itself adds no bump
    const state = GameState.create(3, 'bench');
    const p = state.player.position;
    const x = Math.floor(p.x) + 1;
    const z = Math.floor(p.z);
    const y = state.world.surfaceY(x, z) + 1;
    expect(state.world.setVoxel(x, y, z, makeVoxel(blockId('casting_bench')), 'player')).toBe(true);
    const before = state.world.getEntity(x, y, z) as MachineEntity;
    before.slots[0] = { item: 'ingot_mould', count: 1, durability: 12 };
    before.slots[2] = { item: 'hoe_mould', count: 1, durability: 7 };
    const save = JSON.parse(JSON.stringify(state.toSave())) as unknown;
    expect(isWorldSave(save)).toBe(true);
    if (!isWorldSave(save)) return;
    state.dispose();
    const copy = GameState.restore(save);
    copy.prepareAroundPlayer(1);
    const back = copy.world.getEntity(x, y, z) as MachineEntity;
    expect(back.slots).toEqual([
      { item: 'ingot_mould', count: 1, durability: 12 },
      null,
      { item: 'hoe_mould', count: 1, durability: 7 },
      null,
    ]);
    expect(copy.sim.machineAt(x, y, z)).toBeNull();
    expect(copy.sim.useBench(x, y, z, null)).toEqual({ ok: true });
    expect(copy.player.inventory.slots.find((s) => s?.item === 'hoe_mould')).toMatchObject({ durability: 7 });
    expect((copy.world.getEntity(x, y, z) as MachineEntity).slots[0]).toEqual({ item: 'ingot_mould', count: 1, durability: 12 });
    copy.dispose();
  });
});

describe('the bench is not a power node', () => {
  it('stores four slots, stays out of the node map, and spills them when broken', () => {
    const kit = makeKit();
    const e = bench(kit, 2, 3, 4);
    e.slots[0] = { item: 'ingot_mould', count: 1, durability: 9 };
    e.slots[3] = { item: 'hoe_mould', count: 1, durability: 2 };
    expect(kit.sim.machineAt(2, 3, 4)).toBeNull();
    expect(kit.sim.networkAt(2, 3, 4)).toBeNull();
    kit.run(1);
    kit.sim.resync();
    expect(kit.sim.machineAt(2, 3, 4)).toBeNull();
    expect(kit.world.getEntity(2, 3, 4)).toBe(e);
    expect(e.slots[0]).toMatchObject({ item: 'ingot_mould', durability: 9 });
    kit.world.put(2, 3, 4, 'air');
    expect(kit.world.getEntity(2, 3, 4)).toBeUndefined();
    const spilled = kit.player.ground.items.filter((g) => g.item === 'ingot_mould' || g.item === 'hoe_mould');
    expect(spilled.map((g) => ({ item: g.item, durability: g.durability })).sort((a, b) => a.item.localeCompare(b.item))).toEqual([
      { item: 'hoe_mould', durability: 2 },
      { item: 'ingot_mould', durability: 9 },
    ]);
    expect(kit.player.inventory.count('ingot_mould')).toBe(0);
  });

  it('sanitize keeps exactly four slots', () => {
    const short = { kind: 'casting_bench', x: 0, y: 0, z: 0, slots: [{ item: 'ingot_mould', count: 1, durability: 3 }] } as MachineEntity;
    expect(sanitizeEntity(short)).toBe('repaired');
    expect(short.slots).toHaveLength(4);
    expect(short.slots[0]).toEqual({ item: 'ingot_mould', count: 1, durability: 3 });
    expect(short.slots[3]).toBeNull();
    const long = {
      kind: 'casting_bench', x: 0, y: 0, z: 0,
      slots: [null, null, null, { item: 'axe_mould', count: 1 }, { item: 'hoe_mould', count: 1 }],
    } as MachineEntity;
    expect(sanitizeEntity(long)).toBe('repaired');
    expect(long.slots).toHaveLength(4);
    expect(long.slots[3]).toEqual({ item: 'axe_mould', count: 1 });
  });
});
