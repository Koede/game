/** Fluid tanks on machine screens: rows and wording against real machine views (src/sim/testKit). */
import { describe, expect, it } from 'vitest';
import { makeKit } from '../../../sim/testKit';
import { flowText, fluidList, tankRows, usesWaterBeside } from './fluidText';
import { headline, machineLayout, subline } from './machineText';

describe('machine fluid tanks', () => {
  it('shows a tank stack as one bar in the fluid colour', () => {
    const kit = makeKit();
    const low = kit.machine('tank', 0, 1, 0);
    kit.machine('tank', 0, 2, 0);
    low.fluidIn = { fluid: 'water', litres: 20_000 };
    const view = kit.sim.machineView(0, 2, 0)!;
    const rows = tankRows('tank', view.fluids!);
    expect(rows).toEqual([expect.objectContaining({ id: 'stack', label: 'Water', fluid: 'water', litres: 20_000, capacityL: 32_000, text: '20,000\u00a0/\u00a032,000\u00a0L' })]);
    expect(rows[0].colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(machineLayout('tank', view.role)).toBe('tank');
    expect(headline(view, 'tank')).toEqual({ caption: 'Holds', reading: '20,000 L' });
    expect(subline(view, 'tank')).toBe('of 32,000 L (2 tanks)');
    const empty = makeKit();
    empty.machine('tank', 0, 1, 0);
    expect(tankRows('tank', empty.sim.machineView(0, 1, 0)!.fluids!)[0]).toMatchObject({ label: 'Empty - holds any one fluid', colour: null });
  });

  it('shows what goes in and what comes out of a boiler, a pump and a turbine', () => {
    const kit = makeKit();
    const boiler = kit.machine('boiler', 0, 2, 0);
    boiler.fluidIn = { fluid: 'water', litres: 350 };
    const b = kit.sim.machineView(0, 2, 0)!;
    expect(tankRows('boiler', b.fluids!).map((r) => [r.id, r.label, r.text.replace(/\u00a0/g, ' ')])).toEqual([
      ['in', 'In: Water', '350 / 1,000 L'],
      ['out', 'Out: empty - gives Steam', '0 / 1,000 L'],
    ]);
    expect(machineLayout('boiler', b.role)).toBe('boiler');
    kit.machine('pump', 4, 1, 0);
    const pump = kit.sim.machineView(4, 1, 0)!;
    expect(tankRows('pump', pump.fluids!).map((r) => r.label)).toEqual(['Out: empty - gives Water, Lava or Crude Oil']);
    kit.machine('steam_turbine', 8, 1, 0);
    expect(tankRows('steam_turbine', kit.sim.machineView(8, 1, 0)!.fluids!).map((r) => r.label)).toEqual(['In: empty - takes Steam']);
    expect(fluidList(['water', 'lava'])).toBe('Water or Lava');
  });

  it('words the flow and gives hearth parts their own layout', () => {
    const f = { input: null, output: null, capacityL: 1000, rateL: 200, stack: null };
    expect(flowText('pump', f)).toBe('Pumping 200 L/s');
    expect(flowText('boiler', { ...f, rateL: 400 })).toBe('Boiling 400 L of steam a second');
    expect(flowText('steam_turbine', { ...f, rateL: 800 })).toBe('Using 800 L/s');
    expect(flowText('pump', { ...f, rateL: 0 })).toBe('');
    expect(machineLayout('fluid_hatch', 'hearth_part')).toBe('part');
    expect(machineLayout('pump', 'consumer')).toBe('consumer');
    expect(machineLayout('steam_turbine', 'generator')).toBe('generator');
  });

  it('says a steam engine on water blocks takes the water beside it, not that its input is empty', () => {
    const kit = makeKit();
    kit.furnace(0, 1, 0);
    kit.machine('steam_engine', 0, 2, 0);
    const dry = kit.sim.machineView(0, 2, 0)!;
    expect(usesWaterBeside(dry)).toBe(false);
    expect(tankRows('steam_engine', dry.fluids!, usesWaterBeside(dry))[0].label).toBe('In: empty - takes Water');
    kit.world.put(1, 2, 0, 'water');
    kit.run(0.5);
    const wet = kit.sim.machineView(0, 2, 0)!;
    expect(usesWaterBeside(wet)).toBe(true);
    expect(tankRows('steam_engine', wet.fluids!, true)[0]).toMatchObject({ label: 'In: the water beside it', fluid: 'water', text: '' });
  });
});
