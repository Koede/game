import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId, blockOf } from '../core/registry';
import { makeVoxel } from '../core/types';
import { BuildTools, CLIP_MAX, UNDO_LIMIT, itemOfBlock } from './buildTools';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 40.5, y: 20, z: 40.5 });
  player.dev = false;
  const tools = new BuildTools(world, player, bus);
  /** What PlayerInteraction.placeBlock does: set, consume, announce. */
  const place = (x: number, y: number, z: number, key = 'stone'): void => {
    const voxel = makeVoxel(blockId(key));
    world.setVoxel(x, y, z, voxel, 'player');
    player.inventory.remove(itemOfBlock(key)!, 1);
    bus.emit('block:placed', { x, y, z, voxel });
  };
  return { bus, world, player, tools, place };
}

describe('undo', () => {
  it('takes the last placement out and gives the item back', () => {
    const { world, player, tools, place } = rig();
    player.give(itemOfBlock('stone')!, 3);
    place(0, 5, 0);
    place(1, 5, 0);
    expect(tools.undoCount).toBe(2);
    expect(player.inventory.count('stone')).toBe(1);
    expect(tools.undo().ok).toBe(true);
    expect(world.getBlock(1, 5, 0).key).toBe('air');
    expect(world.getBlock(0, 5, 0).key).toBe('stone');
    expect(player.inventory.count('stone')).toBe(2);
    expect(tools.undoCount).toBe(1);
  });

  it('keeps only the last 10 and says so when there is nothing left', () => {
    const { player, tools, place } = rig();
    player.give('stone', 30);
    for (let i = 0; i < 14; i++) place(i, 5, 0);
    expect(tools.undoCount).toBe(UNDO_LIMIT);
    for (let i = 0; i < UNDO_LIMIT; i++) expect(tools.undo().ok).toBe(true);
    expect(tools.undo()).toEqual({ ok: false, text: 'Nothing to undo' });
  });

  it('skips blocks that were already broken or replaced', () => {
    const { world, player, tools, place } = rig();
    player.give('stone', 5);
    place(0, 5, 0);
    place(1, 5, 0);
    world.setVoxel(1, 5, 0, 0, 'player'); // broken by hand
    expect(tools.undo().ok).toBe(true); // falls through to the first one
    expect(world.getBlock(0, 5, 0).key).toBe('air');
    expect(player.inventory.count('stone')).toBe(4); // only one refunded
  });

  it('refunds nothing when Dev Mode places for free, and ignores liquids and blocks no item makes', () => {
    const { world, player, tools, bus } = rig();
    player.dev = true;
    const voxel = makeVoxel(blockId('stone'));
    world.setVoxel(0, 5, 0, voxel, 'player');
    bus.emit('block:placed', { x: 0, y: 5, z: 0, voxel });
    tools.undo();
    expect(player.inventory.count('stone')).toBe(0);
    const water = makeVoxel(blockId('water'));
    bus.emit('block:placed', { x: 3, y: 5, z: 3, voxel: water });
    expect(tools.undoCount).toBe(0);
  });
});

describe('copy and paste', () => {
  const build = (world: FakeWorld) => {
    world.put(0, 5, 0, 'stone');
    world.put(1, 5, 0, 'stone');
    world.put(0, 6, 0, 'plank');
  };

  it('copies the box between two corners and pastes it at a cell, paying from the pack', () => {
    const { world, player, tools } = rig();
    build(world);
    expect(tools.markCorner(1, 6, 0).text).toMatch(/Corner 1/);
    const copied = tools.markCorner(0, 5, 0);
    expect(copied.ok).toBe(true);
    expect(tools.clip?.blocks).toHaveLength(3);
    player.give('stone', 5);
    player.give('plank', 5);
    const r = tools.paste(10, 5, 10);
    expect(r.ok).toBe(true);
    expect(world.getBlock(10, 5, 10).key).toBe('stone');
    expect(world.getBlock(11, 5, 10).key).toBe('stone');
    expect(world.getBlock(10, 6, 10).key).toBe('plank');
    expect(player.inventory.count('stone')).toBe(3);
    expect(player.inventory.count('plank')).toBe(4);
    expect(tools.undoCount).toBe(0); // a paste is not 100 undo entries
  });

  it('pastes what it can afford and reports the rest', () => {
    const { world, player, tools } = rig();
    build(world);
    tools.markCorner(0, 5, 0);
    tools.markCorner(1, 6, 0);
    player.give('stone', 1);
    const r = tools.paste(10, 5, 10);
    expect(r.text).toMatch(/Pasted 1 of 3.*missing 1 Stone, 1 Plank|Pasted 1 of 3.*missing/);
    expect(world.getBlock(11, 5, 10).key).toBe('air');
  });

  it('is free in Dev Mode and skips occupied cells', () => {
    const { world, player, tools } = rig();
    build(world);
    tools.markCorner(0, 5, 0);
    tools.markCorner(1, 6, 0);
    player.dev = true;
    world.put(10, 5, 10, 'dirt');
    const r = tools.paste(10, 5, 10);
    expect(r.text).toMatch(/1 spots blocked/);
    expect(world.getBlock(10, 5, 10).key).toBe('dirt');
    expect(world.getBlock(11, 5, 10).key).toBe('stone');
  });

  it('refuses a box larger than 8x8x8 and an empty one', () => {
    const { world, tools } = rig();
    tools.markCorner(0, 0, 0);
    const big = tools.markCorner(CLIP_MAX, 0, 0);
    expect(big.ok).toBe(false);
    expect(big.text).toMatch(/Too big/);
    tools.markCorner(0, 0, 0);
    expect(tools.markCorner(2, 2, 2).text).toBe('Nothing to copy there');
    expect(tools.paste(0, 0, 0).ok).toBe(false);
    expect(blockOf(world.getVoxel(0, 0, 0)).key).toBe('air');
  });

  it('does not paste a solid block into the player', () => {
    const { world, player, tools } = rig();
    world.put(0, 5, 0, 'stone');
    tools.markCorner(0, 5, 0);
    tools.markCorner(0, 5, 0);
    player.dev = true;
    const r = tools.paste(40, 20, 40);
    expect(r.ok).toBe(false);
    expect(world.getBlock(40, 20, 40).key).toBe('air');
  });
});
