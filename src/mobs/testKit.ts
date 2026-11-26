/** Test fixtures for src/mobs (not used by the game): a flat in-memory world with unloadable chunk columns. */
import type { GameBus } from '../core/context';
import { blockId, blockOf } from '../core/registry';
import { AIR, CHUNK_SIZE, makeVoxel, WORLD_HEIGHT, type BlockDef, type BlockEntity, type IWorld, type Voxel } from '../core/types';
import type { MobClock, MobPlayer } from './types';

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/** Flat grass at `ground` (stone below) everywhere, with edits on top; chunk columns can be marked unloaded. */
export class FlatWorld implements IWorld {
  readonly seed: number;
  private readonly edits = new Map<string, Voxel>();
  private readonly unloaded = new Set<string>();
  private readonly grass = makeVoxel(blockId('grass'));
  private readonly stone = makeVoxel(blockId('stone'));

  constructor(readonly ground = 10, seed = 1234, readonly bus: GameBus | null = null) {
    this.seed = seed;
  }

  getVoxel(x: number, y: number, z: number): Voxel {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0) return this.stone;
    if (by >= WORLD_HEIGHT || !this.isLoaded(bx, bz)) return AIR;
    const e = this.edits.get(key(bx, by, bz));
    if (e !== undefined) return e;
    return by < this.ground ? this.stone : by === this.ground ? this.grass : AIR;
  }
  getBlock(x: number, y: number, z: number): BlockDef {
    return blockOf(this.getVoxel(x, y, z));
  }
  setVoxel(x: number, y: number, z: number, voxel: Voxel): boolean {
    this.edits.set(key(Math.floor(x), Math.floor(y), Math.floor(z)), voxel);
    return true;
  }
  put(x: number, y: number, z: number, block: string): void {
    this.setVoxel(x, y, z, block === 'air' ? AIR : makeVoxel(blockId(block)));
  }
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.put(x, y, z, block);
  }
  /** Marks a chunk column loaded or not (emits 'chunk:loaded' on the bus when it becomes loaded). */
  setLoaded(cx: number, cz: number, loaded: boolean): void {
    if (loaded) {
      this.unloaded.delete(`${cx},${cz}`);
      this.bus?.emit('chunk:loaded', { cx, cz });
    } else this.unloaded.add(`${cx},${cz}`);
  }
  isLoaded(x: number, z: number): boolean {
    return this.unloaded.size === 0 || !this.unloaded.has(`${Math.floor(Math.floor(x) / CHUNK_SIZE)},${Math.floor(Math.floor(z) / CHUNK_SIZE)}`);
  }
  surfaceY(x: number, z: number): number {
    if (!this.isLoaded(x, z)) return -1;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) if (this.getVoxel(x, y, z) !== AIR) return y;
    return -1;
  }
  getEntity(_x?: number, _y?: number, _z?: number): BlockEntity | undefined {
    return undefined;
  }
  setEntity(_e?: BlockEntity): void {}
  removeEntity(): BlockEntity | undefined {
    return undefined;
  }
  entities(): Iterable<BlockEntity> {
    return [];
  }
}

export class TestClock implements MobClock {
  constructor(public timeOfDay = 0.25, public light = 1) {}
  sunlight(): number {
    return this.light;
  }
}

export function testPlayer(x = 0, y = 11, z = 0, held: string | null = null): MobPlayer & { held: string | null } {
  return {
    x,
    y,
    z,
    yaw: 0,
    held,
    heldItem() {
      return this.held;
    },
  };
}
