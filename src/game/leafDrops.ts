/**
 * Decayed leaves (world/leafDecay.ts) drop what breaking them would, but the game has no item entities: the drops go
 * straight to the player when they stand within LEAF_PICKUP_RADIUS of the leaf, and are lost otherwise (a crown that
 * falls away behind a hill gives nothing). Returns the unsubscribe function.
 */
import type { GameBus } from '../core/context';
import type { PlayerState } from './playerState';

/** Blocks within which the player collects the drops of a decaying leaf. */
export const LEAF_PICKUP_RADIUS = 8;

export function collectLeafDrops(bus: GameBus, player: PlayerState): () => void {
  return bus.on('leaves:decayed', ({ x, y, z, drops }) => {
    if (player.dead || drops.length === 0) return;
    const p = player.position;
    const dx = p.x - (x + 0.5);
    const dy = p.y + 1 - (y + 0.5);
    const dz = p.z - (z + 0.5);
    if (dx * dx + dy * dy + dz * dz > LEAF_PICKUP_RADIUS * LEAF_PICKUP_RADIUS) return;
    for (const d of drops) player.give(d.item, d.count);
  });
}
