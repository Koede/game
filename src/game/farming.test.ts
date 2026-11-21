import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { BLOCKS, MACHINES, block, blockOf } from '../core/registry';
import { TILLABLE_BLOCKS } from '../content/progression';
import { AIR, Face, makeVoxel, voxelId } from '../core/types';
import { FakeWorld } from './fakeWorld';
import {
  TILLABLE,
  canTill,
  cropStage,
  isCrop,
  isHoe,
  isRipeCrop,
  isUnsupported,
  placementCell,
  plant,
  plantCell,
  plantedBy,
  till,
  tillResult,
  type UseTarget,
} from './farming';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-4, 9, -4, 4, 9, 4, 'grass');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const flags: string[] = [];
  const sfx: string[] = [];
  const placed: Array<GameEvents['block:placed']> = [];
  bus.on('flag', (e) => flags.push(e.flag));
  bus.on('sfx', (e) => sfx.push(e.name));
  bus.on('block:placed', (e) => placed.push(e));
  const hold = (key: string, count = 1, durability?: number): void =>
    player.inventory.set(player.selectedSlot, durability === undefined ? { item: key, count } : { item: key, count, durability });
  /** The top face of (x, y, z). */
  const top = (x: number, y: number, z: number): UseTarget => ({
    x, y, z, face: Face.PY, px: x, py: y + 1, pz: z, block: world.getBlock(x, y, z),
  });
  return { bus, world, player, flags, sfx, placed, hold, top };
}

describe('farming: crops', () => {
  it('knows every crop block, its stage and when it is ripe', () => {
    const crops = BLOCKS.filter(isCrop).map((b) => b.key);
    expect(crops).toEqual(MACHINES.get('crop')!.blocks);
    expect(cropStage(block('wheat_0'))).toEqual({ crop: 'wheat', stage: 0, stages: 4, ripe: false });
    expect(cropStage(block('carrot_3'))).toEqual({ crop: 'carrot', stage: 3, stages: 4, ripe: true });
    expect(isRipeCrop(block('potato_3'))).toBe(true);
    expect(isRipeCrop(block('potato_2'))).toBe(false);
    expect(cropStage(block('wild_wheat'))).toBeNull();
    expect(cropStage(block('furnace_clay'))).toBeNull();
  });

  it('seeds, potatoes and carrots plant their stage-0 crop; nothing else does', () => {
    expect(plantedBy('wheat_seeds')?.key).toBe('wheat_0');
    expect(plantedBy('potato')?.key).toBe('potato_0');
    expect(plantedBy('carrot')?.key).toBe('carrot_0');
    expect(plantedBy('bread')).toBeNull();
    expect(plantedBy('dirt')).toBeNull();
    expect(plantedBy('nonsense')).toBeNull();
  });

  it('isHoe only for hoes', () => {
    expect(isHoe({ item: 'flint_hoe', count: 1, durability: 64 })).toBe(true);
    expect(isHoe({ item: 'iron_hoe', count: 1 })).toBe(true);
    expect(isHoe({ item: 'flint_shovel', count: 1 })).toBe(false);
    expect(isHoe(null)).toBe(false);
  });
});

describe('farming: tilling', () => {
  it('the tillable list matches the content solver', () => {
    expect([...TILLABLE]).toEqual([...TILLABLE_BLOCKS]);
    expect(tillResult(block('grass'))?.key).toBe('farmland');
    expect(tillResult(block('dirt'))?.key).toBe('farmland');
    expect(tillResult(block('sand'))).toBeNull();
    expect(tillResult(block('farmland'))).toBeNull();
  });

  it('only the top face of grass or dirt with air above', () => {
    const { world } = rig();
    expect(canTill(world, 0, 9, 0, Face.PY)).toBe(true);
    expect(canTill(world, 0, 9, 0, Face.PX)).toBe(false);
    world.put(1, 9, 0, 'dirt');
    expect(canTill(world, 1, 9, 0, Face.PY)).toBe(true);
    world.put(2, 9, 0, 'stone');
    expect(canTill(world, 2, 9, 0, Face.PY)).toBe(false);
    world.put(0, 10, 0, 'tall_grass');
    expect(canTill(world, 0, 9, 0, Face.PY)).toBe(false);
    expect(canTill(world, 3, 95, 0, Face.PY)).toBe(false);
  });

  it('till(): farmland, hoe wear, flag and sound', () => {
    const r = rig();
    r.hold('flint_hoe', 1, 64);
    expect(till(r.world, r.player, r.top(0, 9, 0))).toBe(true);
    expect(blockOf(r.world.getVoxel(0, 9, 0)).key).toBe('farmland');
    expect(r.player.heldStack()!.durability).toBe(63);
    expect(r.flags).toEqual(['tilled']);
    expect(r.sfx).toEqual(['till']);
  });

  it('till() refuses without a hoe, on the wrong block, and when dead; the last use breaks the hoe', () => {
    const r = rig();
    r.hold('flint_shovel', 1, 64);
    expect(till(r.world, r.player, r.top(0, 9, 0))).toBe(false);
    r.hold('flint_hoe', 1, 1);
    r.world.put(1, 9, 0, 'sand');
    expect(till(r.world, r.player, r.top(1, 9, 0))).toBe(false);
    r.player.dead = true;
    expect(till(r.world, r.player, r.top(0, 9, 0))).toBe(false);
    r.player.dead = false;
    expect(r.flags).toEqual([]);
    expect(till(r.world, r.player, r.top(0, 9, 0))).toBe(true);
    expect(r.player.heldStack()).toBeNull();
    expect(r.sfx).toContain('tool_break');
  });
});

describe('farming: planting', () => {
  it('plantCell: on farmland only, into a free cell', () => {
    const r = rig();
    r.world.put(0, 9, 0, 'farmland');
    expect(plantCell(r.world, 'wheat_seeds', r.top(0, 9, 0))).toEqual({ x: 0, y: 10, z: 0 });
    expect(plantCell(r.world, 'potato', r.top(0, 9, 0))).toEqual({ x: 0, y: 10, z: 0 });
    // Grass is not farmland; bread plants nothing.
    expect(plantCell(r.world, 'wheat_seeds', r.top(1, 9, 0))).toBeNull();
    expect(plantCell(r.world, 'bread', r.top(0, 9, 0))).toBeNull();
    // The side of the farmland puts the crop beside it, on grass: no.
    const side: UseTarget = { x: 0, y: 9, z: 0, face: Face.PX, px: 1, py: 9, pz: 0, block: r.world.getBlock(0, 9, 0) };
    expect(plantCell(r.world, 'carrot', side)).toBeNull();
    // Something already grows there.
    r.world.put(0, 10, 0, 'wheat_1');
    expect(plantCell(r.world, 'wheat_seeds', r.top(0, 9, 0))).toBeNull();
  });

  it('placementCell goes into a replaceable target, else across the face', () => {
    const r = rig();
    r.world.put(0, 10, 0, 'tall_grass');
    const grass: UseTarget = { x: 0, y: 10, z: 0, face: Face.PZ, px: 0, py: 10, pz: 1, block: r.world.getBlock(0, 10, 0) };
    expect(placementCell(grass)).toEqual({ x: 0, y: 10, z: 0 });
    expect(placementCell(r.top(1, 9, 0))).toEqual({ x: 1, y: 10, z: 0 });
  });

  it('plant(): one item becomes the stage-0 crop, with block:placed and sfx plant', () => {
    const r = rig();
    r.world.put(0, 9, 0, 'farmland');
    r.hold('wheat_seeds', 3);
    expect(plant(r.world, r.player, r.top(0, 9, 0))).toEqual({ x: 0, y: 10, z: 0 });
    expect(voxelId(r.world.getVoxel(0, 10, 0))).toBe(block('wheat_0').id);
    expect(r.player.heldStack()).toEqual({ item: 'wheat_seeds', count: 2 });
    expect(r.placed).toEqual([{ x: 0, y: 10, z: 0, voxel: makeVoxel(block('wheat_0').id) }]);
    expect(r.sfx).toEqual(['plant']);
    // Not again on the same cell, not on grass.
    expect(plant(r.world, r.player, r.top(0, 9, 0))).toBeNull();
    expect(plant(r.world, r.player, r.top(1, 9, 0))).toBeNull();
    expect(r.player.heldStack()!.count).toBe(2);
  });

  it('a plant whose ground is gone is unsupported', () => {
    const r = rig();
    r.world.put(0, 9, 0, 'farmland');
    r.world.put(0, 10, 0, 'carrot_2');
    expect(isUnsupported(r.world, 0, 10, 0)).toBe(false);
    r.world.setVoxel(0, 9, 0, AIR);
    expect(isUnsupported(r.world, 0, 10, 0)).toBe(true);
    // Blocks without placeOn never are.
    expect(isUnsupported(r.world, 1, 9, 0)).toBe(false);
  });
});
