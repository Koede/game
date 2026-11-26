import { describe, expect, it } from 'vitest';
import { BLOCKS, blockId } from '../core/registry';
import { makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import {
  ARC_DAMAGE, ARC_REACH, CHARGE_S, PULL_SPEED, ROOT_S, STILL_BONUS_DAMAGE, STILL_STUN_S, heldGlowOf, swingTrailSparks,
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
    expect(s.afterHit('emberfang', 7)).toMatchObject({ marks: 1, burst: false });
    expect(s.afterHit('emberfang', 8)).toMatchObject({ marks: 1, burst: false });
    expect(s.afterHit('emberfang', 7)).toMatchObject({ marks: 2, burst: false });
    expect(s.afterHit('emberfang', 7)).toMatchObject({ marks: 0, burst: true });
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
    expect(s.afterHit('iron_maul', 1)).toMatchObject({ marks: 0, burst: false });
    expect(s.afterHit(null, 1)).toMatchObject({ marks: 0, burst: false });
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

describe('Quiet Hammer, Tidebrand, Rootsong, Starcleaver', () => {
  it('Quiet Hammer: heavy only after standing still, and the stillness is spent', () => {
    const s = new LegendaryState();
    s.observe(0.5, false, false);
    expect(s.beforeHit('quiet_hammer', false).proc).toBe(false);
    s.observe(0.6, false, false);
    const x = s.beforeHit('quiet_hammer', false);
    expect(x).toMatchObject({ damage: STILL_BONUS_DAMAGE, stunS: STILL_STUN_S, proc: true });
    expect(s.beforeHit('quiet_hammer', false).proc).toBe(false);
    s.observe(2, false, false);
    s.observe(0.1, true, false); // moving resets it
    expect(s.beforeHit('quiet_hammer', false).proc).toBe(false);
  });

  it('Tidebrand pulls (negative shove) and Rootsong roots, each deeper with attunement', () => {
    const s = new LegendaryState();
    expect(s.beforeHit('tidebrand', false).shove).toBe(-PULL_SPEED);
    expect(s.beforeHit('tidebrand', false, 2).shove).toBe(-(PULL_SPEED + 4));
    expect(s.beforeHit('rootsong', false).rootS).toBe(ROOT_S);
    expect(s.beforeHit('rootsong', false, 2).rootS).toBeGreaterThan(ROOT_S);
    expect(s.beforeHit('rootsong', false, 99).rootS).toBe(s.beforeHit('rootsong', false, 2).rootS); // clamped
  });

  it('Starcleaver: the arc needs a held charge, which the blow spends', () => {
    const s = new LegendaryState();
    s.observe(CHARGE_S - 0.1, false, true);
    expect(s.beforeHit('starcleaver', false).arc).toBeNull();
    s.observe(0.2, false, true);
    expect(s.beforeHit('starcleaver', false).arc).toEqual({ damage: ARC_DAMAGE, reach: ARC_REACH });
    expect(s.beforeHit('starcleaver', false).arc).toBeNull();
    s.observe(CHARGE_S, false, true);
    s.observe(0.1, false, false); // letting go drops the charge
    expect(s.beforeHit('starcleaver', false).arc).toBeNull();
  });

  it('attunement deepens Emberfang\'s burst and Gale Reed\'s lunge, never changes the verb', () => {
    const s = new LegendaryState();
    for (let i = 0; i < 2; i++) s.afterHit('emberfang', 1, 2);
    const burst = s.afterHit('emberfang', 1, 2);
    expect(burst).toMatchObject({ burst: true, damage: BURST_DAMAGE + 4 });
    expect(burst.radius).toBeGreaterThan(2.5);
    expect(s.tryLunge('gale_reed', 1, 0, 2)!.vx).toBeGreaterThan(LUNGE_SPEED);
  });

  it('glows and trails scale with the setting', () => {
    expect(heldGlowOf('emberfang')).not.toBeNull();
    expect(heldGlowOf('bronze_pickaxe')).toBeNull();
    expect(swingTrailSparks(true, 'high')).toBe(0);
    expect(swingTrailSparks(false, 'low')).toBeLessThan(swingTrailSparks(false, 'high'));
  });
});
