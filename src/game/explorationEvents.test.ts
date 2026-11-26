/** The exploration features announce their firsts on the bus (achievements and the journal listen): fish, waypoint trips, treasure. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block, blockOf } from '../core/registry';
import { makeVoxel, type ItemStack } from '../core/types';
import { Exploration, MAP_ITEM, type ExplorationHost, type UseAim } from './exploration';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const events: string[] = [];
  const sfx: string[] = [];
  for (const e of ['fish:caught', 'waypoint:travelled', 'treasure:dug'] as const) bus.on(e, () => events.push(e));
  bus.on('sfx', (e) => sfx.push(e.name));
  let t = 0;
  const host = { world, bus, player, age: () => 2, isNight: () => false, raining: () => false, season: () => 'spring', biomeAt: () => 'woodland', now: () => t, rng: () => 0.5 };
  const ex = new Exploration(host as unknown as ExplorationHost);
  ex.teleport = () => undefined;
  const aim = (x: number, y: number, z: number): UseAim => ({ x, y, z, px: x, py: y + 1, pz: z, block: blockOf(world.getVoxel(x, y, z)) });
  const hold = (item: string, count = 1, durability?: number): ItemStack => {
    const s: ItemStack = durability === undefined ? { item, count } : { item, count, durability };
    player.inventory.set(player.selectedSlot, s);
    return s;
  };
  return { bus, world, player, ex, events, sfx, aim, hold, tick: (s: number) => { t += s; ex.tick(s); } };
}

describe('exploration events', () => {
  it('landing a fish emits fish:caught with cast, bite and land sounds', () => {
    const r = rig();
    r.world.fill(-3, 5, -3, 3, 5, 3, 'sand');
    r.world.fill(-3, 6, -3, 3, 9, 3, 'water');
    const rod = r.hold('fishing_rod', 1, 5);
    const aim = { ...r.aim(0, 5, 0), block: { key: 'sand', liquid: null }, px: 0, py: 6, pz: 0 };
    r.ex.use(aim, rod);
    r.tick(20);
    r.ex.use(aim, rod);
    expect(r.events).toEqual(['fish:caught']);
    expect(r.sfx).toEqual(expect.arrayContaining(['fish_cast', 'fish_bite', 'fish_land']));
  });

  it('a waypoint trip emits waypoint:travelled; a look at the list does not', () => {
    const r = rig();
    for (const x of [0, 130]) {
      const v = makeVoxel(block('waypoint_stone').id);
      r.world.setVoxel(x, 10, 0, v);
      r.bus.emit('block:placed', { x, y: 10, z: 0, voxel: v });
    }
    r.ex.use(r.aim(0, 10, 0), null);
    expect(r.events).toEqual([]);
    r.ex.use(r.aim(0, 10, 0), r.hold('charcoal', 5));
    expect(r.events).toEqual(['waypoint:travelled']);
    expect(r.sfx).toContain('waypoint_travel');
  });

  it('opening a buried crate emits treasure:dug once, and the pending crate survives a save', () => {
    const r = rig();
    const map = r.hold(MAP_ITEM, 1);
    const m = r.ex.mapOf(map)!;
    r.world.fill(m.x - 2, 5, m.z - 2, m.x + 2, 8, m.z + 2, 'dirt');
    r.player.position.x = m.x;
    r.player.position.z = m.z;
    r.tick(2);
    const crate = [...r.world.entities()].find((e) => e.kind === 'crate')!;
    const saved = JSON.parse(JSON.stringify(r.ex.toJSON()));
    expect(saved.buried).toEqual([[crate.x, crate.y, crate.z]]);
    r.bus.emit('ui:open', { screen: { type: 'crate', x: crate.x + 1, y: crate.y, z: crate.z } });
    expect(r.events).toEqual([]);
    r.bus.emit('ui:open', { screen: { type: 'crate', x: crate.x, y: crate.y, z: crate.z } });
    r.bus.emit('block:broken', { x: crate.x, y: crate.y, z: crate.z, voxel: 0 });
    expect(r.events).toEqual(['treasure:dug']);
    expect(r.sfx).toContain('treasure_found');
    expect(r.ex.toJSON().buried).toBeUndefined();
    const r2 = rig();
    r2.ex.load(saved);
    r2.bus.emit('block:broken', { x: crate.x, y: crate.y, z: crate.z, voxel: 0 });
    expect(r2.events).toEqual(['treasure:dug']);
  });
});
