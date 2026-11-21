/** Test fixtures for src/player (imported only by *.test.ts). */
import { createBus, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game';
import type { MoveInput } from './physics';

/** FakeWorld whose columns can be marked as not loaded (getVoxel then returns air, as the real world does). */
export class PatchyWorld extends FakeWorld {
  private readonly missing = new Set<string>();

  unload(x: number, z: number): void {
    this.missing.add(`${x},${z}`);
  }

  isLoaded(x = 0, z = 0): boolean {
    return !this.missing.has(`${x},${z}`);
  }
}

/** A world with a flat floor of `block` whose top surface is at y = 10 (blocks at y = 9) over x, z in -r..r. */
export function flatWorld(bus: GameBus | null = null, block = 'stone', r = 12): PatchyWorld {
  const world = new PatchyWorld(bus);
  world.fill(-r, 9, -r, r, 9, r, block);
  return world;
}

export function makePlayer(bus = createBus(), x = 0.5, y = 10, z = 0.5): PlayerState {
  const p = new PlayerState(bus, { x, y, z });
  p.onGround = true;
  return p;
}

export const idle = (): MoveInput => ({ moveX: 0, moveZ: 0, jump: false, sprint: false });

/** Records every event of the given types. */
export function record<K extends keyof GameEvents>(bus: GameBus, ...types: K[]): Array<{ type: K; e: GameEvents[K] }> {
  const log: Array<{ type: K; e: GameEvents[K] }> = [];
  for (const type of types) bus.on(type, (e) => log.push({ type, e }));
  return log;
}
