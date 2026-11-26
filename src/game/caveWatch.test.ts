import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel, voxelId } from '../core/types';
import { Journal } from './journal';
import { FakeWorld } from './fakeWorld';
import { CaveWatch, WATCH_MAX_Y } from './caveWatch';

function rig(y = 20) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const journal = new Journal(() => 1, bus);
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  const pos = { x: 10, y, z: 10 };
  const watch = new CaveWatch({ world, bus, position: () => pos, note: (text, key) => journal.add('note', text, key) });
  return { bus, world, journal, toasts, watch, pos };
}

describe('foul air and torches', () => {
  it('puts out a torch within two blocks of foul air, and only that torch', () => {
    const r = rig();
    r.world.put(12, 20, 10, 'foul_air');
    r.world.put(11, 20, 10, 'torch'); // 1 away
    r.world.put(14, 20, 10, 'torch'); // 2 away
    r.world.put(8, 20, 10, 'torch'); // 4 away
    r.watch.tick(1);
    expect(voxelId(r.world.getVoxel(11, 20, 10))).toBe(0);
    expect(voxelId(r.world.getVoxel(14, 20, 10))).toBe(0);
    expect(voxelId(r.world.getVoxel(8, 20, 10))).toBe(blockId('torch'));
    expect(r.toasts.filter((t) => /torch/.test(t))).toHaveLength(1);
  });

  it('leaves torches alone where there is no foul air, and waits for its period', () => {
    const r = rig();
    r.world.put(11, 20, 10, 'torch');
    r.watch.tick(1);
    expect(voxelId(r.world.getVoxel(11, 20, 10))).toBe(blockId('torch'));
    r.world.put(12, 20, 10, 'foul_air');
    r.watch.tick(0.4);
    expect(voxelId(r.world.getVoxel(11, 20, 10))).toBe(blockId('torch'));
    r.watch.tick(0.7);
    expect(voxelId(r.world.getVoxel(11, 20, 10))).toBe(0);
  });

  it('does not look at all above the cave band', () => {
    const r = rig(WATCH_MAX_Y + 5);
    r.world.put(12, WATCH_MAX_Y + 5, 10, 'foul_air');
    r.world.put(11, WATCH_MAX_Y + 5, 10, 'torch');
    r.watch.tick(1);
    expect(voxelId(r.world.getVoxel(11, WATCH_MAX_Y + 5, 10))).toBe(blockId('torch'));
  });
});

describe('cave map notes', () => {
  it('writes one journal note for a pocket of foul air, with its depth band, however often it is seen', () => {
    const r = rig();
    r.world.put(12, 20, 10, 'foul_air');
    for (let i = 0; i < 5; i++) r.watch.tick(1);
    const notes = r.journal.entries.filter((e) => e.kind === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toMatch(/Foul air pools near 12, 20, 10 \(middle caves\)/);
  });

  it('notes a cairn the player builds, once per cell', () => {
    const r = rig();
    const voxel = makeVoxel(blockId('cave_cairn'));
    r.bus.emit('block:placed', { x: 3, y: 12, z: 4, voxel });
    r.bus.emit('block:placed', { x: 3, y: 12, z: 4, voxel });
    const notes = r.journal.entries.filter((e) => e.kind === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toMatch(/cairn at 3, 12, 4 \(deep caves\)/);
  });
});
