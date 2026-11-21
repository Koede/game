/** Adapts the game's PlayerState (structurally, without importing src/game) to what animals read. */
import type { MobPlayer } from './types';

interface PlayerLike {
  readonly position: { x: number; y: number; z: number };
  readonly yaw: number;
  heldStack(): { item: string } | null;
}

/** A live MobPlayer view of a player: reads position, yaw and the held item on every access. */
export function mobPlayerOf(player: PlayerLike): MobPlayer {
  return {
    get x() {
      return player.position.x;
    },
    get y() {
      return player.position.y;
    },
    get z() {
      return player.position.z;
    },
    get yaw() {
      return player.yaw;
    },
    heldItem: () => player.heldStack()?.item ?? null,
  };
}
