/**
 * Decayed leaves (world/leafDecay.ts) drop what breaking them would: as ground items where the leaf was
 * (game/groundItems.ts), so they are picked up like any other drop, or left to despawn when nobody comes. Returns the
 * unsubscribe function.
 */
import type { GameBus } from '../core/context';
import type { PlayerState } from './playerState';

export function collectLeafDrops(bus: GameBus, player: PlayerState): () => void {
  return bus.on('leaves:decayed', ({ x, y, z, drops }) => {
    if (drops.length > 0) player.dropAll(drops, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  });
}
