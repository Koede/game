/**
 * What the tractor's attachments do (docs/api/tractor.md), over the existing farming rules (src/game/farming.ts) and
 * crop blocks (src/sim/crops.ts grows them; here a ripe one is simply broken, as by hand):
 *
 * - **Tiller**: every grass or dirt cell in the swath (under and ahead of the machine, three blocks wide) becomes
 *   farmland (`canTill` / `tillResult`); loose plants standing on it (tall grass, flowers) are cleared first.
 * - **Harvester**: every RIPE crop in the swath is cut: its drops go to the pack (what does not fit lands on the ground),
 *   and one seed of the harvest is put back so the field keeps growing; young crops are left alone.
 *
 * One call works the swath once; the manager repeats it while the work control is held. DOM-free.
 */
import type { GameBus } from '../core/context';
import { block } from '../core/registry';
import { AIR, Face, WORLD_HEIGHT, makeVoxel, type IWorld, type ItemAmount } from '../core/types';
import { canTill, cropStage, isRipeCrop, rollDrops, tillResult, type PlayerState } from '../game';
import { forward, right, type Tractor } from './tractor';

/** The swath: from this far behind the centre to this far ahead of it, and this far to each side (blocks). */
export const SWATH_BACK = 0.5;
export const SWATH_AHEAD = 2.5;
export const SWATH_SIDE = 1.5;
/** Seconds between two passes while the work control stays held. */
export const WORK_INTERVAL_S = 0.4;

export interface WorkContext {
  world: IWorld;
  bus: GameBus;
  player: PlayerState;
  rng: () => number;
}

export interface Cell {
  x: number;
  z: number;
}

/** The distinct columns under the swath, nearest the machine first. */
export function swathCells(t: Tractor): Cell[] {
  const f = forward(t.yaw);
  const r = right(t.yaw);
  const seen = new Set<number>();
  const out: Cell[] = [];
  for (let d = -SWATH_BACK; d <= SWATH_AHEAD + 1e-6; d += 0.5) {
    for (let w = -SWATH_SIDE; w <= SWATH_SIDE + 1e-6; w += 0.5) {
      const x = Math.floor(t.x + f.x * d + r.x * w);
      const z = Math.floor(t.z + f.z * d + r.z * w);
      const k = x * 65536 + z;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x, z });
    }
  }
  return out;
}

/** The y of the ground block of a column at the tractor's level: the first solid cell at or below one above its feet. */
export function groundY(world: IWorld, t: Tractor, x: number, z: number): number | null {
  const top = Math.min(WORLD_HEIGHT - 1, Math.floor(t.y + 1e-3) + 1);
  for (let y = top; y >= Math.max(0, top - 3); y--) {
    const def = world.getBlock(x, y, z);
    if (def.solid && !def.replaceable) return y;
  }
  return null;
}

export interface WorkResult {
  /** Cells tilled / ripe crops cut. */
  count: number;
  /** Items collected (harvester). */
  items: ItemAmount[];
}

/** A plant on the ground cell the tiller may clear: replaceable, not a liquid, nothing that grows on farmland. */
function clearable(def: ReturnType<IWorld['getBlock']>): boolean {
  return def.replaceable && def.liquid === null && def.key !== 'air' && cropStage(def) === null;
}

export function tillSwath(ctx: WorkContext, t: Tractor): WorkResult {
  const { world, player } = ctx;
  let count = 0;
  for (const c of swathCells(t)) {
    if (!world.isLoaded(c.x, c.z)) continue;
    const y = groundY(world, t, c.x, c.z);
    if (y === null) continue;
    const ground = world.getBlock(c.x, y, c.z);
    if (tillResult(ground) === null) continue;
    const above = world.getBlock(c.x, y + 1, c.z);
    if (above.key !== 'air') {
      if (!clearable(above)) continue;
      player.dropAll(rollDrops(above, ctx.rng), { x: c.x + 0.5, y: y + 1.2, z: c.z + 0.5 });
      world.setVoxel(c.x, y + 1, c.z, AIR, 'player');
    }
    if (!canTill(world, c.x, y, c.z, Face.PY)) continue;
    if (world.setVoxel(c.x, y, c.z, makeVoxel(tillResult(ground)!.id), 'player')) count++;
  }
  if (count > 0) {
    ctx.bus.emit('flag', { flag: 'tilled' });
    ctx.bus.emit('sfx', { name: 'till', x: t.x, y: t.y + 0.5, z: t.z });
  }
  return { count, items: [] };
}

export function harvestSwath(ctx: WorkContext, t: Tractor): WorkResult {
  const { world, player } = ctx;
  const items: ItemAmount[] = [];
  let count = 0;
  for (const c of swathCells(t)) {
    if (!world.isLoaded(c.x, c.z)) continue;
    const top = Math.min(WORLD_HEIGHT - 1, Math.floor(t.y + 1e-3) + 2);
    for (let y = top; y >= Math.max(1, top - 4); y--) {
      const voxel = world.getVoxel(c.x, y, c.z);
      const def = world.getBlock(c.x, y, c.z);
      if (!isRipeCrop(def)) continue;
      const drops = rollDrops(def, ctx.rng);
      // One seed of the harvest goes back into the furrow (the stage-0 block's own drop is the seed item).
      const crop = cropStage(def)!.crop;
      const young = block(`${crop}_0`);
      const seed = Array.isArray(young.drops) && young.drops.length > 0 ? young.drops[0].item : null;
      const sown = drops.find((d) => d.item === seed && d.count > 0);
      if (sown) sown.count--;
      if (!world.setVoxel(c.x, y, c.z, sown ? makeVoxel(young.id) : AIR, 'player')) continue;
      count++;
      for (const d of drops) {
        if (d.count <= 0) continue;
        const left = player.give(d.item, d.count);
        if (left > 0) player.drop(d.item, left, undefined, { x: t.x, y: t.y + 1, z: t.z });
        const known = items.find((o) => o.item === d.item);
        if (known) known.count += d.count;
        else items.push({ item: d.item, count: d.count });
      }
      ctx.bus.emit('block:broken', { x: c.x, y, z: c.z, voxel });
      break;
    }
  }
  if (count > 0) ctx.bus.emit('sfx', { name: 'harvest', x: t.x, y: t.y + 0.5, z: t.z });
  return { count, items };
}

/** Works the swath with whatever is fitted; 0 results when nothing is. */
export function workSwath(ctx: WorkContext, t: Tractor): WorkResult {
  if (t.attachment === 'tiller') return tillSwath(ctx, t);
  if (t.attachment === 'harvester') return harvestSwath(ctx, t);
  return { count: 0, items: [] };
}
