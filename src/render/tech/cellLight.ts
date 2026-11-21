/**
 * Light of block cells for things drawn inside pipes and hearths, from the renderer's LightProbe (an estimate from
 * the voxels: thousands of reads per probe). Cells are probed lazily, a few per frame, and re-probed slowly
 * round-robin so a torch placed nearby shows up within a few seconds; until a cell is probed callers use a fallback.
 */
import type { IWorld } from '../../core/types';
import { LightProbe } from '../lightProbe';

/** A number unique to a block position (x and z within +-2^19, y within 0..127). */
export const cellKey = (x: number, y: number, z: number): number => ((x + 524288) * 1048576 + (z + 524288)) * 128 + y;

const UNKNOWN = -1;
const QUEUED = -2;
/** Forget everything past this many cells (the camera wandered far; cells are probed again on demand). */
const MAX_CELLS = 6000;

/** Light 0..255 packed as sky * 16 + block (each 0..15). */
export const packLight = (sky: number, block: number): number => Math.round(sky * 15) * 16 + Math.round(block * 15);
export const skyOf = (packed: number): number => (packed >> 4) / 15;
export const blockOf = (packed: number): number => (packed & 15) / 15;

export class CellLight {
  private readonly probe: LightProbe;
  private readonly cells = new Map<number, number>();
  private readonly queue: number[] = [];
  private readonly qx: number[] = [];
  private readonly qy: number[] = [];
  private readonly qz: number[] = [];
  /** Probed cells in probe order, for the slow re-probe. */
  private readonly known: number[] = [];
  private readonly kx: number[] = [];
  private readonly ky: number[] = [];
  private readonly kz: number[] = [];
  private cursor = 0;

  constructor(
    world: IWorld,
    /** New cells probed per update. */
    private readonly budget = 6,
    /** Known cells re-probed per update. */
    private readonly refresh = 1,
  ) {
    this.probe = new LightProbe(world);
  }

  get size(): number {
    return this.cells.size;
  }

  /** Packed light of a cell, or -1 while it is not probed yet (it is queued). */
  get(x: number, y: number, z: number): number {
    const key = cellKey(x, y, z);
    const v = this.cells.get(key);
    if (v === undefined) {
      this.cells.set(key, QUEUED);
      this.queue.push(key);
      this.qx.push(x);
      this.qy.push(y);
      this.qz.push(z);
      return UNKNOWN;
    }
    return v < 0 ? UNKNOWN : v;
  }

  /** Probes up to `budget` queued cells and re-probes `refresh` known ones. */
  update(): void {
    if (this.cells.size > MAX_CELLS) this.clear();
    let n = 0;
    while (n < this.budget && this.queue.length > 0) {
      const key = this.queue.pop() as number;
      const x = this.qx.pop() as number;
      const y = this.qy.pop() as number;
      const z = this.qz.pop() as number;
      this.cells.set(key, this.measure(x, y, z));
      this.known.push(key);
      this.kx.push(x);
      this.ky.push(y);
      this.kz.push(z);
      n++;
    }
    for (let i = 0; i < this.refresh && this.known.length > 0; i++) {
      this.cursor = (this.cursor + 1) % this.known.length;
      const c = this.cursor;
      this.cells.set(this.known[c], this.measure(this.kx[c], this.ky[c], this.kz[c]));
    }
  }

  clear(): void {
    this.cells.clear();
    this.queue.length = this.qx.length = this.qy.length = this.qz.length = 0;
    this.known.length = this.kx.length = this.ky.length = this.kz.length = 0;
    this.cursor = 0;
  }

  private measure(x: number, y: number, z: number): number {
    this.probe.probe(x + 0.5, y + 0.5, z + 0.5);
    return packLight(this.probe.sky, this.probe.block);
  }
}
