import { describe, expect, it } from 'vitest';
import {
  AGES, BLOCKS, FURNACE_TIERS, ITEMS, MACHINES, MAX_FURNACE_TIER, OBJECTIVES, ORE_VEINS, RECIPES, TEXTURE_NAMES,
  block, furnaceTier, item, machine, recipesAt, validateContent,
} from '../core/registry';
import type { ObjectiveCondition, RecipeDef, ToolKind } from '../core/types';
import { GRID_UNITS, KNOWN_FLAGS, NATURAL_BLOCKS, conditionMet, itemPlacing, rawCost, solve, type Progress } from './progression';
import { SPEC } from './specRoster';

const sorted = (keys: Iterable<string>): string[] => [...keys].sort();
const stationsOf = (): string[] => [...new Set(RECIPES.map((r) => r.station))];

/** Compact, order-preserving description of an objective condition, compared against the spec's list. */
function signature(c: ObjectiveCondition): string {
  switch (c.type) {
    case 'have':
    case 'make':
      return `${c.type} ${c.item} ${c.count ?? 1}`;
    case 'place':
    case 'break':
      return `${c.type} ${c.block} ${c.count ?? 1}`;
    case 'furnaceTemp':
      return `temp ${c.tempC}`;
    case 'furnaceTier':
      return `tier ${c.tier}`;
    case 'generate':
      return `generate ${c.watts}`;
    case 'stored':
      return `stored ${c.joules}`;
    case 'flag':
      return `flag ${c.flag}`;
    case 'any':
      return `any(${c.of.map(signature).join(' | ')})`;
  }
}

/** One recipe in the notation of SPEC.recipes. */
function recipeLine(r: RecipeDef): string {
  const io = `${r.id}: ${r.output.count} ${r.output.item} <- ${r.inputs.map((i) => `${i.count} ${i.item}`).join(', ')}`;
  if (r.station === 'furnace') return `${io} @${r.minTempC}${r.kind === 'smelt' ? ` ${r.timeS}s` : ''} T${r.minTier}`;
  return MACHINES.has(r.station) ? `${io} ${r.timeS}s ${r.energyJ}J` : io;
}

/** A machine number, wherever it lives: a MachineSpec field or its params record. */
function machineNumber(kind: string, name: string): number | undefined {
  const spec = machine(kind);
  const field = (spec as unknown as Record<string, unknown>)[name];
  return typeof field === 'number' ? field : spec.params?.[name];
}

// -------------------------------------------------------------------------------------------------
describe('1. registry validation', () => {
  it('finds no problems', () => {
    expect(validateContent()).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------------
describe('2. roster of spec section 2', () => {
  it('has exactly the 84 blocks (68 of section 2, 16 of section 12), air first', () => {
    expect(BLOCKS[0].key).toBe('air');
    expect(SPEC.blocks).toHaveLength(84);
    expect(sorted(BLOCKS.map((b) => b.key))).toEqual(sorted(SPEC.blocks));
  });

  it('has exactly the 79 non-block items (60 of section 2, 19 of section 12)', () => {
    expect(SPEC.items).toHaveLength(79);
    // Seeds, potatoes and carrots plant a crop block, yet they are items of their own, not block items.
    expect(sorted(ITEMS.filter((it) => it.block !== it.key).map((it) => it.key))).toEqual(sorted(SPEC.items));
  });

  it('has the tools and fuels with their numbers', () => {
    for (const [material, [tier, speed, durability]] of Object.entries(SPEC.toolSets)) {
      for (const kind of ['pickaxe', 'axe', 'shovel'] satisfies ToolKind[]) {
        expect(item(`${material}_${kind}`).tool, `${material}_${kind}`).toEqual({ kind, tier, speed, durability });
      }
    }
    expect(item('power_drill').tool).toEqual({ kind: 'pickaxe', tier: 5, speed: 10, durability: 3000, universal: true });
    const fuels = Object.fromEntries(ITEMS.filter((it) => it.fuel).map((it) => [it.key, [it.fuel?.energyJ, it.fuel?.burnS, it.fuel?.flameTempC]]));
    expect(fuels).toEqual(SPEC.fuels);
  });

  it('has every recipe at its station, with its amounts, temperature, time and tier', () => {
    expect(sorted(stationsOf())).toEqual(sorted(Object.keys(SPEC.recipes)));
    for (const [station, lines] of Object.entries(SPEC.recipes)) expect(recipesAt(station).map(recipeLine), station).toEqual(lines);
    expect(RECIPES).toHaveLength(110);
  });

  it('has the furnace tiers of table 2.4', () => {
    const rows = FURNACE_TIERS.map((t) => [
      t.tier, t.block, t.name, t.maxTempC, t.heatCapacityJ, t.lossWPerC, t.crucibles, t.fuelSlots, t.speed, t.electricHeatW, t.warmth, t.upgradeTempC,
      t.upgradeCost.map((c) => `${c.count} ${c.item}`).join(', '),
    ]);
    expect(rows).toEqual(SPEC.furnaceTiers);
    expect(FURNACE_TIERS.map((t) => t.age)).toEqual([0, 1, 2, 3, 4]);
    expect(AGES.map((a) => a.name)).toEqual(['Ember Age', 'Forge Age', 'Current Age', 'Atomic Age', 'Star Age']);
  });

  it('has every machine with the numbers of 2.5 and 3.3, and documents no other params', () => {
    expect(sorted(MACHINES.keys())).toEqual(sorted(Object.keys(SPEC.machines)));
    for (const [kind, [role, numbers]] of Object.entries(SPEC.machines)) {
      expect(machine(kind).role, kind).toBe(role);
      for (const [name, value] of Object.entries(numbers)) expect(machineNumber(kind, name), `${kind}.${name}`).toBe(value);
      for (const name of Object.keys(machine(kind).params ?? {})) expect(numbers, `${kind}.params.${name}`).toHaveProperty(name);
    }
    expect(machine('furnace').blocks).toEqual(FURNACE_TIERS.map((t) => t.block));
    expect(sorted(machine('burner_generator').fuels ?? [])).toEqual(sorted(Object.keys(SPEC.fuels)));
    expect(machine('combustion_engine').fuels).toEqual(['fuel_canister']);
    expect(machine('fission_pile').fuels).toEqual(['fuel_rod']);
  });

  it('has the ore veins of 2.6', () => {
    const rows = ORE_VEINS.map((v) => [v.block, v.minY, v.maxY, v.veinsPerChunk, v.veinSize, v.biomes ?? {}]);
    expect(rows).toEqual(SPEC.oreVeins);
  });

  it('has the objectives of 2.7 in order', () => {
    expect(OBJECTIVES.map((o) => signature(o.condition))).toEqual(SPEC.objectives);
    const flags = OBJECTIVES.map((o) => o.condition).filter((c) => c.type === 'flag');
    for (const c of flags) expect(KNOWN_FLAGS).toContain(c.flag);
  });

  it('gives blocks the properties the spec names', () => {
    for (const [key, props] of Object.entries(SPEC.blockProps)) expect(block(key), key).toMatchObject(props);
    for (const key of NATURAL_BLOCKS) expect(SPEC.blocks).toContain(key);
  });
});

// -------------------------------------------------------------------------------------------------
describe('4. structural rules', () => {
  const furnaceRecipes = recipesAt('furnace');
  const smelts = furnaceRecipes.filter((r) => r.kind === 'smelt');
  const machineStations = stationsOf().filter((s) => !['hand', 'workbench', 'furnace'].includes(s));

  it('gives smelt and machine recipes exactly one input item type, unique per station', () => {
    for (const group of [smelts, ...machineStations.map((s) => recipesAt(s))]) {
      for (const r of group) expect(r.inputs, r.id).toHaveLength(1);
      const inputs = group.map((r) => r.inputs[0].item);
      expect(new Set(inputs).size, `duplicate input among ${group.map((r) => r.id).join(', ')}`).toBe(inputs.length);
    }
  });

  it('keeps every furnace recipe within reach of its own tier', () => {
    for (const r of furnaceRecipes) {
      expect(r.minTempC, r.id).toBeGreaterThan(0);
      expect(r.minTempC, r.id).toBeLessThanOrEqual(furnaceTier(r.minTier).maxTempC);
      if (r.kind === 'smelt') expect(r.timeS, r.id).toBeGreaterThan(0);
    }
    for (const t of FURNACE_TIERS.slice(1)) expect(t.upgradeTempC, t.name).toBeLessThanOrEqual(furnaceTier(t.tier - 1).maxTempC);
  });

  it('prices machine recipes at draw x time and runs them on two-slot consumers', () => {
    for (const station of machineStations) {
      const spec = machine(station);
      expect(spec.role, station).toBe('consumer');
      expect(spec.slots, station).toBe(2);
      for (const r of recipesAt(station)) {
        expect(r.timeS, r.id).toBeGreaterThan(0);
        expect(r.energyJ, r.id).toBe((spec.drawW ?? 0) * r.timeS);
      }
    }
  });

  it('makes the furnace the main crafting place and keeps the workbench minor', () => {
    expect(furnaceRecipes.length / RECIPES.length).toBeGreaterThan(0.65);
    expect(recipesAt('workbench').length / RECIPES.length).toBeLessThan(0.1);
  });

  it('has sane fuels, monotonic tool tiers and rated cables', () => {
    for (const it of ITEMS.filter((i) => i.fuel)) {
      expect(it.fuel?.burnS, it.key).toBeGreaterThan(0);
      expect(it.fuel?.energyJ, it.key).toBeGreaterThan(0);
      expect(it.fuel?.flameTempC, it.key).toBeGreaterThan(200);
    }
    for (const kind of ['pickaxe', 'axe', 'shovel'] satisfies ToolKind[]) {
      const tools = ITEMS.filter((i) => i.tool?.kind === kind).sort((a, b) => (a.tool?.tier ?? 0) - (b.tool?.tier ?? 0));
      expect(tools.slice(0, 4).map((t) => t.tool?.tier), kind).toEqual([1, 2, 3, 4]);
      for (let i = 1; i < tools.length; i++) {
        expect(tools[i].tool?.speed, tools[i].key).toBeGreaterThan(tools[i - 1].tool?.speed ?? 0);
        expect(tools[i].tool?.durability, tools[i].key).toBeGreaterThan(tools[i - 1].tool?.durability ?? 0);
      }
    }
    const cables = BLOCKS.filter((b) => b.shape === 'cable');
    expect(cables.map((c) => [c.key, c.power, c.cableRatingW])).toEqual([
      ['copper_cable', 'cable', 10_000], ['heavy_cable', 'cable', 120_000], ['super_cable', 'cable', 2_000_000],
    ]);
    expect(BLOCKS.filter((b) => b.power === 'cable')).toEqual(cables);
  });

  it('ties every machine block to a machine spec and back', () => {
    for (const def of BLOCKS.filter((b) => b.machine)) {
      const spec = MACHINES.get(def.machine ?? '');
      expect(spec?.blocks, def.key).toContain(def.key);
      if (spec?.role === 'crop') {
        // A crop is a plant, not a device: it drops its harvest and never joins a power network.
        expect(def.power, def.key).toBeNull();
        expect(def.itemKey, def.key).toBeNull();
        expect(def.placeOn, def.key).toEqual(['farmland']);
        continue;
      }
      expect(def.drops, `${def.key} must drop itself`).toEqual([{ item: def.key, count: 1 }]);
      expect(def.minTier, def.key).toBe(0);
      expect(def.power, def.key).toBe(def.machine === 'crate' ? null : 'device');
    }
    for (const spec of MACHINES.values()) {
      expect(spec.blocks.length, spec.kind).toBeGreaterThan(0);
      expect(spec.desc.length, spec.kind).toBeGreaterThan(20);
      if (spec.role === 'generator') expect(spec.outputW, spec.kind).toBeGreaterThan(0);
      if (spec.role === 'consumer') expect(spec.drawW, spec.kind).toBeGreaterThan(0);
      if (spec.role === 'storage') expect((spec.capacityJ ?? 0) * (spec.rateW ?? 0), spec.kind).toBeGreaterThan(0);
    }
    for (const t of FURNACE_TIERS) {
      expect(block(t.block).warmthActive, t.block).toBe(t.warmth);
      expect(block(t.block).name, t.block).toBe(t.name);
    }
    expect(block('space_heater').warmthActive).toBe(machine('space_heater').params?.warmRadius);
  });

  it('writes a short description for everything a player can see', () => {
    const named = [...BLOCKS.filter((b) => b.key !== 'air'), ...ITEMS];
    for (const thing of named) {
      expect(thing.desc.length, `${thing.key}: description length`).toBeGreaterThan(15);
      expect(thing.desc.length, `${thing.key}: description length`).toBeLessThanOrEqual(170);
      expect(thing.desc, thing.key).toMatch(/[.!]$/);
    }
    const names = ITEMS.map((it) => it.name);
    expect(new Set(names).size).toBe(names.length);
    for (const o of OBJECTIVES) {
      expect(o.title.length, o.id).toBeLessThanOrEqual(28);
      expect(o.text.length, o.id).toBeGreaterThan(20);
    }
  });

  it('names textures in snake_case and keeps their number paintable', () => {
    for (const name of TEXTURE_NAMES) expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    expect(new Set(TEXTURE_NAMES).size).toBe(TEXTURE_NAMES.length);
    expect(TEXTURE_NAMES.length).toBeLessThanOrEqual(SPEC.maxTextures);
  });
});

// -------------------------------------------------------------------------------------------------
describe('3. progression solver', () => {
  /** stages[t] = everything possible while the best furnace is tier t (0 = none yet). */
  const stages: Progress[] = Array.from({ length: MAX_FURNACE_TIER + 1 }, (_, t) => solve(t));
  const full = stages[MAX_FURNACE_TIER];
  const ageOf = (stage: number): number => Math.max(0, stage - 1);
  const firstStage = (has: (p: Progress) => boolean): number => stages.findIndex(has);

  it('climbs every furnace tier, one at a time', () => {
    expect(stages.map((p) => p.tier)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(full.tempC[MAX_FURNACE_TIER]).toBe(furnaceTier(MAX_FURNACE_TIER).maxTempC);
  });

  it('can obtain every item except the blocks that only exist in the world', () => {
    const missing = ITEMS.filter((it) => !full.items.has(it.key)).map((it) => it.key);
    expect(sorted(missing)).toEqual(sorted(SPEC.worldOnlyItems));
  });

  it('can use every recipe', () => {
    expect(RECIPES.filter((r) => !full.recipes.has(r.id)).map((r) => r.id)).toEqual([]);
  });

  it('can satisfy every objective, in the listed order, without ever needing a furnace not yet asked for', () => {
    /** Items an objective names outright, and everything it consumes (an upgrade consumes its cost). */
    const asks = (c: ObjectiveCondition): string[] => {
      if (c.type === 'make' || c.type === 'have') return [c.item];
      return c.type === 'place' ? [itemPlacing(c.block) ?? ''] : [];
    };
    const consumes = (c: ObjectiveCondition): string[] =>
      c.type === 'furnaceTier' ? furnaceTier(c.tier).upgradeCost.map((u) => u.item) : asks(c);
    const asked = new Set<string>();
    const neededBy = new Map<string, string>();
    let stage = 0;
    for (const o of OBJECTIVES) {
      const c = o.condition;
      const builds = c.type === 'furnaceTier' ? c.tier : c.type === 'place' && c.block === furnaceTier(1).block ? 1 : 0;
      if (builds > 0) {
        expect(stage, `${o.id}: an earlier objective already needed furnace tier ${builds}`).toBe(builds - 1);
        expect(stages[builds].tier, `${o.id}: tier ${builds} cannot be built from tier ${builds - 1}`).toBe(builds);
      }
      if (c.type !== 'furnaceTier') expect(conditionMet(c, stages[stage]), `${o.id} is out of reach with furnace tier ${stage}`).toBe(true);
      expect(o.age, `${o.id}: age`).toBe(ageOf(stage));
      for (const gift of o.reward ?? []) expect(stages[stage].items.has(gift.item), `${o.id}: reward ${gift.item} skips ahead`).toBe(true);

      // Within a tier: an objective never names something an earlier objective already had to be made from.
      for (const key of asks(c)) if (!asked.has(key)) expect(neededBy.get(key), `${o.id} names ${key} only after it was needed`).toBeUndefined();
      const used = consumes(c);
      rawCost(full, used.map((key) => ({ item: key, count: 1 })), (key) => {
        if (!used.includes(key) && !neededBy.has(key)) neededBy.set(key, o.id);
      });
      for (const key of asks(c)) asked.add(key);
      stage = Math.max(stage, builds);
    }
    expect(stage).toBe(MAX_FURNACE_TIER);
    expect(conditionMet({ type: 'flag', flag: 'bellows_pumped' }, stages[1])).toBe(true);
    expect(conditionMet({ type: 'flag', flag: 'rested' }, stages[1])).toBe(true);
  });

  it('agrees with the declared ages of items and recipes', () => {
    for (const it of ITEMS) {
      const stage = firstStage((p) => p.items.has(it.key));
      if (stage >= 0) expect(it.age, `item ${it.key}`).toBe(ageOf(stage));
    }
    for (const r of RECIPES) expect(r.age, `recipe ${r.id}`).toBe(ageOf(firstStage((p) => p.recipes.has(r.id))));
  });

  it('does not depend on lava, loose rubble or biome-flavoured blocks', () => {
    const lean = solve(MAX_FURNACE_TIER, SPEC.optionalWorldBlocks);
    expect(lean.tier).toBe(MAX_FURNACE_TIER);
    expect(RECIPES.filter((r) => !lean.recipes.has(r.id)).map((r) => r.id)).toEqual([]);
    expect(conditionMet({ type: 'flag', flag: 'ignited' }, lean)).toBe(true);
  });

  it('gates the right things behind tools, heat and cable', () => {
    expect(stages[0].items.has('iron_ore')).toBe(false); // needs bronze
    expect(stages[1].items.has('iron_ore')).toBe(true);
    expect(stages[1].tempC[1]).toBe(800);
    expect(stages[2].tempC[2]).toBe(1500);
    expect(stages[2].items.has('wolframite')).toBe(true); // steel pickaxe
    expect(stages[3].items.has('pitchblende')).toBe(false); // power drill only
    expect(stages[3].tempC[3]).toBe(2100); // electric: no fuel passes 1800 C
    expect(stages[2].cableRatingW).toBe(10_000);
    expect(stages[3].cableRatingW).toBe(120_000); // heavy cable exists before the Plasma Furnace needs its 40 kW
    expect(stages[4].tempC[4]).toBe(3200);
    expect(stages[4].cableRatingW).toBe(2_000_000);
    expect(conditionMet({ type: 'flag', flag: 'ignited' }, stages[4])).toBe(false);
  });
});

// -------------------------------------------------------------------------------------------------
describe('5. summary', () => {
  it('prints counts and the raw-resource budget of every furnace tier', () => {
    const full = solve(MAX_FURNACE_TIER);
    const lines: string[] = [];
    const blockItems = ITEMS.filter((it) => it.block === it.key).length;
    lines.push(`blocks ${BLOCKS.length} | items ${ITEMS.length} (${blockItems} block items + ${ITEMS.length - blockItems} others) | machines ${MACHINES.size} | objectives ${OBJECTIVES.length}`);
    const perStation = stationsOf().map((s) => `${s} ${recipesAt(s).length}`).join(', ');
    const furnaceShare = Math.round((100 * recipesAt('furnace').length) / RECIPES.length);
    lines.push(`recipes ${RECIPES.length}: ${perStation} (furnace share ${furnaceShare}%)`);
    const icons = TEXTURE_NAMES.filter((n) => n.startsWith('item_')).length;
    lines.push(`textures ${TEXTURE_NAMES.length}: ${TEXTURE_NAMES.length - icons - 1} block faces + ${icons} item icons + 1 missing`);
    lines.push(`raw budget per furnace tier (grid assumed: ${GRID_UNITS} units of a kind):`);
    for (const t of FURNACE_TIERS) {
      const cost = t.tier === 1 ? [{ item: t.block, count: 1 }] : t.upgradeCost;
      const raw = [...rawCost(full, cost)].sort((a, b) => b[1] - a[1]).map(([key, n]) => `${Math.ceil(n - 1e-9)} ${key}`);
      lines.push(`  ${t.tier} ${t.name} (${full.tempC[t.tier]} C reachable): ${raw.join(', ')}`);
    }
    console.log(`\n${lines.join('\n')}\n`);
    expect(lines.length).toBe(4 + FURNACE_TIERS.length);
  });
});
