/**
 * The VehicleManager (docs/api/tractor.md): every tractor in the world, who is driving, and what the player's controls
 * mean while they are. DOM-free.
 *
 * The manager sits between the input and the PlayerController (`wrapIntentSource`): each frame it looks at the
 * Intent the player produced and either leaves it alone (on foot, nothing aimed at) or takes it over:
 *
 *  ON FOOT   Use on a tractor (aimed, nearer than any block) climbs aboard; with a fuel canister in hand it refuels, with
 *            an attachment in hand it fits it (the old one returns to the pack), with Shift/Place held it picks the
 *            tractor up. Use with a Tractor item on the ground sets one down.
 *  DRIVING   move = throttle and steering, Mine or F = work the attachment (held repeats), R or Jump = swap
 *            attachment, Use = get off; look turns the head, not the machine. The player is carried: their position
 *            is the seat, their yaw the machine's heading plus the head turn. Everything else is zeroed in the
 *            Intent so the controller neither walks, mines nor places.
 */
import { fuelGrade } from '../core/distill';
import type { GameBus } from '../core/context';
import { REACH } from '../core/constants';
import { FLAG_DROVE_TRACTOR } from '../core/constants';
import type { Vec3 } from '../core/math';
import { Face, type IWorld } from '../core/types';
import { itemOrNull } from '../core/registry';
import type { PlayerState } from '../game';
import type { Intent } from '../player/input/intent';
import { createRayHit, raycast } from '../player/raycast';
import { boxFree } from './collide';
import {
  ATTACHMENTS, ATTACHMENT_ITEM, BODY_HEIGHT, CANISTER_S, FUEL_ITEM, HALF_WIDTH, TANK_S, TRACTOR_ITEM, attachmentOfItem, createTractor,
  driveTractor, forward, fromSnapshot, right, seatOf, settleTractor, snapshotOf, type Attachment, type Tractor, type TractorSnapshot,
} from './tractor';
import { WORK_INTERVAL_S, workSwath } from './tractorWork';

/** Height of the box a ray must hit to pick a tractor: the cab frame and exhaust stand above the body. */
const AIM_HEIGHT = BODY_HEIGHT + 0.7;
/** Seconds after climbing on or off before Use means anything again (a held Use repeats). */
export const USE_COOLDOWN_S = 0.6;
/** Head turn limit while driving (radians either way). */
export const LOOK_LIMIT = 2.3;
/** Longest physics step (a slow frame is split). */
const MAX_STEP_S = 0.025;
/** Seconds between engine chugs at idle and flat out. */
const CHUG_IDLE_S = 0.42;
const CHUG_FAST_S = 0.17;

export interface VehicleHost {
  world: IWorld;
  bus: GameBus;
  player: PlayerState;
  rng?: () => number;
  /** The controller's physics, to forget the fall in progress while carried (bindPhysics). */
}

/** What a renderer needs of a tractor. */
export interface TractorView {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  steer: number;
  roll: number;
  working: number;
  attachment: Attachment | null;
  occupied: boolean;
  /** Fuel 0..1. */
  fuel: number;
}

export interface VehicleSnapshot {
  next: number;
  tractors: TractorSnapshot[];
}

/** What the HUD shows while driving. */
export interface DriveStatus {
  fuel: number;
  attachment: Attachment | null;
  speed: number;
  working: boolean;
}

export class VehicleManager {
  readonly tractors = new Map<number, Tractor>();
  /** The tractor the player is driving, or null. */
  driving: Tractor | null = null;
  /** Head turn relative to the machine's heading while driving (radians). */
  lookOffset = 0;
  private nextId = 1;
  private cooldown = 0;
  private workKey = false;
  private swapKey = false;
  private lastJump = false;
  private workTimer = 0;
  private chug = 0;
  private lowFuelWarned = false;
  private physics: { reset(): void } | null = null;
  private readonly rng: () => number;
  private readonly hit = createRayHit();
  private readonly dir: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(private readonly host: VehicleHost) {
    this.rng = host.rng ?? Math.random;
  }

  /** The player controller's physics: its fall is forgotten every frame the player is carried. */
  bindPhysics(physics: { reset(): void }): void {
    this.physics = physics;
  }

  // ---- persistence ---------------------------------------------------------------------------------------------------

  toJSON(): VehicleSnapshot {
    return { next: this.nextId, tractors: [...this.tractors.values()].map(snapshotOf) };
  }

  /** Replaces everything with saved data (undefined or damaged: no tractors). Nobody is driving afterwards. */
  load(data: unknown): void {
    this.tractors.clear();
    this.driving = null;
    const o = data && typeof data === 'object' ? (data as Partial<VehicleSnapshot>) : null;
    if (!o || !Array.isArray(o.tractors)) return;
    for (const s of o.tractors) {
      const t = fromSnapshot(s);
      if (t && !this.tractors.has(t.id)) this.tractors.set(t.id, t);
    }
    const top = Math.max(0, ...[...this.tractors.keys()]);
    this.nextId = Math.max(typeof o.next === 'number' && Number.isFinite(o.next) ? Math.floor(o.next) : 1, top + 1);
  }

  // ---- the controls (DOM glue calls these) ---------------------------------------------------------------------------

  setWorkKey(down: boolean): void {
    this.workKey = down;
  }

  /** The swap key went down (one press = one swap). */
  pressSwapKey(): void {
    this.swapKey = true;
  }

  // ---- queries -------------------------------------------------------------------------------------------------------

  views(): TractorView[] {
    const out: TractorView[] = [];
    for (const t of this.tractors.values()) {
      out.push({
        id: t.id, x: t.x, y: t.y, z: t.z, yaw: t.yaw, steer: t.steer, roll: t.roll, working: t.working, attachment: t.attachment,
        occupied: t === this.driving, fuel: t.fuel / TANK_S,
      });
    }
    return out;
  }

  status(): DriveStatus | null {
    const t = this.driving;
    return t ? { fuel: t.fuel / TANK_S, attachment: t.attachment, speed: t.speed, working: t.working > 0.5 } : null;
  }

  // ---- placing and removing ------------------------------------------------------------------------------------------

  /** Sets a tractor down with its feet at (x, y, z). Returns it, or null when a solid block is in the way. */
  place(x: number, y: number, z: number, yaw: number, attachment: Attachment | null = null, fuel = 0): Tractor | null {
    if (!boxFree(this.host.world, { x, y, z }, HALF_WIDTH, BODY_HEIGHT)) return null;
    const t = createTractor(this.nextId++, x, y, z, yaw, attachment, fuel);
    this.tractors.set(t.id, t);
    return t;
  }

  /** The nearest tractor on the ray within `maxDist`, with its distance. */
  aim(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { tractor: Tractor; distance: number } | null {
    let best: { tractor: Tractor; distance: number } | null = null;
    for (const t of this.tractors.values()) {
      if (t === this.driving) continue;
      const d = rayBox(ox, oy, oz, dx, dy, dz, t.x - HALF_WIDTH, t.y, t.z - HALF_WIDTH, t.x + HALF_WIDTH, t.y + AIM_HEIGHT, t.z + HALF_WIDTH);
      if (d !== null && d <= maxDist && (!best || d < best.distance)) best = { tractor: t, distance: d };
    }
    return best;
  }

  // ---- actions -------------------------------------------------------------------------------------------------------

  enter(t: Tractor): void {
    const { player, bus } = this.host;
    this.driving = t;
    this.lookOffset = 0;
    this.cooldown = USE_COOLDOWN_S;
    this.workTimer = 0;
    this.lowFuelWarned = false;
    t.speed = 0;
    player.sprinting = false;
    bus.emit('flag', { flag: FLAG_DROVE_TRACTOR });
    if (t.fuel > 0) bus.emit('sfx', { name: 'engine_start', x: t.x, y: t.y + 1, z: t.z });
    const tip = t.fuel <= 0 ? 'Out of fuel - get off and feed it a Fuel Canister' : t.attachment ? `W/S drive, A/D steer, F ${verb(t.attachment)}, R swap tool, Use to get off` : 'W/S drive, A/D steer, R fit a tool, Use to get off';
    bus.emit('toast', { text: tip, kind: 'info' });
    this.carry(t);
  }

  exit(): void {
    const t = this.driving;
    if (!t) return;
    const { player, world } = this.host;
    this.driving = null;
    this.cooldown = USE_COOLDOWN_S;
    t.speed = 0;
    t.working = 0;
    t.steer = 0;
    player.yaw = t.yaw + this.lookOffset;
    const spot = this.exitSpot(world, t);
    player.position.x = spot.x;
    player.position.y = spot.y;
    player.position.z = spot.z;
    player.velocity.x = player.velocity.y = player.velocity.z = 0;
    this.physics?.reset();
    this.lookOffset = 0;
  }

  /** Fits an attachment from the held stack; the one it replaces goes back to the pack. */
  mount(t: Tractor, kind: Attachment): boolean {
    const { player, bus } = this.host;
    if (t.attachment === kind) {
      bus.emit('toast', { text: `The ${itemOrNull(ATTACHMENT_ITEM[kind])?.name ?? kind} is already fitted`, kind: 'info' });
      return false;
    }
    player.consumeHeld(1);
    if (t.attachment) this.hand(ATTACHMENT_ITEM[t.attachment], t);
    t.attachment = kind;
    bus.emit('sfx', { name: 'place', x: t.x, y: t.y + 0.8, z: t.z, pitch: 0.7 });
    bus.emit('toast', { text: `${itemOrNull(ATTACHMENT_ITEM[kind])?.name ?? kind} fitted`, kind: 'info' });
    return true;
  }

  /**
   * One canister from the held stack, if the tank has room for it: the Fuel Canister, or a distillery fuel worth its
   * grade (diesel 1.5 canisters, gasoline 1.2; src/core/distill.ts FUEL_GRADES), whose empty container comes back.
   */
  refuel(t: Tractor): boolean {
    const { player, bus } = this.host;
    const grade = fuelGrade(player.heldStack()?.item ?? FUEL_ITEM) ?? fuelGrade(FUEL_ITEM)!;
    const adds = CANISTER_S * grade.tractor;
    if (t.fuel > TANK_S - adds * 0.5) {
      bus.emit('toast', { text: 'The tank is full', kind: 'info' });
      return false;
    }
    player.consumeHeld(1);
    if (grade.empty) player.give(grade.empty, 1);
    t.fuel = Math.min(TANK_S, t.fuel + adds);
    bus.emit('sfx', { name: 'fuel_add', x: t.x, y: t.y + 0.8, z: t.z });
    bus.emit('toast', { text: `Tractor refuelled (${Math.round((t.fuel / TANK_S) * 100)}%)`, kind: 'info' });
    return true;
  }

  /** Picks a parked tractor up: the item and its attachment go to the pack (the fuel stays in the machine's tank, lost). */
  pickUp(t: Tractor): void {
    if (t === this.driving) return;
    this.tractors.delete(t.id);
    this.hand(TRACTOR_ITEM, t);
    if (t.attachment) this.hand(ATTACHMENT_ITEM[t.attachment], t);
    this.host.bus.emit('sfx', { name: 'pickup', x: t.x, y: t.y + 0.8, z: t.z });
  }

  /** Swaps to the next attachment the player carries (or takes the fitted one off when it is the last): R / Jump. */
  cycleAttachment(): void {
    const t = this.driving;
    if (!t) return;
    const { player, bus } = this.host;
    const have = (a: Attachment): boolean => player.inventory.slots.some((s) => s?.item === ATTACHMENT_ITEM[a]);
    const order = ATTACHMENTS.filter((a) => a !== t.attachment && have(a));
    const next = order[0] ?? null;
    if (!next) {
      if (t.attachment) {
        this.hand(ATTACHMENT_ITEM[t.attachment], t);
        t.attachment = null;
        bus.emit('toast', { text: 'Attachment taken off', kind: 'info' });
      } else bus.emit('toast', { text: 'No attachment in your pack - forge a Tiller or a Harvester', kind: 'info' });
      return;
    }
    const slot = player.inventory.slots.findIndex((s) => s?.item === ATTACHMENT_ITEM[next]);
    player.inventory.removeAt(slot, 1);
    if (t.attachment) this.hand(ATTACHMENT_ITEM[t.attachment], t);
    t.attachment = next;
    bus.emit('sfx', { name: 'place', x: t.x, y: t.y + 0.8, z: t.z, pitch: 0.7 });
    bus.emit('toast', { text: `${itemOrNull(ATTACHMENT_ITEM[next])?.name ?? next} fitted - F ${verb(next)}`, kind: 'info' });
  }

  /** Works the attachment once, if there is one, the tank has fuel and nothing is cooling down. */
  work(): number {
    const t = this.driving;
    if (!t || !t.attachment || t.fuel <= 0 || this.workTimer > 0) return 0;
    this.workTimer = WORK_INTERVAL_S;
    t.working = 1;
    const result = workSwath({ world: this.host.world, bus: this.host.bus, player: this.host.player, rng: this.rng }, t);
    return result.count;
  }

  // ---- the frame -----------------------------------------------------------------------------------------------------

  /**
   * One frame of the player's intent. Returns the intent (the same object), changed when the vehicles take it over.
   */
  handle(intent: Intent, dt: number): Intent {
    const { player } = this.host;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.workTimer = Math.max(0, this.workTimer - dt);
    for (const t of this.tractors.values()) {
      if (t.working > 0) t.working = Math.max(0, t.working - dt * 2.5);
      if (t !== this.driving && !t.onGround && this.host.world.isLoaded(t.x, t.z)) settleTractor(this.host.world, t, Math.min(dt, 0.05));
    }
    if (this.driving && player.dead) this.exit();
    if (this.driving) return this.drive(intent, dt);
    this.lastJump = intent.jump;
    this.swapKey = false;
    if (intent.use && this.cooldown <= 0 && !player.dead) {
      if (this.onFoot(intent)) {
        intent.use = false;
        intent.place = false;
      }
    }
    return intent;
  }

  /** Use while on foot: true when it was meant for a tractor (and has been done). */
  private onFoot(intent: Intent): boolean {
    const { player, world, bus } = this.host;
    const held = player.heldStack();
    player.viewDir(this.dir);
    const d = this.dir;
    const ox = player.position.x;
    const oy = player.eyeY;
    const oz = player.position.z;
    const block = raycast(world, ox, oy, oz, d.x, d.y, d.z, REACH, false, this.hit);
    const target = this.aim(ox, oy, oz, d.x, d.y, d.z, block ? Math.min(REACH, block.distance) : REACH);
    if (target) {
      this.cooldown = USE_COOLDOWN_S;
      const t = target.tractor;
      if (intent.place) this.pickUp(t);
      else if (held && attachmentOfItem(held.item)) this.mount(t, attachmentOfItem(held.item)!);
      else if (held && (fuelGrade(held.item)?.tractor ?? 0) > 0) this.refuel(t);
      else this.enter(t);
      return true;
    }
    if (held?.item === TRACTOR_ITEM && block && block.face === Face.PY) {
      this.cooldown = USE_COOLDOWN_S;
      const x = block.x + 0.5;
      const y = block.y + 1;
      const z = block.z + 0.5;
      if (this.place(x, y, z, player.yaw)) {
        player.consumeHeld(1);
        bus.emit('sfx', { name: 'place', x, y, z, pitch: 0.6 });
        bus.emit('toast', { text: 'Tractor set down. Use it to climb aboard; feed it a Fuel Canister first', kind: 'info' });
      } else bus.emit('toast', { text: 'No room for a tractor there - it needs a clear 2 x 2 block space', kind: 'info' });
      return true;
    }
    return false;
  }

  private drive(intent: Intent, dt: number): Intent {
    const t = this.driving as Tractor;
    const swap = this.swapKey || (intent.jump && !this.lastJump);
    this.lastJump = intent.jump;
    this.swapKey = false;
    this.lookOffset = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, this.lookOffset - intent.lookYaw));
    const throttle = intent.moveZ;
    const steer = intent.moveX;
    const wantWork = this.workKey || intent.mine;
    const exit = intent.use && this.cooldown <= 0;
    // The controller must neither walk, mine, place nor turn the machine's driver: those are taken.
    intent.moveX = intent.moveZ = 0;
    intent.lookYaw = 0;
    intent.jump = false;
    intent.sprint = false;
    intent.mine = false;
    intent.use = false;
    intent.place = false;
    if (exit) {
      this.exit();
      return intent;
    }
    if (swap) this.cycleAttachment();
    if (wantWork) this.work();
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP_S));
    const h = dt / steps;
    const working = t.working > 0.5;
    for (let i = 0; i < steps; i++) driveTractor(this.host.world, t, { throttle, steer }, h, working);
    this.sound(t, dt);
    if (t.fuel <= 0 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.host.bus.emit('toast', { text: 'The tractor ran dry. Get off (Use) and feed it a Fuel Canister', kind: 'warn' });
    } else if (t.fuel > 0 && t.fuel < TANK_S * 0.12 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.host.bus.emit('toast', { text: 'Tractor fuel is low', kind: 'warn' });
    } else if (t.fuel > TANK_S * 0.2) this.lowFuelWarned = false;
    this.carry(t);
    return intent;
  }

  /** The player rides along: seat position, heading plus head turn, no velocity, no fall in progress. */
  private carry(t: Tractor): void {
    const { player } = this.host;
    const seat = seatOf(t);
    player.position.x = seat.x;
    player.position.y = seat.y;
    player.position.z = seat.z;
    player.velocity.x = player.velocity.y = player.velocity.z = 0;
    player.yaw = wrapAngle(t.yaw + this.lookOffset);
    this.physics?.reset();
  }

  private sound(t: Tractor, dt: number): void {
    if (t.fuel <= 0) return;
    this.chug -= dt;
    if (this.chug > 0) return;
    const load = Math.min(1, Math.abs(t.speed) / 5.5);
    this.chug = CHUG_IDLE_S + (CHUG_FAST_S - CHUG_IDLE_S) * load;
    this.host.bus.emit('sfx', { name: 'engine', x: t.x, y: t.y + 1, z: t.z, pitch: 0.85 + load * 0.5, volume: 0.7 });
  }

  /** Gives an item to the pack; what does not fit lands on the ground at the tractor. */
  private hand(item: string, t: Tractor): void {
    const left = this.host.player.give(item, 1);
    if (left > 0) this.host.player.drop(item, left, undefined, { x: t.x, y: t.y + 1, z: t.z });
  }

  /** A free standing place beside the machine: right, left, behind, ahead, then on top. */
  private exitSpot(world: IWorld, t: Tractor): { x: number; y: number; z: number } {
    const f = forward(t.yaw);
    const r = right(t.yaw);
    const reach = HALF_WIDTH + 0.7;
    const tries: Array<[number, number]> = [[r.x * reach, r.z * reach], [-r.x * reach, -r.z * reach], [-f.x * 1.9, -f.z * 1.9], [f.x * 1.9, f.z * 1.9]];
    for (const [dx, dz] of tries) {
      for (const dy of [0, 1, -1]) {
        const p = { x: t.x + dx, y: t.y + dy, z: t.z + dz };
        if (boxFree(world, p, 0.3, 1.8)) return p;
      }
    }
    return { x: t.x, y: t.y + BODY_HEIGHT + 0.2, z: t.z };
  }
}

const verb = (a: Attachment): string => (a === 'tiller' ? 'till' : 'harvest');

function wrapAngle(a: number): number {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

/** Distance along the ray to an axis-aligned box, or null (slab method). */
export function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number | null {
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

/** Puts the manager between an intent source and the controller. */
export function wrapIntentSource<T extends { frame(dt: number): Intent }>(source: T, vehicles: VehicleManager): T {
  return new Proxy(source, {
    get(target, prop, receiver) {
      if (prop === 'frame') return (dt: number): Intent => vehicles.handle(target.frame(dt), dt);
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
