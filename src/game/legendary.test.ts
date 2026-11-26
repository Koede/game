import { describe, expect, it } from 'vitest';
import { BLOCKS, blockId } from '../core/registry';
import { makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import {
  BURST_DAMAGE, LANTERN_STUN_S, LegendaryState, LUNGE_COOLDOWN_S, LUNGE_SPEED, LUNGE_WINDOW_S, MARK_CAP, MARK_LIMIT, MARK_TTL_S, ORE_HUM_RADIUS, oreHum,
} from './legendary';

const world = (cells: Record<string, string> = {}): IWorld => {
  const get = (x: number, y: number, z: number): Voxel => {
    const k = cells[`${x},${y},${z}`];
    return makeVoxel(blockId(k ?? (y <= 0 ? 'stone' : 'air')));
  };
  return { getVoxel: get, getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(get(x, y, z))], isLoaded: () => true } as unknown as IWorld;
};

describe('Emberfang marks', () => {
  it('count up per creature and burst on the third, then start again', () => {
    const s = new LegendaryState();
    expect(s.afterHit('emberfang', 7)).toEqual({ marks: 1, burst: false });
    expect(s.afterHit('emberfang', 8)).toEqual({ marks: 1, burst: false });
    expect(s.afterHit('emberfang', 7)).toEqual({ marks: 2, burst: false });
    expect(s.afterHit('emberfang', 7)).toEqual({ marks: 0, burst: true });
    expect(s.marksOn(7)).toBe(0);
    expect(s.marksOn(8)).toBe(1);
    expect(s.afterHit('emberfang', 7).marks).toBe(1);
    expect(MARK_LIMIT).toBe(3);
    expect(BURST_DAMAGE).toBeGreaterThan(0);
  });

  it('fade after their time, and only the Emberfang makes them', () => {
    const s = new LegendaryState();
    s.afterHit('emberfang', 1);
    s.tick(MARK_TTL_S - 0.1);
    expect(s.marksOn(1)).toBe(1);
    s.tick(0.2);
    expect(s.marksOn(1)).toBe(0);
    expect(s.afterHit('iron_maul', 1)).toEqual({ marks: 0, burst: false });
    expect(s.afterHit(null, 1)).toEqual({ marks: 0, burst: false });
  });

  it('remember a bounded number of creatures', () => {
    const s = new LegendaryState();
    for (let i = 0; i < MARK_CAP + 10; i++) s.afterHit('emberfang', i);
    expect(s.marksOn(0)).toBe(0);
    expect(s.marksOn(MARK_CAP + 9)).toBe(1);
  });
});

describe('Gale Reed lunge', () => {
  it('goes the way you face at its speed, then cools down; a hit inside the window spends it', () => {
    const s = new LegendaryState();
    const a = s.tryLunge('gale_reed', 0, -2)!;
    expect(a.vz).toBeCloseTo(-LUNGE_SPEED);
    expect(a.vx).toBeCloseTo(0);
    expect(a.vy).toBeGreaterThan(0);
    expect(s.tryLunge('gale_reed', 0, -1)).toBeNull();
    expect(s.beforeHit('gale_reed', false).lunge).toBe(true);
    expect(s.beforeHit('gale_reed', false).lunge).toBe(false); // spent
    s.tick(LUNGE_COOLDOWN_S + 0.01);
    expect(s.tryLunge('gale_reed', 1, 0)).not.toBeNull();
  });

  it('is not offered to other items, and needs a direction', () => {
    const s = new LegendaryState();
    expect(s.tryLunge('emberfang', 0, 1)).toBeNull();
    expect(s.tryLunge('gale_reed', 0, 0)).toBeNull();
  });

  it('a window left unused runs out, and a blow that did not land gives it back', () => {
    const s = new LegendaryState();
    s.tryLunge('gale_reed', 1, 0);
    s.tick(LUNGE_WINDOW_S + 0.01);
    expect(s.beforeHit('gale_reed', false).proc).toBe(false);
    s.tryLunge('gale_reed', 1, 0);
    s.tick(LUNGE_COOLDOWN_S);
    s.tryLunge('gale_reed', 1, 0);
    s.beforeHit('gale_reed', false);
    s.giveBackLunge();
    expect(s.beforeHit('gale_reed', false).lunge).toBe(true);
  });
});

describe('Lanternblade', () => {
  it('bursts in the dark only, and only for itself', () => {
    const s = new LegendaryState();
    expect(s.beforeHit('lanternblade', true)).toMatchObject({ proc: true, stunS: LANTERN_STUN_S });
    expect(s.beforeHit('lanternblade', false).proc).toBe(false);
    expect(s.beforeHit('emberfang', true).proc).toBe(false);
  });
});

describe('Orrin\'s Spare Pick hum', () => {
  it('hears ore through a wall, louder when nearer, and nothing for another item', () => {
    const w = world({ '3,1,0': 'iron_ore', '2,1,0': 'stone', '1,1,0': 'stone' });
    const near = oreHum(w, 'orrins_spare_pick', 2.5, 1, 0.5);
    const far = oreHum(w, 'orrins_spare_pick', -1.5, 1, 0.5);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(oreHum(w, 'bronze_pickaxe', 2.5, 1, 0.5)).toBe(0);
    expect(oreHum(w, null, 2.5, 1, 0.5)).toBe(0);
    expect(oreHum(world(), 'orrins_spare_pick', 0.5, 1, 0.5)).toBe(0);
    expect(oreHum(w, 'orrins_spare_pick', 3.5 + ORE_HUM_RADIUS + 3, 1, 0.5)).toBe(0);
  });
});
