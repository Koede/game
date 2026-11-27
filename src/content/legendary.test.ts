import { describe, expect, it } from 'vitest';
import { canAltarEnchant, canEnchant, enchantLevel } from '../core/enchant';
import { ITEMS, RECIPES, hasLootTable, item, lootTableById, rarityOf, rollLoot, validateContent } from '../core/registry';
import { makeEnchantedStack, makeStack, Inventory } from '../game/inventory';
import { LEGENDARIES, LEGENDARY_ITEMS, isLegendary, legendaryForSource, legendaryOf, legendaryTableId, type LegendarySource } from './legendary';

const MAUL_IRON = 7;

describe('the legendary weapons (data)', () => {
  it('are real items with a story, a verb, a utility and a hint', () => {
    expect(LEGENDARIES).toHaveLength(8);
    for (const l of LEGENDARIES) {
      expect(item(l.item).name, l.item).toBeTruthy();
      expect(l.story.length, l.item).toBeGreaterThan(10);
      expect(l.verb.length, l.item).toBeGreaterThan(10);
      expect(l.utility.length, l.item).toBeGreaterThan(10);
      expect(l.hint.length, l.item).toBeGreaterThan(10);
      expect(rarityOf(l.item), l.item).toBe('legendary');
    }
    expect(new Set(LEGENDARIES.map((l) => l.effect)).size).toBe(LEGENDARIES.length); // one verb each, none shared
    expect(new Set(LEGENDARIES.map((l) => l.item)).size).toBe(LEGENDARIES.length);
  });

  it('keep the whole content valid (icons, loot tables, rarity list)', () => {
    expect(validateContent()).toEqual([]);
  });

  it('stay near a normal weapon of their age: the power is the verb, not the number', () => {
    for (const spec of LEGENDARY_ITEMS) {
      const def = item(spec.key);
      expect(def.weapon!.damage, spec.key).toBeGreaterThanOrEqual(4);
      expect(def.weapon!.damage, spec.key).toBeLessThanOrEqual(MAUL_IRON);
      expect(def.age, spec.key).toBeLessThanOrEqual(1);
      expect(def.tool!.speed, spec.key).toBe(1); // no weapon mines faster
      expect(def.stack, spec.key).toBe(1);
    }
  });

  it('cannot be crafted and are not on the trader\'s shelves', () => {
    for (const l of LEGENDARIES) {
      expect(RECIPES.some((r) => r.output.item === l.item), `${l.item} has a recipe`).toBe(false);
    }
    for (const id of ['trader_common', 'trader_rare']) {
      for (const l of LEGENDARIES) expect(JSON.stringify(lootTableById(id)), `${id} sells ${l.item}`).not.toContain(l.item);
    }
  });

  it('are found with their fixed enchants and full durability', () => {
    for (const l of LEGENDARIES.filter((x) => x.source !== 'tavern_vault')) {
      expect(hasLootTable(legendaryTableId(l.item))).toBe(true);
      const found = rollLoot(lootTableById(legendaryTableId(l.item)), () => 0.5);
      expect(found).toHaveLength(1);
      expect(found[0].item).toBe(l.item);
      expect(found[0].durability).toBe(item(l.item).tool!.durability);
      for (const [key, level] of Object.entries(l.enchants ?? {})) expect(enchantLevel(found[0], key), `${l.item} ${key}`).toBe(level);
    }
  });

  it('keep their enchants through the inventory (clone, save and load), and never merge', () => {
    const inv = new Inventory(4);
    inv.set(0, makeEnchantedStack('gale_reed', { featherfall: 2 }));
    expect(enchantLevel(inv.slots[0] ?? undefined, 'featherfall')).toBe(2);
    const back = new Inventory(4);
    back.load(JSON.parse(JSON.stringify(inv.toJSON())));
    expect(back.slots[0]).toMatchObject({ item: 'gale_reed', enchants: { featherfall: 2 } });
    expect(makeStack('emberfang', 1, 320).enchants).toBeUndefined();
  });

  it('are never changed at the altar, though the same tool of a common kind is', () => {
    expect(canEnchant(item('bronze_pickaxe'), 'veinseeker')).toBe(true);
    expect(canAltarEnchant(item('bronze_pickaxe'), 'veinseeker')).toBe(true);
    expect(canAltarEnchant(item('orrins_spare_pick'), 'magnet')).toBe(false);
    expect(canAltarEnchant(item('orrins_spare_pick'), 'veinseeker')).toBe(false);
    expect(canAltarEnchant(item('gale_reed'), 'featherfall')).toBe(false);
    // The one thing the altar may do to a legendary: deepen its verb, which a common weapon cannot take.
    expect(canAltarEnchant(item('gale_reed'), 'attunement')).toBe(true);
    expect(canAltarEnchant(item('emberfang'), 'attunement')).toBe(true);
    expect(canAltarEnchant(item('bronze_pickaxe'), 'attunement')).toBe(false);
  });

  it('Orrin\'s Spare Pick still comes from the tavern vault with Veinseeker', () => {
    const found = rollLoot(lootTableById('tavern_vault'), () => 0.3);
    const pick = found.find((s) => s.item === 'orrins_spare_pick')!;
    expect(enchantLevel(pick, 'veinseeker')).toBe(1);
  });

  it('knows which item is which', () => {
    expect(isLegendary('emberfang')).toBe(true);
    expect(isLegendary('bronze_pickaxe')).toBe(false);
    expect(isLegendary(null)).toBe(false);
    expect(legendaryOf('lanternblade')?.effect).toBe('lantern_burst');
    expect(ITEMS.some((i) => i.key === 'emberfang')).toBe(true);
  });
});

describe('placement for the ruin and boss systems', () => {
  const sources: LegendarySource[] = ['ruin', 'boss', 'tavern_vault'];

  it('is deterministic by seed and never hands the same weapon to two places of one world', () => {
    for (const seed of [1, 7, 42, 99999, 0x7fffffff]) {
      const all: string[] = [];
      for (const src of sources) {
        const pool = LEGENDARIES.filter((l) => l.source === src).length;
        for (let i = 0; i < pool + 2; i++) {
          const a = legendaryForSource(src, seed, i);
          expect(legendaryForSource(src, seed, i)).toBe(a);
          if (a !== null) all.push(a);
          expect(a === null, `${src} #${i}`).toBe(i >= pool);
        }
      }
      expect(new Set(all).size).toBe(all.length);
      expect(all.sort()).toEqual(LEGENDARIES.map((l) => l.item).sort());
    }
  });

  it('rotates which ruin gets which weapon with the seed, and rejects bad indexes', () => {
    const firsts = new Set<string | null>();
    for (let seed = 0; seed < 50; seed++) firsts.add(legendaryForSource('ruin', seed, 0));
    expect(firsts.size).toBeGreaterThanOrEqual(2);
    expect(legendaryForSource('ruin', 1, -1)).toBeNull();
    expect(legendaryForSource('ruin', 1, 1.5)).toBeNull();
    expect(['emberfang', 'starcleaver']).toContain(legendaryForSource('boss', 1, 0));
  });
});
