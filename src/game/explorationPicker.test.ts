/** The waypoint picker's hooks on Exploration: Use opens it, travelTo pays and travels, mapMarks feeds the journal map. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block, blockOf } from '../core/registry';
import { makeVoxel, type ItemStack } from '../core/types';
import { Exploration, MAP_ITEM, type UseAim } from './exploration';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const ex = new Exploration({
    world, bus, player, age: () => 2, isNight: () => false, raining: () => false, season: () => 'spring', biomeAt: () => 'woodland', now: () => 0, rng: () => 0.5,
  });
  const teleports: number[][] = [];
  ex.teleport = (x, y, z) => { teleports.push([x, y, z]); };
  const picked: string[] = [];
  ex.openPicker = (s) => picked.push(s.name);
  const aim = (x: number, y: number, z: number): UseAim => ({ x, y, z, px: x, py: y + 1, pz: z, block: blockOf(world.getVoxel(x, y, z)) });
  const stone = (x: number, z: number): void => {
    const v = makeVoxel(block('waypoint_stone').id);
    world.setVoxel(x, 10, z, v);
    bus.emit('block:placed', { x, y: 10, z, voxel: v });
  };
  return { bus, world, player, toasts, ex, teleports, picked, aim, stone };
}

describe('waypoint picker hooks', () => {
  it('Use on a stone with somewhere to go opens the picker, even holding charcoal', () => {
    const r = rig();
    r.stone(0, 0);
    expect(r.ex.use(r.aim(0, 10, 0), null)).toBe('worked');
    expect(r.picked).toEqual([]);
    r.stone(130, 0);
    const held: ItemStack = { item: 'charcoal', count: 5 };
    expect(r.ex.use(r.aim(0, 10, 0), held)).toBe('worked');
    expect(r.picked).toEqual(['Waypoint 1']);
    expect(r.teleports).toEqual([]);
  });

  it('travelTo pays the fare and travels from the stone the player stands at', () => {
    const r = rig();
    r.stone(0, 0);
    r.stone(130, 0);
    const [a, b] = r.ex.waypoints.all();
    r.player.inventory.add('charcoal', 2);
    expect(r.ex.travelTo(a.id, b.id)).toBe('refused');
    expect(r.toasts.at(-1)).toMatch(/needs 3 charcoal/);
    r.player.inventory.add('charcoal', 3);
    expect(r.ex.travelTo(a.id, b.id)).toBe('worked');
    expect(r.teleports).toEqual([[130.5, 11, 0.5]]);
    expect(r.player.inventory.count('charcoal')).toBe(2);
  });

  it('travelTo refuses when the player is not at the stone the picker was opened for', () => {
    const r = rig();
    r.stone(0, 0);
    r.stone(130, 0);
    const [a, b] = r.ex.waypoints.all();
    r.player.inventory.add('charcoal', 9);
    expect(r.ex.travelTo(b.id, a.id)).toBe('refused');
    expect(r.teleports).toEqual([]);
  });

  it('mapMarks lists the stones and, for a read treasure map in the pack, its landmark', () => {
    const r = rig();
    r.stone(0, 0);
    r.stone(130, 0);
    const marks = r.ex.mapMarks();
    expect(marks.filter((m) => m.kind === 'waypoint').map((m) => [m.x, m.z])).toEqual([[0, 0], [130, 0]]);
    expect(marks.some((m) => m.kind === 'treasure')).toBe(false);
    const unread: ItemStack = { item: MAP_ITEM, count: 1 };
    r.player.inventory.add(MAP_ITEM, 1);
    expect(r.ex.mapMarks().some((m) => m.kind === 'treasure')).toBe(false);
    const read = r.ex.mapOf(unread);
    r.player.inventory.set(5, unread);
    const t = r.ex.mapMarks().filter((m) => m.kind === 'treasure');
    expect(t).toEqual(read ? [{ kind: 'treasure', x: read.landmark.x, z: read.landmark.z, name: read.landmark.name }] : []);
  });
});
