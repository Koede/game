import { describe, expect, it } from 'vitest';
import { mulberry32 } from './math';
import { canEnchant, enchantDef } from './enchant';
import { LOOT_TABLES, STRUCTURE_LOOT, item, lootTable, lootTableById, lootTableItems, rollLoot, validateLootTables } from './registry';
import type { LootTableSpec } from './types';

/** Frozen outputs of the pre-v2 `rollLoot`: tables without rarity, nesting or guaranteed entries must roll exactly the same forever. */
describe('rollLoot regression (old tables, fixed seeds)', () => {
  const seeds = [1, 7, 12345, 987654321];
  const keys = ['standing_circle', 'lumber_mill', 'chem_lab', 'old_factory', 'frozen_foundry'];
  it('rolls the same stacks for the same seeds', () => {
    const out: Record<string, unknown> = {};
    for (const t of LOOT_TABLES) for (const s of seeds) out[`${t.tier}:${s}`] = rollLoot(t, mulberry32(s));
    for (const k of keys) for (const s of seeds) out[`${k}:${s}`] = rollLoot(STRUCTURE_LOOT[k], mulberry32(s));
    expect(out).toMatchSnapshot();
  });
  it('is stable across runs', () => {
    expect(rollLoot(LOOT_TABLES[1], mulberry32(5))).toEqual(rollLoot(LOOT_TABLES[1], mulberry32(5)));
  });
});

describe('rollLoot v2', () => {
  const t = (over: Partial<LootTableSpec>): LootTableSpec => ({ tier: 'near', rolls: [1, 1], entries: [{ item: 'coal', count: 1, weight: 1 }], ...over });

  it('gives guaranteed entries first, once each', () => {
    const out = rollLoot(t({ guaranteed: [{ item: 'torch', count: 2, weight: 1 }, { item: 'flint', count: 1, weight: 1 }] }), mulberry32(1));
    expect(out.map((s) => s.item).slice(0, 2)).toEqual(['torch', 'flint']);
    expect(out[0].count).toBe(2);
  });

  it('rolls a nested table by id, in place', () => {
    const out = rollLoot(t({ entries: [{ item: '', count: 1, weight: 1, table: 'tavern_closet' }] }), mulberry32(2));
    expect(out.some((s) => s.item === 'scroll_margin')).toBe(true);
  });

  it('luck 0 changes nothing; luck leans toward rarer entries', () => {
    const table = t({ entries: [{ item: 'coal', count: 1, weight: 10 }, { item: 'flint', count: 1, weight: 1, rarity: 'rare' }] });
    const share = (luck: number): number => {
      const r = mulberry32(5);
      let n = 0;
      for (let i = 0; i < 4000; i++) if (rollLoot(table, r, { luck })[0].item === 'flint') n++;
      return n / 4000;
    };
    for (const s of [3, 9]) expect(rollLoot(table, mulberry32(s), { luck: 0 })).toEqual(rollLoot(table, mulberry32(s)));
    expect(share(0)).toBeCloseTo(1 / 11, 1);
    expect(share(4)).toBeGreaterThan(share(0) * 3);
  });

  it('looks tables up by id and keeps the old lookups', () => {
    expect(lootTableById('tavern_vault').id).toBe('tavern_vault');
    expect(lootTableById('ruin_near')).toBe(lootTable('near'));
    expect(lootTableById('lumber_mill')).toBe(STRUCTURE_LOOT.lumber_mill);
    expect(() => lootTableById('nope')).toThrow();
  });

  it('rejects unknown ids, cycles and nesting deeper than the limit', () => {
    const known = (k: string): boolean => k === 'coal';
    const leaf = t({ id: 'leaf' });
    const ref = (id: string, table: string): LootTableSpec => t({ id, entries: [{ item: '', count: 1, weight: 1, table }] });
    const map = (...ts: LootTableSpec[]): Map<string, LootTableSpec> => new Map(ts.map((x) => [x.id!, x]));
    expect(validateLootTables(known, map(leaf, ref('a', 'leaf')))).toEqual([]);
    expect(validateLootTables(known, map(ref('a', 'missing'))).join()).toMatch(/does not exist/);
    expect(validateLootTables(known, map(ref('a', 'b'), ref('b', 'a'))).join()).toMatch(/cycle/);
    // a > b > c > leaf nests three deep (fine); one more level is too deep.
    expect(validateLootTables(known, map(ref('a', 'b'), ref('b', 'c'), ref('c', 'leaf'), leaf))).toEqual([]);
    expect(validateLootTables(known, map(ref('a', 'b'), ref('b', 'c'), ref('c', 'd'), ref('d', 'leaf'), leaf)).join()).toMatch(/deeper/);
  });

  it('keeps the named tables inside one age ahead of Ember, nested and guaranteed entries included', () => {
    for (const id of ['tavern_closet', 'tavern_vault']) {
      for (const key of lootTableItems(lootTableById(id))) expect(item(key).age, `${id}: ${key}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('enchanted loot entries', () => {
  it('only name real enchants the item can take, and quality only on tools', () => {
    const tables = [...LOOT_TABLES, ...Object.values(STRUCTURE_LOOT), lootTableById('cave_boss'), lootTableById('tavern_closet'), lootTableById('tavern_vault')];
    let found = 0;
    for (const tb of tables) {
      for (const en of [...(tb.guaranteed ?? []), ...tb.entries]) {
        if (!en.enchants && !en.quality) continue;
        found++;
        const def = item(en.item);
        if (en.quality) expect(def.tool, `${en.item} quality`).toBeTruthy();
        for (const [k, lv] of Object.entries(en.enchants ?? {})) {
          expect(canEnchant(def, k), `${en.item} ${k}`).toBe(true);
          expect(lv).toBeGreaterThanOrEqual(1);
          expect(lv).toBeLessThanOrEqual(enchantDef(k)!.max);
        }
      }
    }
    expect(found).toBeGreaterThanOrEqual(5);
  });
});
