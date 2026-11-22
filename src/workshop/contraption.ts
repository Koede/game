/**
 * Moving contraptions of the Bronze workshop (docs/OVERHAUL_PLAN.md A.8): pistons push and pull a structure, bearings turn one,
 * skiffs ride rails. A structure is the face-connected set of "movable" blocks (contraption frames and every workshop part:
 * shafts, belts, machines, depots, levers...) that touches the actuator; terrain, crates and other actuators never move.
 * A step moves every block of the structure at once: the voxels, the Workshop's per-block state (machine buffers, depot
 * stacks, arm settings, cranks) and any loose item lying on a moved block, so a belt keeps carrying its load.
 * The voxel commit waits until the step ends (piston 0.8 s, bearing 1.5 s for 90°, skiff 0.2 s). While the timer runs,
 * `motions()` reports each block's `from`, `to` and `t` so the renderer can slide it — a bearing yaws about its pivot.
 */
import type { GameBus } from '../core/context';
import { blockId } from '../core/registry';
import { Facing, makeVoxel, voxelActive, voxelFacing, voxelId, type IWorld } from '../core/types';
import type { GroundItem, GroundItems } from '../game/groundItems';

export const PISTON_MAX = 4;
export const PISTON_STEP_S = 0.8;
export const BEARING_STEP_S = 1.5;
export const SKIFF_STEP_S = 0.2;
export const SKIFF_DWELL_S = 2;
export const STRUCTURE_MAX = 48;
export const CONTRAPTION_KINDS = ['piston', 'bearing', 'skiff'] as const;
const ACTS = new Set<string>(CONTRAPTION_KINDS);
type ActKind = (typeof CONTRAPTION_KINDS)[number];
const isActKind = (kind: string): kind is ActKind => ACTS.has(kind);
/** A right-turning bearing yaws this far (radians, about +Y) over one step. +X goes toward +Z. */
const QUARTER = Math.PI / 2;

const CW: Record<number, Facing> = { [Facing.North]: Facing.East, [Facing.East]: Facing.South, [Facing.South]: Facing.West, [Facing.West]: Facing.North };
const CCW: Record<number, Facing> = { [Facing.East]: Facing.North, [Facing.South]: Facing.East, [Facing.West]: Facing.South, [Facing.North]: Facing.West };
const DELTA: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };
const FLIP: Record<number, Facing> = { [Facing.North]: Facing.South, [Facing.South]: Facing.North, [Facing.East]: Facing.West, [Facing.West]: Facing.East };

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const parse = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];

export interface ContraptionHost {
  readonly world: IWorld;
  readonly ground: GroundItems;
  readonly bus: GameBus;
  /** Signed rpm of the kinetic part at the cell (0 = still). */
  signedRpm(x: number, y: number, z: number): number;
  gate(x: number, y: number, z: number): boolean;
  /** True when the block at the cell may be part of a moving structure. */
  movable(x: number, y: number, z: number): boolean;
  /** Re-keys every per-block state from the old cell to the new one. */
  relocate(map: ReadonlyMap<string, [number, number, number]>): void;
  /** Runs `fn` with the Workshop deaf to block changes (the blocks move, their state moves with them). */
  hold(fn: () => void): void;
}

/** One block of a structure while its actuator's step is still open. The voxel stays at `from` until `t` reaches 1. */
export interface StructureMotion {
  from: [number, number, number];
  to: [number, number, number];
  /** 0 at the start of the step, 1 at the commit. `timer / step duration`. */
  t: number;
  /** Yaw about +Y, radians, around `pivot`. 0 when the step slides (piston, skiff). */
  yaw: number;
  /** Bearing cell the yaw is about. Null for a slide. */
  pivot: [number, number, number] | null;
  /** Block key currently at `from` (the voxel has not moved yet). */
  kind: string;
}

interface Move { to: [number, number, number]; turn: number }
interface StepPlan {
  moves: Map<string, Move>;
  /** Bearing cell; null when the step slides. */
  pivot: [number, number, number] | null;
  /** +1 yaws +X toward +Z, -1 the other way, 0 slides. */
  turn: number;
}
interface Act {
  kind: ActKind;
  x: number;
  y: number;
  z: number;
  timer: number;
  ext: number;
  /** The step in progress, or null when this actuator will not move on the current step. */
  plan: StepPlan | null;
  /** A cell this step deletes that is not itself moving (the piston rod on a pull). */
  vacate: [number, number, number] | null;
}

export class Contraptions {
  private readonly acts = new Map<string, Act>();
  private warned = 0;

  constructor(private readonly host: ContraptionHost) {}

  noteBlock(x: number, y: number, z: number, kind: string): void {
    const key = k3(x, y, z);
    if (isActKind(kind)) {
      if (this.acts.get(key)?.kind !== kind) this.acts.set(key, { kind, x, y, z, timer: 0, ext: 0, plan: null, vacate: null });
    } else this.acts.delete(key);
  }

  /** The state follows a moved actuator (a skiff). */
  relocate(map: ReadonlyMap<string, [number, number, number]>): void {
    const moved: Act[] = [];
    for (const [from, to] of map) {
      const a = this.acts.get(from);
      if (!a) continue;
      this.acts.delete(from);
      moved.push({ ...a, x: to[0], y: to[1], z: to[2] });
    }
    for (const a of moved) this.acts.set(k3(a.x, a.y, a.z), a);
  }

  /**
   * Blocks the renderer should slide this frame. Empty when nothing is mid-step.
   * Pass the result to `WorkshopRenderer.update` (game.ts does not yet; S10 wires that call).
   */
  motions(): StructureMotion[] {
    const out: StructureMotion[] = [];
    for (const a of this.acts.values()) {
      const plan = a.plan;
      if (!plan || plan.moves.size === 0) continue;
      const dur = this.stepS(a.kind);
      const t = dur > 0 ? a.timer / dur : 0;
      if (t <= 0 || t >= 1) continue;
      const yaw = plan.turn * t * QUARTER;
      for (const [key, m] of plan.moves) {
        const from = parse(key);
        const kind = this.host.world.getBlock(...from).key;
        if (kind === 'air') continue;
        out.push({ from, to: m.to, t, yaw, pivot: plan.pivot, kind });
      }
    }
    return out;
  }

  /**
   * Cells a pull erases at the commit that are not in `motions()` (the piston's rod).
   * The world mesh should skip these, and every `motion.from`, while the step is open.
   */
  vacating(): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (const a of this.acts.values()) if (a.vacate && a.plan) out.push(a.vacate);
    return out;
  }

  private stepS(kind: ActKind): number {
    switch (kind) {
      case 'piston': return PISTON_STEP_S;
      case 'bearing': return BEARING_STEP_S;
      case 'skiff': return SKIFF_STEP_S;
      default: {
        const _never: never = kind;
        return _never;
      }
    }
  }

  private toast(text: string): void {
    if (this.warned > 0) return;
    this.warned = 3;
    this.host.bus.emit('toast', { text, kind: 'warn' });
  }

  // ---- Structures -------------------------------------------------------------------------------------

  /** The face-connected movable blocks from `start`, or null when there are too many. */
  structure(start: [number, number, number], skip: ReadonlySet<string> = new Set()): string[] | null {
    const out: string[] = [];
    const seen = new Set<string>(skip);
    const queue: [number, number, number][] = [start];
    while (queue.length) {
      const [x, y, z] = queue.pop() as [number, number, number];
      const key = k3(x, y, z);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!this.host.movable(x, y, z)) continue;
      out.push(key);
      if (out.length > STRUCTURE_MAX) return null;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) queue.push([x + dx, y + dy, z + dz]);
    }
    return out;
  }

  /** True when every target is free: in the move, vacated on purpose, or not a solid block. */
  private fits(moves: ReadonlyMap<string, Move>, vacate?: ReadonlySet<string>): boolean {
    const world = this.host.world;
    for (const { to } of moves.values()) {
      if (to[1] < 0 || to[1] > 250) return false;
      const key = k3(...to);
      if (moves.has(key) || vacate?.has(key)) continue;
      const b = world.getBlock(...to);
      if (b.key !== 'air' && !(b.solid === false && b.liquid === null && !b.machine)) return false;
    }
    return true;
  }

  /** Moves every cell of `moves` (from -> to, facing turned by `turn` quarter turns) at once; false when something is in the way. */
  private commit(moves: Map<string, Move>, item: (e: GroundItem, to: [number, number, number], from: [number, number, number]) => void): boolean {
    if (!this.fits(moves)) return false;
    const world = this.host.world;
    const voxels = new Map<string, number>();
    for (const key of moves.keys()) voxels.set(key, world.getVoxel(...parse(key)));
    const itemCells = new Map<string, GroundItem[]>();
    for (const e of this.host.ground.items) {
      const key = k3(Math.floor(e.x), Math.floor(e.y - 0.05), Math.floor(e.z));
      if (!moves.has(key)) continue;
      const list = itemCells.get(key) ?? [];
      list.push(e);
      itemCells.set(key, list);
    }
    const map = new Map<string, [number, number, number]>();
    for (const [key, m] of moves) map.set(key, m.to);
    this.host.hold(() => {
      for (const key of moves.keys()) world.setVoxel(...parse(key), 0, 'sim');
      this.host.relocate(map);
      for (const [key, m] of moves) {
        const v = voxels.get(key) as number;
        let f = voxelFacing(v);
        for (let i = 0; i < Math.abs(m.turn); i++) f = m.turn > 0 ? CW[f] : CCW[f];
        world.setVoxel(...m.to, makeVoxel(voxelId(v), f, voxelActive(v)), 'sim');
      }
    });
    for (const [key, list] of itemCells) for (const e of list) item(e, (moves.get(key) as Move).to, parse(key));
    return true;
  }

  // ---- Actuators --------------------------------------------------------------------------------------

  tick(dt: number): void {
    if (this.warned > 0) this.warned -= dt;
    for (const a of [...this.acts.values()]) {
      if (!this.acts.has(k3(a.x, a.y, a.z))) continue;
      a.timer += dt;
      if (a.kind === 'piston') this.piston(a);
      else if (a.kind === 'bearing') this.bearing(a);
      else this.skiff(a);
    }
  }

  private preview(a: Act, plan: StepPlan | null, vacate: [number, number, number] | null = null): void {
    const live = this.acts.get(k3(a.x, a.y, a.z)) ?? a;
    live.plan = plan;
    live.vacate = vacate;
  }

  private piston(a: Act): void {
    if (a.timer >= PISTON_STEP_S) {
      a.timer = 0;
      this.finishPiston(a);
    }
    const rpm = this.host.signedRpm(a.x, a.y, a.z);
    const powered = rpm !== 0 && this.host.gate(a.x, a.y, a.z);
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const front: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    if (powered && a.ext < PISTON_MAX) {
      const moves = this.pushMoves(front, dx, dz);
      this.preview(a, moves && moves.size > 0 && this.fits(moves) ? { moves, pivot: null, turn: 0 } : null);
      return;
    }
    if (!powered && a.ext > 0) {
      const moves = this.pullMoves(front, dx, dz);
      const vacate = new Set([k3(...front)]);
      if (moves && this.fits(moves, vacate)) this.preview(a, { moves, pivot: null, turn: 0 }, front);
      else this.preview(a, null);
      return;
    }
    this.preview(a, null);
  }

  /** null when the structure in front is over the size cap. */
  private pushMoves(front: [number, number, number], dx: number, dz: number): Map<string, Move> | null {
    const s = this.structure(front);
    if (s === null) return null;
    const moves = new Map<string, Move>();
    for (const key of s) {
      const [x, y, z] = parse(key);
      moves.set(key, { to: [x + dx, y, z + dz], turn: 0 });
    }
    return moves;
  }

  /** null when the structure is over the size cap. The rod cell itself is not a moved block. */
  private pullMoves(front: [number, number, number], dx: number, dz: number): Map<string, Move> | null {
    const s = this.structure(front);
    if (s === null) return null;
    const rod = k3(...front);
    const moves = new Map<string, Move>();
    for (const key of s) {
      if (key === rod) continue;
      const [x, y, z] = parse(key);
      moves.set(key, { to: [x - dx, y, z - dz], turn: 0 });
    }
    return moves;
  }

  private finishPiston(a: Act): void {
    const rpm = this.host.signedRpm(a.x, a.y, a.z);
    const powered = rpm !== 0 && this.host.gate(a.x, a.y, a.z);
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const front: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    if (powered && a.ext < PISTON_MAX) {
      const moves = this.pushMoves(front, dx, dz);
      if (moves === null) return this.toast('The contraption is too big to push (48 blocks)');
      if (!this.commit(moves, (e) => { e.x += dx; e.z += dz; })) return this.toast('Something blocks the piston');
      this.host.world.setVoxel(...front, makeVoxel(blockId('contraption_frame')), 'sim');
      a.ext++;
      this.host.bus.emit('sfx', { name: 'pipe_clunk', x: a.x + 0.5, y: a.y + 0.5, z: a.z + 0.5, pitch: 0.7 });
    } else if (!powered && a.ext > 0) {
      const moves = this.pullMoves(front, dx, dz);
      if (moves === null) return;
      // The first rod cell goes first so the structure can slide into its place.
      this.host.world.setVoxel(...front, 0, 'sim');
      if (!this.commit(moves, (e) => { e.x -= dx; e.z -= dz; })) {
        this.host.world.setVoxel(...front, makeVoxel(blockId('contraption_frame')), 'sim');
        return this.toast('Something blocks the piston');
      }
      a.ext--;
      this.host.bus.emit('sfx', { name: 'pipe_clunk', x: a.x + 0.5, y: a.y + 0.5, z: a.z + 0.5, pitch: 0.55 });
    }
  }

  private bearing(a: Act): void {
    if (a.timer >= BEARING_STEP_S) {
      const rpm = this.host.signedRpm(a.x, a.y, a.z);
      if (rpm !== 0 && this.host.gate(a.x, a.y, a.z)) {
        a.timer = 0;
        this.finishBearing(a);
      }
    }
    this.preview(a, a.timer < BEARING_STEP_S ? this.planBearing(a) : null);
  }

  /** The quarter turn a powered bearing would take, or why it will not. */
  private bearingStep(a: Act): { moves: Map<string, Move>; cw: boolean } | 'idle' | 'big' | 'blocked' {
    const rpm = this.host.signedRpm(a.x, a.y, a.z);
    if (rpm === 0 || !this.host.gate(a.x, a.y, a.z)) return 'idle';
    const s = this.structure([a.x, a.y + 1, a.z]);
    if (s === null) return 'big';
    if (s.length === 0) return 'idle';
    const cw = rpm > 0;
    const moves = new Map<string, Move>();
    for (const key of s) {
      const [x, y, z] = parse(key);
      const rx = x - a.x;
      const rz = z - a.z;
      moves.set(key, { to: cw ? [a.x - rz, y, a.z + rx] : [a.x + rz, y, a.z - rx], turn: cw ? 1 : -1 });
    }
    if (!this.fits(moves)) return 'blocked';
    return { moves, cw };
  }

  private planBearing(a: Act): StepPlan | null {
    const step = this.bearingStep(a);
    if (step === 'idle' || step === 'big' || step === 'blocked') return null;
    return { moves: step.moves, pivot: [a.x, a.y, a.z], turn: step.cw ? 1 : -1 };
  }

  private finishBearing(a: Act): void {
    const step = this.bearingStep(a);
    if (step === 'idle') return;
    if (step === 'big') return this.toast('The contraption is too big to turn (48 blocks)');
    if (step === 'blocked') return this.toast('Something blocks the bearing');
    const { moves, cw } = step;
    const ok = this.commit(moves, (e, _to, from) => {
      void from;
      const rx = e.x - (a.x + 0.5);
      const rz = e.z - (a.z + 0.5);
      e.x = cw ? a.x + 0.5 - rz : a.x + 0.5 + rz;
      e.z = cw ? a.z + 0.5 + rx : a.z + 0.5 - rx;
    });
    if (!ok) return this.toast('Something blocks the bearing');
    this.host.bus.emit('sfx', { name: 'pipe_clunk', x: a.x + 0.5, y: a.y + 0.5, z: a.z + 0.5, pitch: 0.9 });
  }

  /** A skiff rides the rails under it, stops at the end for a while, then turns round. */
  private skiff(a: Act): void {
    if (a.ext > 0) {
      // Dwelling at an end.
      if (a.timer >= SKIFF_DWELL_S) {
        a.ext = 0;
        a.timer = 0;
        const v = this.host.world.getVoxel(a.x, a.y, a.z);
        this.host.hold(() => this.host.world.setVoxel(a.x, a.y, a.z, makeVoxel(voxelId(v), FLIP[voxelFacing(v)], voxelActive(v)), 'sim'));
      }
      this.preview(a, null);
      return;
    }
    if (a.timer >= SKIFF_STEP_S) {
      if (!this.host.gate(a.x, a.y, a.z)) {
        this.preview(a, null);
        return;
      }
      a.timer = 0;
      this.finishSkiff(a);
      return;
    }
    this.preview(a, this.planSkiff(a));
  }

  private planSkiff(a: Act): StepPlan | null {
    if (!this.host.gate(a.x, a.y, a.z)) return null;
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const next: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    if (this.host.world.getBlock(next[0], next[1] - 1, next[2]).key !== 'rail' || this.host.world.getBlock(...next).key !== 'air') return null;
    const moves = new Map<string, Move>();
    moves.set(k3(a.x, a.y, a.z), { to: next, turn: 0 });
    if (!this.fits(moves)) return null;
    return { moves, pivot: null, turn: 0 };
  }

  private finishSkiff(a: Act): void {
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const next: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    const ok = this.host.world.getBlock(next[0], next[1] - 1, next[2]).key === 'rail' && this.host.world.getBlock(...next).key === 'air';
    if (!ok) {
      a.ext = 1;
      this.preview(a, null);
      return;
    }
    const moves = new Map<string, Move>();
    moves.set(k3(a.x, a.y, a.z), { to: next, turn: 0 });
    this.commit(moves, (e) => { e.x += dx; e.z += dz; });
    this.host.bus.emit('sfx', { name: 'step', x: next[0] + 0.5, y: next[1] + 0.5, z: next[2] + 0.5, volume: 0.3 });
    const landed = this.acts.get(k3(...next)) ?? a;
    this.preview(landed, this.planSkiff(landed));
  }

  describe(x: number, y: number, z: number): string | null {
    const a = this.acts.get(k3(x, y, z));
    if (!a) return null;
    const rpm = this.host.signedRpm(x, y, z);
    if (a.kind === 'piston') return `Piston - ${rpm === 0 ? 'still' : 'pushing'}, extended ${a.ext} of ${PISTON_MAX}`;
    if (a.kind === 'bearing') return `Bearing - ${rpm === 0 ? 'still' : rpm > 0 ? 'turning right' : 'turning left'}`;
    return `Skiff - ${a.ext > 0 ? 'waiting at the end of the rail' : 'rolling'}`;
  }

  toJSON(): [number, number, number, number][] {
    return [...this.acts.values()].filter((a) => a.kind === 'piston' && a.ext > 0).map((a) => [a.x, a.y, a.z, a.ext]);
  }

  load(raw: unknown): void {
    for (const row of Array.isArray(raw) ? raw : []) {
      if (!Array.isArray(row) || row.length !== 4) continue;
      const a = this.acts.get(k3(row[0], row[1], row[2]));
      if (a && a.kind === 'piston' && typeof row[3] === 'number') a.ext = Math.max(0, Math.min(PISTON_MAX, Math.floor(row[3])));
    }
  }
}
