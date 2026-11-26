/**
 * Resin, sugar and sweet baking (docs/api/sugar.md). The chain, all of it done at the clay furnace and by hand:
 *
 *   glass (sand, 700 C) -> Glass Beakers (forge) ........................ the rudimentary chemistry supplies
 *   beaker held against a pine log (Use) -> Pine Sap ..................... the log weeps again after a while
 *   Pine Sap boiled at 180 C (forge, beaker back) -> Pine Resin
 *   2 Resin + water + a beaker distilled at 260 C (forge, bucket and beaker back) -> 3 Sugar
 *   Sugar + flour/dough baked at the furnace -> Sugar Cookies, Sweet Bun, Sugar Cake
 *
 * Eating sugar or anything baked with it starts Sugar Rush (src/game/buffs.ts): a small speed boost that burns the
 * Well-Fed timer faster. Hunger itself drains as usual.
 */
import type { ItemSpec } from '../core/types';

/** Seconds of Sugar Rush per food. */
export const SUGAR_RUSH_S = { sugar: 45, sugar_cookie: 90, sweet_bun: 150, sugar_cake: 240 } as const;

const rush = (hunger: number, s: number) => ({ hunger, buff: 'sugar_rush' as const, buffS: s });

export const SUGAR_ITEMS: ItemSpec[] = [
  {
    key: 'glass_beaker', name: 'Glass Beaker', category: 'material', age: 0, stack: 16,
    desc: 'A thin glass beaker, the first piece of chemistry. Hold it to a pine log to catch sap; it comes back from boiling and distilling.',
  },
  {
    key: 'pine_sap', name: 'Pine Sap', category: 'material', age: 0, stack: 16,
    container: { holds: 'sap', boilsTo: 'pine_resin', emptyTo: 'glass_beaker', returns: 'glass_beaker', boilScale: 1.5 },
    desc: 'A beaker of sticky, clear sap. Set it on a hot furnace top, or boil it in a crucible at 180 C, to thicken it into resin.',
  },
  {
    key: 'pine_resin', name: 'Pine Resin', category: 'material', age: 0, stack: 32,
    desc: 'Boiled-down amber resin. Two of them, a bucket of water and a beaker distil into sugar at 260 C.',
  },
  {
    key: 'sugar', name: 'Sugar', category: 'food', age: 0, stack: 32, food: rush(1, SUGAR_RUSH_S.sugar),
    desc: 'Pale crystals distilled from resin. Bake with it, or eat it for a short Sugar Rush: faster feet, but Well-Fed wears off quicker.',
  },
  {
    key: 'sugar_cookie', name: 'Sugar Cookie', category: 'food', age: 0, stack: 16, food: rush(2, SUGAR_RUSH_S.sugar_cookie),
    desc: 'Flour and sugar baked crisp. A small meal and a Sugar Rush: you move faster, but Well-Fed wears off quicker.',
  },
  {
    key: 'sweet_bun', name: 'Sweet Bun', category: 'food', age: 0, stack: 16, food: rush(6, SUGAR_RUSH_S.sweet_bun),
    desc: 'Dough folded with sugar and baked golden. Filling, with a longer Sugar Rush.',
  },
  {
    key: 'sugar_cake', name: 'Sugar Cake', category: 'food', age: 0, stack: 8, food: rush(9, SUGAR_RUSH_S.sugar_cake),
    desc: 'A dense cake of flour and sugar. The biggest meal and the longest Sugar Rush; Well-Fed melts away while it lasts.',
  },
];
