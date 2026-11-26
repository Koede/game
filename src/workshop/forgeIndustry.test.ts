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

/** Two cranks at 16 rpm into two ratio dials (x2, then x3): 96 rpm from x = 3 on along y = 1. */
function line(t: ReturnType<typeof setup>): void {
  t.put(0, 1, 0, 'hand_crank');
  t.put(0, 1, 1, 'hand_crank');
  t.put(1, 1, 0, 'ratio_dial');
  t.put(2, 1, 0, 'ratio_dial');
  for (let i = 0; i < 2; i++) t.shop.use(1, 1, 0, null, () => undefined); // x0.5 -> x1 -> x2
  for (let i = 0; i < 3; i++) t.shop.use(2, 1, 0, null, () => undefined); // x0.5 -> x1 -> x2 -> x3
}
const spin = (t: ReturnType<typeof setup>, s: number): void => {
  for (let k = 0; k < s / 0.05; k++) {
    if (k % 20 === 0) {
      t.shop.use(0, 1, 0, null, () => undefined);
      t.shop.use(0, 1, 1, null, () => undefined);
    }
    t.shop.tick(0.05);
  }
};

describe('Forge heavy industry', () => {
  it('a rolling mill gives a plate for every ingot, and a plain press only half as many', () => {
    const t = setup();
    line(t);
    t.put(3, 0, 0, 'basin');
    t.put(3, 1, 0, 'rolling_mill');
    t.shop.offer(3, 0, 0, 'iron_ingot', 2);
    spin(t, 8);
    expect(count(t, 3, 0, 0)).toEqual({ iron_plate: 2 });
  });

  it('a rolling mill does nothing below 64 rpm', () => {
    const t = setup();
    t.put(0, 1, 0, 'hand_crank');
    t.put(1, 1, 0, 'rolling_mill');
    t.put(1, 0, 0, 'basin');
    t.shop.offer(1, 0, 0, 'iron_ingot', 2);
    t.run(8, [0, 1, 0]);
    expect(count(t, 1, 0, 0)).toEqual({ iron_ingot: 2 });
  });

  it('a drop forge shapes a chassis from plates and bronze without a fire', () => {
    const t = setup();
    line(t);
    t.put(3, 0, 0, 'basin');
    t.put(3, 1, 0, 'drop_forge');
    t.shop.offer(3, 0, 0, 'iron_plate', 4);
    t.shop.offer(3, 0, 0, 'bronze_ingot', 2);
    spin(t, 10);
    expect(count(t, 3, 0, 0)).toEqual({ chassis: 1 });
  });

  it('a dynamo on a turning line reports the shaft speed to the grid; a still one reports none', () => {
    const t = setup();
    line(t);
    t.put(3, 1, 0, 'dynamo');
    expect(t.shop.dynamoRpm(3, 1, 0)).toBe(0);
    spin(t, 4);
    expect(t.shop.dynamoRpm(3, 1, 0)).toBeGreaterThanOrEqual(64);
    expect(t.shop.dynamoRpm(9, 9, 9)).toBe(0); // not a part
  });
});
