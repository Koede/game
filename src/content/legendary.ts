/**
 * Legendary weapons (docs/plans/legendary-weapons.md): a few named, found-not-crafted items, each with ONE verb (`effect`), one
 * utility and one look. This file is data only; the verbs live in src/game/legendary.ts and read nothing but the item key, so
 * nothing done to a stack (the altar, a merge, a trade) can add, swap or lose one. Stats stay near a normal weapon of the age.
 *
 * Placement: every legendary has a `source` (a kind of place), not a position. The places themselves are built by other
 * systems (the tavern, the deep ruins, the cave bosses); each asks `legendaryForSource` for the weapon its n-th such place holds
 * in this world, so a seed always puts the same weapon in the same place and never the same weapon in two.
 */
import type { ItemSpec, LegendaryEffect, LootTableSpec } from '../core/types';
import { hash32 } from '../core/math';

/** What kind of place holds a legendary. 'tavern_vault' exists today; 'ruin' and 'boss' are filled by the ruin and cave systems. */
export type LegendarySource = 'tavern_vault' | 'ruin' | 'boss';

export interface LegendarySpec {
  /** The item key. */
  item: string;
  effect: LegendaryEffect;
  source: LegendarySource;
  /** One line of story (the tooltip). */
  story: string;
  /** What the weapon does, in words a tooltip can carry. */
  verb: string;
  /** The utility outside combat. */
  utility: string;
  /** A rumour about where such things are told of (the notebook silhouette). */
  hint: string;
  /** Fixed enchants a found stack comes with (src/core/enchant.ts); altars never change them. */
  enchants?: Record<string, number>;
}

export const LEGENDARIES: readonly LegendarySpec[] = [
  {
    item: 'orrins_spare_pick', effect: 'veinseek', source: 'tavern_vault',
    story: 'The pick Orrin hid behind the brick for the day his own broke.',
    verb: 'Breaks the whole connected ore vein, never past the pick\'s tier.',
    utility: 'Hums softly when held near ore behind a wall.',
    hint: 'Orrin swears he kept a spare somewhere dry.',
    enchants: { veinseeker: 1 },
  },
  {
    item: 'emberfang', effect: 'burning_marks', source: 'boss',
    story: 'Forged for a keeper of the old works, and still warm.',
    verb: 'Each hit leaves a burning mark; the third mark bursts and hurts everything beside it.',
    utility: 'Warms you like a torch when held, and melts snow at a touch.',
    hint: 'The caravan folk speak of a blade that never cooled, left with whatever guards the deepest works.',
  },
  {
    item: 'gale_reed', effect: 'lunge', source: 'ruin',
    story: 'A reed spear a long-dead courier carried across the high passes.',
    verb: 'Use lunges you forward; what the lunge hits is thrown back.',
    utility: 'Falls become glides: no fall damage while carried, and a long fall can be slowed.',
    hint: 'Couriers tell of a spear that outran the wind, lost in a ruin far from any road.',
    enchants: { featherfall: 2 },
  },
  {
    item: 'lanternblade', effect: 'lantern_burst', source: 'ruin',
    story: 'A short blade with a lamp in its hilt that no one remembers lighting.',
    verb: 'A hit in the dark bursts into light; automatons are driven back and stunned.',
    utility: 'Leaves a soft trail of light while carried.',
    hint: 'Miners say a lamp-sword lies where the old stairs end.',
    enchants: { lightstep: 2 },
  },
  {
    item: 'quiet_hammer', effect: 'still_blow', source: 'ruin',
    story: 'Cast for a mason who worked nights beside sleeping neighbours.',
    verb: 'After standing still a moment, the next blow is silent and heavy: extra damage and a short stun.',
    utility: 'Cracks stone brick like any maul, without a sound.',
    hint: 'Old stonecutters say a hammer that never rang is buried under a ruin\'s floor.',
  },
  {
    item: 'tidebrand', effect: 'pull', source: 'ruin',
    story: 'A three-pronged fishing spear, salt-white, from a drowned works.',
    verb: 'Each hit pulls the target a step toward you.',
    utility: 'Carried, your breath lasts nearly three times as long underwater.',
    hint: 'Fishers talk of a trident that kept a diver breathing, in the ruins near water.',
  },
  {
    item: 'rootsong', effect: 'root', source: 'ruin',
    story: 'A staff of living wood that hums when the ground is wet.',
    verb: 'Each hit roots the target in place for a moment.',
    utility: 'Use on bare dirt to coax grass over it.',
    hint: 'Hedge-folk sing of a staff that grew where an old ruin\'s garden once was.',
  },
  {
    item: 'starcleaver', effect: 'shock_arc', source: 'boss',
    story: 'A broad blade that fell from the sky into the old works and stayed.',
    verb: 'Hold Mine to charge a swing; the charged blow releases a shock arc through up to three more creatures ahead.',
    utility: 'Sweeps tall grass and dry shrub down in one stroke.',
    hint: 'The caravan folk say a star-iron blade lies with the keeper of the deepest works.',
  },
];

const BY_ITEM = new Map(LEGENDARIES.map((l) => [l.item, l]));
export const legendaryOf = (item: string | null | undefined): LegendarySpec | undefined => (item ? BY_ITEM.get(item) : undefined);
export const isLegendary = (item: string | null | undefined): boolean => legendaryOf(item) !== undefined;

/** The verb the item carries, or null. */
export const legendaryEffectOf = (item: string | null | undefined): LegendaryEffect | null => legendaryOf(item)?.effect ?? null;

/** Items of the legendary weapons that are not already defined elsewhere (the Spare Pick lives in items.ts). */
export const LEGENDARY_ITEMS: ItemSpec[] = [
  {
    key: 'emberfang', name: 'Emberfang', icon: 'item_emberfang', category: 'tool', age: 1,
    desc: 'Forged for a keeper of the old works, still warm. Each hit marks; the third mark bursts. Warms you like a torch.',
    tool: { kind: 'sword', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 6 },
  },
  {
    key: 'gale_reed', name: 'Gale Reed', icon: 'item_gale_reed', category: 'tool', age: 1,
    desc: 'A courier\'s reed spear. Use lunges you forward and the next hit throws its target back. No fall damage carried.',
    tool: { kind: 'spear', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 5 },
  },
  {
    key: 'lanternblade', name: 'Lanternblade', icon: 'item_lanternblade', category: 'tool', age: 1,
    desc: 'A short blade with a lamp in its hilt. A hit in the dark bursts into light and stuns automatons. Leaves a trail of light.',
    tool: { kind: 'sword', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 5 },
  },
  {
    key: 'quiet_hammer', name: 'The Quiet Hammer', icon: 'item_quiet_hammer', category: 'tool', age: 1,
    desc: 'Cast for a mason who worked beside sleepers. After standing still, the next blow is silent and heavy. Cracks brick quietly.',
    tool: { kind: 'maul', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 6 },
  },
  {
    key: 'tidebrand', name: 'Tidebrand', icon: 'item_tidebrand', category: 'tool', age: 1,
    desc: 'A salt-white trident from a drowned works. Each hit pulls the target toward you, and carried, it stretches your breath underwater.',
    tool: { kind: 'trident', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 5 },
  },
  {
    key: 'rootsong', name: 'Rootsong', icon: 'item_rootsong', category: 'tool', age: 1,
    desc: 'A staff of living wood. Each hit roots the target in place for a moment. Use on bare dirt to green it over.',
    tool: { kind: 'staff', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 4 },
  },
  {
    key: 'starcleaver', name: 'Starcleaver', icon: 'item_starcleaver', category: 'tool', age: 1,
    desc: 'A broad star-iron blade. Hold Mine to charge: the charged blow throws a shock arc ahead. Sweeps grass and shrub aside.',
    tool: { kind: 'sword', tier: 2, speed: 1, durability: 320 }, weapon: { damage: 6 },
  },
];

/** One table per legendary that holds exactly it: a crate or a boss cache rolls `legendaryTableId(item)` (rollLoot attaches the fixed enchants). */
export const legendaryTableId = (item: string): string => `legendary_${item}`;
export const LEGENDARY_TABLES: LootTableSpec[] = LEGENDARIES.filter((l) => l.source !== 'tavern_vault').map((l) => ({
  id: legendaryTableId(l.item), tier: 'deep', rolls: [0, 0],
  guaranteed: [{ item: l.item, count: 1, weight: 1, rarity: 'legendary' }], entries: [],
}));

/**
 * Which legendary the `index`-th place of this `source` holds in the world of `seed`: the source's legendaries, started at a
 * seed-chosen offset and handed out in turn, so the same seed always answers the same and no weapon is placed twice. Null once the
 * source's legendaries are used up (a second ruin holds none until there are more). Places the other systems build call this once.
 */
export function legendaryForSource(source: LegendarySource, seed: number, index: number): string | null {
  const pool = LEGENDARIES.filter((l) => l.source === source);
  if (pool.length === 0 || !Number.isInteger(index) || index < 0 || index >= pool.length) return null;
  const offset = hash32(seed, pool.length, source.length) % pool.length;
  return pool[(offset + index) % pool.length].item;
}
