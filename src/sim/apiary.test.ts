import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { machine } from '../core/registry';
import { COMB_S, HIVE_REACH, MAX_COMBS, POLLEN_BOOST, SETTLE_S, STING_DAMAGE, type HiveEntity } from './apiary';
import { isCrop } from './cropRules';
import { makeKit, type Kit } from './testKit';

const STAGE_S = (machine('crop').params as Record<string, number>).stageS;
const DAWN = 0.05;
const NIGHT = 0.7;

function live(kit: Kit, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    kit.clock.tick(DT);
    kit.sim.tick(DT);
  }
}

function morning(): Kit {
  const kit = makeKit();
  kit.clock.timeOfDay = DAWN;
  return kit;
}

/** `n` poppies in rows of four south-east of x on grass at y - 1 (all within reach). */
function flowers(kit: Kit, x: number, y: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const fx = x + 1 + (i % 4);
    const fz = z - 2 - Math.floor(i / 4);
    kit.world.put(fx, y - 1, fz, 'grass');
    kit.world.put(fx, y, fz, 'ember_poppy');
  }
}

const hive = (kit: Kit, x: number, y: number, z: number): HiveEntity => kit.sim.hiveAt(x, y, z) as HiveEntity;

describe('beehives', () => {
  it('stays empty without forage, and a swarm moves in beside flowers', () => {
    const kit = morning();
    kit.world.put(0, 11, 0, 'beehive');
    live(kit, SETTLE_S + 2);
    expect(hive(kit, 0, 11, 0).settled).toBe(false);
    expect(kit.sim.brewView(0, 11, 0)?.text).toMatch(/empty: needs flowers/);
    const toasts = kit.record('toast');
    flowers(kit, 0, 11, 0, 4);
    live(kit, SETTLE_S + 5);
    expect(hive(kit, 0, 11, 0).settled).toBe(true);
    expect(toasts.some((t) => /swarm/.test(t.text))).toBe(true);
    expect(kit.sim.brewView(0, 11, 0)?.text).toMatch(/busy on 4 flowers/);
  });

  it('fills honeycomb by day (slower with little forage), up to the most it holds, and not at night', () => {
    const kit = morning();
    kit.world.put(0, 11, 0, 'beehive');
    flowers(kit, 0, 11, 0, 8);
    live(kit, SETTLE_S + 5);
    live(kit, COMB_S + 1);
    expect(hive(kit, 0, 11, 0).combs).toBe(1);
    kit.clock.timeOfDay = NIGHT;
    const before = hive(kit, 0, 11, 0).nectarS;
    live(kit, 30);
    expect(hive(kit, 0, 11, 0).nectarS).toBeCloseTo(before, 5);
    expect(kit.sim.brewView(0, 11, 0)?.text).toMatch(/asleep/);
    expect(kit.sim.buzzingHives()).toHaveLength(0);
    const e = hive(kit, 0, 11, 0);
    e.combs = MAX_COMBS;
    kit.clock.timeOfDay = DAWN;
    live(kit, 10);
    expect(e.combs).toBe(MAX_COMBS);
    expect(kit.sim.brewView(0, 11, 0)?.text).toMatch(/full/);
    expect(kit.sim.buzzingHives()).toHaveLength(1);
  });

  it('gives one comb per Use; bare-handed the bees sting, a smoker keeps them calm', () => {
    const kit = morning();
    kit.world.put(0, 11, 0, 'beehive');
    flowers(kit, 0, 11, 0, 8);
    live(kit, SETTLE_S + 5);
    hive(kit, 0, 11, 0).combs = 2;
    const health = kit.player.health;
    expect(kit.sim.brewUse(0, 11, 0, null)).toMatchObject({ ok: true, consume: false, give: 'honeycomb' });
    expect(kit.player.health).toBe(health - STING_DAMAGE);
    const r = kit.sim.brewUse(0, 11, 0, 'bee_smoker');
    expect(r).toMatchObject({ ok: true, give: 'honeycomb' });
    expect(kit.player.health).toBe(health - STING_DAMAGE);
    expect(kit.sim.brewUse(0, 11, 0, 'bee_smoker')).toMatchObject({ ok: false });
  });

  it('pollinates crops in reach: they grow half again as fast by day', () => {
    const kit = morning();
    const crop = (x: number): void => {
      kit.world.put(x, 10, 0, 'farmland');
      kit.world.put(x, 10, 1, 'water');
      kit.world.put(x, 11, 0, 'wheat_1');
    };
    crop(2);
    crop(2 + HIVE_REACH + 4);
    kit.world.put(0, 11, 0, 'beehive');
    flowers(kit, 0, 11, 0, 6);
    live(kit, SETTLE_S + 5);
    const near = kit.world.getEntity(2, 11, 0);
    const far = kit.world.getEntity(2 + HIVE_REACH + 4, 11, 0);
    if (!isCrop(near) || !isCrop(far)) throw new Error('no crop');
    expect(kit.sim.cropView(2, 11, 0)?.pollinated).toBe(true);
    expect(kit.sim.cropView(2 + HIVE_REACH + 4, 11, 0)?.pollinated).toBe(false);
    near.growS = 0;
    far.growS = 0;
    live(kit, 20);
    expect(near.growS / far.growS).toBeCloseTo(POLLEN_BOOST, 1);
    expect(near.growS).toBeLessThan(STAGE_S);
    // With the flowers gone (the wheat stays: ripe-ish crops are forage too) and then the wheat cut, the bees stop pollinating.
    for (let i = 0; i < 6; i++) kit.world.put(1 + (i % 4), 11, -2 - Math.floor(i / 4), 'air');
    kit.world.put(2, 11, 0, 'air');
    kit.world.put(2 + HIVE_REACH + 4, 11, 0, 'air');
    live(kit, 5);
    kit.world.put(2, 11, 0, 'wheat_0');
    live(kit, 1);
    expect(kit.sim.brewView(0, 11, 0)?.text).toMatch(/no flowers near/);
    expect(kit.sim.cropView(2, 11, 0)?.pollinated).toBe(false);
    kit.world.put(1, 11, -2, 'ember_poppy');
    live(kit, 5);
    expect(kit.sim.cropView(2, 11, 0)?.pollinated).toBe(true);
    // Breaking the hive takes the bees away.
    kit.world.put(0, 11, 0, 'air');
    expect(kit.sim.hiveAt(0, 11, 0)).toBeNull();
    expect(kit.sim.cropView(2, 11, 0)?.pollinated).toBe(false);
  });

  it('keeps a hive through a save and repairs a damaged entity', () => {
    const kit = morning();
    kit.world.put(0, 11, 0, 'beehive');
    const e = hive(kit, 0, 11, 0);
    e.settled = true;
    e.combs = 99;
    e.nectarS = Number.NaN;
    kit.sim.resync();
    const again = hive(kit, 0, 11, 0);
    expect(again.settled).toBe(true);
    expect(again.combs).toBe(MAX_COMBS);
    expect(again.nectarS).toBe(0);
  });
});
