/** Test helpers for src/render (not used by the game): a tiny in-memory IWorld. */
import { BLOCKS, blockId } from '../core/registry';
import { AIR, makeVoxel, type BlockDef, type BlockEntity, type Facing, type IWorld, type Voxel } from '../core/types';

export class FakeWorld implements IWorld {
  readonly seed = 1;
  private readonly voxels = new Map<string, Voxel>();
  private readonly ents = new Map<string, BlockEntity>();
  /** Ground level: every cell at or below this y is stone. */
  constructor(readonly ground = 10) {}

  getVoxel(x: number, y: number, z: number): Voxel {
    const k = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    const v = this.voxels.get(k);
    if (v !== undefined) return v;
    return Math.floor(y) <= this.ground ? makeVoxel(blockId('stone')) : AIR;
  }
  getBlock(x: number, y: number, z: number): BlockDef {
    return BLOCKS[this.getVoxel(x, y, z) & 0x3ff];
  }
  setVoxel(x: number, y: number, z: number, voxel: Voxel): boolean {
    this.voxels.set(`${x},${y},${z}`, voxel);
    return true;
  }
  /** Places a block by key (facing / active optional). */
  put(x: number, y: number, z: number, key: string, facing = 0, active = false): void {
    this.setVoxel(x, y, z, makeVoxel(blockId(key), facing as Facing, active));
  }
  isLoaded(): boolean {
    return true;
  }
  surfaceY(x: number, z: number): number {
    for (let y = 95; y >= 0; y--) if (this.getVoxel(x, y, z) !== AIR) return y;
    return -1;
  }
  getEntity(x: number, y: number, z: number): BlockEntity | undefined {
    return this.ents.get(`${x},${y},${z}`);
  }
  setEntity(e: BlockEntity): void {
    this.ents.set(`${e.x},${e.y},${e.z}`, e);
  }
  removeEntity(x: number, y: number, z: number): BlockEntity | undefined {
    const e = this.ents.get(`${x},${y},${z}`);
    this.ents.delete(`${x},${y},${z}`);
    return e;
  }
  entities(): Iterable<BlockEntity> {
    return this.ents.values();
  }
}
