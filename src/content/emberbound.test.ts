import { describe, expect, it } from 'vitest';
import { expectContains, expectPinned, expectSubsequence } from './rosterCheck';
import {
  FLAG_PEACEFUL, HOSTILE_CAP, HOSTILE_DAMAGE_MULT, HOSTILE_SPAWN_LIGHT, WARD_BEACON_RADIUS,
} from '../core/constants';
import { pickAutomaton, spawnPlacesAt, type SkyFacts } from '../core/hostile';
import {
  AUTOMATONS, BLOCKS, CREATURES, ITEMS, MAX_FURNACE_TIER, OBJECTIVES, RECIPES, block, creature, item, machine, recipe,
} from '../core/registry';
import type { CreatureSpec, ObjectiveCondition, SpawnPlace } from '../core/types';
import { AUTOMATON_RELICS, conditionMet, solve } from './progression';
import { EMBER_SPEC } from './specRosterEmber';

const keys = (list: readonly { key: string }[]): string[] => list.map((c) => c.key);
const top = (c: CreatureSpec): number => Math.max(...c.model.map((p) => p.to[1]));
const extent = (c: CreatureSpec, axis: 0 | 2): number =>
  Math.max(...c.model.map((p) => p.to[axis])) - Math.min(...c.model.map((p) => p.from[axis]));
const anims = (c: CreatureSpec): Set<string> => new Set(c.model.map((p) => p.anim));

describe('the six automatons of table 19.1', () => {
  it('are listed apart from the animals, all hostile, and found by key', () => {
    expectContains(keys(AUTOMATONS), Object.keys(EMBER_SPEC.automatons), 'automatons');
    expect(CREATURES.some((c) => c.hostile)).toBe(false);
    for (const c of AUTOMATONS) {
      expect(c.hostile, c.key).toBeDefined();
      expect(creature(c.key)).toBe(c);
      expect(c.likes, c.key).toEqual([]);
    }
  });

  it('have the numbers and drops of the spec', () => {
    for (const [key, row] of Object.entries(EMBER_SPEC.automatons)) {
      const c = creature(key);
      const h = c.hostile;
      expect([c.name, c.health, c.speed, h?.attack, h?.damage], key).toEqual([row.name, row.health, row.speed, row.attack, row.damage]);
      if (row.windupS !== undefined) expect(h?.windupS, `${key} windup`).toBe(row.windupS);
      if (row.cooldownS !== undefined) expect(h?.cooldownS, `${key} period`).toBe(row.cooldownS);
      if (row.range !== undefined) expect(h?.range, `${key} range`).toBe(row.range);
      expect(c.drops, key).toEqual(row.drops);
      expect(h?.senseRange, key).toBe(16);
    }
    const h = (key: string) => creature(key).hostile;
    expect(h('forge_warden')?.shieldFront).toBe(0.5);
    expect(h('kiln_sentry')?.burn).toEqual({ seconds: 2, perS: 1 });
    expect(h('kiln_sentry')?.stationary).toBe(true);
    expect(h('arc_drone')?.flying).toBe(true);
    expect(h('arc_drone')?.wetMult).toBe(2);
    expect(h('bellows_hound')?.knockback).toBeGreaterThan(0);
    expect(h('slag_colossus')?.knockback).toBeGreaterThan(0);
    expect(creature('cinder_mite').group).toEqual([2, 4]);
    expect(creature('bellows_hound').group).toEqual([1, 2]);
  });

  it('telegraph every attack long enough to step out of it on a phone', () => {
    for (const c of AUTOMATONS) {
      const h = c.hostile;
      expect(h?.windupS, c.key).toBeGreaterThanOrEqual(0.3);
      expect(h?.cooldownS, c.key).toBeGreaterThan(h?.windupS ?? Infinity);
      // Something on the model flares: the ember parts.
      expect(c.model.some((p) => p.emissive), c.key).toBe(true);
    }
    // The heavier the blow, the longer the warning.
    const byDamage = [...AUTOMATONS].sort((a, b) => (a.hostile?.damage ?? 0) - (b.hostile?.damage ?? 0));
    expect(byDamage[0].key).toBe('cinder_mite');
    expect(byDamage[byDamage.length - 1].key).toBe('slag_colossus');
    expect(creature('slag_colossus').hostile?.windupS).toBe(Math.max(...AUTOMATONS.map((c) => c.hostile?.windupS ?? 0)));
  });

  it('have silhouettes that read at a glance', () => {
    for (const c of AUTOMATONS) {
      const halfWidth = Math.max(...c.model.map((p) => Math.max(-p.from[0], p.to[0])));
      expect(halfWidth * 2, c.key).toBeLessThanOrEqual(c.size.w * 16 * 1.05);
    }
    const mite = creature('cinder_mite');
    expect(['legFL', 'legFR', 'legML', 'legMR', 'legBL', 'legBR'].every((a) => anims(mite).has(a))).toBe(true);
    expect(top(mite)).toBeLessThan(extent(mite, 0)); // low: wider than tall
    expect(mite.model.find((p) => p.name === 'vent')?.emissive).toBe(true);
    const warden = creature('forge_warden');
    expect(anims(warden).has('armL') && anims(warden).has('armR')).toBe(true);
    expect(top(warden)).toBeGreaterThan(2 * extent(warden, 0)); // upright
    expect(warden.model.find((p) => p.name === 'shield')?.anim).toBe('armL');
    expect(warden.model.find((p) => p.name === 'hammer')?.anim).toBe('armR');
    expect(warden.model.find((p) => p.name === 'visor')?.emissive).toBe(true);
    const sentry = creature('kiln_sentry');
    expect(sentry.model.filter((p) => p.name.startsWith('leg') && p.anim === 'none')).toHaveLength(3); // a tripod
    expect(sentry.model.find((p) => p.name === 'mouth')?.emissive).toBe(true);
    const hound = creature('bellows_hound');
    expect(extent(hound, 2)).toBeGreaterThan(2 * extent(hound, 0)); // long and low
    expect(hound.model.filter((p) => p.name.startsWith('rib'))).toHaveLength(5);
    expect(hound.model.find((p) => p.name === 'bellows')?.emissive).toBe(true);
    const drone = creature('arc_drone');
    expect([...anims(drone)].some((a) => a.startsWith('leg'))).toBe(false);
    expect(drone.model.find((p) => p.name === 'spark')?.emissive).toBe(true);
    const colossus = creature('slag_colossus');
    expect(anims(colossus).has('armL') && anims(colossus).has('armR')).toBe(true);
    expect(colossus.model.find((p) => p.name === 'core')?.emissive).toBe(true);
    expect(top(colossus)).toBe(Math.max(...AUTOMATONS.map(top))); // the biggest by far
  });
});

describe('where they live (spec 19.3)', () => {
  const calm: SkyFacts = { storm: false, moonPhase: 4 };
  const dark: SkyFacts = { storm: false, moonPhase: 0 };
  /** Every type that can come out of a spot, over many draws. */
  const types = (places: SpawnPlace[], sky: SkyFacts, loaded = 0): string[] => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pick = pickAutomaton(places, sky, () => loaded, () => (i + 0.5) / 200);
      if (pick) seen.add(pick.key);
    }
    return [...seen].sort();
  };

  it('puts each type where the spec says', () => {
    const cave = spawnPlacesAt({ skyOpen: false, y: 30, night: false, biome: 'woodland' });
    expect(types(cave, calm)).toEqual(['cinder_mite']);
    const deep = spawnPlacesAt({ skyOpen: false, y: 12, night: false, biome: 'woodland' });
    expect(types(deep, calm)).toEqual(['cinder_mite', 'slag_colossus']);
    const night = spawnPlacesAt({ skyOpen: true, y: 40, night: true, biome: 'woodland' });
    expect(types(night, calm)).toEqual(['barkwright', 'bellows_hound', 'cinder_mite', 'forge_warden']);
    const scarCaveByDay = spawnPlacesAt({ skyOpen: false, y: 30, night: false, biome: 'scar' });
    expect(types(scarCaveByDay, calm)).toEqual(['bellows_hound', 'cinder_mite']);
    const scarNight = spawnPlacesAt({ skyOpen: true, y: 40, night: true, biome: 'scar' });
    expect(types(scarNight, calm)).toEqual(['bellows_hound', 'cinder_mite', 'forge_warden', 'magma_crawler', 'slag_colossus']);
  });

  it('flies drones over high ground only in storms and on moonless nights', () => {
    const peak = spawnPlacesAt({ skyOpen: true, y: 60, night: true, biome: 'frostfell' });
    expect(types(peak, calm)).not.toContain('arc_drone');
    expect(types(peak, dark)).toContain('arc_drone');
    expect(types(peak, { storm: true, moonPhase: 4 })).toContain('arc_drone');
    const lowland = spawnPlacesAt({ skyOpen: true, y: 40, night: true, biome: 'frostfell' });
    expect(types(lowland, dark)).not.toContain('arc_drone');
  });

  it('keeps sentries and wardens on the ruins, and one colossus at a time', () => {
    expect(creature('kiln_sentry').hostile?.habitat).toEqual({ places: {}, ruin: 'turret' });
    expect(creature('forge_warden').hostile?.habitat.ruin).toBe('guard');
    expect(creature('slag_colossus').hostile?.habitat.maxLoaded).toBe(1);
    const deep = spawnPlacesAt({ skyOpen: false, y: 12, night: true, biome: 'scar' });
    expect(types(deep, calm, 1)).not.toContain('slag_colossus');
  });

  it('scales with difficulty as 19.3 says', () => {
    expect(HOSTILE_CAP).toEqual({ peaceful: 0, normal: 10, hard: 15 });
    expect(HOSTILE_DAMAGE_MULT.hard).toBe(1.25);
    expect(HOSTILE_DAMAGE_MULT.normal).toBe(1);
  });
});

describe('fighting back (spec 19.4)', () => {
  it('forges mauls that hit hard and dig nothing', () => {
    for (const [key, [damage, stunS]] of Object.entries(EMBER_SPEC.weapons)) {
      const it = item(key);
      expect(it.weapon?.damage, key).toBe(damage);
      expect(it.weapon?.stunS ?? 0, key).toBe(stunS);
      expect(it.tool?.kind, key).toBe('maul');
      expect(it.tool?.speed, key).toBe(1);
      expect(it.stack, key).toBe(1);
    }
    // No block is a maul's to break, so a maul mines like bare hands.
    expect(BLOCKS.filter((b) => b.tool === 'maul')).toEqual([]);
    const mauls = Object.keys(EMBER_SPEC.weapons).map(item);
    for (let i = 1; i < mauls.length; i++) expect(mauls[i].tool?.durability).toBeGreaterThan(mauls[i - 1].tool?.durability ?? 0);
  });

  it('makes armour worn from the pack', () => {
    for (const [key, [reduction, warmth]] of Object.entries(EMBER_SPEC.armour)) {
      expect(item(key).armour, key).toEqual({ reduction, warmthDrainMult: warmth });
    }
    expectContains(ITEMS.filter((it) => it.armour).map((it) => it.key), Object.keys(EMBER_SPEC.armour), 'armour');
  });

  it('burns ember cores hotter than any early fuel and smelts scrap into iron', () => {
    const fuels = ITEMS.filter((it) => it.fuel && it.key !== 'ember_core').map((it) => it.fuel?.flameTempC ?? 0);
    expect(item('ember_core').fuel?.flameTempC).toBeGreaterThan(Math.max(...fuels));
    expect(machine('burner_generator').fuels).toContain('ember_core');
    const scrap = recipe('iron_ingot_scrap');
    expect([scrap?.kind, scrap?.inputs, scrap?.output, scrap?.minTempC, scrap?.minTier]).toEqual(['smelt', [{ item: 'scrap_metal', count: 1 }], { item: 'iron_ingot', count: 1 }, 1150, 3]);
  });

  it('builds a ward beacon whose light also keeps spawns off it', () => {
    expect(machine('ward_beacon').params?.radius).toBe(WARD_BEACON_RADIUS);
    expect(block('ward_beacon').lightActive).toBeGreaterThanOrEqual(HOSTILE_SPAWN_LIGHT);
    expect(block('ward_beacon').light).toBe(0);
  });

  it('places the new objectives where 19.4 says', () => {
    const at = (id: string): number => OBJECTIVES.findIndex((o) => o.id === id);
    expect(at('forge_maul')).toBeGreaterThan(at('make_bronze'));
    expect(at('salvage_automaton')).toBe(at('bronze_pickaxe') + 1);
    expect(at('ward_base')).toBeGreaterThan(at('arc_furnace'));
    expect(at('ward_base')).toBeLessThan(at('plasma_furnace'));
    const peacefulDone = (c: ObjectiveCondition): boolean => c.type === 'any' && c.of.some((o) => o.type === 'flag' && o.flag === FLAG_PEACEFUL);
    expect(OBJECTIVES.filter((o) => peacefulDone(o.condition)).map((o) => o.id)).toEqual(['salvage_automaton', 'ward_base']);
  });
});

describe('progression with and without automatons', () => {
  it('hands out scrap and ember cores from the first night on Normal, never the relics', () => {
    const start = solve(0);
    expect(start.items.has('scrap_metal')).toBe(true);
    expect(start.items.has('ember_core')).toBe(true);
    expect(start.source.get('scrap_metal')).toMatch(/^automaton:/);
    expectContains(AUTOMATON_RELICS, EMBER_SPEC.relics, 'relics');
    for (const relic of AUTOMATON_RELICS) {
      expect(start.items.has(relic), relic).toBe(false);
      expect(item(relic).age, relic).toBeGreaterThan(0);
    }
  });

  it('can be finished on Peaceful, where only the relic machines are out of reach', () => {
    const stages = Array.from({ length: MAX_FURNACE_TIER + 1 }, (_, t) => solve(t, [], { peaceful: true }));
    const full = stages[MAX_FURNACE_TIER];
    expect(full.tier).toBe(MAX_FURNACE_TIER);
    expect(RECIPES.filter((r) => !full.recipes.has(r.id)).map((r) => r.id).sort()).toEqual(['arc_maul', 'iron_ingot_scrap', 'ward_beacon']);
    let stage = 0;
    for (const o of OBJECTIVES) {
      const c = o.condition;
      if (c.type === 'furnaceTier') stage = c.tier;
      else expect(conditionMet(c, stages[stage]), o.id).toBe(true);
      if (c.type === 'place' && c.block === 'furnace_clay') stage = 1;
    }
    expect(conditionMet({ type: 'flag', flag: 'ignited' }, full)).toBe(true);
  });
});
