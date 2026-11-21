import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelActive, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { CRANK_S, Workshop } from './workshop';

function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const world = {
    getVoxel: (x: number, y: number, z: number) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      const from = world.getVoxel(x, y, z);
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from, to: v, source: 'sim' });
      return true;
    },
    isLoaded: () => true,
  } as unknown as IWorld;
  const ground = new GroundItems(bus);
  const shop = new Workshop(world, bus, ground, () => 0.99);
  const put = (x: number, y: number, z: number, key: string, facing: Facing = Facing.North) => world.setVoxel(x, y, z, makeVoxel(blockId(key), facing));
  const crank = (x: number, y: number, z: number) => shop.use(x, y, z, null, () => undefined);
  const run = (s: number, keepCranking?: [number, number, number]) => {
    for (let t = 0; t < s; t += 0.05) {
      if (keepCranking && Math.round(t * 20) % 20 === 0) crank(...keepCranking);
      shop.tick(0.05);
    }
  };
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  return { bus, world, ground, shop, put, crank, run, toasts };
}

describe('workshop', () => {
  it('a cranked belt carries an item away from the side it was laid from, and stops with the crank', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    // Laid facing south (the player stood south): items ride north (-z).
    for (let z = 1; z <= 5; z++) t.put(0, 0, z, 'conveyor_belt', Facing.South);
    const [item] = t.ground.spawn('flint', 1, 0.5, 0.5, 5.5, { scatter: false });
    expect(t.crank(0, 0, 0)).toBe('worked');
    t.run(2);
    expect(item.z).toBeCloseTo(3.5, 0);
    expect(voxelActive(t.world.getVoxel(0, 0, 3))).toBe(true);
    t.run(CRANK_S + 1);
    const z = item.z;
    t.run(1);
    expect(item.z).toBe(z);
    expect(voxelActive(t.world.getVoxel(0, 0, 3))).toBe(false);
  });

  it('a belt feeds a millstone, which grinds wheat into flour out of its front', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'drive_shaft');
    t.put(2, 0, 0, 'mech_millstone', Facing.South);
    for (let z = 1; z <= 3; z++) t.put(2, 0, z, 'conveyor_belt', Facing.South);
    // Millstone faces south onto the belt? No: the belt runs north into it from z=3 to z=1; output goes out of its front.
    t.ground.spawn('wheat', 2, 2.5, 0.5, 3.5, { scatter: false });
    t.run(12, [0, 0, 0]);
    const flour = t.ground.items.filter((e) => e.item === 'flour').reduce((n, e) => n + e.count, 0);
    expect(flour).toBe(2);
    expect(t.ground.items.some((e) => e.item === 'wheat')).toBe(false);
  });

  it('items dropped on a machine top are taken in; Use puts the held stack in', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'mech_mortar', Facing.East);
    t.ground.spawn('copper_ore', 1, 1.5, 1.0, 0.5, { scatter: false });
    let taken = 0;
    expect(t.shop.use(1, 0, 0, { item: 'tin_ore', count: 3 }, (n) => (taken = n))).toBe('worked');
    expect(taken).toBe(3);
    t.run(30, [0, 0, 0]);
    const out = (k: string) => t.ground.items.filter((e) => e.item === k).reduce((n, e) => n + e.count, 0);
    // rng 0.99: never the bonus portion.
    expect(out('crushed_copper')).toBe(1);
    expect(out('crushed_tin')).toBe(3);
    expect(t.shop.use(1, 0, 0, { item: 'stick', count: 1 }, () => undefined)).toBeNull();
  });

  it('too many machines on one crank overstress the network', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'mech_saw');
    t.put(2, 0, 0, 'mech_millstone');
    t.put(3, 0, 0, 'mech_mortar');
    t.crank(0, 0, 0);
    t.run(0.2);
    expect(t.shop.netAt(1, 0, 0)?.overstressed).toBe(true);
    expect(t.shop.describe(2, 0, 0)).toMatch(/overstressed 12\/8 su/);
    expect(t.toasts.some((s) => /Too much load/.test(s))).toBe(true);
    t.put(4, 0, 0, 'hand_crank');
    t.crank(0, 0, 0);
    t.crank(4, 0, 0);
    t.run(0.2);
    expect(t.shop.netAt(1, 0, 0)?.rpm).toBe(16);
    expect(t.shop.describe(0, 0, 0)).toBe('Hand Crank - 16 rpm, load 12/16 su');
  });

  it('a held block is placed against a crank, not cranked', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    expect(t.shop.use(0, 0, 0, { item: 'drive_shaft', count: 4 }, () => undefined)).toBeNull();
  });

  it('saves parts and machine buffers, and drops a broken machine contents', () => {
    const t = setup();
    t.put(1, 0, 0, 'mech_loom');
    t.shop.use(1, 0, 0, { item: 'fiber', count: 7 }, () => undefined);
    const saved = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const u = setup();
    u.put(1, 0, 0, 'mech_loom');
    u.shop.load(saved);
    expect(u.shop.describe(1, 0, 0)).toMatch(/holds 7 Fib/);
    u.world.setVoxel(1, 0, 0, 0);
    expect(u.ground.items.some((e) => e.item === 'fiber' && e.count === 7)).toBe(true);
    expect(u.shop.describe(1, 0, 0)).toBeNull();
  });
});
