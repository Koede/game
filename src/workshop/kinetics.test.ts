import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { DIAL_RATIOS, cardProgram, clampCardSeconds, freshCard, gearshiftFactor, passOn, snapRatio, stepFactor } from './kinetics';
import { cardButtonText } from '../ui/screens/workshop/workshopScreen';
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
  return { shop, put, use, run, toasts, bus };
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

  it('a watt generator block no longer turns a shaft it touches (tech-spine K6: watts never become shaft power)', () => {
    const t = setup();
    t.put(0, 0, 0, 'water_wheel');
    t.put(1, 0, 0, 'drive_shaft');
    t.put(2, 0, 0, 'mech_saw');
    t.run(0.3);
    expect(t.shop.netAt(1, 0, 0)?.capacity ?? 0).toBe(0);
    expect(rpmAt(t, 1)).toBeNull();
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

  it('distilled lubricant oils a network better than residue', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'drive_shaft');
    t.use(0, 0, 0);
    t.run(0.2, [0, 0, 0]);
    let taken = 0;
    t.shop.use(1, 0, 0, { item: 'lubricant_canister', count: 1 }, (n) => { taken += n; });
    t.run(0.2, [0, 0, 0]);
    expect(taken).toBe(1);
    expect(t.shop.netAt(1, 0, 0)?.capacity).toBe(11.2);
  });

  it('punched-card factor math, clamps and an inserted card override the presets', () => {
    expect(stepFactor({ ratio: 2, direction: -1, seconds: 4 })).toBe(-2);
    expect(stepFactor({ ratio: 3, direction: 0, seconds: 9 })).toBe(0);
    expect(stepFactor({ ratio: 0.5, direction: 1, seconds: 1 })).toBe(0.5);
    expect(gearshiftFactor(0, 0)).toBe(1);
    expect(gearshiftFactor(0, 5)).toBe(0);
    expect(gearshiftFactor(0, 0, cardProgram(freshCard()))).toBe(1);
    expect(gearshiftFactor(0, 5, [[30, 2]])).toBe(2);
    expect(passOn({ kind: 'sequence_gearshift', s: 0 }, 16, 5)).toBeNull();
    expect(passOn({ kind: 'sequence_gearshift', s: 0, card: [[1, 0]] }, 16, 0)).toBeNull();
    expect(passOn({ kind: 'sequence_gearshift', s: 0, card: [[1, 2]] }, 16, 0)).toBe(32);
    expect(clampCardSeconds(0)).toBe(1);
    expect(clampCardSeconds(1)).toBe(1);
    expect(clampCardSeconds(30)).toBe(30);
    expect(clampCardSeconds(31)).toBe(30);
    expect(clampCardSeconds(1.6)).toBe(2);
    for (const ratio of [0, 0.2, 1.2, 9, -4]) expect(DIAL_RATIOS as readonly number[]).toContain(snapRatio(ratio));
    expect(cardButtonText({ ratio: 2, direction: -1, seconds: 30 })).toEqual({ ratio: 'x2', direction: 'rev', seconds: '30s' });
    expect(cardButtonText({ ratio: 1, direction: 0, seconds: 1 })).toEqual({ ratio: 'x1', direction: 'off', seconds: '1s' });
    expect(cardButtonText({ ratio: 3, direction: 1, seconds: 4 })).toEqual({ ratio: 'x3', direction: 'fwd', seconds: '4s' });

    const bare = setup();
    bare.put(0, 0, 0, 'hand_crank');
    bare.put(1, 0, 0, 'sequence_gearshift');
    bare.put(2, 0, 0, 'drive_shaft');
    bare.run(5.2, [0, 0, 0]);
    expect(rpmAt(bare, 2)).toBeNull();

    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'sequence_gearshift');
    t.put(2, 0, 0, 'drive_shaft');
    const pack: string[] = [];
    t.shop.giveItem = (item, n) => { for (let i = 0; i < n; i++) pack.push(item); };
    let taken = 0;
    expect(t.shop.use(1, 0, 0, { item: 'punched_card', count: 1 }, (n) => { taken += n; })).toBe('worked');
    expect(taken).toBe(1);
    t.run(5.2, [0, 0, 0]);
    expect(rpmAt(t, 2)?.[2]).toBe('16');
    const opened: unknown[] = [];
    t.bus.on('ui:open', (e) => opened.push(e.screen));
    expect(t.shop.use(1, 0, 0, null, () => undefined)).toBe('worked');
    expect(opened).toEqual([{ type: 'workshop' }]);
    expect(t.shop.cardSteps()).toEqual(freshCard());
    t.shop.cycleRatio(0);
    expect(t.shop.cardSteps()?.[0].ratio).toBe(2);
    for (let i = 0; i < DIAL_RATIOS.length; i++) {
      expect(DIAL_RATIOS as readonly number[]).toContain(t.shop.cardSteps()?.[0].ratio);
      t.shop.cycleRatio(0);
    }
    expect(t.shop.cardSteps()?.[0].ratio).toBe(2);
    t.shop.cycleDirection(1);
    expect(t.shop.cardSteps()?.[1].direction).toBe(0);
    t.shop.stepSeconds(2, -5);
    expect(t.shop.cardSteps()?.[2].seconds).toBe(1);
    t.shop.stepSeconds(2, 40);
    expect(t.shop.cardSteps()?.[2].seconds).toBe(30);
    t.shop.stepSeconds(2, 1);
    expect(t.shop.cardSteps()?.[2].seconds).toBe(30);

    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const loaded = setup();
    loaded.put(0, 0, 0, 'hand_crank');
    loaded.put(1, 0, 0, 'sequence_gearshift');
    loaded.put(2, 0, 0, 'drive_shaft');
    loaded.shop.load(snap);
    expect(loaded.shop.describe(1, 0, 0)).toContain('Punched card');
    loaded.shop.use(1, 0, 0, null, () => undefined);
    expect(loaded.shop.cardSteps()?.[0].ratio).toBe(2);
    expect(loaded.shop.cardSteps()?.[1].direction).toBe(0);
    expect(loaded.shop.cardSteps()?.[2].seconds).toBe(30);
    loaded.run(0.3, [0, 0, 0]);
    expect(rpmAt(loaded, 2)?.[2]).toBe('32');

    const old = setup();
    old.put(1, 0, 0, 'sequence_gearshift');
    old.shop.load({ v: 1, parts: [[1, 0, 0, 'sequence_gearshift', 1]], machines: [] });
    expect(old.shop.describe(1, 0, 0)).toContain('program 2');
    old.shop.use(1, 0, 0, null, () => undefined);
    expect(old.shop.describe(1, 0, 0)).toContain('program 3');

    let replaced = 0;
    expect(t.shop.use(1, 0, 0, { item: 'punched_card', count: 1 }, (n) => { replaced += n; })).toBe('worked');
    expect(replaced).toBe(1);
    expect(pack).toEqual(['punched_card']);
    t.shop.use(1, 0, 0, null, () => undefined);
    expect(t.shop.cardSteps()).toEqual(freshCard());
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
