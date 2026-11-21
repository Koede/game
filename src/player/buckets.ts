/**
 * Buckets (spec 13, 18.3): the wooden bucket takes a water SOURCE block - the ray looks through flowing water for
 * one, and the source goes (a hole in a lake fills again from its neighbours; a lone source is gone) - and a water
 * bucket pours a source into air, a washable plant or flowing water; the bronze bucket scoops LAVA (the block goes)
 * and a lava bucket pours it back and returns the bronze bucket. A wooden bucket refuses lava, a bronze one is kept
 * for lava, and nothing scoops crude oil (a pump draws it). DOM-free: talks to the world, the player and the bus
 * through its host.
 */
import type { GameBus } from '../core/context';
import type { SfxName } from '../core/gameEvents';
import { block as blockByKey, itemOrNull } from '../core/registry';
import { AIR, WORLD_HEIGHT, makeVoxel, type IWorld } from '../core/types';
import { placementCell, type PlayerState } from '../game';
import { WASHABLE, WATER_SOURCE, isFlowingWater, isLiquidSource } from '../world/water';
import type { RayHit } from './raycast';

/** What the buckets need from the Interaction that owns them. */
export interface BucketHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  /** Seconds before the next placement may happen. */
  readonly placeCooldown: number;
  /** Pouring counts as placing: starts the placement repeat delay. */
  placed(): void;
  advise(key: string, text: string): void;
  /** A loaded, in-world, replaceable cell. */
  placeableCell(x: number, y: number, z: number): boolean;
  /** The player's body overlaps the cell (lava is never poured onto the player). */
  bodyIn(x: number, y: number, z: number): boolean;
  /** One world edit was made (the controller re-casts its ray). */
  edited(): void;
  swing(): void;
}

/** Item keys of every bucket, empty or full. */
export const BUCKETS: ReadonlySet<string> = new Set(['pail', 'water_pail', 'bronze_bucket', 'lava_bucket']);
/** Empty buckets: while one is held the ray stops at liquid sources (through flowing water), so they can be filled. */
export const SCOOPING_BUCKETS: ReadonlySet<string> = new Set(['pail', 'bronze_bucket']);

export const BUCKET_HINTS = {
  hotWood: 'That would burn straight through a wooden bucket - a bronze bucket can carry lava',
  bronzeWater: 'A bronze bucket is kept for lava - use a wooden bucket for water',
  oil: 'Too thick for a bucket - a pump draws oil',
  pourOnSelf: 'Step back before pouring lava',
  flowing: 'No still water in reach - a bucket takes a source block, not flowing water',
} as const;

export type BucketOutcome = 'pail' | 'refused' | 'none';

export class Buckets {
  constructor(private readonly host: BucketHost) {}

  /** Use with a bucket in hand on the hit; null when the held item is not a bucket. */
  use(item: string, hit: RayHit): BucketOutcome | null {
    switch (item) {
      case 'pail':
        return this.scoop(hit, 'water', 'water_pail', 'splash');
      case 'bronze_bucket':
        return this.scoop(hit, 'lava', 'lava_bucket', 'scoop_lava');
      case 'water_pail':
        return this.pour(hit, 'water', 'pail', 'splash');
      case 'lava_bucket':
        return this.pour(hit, 'lava', 'bronze_bucket', 'scoop_lava');
      default:
        return null;
    }
  }

  private scoop(hit: RayHit, liquid: 'water' | 'lava', full: string, sfx: SfxName): BucketOutcome {
    const h = this.host;
    const found = hit.block.liquid;
    if (found === null || !isLiquidSource(hit.voxel)) {
      // Aimed through (or at) flowing water and no source behind it.
      if (liquid === 'water' && (hit.throughFlow === true || found === 'water')) {
        h.advise('bucket:flowing', BUCKET_HINTS.flowing);
        return 'refused';
      }
      return 'none';
    }
    if (found !== liquid) {
      if (found === 'oil') h.advise('bucket:oil', BUCKET_HINTS.oil);
      else if (found === 'lava') h.advise('bucket:hot', BUCKET_HINTS.hotWood);
      else h.advise('bucket:bronze', BUCKET_HINTS.bronzeWater);
      return 'refused';
    }
    // The source goes: the water around it reacts (a hole in a lake fills again, a lone source is gone).
    if (!h.world.setVoxel(hit.x, hit.y, hit.z, AIR, 'player')) return 'refused';
    h.edited();
    this.swapHeld(full);
    h.bus.emit('sfx', { name: sfx, x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    h.swing();
    return 'pail';
  }

  private pour(hit: RayHit, liquid: 'water' | 'lava', empty: string, sfx: SfxName): BucketOutcome {
    const h = this.host;
    if (h.placeCooldown > 0 || hit.block.liquid !== null) return 'none';
    // A water source goes into a washable plant's own cell (washing it away), else where a block would go.
    const { x, y, z } = liquid === 'water' && WASHABLE[hit.block.id] === 1 ? hit : placementCell(hit);
    if (!this.pourable(liquid, x, y, z)) return 'refused';
    if (liquid === 'lava' && h.bodyIn(x, y, z)) {
      h.advise('bucket:self', BUCKET_HINTS.pourOnSelf);
      return 'refused';
    }
    const voxel = liquid === 'water' ? WATER_SOURCE : makeVoxel(blockByKey(liquid).id);
    if (!h.world.setVoxel(x, y, z, voxel, 'player')) return 'refused';
    h.edited();
    this.swapHeld(empty);
    h.placed();
    h.bus.emit('block:placed', { x, y, z, voxel });
    h.bus.emit('sfx', { name: sfx, x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    h.swing();
    return 'pail';
  }

  /** Water goes into air, a washable plant or flowing water (spec 18.3); lava into a replaceable cell with no liquid. */
  private pourable(liquid: 'water' | 'lava', x: number, y: number, z: number): boolean {
    const h = this.host;
    if (y < 0 || y >= WORLD_HEIGHT || !h.world.isLoaded(x, z)) return false;
    const v = h.world.getVoxel(x, y, z);
    if (liquid === 'water' && (WASHABLE[h.world.getBlock(x, y, z).id] === 1 || isFlowingWater(v))) return true;
    return h.placeableCell(x, y, z) && h.world.getBlock(x, y, z).liquid === null;
  }

  private swapHeld(item: string): void {
    swapHeldItem(this.host.player, item);
  }
}

/** Replaces one of the held item (a bucket) with `item` in the same slot (or the pack when the slot still holds more). */
export function swapHeldItem(player: PlayerState, item: string): void {
  if (!itemOrNull(item)) return;
  const inv = player.inventory;
  const slot = player.selectedSlot;
  inv.batch(() => {
    inv.removeAt(slot, 1);
    if (inv.get(slot) === null) inv.set(slot, { item, count: 1 });
    else player.give(item, 1);
  });
}
