/**
 * Player movement against the voxel world (spec 7.3): an axis-aligned 0.6 x 1.8 box, swept one axis at a time
 * so nothing tunnels at any speed, with gravity, jumping, sprinting (not while Hungry), swimming, stepping onto
 * slabs and fall damage. Flowing water carries the player along and a waterfall pushes down (spec 18.4). Unloaded
 * chunks count as solid walls, so the player never falls through terrain that is not there yet. DOM-free and
 * allocation-free per step.
 */
import { GRAVITY, JUMP_VELOCITY, PLAYER_EYE, SPRINT_SPEED, SWIM_SPEED, WALK_SPEED } from '../core/constants';
import { blockOf } from '../core/registry';
import { WORLD_HEIGHT, type IWorld } from '../core/types';
import { fallDamage, type PlayerState } from '../game';
import { currentAt } from '../world/water';
import { EPS, boxIntersectsCell, overlapsLoadedSolid, solidHeight, sweepAxis } from './collision';

/** What the physics needs from this frame's intent. */
export interface MoveInput {
  /** Strafe -1..1 (positive = right) and walk -1..1 (positive = forward); the vector is at most length 1. */
  moveX: number;
  moveZ: number;
  jump: boolean;
  sprint: boolean;
}

/** What happened during one step (the same object is reused by every call). */
export interface StepResult {
  /** Height fallen when the player landed this step, else 0. */
  landedFrom: number;
  jumped: boolean;
  /** The body entered water this step. */
  enteredWater: boolean;
  /** Horizontal distance covered on the ground (for footsteps). */
  walked: number;
  /** Height climbed by stepping onto something low (for smoothing the camera). */
  steppedUp: number;
  /** The player was out of the world and was put back at the spawn. */
  fellOut: boolean;
  sprinting: boolean;
}

/** Largest distance moved in one sub-step along any axis. */
const MAX_SUBSTEP = 0.45;
/** Fastest fall, m/s (still exact at any speed: the sweep is continuous). */
export const MAX_FALL_SPEED = 60;
/** Highest ledge (in blocks) walked onto without jumping: a slab. */
export const STEP_HEIGHT = 0.5 + 0.02;
/** How quickly horizontal velocity follows the intent (1/s) on the ground, in the air and in liquids. */
const GROUND_RESPONSE = 14;
const AIR_RESPONSE = 2.5;
const LIQUID_RESPONSE = 6;
/** Swimming: net sink acceleration, vertical drag, rising speed with Space, and the boost out onto a bank. */
const LIQUID_SINK = GRAVITY * 0.25;
const LIQUID_DRAG = 4;
const SWIM_UP_SPEED = 3.2;
const SWIM_UP_RESPONSE = 8;
const LEDGE_CLIMB_SPEED = 6.5;
/** Below this the player is out of the world (y < 0 is solid, so this only catches bugs and teleports). */
const OUT_OF_WORLD_Y = -8;
/** Height above the feet sampled to decide whether the body is in a liquid (waist) and in water (feet / chest). */
const WAIST = 0.4;
/** Sprinting needs the stick or keys pushed mostly forward. */
const SPRINT_MIN_FORWARD = 0.3;
/** Downward acceleration of a waterfall on a swimmer, m/s^2: swimming up still climbs it, slowly. */
const FALLING_WATER_PUSH = 10;
/** Heights above the feet where the current is felt (feet, then waist). */
const CURRENT_SAMPLES = [0.1, WAIST] as const;

export class PlayerPhysics {
  readonly result: StepResult = { landedFrom: 0, jumped: false, enteredWater: false, walked: 0, steppedUp: 0, fellOut: false, sprinting: false };
  /** The body is in any liquid (water or lava): swimming rules apply. */
  inLiquid = false;
  /** Highest feet position since the player last stood on something (for fall damage). */
  private fallTop: number;
  /** Set by moveAxis: the last sweep was cut short. */
  private blocked = false;
  /** The current where the body is this step (m/s; y -1 = under a waterfall). */
  readonly current = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
  ) {
    this.fallTop = player.position.y;
  }

  /** Forget the fall in progress (after a teleport or respawn). */
  reset(): void {
    this.fallTop = this.player.position.y;
    this.player.velocity.x = this.player.velocity.y = this.player.velocity.z = 0;
  }

  /** Height of the collision box in cell (x, y, z): 0 = passable, 0.5 = slab, 1 = full. */
  solidHeight(x: number, y: number, z: number): number {
    return solidHeight(this.world, x, y, z);
  }

  /** Whether a block of the given height in cell (x, y, z) would intersect the player's box. */
  intersectsCell(x: number, y: number, z: number, height = 1): boolean {
    return boxIntersectsCell(this.player.position, x, y, z, height);
  }

  /** Advances the player by `dt` seconds. */
  step(dt: number, input: MoveInput): StepResult {
    const r = this.result;
    r.landedFrom = 0;
    r.jumped = false;
    r.enteredWater = false;
    r.walked = 0;
    r.steppedUp = 0;
    r.fellOut = false;
    r.sprinting = false;
    const p = this.player;
    const pos = p.position;
    const v = p.velocity;
    p.sprinting = false;
    if (p.dead || !(dt > 0)) return r;
    if (!Number.isFinite(pos.x + pos.y + pos.z) || pos.y < OUT_OF_WORLD_Y) {
      this.backToSpawn();
      return r;
    }
    this.unstick();

    const wasInWater = p.inWater;
    this.sampleLiquids();
    if (p.inWater && !wasInWater) r.enteredWater = true;

    // Horizontal: velocity eases towards what the intent asks for (yaw 0 looks -Z, positive turns left).
    const sin = Math.sin(p.yaw);
    const cos = Math.cos(p.yaw);
    const wishX = cos * input.moveX - sin * input.moveZ;
    const wishZ = -sin * input.moveX - cos * input.moveZ;
    // A Hungry player cannot sprint (spec 12.1).
    r.sprinting = input.sprint && input.moveZ > SPRINT_MIN_FORWARD && !this.inLiquid && !p.hungry;
    p.sprinting = r.sprinting;
    const speed = this.inLiquid ? SWIM_SPEED : r.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const response = this.inLiquid ? LIQUID_RESPONSE : p.onGround ? GROUND_RESPONSE : AIR_RESPONSE;
    const blend = 1 - Math.exp(-response * dt);
    // Flowing water at the feet or the waist carries the body along (what it would do with no input).
    const c = this.sampleCurrent();
    v.x += (wishX * speed + c.x - v.x) * blend;
    v.z += (wishZ * speed + c.z - v.z) * blend;

    // Vertical.
    if (this.inLiquid) {
      if (input.jump) v.y += (SWIM_UP_SPEED - v.y) * (1 - Math.exp(-SWIM_UP_RESPONSE * dt));
      else v.y = (v.y - LIQUID_SINK * dt) * Math.exp(-LIQUID_DRAG * dt);
      if (c.y < 0) v.y -= FALLING_WATER_PUSH * dt;
    } else {
      if (input.jump && p.onGround) {
        v.y = JUMP_VELOCITY;
        r.jumped = true;
      }
      v.y = Math.max(v.y - GRAVITY * dt, -MAX_FALL_SPEED);
    }

    const wasOnGround = p.onGround;
    this.integrate(dt, wasOnGround, input.jump);
    this.sampleLiquids();

    // Fall tracking: the highest point since last standing; water breaks every fall.
    if (this.inLiquid) this.fallTop = pos.y;
    else if (!p.onGround) this.fallTop = Math.max(this.fallTop, pos.y);
    else {
      if (!wasOnGround) {
        r.landedFrom = Math.max(0, this.fallTop - pos.y);
        const damage = fallDamage(r.landedFrom);
        if (damage > 0) p.damage(damage, 'fall');
      }
      this.fallTop = pos.y;
    }
    return r;
  }

  private integrate(dt: number, wasOnGround: boolean, jumpHeld: boolean): void {
    const p = this.player;
    const pos = p.position;
    const v = p.velocity;
    const dx = v.x * dt;
    const dy = v.y * dt;
    const dz = v.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_SUBSTEP));
    const sx = dx / steps;
    const sy = dy / steps;
    const sz = dz / steps;
    let grounded = false;
    let hitX = false;
    let hitZ = false;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(1, sy);
      if (this.blocked) {
        if (sy < 0) grounded = true;
        v.y = 0;
      }
      const beforeX = pos.x;
      const beforeZ = pos.z;
      const beforeY = pos.y;
      this.moveAxis(0, sx);
      let blockedX = this.blocked;
      this.moveAxis(2, sz);
      let blockedZ = this.blocked;
      if ((blockedX || blockedZ) && (wasOnGround || grounded) && !this.inLiquid) {
        const climbed = this.tryStep(beforeX, beforeY, beforeZ, sx, sz);
        if (climbed > 0) {
          this.result.steppedUp += climbed;
          blockedX = Math.abs(pos.x - beforeX - sx) > EPS;
          blockedZ = Math.abs(pos.z - beforeZ - sz) > EPS;
        }
      }
      hitX ||= blockedX;
      hitZ ||= blockedZ;
      if (grounded || wasOnGround) this.result.walked += Math.hypot(pos.x - beforeX, pos.z - beforeZ);
    }
    if (hitX) v.x = 0;
    if (hitZ) v.z = 0;
    // Pushing into a bank while swimming up climbs out onto it.
    if (this.inLiquid && jumpHeld && (hitX || hitZ)) v.y = Math.max(v.y, LEDGE_CLIMB_SPEED);
    p.onGround = grounded;
  }

  /**
   * Retries a blocked horizontal move lifted by STEP_HEIGHT and settled back down. Keeps whichever attempt got
   * further; returns the height climbed (0 when stepping did not help and the plain move was kept).
   */
  private tryStep(x0: number, y0: number, z0: number, sx: number, sz: number): number {
    const pos = this.player.position;
    const plainX = pos.x;
    const plainY = pos.y;
    const plainZ = pos.z;
    const plain = Math.hypot(plainX - x0, plainZ - z0);
    pos.x = x0;
    pos.y = y0;
    pos.z = z0;
    const lifted = this.moveAxis(1, STEP_HEIGHT);
    this.moveAxis(0, sx);
    this.moveAxis(2, sz);
    this.moveAxis(1, -lifted);
    const stepped = Math.hypot(pos.x - x0, pos.z - z0);
    if (stepped > plain + EPS && pos.y > y0 + EPS) return pos.y - y0;
    pos.x = plainX;
    pos.y = plainY;
    pos.z = plainZ;
    return 0;
  }

  /** Sweeps the box along one axis; sets `blocked` when the move was cut short. */
  private moveAxis(axis: 0 | 1 | 2, d: number): number {
    const moved = sweepAxis(this.world, this.player.position, axis, d);
    this.blocked = moved !== d;
    return moved;
  }

  /** Lifts the player out of loaded solid blocks it is stuck in (a block appeared inside it), up to 2 blocks. */
  private unstick(): void {
    const pos = this.player.position;
    if (!overlapsLoadedSolid(this.world, pos)) return;
    const y0 = pos.y;
    for (let lift = 1; lift <= 3; lift++) {
      pos.y = Math.floor(y0) + lift;
      if (!overlapsLoadedSolid(this.world, pos)) {
        if (pos.y - y0 > 2.01) break;
        this.player.velocity.y = 0;
        this.fallTop = pos.y;
        return;
      }
    }
    pos.y = y0;
  }

  private sampleLiquids(): void {
    const p = this.player;
    const pos = p.position;
    const x = Math.floor(pos.x);
    const z = Math.floor(pos.z);
    const waist = this.liquidAt(x, Math.floor(pos.y + WAIST), z);
    this.inLiquid = waist !== null;
    p.inWater = waist === 'water' || this.liquidAt(x, Math.floor(pos.y + 0.1), z) === 'water' || this.liquidAt(x, Math.floor(pos.y + 1.2), z) === 'water';
    p.headInWater = this.liquidAt(x, Math.floor(pos.y + PLAYER_EYE), z) === 'water';
  }

  /** The current at the feet, else at the waist (spec 18.4). */
  private sampleCurrent(): { x: number; y: number; z: number } {
    const pos = this.player.position;
    const x = Math.floor(pos.x);
    const z = Math.floor(pos.z);
    const c = this.current;
    for (const dy of CURRENT_SAMPLES) {
      const y = Math.floor(pos.y + dy);
      if (y >= 0 && y < WORLD_HEIGHT && this.world.isLoaded(x, z) && currentAt(this.world, x, y, z, c)) return c;
    }
    return c;
  }

  private liquidAt(x: number, y: number, z: number): string | null {
    if (y < 0 || y >= WORLD_HEIGHT || !this.world.isLoaded(x, z)) return null;
    return blockOf(this.world.getVoxel(x, y, z)).liquid;
  }

  private backToSpawn(): void {
    const p = this.player;
    const s = p.spawn;
    const x = Math.floor(s.x);
    const z = Math.floor(s.z);
    const surface = this.world.isLoaded(x, z) ? this.world.surfaceY(x, z) : -1;
    p.position.x = s.x;
    p.position.z = s.z;
    p.position.y = surface >= 0 ? Math.max(s.y, surface + 1) : s.y;
    p.onGround = false;
    this.reset();
    this.result.fellOut = true;
  }
}
