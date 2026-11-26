/**
 * Fishing data shared by the content, the progression solver and src/sim/fishing.ts: the rod, the fish and the water
 * types they live in. Data only (no registry imports). Fishing is optional: no objective needs a fish.
 */
export const FISHING_ROD = 'fishing_rod';
/** Uses a fresh rod has (each cast that ends in a bite or a lost line wears it by one). */
export const FISHING_ROD_WEAR = 90;

export type WaterKind = 'pond' | 'river' | 'lake' | 'marsh' | 'frozen' | 'cave';

/** A catch: weights per water kind (0 or absent: not there). `junk` is what the line brings up instead of a fish. */
export interface FishSpec {
  item: string; cooked: string; weights: Partial<Record<WaterKind, number>>; night?: number; rain?: number;
  /** Multiplier per season (src/sim/seasons.ts); absent seasons count 1. Every fish keeps a weight in every season. */
  season?: Partial<Record<'spring' | 'summer' | 'autumn' | 'winter', number>>;
}

export const FISH: readonly FishSpec[] = [
  { item: 'raw_perch', cooked: 'cooked_perch', weights: { pond: 6, river: 4, lake: 3, marsh: 3 }, season: { summer: 1.5 } },
  { item: 'raw_trout', cooked: 'cooked_trout', weights: { river: 6, lake: 4, frozen: 5 }, rain: 1.6, season: { spring: 1.6 } },
  { item: 'raw_eel', cooked: 'cooked_eel', weights: { marsh: 6, lake: 2, pond: 1 }, night: 2, season: { autumn: 1.6 } },
  { item: 'raw_glowfin', cooked: 'cooked_glowfin', weights: { cave: 8, lake: 1 }, night: 1, season: { winter: 1.8 } },
];

/** Not fish: what a cast sometimes hauls up. Real items of every age (checked by tests). */
export const JUNK: ReadonlyArray<{ item: string; weight: number }> = [
  { item: 'stick', weight: 5 }, { item: 'fiber', weight: 4 }, { item: 'clay', weight: 2 }, { item: 'flint', weight: 1 },
];

export const FISH_ITEMS: readonly string[] = FISH.map((f) => f.item);
export const COOKED_FISH_ITEMS: readonly string[] = FISH.map((f) => f.cooked);
