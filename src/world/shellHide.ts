/**
 * Shell blocks hidden under a merged multiblock model (src/render/formed). A formed structure registers its box here;
 * the streamer hands the boxes that touch a chunk to the mesher, which then emits no faces for the shell cells (every
 * cell on the box surface except the `keep` cell, normally the controller) - the model draws them instead. Voxel data
 * is untouched: the blocks are still there to target, break and simulate; only their meshing is skipped.
 */
export type Cell = readonly [number, number, number];

export interface HiddenShell {
  min: Cell;
  max: Cell;
  /** One cell on the surface that stays drawn as a real block (the controller). */
  keep: Cell;
}

/** Numbers per box in the flat list a mesh job carries: min xyz, max xyz, keep xyz. */
export const HIDDEN_STRIDE = 9;

export type ShellChange = (min: Cell, max: Cell) => void;

export class ShellHiding {
  private readonly boxes = new Map<string, HiddenShell>();
  private readonly listeners = new Set<ShellChange>();
  /** Bumped on every change (cheap "did it change" check for tests and caches). */
  version = 0;

  get size(): number {
    return this.boxes.size;
  }

  has(id: string): boolean {
    return this.boxes.has(id);
  }

  get(id: string): HiddenShell | undefined {
    return this.boxes.get(id);
  }

  /** Hides (or moves) the shell `id`; the chunks it touches are re-meshed. */
  set(id: string, shell: HiddenShell): void {
    const old = this.boxes.get(id);
    this.boxes.set(id, { min: [...shell.min], max: [...shell.max], keep: [...shell.keep] });
    this.version++;
    if (old) this.emit(old.min, old.max);
    this.emit(shell.min, shell.max);
  }

  /** Shows the shell blocks of `id` again. */
  clear(id: string): void {
    const old = this.boxes.get(id);
    if (!old) return;
    this.boxes.delete(id);
    this.version++;
    this.emit(old.min, old.max);
  }

  clearAll(): void {
    for (const id of [...this.boxes.keys()]) this.clear(id);
  }

  /** Flat boxes (HIDDEN_STRIDE numbers each) that overlap chunk (cx, cz) or touch it, or undefined when none do. */
  forChunk(cx: number, cz: number): number[] | undefined {
    if (this.boxes.size === 0) return undefined;
    const x0 = cx * 16;
    const z0 = cz * 16;
    let out: number[] | undefined;
    for (const b of this.boxes.values()) {
      if (b.max[0] < x0 || b.min[0] > x0 + 15 || b.max[2] < z0 || b.min[2] > z0 + 15) continue;
      (out ??= []).push(...b.min, ...b.max, ...b.keep);
    }
    return out;
  }

  onChange(fn: ShellChange): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(min: Cell, max: Cell): void {
    for (const fn of this.listeners) fn(min, max);
  }
}

/** The one registry of the running game (the world has one streamer, the renderer one model layer). */
export const shellHiding = new ShellHiding();

/** True when cell (x, y, z) is a hidden shell cell of one of the flat `boxes`. Used by the mesher on every worker. */
export function isHiddenShellCell(boxes: readonly number[], x: number, y: number, z: number): boolean {
  for (let i = 0; i < boxes.length; i += HIDDEN_STRIDE) {
    if (x < boxes[i] || x > boxes[i + 3] || y < boxes[i + 1] || y > boxes[i + 4] || z < boxes[i + 2] || z > boxes[i + 5]) continue;
    const onSurface = x === boxes[i] || x === boxes[i + 3] || y === boxes[i + 1] || y === boxes[i + 4] || z === boxes[i + 2] || z === boxes[i + 5];
    if (onSurface && !(x === boxes[i + 6] && y === boxes[i + 7] && z === boxes[i + 8])) return true;
  }
  return false;
}
