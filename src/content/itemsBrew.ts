/**
 * Items of brewing (BREWING_PLAN 3, 11.1): cuttings, leaves, cherries and every stage they are processed to, the
 * drip cone, boiling water in a bucket, and the six drinks. The clay cup and the kettle pot are block items (the
 * registry generates them from blocksBrew.ts).
 */
import { BOILING_KEEPS_S, DRINK_BUFF_S, HEARTHKEPT_DRINK_WARMTH } from '../core/constants';
import type { DrinkSpec, ItemSpec } from '../core/types';

/** A plain ingredient or intermediate. */
const stuff = (key: string, name: string, desc: string, extra: Partial<ItemSpec> = {}): ItemSpec => ({
  key, name, desc, category: 'material', age: 0, ...extra,
});

/** An ingredient that brews `drink` in a cup with a drip cone. */
const ingredient = (key: string, name: string, desc: string, brews: string): ItemSpec => stuff(key, name, desc, { brews });

/** A cup of something: it stacks to 1 and drinking it returns the clay cup. */
function drink(key: string, name: string, desc: string, spec: Omit<DrinkSpec, 'buffS'>): ItemSpec {
  return { key, name, desc, category: 'food', age: 0, stack: 1, drink: { ...spec, buffS: DRINK_BUFF_S } };
}

export const BREW_ITEMS: ItemSpec[] = [
  stuff('drip_cone', 'Drip Cone', 'A clay cone with a fiber filter. Set it on a clay cup, load it with tea or ground coffee, and pour boiling water through.', { stack: 16 }),
  // The item of a picked bush: planting it starts a bush that fruits again (its block is the bare stage).
  { key: 'tea_cutting', name: 'Tea Cutting', desc: 'A rooted tea cutting. Plant it on grass, dirt, peat or farmland and it leafs every six minutes.', category: 'block', age: 0, stack: 16, block: 'tea_bush_bare', icon: 'item_tea_cutting' },
  { key: 'coffee_cutting', name: 'Coffee Cutting', desc: 'A rooted coffee cutting. Plant it on grass, dirt, peat or farmland and it fruits every six minutes.', category: 'block', age: 0, stack: 16, block: 'coffee_shrub_bare', icon: 'item_coffee_cutting' },
  stuff('tea_leaves', 'Tea Leaves', 'Fresh green tea leaves. Dry them in a crucible at 150 C.', { category: 'resource' }),
  ingredient('dried_tea', 'Dried Tea', 'Tea leaves dried in the furnace. In a cone it brews Green Tea; roast it hotter for black tea, or blend it with berries.', 'green_tea'),
  ingredient('black_tea', 'Black Tea Leaves', 'Dried tea fired again at 250 C until it turns dark. In a cone it brews Black Tea.', 'black_tea_cup'),
  ingredient('berry_tea_blend', 'Berry Tea Blend', 'Dried tea crushed with wildberries. In a cone it brews Berry Tea.', 'berry_tea'),
  stuff('coffee_cherries', 'Coffee Cherries', 'Red coffee cherries, picked ripe. Roast them in a crucible at 220 C.', { category: 'resource' }),
  stuff('roasted_beans', 'Roasted Beans', 'Beans roasted brown. Grind them for a light roast, or roast them again at 400 C for a dark one.'),
  stuff('dark_beans', 'Dark Beans', 'Beans roasted nearly black at 400 C. Grind them for a dark roast.'),
  ingredient('ground_coffee', 'Ground Coffee', 'Two roasted beans ground at the workbench. In a cone it brews a Light Roast.', 'light_roast'),
  ingredient('ground_dark_coffee', 'Ground Dark Coffee', 'Two dark beans ground at the workbench. In a cone it brews a Dark Roast.', 'dark_roast'),
  ingredient('trail_blend', 'Trail Blend Grounds', 'Light and dark grounds mixed at the workbench, two portions to a batch. In a cone it brews a Trail Blend.', 'trail_blend_cup'),
  {
    // Boiling water in a bucket. Its stack's durability is the seconds left (the pack ticks it down).
    key: 'boiling_pail', name: 'Boiling Bucket', desc: 'A bucket of boiling water, too hot to keep: it cools back to water in a minute and a half. Pour it over a loaded cone.',
    category: 'misc', age: 0, stack: 1, cools: { to: 'water_pail', afterS: BOILING_KEEPS_S },
  },
  drink('green_tea', 'Green Tea', 'Light, grassy tea. Spring: you jump 35% higher for five minutes. Returns the cup.',
    { buff: 'spring', family: 'tea', colour: 0x9fae45 }),
  drink('black_tea_cup', 'Black Tea', 'Dark, malty tea that warms you through. Hearthkept: the cold drains your warmth half as fast for five minutes, and you are warmed at once. Returns the cup.',
    { buff: 'hearthkept', family: 'tea', colour: 0x7a3b1c, warmth: HEARTHKEPT_DRINK_WARMTH }),
  drink('berry_tea', 'Berry Tea', 'Tart red tea. Mending: you heal twice as fast for five minutes. Returns the cup.',
    { buff: 'mending', family: 'tea', colour: 0xa8324a }),
  drink('light_roast', 'Light Roast', 'A bright cup of coffee. Swift: you walk, sprint and swim 20% faster for five minutes. Returns the cup.',
    { buff: 'swift', family: 'coffee', colour: 0x6b4423 }),
  drink('dark_roast', 'Dark Roast', 'Black, bitter coffee. Vigor: you mine 25% faster for five minutes. Returns the cup.',
    { buff: 'vigor', family: 'coffee', colour: 0x2c1a10 }),
  drink('trail_blend_cup', 'Trail Blend', 'Light and dark roasts together. Lasting: hunger comes 30% slower for five minutes. Returns the cup.',
    { buff: 'lasting', family: 'coffee', colour: 0x4a2f1a }),
];
