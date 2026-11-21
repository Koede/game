import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { gearshiftFactor, passOn } from './kinetics';
import { CLOCKWORK, Workshop } from './workshop';

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
  const shop = new Workshop(world, bus, new GroundItems(bus), () => 0.99);
  const put = (x: number, y: number, z: number, key: string) => world.setVoxel(x, y, z, makeVoxel(blockId(key), Facing.North));
  const use = (x: number, y: number, z: number, held: { item: string; count: number } | null = null) => shop.use(x, y, z, held, () => undefined);
  const run = (s: number, crank?: [number, number, number]) => {
    for (let t = 0; t < s; t += 0.05) {
      if (crank && Math.round(t * 20) % 20 === 0) use(...crank);
      shop.tick(0.05);
    }
  };
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  return { shop, put, use, run, toasts };
}
const rpmAt = (t: ReturnType<typeof setup>, x: number) => t.shop.netAt(x, 0, 0) && /(left|right) ([\d.]+) rpm/.exec(t.shop.describe(x, 0, 0) ?? '');

describe('kinetics', () => {
  it('passOn applies reverse, ratio, governor, clutch and worm', () => {
    expect(passOn({ kind: 'reverse_box', s: 0 }, 16, 0)).toBe(-16);
    expect(passOn({ kind: 'ratio_dial', s: 2 }, 16, 0)).toBe(32);
    expect(passOn({ kind: 'governor', s: 0 }, 64, 0)).toBe(32);
    expect(passOn({ kind: 'governor', s: 0 }, -64, 0)).toBe(-32);
    expect(passOn({ kind: 'clutch', s: 0 }, 16, 0)).toBeNull();
    expect(passOn({ kind: 'worm_gear', s: 0 }, 16, 0)).toBe(2);
    expect(gearshiftFactor(1, 0)).toBe(1);
    expect(gearshiftFactor(1, 4.5)).toBe(-1);
  });

  it('a reverse box turns the far side the other way and a belt follows it', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'drive_shaft');
    t.put(2, 0, 0, 'reverse_box');
    t.put(3, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.run(0.3, [0, 0, 0]);
    expect(rpmAt(t, 1)?.[1]).toBe('right');
    expect(rpmAt(t, 3)?.[1]).toBe('left');
    expect(rpmAt(t, 3)?.[2]).toBe('16');
  });

  it('a ratio dial multiplies and Use cycles it; the load per part falls with speed', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'ratio_dial');
    t.put(2, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.use(1, 0, 0); // 1 -> x1
    t.use(1, 0, 0); // x2
    t.run(0.3, [0, 0, 0]);
    expect(rpmAt(t, 2)?.[2]).toBe('32');
  });

  it('a released clutch stops what is beyond it', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'clutch');
    t.put(2, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.run(0.3, [0, 0, 0]);
    expect(rpmAt(t, 2)?.[2]).toBe('16');
    t.use(1, 0, 0);
    t.run(0.3, [0, 0, 0]);
    expect(rpmAt(t, 2)).toBeNull();
    expect(t.shop.describe(1, 0, 0)).toContain('Clutch released');
  });

  it('two cranks around a reverse box jam the gears', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'reverse_box');
    t.put(2, 0, 0, 'hand_crank');
    t.use(0, 0, 0);
    t.use(2, 0, 0);
    t.run(0.2);
    expect(t.shop.netAt(1, 0, 0)?.jammed).toBe(true);
    expect(t.toasts.some((x) => x.includes('fight'))).toBe(true);
  });

  it('chain sprockets join shafts across a gap and pulleys change the speed by size', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'chain_sprocket');
    t.put(8, 0, 0, 'chain_sprocket');
    t.put(9, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.run(0.3, [0, 0, 0]);
    expect(rpmAt(t, 9)?.[2]).toBe('16');
    const u = setup();
    u.put(0, 0, 0, 'hand_crank');
    u.put(1, 0, 0, 'belt_pulley');
    u.put(5, 0, 0, 'belt_pulley');
    u.put(6, 0, 0, 'drive_shaft');
    u.use(5, 0, 0); // big pulley (size 2) at the far end
    u.use(0, 0, 0);
    u.run(0.3, [0, 0, 0]);
    expect(rpmAt(u, 6)?.[2]).toBe('8');
  });

  it('a clockwork motor turns while wound and runs down', () => {
    const t = setup();
    t.put(0, 0, 0, 'clockwork_motor');
    t.put(1, 0, 0, 'drive_shaft');
    t.run(0.2);
    expect(rpmAt(t, 1)).toBeNull();
    t.use(0, 0, 0);
    t.run(0.3);
    expect(rpmAt(t, 1)?.[2]).toBe(String(CLOCKWORK.rpm));
    t.run(CLOCKWORK.windS + 1);
    expect(rpmAt(t, 1)).toBeNull();
  });

  it('a generator block turns a shaft it touches in proportion to its watts', () => {
    const t = setup();
    t.shop.generatorWatts = (x) => (x === 0 ? 400 : 0);
    t.put(0, 0, 0, 'water_wheel');
    t.put(1, 0, 0, 'drive_shaft');
    t.put(2, 0, 0, 'mech_saw');
    t.run(0.3);
    expect(t.shop.netAt(1, 0, 0)?.capacity).toBe(8);
    expect(rpmAt(t, 1)?.[2]).toBe('12');
  });

  it('oil raises the stress capacity of the whole network', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.run(0.2, [0, 0, 0]);
    expect(t.shop.netAt(1, 0, 0)?.capacity).toBe(8);
    let taken = 0;
    t.shop.use(1, 0, 0, { item: 'residue_canister', count: 1 }, (n) => { taken += n; });
    t.run(0.2, [0, 0, 0]);
    expect(taken).toBe(1);
    expect(t.shop.netAt(1, 0, 0)?.capacity).toBe(10);
  });

  it('settings survive a save', () => {
    const t = setup();
    t.put(0, 0, 0, 'ratio_dial');
    t.use(0, 0, 0);
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const u = setup();
    u.put(0, 0, 0, 'ratio_dial');
    u.shop.load(snap);
    expect(u.shop.describe(0, 0, 0)).toContain('x1');
  });
});
