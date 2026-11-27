import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { Workshop } from './workshop';

export function setup() {
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
  const run = (s: number, crank?: [number, number, number][]) => {
    for (let t = 0; t < s; t += 0.05) {
      if (crank && Math.round(t * 20) % 20 === 0) for (const c of crank) shop.crank(...c);
      shop.tick(0.05);
    }
  };
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  const rpm = (x: number, y = 0, z = 0): number | null => {
    const m = /(left|right) ([\d.]+) rpm/.exec(shop.describe(x, y, z) ?? '');
    return m ? (m[1] === 'left' ? -1 : 1) * Number(m[2]) : null;
  };
  return { world, ground, shop, put, run, entities, toasts, rpm, bus };
}

describe('differential, flywheel, shear pin, sources', () => {
  it('a differential turns at the mean of two opposed inputs and hands it on', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'ratio_dial');
    t.put(2, 0, 0, 'differential');
    t.put(3, 0, 0, 'reverse_box');
    t.put(4, 0, 0, 'hand_crank');
    t.put(2, 0, 1, 'drive_shaft');
    t.shop.use(1, 0, 0, null, () => undefined);
    t.shop.use(1, 0, 0, null, () => undefined); // x2: 32 rpm from the left
    t.run(0.3, [[0, 0, 0], [4, 0, 0]]);
    // The right crank gives +16, the reverse box makes it -16; the left side gives +32: mean +8.
    expect(t.shop.netAt(2, 0, 1)?.jammed).toBeFalsy();
    expect(t.rpm(2, 0, 1)).toBe(8);
  });

  it('a flywheel has real momentum: it spins up, coasts slower and slower after the crank stops, then rests', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'flywheel');
    t.put(2, 0, 0, 'drive_shaft');
    t.run(0.5, [[0, 0, 0]]);
    expect(t.rpm(2)).toBeLessThan(16); // heavy: it takes a moment to get up to speed
    t.run(6, [[0, 0, 0]]);
    expect(t.rpm(2)).toBe(16);
    t.run(2.6); // the crank's own 2.5 s run out, the wheel carries on
    const slowed = t.rpm(2) as number;
    expect(slowed).toBeGreaterThan(0);
    expect(slowed).toBeLessThan(16);
    t.run(6);
    expect(t.rpm(2) === null || (t.rpm(2) as number) < slowed).toBe(true);
    t.run(30);
    expect(t.rpm(2)).toBeNull();
  });

  it('a brake on a coasting flywheel stops it quickly, and a lit signal engages it', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'flywheel');
    t.put(2, 0, 0, 'brake');
    t.run(7, [[0, 0, 0]]);
    expect(t.rpm(1)).toBe(16);
    t.run(2.6);
    expect(t.rpm(1)).toBeGreaterThan(0);
    t.shop.use(2, 0, 0, null, () => undefined); // engage
    t.run(2);
    expect(t.rpm(1)).toBeNull();
  });

  it('a rated fuse snaps on the torque through it, and spares an upstream part when the load downstream is heavy', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'shear_pin');
    t.shop.use(1, 0, 0, null, () => undefined); // copper: 6 su
    t.put(2, 0, 0, 'mech_saw'); // 4 su: under the rating
    t.run(1, [[0, 0, 0]]);
    expect(t.world.getBlock(1, 0, 0).key).toBe('shear_pin');
    t.put(2, 0, 1, 'mech_loom'); // +2 = 6 su: at the rating, still holds
    t.put(3, 0, 0, 'mech_mortar'); // +4 over: 10 su through the pin
    t.run(1, [[0, 0, 0]]);
    expect(t.world.getBlock(1, 0, 0).key).toBe('air');
    expect(t.toasts.some((x) => /copper shear pin/.test(x))).toBe(true);
  });

  it('a long unsupported shaft whips near its critical speed and a pillow block cures it', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    for (let x = 1; x <= 10; x++) t.put(x, 0, 0, 'drive_shaft'); // critical 16 rpm for a run of ten = the crank's own speed
    t.put(1, 1, 0, 'mech_saw');
    t.run(1, [[0, 0, 0]]);
    expect(t.shop.netAt(1, 0, 0)?.whip).toBe(true);
    expect(t.shop.netAt(1, 0, 0)?.findings?.some((f) => f.code === 'whip')).toBe(true);
    t.put(5, 0, 0, 'pillow_block');
    t.put(6, 0, 0, 'pillow_block');
    t.run(1, [[0, 0, 0]]);
    expect(t.shop.netAt(1, 0, 0)?.whip).toBe(false);
  });

  it('a shear pin snaps when the load tops the sources and the rest of the line survives', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'shear_pin');
    t.put(2, 0, 0, 'mech_saw');
    t.put(2, 0, 1, 'mech_millstone');
    t.put(3, 0, 0, 'mech_loom');
    t.run(0.3, [[0, 0, 0]]);
    expect(t.world.getBlock(1, 0, 0).key).toBe('air');
    expect(t.ground.items.some((i) => i.item === 'scrap_metal')).toBe(true);
    expect(t.toasts.some((x) => x.includes('shear pin'))).toBe(true);
  });

  it('a treadwheel turns while something stands on it, a driven tractor turns the shaft beside it', () => {
    const t = setup();
    let on = false;
    t.shop.standingOn = () => on;
    t.put(0, 0, 0, 'treadwheel');
    t.put(1, 0, 0, 'drive_shaft');
    t.run(0.2);
    expect(t.rpm(1)).toBeNull();
    on = true;
    t.run(0.2);
    expect(t.rpm(1)).toBe(12);
    on = false;
    let driven = false;
    t.shop.tractors = () => [{ x: 1.5, y: 0, z: 2.5, occupied: driven, fuel: 1 }];
    t.put(1, 0, 1, 'drive_shaft');
    t.run(0.2);
    expect(t.rpm(1, 0, 1)).toBeNull();
    driven = true;
    t.run(0.2);
    expect(t.rpm(1, 0, 1)).toBe(24);
  });
});

describe('vault, vacuum, saw arm, tanks', () => {
  it('an item vault holds many stacks and gives the biggest one back', () => {
    const t = setup();
    t.put(0, 0, 0, 'item_vault');
    expect(t.shop.offer(0, 0, 0, 'flint', 500)).toBe(500);
    expect(t.shop.offer(0, 0, 0, 'plank', 1000000)).toBeLessThan(1000000);
    t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.ground.items.some((i) => i.count > 0)).toBe(true);
  });

  it('a vacuum collector sucks loose items in and passes them to a depot', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'vacuum_collector', Facing.East);
    t.put(2, 0, 0, 'depot');
    t.ground.spawn('flint', 3, 1.5, 0.5, 3.5, { scatter: false });
    t.run(10, [[0, 0, 0]]);
    expect(t.shop.logi.peek(2, 0, 0).find((e) => e.item === 'flint')?.count).toBe(3);
  });

  it('a saw arm fells the whole tree in front of it', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'saw_arm', Facing.East);
    for (let y = 0; y < 4; y++) t.put(2, y, 0, 'oak_log');
    t.run(8, [[0, 0, 0]]);
    for (let y = 0; y < 4; y++) expect(t.world.getBlock(2, y, 0).key).toBe('air');
    expect(t.ground.items.filter((i) => i.item === 'oak_log').reduce((n, i) => n + i.count, 0)).toBeGreaterThanOrEqual(4);
  });

  it('a spout fills a canister from a tank of the pipe network and a drain empties one into it', () => {
    const t = setup();
    const tank = { fluid: 'gasoline', litres: 2000 };
    t.shop.fluidBlock = {
      is: (x, y, z) => x === 0 && z === 0 && (y === 2 || y === -1 + 3 - 3),
      use: (_x, _y, _z, item) => {
        if (item === 'empty_canister' && tank.litres >= 1000) {
          tank.litres -= 1000;
          return 'gasoline_canister';
        }
        if (item === 'gasoline_canister') {
          tank.litres += 1000;
          return 'empty_canister';
        }
        return null;
      },
    };
    t.put(0, 1, 0, 'spout');
    t.put(0, 0, 0, 'depot');
    // The tank block stands at y = 2 above the spout.
    t.shop.offer(0, 0, 0, 'empty_canister', 1);
    t.run(3);
    expect(t.shop.logi.peek(0, 0, 0).find((e) => e.item === 'gasoline_canister')?.count).toBe(1);
    expect(tank.litres).toBe(1000);
    const u = setup();
    u.shop.fluidBlock = { is: (x, y) => x === 0 && y === 0, use: (_x, _y, _z, item) => (item === 'gasoline_canister' ? 'empty_canister' : null) };
    u.put(0, 1, 0, 'item_drain', Facing.East);
    expect(u.shop.offer(0, 1, 0, 'gasoline_canister', 1)).toBe(1);
    expect(u.shop.logi.peek(0, 1, 0).find((e) => e.item === 'empty_canister')?.count).toBe(1);
  });
});

describe('mechanics saves', () => {
  it('an old save without a mech key loads, a brake keeps its heat and its engaged setting, and bad mech data is ignored', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'flywheel');
    t.put(2, 0, 0, 'brake');
    t.put(3, 0, 0, 'shear_pin');
    t.put(4, 0, 0, 'cam_drum');
    t.run(7, [[0, 0, 0]]);
    t.shop.use(2, 0, 0, null, () => undefined); // engage the brake
    t.shop.use(3, 0, 0, null, () => undefined); // copper fuse
    t.shop.use(4, 0, 0, null, () => undefined); // drum program 2
    t.run(0.3);
    const saved = JSON.parse(JSON.stringify(t.shop.toJSON()));
    expect(saved.mech?.v).toBe(1);
    const u = setup();
    for (const [x, , , k] of saved.parts as [number, number, number, string][]) u.put(x, 0, 0, k);
    u.shop.load(saved);
    expect(u.shop.describe(2, 0, 0)).toMatch(/Brake engaged/);
    expect(u.shop.describe(3, 0, 0)).toMatch(/Copper pin/);
    expect(u.shop.describe(4, 0, 0)).toMatch(/Drum program 2: Sweep/);
    const old = { ...saved };
    delete old.mech;
    const v = setup();
    v.shop.load(old);
    v.shop.load({ ...saved, mech: { v: 1, heat: { x: 'hot', '2,0,0': -4 } } });
    v.shop.load({ ...saved, mech: 'junk' });
    expect(() => v.run(1)).not.toThrow();
  });
});
