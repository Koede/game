/**
 * Where rain stops, around the camera: for each block column within MASK_RADIUS, the height at which falling
 * rain, snow or dust hits the first block that keeps it off (anything solid, or a liquid). The precipitation
 * shader hides every particle below it, so rain stops on a roof and you watch it fall past the doorway.
 *
 * The grid is toroidal (slot = world coordinate mod MASK_SIZE), so moving the window only recomputes the strips of
 * columns that entered it. Edits and newly loaded chunks queue their columns; a per-frame budget keeps the cost flat.
 * DOM-free (the renderer uploads `data` as a texture when `changed`).
 */
import { blockOf } from '../core/registry';
import { CHUNK_SIZE, WORLD_HEIGHT, type IWorld } from '../core/types';

export const MASK_SIZE = 64;
/** The window covers the camera's column +- this many blocks. */
export const MASK_RADIUS = MASK_SIZE / 2;

const SLOTS = MASK_SIZE * MASK_SIZE;
const slotOf = (x: number, z: number): number => (((z % MASK_SIZE) + MASK_SIZE) % MASK_SIZE) * MASK_SIZE + (((x % MASK_SIZE) + MASK_SIZE) % MASK_SIZE);

/** Height (y of the free cell above the first rain-stopping block from the top) where rain ends in a column; 0 = it falls through. */
export function rainTop(world: IWorld, x: number, z: number): number {
  let y = Math.min(world.surfaceY(x, z), WORLD_HEIGHT - 1);
  while (y >= 0) {
    const def = blockOf(world.getVoxel(x, y, z));
    if (def.solid || def.liquid !== null) break;
    y--;
  }
  return y + 1;
}

export class RainMask {
  /** Rain stops at this y in the column of each slot. */
  readonly data = new Uint8Array(SLOTS);
  /** Set when `data` changed since the flag was last cleared by the uploader. */
  changed = true;
  private readonly colX = new Int32Array(SLOTS).fill(0x7fffffff);
  private readonly colZ = new Int32Array(SLOTS).fill(0x7fffffff);
  private readonly queued = new Uint8Array(SLOTS);
  private readonly queue = new Int32Array(SLOTS);
  private head = 0;
  private size = 0;
  private x0 = NaN;
  private z0 = NaN;

  constructor(private readonly world: IWorld) {}

  /** Columns waiting to be measured. */
  get pending(): number {
    return this.size;
  }

  /** Moves the window to the camera's column (cheap when it did not move a whole block). */
  center(x: number, z: number): void {
    const x0 = Math.floor(x) - MASK_RADIUS;
    const z0 = Math.floor(z) - MASK_RADIUS;
    if (x0 === this.x0 && z0 === this.z0) return;
    this.x0 = x0;
    this.z0 = z0;
    // Every slot whose column is no longer the one the window maps to it is re-measured.
    for (let j = 0; j < MASK_SIZE; j++) {
      const wz = z0 + ((((j - z0) % MASK_SIZE) + MASK_SIZE) % MASK_SIZE);
      for (let i = 0; i < MASK_SIZE; i++) {
        const wx = x0 + ((((i - x0) % MASK_SIZE) + MASK_SIZE) % MASK_SIZE);
        const s = j * MASK_SIZE + i;
        if (this.colX[s] !== wx || this.colZ[s] !== wz) {
          this.colX[s] = wx;
          this.colZ[s] = wz;
          this.push(s);
        }
      }
    }
  }

  /** A block changed: its column is measured again. */
  invalidateColumn(x: number, z: number): void {
    if (!this.inside(x, z)) return;
    this.push(slotOf(x, z));
  }

  /** A chunk was (re)meshed or loaded: its columns inside the window are measured again. */
  invalidateChunk(cx: number, cz: number): void {
    const bx = cx * CHUNK_SIZE;
    const bz = cz * CHUNK_SIZE;
    for (let z = bz; z < bz + CHUNK_SIZE; z++) {
      for (let x = bx; x < bx + CHUNK_SIZE; x++) if (this.inside(x, z)) this.push(slotOf(x, z));
    }
  }

  /** Measures up to `budget` queued columns. Returns how many it measured. */
  update(budget: number): number {
    let n = 0;
    while (this.size > 0 && n < budget) {
      const s = this.queue[this.head];
      this.head = (this.head + 1) % SLOTS;
      this.size--;
      this.queued[s] = 0;
      const top = rainTop(this.world, this.colX[s], this.colZ[s]);
      if (this.data[s] !== top) {
        this.data[s] = top;
        this.changed = true;
      }
      n++;
    }
    return n;
  }

  /** Height where rain stops in a column inside the window (as last measured). */
  topAt(x: number, z: number): number {
    return this.data[slotOf(Math.floor(x), Math.floor(z))];
  }

  private inside(x: number, z: number): boolean {
    return x >= this.x0 && x < this.x0 + MASK_SIZE && z >= this.z0 && z < this.z0 + MASK_SIZE;
  }

  private push(s: number): void {
    if (this.queued[s]) return;
    this.queued[s] = 1;
    this.queue[(this.head + this.size) % SLOTS] = s;
    this.size++;
  }
}
