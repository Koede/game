/**
 * Plants that may have been left on nothing (docs/build/UNIT-03-small-gaps.md, section 5). A block change queues the
 * cell above it; the simulation checks the queue at the start of the NEXT tick, so a contraption that clears its
 * cells and sets them again inside one tick never pops the plants it carries. DOM-free and runtime only (never saved).
 */
import type { IWorld } from '../core/types';
import { posKey } from './entities';

export class PlantSupport {
  private readonly pending = new Map<string, [number, number, number]>();

  /** Marks the cell as to be checked on the next flush. Queueing a cell twice checks it once. */
  queue(x: number, y: number, z: number): void {
    this.pending.set(posKey(x, y, z), [x, y, z]);
  }

  get size(): number {
    return this.pending.size;
  }

  clear(): void {
    this.pending.clear();
  }

  /**
   * Calls `pop` for up to `max` queued cells, each taken out of the queue whether it pops or not. Cells whose chunk is
   * not loaded are dropped: the crop there is checked again when its chunk loads. Returns how many `pop` reported.
   */
  flush(world: IWorld, pop: (x: number, y: number, z: number) => boolean, max: number): number {
    let popped = 0;
    const keys = [...this.pending.keys()].slice(0, max);
    for (const key of keys) {
      const cell = this.pending.get(key);
      this.pending.delete(key);
      if (!cell) continue;
      const [x, y, z] = cell;
      if (!world.isLoaded(x, z)) continue;
      if (pop(x, y, z)) popped++;
    }
    return popped;
  }
}
