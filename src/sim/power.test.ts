import { describe, expect, it } from 'vitest';
import { BATTERY_EFFICIENCY, SUNSET_AT } from '../core/constants';
import { block, fuelOf, furnaceTier, machine } from '../core/registry';
import { voxelActive } from '../core/types';
import { windAt } from './machines';
import { fire, makeKit, type Kit } from './testKit';

const net = (kit: Kit, x: number, y: number, z: number) => kit.sim.networkAt(x, y, z)!;

describe('heat engines', () => {
  it('a thermopile makes 0.25 W per degree above 100 C and cools the furnace by 4x what is used', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0);
    const pile = kit.machine('thermopile', 1, 1, 0);
    const lamp = kit.machine('lamp', 2, 1, 0);
    expect(kit.sim.machineView(1, 1, 0)!.status).toBe('The furnace is too cold');
    fire(kit, e, 'stick');
    kit.run(200);
    expect(e.tempC).toBeCloseTo(450, 6);
    expect(pile.availW).toBeCloseTo(0.25 * 350, 6);
    // Only the lamp's 10 W is used, so only 40 W of heat is drawn.
    expect(e.extractW).toBeCloseTo(4 * machine('lamp').drawW!, 6);
    expect(kit.sim.generationW()).toBeCloseTo(87.5, 6);
    expect(pile.outW).toBeCloseTo(machine('lamp').drawW!, 6);
    expect(lamp.f).toBe(1);
    expect(voxelActive(kit.world.getVoxel(2, 1, 0))).toBe(true);
    e.tempC = 2000;
    kit.run(0.05);
    expect(pile.availW).toBe(300);
    const lone = kit.machine('thermopile', 10, 1, 0);
    kit.run(0.05);
    expect(lone.availW).toBe(0);
    expect(kit.sim.machineView(10, 1, 0)!.problem).toBe('Must touch a furnace');
  });

  it('a coal fire under a steam engine settles near 820 C delivering 2 kW', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_blast');
    // The smallest Blast hearth (the tier table's numbers) is open at the top: the engine sits on the furnace, and a
    // battery takes its power.
    kit.formed(0, 1, 0);
    const engine = kit.machine('steam_engine', 0, 2, 0);
    kit.machine('battery', 0, 3, 0);
    e.fuel[0] = { item: 'coal', count: 99 };
    e.fuel[1] = { item: 'coal', count: 99 };
    kit.sim.light(0, 1, 0);
    kit.run(120);
    expect(engine.availW).toBe(0);
    expect(kit.sim.machineView(0, 2, 0)!.problem).toBe('Needs water on one side');
    expect(e.tempC).toBeCloseTo(1250, 6);
    kit.world.put(1, 2, 0, 'water');
    kit.run(600);
    expect(e.tempC).toBeGreaterThan(815);
    expect(e.tempC).toBeLessThan(825);
    expect(engine.availW).toBe(2000);
    expect(e.extractW).toBe(6000);
    // Beside the furnace instead of on top: no steam.
    const side = kit.machine('steam_engine', 0, 1, 3);
    kit.furnace(0, 1, 4, 'furnace_blast').tempC = 1000;
    kit.world.put(1, 1, 3, 'water');
    kit.run(0.1);
    expect(side.availW).toBe(0);
    expect(kit.sim.machineView(0, 1, 3)!.problem).toBe('Must sit on top of a furnace');
  });
});

describe('generators and their placement rules', () => {
  it('water wheels need two water blocks and share the stream', () => {
    const kit = makeKit();
    const a = kit.machine('water_wheel', 0, 1, 0);
    kit.world.put(0, 0, 0, 'water');
    kit.run(0.05);
    expect(a.availW).toBe(0);
    expect(kit.sim.machineView(0, 1, 0)!.problem).toBe('Needs water on 2 sides (1 now)');
    kit.world.put(0, 2, 0, 'water');
    kit.run(0.05);
    expect(a.availW).toBe(400);
    const b = kit.machine('water_wheel', 3, 1, 0);
    kit.world.put(3, 0, 0, 'water');
    kit.world.put(3, 2, 0, 'water');
    kit.run(0.05);
    expect(a.availW).toBe(200);
    expect(b.availW).toBe(200);
    kit.world.setVoxel(3, 1, 0, 0);
    kit.machine('water_wheel', 4, 1, 0);
    kit.run(0.05);
    expect(a.availW).toBe(400);
  });

  it('a dynamo makes 30 W per shaft rpm from 64 rpm, capped at 2 kW, and nothing from a still line', () => {
    const kit = makeKit();
    const d = kit.machine('dynamo', 0, 1, 0);
    kit.run(0.05);
    expect(d.availW).toBe(0);
    expect(kit.sim.machineView(0, 1, 0)!.problem).toBe('Needs a shaft line turning 64 rpm or more');
    let rpm = 63;
    kit.sim.shaftRpm = () => rpm;
    kit.run(0.05);
    expect(d.availW).toBe(0); // too slow
    rpm = 64;
    kit.run(0.05);
    expect(d.availW).toBe(1920);
    expect(kit.sim.machineView(0, 1, 0)!.problem).toBeNull();
    rpm = 128;
    kit.run(0.05);
    expect(d.availW).toBe(2000);
  });

  it('wind turbines need open sky and like altitude', () => {
    const kit = makeKit();
    const p = machine('wind_turbine').params!;
    const low = kit.machine('wind_turbine', 0, 10, 0);
    const high = kit.machine('wind_turbine', 8, 80, 0);
    kit.run(0.05);
    const wind = windAt(kit.clock.worldTimeS, p.windMin, p.windMax);
    expect(wind).toBeGreaterThanOrEqual(0.25);
    expect(wind).toBeLessThanOrEqual(1);
    expect(low.availW).toBeCloseTo(1500 * wind * 0.25, 6);
    expect(high.availW).toBeCloseTo(1500 * wind, 6);
    kit.world.put(8, 90, 0, 'stone');
    kit.run(0.05);
    expect(high.availW).toBe(0);
    expect(kit.sim.machineView(8, 80, 0)!.problem).toBe('Needs open sky above');
    for (let t = 0; t < 5000; t += 37) {
      const w = windAt(t, p.windMin, p.windMax);
      expect(w >= p.windMin && w <= p.windMax).toBe(true);
    }
  });

  it('solar panels follow the sun', () => {
    const kit = makeKit();
    const panel = kit.machine('solar_panel', 0, 5, 0);
    kit.clock.setTimeOfDay(0.3);
    kit.run(0.05);
    expect(panel.availW).toBe(300);
    kit.clock.setTimeOfDay(SUNSET_AT + 0.1);
    kit.run(0.05);
    expect(panel.availW).toBe(0);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('No sunlight');
    kit.clock.setTimeOfDay(0.3);
    kit.world.put(0, 9, 0, 'plank');
    kit.run(0.05);
    expect(panel.availW).toBe(0);
  });

  it('geothermal taps make 2 kW per touching lava block up to 6 kW', () => {
    const kit = makeKit();
    const tap = kit.machine('geothermal_tap', 0, 5, 0);
    kit.run(0.05);
    expect(tap.availW).toBe(0);
    expect(kit.sim.machineView(0, 5, 0)!.problem).toBe('Must touch lava');
    kit.world.put(0, 4, 0, 'lava');
    kit.run(0.05);
    expect(tap.availW).toBe(2000);
    for (const [x, y, z] of [[1, 5, 0], [-1, 5, 0], [0, 5, 1], [0, 5, -1]]) kit.world.put(x, y, z, 'lava');
    kit.run(0.05);
    expect(tap.availW).toBe(6000);
  });

  it('fuel generators are available only while they hold fuel and burn it in proportion to the load', () => {
    const kit = makeKit();
    const burner = kit.machine('burner_generator', 0, 1, 0);
    const heater = kit.machine('space_heater', 1, 1, 0);
    const slots = kit.sim.machineSlots(0, 1, 0)!;
    kit.run(0.5);
    expect(burner.availW).toBe(0);
    expect(heater.f).toBe(0);
    expect(kit.sim.machineView(0, 1, 0)!.status).toBe('No fuel');
    expect(kit.sim.machineView(1, 1, 0)!.status).toBe('No power');
    expect(slots.accepts('fuel_canister', 0)).toBe(false);
    expect(slots.add('stick', 10)).toBe(0);
    kit.run(100);
    expect(burner.availW).toBe(3000);
    expect(burner.outW).toBeCloseTo(300, 6);
    // 300 W for 100 s = 30 kJ; a stick is worth 30 kJ x 0.3 = 9 kJ of electricity.
    const perStick = fuelOf('stick')!.energyJ * machine('burner_generator').efficiency!;
    expect(burner.slots[0]!.count).toBe(6);
    expect(burner.fuelJ).toBeCloseTo(4 * perStick - 300 * 100, 3);
    expect(voxelActive(kit.world.getVoxel(1, 1, 0))).toBe(true);
    kit.sim.setMachineOn(1, 1, 0, false);
    kit.run(50);
    expect(burner.slots[0]!.count).toBe(6);
    expect(burner.outW).toBe(0);

    const engine = kit.machine('combustion_engine', 0, 1, 8);
    engine.slots[0] = { item: 'fuel_canister', count: 1 };
    kit.machine('lithium_bank', 1, 1, 8);
    kit.run(100);
    expect(engine.availW).toBe(12000);
    expect(engine.slots[0]).toBeNull();
    expect(engine.fuelJ).toBeCloseTo(2_400_000 - 12000 * 100, 0);
    expect(kit.sim.machineSlots(0, 1, 8)!.accepts('coal', 0)).toBe(false);
    expect(kit.sim.machineView(0, 1, 8)!.fuelLeftS).toBeCloseTo(100, 1);
  });
});

describe('network solving', () => {
  const tapAt = (kit: Kit, x: number, z: number, lava = 1) => {
    const tap = kit.machine('geothermal_tap', x, 5, z);
    kit.world.put(x, 4, z, 'lava');
    if (lava > 1) kit.world.put(x, 6, z, 'lava');
    if (lava > 2) kit.world.put(x, 5, z - 1, 'lava');
    return tap;
  };

  it('charges batteries from surplus at 90% efficiency, within their rate', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    const battery = kit.machine('battery', 1, 5, 0);
    kit.run(10);
    expect(battery.storedJ).toBeCloseTo(2000 * BATTERY_EFFICIENCY * 10, 3);
    const stats = net(kit, 0, 5, 0);
    expect(stats).toMatchObject({ generationW: 2000, demandW: 0, deliveredW: 0, chargeW: 2000, satisfaction: 1, ratingW: Infinity });
    expect(stats.capacityJ).toBe(2_000_000);
    expect(kit.sim.storedJ()).toBeCloseTo(battery.storedJ, 6);
    expect(stats.members.map((m) => m.kind).sort()).toEqual(['battery', 'geothermal_tap']);
    // Three lava blocks give 6 kW but one battery takes at most 3 kW.
    kit.world.put(0, 6, 0, 'lava');
    kit.world.put(0, 5, -1, 'lava');
    kit.run(1);
    expect(net(kit, 0, 5, 0).chargeW).toBe(3000);
    battery.storedJ = 2_000_000 - 100;
    kit.run(1);
    expect(battery.storedJ).toBeCloseTo(2_000_000, 6);
    expect(net(kit, 0, 5, 0).chargeW).toBeCloseTo(0, 6);
  });

  it('batteries cover only what generators cannot', () => {
    const kit = makeKit();
    const battery = kit.machine('battery', 0, 5, 0);
    battery.storedJ = 1_000_000;
    const heater = kit.machine('space_heater', 1, 5, 0);
    kit.run(100);
    expect(heater.f).toBe(1);
    expect(battery.storedJ).toBeCloseTo(1_000_000 - 300 * 100, 3);
    expect(net(kit, 0, 5, 0)).toMatchObject({ generationW: 0, dischargeW: 300, deliveredW: 300 });
    const pile = kit.machine('thermopile', 2, 5, 0);
    kit.furnace(3, 5, 0).tempC = 420;
    kit.run(0.05);
    expect(pile.availW).toBeCloseTo(80, 0);
    expect(net(kit, 0, 5, 0).dischargeW).toBeCloseTo(300 - pile.availW, 6);
    battery.storedJ = 0;
    kit.run(0.05);
    expect(heater.f).toBeCloseTo(pile.availW / 300, 6);
  });

  it('shares a shortage evenly, slows machines by it, and stalls them below a quarter', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    tapAt(kit, 0, 0);
    const crusher = kit.machine('crusher', 1, 5, 0);
    const still = kit.machine('still', 2, 5, 0);
    crusher.slots[0] = { item: 'copper_ore', count: 50 };
    still.slots[0] = { item: 'oil_shale', count: 50 };
    kit.run(6.05);
    expect(net(kit, 0, 5, 0)).toMatchObject({ demandW: 3000, generationW: 2000, state: 'brownout' });
    expect(crusher.f).toBeCloseTo(2 / 3, 9);
    // The 4 s job takes 6 s at two thirds power.
    expect(crusher.slots[1]).toEqual({ item: 'crushed_copper', count: 2 });
    expect(crusher.slots[0]!.count).toBe(49);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe('brownout');

    const centrifuge = kit.machine('centrifuge', 3, 5, 0);
    centrifuge.slots[0] = { item: 'yellowcake', count: 8 };
    kit.run(1);
    const before = crusher.progress;
    kit.run(5);
    expect(crusher.f).toBeLessThan(0.25);
    expect(crusher.progress).toBe(before);
    expect(centrifuge.progress).toBe(0);
    expect(kit.sim.machineView(3, 5, 0)!.status).toBe('Not enough power');
    expect(voxelActive(kit.world.getVoxel(1, 5, 0))).toBe(false);
    expect(alerts).toHaveLength(1);

    kit.sim.setMachineOn(3, 5, 0, false);
    kit.sim.setMachineOn(2, 5, 0, false);
    kit.run(4);
    expect(crusher.f).toBe(1);
    expect(alerts.map((a) => a.kind)).toEqual(['brownout', 'recovered']);
    kit.run(20);
    expect(alerts).toHaveLength(2);
  });

  it('caps a network at its weakest cable and flags the overload', () => {
    const kit = makeKit();
    const alerts = kit.record('power:alert');
    const engine = kit.machine('combustion_engine', 0, 5, 0);
    engine.slots[0] = { item: 'fuel_canister', count: 16 };
    kit.world.put(1, 5, 0, 'heavy_cable');
    kit.world.put(2, 5, 0, 'copper_cable');
    const cell = kit.machine('electrolyzer', 3, 5, 0);
    kit.world.put(3, 4, 0, 'water');
    cell.slots[0] = { item: 'empty_cell', count: 4 };
    kit.run(2);
    const stats = net(kit, 0, 5, 0);
    expect(stats.ratingW).toBe(block('copper_cable').cableRatingW);
    expect(stats.cables).toBe(2);
    expect(stats).toMatchObject({ generationW: 12000, demandW: 20000, deliveredW: 10000, satisfaction: 0.5, overloaded: true, state: 'overload' });
    expect(alerts.map((a) => a.kind)).toEqual(['overload']);
    expect(engine.outW).toBeCloseTo(10000, 6);
    // With the copper cable replaced the limit is the generator, not the cable.
    kit.world.put(2, 5, 0, 'heavy_cable');
    kit.run(4);
    expect(net(kit, 0, 5, 0)).toMatchObject({ ratingW: 120000, deliveredW: 12000, overloaded: false, state: 'brownout' });
    expect(alerts.map((a) => a.kind)).toEqual(['overload', 'brownout']);
  });

  it('splits and merges networks as cables are removed and added', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.world.put(1, 5, 0, 'copper_cable');
    kit.world.put(2, 5, 0, 'copper_cable');
    const lamp = kit.machine('lamp', 3, 5, 0);
    kit.run(0.1);
    expect(kit.sim.allNetworks()).toHaveLength(1);
    expect(lamp.f).toBe(1);
    expect(net(kit, 3, 5, 0).members).toHaveLength(2);
    kit.world.setVoxel(2, 5, 0, 0, 'player');
    kit.run(0.1);
    expect(kit.sim.allNetworks()).toHaveLength(2);
    expect(lamp.f).toBe(0);
    expect(voxelActive(kit.world.getVoxel(3, 5, 0))).toBe(false);
    expect(net(kit, 3, 5, 0).id).not.toBe(net(kit, 0, 5, 0).id);
    kit.world.put(2, 5, 0, 'heavy_cable');
    kit.run(0.1);
    expect(kit.sim.allNetworks()).toHaveLength(1);
    expect(lamp.f).toBe(1);
    expect(kit.sim.networkAt(9, 9, 9)).toBeNull();
  });

  it('keeps a rolling history of generation and use', () => {
    const kit = makeKit();
    tapAt(kit, 0, 0);
    kit.machine('space_heater', 1, 5, 0);
    kit.run(3);
    const stats = net(kit, 0, 5, 0);
    expect(stats.historyG).toHaveLength(60);
    expect(stats.historyG.slice(-3)).toEqual([2000, 2000, 2000]);
    expect(stats.historyUsed.slice(-3)).toEqual([300, 300, 300]);
    expect(stats.historyG[0]).toBe(0);
  });
});

describe('electric heat', () => {
  it('an arc furnace on a grid holds its maximum temperature by thermostat', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 1, 0, 'furnace_arc');
    kit.formed(0, 1, 0);
    const engine = kit.machine('combustion_engine', 0, 1, -1); // before the furnace's mouth
    engine.slots[0] = { item: 'fuel_canister', count: 16 };
    const tier = furnaceTier(4);
    kit.run(1);
    expect(e.demandW).toBe(tier.electricHeatW);
    kit.run(900);
    expect(e.tempC).toBeCloseTo(tier.maxTempC, 1);
    expect(e.demandW).toBeCloseTo(tier.lossWPerC * (tier.maxTempC - 20), 0);
    const view = kit.sim.furnaceView(0, 1, 0)!;
    expect(view.electric).toMatchObject({ available: true, on: true, maxW: 8000 });
    expect(view.electric.deliveredW).toBeCloseTo(e.demandW, 6);
    kit.sim.setElectric(0, 1, 0, false);
    kit.run(60);
    expect(e.demandW).toBe(0);
    expect(e.tempC).toBeLessThan(1500);
    expect(kit.sim.setElectric(5, 5, 5, true).ok).toBe(false);
    kit.furnace(9, 1, 0);
    expect(kit.sim.setElectric(9, 1, 0, true)).toEqual({ ok: false, reason: 'Electric heating starts with the Arc Furnace' });
  });
});
