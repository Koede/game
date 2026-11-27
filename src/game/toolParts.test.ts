import { describe, expect, it } from 'vitest';
import { BINDINGS, HANDLES, KIND_HEADS, MODULAR_KINDS, isWeaponKind, sparesWear, TOOL_PART_ITEMS, TOOL_PART_RECIPES, buildItemKey, buildStats, partsOfItem } from '../content/toolParts';
import { item, itemOrNull } from '../core/registry';
import { Inventory, makeStack } from './inventory';
import { BUILD_RECIPES, craft } from './crafting';
import { repairMaterial } from './toolQuality';
import { swapPart } from './toolParts';
import { effectiveTier, miningTime } from './mining';
import { block } from '../core/registry';

describe('modular tools: parity with the old tools', () => {
  it('every legacy pickaxe, axe and shovel is its default build, number for number', () => {
    for (const kind of MODULAR_KINDS) {
      for (const head of [...KIND_HEADS[kind], ...(isWeaponKind(kind) ? [] : ['wooden'])]) {
        const legacy = item(`${head}_${kind}`).tool!;
        const build = { kind, head, handle: 'oak', binding: 'cord' };
        const { damage, ...numbers } = buildStats(build);
        expect(numbers, `${head}_${kind}`).toEqual({ tier: legacy.tier, speed: legacy.speed, durability: legacy.durability });
        if (isWeaponKind(kind)) expect(damage, `${head}_${kind}`).toBe(item(`${head}_${kind}`).weapon!.damage);
        expect(partsOfItem(`${head}_${kind}`)).toEqual(build);
        expect(buildItemKey(build)).toBe(`${head}_${kind}`);
      }
    }
  });
  it('every built tool item carries the stats its parts give', () => {
    const built = TOOL_PART_ITEMS.filter((i) => i.tool);
    // Every non-default build, plus the plain sword and spear (nothing else makes those legacy keys).
    const perKind = Object.keys(HANDLES).length * Object.keys(BINDINGS).length;
    expect(built.length).toBe(MODULAR_KINDS.reduce((n, k) => n + KIND_HEADS[k].length * (perKind - 1 + (['sword', 'spear'].includes(k) ? 1 : 0)), 0));
    for (const spec of built) {
      const b = partsOfItem(spec.key)!;
      expect(b, spec.key).not.toBeNull();
      const { damage, ...numbers } = buildStats(b);
      expect(item(spec.key).tool).toMatchObject(numbers);
      if (isWeaponKind(b.kind)) expect(item(spec.key).weapon!.damage).toBe(damage);
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

describe('modular tools: hoes, mauls and traits', () => {
  it('a built maul keeps speed 1 and its head\'s damage; a built hoe still tills', () => {
    const maul = item('iron_pine_resin_maul');
    expect(maul.tool).toMatchObject({ kind: 'maul', speed: 1 });
    expect(maul.weapon!.damage).toBe(7);
    expect(item('flint_oak_resin_hoe').tool).toMatchObject({ kind: 'hoe', speed: 1, durability: 77 });
  });
  it('only a resin binding ever spares a use of wear, and only on a low roll', () => {
    expect(sparesWear('iron_oak_resin_pickaxe', 0.05)).toBe(true);
    expect(sparesWear('iron_oak_resin_pickaxe', 0.9)).toBe(false);
    expect(sparesWear('iron_pickaxe', 0)).toBe(false);
    expect(sparesWear('iron_pine_cord_axe', 0)).toBe(false);
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

describe('modular tools: swords and spears', () => {
  it('a sword is quicker and a little lighter than a maul of the same metal; a spear lighter still', () => {
    const maul = item('iron_maul').weapon!, sword = item('iron_sword').weapon!, spear = item('iron_spear').weapon!;
    expect(sword.damage).toBeLessThan(maul.damage);
    expect(spear.damage).toBeLessThan(sword.damage);
    expect(sword.cooldownS!).toBeLessThan(0.5);
    expect(item('iron_pine_resin_sword').weapon!.damage).toBe(sword.damage);
    expect(item('iron_pine_resin_sword').weapon!.cooldownS!).toBeLessThan(sword.cooldownS!); // pine swings faster
  });
  it('they are craftable from a head, a handle and a binding, and mend with their metal', () => {
    for (const key of ['bronze_sword', 'flint_spear', 'steel_oak_resin_spear']) {
      expect(itemOrNull(key), key).not.toBeNull();
      expect(BUILD_RECIPES.some((r) => r.output.item === key), key).toBe(true);
    }
    expect(repairMaterial('iron_pine_cord_sword')).toBe('iron_ingot');
    expect(repairMaterial('flint_spear')).toBe('flint');
  });
});
