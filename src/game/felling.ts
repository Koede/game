/**
 * The chainsaw (docs/api/chainsaw.md): a handheld Current Age tool. Mine on a log with one in hand and the whole
 * connected trunk comes down, not just the block: the log under the crosshair and every log of the same kind joined
 * to it, face, edge or corner, from there UP, nearest first, at most `tool.fell.maxLogs`. Cutting costs fuel:
 * the stack's `durability` is its tank (see ToolSpec.fell), `fuelPerLog` per log, topped up from Fuel Canisters.
 * An empty saw (durability 1) counts as bare hands (mining.ts toolMatches). DOM-free.
 */
import { BAR_OIL_WEAR, LUBE_CANISTER, fuelGrade } from '../core/distill';
import { FLAG_FELLED_TREE } from '../core/constants';
import { itemOrNull } from '../core/registry';
import { AIR, WORLD_HEIGHT, type BlockDef, type IWorld, type ItemAmount, type Slot, type ToolSpec } from '../core/types';
import { rollDrops } from './mining';
import type { PlayerState } from './playerState';

/** Item that refuels a chainsaw. */
export const SAW_FUEL_ITEM = 'fuel_canister';
/** Logs of every kind a saw fells. */
export const LOG_BLOCKS: readonly string[] = ['oak_log', 'pine_log'];
/** Fewest logs a tree must lose for the 'felled a tree' flag (a stump and a stick do not count). */
export const TREE_MIN_LOGS = 3;

export const sawOf = (stack: Slot): ToolSpec | null => {
  const tool = stack ? itemOrNull(stack.item)?.tool ?? null : null;
  return tool?.fell ? tool : null;
};
export const isChainsaw = (stack: Slot): boolean => sawOf(stack) !== null;
export const isLog = (def: BlockDef): boolean => LOG_BLOCKS.includes(def.key);

/** Fuel units left in a saw stack (its durability above the 1 that means "empty"). */
export const sawFuel = (stack: Slot): number => (isChainsaw(stack) && stack?.durability !== undefined ? Math.max(0, stack.durability - 1) : 0);
/** Fuel a full tank holds. */
export const sawCapacity = (stack: Slot): number => Math.max(0, (sawOf(stack)?.durability ?? 1) - 1);

/** True when this stack, held, fells trees: a chainsaw with enough fuel to cut one log. */
export function canFell(stack: Slot): boolean {
  const saw = sawOf(stack);
  return saw !== null && sawFuel(stack) >= 1;
}

export interface LogCell {
  x: number;
  y: number;
  z: number;
}

/**
 * The logs a saw takes when started at (x, y, z): breadth-first through logs of the same kind (26 neighbours),
 * never below the start's height, at most `cap`, the start first. Unloaded chunks end the search.
 */
export function trunkAbove(world: IWorld, x: number, y: number, z: number, cap: number): LogCell[] {
  const start = world.getBlock(x, y, z);
  if (!isLog(start)) return [];
  const out: LogCell[] = [{ x, y, z }];
  const seen = new Set<string>([`${x},${y},${z}`]);
  for (let i = 0; i < out.length && out.length < cap; i++) {
    const c = out[i];
    for (let dy = 0; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          const nz = c.z + dz;
          if (ny < y || ny >= WORLD_HEIGHT || (dx === 0 && dy === 0 && dz === 0)) continue;
          const k = `${nx},${ny},${nz}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (!world.isLoaded(nx, nz) || world.getBlock(nx, ny, nz).key !== start.key) continue;
          out.push({ x: nx, y: ny, z: nz });
          if (out.length >= cap) return out;
        }
      }
    }
  }
  return out;
}

export interface FellResult {
  /** Logs removed (>= 1). */
  logs: number;
  /** The items dropped (ground items at the logs, which fly to the player when picked up). */
  drops: ItemAmount[];
  /** Fuel the cut used. */
  fuel: number;
  /** The tree was bigger than the cap or the fuel: logs of it still stand. */
  more: boolean;
}

/**
 * Fells with the held chainsaw at (x, y, z): removes the trunk (as 'player' edits), gives the drops, burns the fuel,
 * emits 'block:broken' per log, the sound and, for a real tree, the flag FLAG_FELLED_TREE. Returns null (changing
 * nothing) when no saw is held, it has no fuel, or the target is not a log.
 */
export function fellTree(world: IWorld, player: PlayerState, x: number, y: number, z: number, rng: () => number): FellResult | null {
  const held = player.heldStack();
  const saw = sawOf(held);
  if (player.dead || !saw || !held || !canFell(held)) return null;
  const target = world.getBlock(x, y, z);
  if (!isLog(target)) return null;
  const { maxLogs, fuelPerLog } = saw.fell!;
  // A lubricant canister in the pack is bar oil: the chain wears half as fast. The canister is not used up.
  const oiled = player.inventory.slots.some((s) => s !== null && s.item === LUBE_CANISTER && s.count > 0);
  const perLog = fuelPerLog * (oiled ? BAR_OIL_WEAR : 1);
  const affordable = Math.max(1, Math.floor(sawFuel(held) / perLog));
  const cells = trunkAbove(world, x, y, z, Math.min(maxLogs, affordable));
  const drops: ItemAmount[] = [];
  let logs = 0;
  // Top first, so nothing is ever left hanging mid-air for a frame; the start cell is last.
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    const voxel = world.getVoxel(c.x, c.y, c.z);
    if (!world.setVoxel(c.x, c.y, c.z, AIR, 'player')) continue;
    logs++;
    const rolled = rollDrops(target, rng);
    player.dropAll(rolled, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 });
    for (const d of rolled) {
      const known = drops.find((o) => o.item === d.item);
      if (known) known.count += d.count;
      else drops.push({ item: d.item, count: d.count });
    }
    player.bus.emit('block:broken', { x: c.x, y: c.y, z: c.z, voxel });
  }
  if (logs === 0) return null;
  const fuel = Math.min(sawFuel(held), logs * perLog);
  held.durability = Math.max(1, (held.durability ?? 1) - fuel);
  player.bus.emit('sfx', { name: 'saw_cut', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  if (logs >= 2) player.bus.emit('sfx', { name: 'tree_fall', x: x + 0.5, y: y + logs / 2, z: z + 0.5 });
  if (logs >= TREE_MIN_LOGS) player.bus.emit('flag', { flag: FLAG_FELLED_TREE });
  if (sawFuel(held) === 0) player.bus.emit('toast', { text: 'The chainsaw coughs and dies - out of fuel. Hold a Fuel Canister and press Use to refill it.', kind: 'info' });
  const more = logs >= Math.min(maxLogs, affordable);
  return { logs, drops, fuel, more };
}

export type RefuelOutcome = 'refuelled' | 'full' | 'no-saw' | 'no-fuel';

/** Whether an item fuels a chainsaw (src/core/distill.ts FUEL_GRADES: the Fuel Canister, gasoline, fuel ethanol). */
export const isSawFuel = (item: string): boolean => (fuelGrade(item)?.saw ?? 0) > 0;

/**
 * Use with a Fuel Canister in hand refuels a chainsaw carried anywhere in the pack: one canister adds
 * `canisterFuel`, never past the full tank (a canister is only used when it adds something). The distillery's fuels
 * count by their grade (gasoline 1.3 canisters' worth) and hand their empty container back.
 */
export function refuelChainsaw(player: PlayerState): RefuelOutcome {
  const held = player.heldStack();
  const grade = held ? fuelGrade(held.item) : null;
  if (!held || !grade || grade.saw <= 0) return 'no-fuel';
  let target: NonNullable<Slot> | null = null;
  for (const s of player.inventory.slots) {
    if (s && isChainsaw(s) && s.durability !== undefined && s.durability < (sawOf(s)?.durability ?? 0) && (!target || s.durability < (target.durability ?? 0))) target = s;
  }
  if (!target) {
    const any = player.inventory.slots.some((s) => isChainsaw(s));
    if (any) player.bus.emit('toast', { text: 'The chainsaw tank is already full', kind: 'info' });
    return any ? 'full' : 'no-saw';
  }
  const saw = sawOf(target)!;
  target.durability = Math.min(saw.durability, (target.durability ?? 1) + Math.round(saw.fell!.canisterFuel * grade.saw));
  player.consumeHeld(1);
  if (grade.empty) player.give(grade.empty, 1);
  player.bus.emit('sfx', { name: 'fuel_add' });
  player.bus.emit('toast', { text: `Chainsaw refuelled (${Math.round((sawFuel(target) / sawCapacity(target)) * 100)}%)`, kind: 'info' });
  return 'refuelled';
}
