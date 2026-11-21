/** Test fixtures for src/player (imported only by *.test.ts). */
import { createBus, type GameBus, type IView } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game';
import type { IntentSource } from './controller';
import { createIntent, type Intent } from './input/intent';
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

/** An IView that remembers what it was told. */
export class StubView implements IView {
  view = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  fov = 0;
  fovCalls = 0;
  target: { x: number; y: number; z: number } | null = null;
  mining = -1;
  held: Array<string | null> = [];
  swings = 0;
  setView(x: number, y: number, z: number, yaw: number, pitch: number): void {
    this.view = { x, y, z, yaw, pitch };
  }
  setFov(degrees: number): void {
    this.fov = degrees;
    this.fovCalls++;
  }
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void {
    this.target = target ? { ...target } : null;
    this.mining = mining;
  }
  setHeldItem(itemKey: string | null): void {
    this.held.push(itemKey);
  }
  triggerSwing(): void {
    this.swings++;
  }
}

/** An intent source the test writes into; one-shot fields are cleared after each frame. */
export class Script implements IntentSource {
  readonly next: Intent = createIntent();
  captures = 0;
  releases = 0;
  frame(): Intent {
    const out = { ...this.next };
    this.next.use = false;
    this.next.place = false;
    this.next.hotbarSlot = null;
    this.next.hotbarStep = 0;
    this.next.inventory = this.next.log = this.next.pause = false;
    this.next.lookYaw = this.next.lookPitch = 0;
    return out;
  }
  requestPointerCapture(): Promise<boolean> {
    this.captures++;
    return Promise.resolve(true);
  }
  releasePointerCapture(): void {
    this.releases++;
  }
}
