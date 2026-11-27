/**
 * The AirshipManager (docs/api/airship.md): every airship in the world, who is flying, the sky chart, and what the
 * player's controls mean aboard. DOM-free. It sits in front of the tractors' VehicleManager between the input and the
 * PlayerController (`wrapIntentSource`), the same way:
 *
 *  ON FOOT   Use on a moored ship (aimed, nearer than any block) climbs aboard; with a fuel canister in hand it refuels,
 *            with Shift/Place held it packs the ship up. Use with an Airship item on the ground sets one down.
 *  FLYING    move = throttle and rudder, Jump = climb, Mine / F / Sneak = sink, R (or the course button) = steer for the
 *            next place on the chart, Use = step off (only just above the ground). Look turns the head, not the ship.
 *            The player is carried in the gondola; everything else is zeroed so the controller neither walks nor mines.
 *
 * While aloft the pilot spots landmarks, ruins and named regions (vehicles/skyChart.ts); the chart is the world's, kept
 * when the ship is packed away.
 */
import { fuelGrade } from '../core/distill';
import type { GameBus } from '../core/context';
import { REACH } from '../core/constants';
import type { Vec3 } from '../core/math';
import { Face, type BiomeKey, type IWorld } from '../core/types';
import type { PlayerState } from '../game';
import type { Intent } from '../player/input/intent';
import { createRayHit, raycast } from '../player/raycast';
import { boxFree } from './collide';
import {
  AIRSHIP_ITEM, CANISTER_S, SHIP_HALF, SHIP_HEIGHT, TANK_S, clearanceBelow, createAirship, flyAirship, forward, pilotOf, right, roomFor,
  settleAirship, shipFromSnapshot, snapshotOfShip, type Airship, type AirshipSnapshot,
} from './airship';
import { rayBox, USE_COOLDOWN_S } from './manager';
import { SkyChart, compassOf, sightsAround, spotRadius, type ChartEntry, type ChartSave } from './skyChart';

/** Flags (objectives): the first powered flight high enough to spot from, and a chart of CHART_GOAL entries. */
export const FLAG_FLEW_AIRSHIP = 'flew_airship';
export const FLAG_CHARTED_LANDS = 'charted_lands';
export const CHART_GOAL = 6;
/** Seconds between looks round for new sights and arrivals. */
export const SPOT_INTERVAL_S = 1;
/** Most clear air under the gondola from which the pilot may still step off (blocks). */
export const STEP_OFF_CLEARANCE = 1.5;
/** Head turn limit while flying (radians either way). */
export const PILOT_LOOK_LIMIT = 2.6;
/** Longest physics step (a slow frame is split). */
const MAX_STEP_S = 0.025;

export interface AirshipHost {
  world: IWorld;
  bus: GameBus;
  player: PlayerState;
  biomeAt(x: number, z: number): BiomeKey;
  /** True while the player is busy with another vehicle (driving a tractor): the airships then leave the input alone. */
  busy?(): boolean;
}

/** What a renderer needs of a ship. */
export interface AirshipView {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  prop: number;
  rudder: number;
  trim: number;
  /** Throttle effort 0..1 (the exhaust). */
  thrust: number;
  occupied: boolean;
  fuel: number;
}

/** What the HUD shows while flying. */
export interface FlightStatus {
  fuel: number;
  /** Height of the ship's feet (world y) and the clear air under it (capped at 4). */
  altitude: number;
  clearance: number;
  speed: number;
  /** Sight radius now (0 when too low to spot), entries on the chart, entries not reached. */
  sight: number;
  charted: number;
  open: number;
  /** The course: name, distance, compass point and bearing relative to the ship's heading (radians, + = to the left). */
  course: { name: string; kind: ChartEntry['kind']; distance: number; compass: string; bearing: number } | null;
  /** Close enough above the ground to step off. */
  canLand: boolean;
}

export interface AirshipSave {
  next: number;
  ships: AirshipSnapshot[];
  chart: ChartSave;
}

export class AirshipManager {
  readonly ships = new Map<number, Airship>();
  readonly chart = new SkyChart();
  /** The ship the player is flying, or null. */
  flying: Airship | null = null;
  lookOffset = 0;
  private nextId = 1;
  private cooldown = 0;
  private sinkKey = false;
  private courseKey = false;
  private spotTimer = 0;
  private hintS = 0;
  private chug = 0;
  private lowFuelWarned = false;
  private thrust = 0;
  private physics: { reset(): void } | null = null;
  private readonly hit = createRayHit();
  private readonly dir: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(private readonly host: AirshipHost) {}

  bindPhysics(physics: { reset(): void }): void {
    this.physics = physics;
  }

  // ---- persistence ---------------------------------------------------------------------------------------------------

  toJSON(): AirshipSave {
    return { next: this.nextId, ships: [...this.ships.values()].map(snapshotOfShip), chart: this.chart.toJSON() };
  }

  load(data: unknown): void {
    this.ships.clear();
    this.flying = null;
    const o = data && typeof data === 'object' ? (data as Partial<AirshipSave>) : null;
    this.chart.load(o?.chart);
    if (!o || !Array.isArray(o.ships)) return;
    for (const raw of o.ships) {
      const s = shipFromSnapshot(raw);
      if (s && !this.ships.has(s.id)) this.ships.set(s.id, s);
    }
    const top = Math.max(0, ...this.ships.keys());
    this.nextId = Math.max(typeof o.next === 'number' && Number.isFinite(o.next) ? Math.floor(o.next) : 1, top + 1);
  }

  // ---- controls (DOM glue) -------------------------------------------------------------------------------------------

  /** F held: sink (the touch Mine button does the same through the intent). */
  setSinkKey(down: boolean): void {
    this.sinkKey = down;
  }

  /** R or the HUD's course button: steer for the next place on the chart. */
  pressCourseKey(): void {
    this.courseKey = true;
  }

  // ---- queries -------------------------------------------------------------------------------------------------------

  views(): AirshipView[] {
    return [...this.ships.values()].map((s) => ({
      id: s.id, x: s.x, y: s.y, z: s.z, yaw: s.yaw, prop: s.prop, rudder: s.rudder, trim: s.trim,
      thrust: s === this.flying ? this.thrust : 0, occupied: s === this.flying, fuel: s.fuel / TANK_S,
    }));
  }

  status(): FlightStatus | null {
    const s = this.flying;
    if (!s) return null;
    const clearance = clearanceBelow(this.host.world, s);
    const c = this.chart.courseEntry();
    let course: FlightStatus['course'] = null;
    if (c) {
      const dx = c.x - s.x;
      const dz = c.z - s.z;
      // Bearing of the place from the ship's nose: yaw of the direction minus the heading (positive = to the left).
      const yawTo = Math.atan2(-dx, -dz);
      course = { name: c.name, kind: c.kind, distance: Math.hypot(dx, dz), compass: compassOf(dx, dz), bearing: wrapAngle(yawTo - s.yaw) };
    }
    return {
      fuel: s.fuel / TANK_S, altitude: s.y, clearance, speed: s.speed, sight: spotRadius(s.y), charted: this.chart.size,
      open: this.chart.open(s.x, s.z).length, course, canLand: clearance <= STEP_OFF_CLEARANCE,
    };
  }

  // ---- placing and removing ------------------------------------------------------------------------------------------

  /** Moors a ship with its feet at (x, y, z). Returns it, or null when there is no room. */
  place(x: number, y: number, z: number, yaw: number, fuel = 0): Airship | null {
    if (!roomFor(this.host.world, x, y, z)) return null;
    const s = createAirship(this.nextId++, x, y, z, yaw, fuel);
    this.ships.set(s.id, s);
    return s;
  }

  /** The nearest ship on the ray within `maxDist`, with its distance. */
  aim(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { ship: Airship; distance: number } | null {
    let best: { ship: Airship; distance: number } | null = null;
    for (const s of this.ships.values()) {
      if (s === this.flying) continue;
      const d = rayBox(ox, oy, oz, dx, dy, dz, s.x - SHIP_HALF, s.y, s.z - SHIP_HALF, s.x + SHIP_HALF, s.y + SHIP_HEIGHT, s.z + SHIP_HALF);
      if (d !== null && d <= maxDist && (!best || d < best.distance)) best = { ship: s, distance: d };
    }
    return best;
  }

  // ---- actions -------------------------------------------------------------------------------------------------------

  board(s: Airship): void {
    const { player, bus } = this.host;
    this.flying = s;
    this.lookOffset = 0;
    this.cooldown = USE_COOLDOWN_S;
    this.lowFuelWarned = false;
    this.spotTimer = 0;
    s.speed = 0;
    s.vy = 0;
    player.sprinting = false;
    if (s.fuel > 0) bus.emit('sfx', { name: 'engine_start', x: s.x, y: s.y + 1, z: s.z, pitch: 0.7 });
    if (!this.chart.courseEntry()) this.chart.nextCourse(s.x, s.z);
    bus.emit('toast', {
      text: s.fuel <= 0 ? 'The tank is dry - step off and feed it Fuel Canisters' : 'Jump climbs, F sinks, W/S thrust, A/D rudder. Climb high to spot new lands',
      kind: 'info',
    });
    this.carry(s);
  }

  /** Steps off onto the ground beside the gondola. False (and a hint) while too high. */
  leave(force = false): boolean {
    const s = this.flying;
    if (!s) return false;
    const { player, world, bus } = this.host;
    if (!force && clearanceBelow(world, s) > STEP_OFF_CLEARANCE) {
      bus.emit('toast', { text: 'Too high to step off - hold Down (F) to sink to the ground first', kind: 'warn' });
      this.cooldown = USE_COOLDOWN_S;
      return false;
    }
    this.flying = null;
    this.cooldown = USE_COOLDOWN_S;
    s.speed = 0;
    s.rudder = 0;
    s.trim = 0;
    s.onGround = false;
    this.thrust = 0;
    player.yaw = wrapAngle(s.yaw + this.lookOffset);
    const spot = this.stepOffSpot(world, s);
    player.position.x = spot.x;
    player.position.y = spot.y;
    player.position.z = spot.z;
    player.velocity.x = player.velocity.y = player.velocity.z = 0;
    this.physics?.reset();
    this.lookOffset = 0;
    return true;
  }

  refuel(s: Airship): boolean {
    const { player, bus } = this.host;
    const held = player.heldStack();
    const grade = fuelGrade(held?.item ?? '') ?? fuelGrade('fuel_canister')!;
    const adds = CANISTER_S * grade.tractor;
    if (s.fuel > TANK_S - adds * 0.5) {
      bus.emit('toast', { text: 'The airship tank is full', kind: 'info' });
      return false;
    }
    player.consumeHeld(1);
    if (grade.empty) player.give(grade.empty, 1);
    s.fuel = Math.min(TANK_S, s.fuel + adds);
    bus.emit('sfx', { name: 'fuel_add', x: s.x, y: s.y + 0.8, z: s.z });
    bus.emit('toast', { text: `Airship refuelled (${Math.round((s.fuel / TANK_S) * 100)}%)`, kind: 'info' });
    return true;
  }

  /** Packs a moored ship away into the pack (its fuel is lost with it). */
  pickUp(s: Airship): void {
    if (s === this.flying) return;
    this.ships.delete(s.id);
    const left = this.host.player.give(AIRSHIP_ITEM, 1);
    if (left > 0) this.host.player.drop(AIRSHIP_ITEM, left, undefined, { x: s.x, y: s.y + 1, z: s.z });
    this.host.bus.emit('sfx', { name: 'pickup', x: s.x, y: s.y + 0.8, z: s.z });
  }

  /** Looks round from where the ship is: new sights go on the chart (with a toast), places come within reach are reached. */
  lookout(s: Airship): ChartEntry[] {
    const { bus, world } = this.host;
    const r = spotRadius(s.y);
    if (r > 0 && s.fuel > 0) bus.emit('flag', { flag: FLAG_FLEW_AIRSHIP });
    const fresh = this.chart.spot(sightsAround(world.seed, s.x, s.z, r, (x, z) => this.host.biomeAt(x, z)));
    if (fresh.length > 0) {
      // Places first (they are what one flies to), then regions; at most two toasts a look.
      const order = [...fresh].sort((a, b) => (a.kind === 'region' ? 1 : 0) - (b.kind === 'region' ? 1 : 0));
      for (const e of order.slice(0, 2)) {
        const d = Math.round(Math.hypot(e.x - s.x, e.z - s.z));
        const where = `${compassOf(e.x - s.x, e.z - s.z)}, ${d} m`;
        bus.emit('toast', { text: e.kind === 'region' ? `New region spotted: ${e.name} (${where})` : `Spotted ${e.name} (${where})`, kind: 'good' });
      }
      if (order.length > 2) bus.emit('toast', { text: `${order.length - 2} more on the sky chart`, kind: 'info' });
      if (!this.chart.courseEntry()) this.chart.nextCourse(s.x, s.z);
      bus.emit('sfx', { name: 'scan_chime', x: s.x, y: s.y + 1, z: s.z, volume: 0.5 });
    }
    if (this.chart.size >= CHART_GOAL) bus.emit('flag', { flag: FLAG_CHARTED_LANDS });
    for (const e of this.chart.arrive(s.x, s.z)) bus.emit('toast', { text: `You reach ${e.name}`, kind: 'good' });
    return fresh;
  }

  // ---- the frame -----------------------------------------------------------------------------------------------------

  handle(intent: Intent, dt: number): Intent {
    const { player, world } = this.host;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hintS = Math.max(0, this.hintS - dt);
    for (const s of this.ships.values()) {
      if (s !== this.flying && world.isLoaded(s.x, s.z)) settleAirship(world, s, Math.min(dt, 0.05));
    }
    if (this.flying && player.dead) this.leave(true);
    if (this.flying) return this.fly(intent, dt);
    this.courseKey = false;
    if (intent.use && this.cooldown <= 0 && !player.dead && !this.host.busy?.()) {
      if (this.onFoot(intent)) {
        intent.use = false;
        intent.place = false;
      }
    }
    return intent;
  }

  private onFoot(intent: Intent): boolean {
    const { player, world, bus } = this.host;
    const held = player.heldStack();
    player.viewDir(this.dir);
    const d = this.dir;
    const ox = player.position.x;
    const oy = player.eyeY;
    const oz = player.position.z;
    const blockHit = raycast(world, ox, oy, oz, d.x, d.y, d.z, REACH, false, this.hit);
    const target = this.aim(ox, oy, oz, d.x, d.y, d.z, blockHit ? Math.min(REACH, blockHit.distance) : REACH);
    if (target) {
      this.cooldown = USE_COOLDOWN_S;
      const s = target.ship;
      if (intent.place) this.pickUp(s);
      else if (held && (fuelGrade(held.item)?.tractor ?? 0) > 0) this.refuel(s);
      else this.board(s);
      return true;
    }
    if (held?.item === AIRSHIP_ITEM && blockHit && blockHit.face === Face.PY) {
      this.cooldown = USE_COOLDOWN_S;
      const x = blockHit.x + 0.5;
      const y = blockHit.y + 1;
      const z = blockHit.z + 0.5;
      if (this.place(x, y, z, player.yaw)) {
        player.consumeHeld(1);
        bus.emit('sfx', { name: 'place', x, y, z, pitch: 0.5 });
        bus.emit('toast', { text: 'Airship moored. Feed it Fuel Canisters, then Use it to climb aboard', kind: 'info' });
      } else bus.emit('toast', { text: 'No room to moor an airship here - it needs open ground 3 x 3 and 6 blocks of sky', kind: 'info' });
      return true;
    }
    return false;
  }

  private fly(intent: Intent, dt: number): Intent {
    const s = this.flying as Airship;
    this.lookOffset = Math.max(-PILOT_LOOK_LIMIT, Math.min(PILOT_LOOK_LIMIT, this.lookOffset - intent.lookYaw));
    const throttle = intent.moveZ;
    const turn = intent.moveX;
    const climb = intent.jump ? 1 : this.sinkKey || intent.mine || intent.sneak ? -1 : 0;
    const strayTap = intent.use && intent.worldTap;
    const wantOff = intent.use && this.cooldown <= 0 && !strayTap;
    if (strayTap && this.cooldown <= 0 && this.hintS <= 0) {
      this.hintS = 6;
      this.host.bus.emit('toast', { text: 'Tap Exit to step off the airship (near the ground)', kind: 'info' });
    }
    const course = this.courseKey;
    this.courseKey = false;
    intent.moveX = intent.moveZ = 0;
    intent.lookYaw = 0;
    intent.jump = false;
    intent.sprint = false;
    intent.sneak = false;
    intent.mine = false;
    intent.use = false;
    intent.place = false;
    if (wantOff && this.leave()) return intent;
    if (course) {
      const next = this.chart.nextCourse(s.x, s.z);
      this.host.bus.emit('toast', { text: next ? `Course set for ${next.name}` : 'Nothing on the chart to steer for yet - climb higher', kind: 'info' });
    }
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP_S));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) flyAirship(this.host.world, s, { throttle, turn, climb }, h);
    this.thrust += ((s.fuel > 0 ? Math.abs(throttle) : 0) - this.thrust) * Math.min(1, dt * 3);
    this.spotTimer -= dt;
    if (this.spotTimer <= 0) {
      this.spotTimer = SPOT_INTERVAL_S;
      this.lookout(s);
    }
    this.sound(s, dt);
    if (s.fuel <= 0 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.host.bus.emit('toast', { text: 'The airship ran dry and is sinking. Step off when it lands and refuel', kind: 'warn' });
    } else if (s.fuel > 0 && s.fuel < TANK_S * 0.12 && !this.lowFuelWarned) {
      this.lowFuelWarned = true;
      this.host.bus.emit('toast', { text: 'Airship fuel is low - find somewhere to land', kind: 'warn' });
    } else if (s.fuel > TANK_S * 0.2) this.lowFuelWarned = false;
    this.carry(s);
    return intent;
  }

  private carry(s: Airship): void {
    const { player } = this.host;
    const seat = pilotOf(s);
    player.position.x = seat.x;
    player.position.y = seat.y;
    player.position.z = seat.z;
    player.velocity.x = player.velocity.y = player.velocity.z = 0;
    player.yaw = wrapAngle(s.yaw + this.lookOffset);
    this.physics?.reset();
  }

  private sound(s: Airship, dt: number): void {
    if (s.fuel <= 0) return;
    this.chug -= dt;
    if (this.chug > 0) return;
    this.chug = 0.5 - 0.3 * this.thrust;
    this.host.bus.emit('sfx', { name: 'engine', x: s.x, y: s.y + 1, z: s.z, pitch: 0.55 + this.thrust * 0.35, volume: 0.55 });
  }

  /** A free standing place beside the gondola: right, left, behind, ahead, then in the gondola's own footprint. */
  private stepOffSpot(world: IWorld, s: Airship): { x: number; y: number; z: number } {
    const f = forward(s.yaw);
    const r = right(s.yaw);
    const reach = SHIP_HALF + 0.6;
    const tries: Array<[number, number]> = [[r.x * reach, r.z * reach], [-r.x * reach, -r.z * reach], [-f.x * reach, -f.z * reach], [f.x * reach, f.z * reach]];
    for (const [dx, dz] of tries) {
      for (const dy of [0, 1, -1, 2]) {
        const p = { x: s.x + dx, y: Math.floor(s.y) + dy, z: s.z + dz };
        if (boxFree(world, p, 0.3, 1.8) && !boxFree(world, { x: p.x, y: p.y - 0.5, z: p.z }, 0.3, 0.5)) return p;
      }
    }
    return { x: s.x, y: s.y, z: s.z };
  }
}

function wrapAngle(a: number): number {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

/** Puts the airships between an intent source and whatever reads it next (the tractors, then the controller). */
export function wrapAirshipSource<T extends { frame(dt: number): Intent }>(source: T, airships: AirshipManager): T {
  return new Proxy(source, {
    get(target, prop) {
      if (prop === 'frame') return (dt: number): Intent => airships.handle(target.frame(dt), dt);
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
