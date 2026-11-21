/**
 * MobManager: every animal of the world (spec 12.5). Ticks at 20 Hz: spawning, behaviour, physics, hazards,
 * breeding, growing up, idle calls and death; answers the player module's targeting / hit / feed questions;
 * fills interpolated views for the renderer; saves and restores everything. DOM-free.
 *
 * Animals whose column is not loaded are frozen (no time passes for them) and resume when it loads.
 */
import {
  DT,
  MOB_BREED_COOLDOWN_S,
  MOB_CALL_MAX_S,
  MOB_CALL_MIN_S,
  MOB_DEATH_S,
  MOB_EAGER_S,
  MOB_FLEE_S,
  MOB_GROW_UP_S,
  MOB_HIT_COOLDOWN_S,
  MOB_LOADED_CAP,
  MOB_STORED_CAP,
} from '../core/constants';
import type { GameBus } from '../core/context';
import type { SfxName } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import type { CreatureSpec, IWorld } from '../core/types';
import { bodyHeight, halfWidth, think, type BrainContext } from './brain';
import { CALL_RANGE, CORPSE_FADE_S, FLASH_S, KNOCK_H, KNOCK_V, VOID_Y } from './constants';
import { createMob, feedRefusal, rollDrops } from './mob';
import { contactHazard, embedded, stepBody, type Hazard, type StepInfo } from './physics';
import { Spawner, type SpawnHost } from './spawner';
import type { SpawnSpot } from './spawning';
import { restoreMobs, saveMobs } from './persistence';
import { MobTargets } from './targets';
import type { BiomeLookup, DeathCause, FeedResult, HitResult, Mob, MobClock, MobDeath, MobPlayer, MobRayHit, MobsSnapshot, MobView } from './types';
import { fillViews } from './views';

/** A species' call: the sfx named like the creature (spec 12.7; src/audio ignores names it has no patch for). */
const callOf = (spec: CreatureSpec): SfxName => spec.key as SfxName;

export interface MobManagerOptions {
  /** Biome of a column. Default: `world.biomeAt` when the world has one, else always woodland. */
  biomeAt?: BiomeLookup;
  /** World spawn (feet block) for the spawn-area guarantee. Default: `world.spawnPoint()` when present. */
  spawn?: { x: number; y: number; z: number } | null;
  /** False turns off chunk rolls, the spawn guarantee and keep-alive spawns (tests, harnesses). Default true. */
  naturalSpawning?: boolean;
}

interface WorldExtras {
  biomeAt?(x: number, z: number): ReturnType<BiomeLookup>;
  spawnPoint?(): { x: number; y: number; z: number };
}

export class MobManager {
  readonly biomeAt: BiomeLookup;
  readonly rng: () => number;
  private readonly mobs: Mob[] = [];
  private readonly byId = new Map<number, Mob>();
  /** Animals whose column is loaded, rebuilt every tick. */
  private readonly active: Mob[] = [];
  private readonly spawner: Spawner;
  private readonly targets = new MobTargets();
  private readonly viewPool: MobView[] = [];
  private readonly viewList: MobView[] = [];
  private readonly deathListeners = new Set<(d: MobDeath) => void>();
  private readonly offs: (() => void)[] = [];
  private readonly info: StepInfo = { blocked: false };
  private readonly hazard: Hazard = { damage: 0, x: 0, z: 0 };
  private readonly brain: BrainContext;
  private readonly natural: boolean;
  private nextId = 1;
  private contactTick = 0;

  constructor(
    readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly clock: MobClock,
    readonly seed: number,
    options: MobManagerOptions = {},
  ) {
    const extras = world as IWorld & WorldExtras;
    this.biomeAt = options.biomeAt ?? (extras.biomeAt ? (x, z) => extras.biomeAt!(x, z) : () => 'woodland');
    const spawn = options.spawn !== undefined ? options.spawn : extras.spawnPoint ? extras.spawnPoint() : null;
    this.rng = mulberry32(seed ^ 0x616e696d);
    const host: SpawnHost = {
      world,
      seed,
      biomeAt: this.biomeAt,
      rng: this.rng,
      all: this.mobs,
      room: (n) => this.room(n),
      add: (spec, spot, baby) => this.add(spec, spot, baby),
    };
    this.spawner = new Spawner(host, spawn ? { x: spawn.x + 0.5, z: spawn.z + 0.5 } : null);
    this.brain = {
      world,
      rng: this.rng,
      player: { x: 0, y: 0, z: 0, yaw: 0, heldItem: () => null },
      held: null,
      mobs: this.active,
      byId: (id) => this.byId.get(id),
      birth: (a, b) => this.birth(a, b),
    };
    this.natural = options.naturalSpawning ?? true;
    this.offs.push(bus.on('chunk:loaded', ({ cx, cz }) => this.spawner.chunkLoaded(cx, cz)));
  }

  // ------------------------------------------------------------------------------------------ queries

  /** Every animal, loaded or frozen (read only). */
  get all(): readonly Mob[] {
    return this.mobs;
  }
  /** Animals simulated in the last tick (their column is loaded). */
  get loaded(): readonly Mob[] {
    return this.active;
  }
  get(id: number): Mob | undefined {
    return this.byId.get(id);
  }

  /** HUD target name: "Goat - 6/8", "Young Hen - 4/4". Empty for unknown or dead animals. */
  describe(id: number): string {
    const m = this.byId.get(id);
    if (!m || m.state === 'dying') return '';
    const name = m.baby ? `Young ${m.spec.name}` : m.spec.name;
    return `${name} - ${Math.max(1, Math.ceil(m.health))}/${m.spec.health}`;
  }

  /** Nearest living animal whose box the ray hits within maxDist (dir need not be normalised), or null. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): MobRayHit | null {
    return this.targets.raycast(this.active, ox, oy, oz, dx, dy, dz, maxDist);
  }

  // ------------------------------------------------------------------------------------------ player actions

  /**
   * The player hits an animal for `damage` from (fromX, fromZ): knockback, red flash, flee, 'mob:hurt', sfx.
   * Refused while the animal is still recovering from the last hit (MOB_HIT_COOLDOWN_S). At 0 health it tips
   * over and, MOB_DEATH_S later, 'mob:died' is emitted and death listeners receive the drops.
   */
  hit(id: number, damage: number, fromX: number, fromZ: number): HitResult {
    const m = this.byId.get(id);
    if (!m) return { ok: false, reason: 'missing' };
    if (m.state === 'dying') return { ok: false, reason: 'dead' };
    if (m.hitCooldownS > 0) return { ok: false, reason: 'cooldown' };
    m.hitCooldownS = MOB_HIT_COOLDOWN_S;
    let kx = m.x - fromX;
    let kz = m.z - fromZ;
    const d = Math.hypot(kx, kz) || 1;
    kx /= d;
    kz /= d;
    m.vx = kx * KNOCK_H;
    m.vz = kz * KNOCK_H;
    if (m.onGround || m.inLiquid) m.vy = KNOCK_V;
    this.hurt(m, damage, fromX, fromZ, 'player');
    return { ok: true, health: Math.max(0, m.health), killed: m.health <= 0 };
  }

  /**
   * The player offers `itemKey` (Use with it in hand). A liked item makes a grown, rested animal eager for
   * MOB_EAGER_S (the caller then consumes one item). Otherwise refused with a short reason for a toast.
   */
  feed(id: number, itemKey: string): FeedResult {
    const m = this.byId.get(id);
    const refused = feedRefusal(m, itemKey);
    if (refused !== null || !m) return { ok: false, reason: refused ?? 'Nothing to feed' };
    m.eagerS = MOB_EAGER_S;
    this.bus.emit('sfx', { name: 'eat', x: m.x, y: m.y + bodyHeight(m) * 0.6, z: m.z });
    return { ok: true };
  }

  /** Called with every finished death (after the tip-over); returns an unsubscribe function. */
  onDeath(fn: (death: MobDeath) => void): () => void {
    this.deathListeners.add(fn);
    return () => this.deathListeners.delete(fn);
  }

  // ------------------------------------------------------------------------------------------ tick

  /** One fixed step (dt = DT at 20 Hz). */
  tick(dt: number, player: MobPlayer): void {
    if (this.natural) this.spawner.tick(dt, player, this.clock);
    const brain = this.brain;
    brain.player = player;
    brain.held = player.heldItem();
    const active = this.active;
    active.length = 0;
    for (const m of this.mobs) if (this.world.isLoaded(m.x, m.z)) active.push(m);

    this.contactTick = (this.contactTick + 1) % 5;
    for (let i = 0; i < active.length; i++) this.step(active[i], dt, player);
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      if ((m.state === 'dying' && m.deadS >= MOB_DEATH_S + CORPSE_FADE_S) || m.y < VOID_Y) this.remove(i);
    }
  }

  private step(m: Mob, dt: number, player: MobPlayer): void {
    m.px = m.x;
    m.py = m.y;
    m.pz = m.z;
    m.pyaw = m.yaw;
    m.pwalk = m.walk;
    m.phead = m.head;
    if (m.hurtS > 0) m.hurtS = Math.max(0, m.hurtS - dt);
    if (m.hitCooldownS > 0) m.hitCooldownS -= dt;

    if (m.state === 'dying') {
      const before = m.deadS;
      m.deadS += dt;
      m.vx *= 0.8;
      m.vz *= 0.8;
      stepBody(this.world, m, halfWidth(m), bodyHeight(m), dt, this.info);
      if (before < MOB_DEATH_S && m.deadS >= MOB_DEATH_S) this.finishDeath(m);
      return;
    }

    m.ageS += dt;
    if (m.baby && m.ageS >= MOB_GROW_UP_S) this.growUp(m);
    if (m.eagerS > 0) m.eagerS = Math.max(0, m.eagerS - dt);
    if (m.cooldownS > 0) m.cooldownS = Math.max(0, m.cooldownS - dt);
    if (m.fleeS > 0) {
      m.fleeS = Math.max(0, m.fleeS - dt);
      // Hurt by the player: keep running directly away from where the player is now.
      if (m.fleeFromPlayer) {
        m.fleeX = player.x;
        m.fleeZ = player.z;
      }
    }

    think(this.brain, m, dt);
    const hw = halfWidth(m);
    const h = bodyHeight(m);
    if (embedded(this.world, m, hw, h)) m.y = Math.min(m.y + 0.25, 95);
    const info = stepBody(this.world, m, hw, h, dt, this.info);
    m.blocked = info.blocked;
    const moved = Math.hypot(m.x - m.px, m.z - m.pz);
    m.speed = moved / dt;
    m.walk += moved;

    if ((m.id + this.contactTick) % 5 === 0) this.contact(m, hw, h);
    this.call(m, dt, player);
  }

  /** Hazards: lava (and any block with contact damage) touching the body, checked every 0.25 s. */
  private contact(m: Mob, hw: number, h: number): void {
    if (m.contactS > 0) m.contactS -= DT * 5;
    if (m.contactS > 0 || contactHazard(this.world, m, hw, h, this.hazard) === 0) return;
    m.contactS = 1;
    this.hurt(m, this.hazard.damage, this.hazard.x, this.hazard.z, 'world');
  }

  private call(m: Mob, dt: number, player: MobPlayer): void {
    m.callS -= dt;
    if (m.callS > 0) return;
    m.callS = MOB_CALL_MIN_S + this.rng() * (MOB_CALL_MAX_S - MOB_CALL_MIN_S);
    if ((m.x - player.x) ** 2 + (m.z - player.z) ** 2 > CALL_RANGE * CALL_RANGE) return;
    this.bus.emit('sfx', { name: callOf(m.spec), x: m.x, y: m.y + bodyHeight(m) * 0.8, z: m.z, pitch: m.baby ? 1.45 : 0.94 + this.rng() * 0.12 });
  }

  private hurt(m: Mob, damage: number, fromX: number, fromZ: number, cause: DeathCause): void {
    m.health -= damage;
    m.hurtS = FLASH_S;
    m.fleeS = MOB_FLEE_S;
    m.fleeX = fromX;
    m.fleeZ = fromZ;
    m.fleeFromPlayer = cause === 'player';
    m.eagerS = 0;
    m.partner = 0;
    const y = m.y + bodyHeight(m) * 0.6;
    this.bus.emit('mob:hurt', { id: m.id, species: m.spec.key, health: Math.max(0, m.health) });
    this.bus.emit('sfx', { name: 'mob_hurt', x: m.x, y, z: m.z, pitch: m.baby ? 1.4 : 1 });
    if (m.health > 0) return;
    m.state = 'dying';
    m.deadS = 0;
    m.fleeS = 0;
    m.pendingDrops = cause === 'player' && !m.baby ? rollDrops(m.spec.drops, this.rng) : [];
    m.deathCause = cause;
    this.bus.emit('sfx', { name: callOf(m.spec), x: m.x, y, z: m.z, pitch: 0.75 });
  }

  private finishDeath(m: Mob): void {
    const drops = m.pendingDrops ?? [];
    m.pendingDrops = null;
    this.bus.emit('mob:died', { id: m.id, species: m.spec.key });
    const death: MobDeath = { id: m.id, species: m.spec.key, x: m.x, y: m.y, z: m.z, cause: m.deathCause, drops };
    for (const fn of this.deathListeners) fn(death);
  }

  private growUp(m: Mob): void {
    m.baby = false;
    // A grown body is twice the size: lift it out of anything it now overlaps.
    const hw = halfWidth(m);
    const h = bodyHeight(m);
    for (let i = 0; i < 4 && embedded(this.world, m, hw, h); i++) m.y += 0.5;
  }

  private birth(a: Mob, b: Mob): void {
    for (const m of [a, b]) {
      m.eagerS = 0;
      m.cooldownS = MOB_BREED_COOLDOWN_S;
      m.partner = 0;
      m.breedS = 0;
      m.state = 'idle';
      m.stateS = 2;
    }
    if (!this.room(1)) {
      this.bus.emit('toast', { text: 'Too many animals here for another one', kind: 'warn' });
      return;
    }
    const spot: SpawnSpot = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y), z: (a.z + b.z) / 2, yaw: a.yaw };
    this.add(a.spec, spot, true);
    this.bus.emit('sfx', { name: callOf(a.spec), x: spot.x, y: spot.y + 0.5, z: spot.z, pitch: 1.3 });
  }

  // ------------------------------------------------------------------------------------------ population

  /** True when `count` more animals fit under both caps. */
  room(count: number): boolean {
    let loaded = 0;
    for (const m of this.mobs) if (this.world.isLoaded(m.x, m.z)) loaded++;
    return loaded + count <= MOB_LOADED_CAP && this.mobs.length + count <= MOB_STORED_CAP;
  }

  /** Adds an animal (emits 'mob:spawned'). Used by spawning, breeding and tests. */
  add(spec: CreatureSpec, spot: SpawnSpot, baby = false): Mob {
    const m = createMob(this.nextId++, spec, spot.x, spot.y, spot.z, spot.yaw, baby, this.rng);
    this.mobs.push(m);
    this.byId.set(m.id, m);
    this.bus.emit('mob:spawned', { id: m.id, species: spec.key });
    return m;
  }

  private remove(index: number): void {
    const m = this.mobs[index];
    this.mobs[index] = this.mobs[this.mobs.length - 1];
    this.mobs.pop();
    this.byId.delete(m.id);
    const a = this.active.indexOf(m);
    if (a >= 0) this.active.splice(a, 1);
  }

  // ------------------------------------------------------------------------------------------ rendering

  /**
   * Interpolated views of the animals simulated last tick, `alpha` (0..1) of the way from the previous tick to
   * the latest (the frame loop's FixedStep.alpha). Allocation-free once warm; the array and its objects are
   * reused by the next call.
   */
  views(alpha: number): readonly MobView[] {
    return fillViews(this.active, alpha, this.viewPool, this.viewList);
  }

  // ------------------------------------------------------------------------------------------ persistence

  toJSON(): MobsSnapshot {
    return saveMobs(this.mobs, this.nextId, this.spawner);
  }

  /** Replaces every animal and the spawning state with a snapshot's. Throws on a malformed snapshot. */
  load(snapshot: MobsSnapshot): void {
    const restored = restoreMobs(snapshot, this.rng);
    this.mobs.length = 0;
    this.active.length = 0;
    this.byId.clear();
    for (const m of restored.mobs) {
      this.mobs.push(m);
      this.byId.set(m.id, m);
    }
    this.nextId = restored.nextId;
    this.spawner.rolled.clear();
    for (const k of restored.rolled) this.spawner.rolled.add(k);
    this.spawner.guaranteed = snapshot.guaranteed === true;
    this.spawner.keepAliveS = Number.isFinite(snapshot.keepAliveS) ? Math.max(0, snapshot.keepAliveS) : 0;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.deathListeners.clear();
  }

  /** Spawning internals for tests and debugging. */
  get spawning(): Spawner {
    return this.spawner;
  }
}
