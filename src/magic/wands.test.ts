import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { FOCI, ROD_TIERS, WANDS } from '../content/itemsMagic';
import { itemOrNull } from '../core/registry';
import { arcaneRecipe } from '../content/recipesMagic';
import { RESEARCH_GATES } from './gates';

describe('wands: cores and caps', () => {
  it('nine wands exist as items with recipes at the desk, gated by research', () => {
    expect(WANDS).toHaveLength(9);
    for (const w of WANDS) {
      expect(itemOrNull(w.key)).not.toBeNull();
      expect(arcaneRecipe(w.key)).not.toBeNull();
      expect(RESEARCH_GATES.has(w.key)).toBe(true);
    }
  });

  it('the core sets capacity: the best wand carried caps the pools', () => {
    const t = setup();
    t.hold('wand_iron_copper');
    expect(t.magic.bestRod()?.capacity).toBe(64);
    t.hold('wand_reed_tin');
    expect(t.magic.bestRod()?.capacity).toBe(16);
    expect(ROD_TIERS.length).toBe(12);
  });

  it('a cap draws its favoured primals a half more', () => {
    const t = setup();
    t.learnAll();
    t.hold('wand_bronze_copper');
    const rod = t.magic.bestRod()!;
    expect(rod.favour).toEqual(['cinder', 'loam']);
    t.magic.use(null);
    const v = t.magic.vis;
    // the land under the stone floor gives one aspect: favoured pools gain 3 (ceil(2 * 1.5)), others 2
    const gained = Object.entries(v).filter(([, n]) => n > 0);
    for (const [p, n] of gained) expect(n).toBe(rod.favour!.includes(p as 'cinder') ? 3 : 2);
  });

  it('a favoured primal costs a quarter less in a focus', () => {
    const t = setup();
    t.hold('wand_bronze_copper');
    const rod = t.magic.bestRod()!;
    expect(t.magic.focusCost({ loam: 3, rune: 3, cinder: 2 }, rod)).toEqual({ loam: 2, rune: 3, cinder: 1 });
    expect(t.magic.focusCost({ loam: 3 }, null)).toEqual({ loam: 3 });
  });

  it('plugs a focus into a wand at the Arcane Workbench; Use casts it, and takes it back', () => {
    const t = setup();
    t.learnAll();
    t.put(3, 1, 3, 'arcane_workbench');
    t.hold('wand_bronze_copper');
    t.player.inventory.add('focus_ward', 1);
    expect(t.magic.use(t.at(3, 1, 3))).toBe('worked');
    expect(t.magic.pluggedFocus('wand_bronze_copper')).toBe('focus_ward');
    expect(t.player.inventory.has('focus_ward')).toBe(false);
    t.magic.vis.loam = 8;
    t.magic.vis.rune = 8;
    expect(t.magic.use(null)).toBe('worked');
    expect(t.magic.wardS).toBeGreaterThan(0);
    // survives a save
    const raw = JSON.parse(JSON.stringify(t.magic.toJSON()));
    const u = setup();
    u.magic.load(raw);
    expect(u.magic.pluggedFocus('wand_bronze_copper')).toBe('focus_ward');
    // and comes back out
    t.put(4, 1, 4, 'arcane_workbench');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.has('focus_ward')).toBe(true);
    expect(FOCI.length).toBeGreaterThan(0);
  });
});
