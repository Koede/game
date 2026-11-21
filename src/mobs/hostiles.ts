/**
 * The Emberbound in the MobManager (spec 19.2-19.3): every automaton's tick (senses, wind-down, attacks, steering,
 * physics, footsteps, hazards), ember bolts, night spawning, ruin guards, despawning, the player's hits on them, and
 * their save data. Automatons live in their own list (the animals' caps, spawner and retiring never see them) but
 * share the manager's id space, so raycast / hit / describe / views treat both alike. DOM-free.
 */
import {
  DT,
  HOSTILE_DESPAWN_DISTANCE,
  HOSTILE_DORMANT_DESPAWN_DISTANCE,
  HOSTILE_NIGHT_SUNLIGHT,
  HOSTILE_SPAWN_INTERVAL_S,
  HOSTILE_WIND_DOWN_SUNLIGHT,
  MOB_DEATH_S,
  PLAYER_HEIGHT,
} from '../core/constants';
import type { Difficulty, GameBus } from '../core/context';
import { hostileCap, hostileDamage, type SkyFacts } from '../core/hostile';
import type { CreatureSpec, HostileSpec, IWorld } from '../core/types';
import { bodyHeight, halfWidth } from './brain';
import { knockVector, voicePitch } from './attacks';
import { CORPSE_FADE_S, VOID_Y } from './constants';
import { separate } from './crowd';
import { guardRuin, sweepRuins, type GuardHost } from './guards';
import { thinkHostile } from './hostileBrain';
import { hitHostile, hurtHostile, type HurtEnv } from './hostileHurt';
import type { HostileCtx } from './hostileCtx';
import { stepFlyer } from './hostileMove';
import { createHostile, saveHostiles, type RestoredHostiles } from './hostileRecords';
import { trySpawn, type HostileSpawnHost } from './hostileSpawner';
import type { HitOptions, HostileHooks, HostileRole, HostilesSnapshot, Projectile } from './hostileTypes';
import { contactHazard, embedded, stepBody, type Hazard, type StepInfo } from './physics';
import { Projectiles, type BoltHost } from './projectiles';
import { liquidAt } from './terrain';
import type { BiomeLookup, DeathCause, HitResult, Mob, MobClock, MobDeath, MobPlayer } from './types';
import { ruinGuardPlans, type RuinGuardPlan } from '../world/ruinGuards';

/** Footsteps are voiced within this many blocks of the player. */
const STEP_RANGE = 24;
/** How often (seconds) ruins near the player are checked for guards, and far automatons for despawning. */
const SWEEP_S = 1;
const CLEAR_SKY: SkyFacts = { storm: false, moonPhase: 4 };

/** What the layer needs from the manager. */
export interface HostileHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly seed: number;
  readonly rng: () => number;
  readonly biomeAt: BiomeLookup;
  /** The manager's id -> mob map (shared by animals and automatons). */
  readonly byId: Map<number, Mob>;
  nextId(): number;
  /** Hands a finished death to the manager's listeners (drops to the player). */
  died(d: MobDeath): void;
}

export class HostileLayer {
  private readonly list: Mob[] = [];
  /** Automatons simulated this tick (column loaded, not Peaceful). */
  private readonly activeList: Mob[] = [];
  private readonly walkers: Mob[] = [];
  readonly projectiles = new Projectiles();
  readonly guarded = new Set<string>();
  private difficulty: Difficulty = 'normal';
  private hooks: HostileHooks = {};
  private spawnS = HOSTILE_SPAWN_INTERVAL_S;
  private sweepS = 0;
  private contactTick = 0;
  /** False: no night spawning (tests and harnesses; ruin guards still appear). */
  naturalSpawning = true;
  private readonly info: StepInfo = { blocked: false };
  private readonly hazard: Hazard = { damage: 0, x: 0, z: 0 };
  private readonly knock = [0, 0, 0];
  private readonly ctx: HostileCtx;
  private readonly boltHost: BoltHost;
  private readonly spawnHost: HostileSpawnHost;
  private readonly guardHost: GuardHost;
  private readonly hurtEnv: HurtEnv;
  /** Chunk columns loaded since the last tick ([cx, cz] pairs): their ruins may now be whole. */
  private readonly freshChunks: number[] = [];
  private readonly off: () => void;

  constructor(private readonly host: HostileHost) {
    const safe = (x: number, y: number, z: number): boolean => this.hooks.safeZones?.isSafe(x, y, z) ?? false;
    this.ctx = {
      world: host.world, bus: host.bus, rng: host.rng,
      player: { x: 0, y: 0, z: 0, yaw: 0, heldItem: () => null },
      playerSafe: false, playerWet: false, night: false, daylight: true, safe,
      hurtPlayer: (m, spec, mult, dx, dz, knock, sx, sy, sz) => this.hurtPlayer(m, spec, mult, dx, dz, knock, sx, sy, sz),
      fireBolt: (m, _spec, x, y, z, vx, vy, vz) => {
        this.projectiles.fire(host.bus, { id: m.id, species: m.spec.key }, x, y, z, vx, vy, vz, hostileDamage(m.spec, this.difficulty));
      },
    };
    this.boltHost = {
      world: host.world, bus: host.bus, safe,
      strikePlayer: (p) => this.boltStrike(p),
    };
    this.spawnHost = {
      world: host.world, rng: host.rng, biomeAt: host.biomeAt, safe,
      loadedOf: (key) => this.loadedOf(key),
      add: (spec, x, y, z, yaw) => {
        this.add(spec, x, y, z, yaw, 'natural', '', { x, y, z });
      },
    };
    this.guardHost = {
      world: host.world, seed: host.seed, guarded: this.guarded,
      addGuard: (spec, x, y, z, yaw, role, ruin) => this.addGuard(spec, x, y, z, yaw, role, ruin),
    };
    this.hurtEnv = { bus: host.bus, rng: host.rng, ctx: this.ctx, died: (d) => host.died(d) };
    this.off = host.bus.on('chunk:loaded', ({ cx, cz }) => {
      this.freshChunks.push(cx, cz);
    });
  }

  dispose(): void {
    this.off();
  }

  // ------------------------------------------------------------------------------------------ configuration

  /** Plugs the game in (safe zones, player damage and knockback, the sky). Replaces earlier hooks. */
  useHooks(hooks: HostileHooks): void {
    this.hooks = hooks;
  }

  get currentDifficulty(): Difficulty {
    return this.difficulty;
  }

  /** Peaceful removes every natural automaton and bolt at once; ruin guards stay (saved, not simulated, not shown). */
  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    if (d !== 'peaceful') return;
    this.projectiles.clear();
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].hostile!.role === 'natural') this.removeAt(i);
    this.activeList.length = 0;
  }

  // ------------------------------------------------------------------------------------------ queries

  /** Every automaton, simulated or not (ruin guards on Peaceful, frozen ones in unloaded chunks). */
  get all(): readonly Mob[] {
    return this.list;
  }
  /** Automatons simulated in the last tick (what is drawn and can be hit). */
  get active(): readonly Mob[] {
    return this.activeList;
  }

  private loadedOf(key: string): number {
    let n = 0;
    for (const m of this.activeList) if (m.spec.key === key && m.state !== 'dying') n++;
    return n;
  }

  /** Living automatons simulated now (what the difficulty cap counts; ruin guards included). */
  get loadedCount(): number {
    let n = 0;
    for (const m of this.activeList) if (m.state !== 'dying') n++;
    return n;
  }

  // ------------------------------------------------------------------------------------------ population

  /** Adds an automaton (emits 'mob:spawned'). */
  add(spec: CreatureSpec, x: number, y: number, z: number, yaw: number, role: HostileRole, ruin: string, home: { x: number; y: number; z: number }): Mob {
    const m = createHostile(this.host.nextId(), spec, x, y, z, yaw, role, ruin, home, this.host.rng);
    this.list.push(m);
    this.host.byId.set(m.id, m);
    if (this.difficulty !== 'peaceful' && this.host.world.isLoaded(x, z)) this.activeList.push(m);
    this.host.bus.emit('mob:spawned', { id: m.id, species: spec.key });
    return m;
  }

  private addGuard(spec: CreatureSpec, x: number, y: number, z: number, yaw: number, role: 'guard' | 'turret', ruin: RuinGuardPlan): void {
    this.add(spec, x, y, z, yaw, role, ruin.key, { x: ruin.x, y: ruin.floor + 1, z: ruin.z });
  }

  /** Creates the guards of a ruin now if it never had them and it is fully loaded (tests; the sweep does this). */
  guardRuin(plan: RuinGuardPlan): boolean {
    return guardRuin(this.guardHost, plan);
  }

  private removeAt(index: number): void {
    const m = this.list[index];
    this.list[index] = this.list[this.list.length - 1];
    this.list.pop();
    this.host.byId.delete(m.id);
    const a = this.activeList.indexOf(m);
    if (a >= 0) this.activeList.splice(a, 1);
  }

  // ------------------------------------------------------------------------------------------ tick

  tick(dt: number, player: MobPlayer, clock: MobClock): void {
    const world = this.host.world;
    for (let i = 0; i < this.freshChunks.length; i += 2) {
      for (const p of ruinGuardPlans(this.host.seed, this.freshChunks[i], this.freshChunks[i + 1])) guardRuin(this.guardHost, p);
    }
    this.freshChunks.length = 0;
    this.sweepS -= dt;
    if (this.sweepS <= 0) {
      this.sweepS = SWEEP_S;
      sweepRuins(this.guardHost, player.x, player.z);
      this.despawn(player);
    }
    const active = this.activeList;
    active.length = 0;
    if (this.difficulty === 'peaceful') return;
    for (const m of this.list) if (world.isLoaded(m.x, m.z)) active.push(m);

    const ctx = this.ctx;
    const sun = clock.sunlight();
    ctx.player = player;
    ctx.night = sun < HOSTILE_NIGHT_SUNLIGHT;
    ctx.daylight = sun >= HOSTILE_WIND_DOWN_SUNLIGHT;
    ctx.playerSafe = ctx.safe(player.x, player.y + PLAYER_HEIGHT / 2, player.z);
    const px = Math.floor(player.x);
    const pz = Math.floor(player.z);
    ctx.playerWet = liquidAt(world, px, Math.floor(player.y + 0.1), pz) === 'water' || liquidAt(world, px, Math.floor(player.y + 1), pz) === 'water';

    if (this.naturalSpawning) {
      this.spawnS -= dt;
      if (this.spawnS <= 0) {
        this.spawnS = HOSTILE_SPAWN_INTERVAL_S;
        const sky = this.hooks.sky?.() ?? CLEAR_SKY;
        trySpawn(this.spawnHost, player, { night: ctx.night, sky }, hostileCap(this.difficulty) - this.loadedCount);
      }
    }

    this.contactTick = (this.contactTick + 1) % 5;
    const walkers = this.walkers;
    walkers.length = 0;
    for (let i = 0; i < active.length; i++) {
      const m = active[i];
      this.remember(m);
      if (m.state === 'dying') {
        m.deadS += dt;
        continue;
      }
      thinkHostile(ctx, m, dt);
      const s = m.spec.hostile!;
      if (!s.flying && !s.stationary && m.hostile!.mode !== 'dormant') walkers.push(m);
    }
    separate(world, walkers, dt);
    for (let i = 0; i < active.length; i++) this.move(active[i], dt, player);
    this.projectiles.tick(dt, this.boltHost, player);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if ((m.state === 'dying' && m.deadS >= MOB_DEATH_S + CORPSE_FADE_S) || m.y < VOID_Y) this.removeAt(i);
    }
  }

  /** Interpolation history and the short timers every automaton keeps. */
  private remember(m: Mob): void {
    m.px = m.x;
    m.py = m.y;
    m.pz = m.z;
    m.pyaw = m.yaw;
    m.pwalk = m.walk;
    m.phead = m.head;
    if (m.hurtS > 0) m.hurtS = Math.max(0, m.hurtS - DT);
    if (m.hitCooldownS > 0) m.hitCooldownS -= DT;
  }

  /** Physics, footsteps and hazards of one simulated automaton. */
  private move(m: Mob, dt: number, player: MobPlayer): void {
    const s = m.spec.hostile!;
    const h = m.hostile!;
    const hw = halfWidth(m);
    const bh = bodyHeight(m);
    if (m.state === 'dying') {
      m.vx *= 0.8;
      m.vz *= 0.8;
      stepBody(this.host.world, m, hw, bh, dt, this.info);
      return;
    }
    if (s.flying && h.mode !== 'dormant') stepFlyer(this.host.world, m, dt);
    else {
      if (s.stationary) m.vx = m.vz = 0;
      if (embedded(this.host.world, m, hw, bh)) m.y = Math.min(m.y + 0.25, 95);
      m.blocked = stepBody(this.host.world, m, hw, bh, dt, this.info).blocked;
    }
    const moved = Math.hypot(m.x - m.px, m.z - m.pz);
    m.speed = moved / dt;
    m.walk += moved;
    if (!s.flying && !s.stationary && m.onGround) {
      h.stepAcc += moved;
      const stride = Math.max(0.55, m.spec.size.w * 0.9);
      if (h.stepAcc >= stride) {
        h.stepAcc = 0;
        if ((m.x - player.x) ** 2 + (m.z - player.z) ** 2 <= STEP_RANGE * STEP_RANGE) {
          this.host.bus.emit('sfx', { name: 'automaton_step', x: m.x, y: m.y, z: m.z, pitch: voicePitch(m.spec) * (0.94 + this.host.rng() * 0.12) });
        }
      }
    }
    if ((m.id + this.contactTick) % 5 === 0) this.contact(m, hw, bh);
  }

  /** Lava (any contact damage) touching the body, checked every 0.25 s. */
  private contact(m: Mob, hw: number, h: number): void {
    if (m.contactS > 0) m.contactS -= DT * 5;
    if (m.contactS > 0 || contactHazard(this.host.world, m, hw, h, this.hazard) === 0) return;
    m.contactS = 1;
    this.hurtMob(m, this.hazard.damage, 'world');
  }

  /** Removes far-off natural automatons (spec 19.3): beyond HOSTILE_DESPAWN_DISTANCE, dormant ones sooner. */
  private despawn(player: MobPlayer): void {
    const far = HOSTILE_DESPAWN_DISTANCE * HOSTILE_DESPAWN_DISTANCE;
    const farDormant = HOSTILE_DORMANT_DESPAWN_DISTANCE * HOSTILE_DORMANT_DESPAWN_DISTANCE;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      const h = m.hostile!;
      if (h.role !== 'natural' || m.state === 'dying') continue;
      const d = (m.x - player.x) ** 2 + (m.z - player.z) ** 2;
      if (d > far || (h.mode === 'dormant' && d > farDormant)) this.removeAt(i);
    }
  }

  // ------------------------------------------------------------------------------------------ hurting the player

  private hurtPlayer(m: Mob, spec: HostileSpec, mult: number, dx: number, dz: number, knock: number, sx: number, sy: number, sz: number): void {
    const amount = hostileDamage(m.spec, this.difficulty) * mult;
    if (amount <= 0) return;
    this.host.bus.emit('player:attacked', { species: m.spec.key, attack: spec.attack, amount, x: sx, y: sy, z: sz });
    this.hooks.damagePlayer?.(amount, 'automaton', sx, sz, m.spec.key);
    if (knock > 0 && this.hooks.knockPlayer) {
      const k = knockVector(dx, dz, knock, this.knock);
      this.hooks.knockPlayer(k[0], k[1], k[2]);
    }
  }

  private boltStrike(p: Projectile): void {
    const amount = p.damage;
    if (amount <= 0) return;
    this.host.bus.emit('player:attacked', { species: p.species, attack: p.attack, amount, x: p.x, y: p.y, z: p.z });
    this.hooks.damagePlayer?.(amount, 'automaton', p.x, p.z, p.species);
  }

  // ------------------------------------------------------------------------------------------ the player's hits

  /** The player hits automaton `m` (see hitHostile in hostileHurt.ts). */
  hit(m: Mob, damage: number, fromX: number, fromZ: number, opts: HitOptions = {}): HitResult {
    return hitHostile(this.hurtEnv, m, damage, fromX, fromZ, opts);
  }

  private hurtMob(m: Mob, damage: number, cause: DeathCause): void {
    hurtHostile(this.hurtEnv, m, damage, cause);
  }

  // ------------------------------------------------------------------------------------------ persistence

  toJSON(): HostilesSnapshot {
    return saveHostiles(this.list, this.guarded, this.spawnS);
  }

  /** Replaces every automaton with restored ones (restoreHostiles). Returns the largest id restored (0 if none). */
  load(r: RestoredHostiles): number {
    for (const m of this.list) this.host.byId.delete(m.id);
    this.list.length = 0;
    this.activeList.length = 0;
    this.projectiles.clear();
    this.guarded.clear();
    for (const k of r.guarded) this.guarded.add(k);
    this.spawnS = r.spawnS;
    let maxId = 0;
    for (const m of r.mobs) {
      this.list.push(m);
      this.host.byId.set(m.id, m);
      maxId = Math.max(maxId, m.id);
    }
    return maxId;
  }
}
