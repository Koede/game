/**
 * Lifts and elevators (docs/api/lifts.md). A winch (`lift_winch`, `elevator_winch`) is a workshop part at the lip of a
 * shaft or a cliff: its cage hangs in the open column beside it (preferably the side away from where you stood to place
 * it) and runs from the winch's own level down to the shaft floor or the end of its rope. The cage stops at landings:
 * any level where a cell beside the column (diagonals too) has a floor and two free cells over it, i.e. a tunnel, a ledge
 * or the ground round the top of the hole. The shaft floor is a landing too.
 *
 * Moving takes the winch's shaft turning: speed `stats.speed x rpm / 16` blocks a second, eased in and out. Stopped, the
 * brake holds the cage, except with someone in it: then it lets them down slowly to the landing below, so nobody is stuck
 * between levels when the engine dies.
 *
 * The rider (like the tractor driver, src/vehicles/manager.ts) is carried: their feet are the cage floor, no gravity, look
 * stays free. Jump (or forward) = up to the next landing, Mine (or back) = down, Use = step out onto the landing they look
 * towards. Walking into the cage boards it; tapping the cage (or its rope, or the winch) calls it to your level, or boards it
 * and sets off when it is already there.
 *
 * Pure of the DOM. `handle(intent, dt)` runs once a frame (game.ts wraps the input with it); headless code calls `update`.
 */
import type { GameBus } from '../core/context';
import { REACH } from '../core/constants';
import type { Vec3 } from '../core/math';
import { blockOrNull } from '../core/registry';
import { Facing, voxelFacing, type IWorld } from '../core/types';
import type { Intent } from '../player/input/intent';
import { createRayHit, raycast } from '../player/raycast';
import { isWinch, LIFT_WINCHES, type WinchKind } from './liftParts';

export interface WinchStats {
  name: string;
  /** Blocks of rope or chain under the winch's level. */
  cable: number;
  /** Blocks a second at 16 rpm, and at most. */
  speed: number;
  max: number;
  /** Blocks a second squared, speeding up and slowing down. */
  accel: number;
}

export const WINCH_STATS: Record<WinchKind, WinchStats> = {
  lift_winch: { name: 'lift', cable: 40, speed: 2.5, max: 6, accel: 5 },
  elevator_winch: { name: 'elevator', cable: 160, speed: 5, max: 12, accel: 10 },
};
/** How fast an unpowered cage with a rider lets them down. */
export const SINK_SPEED = 1;
/** Height of the cage frame over its floor (drawn; a player is 1.8). */
export const CAGE_HEIGHT = 2.2;
/** The headframe's sheave over the top of the shaft, above the winch's level. */
export const HEAD_HEIGHT = 2.7;
/** Seconds after boarding or stepping out before Use means anything again. */
const COOLDOWN_S = 0.5;

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
/** Away from the placer (a block's front faces the player who placed it), then towards them, then the sides. */
const SIDE_ORDER: Record<number, [number, number][]> = {
  [Facing.North]: [[0, 1], [0, -1], [1, 0], [-1, 0]],
  [Facing.South]: [[0, -1], [0, 1], [1, 0], [-1, 0]],
  [Facing.East]: [[-1, 0], [1, 0], [0, 1], [0, -1]],
  [Facing.West]: [[1, 0], [-1, 0], [0, 1], [0, -1]],
};
const RING: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export interface Lift {
  key: string;
  kind: WinchKind;
  x: number;
  y: number;
  z: number;
  /** The cage floor (continuous y). */
  floor: number;
  /** Landing it is heading for, or null at rest. */
  target: number | null;
  /** Signed speed, blocks a second (+ up). */
  v: number;
  /** The shaft column, or null when no side of the winch is open. */
  sx: number | null;
  sz: number | null;
  /** Sheave turn (radians), for the renderer. */
  turn: number;
  /** Distance since the last clank. */
  clank: number;
  /** Warned about no power for this request. */
  warned: boolean;
}

export interface LiftView {
  key: string;
  kind: WinchKind;
  x: number;
  y: number;
  z: number;
  sx: number;
  sz: number;
  floor: number;
  turn: number;
  moving: boolean;
  occupied: boolean;
}

export interface LiftStatus {
  name: string;
  depth: number;
  moving: -1 | 0 | 1;
  powered: boolean;
  /** At rest on a landing it can step out onto. */
  landing: boolean;
  /** Landings above and below the cage. */
  above: number;
  below: number;
}

export interface LiftSnapshot {
  v: 1;
  lifts: [number, number, number, string, number][];
}

/** What the lifts need of the player (PlayerState fits). */
export interface LiftPlayer {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly eyeY: number;
  dead: boolean;
  sprinting: boolean;
  viewDir(out: Vec3): Vec3;
  heldStack(): { item: string; count: number } | null;
}

export interface LiftHost {
  world: IWorld;
  bus: GameBus;
  /** Signed rpm of the workshop part at the cell (0 = still). */
  rpmAt: (x: number, y: number, z: number) => number;
  player?: LiftPlayer;
}

export class Lifts {
  private readonly lifts = new Map<string, Lift>();
  /** The lift the player rides, or null. */
  riding: Lift | null = null;
  private cooldown = 0;
  private lastJump = false;
  private lastMine = false;
  private lastFwd = false;
  private lastBack = false;
  private hintS = 0;
  /** The player stepped out of a cage and has not left its column yet (no boarding again by standing there). */
  private stepOut: string | null = null;
  private physics: { reset(): void } | null = null;
  private readonly hit = createRayHit();
  private readonly dir: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly off: () => void;
  /** Landings per lift, until the next block change anywhere. */
  private readonly stopMemo = new Map<string, number[]>();

  constructor(private readonly host: LiftHost) {
    this.off = host.bus.on('block:changed', (e) => this.noteBlock(e.x, e.y, e.z));
  }

  dispose(): void {
    this.off();
  }

  /** The player controller's physics: its fall is forgotten while the player is carried. */
  bindPhysics(physics: { reset(): void }): void {
    this.physics = physics;
  }

  // ---- the lifts ---------------------------------------------------------------------------------------------------

  private noteBlock(x: number, y: number, z: number): void {
    this.stopMemo.clear();
    const key = k3(x, y, z);
    const kind = this.host.world.getBlock(x, y, z).key;
    const had = this.lifts.get(key);
    if (isWinch(kind)) {
      if (!had || had.kind !== kind) {
        const l = this.create(key, kind, x, y, z, y);
        this.lifts.set(key, l);
        this.findShaft(l);
        if (l.sx === null) this.host.bus.emit('toast', { text: `A ${WINCH_STATS[kind].name} needs an open shaft or a drop beside it`, kind: 'info' });
      }
      return;
    }
    if (had) this.remove(had);
    // A block set into a shaft: the cages there are checked as they move; a winch whose side closed finds another.
    for (const l of this.lifts.values()) if (l.sx === x && l.sz === z && y <= l.y && y >= l.y - WINCH_STATS[l.kind].cable && l !== this.riding) this.findShaft(l);
  }

  private create(key: string, kind: WinchKind, x: number, y: number, z: number, floor: number): Lift {
    return { key, kind, x, y, z, floor, target: null, v: 0, sx: null, sz: null, turn: 0, clank: 0, warned: false };
  }

  private remove(l: Lift): void {
    this.lifts.delete(l.key);
    if (this.riding === l) this.riding = null;
  }

  private solid(x: number, y: number, z: number): boolean {
    return this.host.world.getBlock(x, y, z).solid;
  }

  /** The open column beside the winch: free at the winch's level and the one below. */
  private findShaft(l: Lift): void {
    const facing = voxelFacing(this.host.world.getVoxel(l.x, l.y, l.z));
    l.sx = l.sz = null;
    for (const [dx, dz] of SIDE_ORDER[facing] ?? SIDE_ORDER[Facing.North]) {
      const x = l.x + dx;
      const z = l.z + dz;
      if (!this.solid(x, l.y, z) && !this.solid(x, l.y - 1, z)) {
        l.sx = x;
        l.sz = z;
        return;
      }
    }
  }

  /** Lowest floor the cage can reach (the shaft floor or the end of the rope). */
  bottomOf(l: Lift): number {
    if (l.sx === null || l.sz === null) return l.y;
    const end = l.y - WINCH_STATS[l.kind].cable;
    for (let y = l.y; y > end; y--) if (this.solid(l.sx, y - 1, l.sz)) return y;
    return end;
  }

  /** Cells round the shaft at level `L` a player can stand on (diagonals too), never the winch. */
  landingsAt(l: Lift, L: number): [number, number][] {
    if (l.sx === null || l.sz === null) return [];
    const out: [number, number][] = [];
    for (const [dx, dz] of RING) {
      const x = l.sx + dx;
      const z = l.sz + dz;
      if (x === l.x && z === l.z && L === l.y) continue;
      if (this.solid(x, L - 1, z) && !this.solid(x, L, z) && !this.solid(x, L + 1, z)) out.push([x, z]);
    }
    return out;
  }

  /** Every landing from the top down. */
  stops(l: Lift): number[] {
    if (l.sx === null || l.sz === null) return [];
    const memo = this.stopMemo.get(`${l.key}|${l.sx},${l.sz}`);
    if (memo) return memo;
    const bottom = this.bottomOf(l);
    const out: number[] = [];
    for (let L = l.y; L >= bottom; L--) {
      if (this.landingsAt(l, L).length > 0 || (L === bottom && this.solid(l.sx, L - 1, l.sz))) out.push(L);
    }
    this.stopMemo.set(`${l.key}|${l.sx},${l.sz}`, out);
    return out;
  }

  get(x: number, y: number, z: number): Lift | null {
    return this.lifts.get(k3(x, y, z)) ?? null;
  }

  all(): Lift[] {
    return [...this.lifts.values()];
  }

  /** Sends the cage to a landing. False (and a toast) when it cannot go. */
  send(l: Lift, to: number): boolean {
    if (l.sx === null) this.findShaft(l);
    if (l.sx === null) {
      this.host.bus.emit('toast', { text: `The ${WINCH_STATS[l.kind].name} has no open shaft beside it`, kind: 'info' });
      return false;
    }
    if (Math.abs(to - l.floor) < 0.01 && l.v === 0) {
      l.target = null;
      return true;
    }
    l.target = to;
    l.warned = false;
    if (this.rpm(l) === 0) this.warnPower(l);
    else this.host.bus.emit('sfx', { name: 'machine_on', x: l.x + 0.5, y: l.y + 0.5, z: l.z + 0.5, pitch: l.kind === 'elevator_winch' ? 0.6 : 0.9, volume: 0.5 });
    return true;
  }

  private rpm(l: Lift): number {
    return Math.abs(this.host.rpmAt(l.x, l.y, l.z));
  }

  private warnPower(l: Lift): void {
    if (l.warned) return;
    l.warned = true;
    this.host.bus.emit('toast', { text: `The ${WINCH_STATS[l.kind].name} winch is not turning: join it to a shaft from a steam engine, mill wheel or wound clockwork motor`, kind: 'warn' });
  }

  /** Moves every cage; call once a frame. */
  update(dt: number): void {
    const { world } = this.host;
    for (const l of this.lifts.values()) {
      if (!world.isLoaded(l.x, l.z)) continue;
      if (!isWinch(world.getBlock(l.x, l.y, l.z).key)) {
        this.remove(l);
        continue;
      }
      if (l.target === null || l.sx === null || l.sz === null) {
        l.v = 0;
        continue;
      }
      const ridden = this.riding === l;
      const rpm = this.rpm(l);
      const st = WINCH_STATS[l.kind];
      let vmax = rpm > 0 ? Math.max(0.5, Math.min(st.max, (st.speed * rpm) / 16)) : 0;
      if (rpm === 0) {
        if (!ridden) {
          l.v = 0;
          continue;
        }
        // The brake lets a rider down to the landing below.
        this.warnPower(l);
        {
          const below = this.stops(l).find((s) => s <= l.floor + 0.001);
          if (below === undefined) {
            l.v = 0;
            continue;
          }
          l.target = below;
        }
        vmax = SINK_SPEED;
      }
      const dist = l.target - l.floor;
      const dir = Math.sign(dist);
      const brake = Math.sqrt(2 * st.accel * Math.abs(dist));
      const want = dir * Math.min(vmax, brake + 0.15);
      l.v = l.v < want ? Math.min(want, l.v + st.accel * dt) : Math.max(want, l.v - st.accel * dt);
      let next = l.floor + l.v * dt;
      if ((dir > 0 && next >= l.target) || (dir < 0 && next <= l.target)) next = l.target;
      // Something built into the shaft stops the cage short of it.
      if (dir < 0 && this.solid(l.sx, Math.floor(next), l.sz)) next = Math.floor(next) + 1;
      const head = Math.floor(next + 1.9);
      if (dir > 0 && head <= l.y && this.solid(l.sx, head, l.sz)) next = Math.max(l.floor, head - 2);
      if (next !== l.target && ((dir < 0 && next > l.floor + l.v * dt + 1e-9) || (dir > 0 && next < l.floor + l.v * dt - 1e-9))) l.target = next;
      const moved = Math.abs(next - l.floor);
      l.turn += (next - l.floor) / 0.35;
      l.clank += moved;
      if (l.clank >= 1) {
        l.clank = 0;
        this.host.bus.emit('sfx', { name: l.kind === 'elevator_winch' ? 'step_metal' : 'step_wood', x: l.sx + 0.5, y: next + 1, z: l.sz + 0.5, pitch: 0.6, volume: 0.35 });
      }
      l.floor = next;
      if (next === l.target || moved < 1e-6) this.arrive(l);
    }
  }

  private arrive(l: Lift): void {
    l.target = null;
    l.v = 0;
    l.warned = false;
    this.host.bus.emit('sfx', { name: 'dig_metal', x: (l.sx ?? l.x) + 0.5, y: l.floor + 0.5, z: (l.sz ?? l.z) + 0.5, pitch: 0.7, volume: 0.6 });
    const p = this.host.player;
    if (this.riding === l) {
      const depth = Math.round(l.y - l.floor);
      const where = depth === 0 ? 'Top landing' : `Landing ${depth} down`;
      this.host.bus.emit('toast', { text: this.canStepOut(l) ? `${where} - Exit to step out, Up / Down to ride on` : `${where} - no way out here, ride on`, kind: 'info' });
    } else if (p && l.sx !== null && l.sz !== null && Math.hypot(p.position.x - l.sx - 0.5, p.position.z - l.sz - 0.5) < 4 && Math.abs(p.position.y - l.floor) < 1.5) {
      this.host.bus.emit('toast', { text: `The ${WINCH_STATS[l.kind].name} is here - step in or tap the cage`, kind: 'info' });
    }
  }

  private canStepOut(l: Lift): boolean {
    return this.exitSpot(l, null) !== null;
  }

  // ---- the rider ---------------------------------------------------------------------------------------------------

  /** The cage the player is in: depth, landings, power (for the HUD). Null on foot. */
  status(): LiftStatus | null {
    const l = this.riding;
    if (!l) return null;
    const stops = this.stops(l);
    return {
      name: WINCH_STATS[l.kind].name,
      depth: Math.max(0, Math.round(l.y - l.floor)),
      moving: l.v > 0.05 ? 1 : l.v < -0.05 ? -1 : 0,
      powered: this.rpm(l) > 0,
      landing: l.target === null && this.canStepOut(l),
      above: stops.filter((s) => s > l.floor + 0.5).length,
      below: stops.filter((s) => s < l.floor - 0.5).length,
    };
  }

  views(): LiftView[] {
    const out: LiftView[] = [];
    for (const l of this.lifts.values()) {
      if (l.sx === null || l.sz === null) continue;
      out.push({ key: l.key, kind: l.kind, x: l.x, y: l.y, z: l.z, sx: l.sx, sz: l.sz, floor: l.floor, turn: l.turn, moving: l.v !== 0, occupied: this.riding === l });
    }
    return out;
  }

  /** Goggles text for a winch. */
  describe(x: number, y: number, z: number): string | null {
    const l = this.get(x, y, z);
    if (!l) return null;
    if (l.sx === null) this.findShaft(l);
    if (l.sx === null) return 'no open shaft beside it';
    const depth = Math.round(l.y - l.floor);
    const n = this.stops(l).length;
    return `cage ${depth === 0 ? 'at the top' : `${depth} down`}, ${n} landing${n === 1 ? '' : 's'}, ${this.bottomOf(l) <= l.y - WINCH_STATS[l.kind].cable ? 'rope ends in the air' : `${l.y - this.bottomOf(l)} deep`}`;
  }

  /** Climbs into the cage. `go`: set off for the next landing at once (tapped, not walked in). */
  board(l: Lift, go: boolean): void {
    const p = this.host.player;
    if (!p) return;
    this.riding = l;
    this.cooldown = COOLDOWN_S;
    this.stepOut = null;
    p.sprinting = false;
    this.carry();
    const stops = this.stops(l);
    const below = stops.find((s) => s < l.floor - 0.5);
    const above = [...stops].reverse().find((s) => s > l.floor + 0.5);
    const name = WINCH_STATS[l.kind].name;
    if (go && (below !== undefined || above !== undefined)) {
      this.send(l, below ?? (above as number));
      this.host.bus.emit('toast', { text: `${below !== undefined ? 'Going down' : 'Going up'} - Up / Down pick the landing, Exit steps out`, kind: 'info' });
    } else this.host.bus.emit('toast', { text: `In the ${name} cage - Up / Down pick the landing, Exit steps out`, kind: 'info' });
    this.host.bus.emit('sfx', { name: 'step_metal', x: (l.sx ?? l.x) + 0.5, y: l.floor + 0.2, z: (l.sz ?? l.z) + 0.5, pitch: 0.8, volume: 0.5 });
  }

  /** Steps out onto the landing looked towards (or the shaft floor). False when there is none here. */
  leave(): boolean {
    const l = this.riding;
    const p = this.host.player;
    if (!l || !p) return false;
    if (l.target !== null || Math.abs(l.v) > 0.01) {
      this.host.bus.emit('toast', { text: 'Wait for the cage to stop at a landing', kind: 'info' });
      return false;
    }
    p.viewDir(this.dir);
    const spot = this.exitSpot(l, this.dir);
    if (!spot) {
      this.host.bus.emit('toast', { text: 'No landing here - ride Up or Down', kind: 'info' });
      return false;
    }
    this.riding = null;
    this.cooldown = COOLDOWN_S;
    this.stepOut = l.key;
    p.position.x = spot.x;
    p.position.y = spot.y;
    p.position.z = spot.z;
    p.velocity.x = p.velocity.y = p.velocity.z = 0;
    this.physics?.reset();
    return true;
  }

  /** Where the rider steps out: the landing cell nearest the way they look, else the shaft floor. */
  private exitSpot(l: Lift, look: Vec3 | null): { x: number; y: number; z: number } | null {
    if (l.sx === null || l.sz === null || Math.abs(l.floor - Math.round(l.floor)) > 0.01) return null;
    const L = Math.round(l.floor);
    const cells = this.landingsAt(l, L);
    let best: [number, number] | null = null;
    let score = -Infinity;
    for (const [x, z] of cells) {
      const dx = x - l.sx;
      const dz = z - l.sz;
      const len = Math.hypot(dx, dz);
      // Straight sides first; then the one most in front of the player.
      const s = (look ? (dx * look.x + dz * look.z) / len : 0) + (len > 1.1 ? -0.3 : 0);
      if (s > score) {
        score = s;
        best = [x, z];
      }
    }
    if (best) return { x: best[0] + 0.5, y: L, z: best[1] + 0.5 };
    if (this.solid(l.sx, L - 1, l.sz)) return { x: l.sx + 0.5, y: L, z: l.sz + 0.5 };
    return null;
  }

  /** The player rides along: feet on the cage floor, nothing falling. True while carried. */
  carry(): boolean {
    const l = this.riding;
    const p = this.host.player;
    if (!l || !p || l.sx === null || l.sz === null) return false;
    p.position.x = l.sx + 0.5;
    p.position.y = l.floor + 0.02;
    p.position.z = l.sz + 0.5;
    p.velocity.x = p.velocity.y = p.velocity.z = 0;
    this.physics?.reset();
    return true;
  }

  /** One frame of the player's intent (returns the same object, changed while riding or when Use was meant for a lift). */
  handle(intent: Intent, dt: number): Intent {
    const p = this.host.player;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hintS = Math.max(0, this.hintS - dt);
    this.update(dt);
    if (!p) return intent;
    if (this.riding && (p.dead || !this.lifts.has(this.riding.key))) this.riding = null;
    if (this.riding) return this.ride(intent);
    this.lastJump = intent.jump;
    this.lastMine = intent.mine;
    if (p.dead) return intent;
    if (intent.use && this.cooldown <= 0 && this.onFoot()) {
      intent.use = false;
      intent.place = false;
      return intent;
    }
    this.walkIn();
    return intent;
  }

  private ride(intent: Intent): Intent {
    const l = this.riding as Lift;
    const up = (intent.jump && !this.lastJump) || (intent.moveZ > 0.6 && !this.lastFwd);
    const down = (intent.mine && !this.lastMine) || (intent.moveZ < -0.6 && !this.lastBack);
    this.lastJump = intent.jump;
    this.lastMine = intent.mine;
    this.lastFwd = intent.moveZ > 0.6;
    this.lastBack = intent.moveZ < -0.6;
    const strayTap = intent.use && intent.worldTap;
    const exit = intent.use && this.cooldown <= 0 && !strayTap;
    if (strayTap && this.hintS <= 0) {
      this.hintS = 6;
      this.host.bus.emit('toast', { text: 'Tap Exit to step out, Up or Down to ride', kind: 'info' });
    }
    intent.moveX = intent.moveZ = 0;
    intent.jump = false;
    intent.sprint = false;
    intent.sneak = false;
    intent.mine = false;
    intent.use = false;
    intent.place = false;
    if (exit) {
      this.cooldown = COOLDOWN_S;
      if (this.leave()) return intent;
    }
    if (up || down) {
      const stops = this.stops(l);
      const from = l.target ?? l.floor;
      const to = up ? [...stops].reverse().find((s) => s > from + 0.5) : stops.find((s) => s < from - 0.5);
      if (to === undefined) this.host.bus.emit('toast', { text: up ? 'This is the top landing' : 'This is the bottom of the shaft', kind: 'info' });
      else this.send(l, to);
    }
    this.carry();
    return intent;
  }

  /** Use on foot: true when it was meant for a lift (and has been done). */
  private onFoot(): boolean {
    const p = this.host.player as LiftPlayer;
    const { world } = this.host;
    p.viewDir(this.dir);
    const d = this.dir;
    const ox = p.position.x;
    const oy = p.eyeY;
    const oz = p.position.z;
    const block = raycast(world, ox, oy, oz, d.x, d.y, d.z, REACH, false, this.hit);
    const maxD = block ? Math.min(REACH, block.distance + 0.01) : REACH;
    let target: Lift | null = null;
    let best = Infinity;
    for (const l of this.lifts.values()) {
      if (l.sx === null || l.sz === null) continue;
      const cage = rayBox(ox, oy, oz, d.x, d.y, d.z, l.sx + 0.05, l.floor, l.sz + 0.05, l.sx + 0.95, l.floor + CAGE_HEIGHT, l.sz + 0.95);
      const rope = rayBox(ox, oy, oz, d.x, d.y, d.z, l.sx + 0.35, l.floor + CAGE_HEIGHT, l.sz + 0.35, l.sx + 0.65, l.y + HEAD_HEIGHT, l.sz + 0.65);
      for (const t of [cage, rope]) {
        if (t !== null && t <= maxD && t < best) {
          best = t;
          target = l;
        }
      }
    }
    // The winch block itself, unless a block in hand is to be placed against it.
    const held = p.heldStack();
    if (!target && block && isWinch(block.block.key) && !(held && blockOrNull(held.item))) target = this.get(block.x, block.y, block.z);
    if (!target) return false;
    this.cooldown = COOLDOWN_S;
    this.tapped(target);
    return true;
  }

  private tapped(l: Lift): void {
    const p = this.host.player as LiftPlayer;
    if (l.sx === null) this.findShaft(l);
    if (l.sx === null || l.sz === null) {
      this.host.bus.emit('toast', { text: `A ${WINCH_STATS[l.kind].name} needs an open shaft or a drop beside it`, kind: 'info' });
      return;
    }
    const near = Math.hypot(p.position.x - l.sx - 0.5, p.position.z - l.sz - 0.5) < 1.9 && Math.abs(p.position.y - l.floor) < 1.3 && Math.abs(l.v) < 0.5;
    if (near) {
      this.board(l, true);
      return;
    }
    const stops = this.stops(l);
    if (stops.length === 0) {
      this.host.bus.emit('toast', { text: 'No landing on this shaft yet: dig a ledge or a tunnel beside it', kind: 'info' });
      return;
    }
    const feet = Math.round(p.position.y);
    const to = stops.reduce((a, b) => (Math.abs(b - feet) < Math.abs(a - feet) ? b : a));
    if (Math.abs(to - l.floor) < 0.01 && l.target === null) {
      this.host.bus.emit('toast', { text: 'The cage is waiting at that landing', kind: 'info' });
      return;
    }
    if (this.send(l, to) && this.rpm(l) > 0) this.host.bus.emit('toast', { text: `Calling the ${WINCH_STATS[l.kind].name}`, kind: 'info' });
  }

  /** Walking into a waiting cage boards it; the column a rider just stepped out of is left alone until they leave it. */
  private walkIn(): void {
    const p = this.host.player as LiftPlayer;
    const px = Math.floor(p.position.x);
    const pz = Math.floor(p.position.z);
    if (this.stepOut) {
      const l = this.lifts.get(this.stepOut);
      if (!l || l.sx !== px || l.sz !== pz) this.stepOut = null;
      else return;
    }
    if (this.cooldown > 0) return;
    for (const l of this.lifts.values()) {
      if (l.sx !== px || l.sz !== pz || l.target !== null) continue;
      const dy = p.position.y - l.floor;
      if (dy > -0.6 && dy < 0.9) {
        this.board(l, false);
        return;
      }
    }
  }

  // ---- saving ------------------------------------------------------------------------------------------------------

  toJSON(): LiftSnapshot {
    const lifts: LiftSnapshot['lifts'] = [];
    for (const l of this.lifts.values()) lifts.push([l.x, l.y, l.z, l.kind, Math.round((l.target ?? l.floor) * 100) / 100]);
    return { v: 1, lifts };
  }

  /** Replaces everything with saved data; nobody rides afterwards. Bad entries are dropped. */
  load(raw: unknown): void {
    this.lifts.clear();
    this.riding = null;
    const o = raw && typeof raw === 'object' ? (raw as Partial<LiftSnapshot>) : null;
    if (!o || !Array.isArray(o.lifts)) return;
    for (const e of o.lifts) {
      if (!Array.isArray(e) || e.length < 5) continue;
      const [x, y, z, kind, floor] = e;
      if (![x, y, z].every((n) => Number.isInteger(n)) || !(LIFT_WINCHES as readonly string[]).includes(kind) || !Number.isFinite(floor)) continue;
      const st = WINCH_STATS[kind as WinchKind];
      const l = this.create(k3(x, y, z), kind as WinchKind, x, y, z, Math.max(y - st.cable, Math.min(y, Math.round(floor))));
      this.lifts.set(l.key, l);
    }
  }

  /** Finds each loaded lift's shaft again (after a load, once chunks are in). */
  settle(): void {
    this.stopMemo.clear();
    for (const l of this.lifts.values()) if (l.sx === null && this.host.world.isLoaded(l.x, l.z)) this.findShaft(l);
  }
}

/** Distance along the ray to an axis-aligned box, or null (slab method). */
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const lo = [x0, y0, z0];
  const hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
      continue;
    }
    let t1 = (lo[i] - o[i]) / d[i];
    let t2 = (hi[i] - o[i]) / d[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Puts the lifts between an intent source and whatever reads it (game.ts: inside the vehicles' wrapper). */
export function wrapLiftIntent<T extends { frame(dt: number): Intent }>(source: T, lifts: Lifts): T {
  return new Proxy(source, {
    get(target, prop) {
      if (prop === 'frame') return (dt: number): Intent => lifts.handle(target.frame(dt), dt);
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
