/**
 * Build tools (docs/api/assist.md): undo for the last placements and a small copy-paste. Undo takes a block you placed back out
 * (the item returns to the pack) exactly as breaking would, so machines spill their contents the usual way. Copy-paste takes two
 * corners (at most 8 x 8 x 8), keeps every block that has an item, and pastes them with the clip's low corner at a chosen cell,
 * spending one item per block from the pack (free in Dev Mode). Pure rules over IWorld; the HUD chip is src/ui/hud/buildChip.ts.
 */
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/constants';
import type { GameBus } from '../core/context';
import { ITEMS, blockOf, itemOrNull } from '../core/registry';
import { AIR, WORLD_HEIGHT, voxelId, withActive, type IWorld, type Voxel } from '../core/types';
import type { PlayerState } from './playerState';

export const UNDO_LIMIT = 10;
export const CLIP_MAX = 8;

interface Placed {
  x: number;
  y: number;
  z: number;
  voxel: Voxel;
  item: string;
  refund: boolean;
}

export interface ClipBlock {
  dx: number;
  dy: number;
  dz: number;
  voxel: Voxel;
  item: string;
}

export interface Clip {
  size: { x: number; y: number; z: number };
  blocks: ClipBlock[];
}

export interface BuildResult {
  ok: boolean;
  text: string;
}

let itemByBlock: Map<string, string> | null = null;
/** The item that places a block (the first one naming it), or null for blocks no item makes (water, crops). */
export function itemOfBlock(blockKey: string): string | null {
  if (!itemByBlock) {
    itemByBlock = new Map();
    for (const it of ITEMS) if (it.block && !itemByBlock.has(it.block)) itemByBlock.set(it.block, it.key);
  }
  return itemByBlock.get(blockKey) ?? null;
}

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

export class BuildTools {
  private readonly log: Placed[] = [];
  private cornerA: { x: number; y: number; z: number } | null = null;
  private clipValue: Clip | null = null;
  private pasting = false;
  private readonly off: () => void;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    bus: GameBus,
  ) {
    this.off = bus.on('block:placed', (e) => this.record(e.x, e.y, e.z, e.voxel));
  }

  dispose(): void {
    this.off();
  }

  /** How many placements can be undone (at most UNDO_LIMIT). */
  get undoCount(): number {
    return this.log.length;
  }

  get clip(): Clip | null {
    return this.clipValue;
  }

  /** The first corner marked, while the second is awaited. */
  get pendingCorner(): { x: number; y: number; z: number } | null {
    return this.cornerA;
  }

  private record(x: number, y: number, z: number, voxel: Voxel): void {
    if (this.pasting) return;
    const def = blockOf(voxel);
    if (def.liquid !== null) return;
    const item = itemOfBlock(def.key);
    if (!item) return;
    this.log.push({ x, y, z, voxel, item, refund: !(this.player.dev && this.player.devFreePlace) });
    if (this.log.length > UNDO_LIMIT) this.log.shift();
  }

  /** Takes the most recent placement back out. Placements since changed or removed are skipped. */
  undo(): BuildResult {
    let skipped = 0;
    while (this.log.length > 0) {
      const p = this.log.pop() as Placed;
      if (voxelId(this.world.getVoxel(p.x, p.y, p.z)) !== voxelId(p.voxel)) {
        skipped++;
        continue;
      }
      if (!this.world.setVoxel(p.x, p.y, p.z, AIR, 'player')) {
        skipped++;
        continue;
      }
      if (p.refund) {
        const left = this.player.inventory.add(p.item, 1);
        if (left > 0) this.player.drop(p.item, left, undefined, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
      }
      this.player.bus.emit('sfx', { name: 'break', x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5, volume: 0.5 });
      return { ok: true, text: `Undid ${nameOf(p.item)}${this.log.length > 0 ? ` (${this.log.length} more)` : ''}` };
    }
    return { ok: false, text: skipped > 0 ? 'Those blocks are already gone' : 'Nothing to undo' };
  }

  /** Marks a copy corner: the first call starts, the second copies the box between them (or says why it cannot). */
  markCorner(x: number, y: number, z: number): BuildResult {
    if (!this.cornerA) {
      this.cornerA = { x, y, z };
      return { ok: true, text: 'Corner 1 set - aim at the opposite corner and mark again' };
    }
    const a = this.cornerA;
    this.cornerA = null;
    const size = { x: Math.abs(x - a.x) + 1, y: Math.abs(y - a.y) + 1, z: Math.abs(z - a.z) + 1 };
    if (size.x > CLIP_MAX || size.y > CLIP_MAX || size.z > CLIP_MAX) {
      return { ok: false, text: `Too big: ${size.x}x${size.y}x${size.z} (the most is ${CLIP_MAX}x${CLIP_MAX}x${CLIP_MAX})` };
    }
    const x0 = Math.min(a.x, x);
    const y0 = Math.min(a.y, y);
    const z0 = Math.min(a.z, z);
    const blocks: ClipBlock[] = [];
    for (let dy = 0; dy < size.y; dy++) {
      for (let dz = 0; dz < size.z; dz++) {
        for (let dx = 0; dx < size.x; dx++) {
          const voxel = this.world.getVoxel(x0 + dx, y0 + dy, z0 + dz);
          if (voxel === AIR) continue;
          const def = blockOf(voxel);
          if (def.liquid !== null) continue;
          const item = itemOfBlock(def.key);
          if (item) blocks.push({ dx, dy, dz, voxel: withActive(voxel, false), item });
        }
      }
    }
    if (blocks.length === 0) return { ok: false, text: 'Nothing to copy there' };
    this.clipValue = { size, blocks };
    return { ok: true, text: `Copied ${blocks.length} blocks (${size.x}x${size.y}x${size.z}). Aim and paste` };
  }

  cancelCopy(): void {
    this.cornerA = null;
  }

  /**
   * Pastes the clip with its low corner at (x, y, z). Only empty or replaceable cells are filled, never one the player stands in;
   * each block costs one item from the pack unless Dev Mode builds free. What cannot be paid for is skipped and counted.
   */
  paste(x: number, y: number, z: number): BuildResult {
    const clip = this.clipValue;
    if (!clip) return { ok: false, text: 'Nothing copied yet' };
    const free = this.player.dev && this.player.devFreePlace;
    const px = this.player.position.x;
    const py = this.player.position.y;
    const pz = this.player.position.z;
    const hw = PLAYER_WIDTH / 2;
    let placed = 0;
    let blocked = 0;
    const short = new Map<string, number>();
    this.pasting = true;
    try {
      for (const b of clip.blocks) {
        const tx = x + b.dx;
        const ty = y + b.dy;
        const tz = z + b.dz;
        const def = blockOf(b.voxel);
        if (ty < 0 || ty >= WORLD_HEIGHT || !this.world.isLoaded(tx, tz) || !this.world.getBlock(tx, ty, tz).replaceable) {
          blocked++;
          continue;
        }
        if (def.solid && tx + 1 > px - hw && tx < px + hw && tz + 1 > pz - hw && tz < pz + hw && ty + 1 > py && ty < py + PLAYER_HEIGHT) {
          blocked++;
          continue;
        }
        if (!free && this.player.inventory.count(b.item) < 1) {
          short.set(b.item, (short.get(b.item) ?? 0) + 1);
          continue;
        }
        if (!this.world.setVoxel(tx, ty, tz, b.voxel, 'player')) {
          blocked++;
          continue;
        }
        if (!free) this.player.inventory.remove(b.item, 1);
        placed++;
      }
    } finally {
      this.pasting = false;
    }
    if (placed > 0) this.player.bus.emit('sfx', { name: 'place', x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    const lacking = [...short].map(([item, n]) => `${n} ${nameOf(item)}`).join(', ');
    const parts = [`Pasted ${placed} of ${clip.blocks.length} blocks`];
    if (lacking) parts.push(`missing ${lacking}`);
    if (blocked > 0) parts.push(`${blocked} spots blocked`);
    return { ok: placed > 0, text: parts.join(', ') };
  }
}
