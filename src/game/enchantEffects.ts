/**
 * What enchantments DO (docs/plans/enchantments.md). Each effect is a small function that reads only `enchantLevel`, so
 * the single place a verb happens (src/player/interaction.ts for a broken block, src/app/state.ts for a mob's drops) calls
 * one helper and stays free of enchant rules. DOM-free; veins use the felling approach (breadth-first from the block hit).
 */
import { enchantLevel } from '../core/enchant';
import { AIR, type BlockDef, type IWorld, type ItemAmount, type Slot } from '../core/types';
import { canHarvest } from './mining';
import type { PlayerState } from './playerState';

/** Blocks a Veinseeker breaks beyond the one hit, by level (index = level). */
export const VEIN_SIZE: readonly number[] = [0, 3, 6, 10];
/** Blocks around the player a Magnet tool's drops fly in from, by level. */
export const MAGNET_RADIUS: readonly number[] = [0, 3, 5, 7];

export const veinSize = (held: Slot): number => VEIN_SIZE[Math.min(enchantLevel(held, 'veinseeker'), VEIN_SIZE.length - 1)] ?? 0;
/** Pull radius the held tool gives the drops it causes (0 = none). */
export const magnetRadius = (held: Slot): number => MAGNET_RADIUS[Math.min(enchantLevel(held, 'magnet'), MAGNET_RADIUS.length - 1)] ?? 0;

/** Ore blocks are the ones named `*_ore`. */
export const isOreKey = (key: string): boolean => key.endsWith('_ore');

export interface VeinCell {
  x: number;
  y: number;
  z: number;
}

/**
 * The ore blocks a vein takes beyond (x, y, z): breadth-first through blocks of the SAME kind (26 neighbours), nearest first,
 * at most `cap`. Only cells `held` could harvest count (never past the tool's tier). Unloaded chunks end the search.
 */
export function veinCells(world: IWorld, held: Slot, x: number, y: number, z: number, cap: number): VeinCell[] {
  const start = world.getBlock(x, y, z);
  if (cap <= 0 || !isOreKey(start.key) || !canHarvest(start, held)) return [];
  const out: VeinCell[] = [];
  const queue: VeinCell[] = [{ x, y, z }];
  const seen = new Set<string>([`${x},${y},${z}`]);
  for (let i = 0; i < queue.length && out.length < cap; i++) {
    const c = queue[i];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          const nz = c.z + dz;
          const k = `${nx},${ny},${nz}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (!world.isLoaded(nx, nz) || world.getBlock(nx, ny, nz).key !== start.key) continue;
          queue.push({ x: nx, y: ny, z: nz });
          out.push({ x: nx, y: ny, z: nz });
          if (out.length >= cap) return out;
        }
      }
    }
  }
  return out;
}

/**
 * Veinseeker, planned BEFORE the block at (x, y, z) is broken (the origin must still be there to read its kind): the extra
 * cells, capped by the level's size and by the tool's durability (a vein never wears the tool out: it keeps 1 use).
 */
export function planVein(world: IWorld, player: PlayerState, x: number, y: number, z: number): VeinCell[] {
  const held = player.heldStack();
  let cap = veinSize(held);
  if (cap <= 0 || !held) return [];
  if (!player.dev && held.durability !== undefined) cap = Math.min(cap, Math.max(0, held.durability - 2));
  return veinCells(world, held, x, y, z, cap);
}

/**
 * Breaks a planned vein as the player: each cell drops what a normal break drops (flying in if the tool also has Magnet),
 * costs one durability, emits 'block:broken'. Returns how many blocks went. Stops if the tool breaks.
 */
export function breakVein(
  world: IWorld,
  player: PlayerState,
  cells: readonly VeinCell[],
  rng: () => number,
  rollDrops: (def: BlockDef, rng: () => number) => ItemAmount[],
): number {
  let n = 0;
  for (const c of cells) {
    const held = player.heldStack();
    if (!held) break;
    const def = world.getBlock(c.x, c.y, c.z);
    if (!canHarvest(def, held)) continue;
    const voxel = world.getVoxel(c.x, c.y, c.z);
    if (!world.setVoxel(c.x, c.y, c.z, AIR, 'player')) continue;
    player.dropAll(rollDrops(def, rng), { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, magnetRadius(held));
    n++;
    player.bus.emit('block:broken', { x: c.x, y: c.y, z: c.z, voxel });
    if (player.wearHeld(def)) break;
  }
  if (n > 0) player.bus.emit('sfx', { name: 'break', x: cells[0].x + 0.5, y: cells[0].y + 0.5, z: cells[0].z + 0.5 });
  return n;
}
