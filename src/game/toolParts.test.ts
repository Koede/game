import { describe, expect, it } from 'vitest';
import { BINDINGS, HANDLES, HEADS, MODULAR_KINDS, TOOL_PART_ITEMS, TOOL_PART_RECIPES, buildItemKey, buildStats, partsOfItem } from '../content/toolParts';
import { item, itemOrNull } from '../core/registry';
import { Inventory, makeStack } from './inventory';
import { BUILD_RECIPES, craft } from './crafting';
import { repairMaterial } from './toolQuality';
import { swapPart } from './toolParts';
import { effectiveTier, miningTime } from './mining';
import { block } from '../core/registry';

describe('modular tools: parity with the old tools', () => {
  it('every legacy pickaxe, axe and shovel is its default build, number for number', () => {
    for (const head of Object.keys(HEADS)) {
      for (const kind of MODULAR_KINDS) {
        const legacy = item(`${head}_${kind}`).tool!;
        const build = { kind, head, handle: 'oak', binding: 'cord' };
        expect(buildStats(build), `${head}_${kind}`).toEqual({ tier: legacy.tier, speed: legacy.speed, durability: legacy.durability });
        expect(partsOfItem(`${head}_${kind}`)).toEqual(build);
        expect(buildItemKey(build)).toBe(`${head}_${kind}`);
      }
    }
  });
  it('every built tool item carries the stats its parts give', () => {
    const built = TOOL_PART_ITEMS.filter((i) => i.tool);
    expect(built.length).toBe(4 * 3 * (Object.keys(HANDLES).length * Object.keys(BINDINGS).length - 1));
    for (const spec of built) {
      const b = partsOfItem(spec.key)!;
      expect(b, spec.key).not.toBeNull();
      expect(item(spec.key).tool).toMatchObject(buildStats(b));
    }
  });
  it('a fine handle never adds tier: a bronze head cannot mine a tier-3 block however it is built', () => {
    const iron = block('bauxite');
    for (const key of ['bronze_pine_resin_pickaxe', 'bronze_oak_resin_pickaxe', 'bronze_pine_cord_pickaxe']) {
      expect(effectiveTier(iron, makeStack(key, 1, 10))).toBeLessThan(3);
    }
  });
  it('a pine handle mines faster and resin lasts longer', () => {
    const stone = block('stone');
    const plain = miningTime(stone, makeStack('iron_pickaxe', 1, 384), false);
    const pine = miningTime(stone, makeStack('iron_pine_cord_pickaxe', 1, 326), false);
    expect(pine).toBeLessThan(plain);
    expect(item('iron_oak_resin_pickaxe').tool!.durability).toBeGreaterThan(item('iron_pickaxe').tool!.durability);
  });
});

describe('modular tools: assembly', () => {
  it('every part and build is obtainable: heads, handle, bindings and assembly recipes all exist as items', () => {
    for (const r of TOOL_PART_RECIPES) {
      expect(itemOrNull(r.output.item), r.id).not.toBeNull();
      for (const i of r.inputs) expect(itemOrNull(i.item), `${r.id} needs ${i.item}`).not.toBeNull();
    }
  });
});

describe('modular tools: swapping parts', () => {
  it('keeps enchants, quality and the share of wear, and returns the old part', () => {
    const worn = makeStack('iron_pickaxe', 1, 192, 1, { veinseeker: 1 });
    const r = swapPart(worn, 'handle', 'pine');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stack.item).toBe('iron_pine_cord_pickaxe');
    expect(r.stack.quality).toBe(1);
    expect(r.stack.enchants).toEqual({ veinseeker: 1 });
    expect(r.returned).toBe('stick');
    const frac = (s: { durability?: number; item: string; quality?: 1 | 2 }) => s.durability! / Math.round(item(s.item).tool!.durability * 1.25);
    expect(frac(r.stack)).toBeCloseTo(frac(worn), 1);
  });
  it('refuses the same part, an unknown material, and a tool with no parts', () => {
    expect(swapPart(makeStack('iron_pickaxe', 1, 5), 'handle', 'oak').ok).toBe(false);
    expect(swapPart(makeStack('iron_pickaxe', 1, 5), 'binding', 'nonsense').ok).toBe(false);
    expect(swapPart(makeStack('wrench', 1), 'head', 'iron').ok).toBe(false);
  });
  it('swapping the head back and forth lands on the legacy item', () => {
    const r = swapPart(makeStack('iron_pine_cord_pickaxe', 1, 50), 'handle', 'oak');
    expect(r.ok && r.stack.item).toBe('iron_pickaxe');
  });
  it('mends with the head material', () => {
    expect(repairMaterial('steel_pine_resin_axe')).toBe('steel_ingot');
    expect(repairMaterial('flint_pickaxe')).toBe('flint');
  });
});

describe('modular tools: building at the workbench', () => {
  it('turns a head, a pine handle and resin into the built tool, and conserves the rest', () => {
    const inv = new Inventory(36);
    inv.add('iron_pickaxe_head', 1);
    inv.add('pine_handle', 3);
    inv.add('pine_resin', 2);
    const recipe = BUILD_RECIPES.find((r) => r.output.item === 'iron_pine_resin_pickaxe')!;
    expect(recipe).toBeDefined();
    const r = craft(recipe, [inv], inv, 1);
    expect(r.ok).toBe(true);
    expect(inv.count('iron_pine_resin_pickaxe')).toBe(1);
    expect(inv.count('iron_pickaxe_head')).toBe(0);
    expect(inv.count('pine_handle')).toBe(2);
    expect(inv.count('pine_resin')).toBe(1);
  });
  it('old saves still load: a legacy tool stack survives a round trip untouched', () => {
    const inv = new Inventory(36);
    inv.slots[0] = { item: 'bronze_pickaxe', count: 1, durability: 100 };
    const copy = new Inventory(36);
    copy.load(JSON.parse(JSON.stringify(inv.slots)));
    expect(copy.slots[0]).toEqual({ item: 'bronze_pickaxe', count: 1, durability: 100 });
  });
});
