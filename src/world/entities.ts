/**
 * Block entities (machine state) keyed by position. Every entity pins its own chunk and the 8 around it:
 * the world keeps their voxels loaded however far away the player is (spec section 5).
 */
import type { BlockEntity } from '../core/types';
import { chunkCoord, chunkKey } from './chunk';

const SPAN = 1 << 21;
const HALF = 1 << 20;
/** One exact number per block position for |x|, |z| < 2^20 and 0 <= y < 128. */
export const positionKey = (x: number, y: number, z: number): number => ((x + HALF) * SPAN + (z + HALF)) * 128 + y;

export class EntityStore {
  private readonly byPos = new Map<number, BlockEntity>();
  private readonly pins = new Map<number, number>();

  get size(): number {
    return this.byPos.size;
  }

  /** Number of chunks currently pinned by entities. */
  get pinnedChunks(): number {
    return this.pins.size;
  }

  get(x: number, y: number, z: number): BlockEntity | undefined {
    return this.byPos.get(positionKey(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  /** Adds or replaces the entity at its position; returns true when the set of pinned chunks changed. */
  set(entity: BlockEntity): boolean {
    const key = positionKey(Math.floor(entity.x), Math.floor(entity.y), Math.floor(entity.z));
    const had = this.byPos.has(key);
    this.byPos.set(key, entity);
    return had ? false : this.pin(entity, 1);
  }

  /** Removes and returns the entity at a position; `changed` tells whether pinned chunks changed. */
  remove(x: number, y: number, z: number): { entity: BlockEntity | undefined; changed: boolean } {
    const key = positionKey(Math.floor(x), Math.floor(y), Math.floor(z));
    const entity = this.byPos.get(key);
    if (!entity) return { entity, changed: false };
    this.byPos.delete(key);
    return { entity, changed: this.pin(entity, -1) };
  }

  values(): IterableIterator<BlockEntity> {
    return this.byPos.values();
  }

  isPinned(key: number): boolean {
    return this.pins.has(key);
  }

  pinnedKeys(): IterableIterator<number> {
    return this.pins.keys();
  }

  clear(): void {
    this.byPos.clear();
    this.pins.clear();
  }

  private pin(entity: BlockEntity, delta: number): boolean {
    const cx = chunkCoord(Math.floor(entity.x));
    const cz = chunkCoord(Math.floor(entity.z));
    let changed = false;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = chunkKey(cx + dx, cz + dz);
        const n = (this.pins.get(key) ?? 0) + delta;
        if (n > 0) {
          if (n === 1 && delta > 0) changed = true;
          this.pins.set(key, n);
        } else {
          this.pins.delete(key);
          changed = true;
        }
      }
    }
    return changed;
  }
}
