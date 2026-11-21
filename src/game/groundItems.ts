/**
 * Items lying in the world. Anything that gives items (a broken block, a dead animal, a spilled machine, the drop
 * key) spawns `GroundItem`s here instead of filling the pack at once. They fall, rest, merge with their neighbours,
 * wait out a short pickup delay, fly to the player inside the pickup radius (or a collector's radius, see
 * ./collectors) and are added to the pack. A full pack leaves them where they are. DOM-free and node-testable; the
 * renderer only reads `items`.
 *
 * One object per world session, owned by PlayerState (`player.ground`) and ticked by Survival on the 20 Hz tick.
 */
import { itemOrNull } from '../core/registry';
import type { IWorld, Slot } from '../core/types';
import type { GameBus } from '../core/context';
import { stackLimit } from './inventory';

/** Entities in the world at most; past it the oldest is merged into a neighbour or removed. */
export const MAX_GROUND_ITEMS = 256;
/** Seconds an item lies before it disappears. */
export const DESPAWN_S = 300;
/** Blocks from the body centre inside which a ready item starts flying to the player. */
export const PICKUP_RADIUS = 1.4;
/** Distance at which the flying item is actually taken. */
export const TAKE_RADIUS = 0.5;
/** Speed (blocks/s) of an item flying to the player. */
export const HOMING_SPEED = 9;
/** Pickup delay of an item that came out of a block or a creature. */
export const DROP_DELAY_S = 0.5;
/** Pickup delay of an item the player threw out (the drop key). */
export const THROWN_DELAY_S = 2;
/** Same-kind resting items closer than this merge into one stack. */
export const MERGE_RADIUS = 0.9;
export const GRAVITY = 22;
export const TERMINAL_SPEED = 24;
/** Height of the body centre above the feet, the point items fly to. */
const BODY_CENTRE = 0.8;
const HALF = 0.12;
const MERGE_EVERY_S = 0.5;
const TICK_CAP_S = 0.25;
const SINK_SPEED = 1.2;

export interface GroundItem {
  id: number;
  item: string;
  count: number;
  /** Tools and other worn items carry their wear along (never merged). */
  durability?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds lying in the world; the item disappears at DESPAWN_S. */
  age: number;
  /** Seconds before the player can pick it up. */
  delayS: number;
  onGround: boolean;
  /** Flying to the player (pickup radius or a collector). Not saved. */
  homing: boolean;
  /** Pulled this tick by a collector (renderer effect). Not saved. */
  pulled: boolean;
  /** Random phase of the spin and the bob. */
  phase: number;
}

export interface SpawnOptions {
  durability?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  delayS?: number;
  /** Scatter the item a little around the point and give it a small hop (blocks that break). Default true. */
  scatter?: boolean;
  /** Seconds already lying (loading a save). */
  age?: number;
}

/** What the player has that can take items: the pack and a position. PlayerState satisfies it. */
export interface PickupTarget {
  position: { x: number; y: number; z: number };
  dead: boolean;
  inventory: { space(item: string): number };
  give(item: string, count?: number, durability?: number): number;
}

/** Pulls items towards the player (the vacuum pump now, the electromagnet later). See ./collectors. */
export interface ActiveCollector {
  /** Blocks around the body centre inside which items are pulled. */
  radius: number;
  /** Speed (blocks/s) the pull flies items at. */
  pull: number;
}

export interface GroundItemSnapshot {
  item: string;
  count: number;
  durability?: number;
  x: number;
  y: number;
  z: number;
  age: number;
  delayS?: number;
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export class GroundItems {
  readonly items: GroundItem[] = [];
  /** Bumped whenever an item appears, merges or goes (the renderer can skip work when nothing changed). */
  version = 0;
  private nextId = 1;
  private mergeT = 0;

  constructor(
    private readonly bus: GameBus | null = null,
    private readonly rng: () => number = Math.random,
  ) {}

  get size(): number {
    return this.items.length;
  }

  /**
   * Puts `count` of `item` in the world at (x, y, z). Counts above one stack become several entities. Returns the
   * entities made (a stack merged into a near neighbour right away is not listed).
   */
  spawn(item: string, count: number, x: number, y: number, z: number, opts: SpawnOptions = {}): GroundItem[] {
    const made: GroundItem[] = [];
    if (!itemOrNull(item) || !(count >= 1) || !finite(x) || !finite(y) || !finite(z)) return made;
    let left = Math.floor(count);
    const limit = Math.max(1, stackLimit(item));
    const scatter = opts.scatter ?? true;
    while (left > 0) {
      const n = Math.min(left, limit);
      left -= n;
      const e: GroundItem = {
        id: this.nextId++,
        item,
        count: n,
        x: x + (scatter ? (this.rng() - 0.5) * 0.4 : 0),
        y,
        z: z + (scatter ? (this.rng() - 0.5) * 0.4 : 0),
        vx: opts.vx ?? (scatter ? (this.rng() - 0.5) * 2 : 0),
        vy: opts.vy ?? (scatter ? 2.2 + this.rng() * 1.2 : 0),
        vz: opts.vz ?? (scatter ? (this.rng() - 0.5) * 2 : 0),
        age: opts.age ?? 0,
        delayS: opts.delayS ?? DROP_DELAY_S,
        onGround: false,
        homing: false,
        pulled: false,
        phase: this.rng() * Math.PI * 2,
      };
      if (opts.durability !== undefined) e.durability = opts.durability;
      this.items.push(e);
      made.push(e);
    }
    this.version++;
    while (this.items.length > MAX_GROUND_ITEMS) this.evictOldest();
    return made;
  }

  /** Spawns what a slot holds (a spill, a drop). */
  spawnSlot(slot: Slot, x: number, y: number, z: number, opts: SpawnOptions = {}): GroundItem[] {
    return slot ? this.spawn(slot.item, slot.count, x, y, z, { durability: slot.durability, ...opts }) : [];
  }

  /** Items within `radius` of a point (cheap scan; the list is short). */
  near(x: number, y: number, z: number, radius: number): GroundItem[] {
    const r2 = radius * radius;
    return this.items.filter((e) => (e.x - x) ** 2 + (e.y - y) ** 2 + (e.z - z) ** 2 <= r2);
  }

  /** How many of `item` lie in the world (all stacks). */
  count(item: string): number {
    let n = 0;
    for (const e of this.items) if (e.item === item) n += e.count;
    return n;
  }

  /** Gives the player every item that fits, wherever it lies (tests, a debug command). Returns how many items went. */
  drain(player: PickupTarget): number {
    let n = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      const fit = Math.min(e.count, player.inventory.space(e.item));
      if (fit <= 0) continue;
      player.give(e.item, fit, e.durability);
      n += fit;
      e.count -= fit;
      if (e.count <= 0) this.items.splice(i, 1);
    }
    if (n > 0) this.version++;
    return n;
  }

  clear(): void {
    if (this.items.length === 0) return;
    this.items.length = 0;
    this.version++;
  }

  /**
   * One step. `dt` is capped (a hitch must not throw items through the floor). `collectors` pull items from further
   * away than the plain pickup radius.
   */
  tick(dt: number, world: IWorld, player: PickupTarget, collectors: readonly ActiveCollector[] = []): void {
    if (this.items.length === 0) return;
    dt = Math.min(dt, TICK_CAP_S);
    const px = player.position.x;
    const py = player.position.y + BODY_CENTRE;
    const pz = player.position.z;
    const canTake = !player.dead;
    let reach = PICKUP_RADIUS;
    for (const c of collectors) reach = Math.max(reach, c.radius);
    let changed = false;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += dt;
      e.pulled = false;
      if (e.delayS > 0) e.delayS = Math.max(0, e.delayS - dt);
      if (e.age >= DESPAWN_S || e.y < -8) {
        this.items.splice(i, 1);
        changed = true;
        continue;
      }
      if (canTake && e.delayS <= 0) {
        const dx = px - e.x;
        const dy = py - e.y;
        const dz = pz - e.z;
        // Reach is measured to the body (a vertical segment, feet to head), so an item one block down in a hole or on
        // a step below still counts; it then flies to the body centre.
        const feet = player.position.y;
        const gap = e.y < feet - 0.2 ? feet - 0.2 - e.y : e.y > feet + 1.6 ? e.y - feet - 1.6 : 0;
        const d2 = dx * dx + gap * gap + dz * dz;
        if (d2 <= reach * reach && player.inventory.space(e.item) > 0) {
          let speed = 0;
          if (d2 <= PICKUP_RADIUS * PICKUP_RADIUS) speed = HOMING_SPEED;
          else {
            for (const c of collectors) {
              if (d2 <= c.radius * c.radius && c.pull > speed) speed = c.pull;
            }
            if (speed > 0) e.pulled = true;
          }
          if (speed > 0) {
            e.homing = true;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d <= TAKE_RADIUS || d2 <= TAKE_RADIUS * TAKE_RADIUS) {
              if (this.deliver(e, player)) {
                this.items.splice(i, 1);
                changed = true;
              }
              continue;
            }
            // Faster the closer it gets, never overshooting the player in one step.
            const step = Math.min(Math.max(speed, speed * 1.5 - d) * dt, d);
            e.x += (dx / d) * step;
            e.y += (dy / d) * step;
            e.z += (dz / d) * step;
            e.vx = (dx / d) * speed;
            e.vy = (dy / d) * speed;
            e.vz = (dz / d) * speed;
            e.onGround = false;
            continue;
          }
        }
      }
      if (e.homing) {
        // Lost its target (out of reach, the pack filled up): falls again.
        e.homing = false;
        e.vx = e.vy = e.vz = 0;
      }
      this.physics(e, dt, world);
    }
    this.mergeT += dt;
    if (this.mergeT >= MERGE_EVERY_S) {
      this.mergeT = 0;
      if (this.mergeResting()) changed = true;
    }
    if (changed) this.version++;
  }

  /** Gives the player what fits of the entity. True when nothing is left (the entity is gone). */
  private deliver(e: GroundItem, player: PickupTarget): boolean {
    const fit = Math.min(e.count, player.inventory.space(e.item));
    if (fit <= 0) return false;
    player.give(e.item, fit, e.durability);
    this.bus?.emit('sfx', { name: 'pickup', x: e.x, y: e.y, z: e.z, volume: 0.6, pitch: 0.9 + this.rng() * 0.3 });
    e.count -= fit;
    return e.count <= 0;
  }

  private physics(e: GroundItem, dt: number, world: IWorld): void {
    if (!world.isLoaded(Math.floor(e.x), Math.floor(e.z))) return; // frozen until its chunk is back
    const cell = world.getBlock(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    // Stuck inside a block (one was placed on it): up to the first free cell above.
    if (this.solidAt(world, e.x, e.y, e.z)) {
      let y = Math.floor(e.y) + 1;
      for (let k = 0; k < 8 && this.solidAt(world, e.x, y, e.z); k++) y++;
      e.y = y + 0.01;
      e.vy = 0;
    }
    // Whatever it rested on is gone: falls again.
    if (e.onGround && this.floorUnder(world, e.x, e.y, e.y - 0.05, e.z) === null) e.onGround = false;
    const wet = cell.liquid !== null;
    if (wet) {
      e.vy += (-SINK_SPEED - e.vy) * Math.min(1, 4 * dt);
      const drag = Math.exp(-3 * dt);
      e.vx *= drag;
      e.vz *= drag;
    } else if (!e.onGround || e.vy > 0) {
      e.vy = Math.max(e.vy - GRAVITY * dt, -TERMINAL_SPEED);
    }
    // Horizontal move, one axis at a time; a wall stops that axis.
    if (e.vx !== 0) {
      const nx = e.x + e.vx * dt;
      if (this.solidAt(world, nx + Math.sign(e.vx) * HALF, e.y + 0.1, e.z)) e.vx *= -0.3;
      else e.x = nx;
    }
    if (e.vz !== 0) {
      const nz = e.z + e.vz * dt;
      if (this.solidAt(world, e.x, e.y + 0.1, nz + Math.sign(e.vz) * HALF)) e.vz *= -0.3;
      else e.z = nz;
    }
    // Vertical: land on the surface of the solid under it.
    const ny = e.y + e.vy * dt;
    if (e.vy <= 0) {
      const floor = this.floorUnder(world, e.x, e.y, ny, e.z);
      if (floor !== null && ny <= floor) {
        e.y = floor;
        if (e.vy < -4) e.vy *= -0.25;
        else e.vy = 0;
        if (e.vy === 0) e.onGround = true;
        const f = Math.exp(-(e.onGround ? 10 : 2) * dt);
        e.vx *= f;
        e.vz *= f;
        if (Math.abs(e.vx) < 0.02) e.vx = 0;
        if (Math.abs(e.vz) < 0.02) e.vz = 0;
        return;
      }
      e.y = ny;
      e.onGround = false;
      return;
    }
    // Rising: the head hits a ceiling.
    if (this.solidAt(world, e.x, ny + HALF, e.z)) e.vy = 0;
    else e.y = ny;
    e.onGround = false;
  }

  /** Top of the solid block between `from` and `to` (falling), or null. */
  private floorUnder(world: IWorld, x: number, from: number, to: number, z: number): number | null {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    const top = Math.floor(from + 1e-6);
    const bottom = Math.floor(to);
    for (let cy = top; cy >= bottom; cy--) {
      const h = this.heightOf(world, cx, cy, cz);
      if (h > 0 && cy + h >= to && cy + h <= from + 0.5) return cy + h;
    }
    return null;
  }

  private heightOf(world: IWorld, x: number, y: number, z: number): number {
    if (y < 0) return 1;
    const b = world.getBlock(x, y, z);
    if (!b.solid || b.liquid !== null) return 0;
    return b.shape === 'slab' ? 0.5 : 1;
  }

  private solidAt(world: IWorld, x: number, y: number, z: number): boolean {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const cz = Math.floor(z);
    const h = this.heightOf(world, cx, cy, cz);
    return h > 0 && y - cy < h;
  }

  /** Merges resting same-kind stacks that lie close together. True when anything merged. */
  private mergeResting(): boolean {
    let merged = false;
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      if (a.durability !== undefined || a.homing || a.vx * a.vx + a.vz * a.vz > 0.01) continue;
      const limit = stackLimit(a.item);
      if (a.count >= limit) continue;
      for (let j = i + 1; j < items.length && a.count < limit; j++) {
        const b = items[j];
        if (b.item !== a.item || b.durability !== undefined || b.homing) continue;
        if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2 > MERGE_RADIUS * MERGE_RADIUS) continue;
        if (b.vx * b.vx + b.vz * b.vz > 0.01) continue;
        const n = Math.min(limit - a.count, b.count);
        a.count += n;
        b.count -= n;
        // The merged stack keeps the youngest pickup delay down and the older age (it despawns together with the older).
        a.delayS = Math.min(a.delayS, b.delayS);
        a.age = Math.max(a.age, b.age);
        merged = true;
        if (b.count <= 0) {
          items.splice(j, 1);
          j--;
        }
      }
    }
    return merged;
  }

  /** Over the cap: the oldest entity merges into a same-kind neighbour with room, else it disappears. */
  private evictOldest(): void {
    let oldest = 0;
    for (let i = 1; i < this.items.length; i++) if (this.items[i].age > this.items[oldest].age) oldest = i;
    const e = this.items[oldest];
    if (e.durability === undefined) {
      const limit = stackLimit(e.item);
      let best: GroundItem | null = null;
      let bestD = Infinity;
      for (const o of this.items) {
        if (o === e || o.item !== e.item || o.durability !== undefined || o.count >= limit) continue;
        const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2 + (o.z - e.z) ** 2;
        if (d < bestD) {
          best = o;
          bestD = d;
        }
      }
      if (best) {
        const n = Math.min(limit - best.count, e.count);
        best.count += n;
        e.count -= n;
      }
    }
    this.items.splice(oldest, 1);
    this.version++;
  }

  toJSON(): GroundItemSnapshot[] {
    return this.items.map((e) => {
      const s: GroundItemSnapshot = { item: e.item, count: e.count, x: round(e.x), y: round(e.y), z: round(e.z), age: round(e.age) };
      if (e.durability !== undefined) s.durability = e.durability;
      if (e.delayS > 0) s.delayS = round(e.delayS);
      return s;
    });
  }

  /** Replaces the items with a saved list: unknown items, damaged entries and anything past the cap are dropped. */
  load(snapshot: readonly GroundItemSnapshot[] | undefined | null): void {
    this.items.length = 0;
    this.version++;
    if (!Array.isArray(snapshot)) return;
    for (const s of snapshot.slice(0, MAX_GROUND_ITEMS)) {
      if (!s || typeof s.item !== 'string' || !finite(s.count) || !finite(s.x) || !finite(s.y) || !finite(s.z)) continue;
      if (!itemOrNull(s.item)) continue;
      const count = Math.min(Math.floor(s.count), Math.max(1, stackLimit(s.item)));
      if (!(count >= 1)) continue;
      const [e] = this.spawn(s.item, count, s.x, s.y, s.z, {
        scatter: false,
        vx: 0,
        vy: 0,
        vz: 0,
        delayS: finite(s.delayS) ? Math.max(0, s.delayS) : 0,
        age: finite(s.age) ? Math.max(0, Math.min(s.age, DESPAWN_S - 1)) : 0,
        durability: finite(s.durability) ? s.durability : undefined,
      });
      if (e && e.durability === undefined) delete e.durability;
    }
  }
}

const round = (n: number): number => Math.round(n * 100) / 100;
