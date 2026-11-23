/**
 * The per-animal behaviour of spec 12.5, run at 20 Hz: decides what each animal wants (flee, swim to shore,
 * breed, follow, wander, graze, idle) and turns that into a desired horizontal velocity, a facing and hops.
 * Movement on land is edge-guarded: an animal never steps into liquid or off a drop deeper than MOB_MAX_DROP
 * (standCell), whatever it is doing, so following or fleeing cannot walk it into a lake or off a cliff.
 */
import {
  MOB_BABY_SCALE,
  MOB_BREED_RADIUS,
  MOB_BREED_S,
  MOB_FLEE_SPEED_MULT,
  MOB_FOLLOW_DISTANCE,
  MOB_FOLLOW_RANGE,
  MOB_WANDER_RADIUS,
  PLAYER_WIDTH,
} from '../core/constants';
import type { CreatureSpec, IWorld } from '../core/types';
import { HOP_VELOCITY, SWIM_CLIMB_VELOCITY } from './physics';
import { clearanceOf, findShore, standCell, walkable } from './terrain';
import type { Mob, MobPlayer } from './types';

/** A tame pet keeps this far from the player (blocks) and sprints when more than PET_RUN_AT away. */
const PET_STOP = 2.2;
const PET_RUN_AT = 9;
/** Fraction of the species speed used while wandering (following and breeding use the full speed). */
export const WANDER_SPEED = 0.55;
export const SWIM_SPEED = 0.6;
/** Seconds pressing against a wall before giving up on a wander target. */
export const STUCK_S = 2;
/** A baby farther than this from the nearest adult of its kind trots back to it. */
export const BABY_LEASH = 5;
/** A follower pushed this much closer than its stop distance backs off again (blocks). */
const BACK_OFF = 0.35;
/** Turn rate towards the walking direction, radians per second. */
const TURN_RATE = 7;
const ACCEL = 10;
/** Arrival easing: the walking speed is at most this many times the distance left to the stop (1/s). */
const ARRIVE_GAIN = 4;
const AIR_ACCEL = 1.5;

/** What the brain may ask of the manager. */
export interface BrainContext {
  world: IWorld;
  rng: () => number;
  player: MobPlayer;
  /** Item in the player's hand this tick. */
  held: string | null;
  /** Animals being simulated this tick. */
  mobs: readonly Mob[];
  byId(id: number): Mob | undefined;
  /** Two partners finished breeding: make the baby. */
  birth(a: Mob, b: Mob): void;
}

/** Half the footprint width and the height of an animal's box, in blocks (babies are MOB_BABY_SCALE). */
export const halfWidth = (m: Mob): number => (m.spec.size.w * (m.baby ? MOB_BABY_SCALE : 1)) / 2;
export const bodyHeight = (m: Mob): number => m.spec.size.h * (m.baby ? MOB_BABY_SCALE : 1);

const reaches = new Map<CreatureSpec, number>();
/** How far an adult's model reaches forward of its feet centre (the head, beak or snout), in blocks. */
export function forwardReach(spec: CreatureSpec): number {
  let r = reaches.get(spec);
  if (r === undefined) {
    r = spec.size.w / 2;
    // Models face -Z in 1/16-block units.
    for (const p of spec.model) r = Math.max(r, -p.from[2] / 16);
    reaches.set(spec, r);
  }
  return r;
}

/** Smallest signed angle from a to b. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Facing that looks along (dx, dz): yaw 0 looks at -Z, positive turns left. */
export const yawTowards = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

function turn(m: Mob, target: number, dt: number): void {
  const d = angleDiff(m.yaw, target);
  const step = TURN_RATE * dt;
  m.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
  if (m.yaw > Math.PI) m.yaw -= Math.PI * 2;
  else if (m.yaw < -Math.PI) m.yaw += Math.PI * 2;
}

/** How quickly the velocity follows what the animal wants: little control in the air (knockback carries). */
const grip = (m: Mob, dt: number): number => Math.min(1, (m.onGround || m.inLiquid ? ACCEL : AIR_ACCEL) * dt);

function brake(m: Mob, dt: number): void {
  const k = grip(m, dt);
  m.vx -= m.vx * k;
  m.vz -= m.vz * k;
}

/** Can the animal step one stride along (dirX, dirZ)? Sets `hop` when the next column is one block up. */
function probeAhead(world: IWorld, m: Mob, dirX: number, dirZ: number, out: { hop: boolean }): boolean {
  out.hop = false;
  // In the air too (mid-hop), so momentum never carries an animal over an edge it would refuse on foot.
  if (m.inLiquid) return true;
  const reach = halfWidth(m) + 0.3;
  const ax = Math.floor(m.x + dirX * reach);
  const az = Math.floor(m.z + dirZ * reach);
  const fx = Math.floor(m.x);
  const fz = Math.floor(m.z);
  if (ax === fx && az === fz) return true;
  const fy = Math.floor(m.y + 0.01);
  const next = standCell(world, ax, az, fy, clearanceOf(bodyHeight(m)));
  if (Number.isNaN(next)) return false;
  out.hop = next > fy;
  return true;
}

const ahead = { hop: false };

/** Whether the edge guard lets the animal move along (dirX, dirZ) now (for pushes that are not its own walk). */
export const canStride = (world: IWorld, m: Mob, dirX: number, dirZ: number): boolean => probeAhead(world, m, dirX, dirZ, ahead);

/**
 * Walks towards (tx, tz) at `speed`, stopping within `stop` blocks. Returns 'arrived', 'moving' or 'blocked'
 * (the edge guard refused the next stride, or a wall stopped it and hopping did not help).
 */
function steer(ctx: BrainContext, m: Mob, tx: number, tz: number, speed: number, stop: number, dt: number): 'arrived' | 'moving' | 'blocked' {
  const dx = tx - m.x;
  const dz = tz - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= stop) {
    brake(m, dt);
    return 'arrived';
  }
  const dirX = dx / dist;
  const dirZ = dz / dist;
  // Ease off on the last stretch so it stops where it meant to (two animals meeting do not bump heads).
  speed = Math.min(speed, (dist - stop) * ARRIVE_GAIN);
  turn(m, yawTowards(dirX, dirZ), dt);
  if (!probeAhead(ctx.world, m, dirX, dirZ, ahead)) {
    // A full stop, not a gentle brake: the next stride would be into liquid or off a cliff.
    m.vx = 0;
    m.vz = 0;
    return 'blocked';
  }
  const k = grip(m, dt);
  m.vx += (dirX * speed - m.vx) * k;
  m.vz += (dirZ * speed - m.vz) * k;
  if (m.onGround && (ahead.hop || m.blocked)) m.vy = HOP_VELOCITY;
  return 'moving';
}

/** Runs in a direction: straight if it can, else veering up to 135 degrees either way. False when cornered. */
function run(ctx: BrainContext, m: Mob, dirX: number, dirZ: number, speed: number, dt: number): boolean {
  for (const a of VEER) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = dirX * c - dirZ * s;
    const z = dirX * s + dirZ * c;
    if (!probeAhead(ctx.world, m, x, z, ahead)) continue;
    steer(ctx, m, m.x + x * 4, m.z + z * 4, speed, 0, dt);
    return true;
  }
  brake(m, dt);
  return false;
}
const VEER = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];

/** Picks a reachable wander target within MOB_WANDER_RADIUS (around `cx`, `cz`). False when none was found. */
function pickWanderTarget(ctx: BrainContext, m: Mob, cx: number, cz: number): boolean {
  const fy = Math.floor(m.y + 0.01);
  const clearance = clearanceOf(bodyHeight(m));
  for (let i = 0; i < 6; i++) {
    const a = ctx.rng() * Math.PI * 2;
    const r = 2 + ctx.rng() * (MOB_WANDER_RADIUS - 2);
    const tx = Math.floor(cx + Math.cos(a) * r) + 0.5;
    const tz = Math.floor(cz + Math.sin(a) * r) + 0.5;
    if (Number.isNaN(walkable(ctx.world, m.x, m.z, fy, tx, tz, clearance))) continue;
    m.tx = tx;
    m.tz = tz;
    m.hasTarget = true;
    return true;
  }
  return false;
}

function setState(m: Mob, state: Mob['state'], seconds: number): void {
  m.state = state;
  m.stateS = seconds;
  m.stuckS = 0;
  m.hasTarget = false;
}

/** The nearest grown animal of the same species (for babies), or undefined. */
function nearestAdult(ctx: BrainContext, m: Mob): Mob | undefined {
  let best: Mob | undefined;
  let bestD = Infinity;
  for (const o of ctx.mobs) {
    if (o === m || o.spec !== m.spec || o.baby || o.state === 'dying') continue;
    const d = (o.x - m.x) ** 2 + (o.z - m.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/** An eager partner for an eager adult, keeping an existing pairing while it stays valid. */
function partnerFor(ctx: BrainContext, m: Mob): Mob | undefined {
  const ready = (o: Mob | undefined): o is Mob =>
    o !== undefined && o !== m && o.spec === m.spec && !o.baby && o.state !== 'dying' && o.eagerS > 0 && o.cooldownS <= 0;
  if (m.partner !== 0) {
    const p = ctx.byId(m.partner);
    if (ready(p) && p.partner === m.id && (p.x - m.x) ** 2 + (p.z - m.z) ** 2 <= (MOB_BREED_RADIUS * 2) ** 2) return p;
    m.partner = 0;
    m.breedS = 0;
  }
  let best: Mob | undefined;
  let bestD = MOB_BREED_RADIUS * MOB_BREED_RADIUS;
  for (const o of ctx.mobs) {
    if (!ready(o) || o.partner !== 0) continue;
    const d = (o.x - m.x) ** 2 + (o.z - m.z) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = o;
    }
  }
  if (best) {
    m.partner = best.id;
    best.partner = m.id;
    m.breedS = 0;
    best.breedS = 0;
  }
  return best;
}

const shore = [0, 0];

/** One tick of behaviour for a living animal (the manager handles dying, timers and physics). */
export function think(ctx: BrainContext, m: Mob, dt: number): void {
  const speed = m.spec.speed;
  const grazing = m.state === 'graze';
  m.head += ((grazing ? 1 : 0) - m.head) * Math.min(1, dt * 5);

  // 1. Hurt: run straight away from whoever hurt it.
  if (m.fleeS > 0) {
    if (m.state !== 'flee') setState(m, 'flee', 0);
    let dx = m.x - m.fleeX;
    let dz = m.z - m.fleeZ;
    const d = Math.hypot(dx, dz);
    if (d < 1e-3) {
      dx = -Math.sin(m.yaw);
      dz = -Math.cos(m.yaw);
    } else {
      dx /= d;
      dz /= d;
    }
    run(ctx, m, dx, dz, speed * MOB_FLEE_SPEED_MULT, dt);
    return;
  }

  // 2. In water: swim to the nearest shore and climb out.
  if (m.inLiquid) {
    if (m.state !== 'swim' || !m.hasTarget || m.stateS <= 0) {
      setState(m, 'swim', 1);
      const wy = Math.floor(m.y + bodyHeight(m) * 0.45);
      if (findShore(ctx.world, m.x, m.z, wy, 10, clearanceOf(bodyHeight(m)), shore)) {
        m.tx = shore[0];
        m.tz = shore[1];
        m.hasTarget = true;
      }
    }
    if (m.hasTarget) {
      steer(ctx, m, m.tx, m.tz, speed * SWIM_SPEED, 0.2, dt);
      if (m.blocked) m.vy = Math.max(m.vy, SWIM_CLIMB_VELOCITY);
    } else brake(m, dt);
    return;
  }
  if (m.state === 'swim') setState(m, 'idle', 0.5);

  // 3. Eager to breed: find a partner, walk together, make a baby.
  if (!m.baby && m.eagerS > 0 && m.cooldownS <= 0) {
    const p = partnerFor(ctx, m);
    if (p) {
      if (m.state !== 'breed') setState(m, 'breed', 0);
      // Close enough to touch, face to face without their heads inside each other.
      const touch = Math.max((m.spec.size.w + p.spec.size.w) / 2 + 0.35, forwardReach(m.spec) + forwardReach(p.spec) + 0.1);
      const r = steer(ctx, m, p.x, p.z, speed, touch, dt);
      if (r === 'arrived') {
        turn(m, yawTowards(p.x - m.x, p.z - m.z), dt);
        m.breedS += dt;
        // The lower id of the pair makes the baby, once.
        if (m.id < p.id && m.breedS >= MOB_BREED_S && p.breedS >= MOB_BREED_S - dt * 1.5) ctx.birth(m, p);
      }
      return;
    }
  }
  if (m.state === 'breed') setState(m, 'idle', 1);

  // 3b. A tame companion always follows, running to catch up when it falls behind.
  if (m.tame && m.spec.pet) {
    const dx = ctx.player.x - m.x;
    const dz = ctx.player.z - m.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const stop = PET_STOP + halfWidth(m) + PLAYER_WIDTH / 2;
    if (d > stop && Math.abs(ctx.player.y - m.y) < 12) {
      if (m.state !== 'follow') setState(m, 'follow', 0);
      steer(ctx, m, ctx.player.x, ctx.player.z, d > PET_RUN_AT ? speed * 1.5 : speed, stop, dt);
      return;
    }
    if (m.state === 'follow') setState(m, 'idle', 0.5 + ctx.rng());
  }

  // 4. The player holds something it likes: follow to a polite distance, body to body (big animals stay as far
  // off as small ones).
  if (ctx.held !== null && m.spec.likes.includes(ctx.held)) {
    const dx = ctx.player.x - m.x;
    const dz = ctx.player.z - m.z;
    if (dx * dx + dz * dz <= MOB_FOLLOW_RANGE * MOB_FOLLOW_RANGE && Math.abs(ctx.player.y - m.y) < 6) {
      if (m.state !== 'follow') setState(m, 'follow', 0);
      const stop = MOB_FOLLOW_DISTANCE + halfWidth(m) + PLAYER_WIDTH / 2;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 1e-3 && d < stop - BACK_OFF) {
        // Crowded in by the rest of the flock: sidle back out to the polite distance, still facing the player.
        const k = probeAhead(ctx.world, m, -dx / d, -dz / d, ahead) ? grip(m, dt) : 0;
        m.vx += ((-dx / d) * speed * WANDER_SPEED - m.vx) * k;
        m.vz += ((-dz / d) * speed * WANDER_SPEED - m.vz) * k;
        turn(m, yawTowards(dx, dz), dt);
      } else if (steer(ctx, m, ctx.player.x, ctx.player.z, speed, stop, dt) !== 'moving') {
        turn(m, yawTowards(dx, dz), dt);
      }
      return;
    }
  }

  // 5. A baby strays too far from the grown-ups: trot back.
  if (m.baby) {
    const a = nearestAdult(ctx, m);
    if (a && (a.x - m.x) ** 2 + (a.z - m.z) ** 2 > BABY_LEASH * BABY_LEASH) {
      if (m.state !== 'follow') setState(m, 'follow', 0);
      steer(ctx, m, a.x, a.z, speed, 1.5, dt);
      return;
    }
  }
  if (m.state === 'follow' || m.state === 'flee') setState(m, 'idle', 0.5 + ctx.rng());

  idleCycle(ctx, m, dt);
}

/** The calm life of an animal: idle, graze, wander, idle... */
function idleCycle(ctx: BrainContext, m: Mob, dt: number): void {
  m.stateS -= dt;
  if (m.state === 'wander') {
    const r = steer(ctx, m, m.tx, m.tz, m.spec.speed * WANDER_SPEED, 0.4, dt);
    if (r !== 'moving') {
      setState(m, 'idle', 1 + ctx.rng() * 2);
      return;
    }
    // Pressing against a wall the hop cannot clear: give up after a while.
    m.stuckS = m.blocked ? m.stuckS + dt : Math.max(0, m.stuckS - dt);
    if (m.stuckS > STUCK_S || m.stateS <= 0) setState(m, 'idle', 1 + ctx.rng() * 2);
    return;
  }
  brake(m, dt);
  if (m.state === 'idle' && !Number.isNaN(m.lookYaw)) {
    turn(m, m.lookYaw, dt * 0.35);
    if (Math.abs(angleDiff(m.yaw, m.lookYaw)) < 0.02) m.lookYaw = NaN;
  } else if (m.state === 'idle' && ctx.rng() < dt * 0.25) {
    m.lookYaw = m.yaw + (ctx.rng() - 0.5) * 2.4;
  }
  if (m.stateS > 0) return;

  const pick = ctx.rng();
  if (pick < 0.45) {
    let cx = m.x;
    let cz = m.z;
    if (m.baby) {
      const a = nearestAdult(ctx, m);
      if (a) {
        cx = a.x;
        cz = a.z;
      }
    }
    setState(m, 'wander', 10);
    if (!pickWanderTarget(ctx, m, cx, cz)) setState(m, 'idle', 1 + ctx.rng() * 2);
  } else if (pick < 0.72) {
    setState(m, 'graze', 3 + ctx.rng() * 4);
  } else {
    setState(m, 'idle', 2 + ctx.rng() * 3);
  }
}
