/**
 * Fishing data shared by the content, the progression solver and src/sim/fishing.ts: the rod, the fish and the water
 * types they live in. Data only (no registry imports). Fishing is optional: no objective needs a fish.
 */
export const FISHING_ROD = 'fishing_rod';
/** Uses a fresh rod has (each cast that ends in a bite or a lost line wears it by one). */
export const FISHING_ROD_WEAR = 90;

/** Buff lengths of the fish dishes: both stay under the 360 s of the hearth stew and the 240 s of a mug of ale. */
export const FISH_CHOWDER_BUFF_S = 300;
export const WINTER_BROTH_BUFF_S = 240;

export type WaterKind = 'pond' | 'river' | 'lake' | 'marsh' | 'frozen' | 'cave';

export type FishSeason = 'spring' | 'summer' | 'autumn' | 'winter';
/**
 * A catch: weights per water kind (0 or absent: not there), a multiplier at night and in rain, and `seasons`: a multiplier
 * per season of the year (absent = 1, 0 = the fish is gone that season). Season is optional context: no season, no change.
 */
export interface FishSpec {
  item: string; cooked: string; weights: Partial<Record<WaterKind, number>>; night?: number; rain?: number;
  seasons?: Partial<Record<FishSeason, number>>;
}

export const FISH: readonly FishSpec[] = [
  { item: 'raw_perch', cooked: 'cooked_perch', weights: { pond: 6, river: 4, lake: 3, marsh: 3 }, seasons: { summer: 1.2, winter: 0.7 } },
  { item: 'raw_trout', cooked: 'cooked_trout', weights: { river: 6, lake: 4, frozen: 5 }, rain: 1.6, seasons: { spring: 1.3, winter: 0.8 } },
  { item: 'raw_eel', cooked: 'cooked_eel', weights: { marsh: 6, lake: 2, pond: 1 }, night: 2 },
  { item: 'raw_glowfin', cooked: 'cooked_glowfin', weights: { cave: 8, lake: 1 }, night: 1 },
  // The autumn run: salmon climb the rivers in the fall and are gone by winter.
  { item: 'raw_salmon', cooked: 'cooked_salmon', weights: { river: 5, lake: 1 }, seasons: { spring: 1.2, summer: 0.5, autumn: 3, winter: 0 } },
  // Pike wait in the deep lakes and bite hardest in the cold.
  { item: 'raw_pike', cooked: 'cooked_pike', weights: { lake: 5, marsh: 2, river: 1 }, seasons: { summer: 0.6, autumn: 1.3, winter: 1.5 } },
  // Carp laze in warm shallows and sulk in winter.
  { item: 'raw_carp', cooked: 'cooked_carp', weights: { pond: 4, marsh: 3, lake: 2 }, seasons: { spring: 1.1, summer: 1.8, winter: 0.4 } },
  // The fish of the ice: whitefish through a frozen pool, best in the dead of winter.
  { item: 'raw_whitefish', cooked: 'cooked_whitefish', weights: { frozen: 8, lake: 2 }, seasons: { autumn: 1.2, winter: 2 } },
  // Crayfish crawl in marsh and stream, mostly after dark and in summer; they burrow away for winter.
  { item: 'raw_crayfish', cooked: 'cooked_crayfish', weights: { marsh: 3, river: 2, pond: 1 }, night: 1.5, seasons: { summer: 2, winter: 0 } },
];

/** Not fish: what a cast sometimes hauls up. Real items of every age (checked by tests). */
export const JUNK: ReadonlyArray<{ item: string; weight: number }> = [
  { item: 'stick', weight: 5 }, { item: 'fiber', weight: 4 }, { item: 'clay', weight: 2 }, { item: 'flint', weight: 1 },
];

export const FISH_ITEMS: readonly string[] = FISH.map((f) => f.item);
export const COOKED_FISH_ITEMS: readonly string[] = FISH.map((f) => f.cooked);
