/**
 * "What next" nudge (docs/api/assist.md): turns the current goal into one short hint and, where the world holds the thing needed
 * (an ore, a station), a target the HUD arrow can point at. On demand only: nothing here runs unless the player asks.
 * The recipe walk follows the first missing ingredient down to something that can be mined, or a station that can make it.
 */
import { BLOCKS, FURNACE_TIERS, block, blockOf, itemOrNull, recipesFor } from '../core/registry';
import { voxelId, type IWorld, type ObjectiveCondition, type ObjectiveSpec, type RecipeDef } from '../core/types';
import { itemOfBlock } from './buildTools';
import type { PlayerState } from './playerState';

export type NudgeTarget =
  /** The nearest block with one of these keys. */
  | { kind: 'blocks'; keys: string[] }
  /** A fixed spot (the home furnace). */
  | { kind: 'pos'; x: number; y: number; z: number };

export interface Nudge {
  /** One short line: "Mine Coal Seam for 3 more Coal". */
  text: string;
  /** Where to point the arrow, or null when the step is not somewhere in the world (craft by hand, place a block). */
  target: NudgeTarget | null;
}

/** Furnace block keys (every tier). */
const FURNACE_BLOCKS = FURNACE_TIERS.map((t) => t.block);
const STATION_BLOCKS: Record<string, string[]> = { workbench: ['workbench'], furnace: FURNACE_BLOCKS };
const STATION_NAME: Record<string, string> = { hand: 'by hand', workbench: 'at a Workbench', furnace: 'at a furnace' };
const MAX_DEPTH = 6;

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

let minedBy: Map<string, string[]> | null = null;
/** Block keys whose breaking can yield an item (ores, logs...). */
function blocksDropping(item: string): string[] {
  if (!minedBy) {
    minedBy = new Map();
    for (const b of BLOCKS) {
      if (!Array.isArray(b.drops)) continue;
      for (const d of b.drops) {
        const list = minedBy.get(d.item) ?? [];
        if (!list.includes(b.key)) list.push(b.key);
        minedBy.set(d.item, list);
      }
    }
  }
  return minedBy.get(item) ?? [];
}

/** The recipe to follow for an item: a hand, workbench or furnace one, the first authored. */
function recipeToFollow(item: string): RecipeDef | null {
  const list = recipesFor(item);
  for (const station of ['hand', 'workbench', 'furnace']) {
    const r = list.find((x) => x.station === station);
    if (r) return r;
  }
  // A hand station (chopping block, quern...): the station is a block of that key. Machines that run on their own are left out.
  return list.find((x) => BLOCKS.some((b) => b.key === x.station)) ?? null;
}

/**
 * The next step towards having `need` of `item`. `force`: craft even when the pack already holds enough (a "make" goal counts
 * what was made, not what is held).
 */
function planItem(player: PlayerState, item: string, need: number, force: boolean, seen: Set<string>, depth: number): Nudge {
  const have = player.inventory.count(item);
  if (!force && have >= need) return { text: `You have ${nameOf(item)}`, target: null };
  const missingCount = force ? need : need - have;
  const recipe = depth < MAX_DEPTH && !seen.has(item) ? recipeToFollow(item) : null;
  if (recipe) {
    seen.add(item);
    const times = Math.ceil(missingCount / Math.max(1, recipe.output.count));
    for (const input of recipe.inputs) {
      const want = input.count * times;
      if (player.inventory.count(input.item) < want) return planItem(player, input.item, want, false, seen, depth + 1);
    }
    const station = recipe.station;
    const keys = STATION_BLOCKS[station] ?? (BLOCKS.some((b) => b.key === station) ? [station] : null);
    const where = STATION_NAME[station] ?? `at the ${BLOCKS.find((b) => b.key === station)?.name ?? station}`;
    return { text: `Make ${nameOf(item)} ${where}`, target: keys ? { kind: 'blocks', keys } : null };
  }
  const sources = blocksDropping(item);
  if (sources.length > 0) {
    return { text: `Mine ${block(sources[0]).name} for ${missingCount} more ${nameOf(item)}`, target: { kind: 'blocks', keys: sources } };
  }
  return { text: `Find ${missingCount} ${nameOf(item)}`, target: null };
}

function planCondition(player: PlayerState, c: ObjectiveCondition, title: string): Nudge | null {
  switch (c.type) {
    case 'have':
      return planItem(player, c.item, c.count ?? 1, false, new Set(), 0);
    case 'make': {
      const left = (c.count ?? 1) - (player.stats.made[c.item] ?? 0);
      return planItem(player, c.item, Math.max(1, left), true, new Set(), 0);
    }
    case 'place': {
      const item = itemOfBlock(c.block);
      if (!item) return { text: title, target: null };
      if (player.inventory.count(item) > 0) return { text: `Place ${nameOf(item)} (it is in your pack)`, target: null };
      return planItem(player, item, 1, false, new Set(), 0);
    }
    case 'break':
      return { text: `Break ${block(c.block).name}`, target: { kind: 'blocks', keys: [c.block] } };
    case 'furnaceTier':
    case 'furnaceTemp': {
      const home = player.home;
      const text = c.type === 'furnaceTier' ? 'Upgrade your furnace' : 'Get your furnace hotter';
      return { text, target: home ? { kind: 'pos', x: home.x, y: home.y, z: home.z } : { kind: 'blocks', keys: FURNACE_BLOCKS } };
    }
    case 'any':
      for (const sub of c.of) {
        if (sub.type === 'flag') continue;
        const n = planCondition(player, sub, title);
        if (n) return n;
      }
      return null;
    default:
      return null;
  }
}

/** The town's open build bounties and where the player stands to use Gruk's board (NpcManager.boardGuide). */
export interface BoardGuide {
  bounties: readonly { item: string; left: number; text: string }[];
  at: { x: number; y: number; z: number };
}

let boardGuide: (() => BoardGuide | null) | null = null;

/** Registers where the build board's guide comes from (the game wires the NPC manager in; null unhooks it). */
export function setBoardGuide(fn: (() => BoardGuide | null) | null): void {
  boardGuide = fn;
}

/** The nudge for the build board: "Gruk's build board wants ...", with the arrow on the board's front. */
export function boardNudge(guide: BoardGuide): Nudge {
  return { text: `Gruk's build board (storage bay) wants ${guide.bounties[0].text}`, target: { kind: 'pos', ...guide.at } };
}

/**
 * The hint for a goal; null when everything is done. Goals the planner does not understand fall back to their own title. While a
 * build bounty is open (`board`, by default the registered guide), "What next?" points at the board: when the pack holds something a
 * bounty asks for, or every goal is done (the board's line alone), or the goal's step has no place in the world to point at (the
 * goal's line, then the board's). A goal with a place to point at keeps the arrow.
 */
export function nudgeFor(player: PlayerState, objective: ObjectiveSpec | null, board: BoardGuide | null = boardGuide?.() ?? null): Nudge | null {
  const goal = objective ? (planCondition(player, objective.condition, objective.title) ?? { text: objective.title, target: null }) : null;
  if (!board || board.bounties.length === 0) return goal;
  const carried = board.bounties.find((b) => player.inventory.count(b.item) > 0);
  if (carried) return boardNudge({ ...board, bounties: [carried] });
  if (!goal) return boardNudge(board);
  // A step with no place to point at (craft by hand, place a block) keeps its text, and the arrow shows the way to the board.
  if (!goal.target) return { text: `${goal.text}. Then: ${boardNudge(board).text}`, target: boardNudge(board).target };
  return goal;
}

export interface Found {
  x: number;
  y: number;
  z: number;
  distance: number;
}

/**
 * The nearest block with one of the keys within a box around `from` (default 24 across, 20 up and down), by straight distance;
 * null when none is loaded in reach. A scan of a few ten thousand cells: ask on demand, not every frame.
 */
export function findNearestBlock(
  world: IWorld,
  from: { x: number; y: number; z: number },
  keys: readonly string[],
  radius = 24,
  vertical = 20,
): Found | null {
  const ids = new Set<number>();
  for (const k of keys) ids.add(block(k).id);
  const cx = Math.floor(from.x);
  const cy = Math.floor(from.y);
  const cz = Math.floor(from.z);
  let best: Found | null = null;
  let bestD2 = Infinity;
  for (let y = Math.max(0, cy - vertical); y <= cy + vertical; y++) {
    for (let z = cz - radius; z <= cz + radius; z++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 >= bestD2) continue;
        if (!ids.has(voxelId(world.getVoxel(x, y, z)))) continue;
        bestD2 = d2;
        best = { x, y, z, distance: 0 };
      }
    }
  }
  if (best) best.distance = Math.sqrt(bestD2);
  return best;
}

/** Whether the voxel at a found spot is still one of the keys (the arrow drops a target that was mined). */
export function stillThere(world: IWorld, at: { x: number; y: number; z: number }, keys: readonly string[]): boolean {
  return keys.includes(blockOf(world.getVoxel(at.x, at.y, at.z)).key);
}
