import { describe, expect, it } from 'vitest';
import { AIR_COMPRESSOR_MIN_RPM } from '../core/constants';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { AirNets } from '../sim/airNet';
import { Workshop } from './workshop';

/** A steam rotor, a ratio dial and a compressor on one shaft line drive the air network (BRONZE_PLAN 5.3). */
function setup(dialUses: number) {
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
    getEntity: () => undefined,
    setEntity: () => undefined,
    removeEntity: () => undefined,
    entities: () => [],
  } as unknown as IWorld;
  const shop = new Workshop(world, bus, new GroundItems(bus), () => 0.99);
  shop.steamAt = () => true;
  const put = (x: number, y: number, z: number, key: string): void => void world.setVoxel(x, y, z, makeVoxel(blockId(key)));
  put(0, 0, 0, 'steam_rotor');
  put(1, 0, 0, 'ratio_dial');
  for (let i = 0; i < dialUses; i++) shop.use(1, 0, 0, null, () => undefined);
  put(2, 0, 0, 'air_compressor');
  put(3, 0, 0, 'air_tank');
  const air = new AirNets({ world, bus, shaftRpm: (x, y, z) => shop.rpmOf(x, y, z) });
  air.blockChanged(2, 0, 0, BLOCKS[0], world.getBlock(2, 0, 0));
  const run = (s: number): void => {
    for (let t = 0; t < s; t += 0.05) {
      shop.tick(0.05);
      air.tick(0.05);
    }
  };
  return { shop, air, run };
}

describe('compressor on a shaft line', () => {
  it('a steam rotor through a 2x ratio dial turns it at 32 rpm and it builds pressure', () => {
    const t = setup(2); // the dial starts at 0.5x: two clicks make 2x
    t.run(5);
    expect(t.shop.rpmOf(2, 0, 0)).toBeCloseTo(32, 0);
    expect(t.shop.rpmOf(2, 0, 0)).toBeGreaterThanOrEqual(AIR_COMPRESSOR_MIN_RPM - 0.5);
    expect(t.air.netAt(2, 0, 0)!.airL).toBeGreaterThan(200); // about 2 L/s per rpm, 64 L/s, for 5 s
  });

  it('a rotor alone (16 rpm) is below the minimum: no air', () => {
    const t = setup(1); // 1x
    t.run(5);
    expect(t.shop.rpmOf(2, 0, 0)).toBeCloseTo(16, 0);
    expect(t.air.netAt(2, 0, 0)!.airL).toBe(0);
  });
});
