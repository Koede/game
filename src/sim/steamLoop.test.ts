import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { STEAM_KETTLE_W, STEAM_WATER_L_PER_S } from './brewing';
import type { FurnaceEntity } from './entities';
import { makeKit, type Kit } from './testKit';
import { GroundItems } from '../game/groundItems';
import { Workshop, STEAM_ROTOR } from '../workshop/workshop';

/** The small steam loop: a boiling steam kettle on a furnace gives a rotor above it 16 rpm and 4 stress units. */
function hold(kit: Kit, f: FurnaceEntity, tempC: number, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    f.tempC = tempC;
    kit.sim.tick(DT);
  }
}

describe('steam kettle and rotor', () => {
  const setup = () => {
    const kit = makeKit();
    const f = kit.furnace(0, 1, 0);
    kit.world.put(f.x, f.y + 1, f.z, 'steam_kettle');
    kit.sim.brewUse(f.x, f.y + 1, f.z, 'water_pail');
    return { kit, f, k: { x: f.x, y: f.y + 1, z: f.z } };
  };

  it('is steam only while it boils and holds water, and the rotor numbers are the plan numbers', () => {
    const { kit, f, k } = setup();
    expect(STEAM_ROTOR).toEqual({ rpm: 16, capacity: 4 });
    hold(kit, f, 100, 1);
    expect(kit.sim.steamReadyAt(k.x, k.y, k.z)).toBe(false);
    hold(kit, f, 150, 1);
    expect(kit.sim.steamReadyAt(k.x, k.y, k.z)).toBe(true);
    // Only the steam kettle gives steam, not a plain kettle pot.
    kit.world.put(k.x, k.y, k.z, 'kettle_pot');
    kit.sim.resync();
    hold(kit, f, 150, 1);
    expect(kit.sim.steamReadyAt(k.x, k.y, k.z)).toBe(false);
  });

  it('draws 3.3 kW and burns water only while the rotor has work, then boils dry and stops', () => {
    const { kit, f, k } = setup();
    let work = false;
    kit.sim.setSteamDemand(() => work);
    hold(kit, f, 150, 1);
    const idleWater = (kit.sim.brewView(k.x, k.y, k.z) as { kind: string }).kind;
    expect(idleWater).toBe('kettle');
    expect(f.extractW).toBe(300);
    work = true;
    f.tempC = 150;
    kit.sim.tick(DT);
    expect(f.extractW).toBe(STEAM_KETTLE_W);
    const before = (kit.world.getEntity(k.x, k.y, k.z) as unknown as { waterL: number }).waterL;
    hold(kit, f, 150, 2);
    const after = (kit.world.getEntity(k.x, k.y, k.z) as unknown as { waterL: number }).waterL;
    expect(before - after).toBeCloseTo(2 * STEAM_WATER_L_PER_S, 0);
    hold(kit, f, 150, 600);
    expect(kit.sim.steamReadyAt(k.x, k.y, k.z)).toBe(false);
    expect((kit.world.getEntity(k.x, k.y, k.z) as unknown as { waterL: number }).waterL).toBe(0);
  });

  it('turns a shaft and a millstone through the workshop, and stops when the water is gone', () => {
    const { kit, f, k } = setup();
    const shop = new Workshop(kit.world, kit.bus, new GroundItems(kit.bus), () => 0.5);
    shop.steamAt = (x, y, z) => kit.sim.steamReadyAt(x, y, z);
    kit.sim.setSteamDemand((x, y, z) => (shop.netAt(x, y, z)?.stress ?? 0) > 0);
    kit.world.put(k.x, k.y + 1, k.z, 'steam_rotor');
    kit.world.put(k.x + 1, k.y + 1, k.z, 'drive_shaft');
    kit.world.put(k.x + 2, k.y + 1, k.z, 'mech_millstone');
    const turn = (s: number) => { for (let i = 0; i < Math.round(s / DT); i++) { f.tempC = 150; kit.sim.tick(DT); shop.tick(DT); } };
    turn(2);
    expect(shop.describe(k.x + 1, k.y + 1, k.z)).toMatch(/16 rpm/);
    expect(shop.describe(k.x + 2, k.y + 1, k.z)).not.toMatch(/overstressed/);
    // With a load on the line the kettle burns water; once it is gone everything winds down.
    turn(700);
    expect(shop.describe(k.x + 1, k.y + 1, k.z)).toMatch(/still/);
  });
});
