/**
 * How automatons move (spec 19.2): walkers steer straight at a point with the animals' edge guard (hop one block,
 * never into liquid, off a drop deeper than MOB_MAX_DROP or beside lava) and never step into a safe zone; flyers hold
 * HOSTILE_HOVER_MIN..MAX above the ground with no gravity; stationary ones only turn. No path finding: the brain
 * counts the time a walker spends 'blocked' and gives up.
 */
import { WORLD_HEIGHT, type IWorld } from '../core/types';
import { angleDiff, bodyHeight, halfWidth, yawTowards } from './brain';
import { HOP_VELOCITY, moveAxis } from './physics';
import { clearanceOf, solidHeight, standCell } from './terrain';
import type { Mob } from './types';

const ACCEL = 10;
const AIR_ACCEL = 1.5;
/** Flyers: how quickly they reach their wanted velocity, and their climb speed limit (blocks per second). */
const FLY_ACCEL = 4;
const FLY_CLIMB = 3;
/** Flyers look this far down for the ground they hover over; with none, they sink towards the lowest hover height. */
const GROUND_SCAN = 16;

/** Something that says whether a point is inside a safe zone. */
export type SafeTest = (x: number, y: number, z: number) => boolean;

export type StrideResult = 'arrived' | 'moving' | 'blocked' | 'unsafe';

/** Turns `m` towards `target` at `rate` radians per second. */
export function turnTo(m: Mob, target: number, rate: number, dt: number): void {
  const d = angleDiff(m.yaw, target);
  const step = rate * dt;
  m.yaw += Math.abs(d) <= step ? d : Math.sign(d) * step;
  if (m.yaw > Math.PI) m.yaw -= Math.PI * 2;
  else if (m.yaw < -Math.PI) m.yaw += Math.PI * 2;
}

/** Slows a walker's horizontal velocity to a stop (little control in the air, so knockback carries). */
export function brakeWalker(m: Mob, dt: number): void {
  const k = Math.min(1, (m.onGround || m.inLiquid ? ACCEL : AIR_ACCEL) * dt);
  m.vx -= m.vx * k;
  m.vz -= m.vz * k;
}

const hop = { up: false };

/**
 * Whether the edge guard lets a walker take its next stride along (dirX, dirZ); sets hop.up when it must hop one
 * block. In water any direction is allowed (it is trying to get out).
 */
function strideOk(world: IWorld, m: Mob, dirX: number, dirZ: number): boolean {
  hop.up = false;
  if (m.inLiquid) return true;
  const reach = halfWidth(m) + 0.3;
  const ax = Math.floor(m.x + dirX * reach);
  const az = Math.floor(m.z + dirZ * reach);
  if (ax === Math.floor(m.x) && az === Math.floor(m.z)) return true;
  const fy = Math.floor(m.y + 0.01);
  const next = standCell(world, ax, az, fy, clearanceOf(bodyHeight(m)));
  if (Number.isNaN(next)) return false;
  hop.up = next > fy;
  return true;
}

/**
 * Steers a walker towards (tx, tz) at `speed`, stopping within `stop` blocks; turns at `turnRate`. 'blocked' when the
 * edge guard refused the next stride or a wall held it (and a hop did not help), 'unsafe' when the next stride would
 * enter a safe zone it is not already in (it halts at the edge).
 */
export function walkTo(world: IWorld, safe: SafeTest, m: Mob, tx: number, tz: number, speed: number, stop: number, turnRate: number, dt: number): StrideResult {
  const dx = tx - m.x;
  const dz = tz - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= stop) {
    brakeWalker(m, dt);
    return 'arrived';
  }
  const dirX = dx / dist;
  const dirZ = dz / dist;
  turnTo(m, yawTowards(dirX, dirZ), turnRate, dt);
  const reach = halfWidth(m) + 0.6;
  const midY = m.y + bodyHeight(m) * 0.5;
  if (safe(m.x + dirX * reach, midY, m.z + dirZ * reach) && !safe(m.x, midY, m.z)) {
    m.vx = 0;
    m.vz = 0;
    return 'unsafe';
  }
  if (!strideOk(world, m, dirX, dirZ)) {
    m.vx = 0;
    m.vz = 0;
    return 'blocked';
  }
  const want = Math.min(speed, (dist - stop) * 4);
  const k = Math.min(1, (m.onGround || m.inLiquid ? ACCEL : AIR_ACCEL) * dt);
  m.vx += (dirX * want - m.vx) * k;
  m.vz += (dirZ * want - m.vz) * k;
  if (m.onGround && (hop.up || m.blocked)) m.vy = HOP_VELOCITY;
  return m.blocked && m.onGround && !hop.up ? 'blocked' : 'moving';
}

/** Feet height of the ground under a flyer (the top of the first solid cell below it), or NaN when none is near. */
export function groundBelow(world: IWorld, x: number, y: number, z: number): number {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let cy = Math.min(WORLD_HEIGHT - 1, Math.floor(y)); cy >= Math.max(-1, Math.floor(y) - GROUND_SCAN); cy--) {
    const sh = solidHeight(world, bx, cy, bz);
    if (sh > 0) return cy + sh;
  }
  return NaN;
}

/**
 * Sets a flyer's velocity: horizontally towards (tx, tz) (stopping within `stop`), vertically towards its hover height
 * over the ground below. Halts at the edge of a safe zone like a walker. Returns like walkTo ('blocked' when a wall
 * held it last tick).
 */
export function flyTo(world: IWorld, safe: SafeTest, m: Mob, tx: number, tz: number, speed: number, stop: number, hover: number, turnRate: number, dt: number): StrideResult {
  const ground = groundBelow(world, m.x, m.y, m.z);
  const wantY = Number.isNaN(ground) ? m.y - 1 : ground + hover;
  const k = Math.min(1, FLY_ACCEL * dt);
  m.vy += (Math.max(-FLY_CLIMB, Math.min(FLY_CLIMB, (wantY - m.y) * 2)) - m.vy) * k;
  const dx = tx - m.x;
  const dz = tz - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= stop) {
    m.vx -= m.vx * k;
    m.vz -= m.vz * k;
    return 'arrived';
  }
  const dirX = dx / dist;
  const dirZ = dz / dist;
  turnTo(m, yawTowards(dirX, dirZ), turnRate, dt);
  const reach = halfWidth(m) + 0.6;
  const midY = m.y + bodyHeight(m) * 0.5;
  if (safe(m.x + dirX * reach, midY, m.z + dirZ * reach) && !safe(m.x, midY, m.z)) {
    m.vx -= m.vx * k;
    m.vz -= m.vz * k;
    return 'unsafe';
  }
  const want = Math.min(speed, (dist - stop) * 3);
  m.vx += (dirX * want - m.vx) * k;
  m.vz += (dirZ * want - m.vz) * k;
  return m.blocked ? 'blocked' : 'moving';
}

/** Hovering in place: no horizontal drive, holding the hover height. */
export function hoverStill(world: IWorld, m: Mob, hover: number, dt: number): void {
  flyTo(world, () => false, m, m.x, m.z, 0, 1, hover, 0, dt);
}

/** One physics step of a flyer: no gravity, swept per axis in sub-steps (never through a wall). */
export function stepFlyer(world: IWorld, m: Mob, dt: number): void {
  const hw = halfWidth(m);
  const h = bodyHeight(m);
  m.blocked = false;
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(m.vx), Math.abs(m.vy), Math.abs(m.vz)) * dt) / 0.45));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const wx = m.vx * sdt;
    const wz = m.vz * sdt;
    if (Math.abs(moveAxis(world, m, hw, h, 0, wx) - wx) > 1e-6) {
      m.blocked = true;
      m.vx = 0;
    }
    if (Math.abs(moveAxis(world, m, hw, h, 2, wz) - wz) > 1e-6) {
      m.blocked = true;
      m.vz = 0;
    }
    const wy = m.vy * sdt;
    if (Math.abs(moveAxis(world, m, hw, h, 1, wy) - wy) > 1e-6) m.vy = 0;
  }
  if (m.y > WORLD_HEIGHT - h) m.y = WORLD_HEIGHT - h;
  m.onGround = false;
  m.inLiquid = false;
}
