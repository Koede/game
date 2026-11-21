/**
 * Ember bolts (spec 19.2): lobbed by kiln sentries on an arc under EMBER_BOLT_GRAVITY, they hit the first solid
 * block or the player and never break anything. A bolt flying into a safe zone fizzles out (the hearth's warmth is
 * the safe heart of the base). Swept in sub-steps of at most a quarter block, so nothing is tunnelled through.
 */
import { EMBER_BOLT_GRAVITY, EMBER_BOLT_MAX_S, EMBER_BOLT_RADIUS, PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/constants';
import type { GameBus } from '../core/context';
import type { IWorld } from '../core/types';
import type { Projectile, ProjectileView } from './hostileTypes';
import { solidHeight } from './terrain';
import type { MobPlayer } from './types';

const SUB_STEP = 0.25;

/**
 * Launch velocity for a projectile from `from` to land on `to` at `speed` under `gravity`: the low arc when one
 * reaches, else the farthest-reaching 45-degree throw towards it. Writes [vx, vy, vz] to `out`.
 */
export function aimLob(
  fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, speed: number, gravity: number, out: number[],
): number[] {
  const dx = tx - fx;
  const dz = tz - fz;
  const d = Math.hypot(dx, dz);
  const h = ty - fy;
  const v2 = speed * speed;
  let angle: number;
  if (d < 1e-6) angle = h >= 0 ? Math.PI / 2 : -Math.PI / 2;
  else {
    const disc = v2 * v2 - gravity * (gravity * d * d + 2 * h * v2);
    angle = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (gravity * d)) : Math.PI / 4;
  }
  const horiz = speed * Math.cos(angle);
  out[0] = d < 1e-6 ? 0 : (dx / d) * horiz;
  out[1] = speed * Math.sin(angle);
  out[2] = d < 1e-6 ? 0 : (dz / d) * horiz;
  return out;
}

/** What a bolt's impact may call on (the hostile layer). */
export interface BoltHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  /** A safe zone at this point (bolts fizzle there). */
  safe(x: number, y: number, z: number): boolean;
  /** The bolt struck the player: emit 'player:attacked', hurt them. */
  strikePlayer(p: Projectile): void;
}

export class Projectiles {
  private readonly list: Projectile[] = [];
  private readonly viewPool: ProjectileView[] = [];
  private readonly viewList: ProjectileView[] = [];
  private nextId = 1;

  get all(): readonly Projectile[] {
    return this.list;
  }

  /** Launches a bolt and emits 'projectile:fired'. */
  fire(bus: GameBus, from: { id: number; species: string }, x: number, y: number, z: number, vx: number, vy: number, vz: number, damage: number): Projectile {
    const p: Projectile = {
      id: this.nextId++, kind: 'ember_bolt', species: from.species, from: from.id,
      x, y, z, px: x, py: y, pz: z, vx, vy, vz, ageS: 0, damage, attack: 'bolt',
    };
    this.list.push(p);
    bus.emit('projectile:fired', { id: p.id, kind: p.kind, species: p.species, from: p.from, x, y, z, vx, vy, vz });
    return p;
  }

  /** Flies every bolt one tick; impacts emit 'projectile:hit' (and strike the player through the host). */
  tick(dt: number, host: BoltHost, player: MobPlayer): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
      p.ageS += dt;
      const target = this.fly(p, dt, host.world, player);
      if (target === null && p.ageS >= EMBER_BOLT_MAX_S) this.end(i, p, host, 'expired');
      else if (target === null && host.safe(p.x, p.y, p.z)) this.end(i, p, host, 'expired');
      else if (target !== null) {
        if (target === 'player') host.strikePlayer(p);
        this.end(i, p, host, target);
      }
    }
  }

  /** Moves a bolt through one tick in sub-steps; the first thing it touches, or null. */
  private fly(p: Projectile, dt: number, world: IWorld, player: MobPlayer): 'player' | 'block' | null {
    const speed = Math.hypot(p.vx, p.vy + EMBER_BOLT_GRAVITY * dt * 0.5, p.vz);
    const steps = Math.max(1, Math.ceil((speed * dt) / SUB_STEP));
    const sdt = dt / steps;
    const r = EMBER_BOLT_RADIUS;
    const hw = PLAYER_WIDTH / 2 + r;
    for (let s = 0; s < steps; s++) {
      p.vy -= EMBER_BOLT_GRAVITY * sdt;
      p.x += p.vx * sdt;
      p.y += p.vy * sdt;
      p.z += p.vz * sdt;
      if (Math.abs(p.x - player.x) <= hw && Math.abs(p.z - player.z) <= hw && p.y >= player.y - r && p.y <= player.y + PLAYER_HEIGHT + r) return 'player';
      const cx = Math.floor(p.x);
      const cy = Math.floor(p.y);
      const cz = Math.floor(p.z);
      const sh = solidHeight(world, cx, cy, cz);
      if (sh > 0 && p.y < cy + sh) return 'block';
    }
    return null;
  }

  private end(index: number, p: Projectile, host: BoltHost, target: 'player' | 'block' | 'expired'): void {
    this.list[index] = this.list[this.list.length - 1];
    this.list.pop();
    host.bus.emit('projectile:hit', { id: p.id, kind: p.kind, species: p.species, from: p.from, x: p.x, y: p.y, z: p.z, target });
  }

  /** Removes every bolt without events (Peaceful, loading a save). */
  clear(): void {
    this.list.length = 0;
  }

  /** Interpolated views of the bolts in flight (reused array and objects). */
  views(alpha: number): readonly ProjectileView[] {
    const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    this.viewList.length = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (this.viewPool.length <= i) this.viewPool.push({ id: 0, kind: p.kind, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ageS: 0 });
      const v = this.viewPool[i];
      v.id = p.id;
      v.kind = p.kind;
      v.x = p.px + (p.x - p.px) * t;
      v.y = p.py + (p.y - p.py) * t;
      v.z = p.pz + (p.z - p.pz) * t;
      v.vx = p.vx;
      v.vy = p.vy;
      v.vz = p.vz;
      v.ageS = p.ageS;
      this.viewList.push(v);
    }
    return this.viewList;
  }
}
