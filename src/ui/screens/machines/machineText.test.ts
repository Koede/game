import { describe, expect, it } from 'vitest';
import { makeKit } from '../../../sim/testKit';
import type { MachineView, NetworkStats } from '../../../sim';
import { alertText, cableText, fuelText, headline, lonelyFurnaceText, machineLayout, machineTone, memberWatts, subline } from './machineText';

const net = (over: Partial<NetworkStats>): NetworkStats =>
  ({
    id: 1, generationW: 3000, demandW: 2000, deliveredW: 2000, storedJ: 0, capacityJ: 0, chargeW: 0, dischargeW: 0,
    ratingW: 10_000, cables: 3, satisfaction: 1, overloaded: false, state: 'ok', members: [], historyG: [], historyUsed: [], ...over,
  }) as NetworkStats;

describe('machine layouts', () => {
  it('gives every machine kind of the game a layout by role', () => {
    expect(machineLayout('crate', 'crate')).toBe('crate');
    expect(machineLayout('thermopile', 'generator')).toBe('generator');
    expect(machineLayout('steam_engine', 'generator')).toBe('generator');
    expect(machineLayout('burner_generator', 'generator')).toBe('burner');
    expect(machineLayout('combustion_engine', 'generator')).toBe('burner');
    expect(machineLayout('fission_pile', 'generator')).toBe('fission');
    expect(machineLayout('battery', 'storage')).toBe('storage');
    expect(machineLayout('lithium_bank', 'storage')).toBe('storage');
    expect(machineLayout('crusher', 'consumer')).toBe('processor');
    expect(machineLayout('electrolyzer', 'consumer')).toBe('processor');
    expect(machineLayout('bore_rig', 'consumer')).toBe('bore');
    expect(machineLayout('lamp', 'consumer')).toBe('consumer');
    expect(machineLayout('blower', 'consumer')).toBe('consumer');
  });

  it('reads real machine views', () => {
    const kit = makeKit();
    kit.machine('battery', 0, 1, 0);
    kit.machine('burner_generator', 1, 1, 0);
    kit.sim.machineSlots(1, 1, 0)?.add('coal', 2);
    kit.machine('lamp', 2, 1, 0);
    kit.run(2);
    const battery = kit.sim.machineView(0, 1, 0) as MachineView;
    expect(headline(battery, 'storage').caption).toBe('Stored');
    expect(subline(battery, 'storage')).toMatch(/^of 2 MJ/);
    const burner = kit.sim.machineView(1, 1, 0) as MachineView;
    expect(headline(burner, 'burner')).toMatchObject({ caption: 'Output' });
    expect(fuelText(burner)).toMatch(/J - .* at this load$/);
    expect(machineTone(burner)).toBe('power');
    const lamp = kit.sim.machineView(2, 1, 0) as MachineView;
    expect(headline(lamp, 'consumer').caption).toBe('Drawing');
    kit.sim.setMachineOn(2, 1, 0, false);
    expect(machineTone(kit.sim.machineView(2, 1, 0) as MachineView)).toBe('neutral');
  });

  it('calls out a placement problem in red', () => {
    const kit = makeKit();
    kit.machine('steam_engine', 0, 1, 0);
    kit.run(1);
    const view = kit.sim.machineView(0, 1, 0) as MachineView;
    expect(view.problem).not.toBeNull();
    expect(machineTone(view)).toBe('bad');
  });
});

describe('network texts', () => {
  it('stays quiet when all is well and explains brown-out, stall and overload', () => {
    expect(alertText(net({}))).toBeNull();
    expect(alertText(net({ satisfaction: 0.6, deliveredW: 1200, state: 'brownout' }))).toMatch(/^Brown-out: 60%/);
    expect(alertText(net({ satisfaction: 0.1, state: 'brownout' }))).toMatch(/^Stalled/);
    expect(alertText(net({ overloaded: true, state: 'overload', satisfaction: 0.5 }))).toMatch(/^Overloaded: the weakest cable carries only 10 kW/);
  });

  it('names the cable limit and signs member watts', () => {
    expect(cableText(net({ ratingW: Infinity, cables: 0 }))).toBe('No cable - no limit');
    expect(cableText(net({ cables: 1 }))).toBe('Cable limit (1 cable)');
    expect(memberWatts(2500)).toBe('+2.5 kW');
    expect(memberWatts(-300)).toBe('-300 W');
    expect(memberWatts(0)).toBe('0 W');
  });

  it('teaches the first step on an unwired furnace', () => {
    expect(lonelyFurnaceText(1)).toMatch(/Dynamo/);
    expect(lonelyFurnaceText(2)).toMatch(/Dynamo/);
    expect(lonelyFurnaceText(3)).not.toMatch(/Dynamo/);
    expect(lonelyFurnaceText(4)).toMatch(/heats itself electrically/);
  });
});
