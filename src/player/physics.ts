/**
 * Player movement against the voxel world (spec 7.3): an axis-aligned 0.6 x 1.8 box, swept one axis at a time
 * so nothing tunnels at any speed, with gravity, jumping, sprinting, swimming, stepping onto slabs and fall
 * damage. Unloaded chunks count as solid walls, so the player never falls through terrain that is not there yet.
 * DOM-free and allocation-free per step.
 */
import { GRAVITY, JUMP_VELOCITY, PLAYER_EYE, PLAYER_HEIGHT, PLAYER_WIDTH, SPRINT_SPEED, SWIM_SPEED, WALK_SPEED } from '../core/constants';
import { blockOf } from '../core/registry';
import { WORLD_HEIGHT, type IWorld } from '../core/types';
import { fallDamage, type PlayerState } from '../game';

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

const HALF = PLAYER_WIDTH / 2;
const EPS = 1e-4;
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

export class PlayerPhysics {
  readonly result: StepResult = { landedFrom: 0, jumped: false, enteredWater: false, walked: 0, steppedUp: 0, fellOut: false, sprinting: false };
  /** The body is in any liquid (water or lava): swimming rules apply. */
  inLiquid = false;
  /** Highest feet position since the player last stood on something (for fall damage). */
  private fallTop: number;
  /** Set by moveAxis: the last sweep was cut short. */
  private blocked = false;

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
    if (y < 0) return 1;
    if (y >= WORLD_HEIGHT) return 0;
    if (!this.world.isLoaded(x, z)) return 1;
    const def = blockOf(this.world.getVoxel(x, y, z));
    if (!def.solid) return 0;
    return def.shape === 'slab' ? 0.5 : 1;
  }

  /** Whether a block of the given height in cell (x, y, z) would intersect the player's box. */
  intersectsCell(x: number, y: number, z: number, height = 1): boolean {
    const p = this.player.position;
    return (
      p.x + HALF > x + EPS &&
      p.x - HALF < x + 1 - EPS &&
      p.z + HALF > z + EPS &&
      p.z - HALF < z + 1 - EPS &&
      p.y + PLAYER_HEIGHT > y + EPS &&
      p.y < y + height - EPS
    );
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
    r.sprinting = input.sprint && input.moveZ > SPRINT_MIN_FORWARD && !this.inLiquid;
    const speed = this.inLiquid ? SWIM_SPEED : r.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const response = this.inLiquid ? LIQUID_RESPONSE : p.onGround ? GROUND_RESPONSE : AIR_RESPONSE;
    const blend = 1 - Math.exp(-response * dt);
    v.x += (wishX * speed - v.x) * blend;
    v.z += (wishZ * speed - v.z) * blend;

    // Vertical.
    if (this.inLiquid) {
      if (input.jump) v.y += (SWIM_UP_SPEED - v.y) * (1 - Math.exp(-SWIM_UP_RESPONSE * dt));
      else v.y = (v.y - LIQUID_SINK * dt) * Math.exp(-LIQUID_DRAG * dt);
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

  /**
   * Sweeps the box along one axis (0 = x, 1 = y, 2 = z) by `d`, stopping at the first solid box in the way.
   * Boxes the player already overlaps are ignored so a stuck player can always walk out. Returns the distance
   * actually moved and sets `blocked` when the move was cut short.
   */
  private moveAxis(axis: 0 | 1 | 2, d: number): number {
    this.blocked = false;
    if (d === 0) return 0;
    const pos = this.player.position;
    const minX = pos.x - HALF;
    const maxX = pos.x + HALF;
    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;
    const minZ = pos.z - HALF;
    const maxZ = pos.z + HALF;
    // Swept region: the box extended along the axis of motion.
    const lo0 = axis === 0 && d < 0 ? minX + d : minX;
    const hi0 = axis === 0 && d > 0 ? maxX + d : maxX;
    const lo1 = axis === 1 && d < 0 ? minY + d : minY;
    const hi1 = axis === 1 && d > 0 ? maxY + d : maxY;
    const lo2 = axis === 2 && d < 0 ? minZ + d : minZ;
    const hi2 = axis === 2 && d > 0 ? maxZ + d : maxZ;
    const cx0 = Math.floor(lo0 + EPS);
    const cx1 = Math.floor(hi0 - EPS);
    const cy0 = Math.floor(lo1 + EPS);
    const cy1 = Math.floor(hi1 - EPS);
    const cz0 = Math.floor(lo2 + EPS);
    const cz1 = Math.floor(hi2 - EPS);
    let allowed = d;
    for (let y = cy0; y <= cy1; y++) {
      for (let z = cz0; z <= cz1; z++) {
        for (let x = cx0; x <= cx1; x++) {
          const h = this.solidHeight(x, y, z);
          if (h === 0) continue;
          const top = y + h;
          if (axis === 0) {
            if (!(top > minY + EPS && y < maxY - EPS && z + 1 > minZ + EPS && z < maxZ - EPS)) continue;
            if (d > 0 && x >= maxX - EPS) allowed = Math.min(allowed, Math.max(0, x - maxX));
            else if (d < 0 && x + 1 <= minX + EPS) allowed = Math.max(allowed, Math.min(0, x + 1 - minX));
          } else if (axis === 1) {
            if (!(x + 1 > minX + EPS && x < maxX - EPS && z + 1 > minZ + EPS && z < maxZ - EPS)) continue;
            if (d > 0 && y >= maxY - EPS) allowed = Math.min(allowed, Math.max(0, y - maxY));
            else if (d < 0 && top <= minY + EPS) allowed = Math.max(allowed, Math.min(0, top - minY));
          } else {
            if (!(top > minY + EPS && y < maxY - EPS && x + 1 > minX + EPS && x < maxX - EPS)) continue;
            if (d > 0 && z >= maxZ - EPS) allowed = Math.min(allowed, Math.max(0, z - maxZ));
            else if (d < 0 && z + 1 <= minZ + EPS) allowed = Math.max(allowed, Math.min(0, z + 1 - minZ));
          }
        }
      }
    }
    if (allowed !== d) this.blocked = true;
    if (axis === 0) pos.x += allowed;
    else if (axis === 1) pos.y += allowed;
    else pos.z += allowed;
    return allowed;
  }

  /** Lifts the player out of loaded solid blocks it is stuck in (a block appeared inside it), up to 2 blocks. */
  private unstick(): void {
    const pos = this.player.position;
    if (!this.overlapsLoadedSolid()) return;
    const y0 = pos.y;
    for (let lift = 1; lift <= 3; lift++) {
      pos.y = Math.floor(y0) + lift;
      if (!this.overlapsLoadedSolid()) {
        if (pos.y - y0 > 2.01) break;
        this.player.velocity.y = 0;
        this.fallTop = pos.y;
        return;
      }
    }
    pos.y = y0;
  }

  private overlapsLoadedSolid(): boolean {
    const pos = this.player.position;
    const x0 = Math.floor(pos.x - HALF + EPS);
    const x1 = Math.floor(pos.x + HALF - EPS);
    const z0 = Math.floor(pos.z - HALF + EPS);
    const z1 = Math.floor(pos.z + HALF - EPS);
    const y0 = Math.floor(pos.y + EPS);
    const y1 = Math.floor(pos.y + PLAYER_HEIGHT - EPS);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.world.isLoaded(x, z)) continue;
          const h = this.solidHeight(x, y, z);
          if (h > 0 && y + h > pos.y + EPS) return true;
        }
      }
    }
    return false;
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
