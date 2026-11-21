/**
 * The tractor's body: state, fuel, driving physics and its saved form (docs/api/tractor.md). DOM-free; it knows the
 * world only through IWorld. Heading uses the player's convention: yaw 0 faces -Z and a positive yaw turns left, so
 * forward is (-sin yaw, -cos yaw) and right is (cos yaw, -sin yaw).
 */
import type { IWorld } from '../core/types';
import { boxFree, sweepBox } from './collide';

export type Attachment = 'tiller' | 'harvester';
export const ATTACHMENTS: readonly Attachment[] = ['tiller', 'harvester'];
/** The item of each attachment. */
export const ATTACHMENT_ITEM: Readonly<Record<Attachment, string>> = { tiller: 'tractor_tiller', harvester: 'tractor_harvester' };
export const attachmentOfItem = (item: string): Attachment | null => ATTACHMENTS.find((a) => ATTACHMENT_ITEM[a] === item) ?? null;

export const TRACTOR_ITEM = 'tractor';
export const FUEL_ITEM = 'fuel_canister';

/** Collision box: half width (square, any heading) and height, in blocks. */
export const HALF_WIDTH = 0.8;
export const BODY_HEIGHT = 1.5;
/** Where the driver's feet are, relative to the body's centre, along the heading (the cab sits behind the middle). */
export const SEAT_BACK = 0.35;
/** Top speeds (m/s), acceleration, braking and coasting drag. */
export const MAX_FORWARD = 5.5;
export const MAX_REVERSE = 2.2;
export const ACCEL = 5;
export const BRAKE = 9;
export const DRAG = 2.4;
/** Turn rate at full lock (rad/s): full above SPEED_FOR_FULL_TURN, and TURN_AT_REST of it standing still. */
export const MAX_TURN = 1.35;
export const SPEED_FOR_FULL_TURN = 2.5;
export const TURN_AT_REST = 0.35;
export const GRAVITY = 24;
/** Blocks it climbs without stopping (a curb, a step). */
export const STEP_HEIGHT = 1;

/** Tank in seconds of full-throttle running; one Fuel Canister is CANISTER_S. Running cost per second below. */
export const TANK_S = 600;
export const CANISTER_S = 150;
export const IDLE_BURN = 0.2;
export const DRIVE_BURN = 0.8;
export const WORK_BURN = 0.6;

export interface Tractor {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Signed speed along the heading, m/s. */
  speed: number;
  vy: number;
  /** Fuel left, in tank-seconds (0..TANK_S). */
  fuel: number;
  attachment: Attachment | null;
  /** Metres rolled (wheels), steering angle -1..1 and the work effort 0..1 for the model; not saved. */
  roll: number;
  steer: number;
  working: number;
  onGround: boolean;
}

export function createTractor(id: number, x: number, y: number, z: number, yaw: number, attachment: Attachment | null = null, fuel = 0): Tractor {
  return { id, x, y, z, yaw, speed: 0, vy: 0, fuel, attachment, roll: 0, steer: 0, working: 0, onGround: true };
}

export interface DriveInput {
  /** -1 reverse .. 1 forward, and -1 left .. 1 right (the joystick or WASD). */
  throttle: number;
  steer: number;
}

export const forward = (yaw: number): { x: number; z: number } => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export const right = (yaw: number): { x: number; z: number } => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/** Where the driver sits (feet), the player's position while driving. */
export function seatOf(t: Tractor): { x: number; y: number; z: number } {
  const f = forward(t.yaw);
  return { x: t.x - f.x * SEAT_BACK, y: t.y, z: t.z - f.z * SEAT_BACK };
}

/** Fuel burnt this step, in tank-seconds (0 when the engine is off). */
export function burn(throttle: number, working: boolean, dt: number): number {
  return (IDLE_BURN + DRIVE_BURN * Math.min(1, Math.abs(throttle)) + (working ? WORK_BURN : 0)) * dt;
}

/**
 * Advances a DRIVEN tractor by dt: speed towards the throttle, steering, collision with the world (a 1-block step is
 * climbed, anything taller stops it), gravity, fuel. An empty tank means no throttle (it coasts to a stop).
 * Returns the fuel burnt.
 */
export function driveTractor(world: IWorld, t: Tractor, input: DriveInput, dt: number, working = false): number {
  const hasFuel = t.fuel > 0;
  const throttle = hasFuel ? Math.max(-1, Math.min(1, input.throttle)) : 0;
  const target = throttle > 0 ? throttle * MAX_FORWARD : throttle < 0 ? throttle * MAX_REVERSE : 0;
  if (throttle === 0) {
    const d = DRAG * dt;
    t.speed = Math.abs(t.speed) <= d ? 0 : t.speed - Math.sign(t.speed) * d;
  } else {
    // Pushing against the direction of travel brakes harder than speeding up.
    const rate = (Math.sign(target) !== Math.sign(t.speed) && t.speed !== 0 ? BRAKE : ACCEL) * dt;
    t.speed += Math.max(-rate, Math.min(rate, target - t.speed));
  }
  const steer = Math.max(-1, Math.min(1, input.steer));
  t.steer += (steer - t.steer) * Math.min(1, dt * 9);
  const grip = TURN_AT_REST + (1 - TURN_AT_REST) * Math.min(1, Math.abs(t.speed) / SPEED_FOR_FULL_TURN);
  // Steering right (positive) turns the machine right, i.e. a NEGATIVE yaw change; reversing flips it.
  t.yaw -= t.steer * MAX_TURN * grip * (t.speed < -0.05 ? -1 : 1) * dt;
  if (t.yaw > Math.PI) t.yaw -= Math.PI * 2;
  else if (t.yaw < -Math.PI) t.yaw += Math.PI * 2;

  const f = forward(t.yaw);
  const moveX = f.x * t.speed * dt;
  const moveZ = f.z * t.speed * dt;
  const pos = { x: t.x, y: t.y, z: t.z };
  const ox = pos.x;
  const oz = pos.z;
  let blocked = false;
  if (moveX !== 0 && sweepBox(world, pos, 0, moveX, HALF_WIDTH, BODY_HEIGHT) !== moveX) blocked = true;
  if (moveZ !== 0 && sweepBox(world, pos, 2, moveZ, HALF_WIDTH, BODY_HEIGHT) !== moveZ) blocked = true;
  if (blocked && t.onGround) {
    // The same move one step up (a curb): the box there must be free, and it must really get further. It then drops
    // back down onto whatever is under it, so a half-block step is climbed by half a block, not a whole one.
    const up = { x: ox, y: t.y + STEP_HEIGHT, z: oz };
    if (boxFree(world, up, HALF_WIDTH, BODY_HEIGHT)) {
      const a = sweepBox(world, up, 0, moveX, HALF_WIDTH, BODY_HEIGHT);
      const b = sweepBox(world, up, 2, moveZ, HALF_WIDTH, BODY_HEIGHT);
      if (a === moveX && b === moveZ) {
        sweepBox(world, up, 1, -STEP_HEIGHT, HALF_WIDTH, BODY_HEIGHT);
        pos.x = up.x;
        pos.y = up.y;
        pos.z = up.z;
      }
    }
  }
  const moved = Math.hypot(pos.x - ox, pos.z - oz);
  // Walls take the speed away (it did not get where it wanted).
  if (Math.abs(t.speed * dt) > 1e-6 && moved < Math.abs(t.speed * dt) * 0.5) t.speed *= 0.4;
  t.roll += (t.speed >= 0 ? 1 : -1) * moved;

  // Gravity and the ground.
  t.vy -= GRAVITY * dt;
  const dy = t.vy * dt;
  const done = sweepBox(world, pos, 1, dy, HALF_WIDTH, BODY_HEIGHT);
  t.onGround = dy < 0 && done > dy + 1e-9;
  if (done !== dy) t.vy = 0;
  t.x = pos.x;
  t.y = pos.y;
  t.z = pos.z;

  const used = burn(throttle, working, dt);
  t.fuel = Math.max(0, t.fuel - used);
  return used;
}

/** A parked tractor settles under gravity (a block was dug from under it) and stands still. */
export function settleTractor(world: IWorld, t: Tractor, dt: number): void {
  t.speed = 0;
  t.steer = 0;
  t.vy -= GRAVITY * dt;
  const pos = { x: t.x, y: t.y, z: t.z };
  const dy = t.vy * dt;
  const done = sweepBox(world, pos, 1, dy, HALF_WIDTH, BODY_HEIGHT);
  t.onGround = dy < 0 && done > dy + 1e-9;
  if (done !== dy) t.vy = 0;
  t.y = pos.y;
}

export interface TractorSnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  fuel: number;
  attachment: Attachment | null;
}

export const snapshotOf = (t: Tractor): TractorSnapshot => ({ id: t.id, x: t.x, y: t.y, z: t.z, yaw: t.yaw, fuel: t.fuel, attachment: t.attachment });

/** A tractor from saved data, or null when the data is damaged. */
export function fromSnapshot(s: unknown): Tractor | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const nums = [o.id, o.x, o.y, o.z, o.yaw, o.fuel];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const attachment = ATTACHMENTS.find((a) => a === o.attachment) ?? null;
  return createTractor(o.id as number, o.x as number, o.y as number, o.z as number, o.yaw as number, attachment, Math.max(0, Math.min(TANK_S, o.fuel as number)));
}
