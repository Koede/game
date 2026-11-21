import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { Workshop } from './workshop';

function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const entities = new Map<string, unknown>();
  const world = {
    getVoxel: (x: number, y: number, z: number) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      const from = world.getVoxel(x, y, z);
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from, to: v, source: 'sim' });
      return true;
    },
    getEntity: (x: number, y: number, z: number) => entities.get(`${x},${y},${z}`),
    isLoaded: () => true,
  } as unknown as IWorld;
  const ground = new GroundItems(bus);
  const shop = new Workshop(world, bus, ground, () => 0.5);
  const put = (x: number, y: number, z: number, key: string, facing: Facing = Facing.North) => world.setVoxel(x, y, z, makeVoxel(blockId(key), facing));
  const run = (s: number, crank?: [number, number, number]) => {
    for (let t = 0; t < s; t += 0.05) {
      if (crank && Math.round(t * 20) % 20 === 0) shop.use(...crank, null, () => undefined);
      shop.tick(0.05);
    }
  };
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  return { world, ground, shop, put, run, entities, toasts };
}
const count = (t: ReturnType<typeof setup>, x: number, y: number, z: number): Record<string, number> => Object.fromEntries(t.shop.logi.peek(x, y, z).map((e) => [e.item, e.count]));

describe('logistics', () => {
  it('a funnel moves a depot stack into the basin in front and honours its filter', () => {
    const t = setup();
    t.put(0, 0, 0, 'depot');
    t.put(1, 0, 0, 'funnel', Facing.East);
    t.put(2, 0, 0, 'basin');
    expect(t.shop.offer(0, 0, 0, 'flour', 5)).toBe(5);
    expect(t.shop.offer(0, 0, 0, 'wheat', 1)).toBe(0); // a depot holds one kind
    t.run(3);
    expect(count(t, 2, 0, 0).flour).toBe(5);
    t.shop.offer(0, 0, 0, 'flour', 3);
    t.shop.use(1, 0, 0, { item: 'wheat', count: 1 }, () => undefined);
    t.run(2);
    expect(count(t, 0, 0, 0).flour).toBe(3);
  });

  it('a belt hands items to a depot at its end', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    for (let x = 1; x <= 3; x++) t.put(x, 0, 0, 'conveyor_belt', Facing.West); // faces west: items ride east
    t.put(4, 0, 0, 'depot');
    t.ground.spawn('flint', 1, 1.5, 0.5, 0.5, { scatter: false });
    t.run(5, [0, 0, 0]);
    expect(count(t, 4, 0, 0).flint).toBe(1);
  });

  it('a chute drops items from a depot above into a basin below', () => {
    const t = setup();
    t.put(0, 2, 0, 'depot');
    t.put(0, 1, 0, 'chute');
    t.put(0, 0, 0, 'basin');
    t.shop.offer(0, 2, 0, 'flour', 4);
    t.run(3);
    expect(count(t, 0, 0, 0).flour).toBe(4);
  });

  it('an arm carries from a source to targets round robin after wrench setup', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'mech_arm');
    t.put(1, 0, 1, 'depot');
    t.put(2, 0, 0, 'depot');
    t.put(0, 0, 1, 'depot');
    t.shop.offer(1, 0, 1, 'flint', 2);
    const w = { item: 'wrench', count: 1 };
    const u = (x: number, y: number, z: number) => t.shop.use(x, y, z, w, () => undefined);
    expect(u(1, 0, 0)).toBe('worked');
    u(1, 0, 1);
    u(2, 0, 0);
    u(0, 0, 1);
    u(1, 0, 0);
    expect(t.shop.describe(1, 0, 0)).toContain('2 targets');
    t.run(8, [0, 0, 0]);
    expect((count(t, 2, 0, 0).flint ?? 0) + (count(t, 0, 0, 1).flint ?? 0)).toBe(2);
    expect(count(t, 1, 0, 1).flint).toBeUndefined();
  });

  it('a deployer places the block it holds in front and a drill breaks and drops', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'deployer', Facing.East);
    t.shop.offer(1, 0, 0, 'dirt', 2);
    t.run(5, [0, 0, 0]);
    expect(t.world.getBlock(2, 0, 0).key).toBe('dirt');
    const u = setup();
    u.put(0, 0, 0, 'hand_crank');
    u.put(1, 0, 0, 'mech_drill', Facing.East);
    u.put(2, 0, 0, 'dirt');
    u.run(4, [0, 0, 0]);
    expect(u.world.getBlock(2, 0, 0).key).toBe('air');
    expect(u.ground.items.some((i) => i.item === 'dirt')).toBe(true);
  });

  it('a mixer turns water and flour into dough in a basin once it runs at 32 rpm', () => {
    const t = setup();
    t.put(0, 0, 0, 'basin');
    t.put(0, 1, 0, 'mixer');
    t.put(1, 1, 0, 'ratio_dial');
    t.put(2, 1, 0, 'hand_crank');
    t.shop.offer(0, 0, 0, 'flour', 2);
    t.shop.use(0, 0, 0, { item: 'water_pail', count: 1 }, () => undefined);
    t.run(6, [2, 1, 0]);
    expect(count(t, 0, 0, 0).dough).toBeUndefined(); // 16 rpm: too slow
    t.shop.use(1, 1, 0, null, () => undefined);
    t.shop.use(1, 1, 0, null, () => undefined); // x2
    t.run(8, [2, 1, 0]);
    expect(count(t, 0, 0, 0).dough).toBe(2);
    expect(t.shop.describe(0, 0, 0)).toContain('750 L');
  });

  it('a press flattens ingots in a basin', () => {
    const t = setup();
    t.put(0, 0, 0, 'basin');
    t.put(0, 1, 0, 'mech_press');
    t.put(1, 1, 0, 'hand_crank');
    t.shop.offer(0, 0, 0, 'bronze_ingot', 2);
    t.run(6, [1, 1, 0]);
    expect(count(t, 0, 0, 0).bronze_plate).toBe(1);
  });

  it('an item drain empties a full bucket into the basin and a spout fills an empty one', () => {
    const t = setup();
    t.put(0, 0, 0, 'basin');
    t.put(0, 1, 0, 'item_drain', Facing.East);
    expect(t.shop.offer(0, 1, 0, 'water_pail', 1)).toBe(1);
    expect(t.shop.describe(0, 0, 0)).toContain('1000 L');
    const u = setup();
    u.put(0, 2, 0, 'basin');
    u.put(0, 1, 0, 'spout');
    u.put(0, 0, 0, 'depot');
    u.shop.use(0, 2, 0, { item: 'water_pail', count: 1 }, () => undefined);
    u.shop.offer(0, 0, 0, 'pail', 1);
    u.run(2);
    expect(count(u, 0, 0, 0).water_pail).toBe(1);
  });

  it('crates are sources and targets', () => {
    const t = setup();
    t.put(0, 0, 0, 'crate');
    t.entities.set('0,0,0', { kind: 'crate', x: 0, y: 0, z: 0, slots: [null, null, null] });
    expect(t.shop.offer(0, 0, 0, 'flour', 70)).toBe(70);
    expect(t.shop.take(0, 0, 0, 'flour', 10)).toEqual({ item: 'flour', count: 10 });
  });

  it('machine output goes straight into a depot in front, and logistics saves', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'mech_millstone', Facing.East);
    t.put(2, 0, 0, 'depot');
    t.shop.offer(1, 0, 0, 'wheat', 2);
    t.run(8, [0, 0, 0]);
    expect(count(t, 2, 0, 0).flour).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const u = setup();
    u.put(2, 0, 0, 'depot');
    u.shop.load(snap);
    expect(count(u, 2, 0, 0).flour).toBeGreaterThan(0);
  });
  it('a drying machine dries soaked hides in half the time into a depot', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'mech_rack', Facing.East);
    t.put(2, 0, 0, 'depot');
    t.shop.offer(1, 0, 0, 'soaked_hide', 2);
    t.run(70, [0, 0, 0]);
    expect(count(t, 2, 0, 0).leather).toBe(2);
  });
});
