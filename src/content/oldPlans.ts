/**
 * Old plans (docs/api/old-plans.md): drawings left by the people of the Old Works, found in ruin crates and in the structures
 * of their age. Use one to read it and the plan joins the player's collection; each is a small build a Blueprint
 * (src/game/blueprint.ts) can raise, so the blueprint screen and builder automatons can use it. Pure data: no registry import.
 *
 * A layout is `layers[y][z]` (floor first), each row a string along x; '.' is air and every other letter is a key of `legend`.
 * Every legend block is a block with an item of the same key (captureBlueprint skips the rest). Optional: nothing needs a plan.
 */

export type PlanTier = 'near' | 'deep';

export interface OldPlanSpec {
  id: string;
  /** The loot item that carries the plan. */
  item: string;
  title: string;
  /** What the drawing shows, one or two sentences. */
  text: string;
  /** 'near' plans turn up in the surface ruins and houses, 'deep' ones in the far and buried ruins and the old factory. */
  tier: PlanTier;
  /** Texture tint of the item icon. */
  tint: number;
  legend: Readonly<Record<string, string>>;
  layers: readonly (readonly string[])[];
}

const S = 'stone_brick';

export const OLD_PLANS: readonly OldPlanSpec[] = [
  {
    id: 'kiln_house', item: 'plan_kiln_house', title: 'Plan of a Kiln House', tier: 'near', tint: 0xc9895a,
    text: 'A squat brick hut with one door, a window and a flat plank roof, drawn with the kiln in the middle of the floor.',
    legend: { S, B: 'brick', G: 'glass', P: 'plank', T: 'torch' },
    layers: [
      ['SSSSS', 'SSSSS', 'SSSSS', 'SSSSS', 'SSSSS'],
      ['BB.BB', 'B...B', 'B...B', 'BT..B', 'BBGBB'],
      ['BB.BB', 'B...B', 'B...B', 'B...B', 'BBGBB'],
      ['PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP'],
    ],
  },
  {
    id: 'cistern', item: 'plan_cistern', title: 'Plan of a Settling Cistern', tier: 'near', tint: 0x6f9bb8,
    text: 'A walled stone basin sunk to the knee with a lip of mossy brick: the old people let their water stand and clear before use.',
    legend: { S, M: 'mossy_stone_brick' },
    layers: [
      ['SSSSS', 'SSSSS', 'SSSSS', 'SSSSS', 'SSSSS'],
      ['MMMMM', 'M...M', 'M...M', 'M...M', 'MMMMM'],
      ['S...S', '.....', '.....', '.....', 'S...S'],
    ],
  },
  {
    id: 'foundry_hall', item: 'plan_foundry_hall', title: 'Plan of a Foundry Hall', tier: 'deep', tint: 0xb04a2a,
    text: 'A long stone hall with high windows and torch brackets down both walls; the floor is bare so the heavy work can be dragged in.',
    legend: { S, B: 'brick', G: 'glass', T: 'torch', O: 'stone' },
    layers: [
      ['SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS'],
      ['BBB.BBB', 'B.....B', 'BT...TB', 'B.....B', 'BBBBBBB'],
      ['BGBBBGB', 'B.....B', 'B.....B', 'B.....B', 'BGBBBGB'],
      ['BBBBBBB', 'B.....B', 'B.....B', 'B.....B', 'BBBBBBB'],
      ['OOOOOOO', 'OOOOOOO', 'OOOOOOO', 'OOOOOOO', 'OOOOOOO'],
    ],
  },
  {
    id: 'lookout', item: 'plan_lookout', title: 'Plan of a Lookout Stack', tier: 'deep', tint: 0x7d7aa8,
    text: 'A narrow brick tower on a stone footing with a torch at the top, so the watch could see the furnace smoke of the next valley.',
    legend: { S, B: 'brick', T: 'torch' },
    layers: [
      ['SSS', 'SSS', 'SSS'],
      ['BBB', 'B.B', 'BBB'],
      ['BBB', 'B.B', 'BBB'],
      ['BBB', 'B.B', 'BBB'],
      ['BBB', 'B.B', 'BBB'],
      ['SSS', 'SSS', 'SSS'],
      ['...', '.T.', '...'],
    ],
  },
];

export const planById = (id: string): OldPlanSpec | null => OLD_PLANS.find((p) => p.id === id) ?? null;
export const planOfItem = (item: string | null | undefined): OldPlanSpec | null => OLD_PLANS.find((p) => p.item === item) ?? null;

/** Structure keys (src/content/lootStructures.ts) whose crates may hold a plan, and the tier of plan each draws from. */
export const PLAN_STRUCTURES: Readonly<Record<string, PlanTier>> = { old_home: 'near', chem_lab: 'near', old_factory: 'deep', lumber_mill: 'near' };

/** Chance that a ruin crate or old-age structure crate holds a plan at all, by tier. */
export const PLAN_CHANCE: Readonly<Record<PlanTier, number>> = { near: 0.3, deep: 0.5 };

/**
 * Which plan (an item key) a crate holds, or null. Pure in `h`, a 32-bit hash of the crate's seed and position, so the same
 * world always puts the same plan in the same crate; it never touches the crate's ordinary loot roll.
 */
export function planForCrate(h: number, tier: PlanTier): string | null {
  if ((h >>> 0) / 4294967296 >= PLAN_CHANCE[tier]) return null;
  const pool = OLD_PLANS.filter((p) => p.tier === tier);
  return pool[((h >>> 0) >>> 8) % pool.length].item;
}
