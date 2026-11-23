/**
 * The lifecycle of the merged models, with no GPU in it: which formed structures are shown, when their shell blocks are
 * hidden from the chunk meshes and shown again, and how long each one's snap-in animation has run.
 *
 *  - Every SCAN_INTERVAL_S (and at once on a 'formed' notice) the registered kinds list the formed structures near the
 *    camera. A new one is CONFIRMED first - its eight corners and its controller must be solid (a loaded save shows its
 *    hearth only once the walls are loaded and found whole) - then its model is built, its shell hidden and `onAdd` called.
 *  - A structure whose spec changed (another tier, a hatch added, an open top closed) is rebuilt in place.
 *  - A structure that is gone from the scan, or announced as unformed, is removed at once: its shell is shown again
 *    (the chunks re-mesh with the blocks back) and `onRemove` called. Nothing outlives its structure.
 */
import type { GameBus } from '../../core/context';
import { VOXEL_ID_MASK, type IWorld } from '../../core/types';
import { shellHiding as defaultHiding, type ShellHiding } from '../../world/shellHide';
import type { ModelData } from './meshBuilder';
import { formedModel, specKey, type FormedInstance, type FormedSpec } from './registry';

export const SCAN_INTERVAL_S = 0.5;
/** Seconds the snap-in takes, and how long after it the flash fades. */
export const SNAP_S = 0.75;
export const FLASH_S = 0.45;
/** Structures modelled at most (the nearest ones); beyond it they stay as plain blocks. */
export const FORMED_CAP = 24;
/** Horizontal range, blocks, of the scan. */
export const FORMED_RANGE = 480;
/** A formed notice waits this long (seconds) for its structure to show up in a scan. */
const PENDING_S = 3;
const SNAP_DONE = SNAP_S + FLASH_S;

export interface TrackedModel {
  id: string;
  inst: FormedInstance;
  spec: FormedSpec;
  key: string;
  model: ModelData;
  /** Seconds since the snap began; >= SNAP_S + FLASH_S when idle. */
  snapT: number;
  /** Bumped when the model was rebuilt. */
  rev: number;
}

export interface TrackerHooks {
  onAdd(t: TrackedModel): void;
  onRebuild(t: TrackedModel): void;
  onRemove(id: string): void;
  /** The snap just landed (the settle sound). */
  onSettle?(t: TrackedModel): void;
}

export class FormedTracker {
  readonly models = new Map<string, TrackedModel>();
  private readonly found: FormedInstance[] = [];
  private readonly pending = new Map<string, number>();
  private readonly offs: (() => void)[] = [];
  private timer = 0;
  private camX = 0;
  private camZ = 0;
  private clock = 0;

  constructor(
    private readonly world: IWorld,
    bus: GameBus | null,
    private readonly hooks: TrackerHooks,
    private readonly hiding: ShellHiding = defaultHiding,
  ) {
    if (!bus) return;
    for (const k of formedModel.kinds()) {
      const off = k.listen?.(bus, { formed: (id) => this.noticeFormed(id), unformed: (id) => this.remove(id) });
      if (off) this.offs.push(off);
    }
  }

  /** A structure was just formed: snap it in when it appears, and look for it on the next update. */
  noticeFormed(id: string): void {
    this.pending.set(id, this.clock + PENDING_S);
    this.timer = 0;
  }

  /** Advances the snap timers, and scans when due. */
  update(dt: number, camX: number, camZ: number): void {
    this.camX = camX;
    this.camZ = camZ;
    this.clock += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SCAN_INTERVAL_S;
      this.scan();
    }
    for (const t of this.models.values()) {
      if (t.snapT >= SNAP_DONE) continue;
      const before = t.snapT;
      t.snapT += dt;
      if (before < SNAP_S && t.snapT >= SNAP_S) this.hooks.onSettle?.(t);
    }
  }

  /** Snap progress 0..1 of a model and its flash 0..1. */
  static snapOf(t: Pick<TrackedModel, 'snapT'>): { snap: number; flash: number } {
    if (t.snapT >= SNAP_DONE) return { snap: 1, flash: 0 };
    if (t.snapT < SNAP_S) {
      const snap = t.snapT / SNAP_S;
      return { snap, flash: 0.25 * snap * snap };
    }
    return { snap: 1, flash: Math.max(0, 1 - (t.snapT - SNAP_S) / FLASH_S) * 0.9 };
  }

  /** One scan now. */
  scan(): void {
    const found = this.found;
    found.length = 0;
    for (const k of formedModel.kinds()) k.find(this.world, this.camX, this.camZ, FORMED_RANGE, found);
    if (found.length > FORMED_CAP) {
      const d = (i: FormedInstance): number => Math.hypot((i.min[0] + i.max[0]) / 2 - this.camX, (i.min[2] + i.max[2]) / 2 - this.camZ);
      found.sort((a, b) => d(a) - d(b));
      found.length = FORMED_CAP;
    }
    const seen = new Set<string>();
    for (const inst of found) {
      if (!this.confirmed(inst)) continue;
      seen.add(inst.id);
      this.show(inst);
    }
    for (const id of [...this.models.keys()]) if (!seen.has(id)) this.remove(id);
    for (const [id, until] of this.pending) if (until < this.clock) this.pending.delete(id);
  }

  /** Takes a structure down (unformed or gone): its shell blocks are drawn again. */
  remove(id: string): void {
    this.pending.delete(id);
    if (!this.models.delete(id)) return;
    this.hiding.clear(id);
    this.hooks.onRemove(id);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    for (const id of [...this.models.keys()]) this.remove(id);
  }

  /** The corners and the controller must be solid: otherwise the walls are not (or not yet) there to be replaced. */
  private confirmed(inst: FormedInstance): boolean {
    const { min, max, controller } = inst;
    if (max[0] - min[0] < 2 || max[2] - min[2] < 2 || max[1] - min[1] < 2) return false;
    const solid = (x: number, y: number, z: number): boolean => (this.world.getVoxel(x, y, z) & VOXEL_ID_MASK) !== 0;
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) if (!solid(x, y, z)) return false;
    return solid(controller[0], controller[1], controller[2]);
  }

  private specOf(inst: FormedInstance): FormedSpec {
    const k = formedModel.get(inst.kind)!;
    const size: [number, number, number] = [inst.max[0] - inst.min[0] + 1, inst.max[1] - inst.min[1] + 1, inst.max[2] - inst.min[2] + 1];
    const cx = inst.controller[0] - inst.min[0];
    const cy = inst.controller[1] - inst.min[1];
    const cz = inst.controller[2] - inst.min[2];
    const normal: [number, number, number] = cx === 0 ? [-1, 0, 0] : cx === size[0] - 1 ? [1, 0, 0] : cz === 0 ? [0, 0, -1] : cz === size[2] - 1 ? [0, 0, 1] : [0, 0, 0];
    return {
      kind: inst.kind,
      tier: inst.tier,
      size,
      closed: inst.closed,
      parts: k.parts(this.world, inst),
      controller: normal[0] === 0 && normal[2] === 0 ? null : { cell: [cx, cy, cz], normal },
    };
  }

  private show(inst: FormedInstance): void {
    const spec = this.specOf(inst);
    const key = specKey(spec);
    const have = this.models.get(inst.id);
    const snap = this.pending.has(inst.id);
    if (have && have.key === key) {
      have.inst = inst;
      if (snap) {
        this.pending.delete(inst.id);
        have.snapT = 0;
      }
      return;
    }
    const model = formedModel.build(spec);
    // Without a controller on the surface nothing stays drawn: keep a cell just outside the box.
    this.hiding.set(inst.id, { min: inst.min, max: inst.max, keep: spec.controller ? inst.controller : [inst.min[0], inst.min[1] - 1, inst.min[2]] });
    if (have) {
      have.inst = inst;
      have.spec = spec;
      have.key = key;
      have.model = model;
      have.rev++;
      if (snap) {
        this.pending.delete(inst.id);
        have.snapT = 0;
      }
      this.hooks.onRebuild(have);
      return;
    }
    this.pending.delete(inst.id);
    const t: TrackedModel = { id: inst.id, inst, spec, key, model, snapT: snap ? 0 : SNAP_DONE, rev: 0 };
    this.models.set(inst.id, t);
    this.hooks.onAdd(t);
  }
}
