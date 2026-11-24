/**
 * What enchantments DO (docs/plans/enchantments.md). Each effect is a small function that reads only `enchantLevel`, so
 * the single place a verb happens (src/player/interaction.ts for a broken block, src/app/state.ts for a mob's drops) calls
 * one helper and stays free of enchant rules. DOM-free; veins use the felling approach (breadth-first from the block hit).
 */
import { enchantLevel } from '../core/enchant';
import { blockId } from '../core/registry';
import { AIR, type BlockDef, type IWorld, type ItemAmount, makeVoxel, type Slot } from '../core/types';
import { smeltRecipeFor } from '../sim/furnace';
import { canHarvest } from './mining';
import type { PlayerState } from './playerState';

/** Blocks a Veinseeker breaks beyond the one hit, by level (index = level). */
export const VEIN_SIZE: readonly number[] = [0, 3, 6, 10];
/** Chance of one extra drop from a Bounty tool, by level (index = level). */
export const BOUNTY_CHANCE: readonly number[] = [0, 0.1, 0.2, 0.3];
/** Lightstep: seconds a trail cell stays lit, by level (index = level); 0 = no trail. */
export const TRAIL_S: readonly number[] = [0, 2.5, 4, 6];
/** Most trail cells lit at once (the oldest go first). */
export const TRAIL_CAP = 12;
/** Featherfall II: the fastest a gliding fall may go, m/s, and how long one glide may last in the air. */
export const GLIDE_FALL_SPEED = 3;
export const GLIDE_S = 1.5;

/** Featherfall (any level): falls cost no health while the enchanted tool is held. */
export const featherfallNegates = (held: Slot): boolean => enchantLevel(held, 'featherfall') >= 1;
/** Featherfall II: holding Jump in the air slows a descent to GLIDE_FALL_SPEED for up to GLIDE_S per airtime. */
export const glides = (held: Slot): boolean => enchantLevel(held, 'featherfall') >= 2;

/** Ember: what a broken block drops is smelted on the spot where a furnace recipe exists (ore to ingot, log to charcoal). */
export function emberSmelt(drops: ItemAmount[], held: Slot): ItemAmount[] {
  if (enchantLevel(held, 'ember') < 1) return drops;
  return drops.map((d) => {
    const r = smeltRecipeFor(d.item);
    if (!r || r.inputs.length !== 1 || r.inputs[0].count <= 0) return d;
    const count = Math.round((d.count * r.output.count) / r.inputs[0].count);
    return count > 0 ? { item: r.output.item, count } : d;
  });
}

/** Bounty: with its chance, one extra of the first drop. `bonus` says it happened (the glint). */
export function bountyDrops(drops: ItemAmount[], held: Slot, rng: () => number): { drops: ItemAmount[]; bonus: boolean } {
  const chance = BOUNTY_CHANCE[Math.min(enchantLevel(held, 'bounty'), BOUNTY_CHANCE.length - 1)] ?? 0;
  if (chance <= 0 || drops.length === 0 || rng() >= chance) return { drops, bonus: false };
  const first = drops[0];
  return { drops: [{ item: first.item, count: first.count + 1 }, ...drops.slice(1)], bonus: true };
}

/** Everything the held tool does to what it breaks: Ember smelts, then Bounty may add one. */
export function shapeDrops(drops: ItemAmount[], held: Slot, rng: () => number): { drops: ItemAmount[]; bonus: boolean } {
  if (drops.length === 0) return { drops, bonus: false };
  return bountyDrops(emberSmelt(drops, held), held, rng);
}

/**
 * Lightstep: a trail of Floating Light cells behind the player. Each cell the player stands in gets lit (where the cell
 * is open air), then goes out after its level's seconds. Owned by the physics controller, which steps it once a frame.
 */
export class LightTrail {
  private readonly cells: { x: number; y: number; z: number; left: number }[] = [];
  private last = '';

  constructor(private readonly world: IWorld) {}

  /** Ages the trail; lights the cell at `feet` when Lightstep is held and the player has moved into a new cell. */
  step(dt: number, feet: { x: number; y: number; z: number }, held: Slot): void {
    const level = enchantLevel(held, 'lightstep');
    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      c.left -= dt;
      if (c.left > 0) continue;
      this.cells.splice(i, 1);
      if (this.world.getBlock(c.x, c.y, c.z).key === 'magic_light') this.world.setVoxel(c.x, c.y, c.z, AIR, 'player');
    }
    if (level < 1) {
      this.last = '';
      return;
    }
    const x = Math.floor(feet.x);
    const y = Math.floor(feet.y);
    const z = Math.floor(feet.z);
    const k = `${x},${y},${z}`;
    if (k === this.last) return;
    this.last = k;
    if (this.cells.some((c) => c.x === x && c.y === y && c.z === z)) return;
    if (!this.world.isLoaded(x, z) || this.world.getBlock(x, y, z).key !== 'air') return;
    if (!this.world.setVoxel(x, y, z, makeVoxel(blockId('magic_light')), 'player')) return;
    this.cells.push({ x, y, z, left: TRAIL_S[Math.min(level, TRAIL_S.length - 1)] ?? 0 });
    while (this.cells.length > TRAIL_CAP) {
      const old = this.cells.shift()!;
      if (this.world.getBlock(old.x, old.y, old.z).key === 'magic_light') this.world.setVoxel(old.x, old.y, old.z, AIR, 'player');
    }
  }

  /** Cells currently lit (for tests and the debug view). */
  get lit(): number {
    return this.cells.length;
  }
}


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
    const shaped = shapeDrops(rollDrops(def, rng), held, rng);
    player.dropAll(shaped.drops, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, magnetRadius(held));
    if (shaped.bonus) player.bus.emit('sfx', { name: 'pickup', x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5, pitch: 1.6 });
    n++;
    player.bus.emit('block:broken', { x: c.x, y: c.y, z: c.z, voxel });
    if (player.wearHeld(def)) break;
  }
  if (n > 0) player.bus.emit('sfx', { name: 'break', x: cells[0].x + 0.5, y: cells[0].y + 0.5, z: cells[0].z + 0.5 });
  return n;
}
