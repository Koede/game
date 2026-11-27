/**
 * Which legendary weapons this world has already placed (docs/plans/legendary-weapons.md rule 3: only one of each per world). A place that
 * can hold one (a deep ruin's crate, a cave boss's hoard) calls `roll` once, when it is made: by its own hash it may hold one, and if it
 * does, that weapon is taken from the pool for good. The claims are saved with the world (extra `legendary`), so a weapon is never placed twice
 * and an old world, which has none, simply starts claiming from its next new crate.
 */
import { LEGENDARIES, legendaryTableId, type LegendarySource } from '../content/legendary';
import { hash32, hashFloat } from '../core/math';
import { lootTableById, rollLoot } from '../core/registry';
import type { ItemStack, IWorld } from '../core/types';

const SALT = 0x6c656765;

/** The chance that a place of each source holds a legendary, when one is left. A cave boss always does (it is the prize of a hard fight). */
export const LEGENDARY_CHANCE: Readonly<Record<LegendarySource, number>> = { tavern_vault: 0, ruin: 0.05, boss: 1 };

export interface ClaimsSave {
  v: 1;
  claimed: string[];
}

export class LegendaryClaims {
  private readonly claimed = new Set<string>();

  constructor(private readonly seed: () => number) {}

  has(item: string): boolean {
    return this.claimed.has(item);
  }

  get count(): number {
    return this.claimed.size;
  }

  /** Items of `source` still unplaced. The tavern's own pick is placed by the tavern, never by a roll, and counts as taken. */
  left(source: LegendarySource): string[] {
    return LEGENDARIES.filter((l) => l.source === source && !this.claimed.has(l.item)).map((l) => l.item);
  }

  /**
   * Rolls the place at (x, y, z): null, or the legendary it holds, now claimed. Deterministic for a given world state, place and `chance`
   * (default `LEGENDARY_CHANCE[source]`): the gate is the place's own hash, the pick is its hash over what is left.
   */
  roll(source: LegendarySource, x: number, y: number, z: number, chance = LEGENDARY_CHANCE[source]): string | null {
    const left = this.left(source);
    if (left.length === 0) return null;
    const seed = this.seed();
    if (!(hashFloat(seed ^ SALT, x, y, z) < chance)) return null;
    const item = left[hash32(seed ^ SALT, x, y, z) % left.length];
    this.claimed.add(item);
    return item;
  }

  /** The stack a place holds for a claimed legendary: full durability and its fixed enchants (src/content/loot.ts NAMED_FINDS). */
  static stackOf(item: string): ItemStack {
    return rollLoot(lootTableById(legendaryTableId(item)), () => 0.5)[0];
  }

  toJSON(): ClaimsSave {
    return { v: 1, claimed: [...this.claimed].sort() };
  }

  /** Loads a save: anything that is not a known legendary is ignored, a damaged save starts empty. */
  load(raw: unknown): void {
    this.claimed.clear();
    const r = raw as Partial<ClaimsSave> | null;
    if (!r || r.v !== 1 || !Array.isArray(r.claimed)) return;
    const known = new Set(LEGENDARIES.map((l) => l.item));
    for (const k of r.claimed) if (typeof k === 'string' && known.has(k)) this.claimed.add(k);
  }
}

const byWorld = new WeakMap<object, LegendaryClaims>();
/** The claims of a world (registered by `World`), or null for a stand-in world without them. */
export const legendaryClaimsOf = (world: IWorld): LegendaryClaims | null => byWorld.get(world) ?? null;
export const registerLegendaryClaims = (world: IWorld, claims: LegendaryClaims): void => void byWorld.set(world, claims);
