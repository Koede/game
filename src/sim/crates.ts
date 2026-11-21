/** Crates as the rest of the simulation uses them: output buffers for machines, ingredient stores for stations. */
import { STATION_CRATE_RADIUS } from '../core/constants';
import { addToSlots, type MachineEntity, type SimEntity, type SimNode } from './entities';

/**
 * Moves whatever fits from slots [from, to) of a machine into the crates touching it. `touch` is told about every
 * entity whose slots changed (open screens refresh).
 */
export function pushToCrates(node: SimNode, from: number, to: number, touch: (e: SimEntity) => void): void {
  if (node.crates.length === 0) return;
  const slots = (node.e as MachineEntity).slots;
  for (let i = from; i < to; i++) {
    for (const crate of node.crates) {
      const s = slots[i];
      if (!s) break;
      const left = addToSlots(crate.slots, s.item, s.count);
      if (left === s.count) continue;
      if (left > 0) s.count = left;
      else slots[i] = null;
      touch(crate);
      touch(node.e);
    }
  }
}

/** Crates within STATION_CRATE_RADIUS (Chebyshev distance) of a station, nearest first. */
export function cratesNear(nodes: readonly SimNode[], x: number, y: number, z: number): MachineEntity[] {
  const near: Array<{ d: number; e: MachineEntity }> = [];
  for (const n of nodes) {
    if (n.e.kind !== 'crate') continue;
    const d = Math.max(Math.abs(n.e.x - x), Math.abs(n.e.y - y), Math.abs(n.e.z - z));
    if (d <= STATION_CRATE_RADIUS) near.push({ d, e: n.e as MachineEntity });
  }
  near.sort((a, b) => a.d - b.d);
  return near.map((c) => c.e);
}
