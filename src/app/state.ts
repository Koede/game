/**
 * The DOM-free heart of one world session: the bus, the World, the player, the clock, the simulation, survival
 * and the objective tracker, wired in dependency order, plus the fixed 20 Hz tick and the save snapshot.
 * Runs in node (tests drive whole sessions through it); the browser-side Game adds rendering, input, UI and audio.
 */
import { SAVE_REV } from '../save/migrations';
import { DT, MAX_AIR_S, MAX_FOOD, MAX_HEALTH, MAX_WARMTH } from '../core/constants';
import { createBus, type Difficulty, type GameBus } from '../core/context';
import { parseGameMode, type GameMode } from '../core/gameMode';
import { seedFromString } from '../core/math';
import { GameClock } from '../game/clock';
import { ObjectiveTracker } from '../game/objectives';
import { PlayerState } from '../game/playerState';
import { Survival } from '../game/survival';
import { Journal, isJournalSnapshot } from '../game/journal';
import { Weather, isWeatherSnapshot } from '../game/weather';
import { MobManager, mobPlayerOf, type MobPlayer } from '../mobs';
import type { WorldSave } from '../save/document';
import { Simulation } from '../sim';
import { isFluidEndpoint } from '../core/registry';
import type { Face } from '../core/types';
import { Magic } from '../magic/magic';
import { VehicleManager } from '../vehicles';
import { Workshop } from '../workshop/workshop';
import { NpcManager } from '../npcs';
import { makeNpcHost } from '../npcs/host';
import { takeLostItems } from '../content/aliases';
import { World, type WorkerPool } from '../world';
import { diag, playerBrief } from './diag';
import { MagicWorkshopLink, treadwheelOccupied, workshopClockAndPack } from './gameWiring';

export interface StateOptions {
  /** Chunk worker pool (the browser passes `new WorkerPool(workerSource)`); omitted = main thread. */
  pool?: WorkerPool;
  /** Shared bus; a fresh one by default. */
  bus?: GameBus;
  /** Settings.difficulty (spec 19.3) the session starts on; 'normal' by default. Change it later with setDifficulty. */
  difficulty?: Difficulty;
  /** A new world's mode (Dev Mode only by the title screen's choice). `restore` takes the save's own mode. */
  mode?: GameMode;
}

export class GameState {
  readonly bus: GameBus;
  readonly world: World;
  readonly player: PlayerState;
  readonly clock: GameClock;
  readonly sim: Simulation;
  readonly survival: Survival;
  readonly objectives: ObjectiveTracker;
  /** The sky (spec 15): its `state` is read by the simulation, survival, renderer, audio and HUD. */
  readonly weather: Weather;
  /** The animals (spec 12.5), ticked after the simulation; their drops fall as ground items. */
  readonly mobs: MobManager;
  readonly journal: Journal;
  /** Live view of the player for the animals (position, yaw, held item). */
  readonly mobPlayer: MobPlayer;
  /** Tractors (docs/api/tractor.md). Headless: the browser Game binds the physics and draws them. */
  readonly vehicles: VehicleManager;
  /** Essentia & Research (docs/api/magic.md). */
  readonly magic: Magic;
  /** The Bronze workshop (docs/api/workshop.md). */
  readonly workshop: Workshop;
  /** The tavern's people (docs/api/npcs.md). */
  readonly npcs: NpcManager;
  readonly seedText: string | null;
  /** Things the player should hear once about the load (damaged modules, items from an old version); flushed on the first tick. */
  private notices: string[] = [];
  private readonly offs: (() => void)[] = [];
  /** 'dev' while Dev Mode is on: the player is invulnerable and free (docs/api/dev-mode.md). Switch with `setMode`. */
  private modeNow: GameMode;
  /** Seconds of simulated play in this world, across sessions. */
  playTimeS = 0;
  /** Number of fixed ticks run since this session started. */
  ticks = 0;
  /** bindWorkshop, then magic.tick. The link refuses a tick that arrives first. */
  private readonly magicLink = new MagicWorkshopLink();
  /** The difficulty both halves of combat run on (the automatons and the player's side): never one without the other. */
  private difficultyNow: Difficulty;

  private constructor(world: World, bus: GameBus, seedText: string | null, save: WorldSave | null, difficulty: Difficulty, mode: GameMode) {
    this.difficultyNow = difficulty;
    this.modeNow = mode;
    this.bus = bus;
    this.world = world;
    this.seedText = seedText;
    const spawn = world.spawnPoint();
    this.player = new PlayerState(bus, { x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5 });
    this.player.dev = mode === 'dev';
    this.clock = new GameClock(bus);
    // Load the player before the tracker and the simulation see anything: the tracker reads player.stats.
    if (save) {
      diag('state.player_before_load', () => ({ spawn, savedPlayer: save.player, constructed: playerBrief(this.player) }));
      this.player.load(save.player);
      diag('state.player_after_load', () => ({ loaded: playerBrief(this.player) }));
      this.clock.load(save.clock);
      this.playTimeS = save.playTimeS;
    }
    const biomeAt = (x: number, z: number) => world.biomeAt(x, z);
    this.weather = new Weather(world.seed, bus, biomeAt);
    if (save?.weather && isWeatherSnapshot(save.weather)) this.weather.load(save.weather);
    this.weather.update(0, this.clock.worldTimeS, this.clock.day, this.player.position);
    this.sim = new Simulation(world, bus, this.player, this.clock);
    this.sim.useWeather(this.weather.state, biomeAt);
    this.survival = new Survival(world, this.player, this.clock, biomeAt);
    this.survival.weather = this.weather.state;
    this.objectives = new ObjectiveTracker(bus, this.player, this.sim);
    this.journal = new Journal(() => this.clock.day, bus);
    if (save?.journal && isJournalSnapshot(save.journal)) this.journal.load(save.journal);
    this.mobs = new MobManager(world, bus, this.clock, world.seed, { difficulty });
    // The Emberbound (spec 19): ONE damage path. The automatons scale by the difficulty and emit 'player:attacked'
    // themselves, so the player's side only takes the hit (armour, burning, death cause) - never damagePlayer, which
    // would scale and announce it a second time.
    const combat = this.player.combat;
    this.mobs.useHostileHooks({
      safeZones: this.sim,
      damagePlayer: (amount, cause, x, z, kind) => {
        combat.takeHit(amount, cause, x, z, kind);
      },
      knockPlayer: (vx, vy, vz) => combat.knock(vx, vy, vz),
      sky: () => ({ storm: this.weather.state.kind === 'storm', moonPhase: this.clock.moonPhase }),
    });
    this.mobPlayer = mobPlayerOf(this.player);
    this.mobs.onDeath((d) => {
      this.player.dropAll(d.drops, { x: d.x, y: d.y + 0.4, z: d.z });
    });
    if (save?.mobs) {
      try {
        this.mobs.load(save.mobs);
      } catch (err) {
        // A damaged herd is no reason to refuse the world: the animals start afresh around the player.
        console.warn('[save] the animals could not be restored; starting fresh', err);
      }
    }
    if (save) {
      this.survival.load(save.survival);
      this.objectives.load(save.objectives);
    }
    // After the tracker exists: Peaceful raises its flag on the bus.
    combat.setDifficulty(difficulty);
    this.vehicles = new VehicleManager({ world, bus, player: this.player });
    world.loadExtra('vehicles', (raw) => this.vehicles.load(raw));
    this.offs.push(world.persist('vehicles', () => this.vehicles.toJSON()));
    const sim = this.sim;
    this.magic = new Magic(world, bus, this.player, {
      stokeFurnace: (x, y, z, seconds) => {
        const f = sim.furnaceAt(x, y, z);
        if (!f || !f.burnItem) return false;
        f.burnLeftS += seconds;
        return true;
      },
      furnaceFire: (x, y, z) => {
        const f = sim.furnaceAt(x, y, z);
        return f && f.burnItem ? f.burnLeftS : null;
      },
      lightFurnace: (x, y, z) => {
        const r = sim.light(x, y, z);
        return r.ok ? null : r.reason;
      },
      purifyFlask: (x, y, z, litres) => {
        const e = sim.distill.entityAt(x, y, z);
        const water = e?.mix.water ?? 0;
        if (!e || water <= 0) return 0;
        const taken = Math.min(litres, water);
        e.mix.water = water - taken;
        if (e.mix.water <= 1e-6) delete e.mix.water;
        sim.distill.touched();
        return taken;
      },
      crank: (x, y, z) => this.workshop.crank(x, y, z),
    }, world.seed);
    world.loadExtra('magic', (raw) => this.magic.load(raw));
    this.offs.push(world.persist('magic', () => this.magic.toJSON()));
    this.offs.push(() => this.magic.dispose());
    this.workshop = new Workshop(world, bus, this.player.ground);
    world.loadExtra('workshop', (raw) => this.workshop.load(raw));
    this.workshop.generatorWatts = (x, y, z) => this.sim.machineView(x, y, z)?.outW ?? 0;
    // Treadwheels turn while the player stands on them; a driven, fuelled tractor turns a shaft beside it; spouts and drains reach tanks with buckets.
    this.workshop.standingOn = (x, y, z) => treadwheelOccupied(this.player.position, this.mobs.all, x, y, z);
    const pack = workshopClockAndPack(this.clock, (item, n) => this.player.inventory.add(item, n));
    this.workshop.timeS = pack.timeS;
    this.workshop.giveItem = pack.giveItem;
    this.magicLink.bind(this.magic, this.workshop);
    this.workshop.tractors = () => this.vehicles.views().map((t) => ({ x: t.x, y: t.y, z: t.z, occupied: t.occupied, fuel: t.fuel }));
    this.workshop.fluidBlock = {
      is: (x, y, z) => isFluidEndpoint(world.getBlock(x, y, z)),
      use: (x, y, z, item) => {
        const r = this.sim.bucketUse(x, y, z, 2 as Face, item);
        return r.ok ? r.held : null;
      },
    };
    this.workshop.clockText = () => {
      const h = (6 + this.clock.timeOfDay * 24) % 24;
      return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    };
    // Deployers use their stack on hand stations the way a player's stroke does; anything else falls back to placing and breaking.
    this.workshop.actHook = (a) => {
      const r = this.sim.stroke(a.target[0], a.target[1], a.target[2], a.item);
      if (!r.ok) return null;
      return r.did === 'insert' ? 'consumed' : 'used';
    };
    this.offs.push(world.persist('workshop', () => this.workshop.toJSON()));
    this.npcs = new NpcManager(bus);
    this.npcs.bind(makeNpcHost({ player: this.player, objectives: this.objectives, clock: this.clock, magic: this.magic, mobs: this.mobs, world, sim: this.sim }));
    world.loadExtra('npcs', (raw) => this.npcs.load(raw));
    this.offs.push(world.persist('npcs', () => this.npcs.toJSON()));
    this.offs.push(() => this.workshop.dispose());
    for (const key of world.failedExtras()) this.notices.push(`Saved ${key} data could not be read. A copy was kept (${key}.bad) and it starts empty.`);
    const lost = takeLostItems();
    if (lost.size > 0) {
      const n = [...lost.values()].reduce((a, b) => a + b, 0);
      this.notices.push(`${n} item stack${n === 1 ? '' : 's'} from an old version no longer exist and were removed.`);
      diag('save.repaired', () => ({ lostItems: [...lost.entries()] }));
    }
    // Entities came with the world snapshot; the simulation rebuilt its runtime from them in its constructor,
    // resync again in case anything touched the world in between (the integration note asks for it after load).
    this.sim.resync();
    diag('state.ready', () => ({
      fromSave: save !== null,
      seed: world.seed,
      difficulty,
      player: playerBrief(this.player),
      playTimeS: this.playTimeS,
      day: this.clock.day,
      mobsRestored: save?.mobs ? 'attempted' : 'fresh',
    }));
  }

  /** A brand-new world. `seed` is the numeric seed, `seedText` what the player typed (null = random). */
  static create(seed: number, seedText: string | null, options: StateOptions = {}): GameState {
    const bus = options.bus ?? createBus();
    const world = new World(seed >>> 0, bus, { pool: options.pool });
    const state = new GameState(world, bus, seedText, null, options.difficulty ?? 'normal', parseGameMode(options.mode));
    state.prepareAroundPlayer(2);
    state.startInTavern();
    return state;
  }

  /** Continues a saved world exactly. Throws (changing nothing outside) when the world snapshot is unusable. */
  static restore(save: WorldSave, options: StateOptions = {}): GameState {
    const bus = options.bus ?? createBus();
    const world = World.fromJSON(save.world, bus, { pool: options.pool });
    return new GameState(world, bus, save.seedText, save, options.difficulty ?? 'normal', parseGameMode(save.mode));
  }

  /** The difficulty the session runs on (Settings.difficulty). */
  get difficulty(): Difficulty {
    return this.difficultyNow;
  }

  /**
   * Changes the difficulty of the automatons and of the player's side together (the settings panel, at any time).
   * Peaceful removes every natural automaton and bolt at once and puts out a fire on the player.
   */
  setDifficulty(d: Difficulty): void {
    if (d === this.difficultyNow) return;
    this.difficultyNow = d;
    this.mobs.setDifficulty(d);
    this.player.combat.setDifficulty(d);
  }

  /** A new world opens inside the tavern (docs/api/npcs.md); where it cannot be built (unloaded ground), the old open-view start. */
  startInTavern(): void {
    const p = this.player.position;
    const ground = this.world.surfaceY(Math.floor(p.x), Math.floor(p.z));
    const start = ground >= 0 ? this.npcs.buildStart(this.world, Math.floor(p.x), ground, Math.floor(p.z)) : null;
    if (!start) {
      this.faceOpenView();
      return;
    }
    this.player.position.x = start.x;
    this.player.position.y = start.y;
    this.player.position.z = start.z;
    this.player.yaw = Math.PI; // looking south, into the hall
    this.player.pitch = 0;
  }

  /** Makes sure the voxels under and around the player exist right now (before the first physics step). */
  prepareAroundPlayer(radiusChunks = 1): void {
    const p = this.player.position;
    this.world.ensureLoadedAround(Math.floor(p.x), Math.floor(p.z), radiusChunks);
  }

  /** Turns the player towards the most open horizon around them, so a new world does not open on a hillside. */
  faceOpenView(): void {
    const p = this.player.position;
    let bestYaw = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      const yaw = (i * Math.PI) / 4;
      const dx = -Math.sin(yaw);
      const dz = -Math.cos(yaw);
      let score = 0;
      for (let d = 2; d <= 16; d += 2) {
        const top = this.world.surfaceY(Math.floor(p.x + dx * d), Math.floor(p.z + dz * d));
        if (top >= 0) score -= Math.max(0, top - p.y) * (1.2 - d / 20);
      }
      if (score > bestScore + 1e-6) {
        bestScore = score;
        bestYaw = yaw;
      }
    }
    this.player.yaw = bestYaw > Math.PI ? bestYaw - Math.PI * 2 : bestYaw;
    this.player.pitch = -0.08;
  }

  /** One fixed simulation step (spec section 4: clock, weather, simulation, flowing water, animals, survival, objectives). */
  tick(dt: number = DT): void {
    this.clock.tick(dt);
    this.weather.update(dt, this.clock.worldTimeS, this.clock.day, this.player.position);
    this.sim.tick(dt);
    // Flowing water (spec 18.2): one step of the world's scheduled water updates per fixed tick.
    this.world.water.tick();
    this.mobs.tick(dt, this.mobPlayer);
    this.survival.tick(dt);
    this.objectives.tick(dt);
    this.journal.explore(this.player.position.x, this.player.position.z);
    this.magicLink.tick(this.magic, dt);
    this.workshop.tick(dt);
    if (this.ticks % 200 === 0) this.workshop.verify();
    if (this.notices.length > 0) for (const text of this.notices.splice(0)) this.bus.emit('toast', { text, kind: 'warn' });
    if (this.modeNow === 'dev') this.devUpkeep();
    this.npcs.tick(dt);
    if (!this.npcs.greeted) this.npcs.greet();
    this.playTimeS += dt;
    this.ticks++;
  }

  /** Dev Mode: the bars never fall (no starving, freezing or drowning), and the dead are revived. */
  private devUpkeep(): void {
    const p = this.player;
    p.health = MAX_HEALTH;
    p.food = MAX_FOOD;
    p.warmth = MAX_WARMTH;
    p.air = MAX_AIR_S;
    if (p.dead) p.dead = false;
  }

  get mode(): GameMode {
    return this.modeNow;
  }

  /**
   * Turns Dev Mode on or off in a running world (the Dev Mode switch in Settings, either way, any time). Off puts the player back
   * under the survival rules at once: flight ends, free placing resets to on for the next time, and the bars simply start to move again.
   */
  setMode(mode: GameMode): void {
    if (mode === this.modeNow) return;
    this.modeNow = mode;
    this.player.dev = mode === 'dev';
    if (mode !== 'dev') {
      this.player.flying = false;
      this.player.devFreePlace = true;
    }
    this.bus.emit('toast', { text: mode === 'dev' ? 'Dev Mode on' : 'Dev Mode off - back to survival', kind: 'good' });
  }

  /** Everything needed to continue this world later, as plain JSON-safe data (independent of the live world). */
  toSave(): WorldSave {
    return this.snapshot(false);
  }

  /**
   * The save as JSON text, serialised once from the live objects (no intermediate deep copy): what autosaves write.
   * Nothing runs between taking the snapshot and serialising it, so it is as consistent as toSave().
   */
  toSaveJson(): string {
    return JSON.stringify(this.snapshot(true));
  }

  private snapshot(shared: boolean): WorldSave {
    diag('state.snapshot', () => ({ shared, player: playerBrief(this.player), ticks: this.ticks, playTimeS: this.playTimeS }));
    return {
      ...(this.modeNow === 'dev' ? { mode: this.modeNow } : {}),
      rev: SAVE_REV,
      seed: this.world.seed,
      seedText: this.seedText,
      world: this.world.toJSON({ shared }),
      player: this.player.toJSON(),
      clock: this.clock.toJSON(),
      survival: this.survival.toJSON(),
      objectives: this.objectives.toJSON(),
      playTimeS: this.playTimeS,
      weather: this.weather.toJSON(),
      mobs: this.mobs.toJSON(),
      journal: this.journal.toJSON(),
    };
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
    this.objectives.dispose();
    this.journal.dispose();
    this.mobs.dispose();
    this.sim.dispose();
    this.player.dispose();
    this.world.dispose();
    this.bus.clear();
  }
}

/** Turns what the player typed into a numeric seed; null/empty = a random one. */
export function seedFrom(text: string | null, random: () => number = Math.random): number {
  const t = text?.trim() ?? '';
  if (t === '') return Math.floor(random() * 0xffffffff) >>> 0;
  if (/^-?\d{1,10}$/.test(t)) return Number(t) >>> 0;
  return seedFromString(t);
}
