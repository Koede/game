/**
 * An animal's body against the voxels: an axis-aligned box (w x w footprint, h tall, origin at the centre of the
 * feet) with gravity, buoyancy in liquids, currents in flowing water and per-axis sweeps that never tunnel. Unloaded columns are walls
 * (solidHeight). Cells the box already overlaps are ignored, so an animal a block was placed into walks out.
 */
import { GRAVITY } from '../core/constants';
import { blockOf } from '../core/registry';
import type { IWorld } from '../core/types';
import { currentAt } from '../world/water';
import { liquidAt, solidHeight } from './terrain';

/** Upward speed of a hop: clears one block (v^2 / 2g = 1.23 blocks). */
export const HOP_VELOCITY = 8;
/** Climbing out of water onto a bank. */
export const SWIM_CLIMB_VELOCITY = 5.5;
export const MAX_FALL_SPEED = 40;
const MAX_STEP = 0.45;
const EPS = 1e-4;
/** A waterfall drags an animal down at up to this speed (m/s) despite its buoyancy (spec 18.4). */
const FALLING_WATER_SINK = 2.5;
/** The current where the body is (m/s), shared scratch: flowing water carries animals along (spec 18.4). */
const current = { x: 0, y: 0, z: 0 };

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  inLiquid: boolean;
}

/** What one physics step ran into (reused object). */
export interface StepInfo {
  /** Horizontal movement was cut short by a wall. */
  blocked: boolean;
}

/** The worst contact damage touching a body and where it comes from (reused object). */
export interface Hazard {
  damage: number;
  x: number;
  z: number;
}

/** How far beyond its box a body still counts as touching a hazard: pressed against it, not merely beside it. */
const TOUCH = 0.01;

/**
 * Largest contactDamage (per second: lava, cactus...) among the cells the body overlaps or touches sideways
 * (within TOUCH); writes it and the centre of that cell to `out`. Returns the damage (0 = safe). A body centred
 * in the cell next to a hazard does not touch it.
 */
export function contactHazard(world: IWorld, b: Body, hw: number, h: number, out: Hazard): number {
  out.damage = 0;
  for (let cy = Math.floor(b.y); cy <= Math.floor(b.y + h); cy++) {
    for (let cz = Math.floor(b.z - hw - TOUCH); cz <= Math.floor(b.z + hw + TOUCH); cz++) {
      for (let cx = Math.floor(b.x - hw - TOUCH); cx <= Math.floor(b.x + hw + TOUCH); cx++) {
        const dmg = blockOf(world.getVoxel(cx, cy, cz)).contactDamage;
        if (dmg > out.damage) {
          out.damage = dmg;
          out.x = cx + 0.5;
          out.z = cz + 0.5;
        }
      }
    }
  }
  return out.damage;
}

/** Moves the body by `d` along one axis (0 x, 1 y, 2 z), stopping at solid cells. Returns the distance moved. */
export function moveAxis(world: IWorld, b: Body, hw: number, h: number, axis: 0 | 1 | 2, d: number): number {
  if (d === 0) return 0;
  const x0 = b.x - hw;
  const x1 = b.x + hw;
  const y0 = b.y;
  const y1 = b.y + h;
  const z0 = b.z - hw;
  const z1 = b.z + hw;
  const dx = axis === 0 ? d : 0;
  const dy = axis === 1 ? d : 0;
  const dz = axis === 2 ? d : 0;
  const ax0 = Math.floor(Math.min(x0, x0 + dx));
  const ax1 = Math.floor(Math.max(x1, x1 + dx) - EPS);
  const ay0 = Math.floor(Math.min(y0, y0 + dy));
  const ay1 = Math.floor(Math.max(y1, y1 + dy) - EPS);
  const az0 = Math.floor(Math.min(z0, z0 + dz));
  const az1 = Math.floor(Math.max(z1, z1 + dz) - EPS);
  let allowed = d;
  for (let cy = ay0; cy <= ay1; cy++) {
    for (let cz = az0; cz <= az1; cz++) {
      for (let cx = ax0; cx <= ax1; cx++) {
        const sh = solidHeight(world, cx, cy, cz);
        if (sh === 0) continue;
        const top = cy + sh;
        // Already inside this cell before moving: ignore it so a trapped animal can walk out.
        if (x0 < cx + 1 - EPS && x1 > cx + EPS && y0 < top - EPS && y1 > cy + EPS && z0 < cz + 1 - EPS && z1 > cz + EPS) continue;
        // Overlap after the move?
        if (!(x0 + dx < cx + 1 - EPS && x1 + dx > cx + EPS && y0 + dy < top - EPS && y1 + dy > cy + EPS && z0 + dz < cz + 1 - EPS && z1 + dz > cz + EPS)) continue;
        if (axis === 0) allowed = d > 0 ? Math.min(allowed, Math.max(0, cx - x1 - EPS)) : Math.max(allowed, Math.min(0, cx + 1 - x0 + EPS));
        else if (axis === 1) allowed = d > 0 ? Math.min(allowed, Math.max(0, cy - y1 - EPS)) : Math.max(allowed, Math.min(0, top - y0 + EPS));
        else allowed = d > 0 ? Math.min(allowed, Math.max(0, cz - z1 - EPS)) : Math.max(allowed, Math.min(0, cz + 1 - z0 + EPS));
      }
    }
  }
  if (axis === 0) b.x += allowed;
  else if (axis === 1) b.y += allowed;
  else b.z += allowed;
  return allowed;
}

/** True when the body's box overlaps any solid cell (used to lift animals out of blocks placed into them). */
export function embedded(world: IWorld, b: Body, hw: number, h: number): boolean {
  for (let cy = Math.floor(b.y); cy <= Math.floor(b.y + h - EPS); cy++) {
    for (let cz = Math.floor(b.z - hw); cz <= Math.floor(b.z + hw - EPS); cz++) {
      for (let cx = Math.floor(b.x - hw); cx <= Math.floor(b.x + hw - EPS); cx++) {
        const sh = solidHeight(world, cx, cy, cz);
        if (sh > 0 && b.y < cy + sh - EPS && b.y + h > cy + EPS) return true;
      }
    }
  }
  return false;
}

/**
 * One physics step: vertical forces (gravity, or buoyancy that floats the body with its waist at the surface),
 * then the sweeps along x, z and y in sub-steps of at most MAX_STEP. The horizontal velocity is the caller's.
 */
export function stepBody(world: IWorld, b: Body, hw: number, h: number, dt: number, info: StepInfo): StepInfo {
  const waist = liquidAt(world, Math.floor(b.x), Math.floor(b.y + h * 0.45), Math.floor(b.z));
  const feet = liquidAt(world, Math.floor(b.x), Math.floor(b.y + 0.05), Math.floor(b.z));
  b.inLiquid = waist !== null || feet !== null;
  info.blocked = false;
  // The current at the feet, else at the waist; it adds to the walk without changing the brain's velocity.
  if (feet === null || !currentAt(world, Math.floor(b.x), Math.floor(b.y + 0.05), Math.floor(b.z), current)) {
    if (waist === null || !currentAt(world, Math.floor(b.x), Math.floor(b.y + h * 0.45), Math.floor(b.z), current)) current.x = current.y = current.z = 0;
  }
  if (waist !== null && current.y < 0) {
    b.vy = Math.max(b.vy - 22 * dt, -FALLING_WATER_SINK);
  } else if (waist !== null) {
    b.vy = Math.min(b.vy + 22 * dt, 1.8);
    b.vy *= 0.9;
  } else if (feet !== null) {
    b.vy = Math.max(b.vy - 9 * dt, -2.5);
    b.vy *= 0.9;
  } else {
    b.vy = Math.max(b.vy - GRAVITY * dt, -MAX_FALL_SPEED);
  }

  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(b.vx + current.x), Math.abs(b.vy), Math.abs(b.vz + current.z)) * dt) / MAX_STEP));
  const sdt = dt / steps;
  let grounded = false;
  for (let i = 0; i < steps; i++) {
    const wantX = (b.vx + current.x) * sdt;
    const wantZ = (b.vz + current.z) * sdt;
    if (Math.abs(moveAxis(world, b, hw, h, 0, wantX) - wantX) > 1e-6) {
      info.blocked = true;
      b.vx = 0;
    }
    if (Math.abs(moveAxis(world, b, hw, h, 2, wantZ) - wantZ) > 1e-6) {
      info.blocked = true;
      b.vz = 0;
    }
    const wantY = b.vy * sdt;
    const movedY = moveAxis(world, b, hw, h, 1, wantY);
    if (Math.abs(movedY - wantY) > 1e-6) {
      if (wantY < 0) grounded = true;
      b.vy = 0;
    }
  }
  // Resting on the ground with no vertical speed still counts as grounded.
  if (!grounded && b.vy <= 0) grounded = supported(world, b, hw);
  b.onGround = grounded;
  return info;
}

/** True when something solid is directly under the box's feet. */
export function supported(world: IWorld, b: Body, hw: number): boolean {
  const below = b.y - 0.02;
  const cy = Math.floor(below);
  for (let cz = Math.floor(b.z - hw); cz <= Math.floor(b.z + hw - EPS); cz++) {
    for (let cx = Math.floor(b.x - hw); cx <= Math.floor(b.x + hw - EPS); cx++) {
      const sh = solidHeight(world, cx, cy, cz);
      if (sh > 0 && cy + sh >= below && cy + sh <= b.y + 0.02) return true;
    }
  }
  return false;
}
