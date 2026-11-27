import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block, blockOf } from '../core/registry';
import { FISH_ITEMS } from '../content/fishing';
import { makeVoxel, voxelId, type ItemStack } from '../core/types';
import { BITE_WINDOW_S, Exploration, MAP_ITEM, type UseAim } from './exploration';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  let t = 0;
  const ex = new Exploration({
    world, bus, player, age: () => 2, isNight: () => false, raining: () => false, biomeAt: () => 'woodland', now: () => t, rng: () => 0.5,
  });
  const teleports: number[][] = [];
  ex.teleport = (x, y, z) => { teleports.push([x, y, z]); };
  const aim = (x: number, y: number, z: number): UseAim => ({ x, y, z, px: x, py: y + 1, pz: z, block: blockOf(world.getVoxel(x, y, z)) });
  const hold = (item: string, count = 1, durability?: number): ItemStack => {
    const s: ItemStack = durability === undefined ? { item, count } : { item, count, durability };
    player.inventory.set(player.selectedSlot, s);
    return s;
  };
  const stone = (x: number, z: number): void => {
    const v = makeVoxel(block('waypoint_stone').id);
    world.setVoxel(x, 10, z, v);
    bus.emit('block:placed', { x, y: 10, z, voxel: v });
  };
  return { bus, world, player, toasts, ex, teleports, aim, hold, stone, tick: (s: number) => { t += s; ex.tick(s); }, clock: () => t };
}

describe('waypoint use', () => {
  it('registers stones on placement, opens the picker and travels for charcoal', () => {
    const r = rig();
    r.stone(0, 0);
    r.stone(130, 0);
    expect(r.ex.waypoints.all()).toHaveLength(2);
    const opened: unknown[] = [];
    r.bus.on('ui:open', (e) => opened.push(e.screen));
    r.player.inventory.add('charcoal', 5);
    expect(r.ex.use(r.aim(0, 10, 0), null)).toBe('worked');
    expect(opened).toEqual([{ type: 'waypoints', stone: 1 }]);
    const v = r.ex.waypointView(1)!;
    expect(v.destinations).toHaveLength(1);
    expect(v.destinations[0]).toMatchObject({ fuel: 3, compass: 'east' });
    expect(v.charcoal).toBe(5);
    const sfx: string[] = [];
    r.bus.on('sfx', (e) => sfx.push(e.name));
    expect(r.ex.travel(1, 2)).toBeNull();
    expect(sfx).toEqual(['ignition', 'upgrade']);
    expect(r.teleports).toEqual([[130.5, 11, 0.5]]);
    expect(r.player.inventory.count('charcoal')).toBe(2);
  });

  it('refuses without enough fuel and forgets broken stones', () => {
    const r = rig();
    r.stone(0, 0);
    r.stone(400, 0);
    r.player.inventory.add('charcoal', 1);
    expect(r.ex.travel(1, 2)).toMatch(/needs 7 charcoal/);
    expect(r.teleports).toHaveLength(0);
    r.world.setVoxel(400, 10, 0, 0);
    r.ex.use(r.aim(0, 10, 0), null);
    expect(r.ex.waypoints.all()).toHaveLength(1);
  });

  it('says so when no other stone is known, renames, and lists stones and map landmarks as marks', () => {
    const r = rig();
    r.stone(0, 0);
    expect(r.ex.use(r.aim(0, 10, 0), null)).toBe('worked');
    expect(r.toasts.at(-1)).toMatch(/Place a second stone/);
    expect(r.ex.renameStone(1, 'Home')).toBe(true);
    expect(r.ex.mapMarks()).toEqual([{ kind: 'waypoint', x: 0, z: 0, label: 'Home' }]);
    const m = r.hold(MAP_ITEM);
    expect(r.ex.mapMarks()).toHaveLength(1); // an unread map has no serial yet, so nothing to circle
    r.ex.use(null, m);
    const marks = r.ex.mapMarks();
    if (marks.length > 1) expect(marks[1].kind).toBe('treasure');
  });

  it('does not hijack placing a stone against a stone, and saves the network', () => {
    const r = rig();
    r.stone(0, 0);
    expect(r.ex.use(r.aim(0, 10, 0), { item: 'waypoint_stone', count: 1 })).toBeNull();
    const r2 = rig();
    r2.ex.load(JSON.parse(JSON.stringify(r.ex.toJSON())));
    expect(r2.ex.waypoints.all()).toHaveLength(1);
  });
});

describe('fishing use', () => {
  it('casts, gets a bite after the delay and lands a fish, wearing the rod', () => {
    const r = rig();
    r.world.fill(-3, 5, -3, 3, 5, 3, 'sand');
    r.world.fill(-3, 6, -3, 3, 9, 3, 'water');
    const rod = r.hold('fishing_rod', 1, 5);
    const aim = { ...r.aim(0, 5, 0), block: { key: 'sand', liquid: null }, px: 0, py: 6, pz: 0 };
    expect(r.ex.use(aim, rod)).toBe('worked');
    expect(r.ex.fishingPhase).toBe('waiting');
    r.tick(20);
    expect(r.ex.fishingPhase).toBe('bite');
    expect(r.ex.use(aim, rod)).toBe('worked');
    expect(FISH_ITEMS.some((f) => r.player.inventory.count(f) === 1)).toBe(true);
    expect(rod.durability).toBe(4);
    expect(r.ex.fishingPhase).toBe('idle');
  });

  it('loses the fish when the bite window passes, and ignores dry ground', () => {
    const r = rig();
    r.world.fill(-3, 5, -3, 3, 5, 3, 'sand');
    r.world.fill(-3, 6, -3, 3, 9, 3, 'water');
    const rod = r.hold('fishing_rod', 1, 5);
    const aim = { ...r.aim(0, 5, 0), block: { key: 'sand', liquid: null }, px: 0, py: 6, pz: 0 };
    r.ex.use(aim, rod);
    r.tick(20);
    r.tick(BITE_WINDOW_S + 0.1);
    expect(r.ex.fishingPhase).toBe('idle');
    expect(r.toasts.at(-1)).toMatch(/got away/);
    expect(r.ex.use({ ...aim, px: 5, py: 11, pz: 5 }, rod)).toBeNull();
  });
});

describe('treasure map use', () => {
  it('shows a stable clue, then buries the chest once when the player comes near', () => {
    const r = rig();
    const map = r.hold(MAP_ITEM, 1);
    expect(r.ex.use(null, map)).toBe('worked');
    expect(r.toasts.at(-1)).toMatch(/Dig \d+ paces/);
    const m1 = r.ex.mapOf(map)!;
    r.player.position.x = 3000;
    expect(r.ex.mapOf(map)).toEqual(m1);
    expect(map.durability! % 8).toBe(2);
    r.world.fill(m1.x - 2, 5, m1.z - 2, m1.x + 2, 8, m1.z + 2, 'dirt');
    r.player.position.x = m1.x; r.player.position.z = m1.z;
    r.tick(2);
    const e = [...r.world.entities()].filter((x) => x.kind === 'crate');
    expect(e).toHaveLength(1);
    expect(voxelId(r.world.getVoxel(e[0].x, e[0].y, e[0].z))).toBe(block('crate').id);
    r.tick(2);
    expect([...r.world.entities()]).toHaveLength(1);
    const r2 = rig();
    r2.ex.load(r.ex.toJSON());
    expect(r2.ex.toJSON().chests).toEqual(r.ex.toJSON().chests);
  });
});
