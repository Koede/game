/**
 * The airship's body: state, fuel, flying physics and its saved form (docs/api/airship.md). DOM-free; it knows the world
 * only through IWorld. Same heading convention as the tractor and the player: yaw 0 faces -Z and a positive yaw turns
 * left, so forward is (-sin yaw, -cos yaw).
 *
 * A gas envelope holds the ship up on its own; the engine only pushes it along and works the trim to climb or sink. So
 * with fuel it hovers where it is left, and with an empty tank it can neither steer nor climb: it sinks slowly to the
 * ground, never falls. Above the top of the world (WORLD_HEIGHT) nothing can be hit, which is where it cruises.
 */
import { WORLD_HEIGHT, type IWorld } from '../core/types';
import { boxFree, sweepBox } from './collide';

export const AIRSHIP_ITEM = 'airship';

/** Collision box: half width (square, any heading) and height (gondola to the top of the envelope), in blocks. */
export const SHIP_HALF = 1.3;
export const SHIP_HEIGHT = 5.2;
/** Where the pilot's feet are: inside the gondola, a little aft of the middle, raised off its floor. */
export const PILOT_BACK = 0.7;
export const PILOT_UP = 0.25;
/** Top speeds (m/s) forward and astern, thrust, coasting drag. */
export const MAX_FORWARD = 11;
export const MAX_REVERSE = 3;
export const ACCEL = 3.2;
export const DRAG = 1.4;
/** Turn rate at full rudder (rad/s): TURN_AT_REST of it standing still, all of it from SPEED_FOR_FULL_TURN. */
export const MAX_TURN = 0.95;
export const TURN_AT_REST = 0.45;
export const SPEED_FOR_FULL_TURN = 4;
/** Climb and sink under power (m/s), how fast vertical speed follows the trim, and the sink of an empty ship. */
export const CLIMB = 3.5;
export const VERTICAL_ACCEL = 4;
export const DRIFT_DOWN = 1.2;
/** Highest the feet of the ship may go: a little above the world, where it cannot hit anything. */
export const CEILING = WORLD_HEIGHT + 36;

/** Tank in seconds of full-throttle flying; a Fuel Canister adds CANISTER_S (times its grade). */
export const TANK_S = 900;
export const CANISTER_S = 150;
export const IDLE_BURN = 0.15;
export const THRUST_BURN = 0.65;
export const CLIMB_BURN = 0.3;

export interface Airship {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Signed speed along the heading and vertical speed, m/s. */
  speed: number;
  vy: number;
  /** Fuel left, in tank-seconds (0..TANK_S). */
  fuel: number;
  /** Propeller angle, rudder -1..1 and pitch trim -1..1 for the model; not saved. */
  prop: number;
  rudder: number;
  trim: number;
  onGround: boolean;
}

export function createAirship(id: number, x: number, y: number, z: number, yaw: number, fuel = 0): Airship {
  return { id, x, y, z, yaw, speed: 0, vy: 0, fuel, prop: 0, rudder: 0, trim: 0, onGround: true };
}

export interface FlyInput {
  /** -1 astern .. 1 ahead, -1 left .. 1 right (the joystick or WASD), -1 sink .. 1 climb. */
  throttle: number;
  turn: number;
  climb: number;
}

export const forward = (yaw: number): { x: number; z: number } => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export const right = (yaw: number): { x: number; z: number } => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/** Where the pilot stands (feet): the player's position while flying. */
export function pilotOf(s: Airship): { x: number; y: number; z: number } {
  const f = forward(s.yaw);
  return { x: s.x - f.x * PILOT_BACK, y: s.y + PILOT_UP, z: s.z - f.z * PILOT_BACK };
}

/** Fuel burnt this step, in tank-seconds. */
export function burn(throttle: number, climb: number, dt: number): number {
  return (IDLE_BURN + THRUST_BURN * Math.min(1, Math.abs(throttle)) + CLIMB_BURN * Math.max(0, climb)) * dt;
}

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/**
 * Advances a FLOWN ship by dt: thrust and drag along the heading, the rudder, climb or sink by the trim (an empty tank
 * sinks it gently), collision with the world on every axis (it stops against a hill rather than climbing it), the
 * ceiling, fuel. Returns the fuel burnt.
 */
export function flyAirship(world: IWorld, s: Airship, input: FlyInput, dt: number): number {
  const hasFuel = s.fuel > 0;
  const throttle = hasFuel ? clamp1(input.throttle) : 0;
  const climb = hasFuel ? clamp1(input.climb) : 0;
  const target = throttle > 0 ? throttle * MAX_FORWARD : throttle * MAX_REVERSE;
  if (throttle === 0) {
    const d = DRAG * dt;
    s.speed = Math.abs(s.speed) <= d ? 0 : s.speed - Math.sign(s.speed) * d;
  } else {
    const rate = ACCEL * dt * (Math.sign(target) !== Math.sign(s.speed) && s.speed !== 0 ? 1.6 : 1);
    s.speed += Math.max(-rate, Math.min(rate, target - s.speed));
  }
  const turn = hasFuel ? clamp1(input.turn) : 0;
  s.rudder += (turn - s.rudder) * Math.min(1, dt * 4);
  const grip = TURN_AT_REST + (1 - TURN_AT_REST) * Math.min(1, Math.abs(s.speed) / SPEED_FOR_FULL_TURN);
  s.yaw -= s.rudder * MAX_TURN * grip * dt;
  if (s.yaw > Math.PI) s.yaw -= Math.PI * 2;
  else if (s.yaw < -Math.PI) s.yaw += Math.PI * 2;

  const wantVy = hasFuel ? climb * CLIMB : -DRIFT_DOWN;
  const vrate = VERTICAL_ACCEL * dt;
  s.vy += Math.max(-vrate, Math.min(vrate, wantVy - s.vy));
  s.trim += (climb - s.trim) * Math.min(1, dt * 3);

  const f = forward(s.yaw);
  const pos = { x: s.x, y: s.y, z: s.z };
  const mx = f.x * s.speed * dt;
  const mz = f.z * s.speed * dt;
  const ax = mx !== 0 ? sweepBox(world, pos, 0, mx, SHIP_HALF, SHIP_HEIGHT) : 0;
  const az = mz !== 0 ? sweepBox(world, pos, 2, mz, SHIP_HALF, SHIP_HEIGHT) : 0;
  // Against a wall the ship loses its way (the pilot climbs over, it does not).
  if (Math.abs(s.speed * dt) > 1e-6 && Math.hypot(ax, az) < Math.abs(s.speed * dt) * 0.5) s.speed *= 0.3;
  let dy = s.vy * dt;
  if (pos.y + dy > CEILING) dy = Math.min(0, CEILING - pos.y);
  const done = dy !== 0 ? sweepBox(world, pos, 1, dy, SHIP_HALF, SHIP_HEIGHT) : 0;
  s.onGround = dy < 0 && done > dy + 1e-9;
  if (done !== dy) s.vy = 0;
  if (pos.y >= CEILING && s.vy > 0) s.vy = 0;
  s.x = pos.x;
  s.y = pos.y;
  s.z = pos.z;
  s.prop += (0.6 + Math.abs(throttle) * 9 + Math.max(0, climb) * 2) * (hasFuel ? 1 : 0) * dt * Math.PI * 2;

  const used = hasFuel ? burn(throttle, climb, dt) : 0;
  s.fuel = Math.max(0, s.fuel - used);
  return used;
}

/** A moored (unflown) ship settles gently onto whatever is under it. */
export function settleAirship(world: IWorld, s: Airship, dt: number): void {
  s.speed = 0;
  s.rudder = 0;
  s.trim = 0;
  s.vy = -DRIFT_DOWN * 2;
  const pos = { x: s.x, y: s.y, z: s.z };
  const dy = s.vy * dt;
  const done = sweepBox(world, pos, 1, dy, SHIP_HALF, SHIP_HEIGHT);
  s.onGround = done > dy + 1e-9;
  if (s.onGround) s.vy = 0;
  s.y = pos.y;
}

/** Blocks of clear air under the ship, up to `max` (max when nothing is that close). */
export function clearanceBelow(world: IWorld, s: Airship, max = 4): number {
  const pos = { x: s.x, y: s.y, z: s.z };
  return -sweepBox(world, pos, 1, -max, SHIP_HALF, SHIP_HEIGHT);
}

/** Whether a ship fits with its feet at (x, y, z). */
export const roomFor = (world: IWorld, x: number, y: number, z: number): boolean => boxFree(world, { x, y, z }, SHIP_HALF, SHIP_HEIGHT);

export interface AirshipSnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  fuel: number;
}

export const snapshotOfShip = (s: Airship): AirshipSnapshot => ({ id: s.id, x: s.x, y: s.y, z: s.z, yaw: s.yaw, fuel: s.fuel });

/** A ship from saved data, or null when the data is damaged. It comes back unsettled, so it sinks to the ground if aloft. */
export function shipFromSnapshot(raw: unknown): Airship | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (![o.id, o.x, o.y, o.z, o.yaw, o.fuel].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  const s = createAirship(o.id as number, o.x as number, o.y as number, o.z as number, o.yaw as number, Math.max(0, Math.min(TANK_S, o.fuel as number)));
  s.onGround = false;
  return s;
}
