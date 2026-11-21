import { describe, expect, it } from 'vitest';
import { BOIL_SECONDS, BOILING_KEEPS_S, BOIL_DRY_SECONDS, DT } from '../core/constants';
import { blockOf, containerBoilingTo, containerEmptiedTo } from '../core/registry';
import { BEAKER_BOIL_SCALE, VIAL_BOIL_SCALE } from '../content/itemsGlass';
import type { BrewResult } from './brewActions';
import type { FurnaceEntity } from './entities';
import { makeKit, type Kit } from './testKit';

const ok = (r: BrewResult): Extract<BrewResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const keyAt = (kit: Kit, x: number, y: number, z: number): string => blockOf(kit.world.getVoxel(x, y, z)).key;

function hold(kit: Kit, f: FurnaceEntity, tempC: number, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    f.tempC = tempC;
    kit.sim.tick(DT);
  }
}

/** Seconds a container on a furnace held at 300 C takes to reach its boiling block. */
function boilTime(container: string, boilingBlock: string): number {
  const kit = makeKit();
  const f = kit.furnace(0, 1, 0);
  ok(kit.sim.placeContainer(0, 2, 0, container));
  let t = 0;
  while (keyAt(kit, 0, 2, 0) !== boilingBlock && t < 60) {
    hold(kit, f, 300, DT);
    t += DT;
  }
  return t;
}

describe('glassware on the furnace top', () => {
  it('a beaker or vial of water boils on its own, faster than a bucket', () => {
    const bucket = boilTime('water_pail', 'furnace_bucket_boiling');
    const beaker = boilTime('water_beaker', 'furnace_beaker_boiling');
    const vial = boilTime('water_vial', 'furnace_vial_boiling');
    expect(bucket).toBeLessThan(60);
    expect(beaker).toBeCloseTo(bucket * BEAKER_BOIL_SCALE, 0);
    expect(vial).toBeCloseTo(bucket * VIAL_BOIL_SCALE, 0);
    expect(vial).toBeLessThan(beaker);
    expect(BOIL_SECONDS).toBeGreaterThan(0);
  });

  it('boiling glass comes back as boiling water that brews a cup and returns the glass', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    ok(kit.sim.placeContainer(0, 2, 0, 'water_vial'));
    hold(kit, f, 300, 10);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_vial_boiling');
    expect(ok(kit.sim.brewUse(0, 2, 0, null))).toEqual({ ok: true, consume: false, give: 'boiling_vial', giveDurability: BOILING_KEEPS_S });
    expect(containerBoilingTo('boiling_vial')?.container?.emptyTo).toBe('glass_vial');
    // A cup brewed with it hands the empty vial back.
    kit.world.put(5, 1, 5, 'stone');
    kit.world.put(5, 2, 5, 'clay_cup');
    kit.run(DT);
    ok(kit.sim.brewUse(5, 2, 5, 'drip_cone'));
    ok(kit.sim.brewUse(5, 2, 5, 'dried_tea'));
    expect(ok(kit.sim.brewUse(5, 2, 5, 'boiling_vial')).give).toBe('glass_vial');
  });

  it('a beaker of sap cooks down to resin, waits without boiling dry, and hands back resin and beaker', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    ok(kit.sim.placeContainer(0, 2, 0, 'pine_sap'));
    hold(kit, f, 300, BOIL_SECONDS * 2);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_sap_resin');
    hold(kit, f, 300, BOIL_DRY_SECONDS + 5);
    expect(keyAt(kit, 0, 2, 0)).toBe('furnace_sap_resin');
    expect(kit.sim.brewView(0, 2, 0)?.text).toMatch(/Pine Resin ready/);
    const before = kit.player.inventory.count('glass_beaker');
    expect(ok(kit.sim.brewUse(0, 2, 0, null))).toEqual({ ok: true, consume: false, give: 'pine_resin' });
    expect(kit.player.inventory.count('glass_beaker')).toBe(before + 1);
  });

  it('sap is never taken for water: not by a kettle, a cup or the empty-beaker lookup', () => {
    expect(containerBoilingTo('pine_resin')).toBeNull();
    expect(containerEmptiedTo('glass_beaker')?.key).toBe('water_beaker');
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    kit.world.put(0, 2, 0, 'kettle_pot');
    kit.run(DT);
    expect(kit.sim.brewUse(0, 2, 0, 'pine_sap').ok).toBe(false);
    expect(ok(kit.sim.brewUse(0, 2, 0, 'water_beaker')).give).toBe('glass_beaker');
  });
});
