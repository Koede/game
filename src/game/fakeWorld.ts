/**
 * A tiny in-memory IWorld: every voxel is air until set, every chunk counts as loaded. For unit tests and
 * harnesses of modules that must not import src/world; the game itself never uses it.
 */
import type { GameBus } from '../core/context';
import { blockId, blockOf } from '../core/registry';
import { AIR, WORLD_HEIGHT, makeVoxel, type BlockDef, type BlockEntity, type ChangeSource, type IWorld, type Voxel } from '../core/types';

const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class FakeWorld implements IWorld {
  readonly seed = 1;
  private readonly voxels = new Map<string, Voxel>();
  private readonly entityMap = new Map<string, BlockEntity>();

  constructor(private readonly bus: GameBus | null = null) {}

  getVoxel(x: number, y: number, z: number): Voxel {
    return this.voxels.get(keyOf(x, y, z)) ?? AIR;
  }

  getBlock(x: number, y: number, z: number): BlockDef {
    return blockOf(this.getVoxel(x, y, z));
  }

  setVoxel(x: number, y: number, z: number, voxel: Voxel, source: ChangeSource = 'sim'): boolean {
    const from = this.getVoxel(x, y, z);
    if (voxel === AIR) this.voxels.delete(keyOf(x, y, z));
    else this.voxels.set(keyOf(x, y, z), voxel);
    this.bus?.emit('block:changed', { x, y, z, from, to: voxel, source });
    return true;
  }

  /** Sets a block by key (test convenience). */
  put(x: number, y: number, z: number, block: string, active = false): void {
    this.setVoxel(x, y, z, makeVoxel(blockId(block), 0, active));
  }

  /** Fills the box [x0..x1] x [y0..y1] x [z0..z1] with a block. */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.put(x, y, z, block);
  }

  isLoaded(): boolean {
    return true;
  }

  surfaceY(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) if (this.getVoxel(x, y, z) !== AIR) return y;
    return -1;
  }

  getEntity(x: number, y: number, z: number): BlockEntity | undefined {
    return this.entityMap.get(keyOf(x, y, z));
  }

  setEntity(entity: BlockEntity): void {
    this.entityMap.set(keyOf(entity.x, entity.y, entity.z), entity);
  }

  removeEntity(x: number, y: number, z: number): BlockEntity | undefined {
    const entity = this.entityMap.get(keyOf(x, y, z));
    this.entityMap.delete(keyOf(x, y, z));
    return entity;
  }

  entities(): Iterable<BlockEntity> {
    return this.entityMap.values();
  }
}
