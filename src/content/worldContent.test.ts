/** Spec sections 13-15: buckets and lava, the richer world (marsh, berries, ruins and their loot), and the weather data. */
import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, NIGHT_LIGHT_FULL_MOON, NIGHT_LIGHT_NEW_MOON } from '../core/constants';
import { mulberry32 } from '../core/math';
import {
  BLOCKS, CREATURES, ITEMS, LOOT_TABLES, MACHINES, MAX_FURNACE_TIER, OBJECTIVES, ORE_VEINS, block, fuelOf, item, lootTable, lootTableItems, machine,
  recipesFor, rollLoot,
} from '../core/registry';
import { ALL_BIOMES, type LootTableSpec } from '../core/types';
import { BIOME_ONLY_BLOCKS, NATURAL_BLOCKS, RUIN_SALVAGE_BLOCKS, conditionMet, solve } from './progression';
import { WORLD_SPEC } from './specRosterWorld';

const stages = Array.from({ length: MAX_FURNACE_TIER + 1 }, (_, t) => solve(t));
const full = stages[MAX_FURNACE_TIER];
const firstStage = (key: string): number => stages.findIndex((p) => p.items.has(key));

describe('13. buckets', () => {
  it('calls the pail a bucket everywhere a player can read it, keeping the keys', () => {
    for (const [key, name] of Object.entries(WORLD_SPEC.names)) expect(item(key).name, key).toBe(name);
    for (const thing of [...ITEMS, ...BLOCKS]) expect(`${thing.name} ${thing.desc}`, thing.key).not.toMatch(/\bpails?\b/i);
    for (const o of OBJECTIVES) expect(`${o.title} ${o.text}`, o.id).not.toMatch(/\bpails?\b/i);
    // Spec 18.3: a bucket takes a source block; flowing water is not a spring.
    expect(item('pail').desc).toMatch(/source block/);
    expect(item('pail').desc).not.toMatch(/endless spring/);
    expect(item('water_pail').desc).toMatch(/bucket back/);
  });

  it('forges a bronze bucket at 700 C from 3 bronze ingots', () => {
    const [r] = recipesFor('bronze_bucket');
    expect(r).toMatchObject({ station: 'furnace', kind: 'forge', minTempC: 700, minTier: 1, inputs: [{ item: 'bronze_ingot', count: 3 }] });
    expect(item('bronze_bucket').stack).toBe(1);
  });

  it('burns a lava bucket at 1300 C for 100 s (2 MJ) and hands the bronze bucket back', () => {
    expect(fuelOf('lava_bucket')).toEqual({ energyJ: 2_000_000, burnS: 100, flameTempC: 1300, fuelReturns: 'bronze_bucket' });
    expect(item('lava_bucket').stack).toBe(1);
    // Only containers return anything; the burner generator takes it too and hands the empty bucket to the player.
    expect(ITEMS.filter((it) => it.fuel?.fuelReturns).map((it) => it.key)).toEqual(['lava_bucket', 'fuel_ethanol_beaker', 'gasoline_canister', 'kerosene_canister', 'diesel_canister']);
    expect(machine('burner_generator').fuels).toContain('lava_bucket');
    expect(machine('burner_generator').fuels).toContain('peat');
  });

  it('fills a bronze bucket with lava once bronze exists, and never without lava in the world', () => {
    expect(firstStage('bronze_bucket')).toBe(1);
    expect(firstStage('lava_bucket')).toBe(1);
    expect(stages[1].source.get('lava_bucket')).toBe('world');
    expect(solve(MAX_FURNACE_TIER, ['lava']).items.has('lava_bucket')).toBe(false);
    expect(firstStage('water_pail')).toBe(0);
  });
});

describe('14. a richer world', () => {
  it('cuts peat by hand in the marsh: the first fuel that smelts copper, before any charcoal', () => {
    expect(fuelOf('peat')).toEqual({ energyJ: 500_000, burnS: 50, flameTempC: 900 });
    expect(block('peat').tool).toBe('shovel');
    expect(stages[0].items.has('peat')).toBe(true);
    const copper = recipesFor('copper_ingot')[0];
    expect(fuelOf('oak_log')?.flameTempC ?? 0).toBeLessThan(copper.minTempC);
    expect(fuelOf('peat')?.flameTempC ?? 0).toBeGreaterThan(copper.minTempC);
    expect(fuelOf('peat')?.flameTempC ?? 0).toBeLessThan(fuelOf('charcoal')?.flameTempC ?? 0);
  });

  it('grows wildberries on bushes that regrow in 300 s, and lets the picked bush be replanted', () => {
    expect(item('wildberries').food).toEqual({ hunger: 2 });
    expect(machine('berry_bush')).toMatchObject({ role: 'bush', blocks: ['berry_bush', 'berry_bush_bare'], params: { regrowS: 300 } });
    expect(block('berry_bush').harvestLeaves).toBe('berry_bush_bare');
    expect(item('berry_bush_bare')).toMatchObject({ name: 'Berry Bush', block: 'berry_bush_bare' });
    expect(firstStage('wildberries')).toBe(0);
    expect(firstStage('berry_bush_bare')).toBe(0);
    expect(conditionMet({ type: 'flag', flag: 'ate' }, solve(0, ['wild_potato', 'wild_carrot', 'wild_wheat']))).toBe(true);
  });

  it('places every new natural block in the assumed world, and keeps ruin salvage out of it', () => {
    for (const key of WORLD_SPEC.blocks) {
      if (key === 'berry_bush_bare') continue;
      expect([...NATURAL_BLOCKS, ...RUIN_SALVAGE_BLOCKS], key).toContain(key);
    }
    for (const key of RUIN_SALVAGE_BLOCKS) expect(NATURAL_BLOCKS).not.toContain(key);
  });

  it('salvages ruins only for things of their own age, gated like the ore they hold', () => {
    for (const key of RUIN_SALVAGE_BLOCKS) for (const d of block(key).drops) expect(item(d.item).age, `${key}: ${d.item}`).toBe(0);
    expect(block('rusted_shell').minTier).toBe(block('iron_ore').minTier);
  });

  it('breaks crystal clusters into silica with the tool that mines quartz, and lights geodes softly', () => {
    expect(block('crystal_cluster').minTier).toBe(block('quartz_ore').minTier);
    expect(block('crystal_cluster').drops.map((d) => d.item)).toEqual(['silica']);
    expect(firstStage('silica')).toBe(firstStage('quartz_ore'));
    expect(block('glowcap').light).toBeGreaterThan(block('crystal_cluster').light);
  });

  it('puts crude oil in the world as a liquid no bucket can hold', () => {
    expect(block('oil')).toMatchObject({ liquid: 'oil', shape: 'liquid', itemKey: null });
    expect(full.items.has('oil')).toBe(false);
  });

  it('adds the marsh to the biomes, its ores and its animals', () => {
    expect(ALL_BIOMES).toEqual(['woodland', 'dunes', 'frostfell', 'scar', 'marsh']);
    expect(ORE_VEINS.filter((v) => v.biomes?.marsh).map((v) => v.block).sort()).toEqual(['coal_ore', 'iron_ore']);
    expect(CREATURES.filter((c) => c.biomes.includes('marsh')).map((c) => c.key)).toEqual(['hen', 'boar', 'marsh_heron']);
    expect(Object.keys(BIOME_ONLY_BLOCKS).sort()).toEqual([...ALL_BIOMES].sort());
  });

  it('can be finished from any one biome: no biome-only block is essential', () => {
    for (const biome of ALL_BIOMES) {
      const elsewhere = ALL_BIOMES.filter((b) => b !== biome).flatMap((b) => BIOME_ONLY_BLOCKS[b]);
      const p = solve(MAX_FURNACE_TIER, elsewhere);
      expect(p.tier, biome).toBe(MAX_FURNACE_TIER);
      expect(conditionMet({ type: 'flag', flag: 'ignited' }, p), biome).toBe(true);
    }
  });

  it('keeps world-only plants item-less and gives the decorative ones an item to replant', () => {
    for (const key of ['ember_poppy', 'skybell', 'frost_lily', 'glowcap', 'cactus']) {
      expect(block(key).itemKey, key).toBe(key);
      expect(block(key).placeOn, key).not.toBeNull();
    }
    for (const key of ['fern', 'reeds', 'berry_bush', 'ice_spike', 'steam_vent', 'collapsed_furnace', 'rusted_shell', 'crystal_cluster']) {
      expect(block(key).itemKey, key).toBeNull();
    }
  });
});

describe('14. Old Works loot', () => {
  const sampled = (table: LootTableSpec, n: number) => {
    const random = mulberry32(1234);
    return Array.from({ length: n }, () => rollLoot(table, random));
  };

  it('has a near and a deep table that never reach past their age', () => {
    expect(LOOT_TABLES.map((t) => t.tier).sort()).toEqual(['deep', 'near']);
    for (const t of LOOT_TABLES) {
      // Nested tables and guaranteed entries count too.
      for (const key of lootTableItems(t)) expect(item(key).age, `${t.tier}: ${key}`).toBeLessThanOrEqual(WORLD_SPEC.lootMaxAge[t.tier]);
    }
    // The spec's examples: buckets and flint tools near, iron, a thermopile and cable deep.
    const near = lootTable('near').entries.map((e) => e.item);
    const deep = lootTable('deep').entries.map((e) => e.item);
    for (const key of ['rubble', 'clay', 'copper_ore', 'tin_ore', 'coal', 'wheat_seeds', 'pail', 'flint_pickaxe']) expect(near).toContain(key);
    for (const key of ['iron_ingot', 'thermopile', 'copper_cable']) expect(deep).toContain(key);
  });

  it('rolls deterministically, within the roll count, in stacks that fit, tools at full durability', () => {
    for (const t of LOOT_TABLES) {
      expect(sampled(t, 20)).toEqual(sampled(t, 20));
      for (const loot of sampled(t, 300)) {
        const total = loot.reduce((n, s) => n + s.count, 0);
        expect(total).toBeGreaterThanOrEqual(t.rolls[0]);
        expect(loot.length).toBeLessThanOrEqual(CRATE_SIZE);
        for (const s of loot) {
          expect(s.count, s.item).toBeGreaterThan(0);
          expect(s.count, s.item).toBeLessThanOrEqual(item(s.item).stack);
          expect(s.durability, s.item).toBe(item(s.item).tool?.durability);
        }
      }
    }
  });

  it('draws entries in proportion to their weights', () => {
    const t = lootTable('near');
    const hits = new Map<string, number>();
    let draws = 0;
    const random = mulberry32(99);
    for (let i = 0; i < 4000; i++) {
      // One draw at a time, so each stack is one entry.
      for (const s of rollLoot({ ...t, rolls: [1, 1] }, random)) hits.set(s.item, (hits.get(s.item) ?? 0) + 1);
      draws++;
    }
    const weight = t.entries.reduce((n, e) => n + e.weight, 0);
    for (const e of t.entries) expect((hits.get(e.item) ?? 0) / draws, e.item).toBeCloseTo(e.weight / weight, 1);
  });
});

describe('15. weather and the moon, as content sees them', () => {
  it('keeps moonlight below what wakes a solar panel, and daylight crops need far more', () => {
    const minSun = machine('solar_panel').params?.minSunlight ?? 0;
    expect(minSun).toBeGreaterThan(NIGHT_LIGHT_FULL_MOON);
    expect(machine('crop').params?.minSunlight ?? 0).toBeGreaterThan(NIGHT_LIGHT_FULL_MOON);
    expect(NIGHT_LIGHT_NEW_MOON).toBeGreaterThan(0);
  });

  it('gives every machine kind a role the UI and simulation know', () => {
    for (const m of MACHINES.values()) expect(['furnace', 'generator', 'consumer', 'storage', 'crate', 'boiler', 'crop', 'bush', 'tank', 'hearth_part', 'brew', 'hand', 'chem']).toContain(m.role);
  });
});
