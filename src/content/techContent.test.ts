import { describe, expect, it } from 'vitest';
import { HEARTH_CEILING_PARTS, HEARTH_FACE_PARTS, LITRES_PER_BUCKET } from '../core/constants';
import { faceCells, hearthCrucibles, smallestShell } from '../core/hearth';
import {
  BLOCKS, FLUIDS, FURNACE_TIERS, MACHINES, MAX_FURNACE_TIER, OBJECTIVES, block, bucketFilledWith, fluid, fluidInBucket,
  fluidOfLiquid, fluidOrNull, fuelOf, furnaceTier, hearthWallTier, isFluidEndpoint, isItemEndpoint, item, machine, pipeCarries,
  pipeJoins, recipesFor,
} from '../core/registry';
import { hearthMaterials, solve, type Progress } from './progression';
import { TECH_SPEC } from './specRosterTech';

const stages: Progress[] = Array.from({ length: MAX_FURNACE_TIER + 1 }, (_, t) => solve(t));
const firstStage = (key: string): number => stages.findIndex((p) => p.items.has(key));

describe('16. item and fluid transport', () => {
  it('has the five fluids with their colours, heat, glow, sources and buckets', () => {
    expect(FLUIDS.map((f) => f.key)).toEqual(Object.keys(TECH_SPEC.fluids));
    for (const [key, [name, hot, glow, liquid, full]] of Object.entries(TECH_SPEC.fluids)) {
      const f = fluid(key as never);
      expect([f.name, f.hot, f.glow, f.liquid ?? null, f.bucket?.full ?? null], key).toEqual([name, hot, glow, liquid, full]);
    }
    expect(fluidOrNull('mercury')).toBeNull();
    expect(fluidOfLiquid('oil')?.key).toBe('crude_oil');
    expect(fluidInBucket('water_pail')?.key).toBe('water');
    expect(fluidInBucket('lava_bucket')?.key).toBe('lava');
    expect(fluidInBucket('pail')).toBeNull();
    expect(bucketFilledWith('pail', 'water')).toBe('water_pail');
    expect(bucketFilledWith('bronze_bucket', 'lava')).toBe('lava_bucket');
    expect(bucketFilledWith('pail', 'lava')).toBeNull(); // the wooden bucket would burn
    expect(bucketFilledWith('pail', 'crude_oil')).toBeNull();
    // Colours read apart from each other in a pipe window.
    const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    for (const a of FLUIDS) for (const b of FLUIDS) if (a !== b) expect(Math.hypot(...rgb(a.colour).map((v, i) => v - rgb(b.colour)[i])), `${a.key}/${b.key}`).toBeGreaterThan(60);
  });

  it('gives every fluid endpoint the ports of 16.2, and nothing else has any', () => {
    const withPorts = [...MACHINES.values()].filter((m) => m.fluids).map((m) => m.kind).sort();
    expect(withPorts).toEqual(Object.keys(TECH_SPEC.fluidPorts).sort());
    for (const [kind, [accepts, gives, capacityL]] of Object.entries(TECH_SPEC.fluidPorts)) {
      const f = machine(kind).fluids;
      expect([f?.accepts ?? [], f?.gives ?? [], f?.capacityL], kind).toEqual([accepts, gives, capacityL]);
    }
  });

  it('a lava fuel by pipe is worth exactly a lava bucket, and a bucket is 1000 L', () => {
    expect(LITRES_PER_BUCKET).toBe(1000);
    expect(machine('fluid_hatch').params?.lavaLPerFuel).toBe(LITRES_PER_BUCKET);
    expect(fuelOf('lava_bucket')?.energyJ).toBeGreaterThan(0);
    expect(machine('combustion_engine').params?.fuelLPerCanister).toBe(1000);
    // The boiler and the turbine agree: one boiler at full boil feeds one turbine at full output.
    expect(machine('boiler').params?.capLPerS).toBe(machine('steam_turbine').params?.steamLPerS);
    // The turbine beats the steam engine's heat-to-power ratio (3 W of heat per W): 20 J of heat per 10 J of power.
    const turbineJPerL = (machine('steam_turbine').outputW ?? 0) / (machine('steam_turbine').params?.steamLPerS ?? 1);
    expect((machine('boiler').params?.heatPerSteamL ?? 0) / turbineJPerL).toBeLessThan(machine('steam_engine').params?.heatPerWatt ?? 0);
  });

  it('joins pipes to their own family and its endpoints only', () => {
    const [itemPipe, fastPipe, fluidPipe, hotPipe] = ['item_pipe', 'fast_item_pipe', 'fluid_pipe', 'hot_fluid_pipe'].map(block);
    for (const end of ['crate', 'furnace_clay', 'furnace_star', 'item_hatch', 'crusher', 'burner_generator', 'bore_rig']) {
      expect(isItemEndpoint(block(end)), end).toBe(true);
      expect(pipeJoins(itemPipe, block(end)), end).toBe(true);
    }
    for (const end of ['tank', 'pump', 'boiler', 'steam_turbine', 'fluid_hatch', 'still', 'geothermal_tap']) {
      expect(isFluidEndpoint(block(end)), end).toBe(true);
      expect(pipeJoins(fluidPipe, block(end)), end).toBe(true);
    }
    expect(pipeJoins(itemPipe, fastPipe)).toBe(true);
    expect(pipeJoins(fluidPipe, hotPipe)).toBe(true);
    expect(pipeJoins(itemPipe, fluidPipe)).toBe(false);
    expect(pipeJoins(fluidPipe, block('crate'))).toBe(false);
    expect(pipeJoins(itemPipe, block('tank'))).toBe(false);
    expect(pipeJoins(itemPipe, block('stone'))).toBe(false);
    expect(pipeJoins(block('stone'), itemPipe)).toBe(false);
    for (const k of ['lamp', 'power_port', 'copper_cable', 'stone']) expect(isItemEndpoint(block(k)) || isFluidEndpoint(block(k)), k).toBe(false);
  });

  it('keeps hot fluids out of cold pipes and all fluids out of item pipes', () => {
    const [itemPipe, fluidPipe, hotPipe] = ['item_pipe', 'fluid_pipe', 'hot_fluid_pipe'].map(block);
    for (const f of FLUIDS) {
      expect(pipeCarries(hotPipe, f), f.key).toBe(true);
      expect(pipeCarries(fluidPipe, f), f.key).toBe(!f.hot);
      expect(pipeCarries(itemPipe, f), f.key).toBe(false);
    }
    expect(FLUIDS.filter((f) => f.hot).map((f) => f.key)).toEqual(['lava', 'steam']);
  });

  it('makes the wrench a tool that is no mining tool', () => {
    const wrench = item('wrench');
    expect(wrench.tool).toBeUndefined();
    expect(wrench.category).toBe('tool');
    expect(wrench.stack).toBe(1);
    expect(recipesFor('wrench')[0]).toMatchObject({ station: 'furnace', kind: 'forge', minTier: 1, minTempC: 600 });
  });

  it('makes pipes and the wrench obtainable in the age the spec puts them in', () => {
    expect(firstStage('item_pipe')).toBe(1);
    expect(firstStage('wrench')).toBe(1);
    for (const k of ['fast_item_pipe', 'fluid_pipe', 'hot_fluid_pipe', 'pump', 'tank', 'boiler']) expect(firstStage(k), k).toBe(2);
    expect(firstStage('steam_turbine')).toBe(3);
  });

  it('runs a steam turbine off a boiler over the furnace', () => {
    // A Current Age furnace at 2100 C boils at the boiler's cap, so one turbine gives its full 8 kW.
    expect(stages[3].generationW).toBeGreaterThanOrEqual(machine('steam_turbine').outputW ?? 0);
  });
});

describe('17. multiblock hearths', () => {
  it('has the structure rules of table 17.1', () => {
    expect(furnaceTier(1).structure).toBeUndefined();
    for (const [tier, [wall, minInner, maxInner, ceiling, electrodes, powerPorts, maxCrucibles, bonus]] of Object.entries(TECH_SPEC.hearths)) {
      const s = furnaceTier(Number(tier)).structure;
      expect(s, `tier ${tier}`).toBeDefined();
      if (!s) continue;
      expect([s.wall, s.minInner, s.maxInner, s.ceiling, s.electrodes ?? 0, s.powerPorts ?? 0, s.maxCrucibles, s.crucibleBonus], `tier ${tier}`)
        .toEqual([wall, minInner, maxInner, ceiling, electrodes, powerPorts, maxCrucibles, bonus]);
    }
  });

  it('turns the crucible column of 17.1 into the same counts', () => {
    const s = (t: number) => {
      const structure = furnaceTier(t).structure;
      if (!structure) throw new Error(`tier ${t} has no structure`);
      return structure;
    };
    const area = (x: number, z: number): [number, number, number] => [x, z, 1];
    for (let x = 1; x <= 5; x++) for (let z = 1; z <= 5; z++) {
      expect(hearthCrucibles(s(2), area(x, z))).toBe(Math.min(4, x * z) + 1);
      expect(hearthCrucibles(s(3), area(x, z))).toBe(Math.min(6, x * z + 1));
      expect(hearthCrucibles(s(4), area(x, z))).toBe(Math.min(8, x * z + 2));
    }
    expect(hearthCrucibles(s(5), [3, 3, 3])).toBe(9);
    expect(hearthCrucibles(s(5), [5, 5, 5])).toBe(9);
  });

  it('ranks walls by tier, a higher wall serving every lower tier', () => {
    expect(['brick', 'refractory_brick', 'plasma_casing', 'star_casing'].map(hearthWallTier)).toEqual([2, 3, 4, 5]);
    expect(hearthWallTier('stone_brick')).toBe(0);
    expect(hearthWallTier('glass')).toBe(0);
    for (const key of [...HEARTH_FACE_PARTS, ...HEARTH_CEILING_PARTS]) expect(block(key).key).toBe(key);
  });

  it('gives every shell block a glowing-seam twin for the formed state, on all six faces', () => {
    for (const key of ['brick', 'refractory_brick', 'plasma_casing', 'star_casing', 'electrode', 'item_hatch', 'fluid_hatch', 'power_port']) {
      const def = block(key);
      for (let f = 0; f < 6; f++) expect(def.layersActive[f], `${key} face ${f}`).not.toBe(def.layers[f]);
      expect(new Set(def.layersActive).size, key).toBe(1);
    }
  });

  it('shrinks the upgrade costs to those of 17.2', () => {
    const costs = FURNACE_TIERS.map((t) => t.upgradeCost.map((c) => `${c.count} ${c.item}`).join(', '));
    expect(costs).toEqual(['', '4 bronze_ingot, 1 bellows', '2 copper_coil, 2 steel_plate', '2 circuit, 2 tungsten_rod', '1 star_core, 8 deuterium_cell']);
  });

  it('prices the smallest legal shell of every tier', () => {
    const shells = [2, 3, 4, 5].map((t) => hearthMaterials(t).map((m) => `${m.count} ${m.item}`).join(', '));
    expect(shells).toEqual([
      '16 brick', // open-topped 3x3x2 around one cell, the furnace in a wall
      '24 refractory_brick, 1 electrode',
      '53 plasma_casing, 2 power_port',
      '93 star_casing, 4 power_port',
    ]);
    expect(hearthMaterials(1)).toEqual([]);
    for (const t of FURNACE_TIERS.slice(1)) {
      const s = t.structure;
      if (!s) continue;
      // The smallest interior has room for the controller and every required part in its faces.
      const faces = faceCells(s.minInner);
      expect((s.powerPorts ?? 0) + 1, t.name).toBeLessThanOrEqual(faces.walls + faces.floor);
      expect(s.electrodes ?? 0, t.name).toBeLessThanOrEqual(faces.ceiling);
      expect(smallestShell(s).inner, t.name).toEqual(s.minInner);
    }
  });

  it('makes every hearth buildable with the furnace before it, and not earlier than the age it belongs to', () => {
    for (let t = 2; t <= MAX_FURNACE_TIER; t++) {
      for (const m of hearthMaterials(t)) {
        expect(stages[t - 1].items.has(m.item), `tier ${t} needs ${m.item} at tier ${t - 1}`).toBe(true);
      }
    }
    expect(firstStage('brick')).toBe(1);
    expect(firstStage('refractory_brick')).toBe(2);
    expect(firstStage('electrode')).toBe(2);
    expect(firstStage('plasma_casing')).toBe(3);
    expect(firstStage('power_port')).toBe(3);
    expect(firstStage('star_casing')).toBe(4);
    // Hatches arrive with the Blast hearth, so pipes can feed it from the start of the Forge Age.
    expect(firstStage('item_hatch')).toBe(2);
    expect(firstStage('fluid_hatch')).toBe(2);
  });

  it('guides the player through hearths and pipes in the objectives', () => {
    const ids = OBJECTIVES.map((o) => o.id);
    expect(ids.indexOf('pipe_ore')).toBe(ids.indexOf('blast_furnace') + 1);
    expect(ids.indexOf('pump_water')).toBe(ids.indexOf('arc_furnace') + 1);
    const byId = (id: string) => OBJECTIVES.find((o) => o.id === id);
    expect(byId('pipe_ore')).toMatchObject({ title: 'Pipe it in', condition: { type: 'place', block: 'item_pipe' }, age: 1 });
    expect(byId('pump_water')).toMatchObject({ title: 'Pump water', condition: { type: 'place', block: 'pump' }, age: 2 });
    expect(byId('blast_furnace')?.text).toMatch(/Build a Blast hearth/);
    expect(byId('arc_furnace')?.text).toMatch(/refractory brick/i);
    expect(byId('plasma_furnace')?.text).toMatch(/Power Port/);
    expect(byId('starhearth')?.text).toMatch(/star casing/i);
  });

  it('gives hearth hatches and ports no power of their own except the port', () => {
    const parts = [...MACHINES.values()].filter((m) => m.role === 'hearth_part').map((m) => m.kind).sort();
    expect(parts).toEqual(['fluid_hatch', 'item_hatch', 'power_port']);
    expect(BLOCKS.filter((b) => b.machine && machine(b.machine).role === 'hearth_part' && b.power === 'device').map((b) => b.key)).toEqual(['power_port']);
  });
});
