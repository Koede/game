import { describe, expect, it } from 'vitest';
import { BOILING_KEEPS_S, BOIL_DRY_SECONDS, BREW_SECONDS, DT, FLAG_BOILED_WATER, FLAG_BREWED } from '../core/constants';
import { blockId, blockOf } from '../core/registry';
import { voxelActive } from '../core/types';
import type { BrewResult } from './brewActions';
import type { BoilBucket, BrewCup } from './brewing';
import type { FurnaceEntity } from './entities';
import { boxCells } from './hearthKit';
import { makeKit, type Kit } from './testKit';

const ok = (r: BrewResult): Extract<BrewResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const reason = (r: BrewResult): string => (r.ok ? 'ok' : r.reason);
const keyAt = (kit: Kit, x: number, y: number, z: number): string => blockOf(kit.world.getVoxel(x, y, z)).key;

/** Runs `seconds` with the furnace held at `tempC` (set before every tick). */
function hold(kit: Kit, f: FurnaceEntity, tempC: number, seconds: number): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) {
    f.tempC = tempC;
    kit.sim.tick(DT);
  }
}

/** Seconds a bucket on a furnace held at tempC takes to boil. */
function boilTime(tempC: number): number {
  const kit = makeKit();
  const f = kit.furnace(0, 1, 0);
  ok(kit.sim.placeContainer(0, 2, 0, 'water_pail'));
  let t = 0;
  while (keyAt(kit, 0, 2, 0) !== 'furnace_bucket_boiling' && t < 60) {
    hold(kit, f, tempC, DT);
    t += DT;
  }
  return t;
}

function bucketOn(kit: Kit, f: FurnaceEntity): BoilBucket {
  ok(kit.sim.placeContainer(f.x, f.y + 1, f.z, 'water_pail'));
  return kit.world.getEntity(f.x, f.y + 1, f.z) as unknown as BoilBucket;
}

describe('bucket on a furnace top', () => {
  it('placing needs a furnace below, an empty cell and a water container', () => {
    const kit = makeKit();
    kit.world.put(3, 1, 3, 'stone');
    expect(reason(kit.sim.placeContainer(3, 2, 3, 'water_pail'))).toMatch(/top of a furnace/);
    kit.furnace(0, 1, 0);
    expect(reason(kit.sim.placeContainer(0, 2, 0, 'pail'))).toMatch(/bucket of water/);
    expect(reason(kit.sim.placeContainer(0, 2, 0, null))).toMatch(/bucket of water/);
    kit.world.put(0, 2, 0, 'stone');
    expect(reason(kit.sim.placeContainer(0, 2, 0, 'water_pail'))).toMatch(/no room/);
    kit.world.put(0, 2, 0, 'air');
    expect(kit.sim.isFurnaceTop(0, 2, 0)).toBe(true);
    expect(kit.sim.isFurnaceTop(3, 2, 3)).toBe(false);
    expect(ok(kit.sim.placeContainer(0, 2, 0, 'water_pail'))).toEqual({ ok: true, consume: true });
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket');
    expect(kit.world.getEntity(0, 2, 0)).toMatchObject({ kind: 'boil_bucket', container: 'water_pail', boiling: false, heatS: 0 });
  });

  it('is never a machine node', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    const placed = kit.record('machine:placed');
    bucketOn(kit, f);
    expect(kit.sim.entityCount).toBe(1);
    expect(kit.sim.machineAt(0, 2, 0)).toBeNull();
    expect(kit.sim.furnaceAt(0, 2, 0)).toBeNull();
    expect(kit.sim.machineView(0, 2, 0)).toBeNull();
    expect(kit.sim.brewCount).toBe(1);
    expect(placed).toEqual([]);
  });

  it('boils in about 16 s at 150 C and 6 s at 400 C', () => {
    expect(boilTime(150)).toBeCloseTo(16, 0);
    expect(boilTime(400)).toBeCloseTo(6, 0);
    expect(boilTime(250)).toBeCloseTo(9.6, 0); // rate (250-100)/200+0.5 = 1.25
  });

  it('does not heat below 100 C and loses progress', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    const b = bucketOn(kit, f);
    hold(kit, f, 150, 4);
    expect(b.heatS).toBeGreaterThan(4 * 0.7);
    hold(kit, f, 90, 2);
    expect(b.heatS).toBeLessThan(3.2);
    hold(kit, f, 90, 10);
    expect(b.heatS).toBe(0);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket');
  });

  it('boiling emits the event and the flag once, swaps the block, draws heat', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    const boiling = kit.record('water:boiling');
    const flags = kit.record('flag');
    const b = bucketOn(kit, f);
    hold(kit, f, 400, 1);
    expect(f.extractW).toBe(600);
    expect(kit.sim.brewView(0, 2, 0)).toMatchObject({ stage: 'heating' });
    hold(kit, f, 400, 6);
    expect(b.boiling).toBe(true);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket_boiling');
    expect(boiling).toEqual([{ x: 0, y: 2, z: 0 }]);
    expect(flags.filter((e) => e.flag === FLAG_BOILED_WATER)).toHaveLength(1);
    expect(f.extractW).toBe(300);
    expect(kit.sim.brewView(0, 2, 0)).toMatchObject({ stage: 'boiling', text: 'Boiling water - take it' });
    hold(kit, f, 400, 20);
    expect(boiling).toHaveLength(1);
  });

  it('stops boiling when the furnace cools below 80 C', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    const b = bucketOn(kit, f);
    hold(kit, f, 400, 8);
    expect(b.boiling).toBe(true);
    hold(kit, f, 90, 1); // 90 C is still above 80: keeps boiling
    expect(b.boiling).toBe(true);
    hold(kit, f, 79, DT);
    expect(b.boiling).toBe(false);
    expect(b.heatS).toBe(6);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket');
  });

  it('boils dry after BOIL_DRY_SECONDS, returns the empty bucket and says so', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    const toasts = kit.record('toast');
    bucketOn(kit, f);
    hold(kit, f, 400, 6.5);
    hold(kit, f, 400, BOIL_DRY_SECONDS - 6);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket_boiling');
    hold(kit, f, 400, 6);
    expect(keyAt(kit, 0, 2, 0)).toBe('air');
    expect(kit.world.getEntity(0, 2, 0)).toBeUndefined();
    expect(kit.player.inventory.count('pail')).toBe(1);
    expect(toasts.map((t) => t.text)).toContain('The bucket boiled dry');
    expect(kit.sim.brewCount).toBe(0);
  });

  it('breaking the furnace returns the bucket', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    bucketOn(kit, f);
    hold(kit, f, 400, 8);
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    kit.run(DT * 2);
    expect(keyAt(kit, 0, 2, 0)).toBe('air');
    expect(kit.player.inventory.count('pail')).toBe(1);
    expect(kit.sim.brewCount).toBe(0);
  });


  it('a full pack drops the returned bucket on the ground', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    bucketOn(kit, f);
    while (kit.player.inventory.space('pail') > 0) kit.player.give('stone', 999);
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    kit.run(DT * 3);
    expect(kit.player.inventory.count('pail')).toBe(0);
    expect(kit.player.ground.count('pail')).toBe(1);
    expect(kit.sim.entityCount).toBe(0);
  });

  it('taking it: cold gives the water bucket, boiling gives the boiling pail with its heat', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    bucketOn(kit, f);
    expect(ok(kit.sim.brewUse(0, 2, 0, null))).toEqual({ ok: true, consume: false, give: 'water_pail' });
    expect(keyAt(kit, 0, 2, 0)).toBe('air');
    expect(kit.sim.brewCount).toBe(0);
    bucketOn(kit, f);
    hold(kit, f, 400, 8);
    expect(ok(kit.sim.brewUse(0, 2, 0, 'stone'))).toEqual({ ok: true, consume: false, give: 'boiling_pail', giveDurability: BOILING_KEEPS_S });
    expect(keyAt(kit, 0, 2, 0)).toBe('air');
  });

  it('works on the roof of a formed hearth', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0, 'furnace_blast');
    const box = kit.formed(0, 1, 0, { tier: 2, closed: true });
    const roof = boxCells(box).find((c) => c.y === box.y1 + 1 && kit.sim.isFurnaceTop(c.x, c.y + 1, c.z));
    expect(roof).toBeDefined();
    const { x, y, z } = roof!;
    ok(kit.sim.placeContainer(x, y + 1, z, 'water_pail'));
    f.tempC = 400;
    hold(kit, f, 400, 6.5);
    expect(keyAt(kit, x, y + 1, z)).toBe('furnace_bucket_boiling');
    expect(f.extractW).toBe(300);
  });
});

/** A cup standing on stone with everything in hand. */
function cup(kit: Kit): void {
  kit.world.put(5, 1, 5, 'stone');
  kit.world.put(5, 2, 5, 'clay_cup');
}

describe('cup setup (brewUse)', () => {
  it('every row of the table, with refusals', () => {
    const kit = makeKit();
    const done = kit.record('brew:done');
    const started = kit.record('brew:started');
    const flags = kit.record('flag');
    const sfx = kit.record('sfx');
    cup(kit);
    const use = (held: string | null): BrewResult => kit.sim.brewUse(5, 2, 5, held);
    const e = (): BrewCup => kit.world.getEntity(5, 2, 5) as unknown as BrewCup;
    expect(e()).toMatchObject({ kind: 'brew_cup', stage: 'cup' });
    // cup
    expect(reason(use(null))).toBe('Set a drip cone on the cup');
    expect(reason(use('dried_tea'))).toBe('Set a drip cone on the cup');
    expect(ok(use('drip_cone'))).toEqual({ ok: true, consume: true });
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_cone');
    // cone
    expect(reason(use(null))).toMatch(/tea leaves or ground coffee/);
    expect(reason(use('tea_leaves'))).toMatch(/tea leaves or ground coffee/);
    expect(reason(use('water_pail'))).toMatch(/tea leaves or ground coffee/);
    expect(ok(use('dried_tea'))).toEqual({ ok: true, consume: true });
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_cone_loaded');
    expect(e()).toMatchObject({ stage: 'loaded', ingredient: 'dried_tea', drink: 'green_tea' });
    expect(kit.sim.brewView(5, 2, 5)).toMatchObject({ stage: 'loaded', drink: 'green_tea' });
    // loaded
    expect(reason(use('water_pail'))).toBe('The water must be boiling - heat the bucket on the furnace');
    expect(reason(use(null))).toBe('Pour boiling water over it');
    expect(reason(use('dried_tea'))).toBe('Pour boiling water over it');
    expect(ok(use('boiling_pail'))).toEqual({ ok: true, consume: true, give: 'pail' });
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_brewing');
    expect(started).toEqual([{ x: 5, y: 2, z: 5, drink: 'green_tea' }]);
    expect(sfx.some((s) => s.name === 'pour')).toBe(true);
    // brewing
    expect(reason(use(null))).toBe('Still dripping');
    expect(reason(use('boiling_pail'))).toBe('Still dripping');
    kit.run(1.1);
    expect(kit.sim.brewView(5, 2, 5)).toMatchObject({ stage: 'brewing', text: 'Brewing 3 s' });
    kit.run(BREW_SECONDS);
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_full');
    expect(done).toEqual([{ x: 5, y: 2, z: 5, drink: 'green_tea' }]);
    expect(flags.filter((f) => f.flag === FLAG_BREWED)).toHaveLength(1);
    expect(sfx.filter((s) => s.name === 'drip').length).toBeGreaterThanOrEqual(7);
    expect(sfx.some((s) => s.name === 'smelt_done')).toBe(true);
    expect(kit.sim.brewView(5, 2, 5)).toMatchObject({ stage: 'done', text: 'Green Tea - take it' });
    kit.run(5);
    expect(done).toHaveLength(1);
    // done: take with anything in hand; the cone stays
    expect(ok(use('stone'))).toEqual({ ok: true, consume: false, give: 'green_tea' });
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_cone');
    expect(e()).toMatchObject({ stage: 'cone', drink: null });
    expect(reason(kit.sim.brewUse(9, 2, 9, null))).toMatch(/nothing/);
  });

  it('every ingredient brews its own drink', () => {
    const kit = makeKit();
    const pairs: Array<[string, string]> = [
      ['dried_tea', 'green_tea'], ['black_tea', 'black_tea_cup'], ['berry_tea_blend', 'berry_tea'],
      ['ground_coffee', 'light_roast'], ['ground_dark_coffee', 'dark_roast'], ['trail_blend', 'trail_blend_cup'],
    ];
    pairs.forEach(([ingredient, drink], i) => {
      kit.world.put(10 + i * 2, 1, 5, 'stone');
      kit.world.put(10 + i * 2, 2, 5, 'clay_cup');
      const x = 10 + i * 2;
      ok(kit.sim.brewUse(x, 2, 5, 'drip_cone'));
      ok(kit.sim.brewUse(x, 2, 5, ingredient));
      ok(kit.sim.brewUse(x, 2, 5, 'boiling_pail'));
      kit.run(BREW_SECONDS + 0.2);
      expect(ok(kit.sim.brewUse(x, 2, 5, null)).give).toBe(drink);
    });
  });

  it('breaking a loaded or finished cup gives the ingredient or drink back', () => {
    const kit = makeKit();
    cup(kit);
    ok(kit.sim.brewUse(5, 2, 5, 'drip_cone'));
    ok(kit.sim.brewUse(5, 2, 5, 'ground_coffee'));
    kit.world.setVoxel(5, 2, 5, 0, 'player');
    expect(kit.player.inventory.count('ground_coffee')).toBe(1);
    expect(kit.world.getEntity(5, 2, 5)).toBeUndefined();
    cup(kit);
    ok(kit.sim.brewUse(5, 2, 5, 'drip_cone'));
    ok(kit.sim.brewUse(5, 2, 5, 'ground_coffee'));
    ok(kit.sim.brewUse(5, 2, 5, 'boiling_pail'));
    kit.run(5);
    kit.world.setVoxel(5, 2, 5, 0, 'player');
    expect(kit.player.inventory.count('light_roast')).toBe(1);
  });

  it('a cup mid-brew survives save and load', () => {
    const kit = makeKit();
    cup(kit);
    ok(kit.sim.brewUse(5, 2, 5, 'drip_cone'));
    ok(kit.sim.brewUse(5, 2, 5, 'dried_tea'));
    ok(kit.sim.brewUse(5, 2, 5, 'boiling_pail'));
    kit.run(1.5);
    const saved = JSON.parse(JSON.stringify(kit.world.getEntity(5, 2, 5)));
    kit.world.removeEntity(5, 2, 5);
    kit.world.setEntity(saved);
    kit.sim.resync();
    expect(kit.sim.brewCount).toBe(1);
    kit.run(1.5);
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_brewing');
    kit.run(1.5);
    expect(keyAt(kit, 5, 2, 5)).toBe('cup_full');
  });
});

describe('save and load of a boiling bucket', () => {
  it('resumes mid-heat and mid-boil', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    bucketOn(kit, f);
    hold(kit, f, 400, 3);
    const saved = JSON.parse(JSON.stringify(kit.world.getEntity(0, 2, 0)));
    kit.world.removeEntity(0, 2, 0);
    kit.world.setEntity(saved);
    kit.sim.resync();
    expect(kit.sim.brewCount).toBe(1);
    hold(kit, f, 400, 2);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket');
    hold(kit, f, 400, 1.5);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_bucket_boiling');
    const boiling = JSON.parse(JSON.stringify(kit.world.getEntity(0, 2, 0)));
    kit.world.removeEntity(0, 2, 0);
    kit.world.setEntity(boiling);
    kit.sim.resync();
    hold(kit, f, 400, 1);
    expect(kit.world.getEntity(0, 2, 0)).toMatchObject({ boiling: true });
    expect(kit.sim.brewView(0, 2, 0)!.stage).toBe('boiling');
  });

  it('adopts a bucket whose entity is damaged and drops one whose block is gone', () => {
    const kit = makeKit();
    kit.world.put(0, 1, 0, 'stone');
    kit.world.setEntity({ kind: 'boil_bucket', x: 0, y: 2, z: 0, heatS: 'x', boiling: 3, dryS: null, container: 'nonsense' });
    kit.world.setEntity({ kind: 'brew_cup', x: 4, y: 2, z: 4, stage: 'nope', drink: 7 });
    kit.sim.resync();
    expect(kit.sim.brewCount).toBe(2);
    kit.run(DT * 2); // neither block stands there
    expect(kit.sim.brewCount).toBe(0);
    expect(kit.world.getEntity(0, 2, 0)).toBeUndefined();
  });
});

describe('kettle', () => {
  const kettle = (kit: Kit, f: FurnaceEntity): void => {
    kit.world.put(f.x, f.y + 1, f.z, 'kettle_pot');
  };

  it('fills with water buckets and boils at 120 C with the active bit', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    kettle(kit, f);
    const boiling = kit.record('water:boiling');
    expect(reason(kit.sim.brewUse(0, 2, 0, 'pail'))).toBe('The kettle is not boiling yet');
    expect(ok(kit.sim.brewUse(0, 2, 0, 'water_pail'))).toEqual({ ok: true, consume: true, give: 'pail' });
    expect(kit.sim.brewView(0, 2, 0)).toMatchObject({ kind: 'kettle', stage: 'filled' });
    hold(kit, f, 119, 1);
    expect(voxelActive(kit.world.getVoxel(0, 2, 0))).toBe(false);
    hold(kit, f, 130, 1);
    expect(voxelActive(kit.world.getVoxel(0, 2, 0))).toBe(true);
    expect(boiling).toHaveLength(1);
    expect(f.extractW).toBe(300);
  });

  it('a boiling kettle fills an empty container with boiling water, 1000 L at a time', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    kettle(kit, f);
    ok(kit.sim.brewUse(0, 2, 0, 'water_pail'));
    hold(kit, f, 200, 1);
    expect(ok(kit.sim.brewUse(0, 2, 0, 'pail'))).toEqual({ ok: true, consume: true, give: 'boiling_pail', giveDurability: BOILING_KEEPS_S });
    expect((kit.world.getEntity(0, 2, 0) as unknown as { waterL: number }).waterL).toBe(0);
    hold(kit, f, 200, DT);
    expect(voxelActive(kit.world.getVoxel(0, 2, 0))).toBe(false);
    expect(reason(kit.sim.brewUse(0, 2, 0, 'pail'))).toBe('The kettle is not boiling yet');
    expect(reason(kit.sim.brewUse(0, 2, 0, 'stone'))).toMatch(/bucket/);
  });

  it('refuses a fifth bucket and works from an empty hand with a hint', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    kettle(kit, f);
    expect(reason(kit.sim.brewUse(0, 2, 0, null))).toMatch(/empty/);
    for (let i = 0; i < 4; i++) ok(kit.sim.brewUse(0, 2, 0, 'water_pail'));
    expect(reason(kit.sim.brewUse(0, 2, 0, 'water_pail'))).toBe('The kettle is full');
    expect(reason(kit.sim.brewUse(0, 2, 0, null))).toMatch(/empty bucket/);
  });
});

describe('perf', () => {
  it('300 buckets, cups and kettles tick well inside a frame budget', () => {
    const kit = makeKit();
    kit.world.fill(0, 0, 0, 60, 0, 60, 'stone');
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) * 3;
      const z = Math.floor(i / 10) * 3;
      kit.world.put(x, 1, z, 'furnace_clay');
      kit.world.put(x, 2, z, 'furnace_bucket');
      kit.world.put(x + 1, 1, z, 'clay_cup');
      kit.world.put(x + 1, 3, z + 1, 'kettle_pot');
    }
    expect(kit.sim.brewCount).toBe(300);
    kit.run(1);
    const t0 = performance.now();
    kit.run(10);
    const perTick = (performance.now() - t0) / (10 / DT);
    expect(perTick).toBeLessThan(20);
  });
});

void blockId;
