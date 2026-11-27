/**
 * Gruk as a hired companion (docs/api/npcs.md): for coin he follows the player for a while, walks over terrain (steps up one block,
 * falls, never swims far), picks the nearest hostile near the player and hits it. Headless and deterministic; the manager owns it.
 */
import type { IWorld } from '../core/types';

export interface CompanionTarget {
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface CompanionHost {
  world: IWorld;
  /** Where the player is (feet) and whether they are dead. */
  player(): { x: number; y: number; z: number; dead: boolean };
  /** Hostile creatures that are alive. */
  hostiles(): readonly CompanionTarget[];
  hit(id: number, damage: number, fromX: number, fromZ: number): void;
}

export const HIRE_COST = 40;
export const HIRE_SECONDS = 480;
const WALK = 4.4;
const RUN = 6.2;
const DAMAGE = 7;
const STRIKE_S = 1.0;
const REACH = 2.5;
const LEASH = 14;
/** Beyond this he catches up by walking back into view. */
const TELEPORT = 28;

export class Companion {
  hiredS = 0;
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  private strikeCd = 0;
  private fightLineCd = 0;

  get active(): boolean {
    return this.hiredS > 0;
  }

  hire(x: number, y: number, z: number): void {
    this.hiredS = HIRE_SECONDS;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  dismiss(): void {
    this.hiredS = 0;
  }

  /** Returns a fight shout (to show as a toast) now and then, else null. */
  update(dt: number, host: CompanionHost): string | null {
    if (!this.active) return null;
    this.hiredS -= dt;
    this.strikeCd = Math.max(0, this.strikeCd - dt);
    this.fightLineCd = Math.max(0, this.fightLineCd - dt);
    const p = host.player();
    if (p.dead) {
      this.dismiss();
      return null;
    }
    const far = Math.hypot(p.x - this.x, p.z - this.z);
    if (far > TELEPORT) this.placeNear(host.world, p);
    // The nearest hostile within the leash of the player.
    let foe: CompanionTarget | null = null;
    let best = Infinity;
    for (const h of host.hostiles()) {
      if (Math.hypot(h.x - p.x, h.z - p.z) > LEASH) continue;
      const d = Math.hypot(h.x - this.x, h.z - this.z);
      if (d < best) {
        best = d;
        foe = h;
      }
    }
    let shout: string | null = null;
    if (foe) {
      this.face(foe.x, foe.z);
      if (best > REACH - 0.4) this.walk(host.world, foe.x, foe.z, RUN, dt);
      else if (this.strikeCd === 0 && Math.abs(foe.y - this.y) < 3) {
        host.hit(foe.id, DAMAGE, this.x, this.z);
        this.strikeCd = STRIKE_S;
        if (this.fightLineCd === 0) {
          this.fightLineCd = 7;
          shout = 'fight';
        }
      }
    } else if (far > 3) {
      this.face(p.x, p.z);
      this.walk(host.world, p.x, p.z, far > 9 ? RUN : WALK, dt);
    }
    this.settle(host.world, dt);
    return shout;
  }

  private face(tx: number, tz: number): void {
    this.yaw = Math.atan2(-(tx - this.x), -(tz - this.z));
  }

  private solid(world: IWorld, x: number, y: number, z: number): boolean {
    return world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)).solid;
  }

  private walk(world: IWorld, tx: number, tz: number, speed: number, dt: number): void {
    const d = Math.hypot(tx - this.x, tz - this.z);
    if (d < 0.01) return;
    const step = Math.min(speed * dt, d);
    const nx = this.x + ((tx - this.x) / d) * step;
    const nz = this.z + ((tz - this.z) / d) * step;
    const feet = Math.floor(this.y + 0.01);
    // Free to walk in when his two body blocks are clear; one block up is a step he can take.
    if (!this.solid(world, nx, feet, nz) && !this.solid(world, nx, feet + 1, nz)) {
      this.x = nx;
      this.z = nz;
    } else if (!this.solid(world, nx, feet + 1, nz) && !this.solid(world, nx, feet + 2, nz) && !this.solid(world, this.x, feet + 2, this.z)) {
      this.x = nx;
      this.z = nz;
      this.y = feet + 1;
    } else {
      // Blocked: slide along one axis.
      if (!this.solid(world, nx, feet, this.z) && !this.solid(world, nx, feet + 1, this.z)) this.x = nx;
      else if (!this.solid(world, this.x, feet, nz) && !this.solid(world, this.x, feet + 1, nz)) this.z = nz;
    }
  }

  /** Falls until something solid is under his feet. */
  private settle(world: IWorld, dt: number): void {
    let guard = 0;
    while (!this.solid(world, this.x, Math.floor(this.y - 0.05) - 0, this.z) && this.y > -8 && guard++ < 40) this.y -= Math.min(1, 12 * dt + 0.2);
    const floor = Math.floor(this.y + 0.001);
    if (this.solid(world, this.x, floor - 1, this.z) && this.y - floor < 0.2) this.y = floor;
  }

  /** Puts him beside the player on solid ground. */
  placeNear(world: IWorld, p: { x: number; y: number; z: number }): void {
    for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [2.5, 0.5]] as const) {
      const x = p.x + dx;
      const z = p.z + dz;
      const y = Math.floor(p.y);
      if (!this.solid(world, x, y, z) && !this.solid(world, x, y + 1, z)) {
        this.x = x;
        this.z = z;
        this.y = y;
        return;
      }
    }
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
  }
}
