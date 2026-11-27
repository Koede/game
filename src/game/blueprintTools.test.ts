import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BlueprintTools, GHOST_KEY } from './blueprintTools';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 40.5, y: 20, z: 40.5 });
  player.dev = false;
  const tools = new BlueprintTools(world, player, bus);
  const events: { type: string; key?: string; n?: number }[] = [];
  bus.on('ghost:show', (e) => events.push({ type: 'show', key: e.key, n: e.cells.length }));
  bus.on('ghost:clear', (e) => events.push({ type: 'clear', key: e.key }));
  world.fill(0, 5, 0, 2, 5, 0, 'stone');
  world.put(1, 6, 0, 'crate');
  return { bus, world, player, tools, events };
}

describe('blueprint tools', () => {
  it('saves a box with two corner marks, machines included', () => {
    const { tools } = rig();
    expect(tools.markCorner(0, 5, 0).ok).toBe(true);
    const r = tools.markCorner(2, 6, 0);
    expect(r).toMatchObject({ ok: true });
    expect(tools.book.entries).toHaveLength(1);
    expect(tools.book.entries[0].bp.cells).toHaveLength(4);
    tools.markCorner(30, 5, 0);
    expect(tools.markCorner(90, 5, 0).text).toMatch(/Too big/);
    tools.markCorner(50, 40, 50);
    expect(tools.markCorner(51, 40, 50).text).toMatch(/Nothing to save/);
  });

  it('shows a ghost at the aim (blocked cells red), turns, and clears', () => {
    const { tools, world, events } = rig();
    tools.markCorner(0, 5, 0);
    tools.markCorner(2, 6, 0);
    const id = tools.book.entries[0].id;
    expect(tools.showGhost(10, 5, 10)).toBeNull();
    tools.select(id);
    world.put(11, 5, 10, 'plank');
    const site = tools.showGhost(10, 5, 10)!;
    expect(site.map((c) => c.state).filter((s) => s === 'blocked')).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'show', key: GHOST_KEY, n: 4 });
    const before = events.length;
    tools.showGhost(10, 5, 10);
    expect(events.length).toBe(before);
    tools.rotate();
    expect(tools.current()!.size).toEqual([1, 2, 3]);
    tools.showGhost(10, 5, 10);
    expect(events.length).toBe(before + 1);
    tools.select(null);
    expect(events.at(-1)).toEqual({ type: 'clear', key: GHOST_KEY });
  });

  it('places now from the pack, spending items and skipping what is short or blocked', () => {
    const { tools, world, player } = rig();
    tools.markCorner(0, 5, 0);
    tools.markCorner(2, 6, 0);
    tools.select(tools.book.entries[0].id);
    player.give('stone', 2);
    world.put(12, 5, 10, 'plank');
    const r = tools.placeNow(10, 5, 10);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/Built 2 of 4/);
    expect(r.text).toMatch(/missing/);
    expect(r.text).toMatch(/1 spots blocked/);
    expect(world.getBlock(10, 5, 10).key).toBe('stone');
    expect(player.inventory.count('stone')).toBe(0);
    expect(tools.placeNow(10, 5, 10).ok).toBe(false);
  });

  it('Dev Mode free placing builds without items, and a machine arrives as a machine block', () => {
    const { tools, world, player } = rig();
    player.dev = true;
    player.devFreePlace = true;
    tools.markCorner(0, 5, 0);
    tools.markCorner(2, 6, 0);
    tools.select(tools.book.entries[0].id);
    expect(tools.placeNow(20, 5, 20).text).toBe('Built 4 of 4 blocks');
    expect(world.getBlock(21, 6, 20).key).toBe('crate');
  });

  it('commissions Gruk: the job is kept, the ghost goes, and the number of jobs is limited', () => {
    const { tools, events } = rig();
    tools.markCorner(0, 5, 0);
    tools.markCorner(2, 6, 0);
    const id = tools.book.entries[0].id;
    for (let i = 0; i < 3; i++) {
      tools.select(id);
      tools.showGhost(10 + i * 5, 5, 10);
      expect(tools.commission(10 + i * 5, 5, 10).ok).toBe(true);
    }
    expect(events.some((e) => e.type === 'clear')).toBe(true);
    tools.select(id);
    expect(tools.commission(40, 5, 10).ok).toBe(false);
    expect(tools.book.jobs).toHaveLength(3);
    expect(tools.commission(0, 999, 0).ok).toBe(false);
  });
});
