/**
 * Moving contraptions of the Bronze workshop (docs/OVERHAUL_PLAN.md A.8): pistons push and pull a structure, bearings turn one,
 * skiffs ride rails. A structure is the face-connected set of "movable" blocks (contraption frames and every workshop part:
 * shafts, belts, machines, depots, levers...) that touches the actuator; terrain, crates and other actuators never move.
 * A step moves every block of the structure at once: the voxels, the Workshop's per-block state (machine buffers, depot
 * stacks, arm settings, cranks) and any loose item lying on a moved block, so a belt keeps carrying its load.
 * Steps are discrete, one block (piston) or a quarter turn (bearing) at a time, with a sound.
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

interface Act { kind: string; x: number; y: number; z: number; timer: number; ext: number }

export class Contraptions {
  private readonly acts = new Map<string, Act>();
  private warned = 0;

  constructor(private readonly host: ContraptionHost) {}

  noteBlock(x: number, y: number, z: number, kind: string): void {
    const key = k3(x, y, z);
    if (ACTS.has(kind)) {
      if (this.acts.get(key)?.kind !== kind) this.acts.set(key, { kind, x, y, z, timer: 0, ext: 0 });
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

  /** Moves every cell of `moves` (from -> to, facing turned by `turn` quarter turns) at once; false when something is in the way. */
  private commit(moves: Map<string, { to: [number, number, number]; turn: number }>, item: (e: GroundItem, to: [number, number, number], from: [number, number, number]) => void): boolean {
    const world = this.host.world;
    const targets = new Set<string>();
    for (const { to } of moves.values()) targets.add(k3(...to));
    for (const { to } of moves.values()) {
      if (to[1] < 0 || to[1] > 250) return false;
      const key = k3(...to);
      if (moves.has(key)) continue;
      const b = world.getBlock(...to);
      if (b.key !== 'air' && !(b.solid === false && b.liquid === null && !b.machine)) return false;
    }
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
    for (const [key, list] of itemCells) for (const e of list) item(e, (moves.get(key) as { to: [number, number, number] }).to, parse(key));
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

  private piston(a: Act): void {
    if (a.timer < PISTON_STEP_S) return;
    a.timer = 0;
    const rpm = this.host.signedRpm(a.x, a.y, a.z);
    const powered = rpm !== 0 && this.host.gate(a.x, a.y, a.z);
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const front: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    if (powered && a.ext < PISTON_MAX) {
      const s = this.structure(front);
      if (s === null) return this.toast('The contraption is too big to push (48 blocks)');
      const moves = new Map<string, { to: [number, number, number]; turn: number }>();
      for (const key of s) {
        const [x, y, z] = parse(key);
        moves.set(key, { to: [x + dx, y, z + dz], turn: 0 });
      }
      if (!this.commit(moves, (e) => { e.x += dx; e.z += dz; })) return this.toast('Something blocks the piston');
      this.host.world.setVoxel(...front, makeVoxel(blockId('contraption_frame')), 'sim');
      a.ext++;
      this.host.bus.emit('sfx', { name: 'pipe_clunk', x: a.x + 0.5, y: a.y + 0.5, z: a.z + 0.5, pitch: 0.7 });
    } else if (!powered && a.ext > 0) {
      const s = this.structure(front);
      if (s === null) return;
      const rest = s.filter((k) => k !== k3(...front));
      const moves = new Map<string, { to: [number, number, number]; turn: number }>();
      for (const key of rest) {
        const [x, y, z] = parse(key);
        moves.set(key, { to: [x - dx, y, z - dz], turn: 0 });
      }
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
    if (a.timer < BEARING_STEP_S) return;
    const rpm = this.host.signedRpm(a.x, a.y, a.z);
    if (rpm === 0 || !this.host.gate(a.x, a.y, a.z)) return;
    a.timer = 0;
    const s = this.structure([a.x, a.y + 1, a.z]);
    if (s === null) return this.toast('The contraption is too big to turn (48 blocks)');
    if (s.length === 0) return;
    const cw = rpm > 0;
    const moves = new Map<string, { to: [number, number, number]; turn: number }>();
    for (const key of s) {
      const [x, y, z] = parse(key);
      const rx = x - a.x;
      const rz = z - a.z;
      moves.set(key, { to: cw ? [a.x - rz, y, a.z + rx] : [a.x + rz, y, a.z - rx], turn: cw ? 1 : -1 });
    }
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
      if (a.timer < SKIFF_DWELL_S) return;
      a.ext = 0;
      a.timer = 0;
      const v = this.host.world.getVoxel(a.x, a.y, a.z);
      this.host.hold(() => this.host.world.setVoxel(a.x, a.y, a.z, makeVoxel(voxelId(v), FLIP[voxelFacing(v)], voxelActive(v)), 'sim'));
      return;
    }
    if (a.timer < SKIFF_STEP_S) return;
    if (!this.host.gate(a.x, a.y, a.z)) return;
    a.timer = 0;
    const f = voxelFacing(this.host.world.getVoxel(a.x, a.y, a.z));
    const [dx, dz] = DELTA[f];
    const next: [number, number, number] = [a.x + dx, a.y, a.z + dz];
    const ok = this.host.world.getBlock(next[0], next[1] - 1, next[2]).key === 'rail' && this.host.world.getBlock(...next).key === 'air';
    if (!ok) {
      a.ext = 1;
      return;
    }
    const moves = new Map<string, { to: [number, number, number]; turn: number }>();
    moves.set(k3(a.x, a.y, a.z), { to: next, turn: 0 });
    this.commit(moves, (e) => { e.x += dx; e.z += dz; });
    this.host.bus.emit('sfx', { name: 'step', x: next[0] + 0.5, y: next[1] + 0.5, z: next[2] + 0.5, volume: 0.3 });
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
