/**
 * The DOM-free heart of one world session: the bus, the World, the player, the clock, the simulation, survival
 * and the objective tracker, wired in dependency order, plus the fixed 20 Hz tick and the save snapshot.
 * Runs in node (tests drive whole sessions through it); the browser-side Game adds rendering, input, UI and audio.
 */
import { DT } from '../core/constants';
import { createBus, type GameBus } from '../core/context';
import { seedFromString } from '../core/math';
import { GameClock } from '../game/clock';
import { ObjectiveTracker } from '../game/objectives';
import { PlayerState } from '../game/playerState';
import { Survival } from '../game/survival';
import { Weather, isWeatherSnapshot } from '../game/weather';
import { MobManager, mobPlayerOf, type MobPlayer } from '../mobs';
import type { WorldSave } from '../save/document';
import { Simulation } from '../sim';
import { World, type WorkerPool } from '../world';

export interface StateOptions {
  /** Chunk worker pool (the browser passes `new WorkerPool(workerSource)`); omitted = main thread. */
  pool?: WorkerPool;
  /** Shared bus; a fresh one by default. */
  bus?: GameBus;
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
  /** The animals (spec 12.5), ticked after the simulation; their drops go straight into the player's pack. */
  readonly mobs: MobManager;
  /** Live view of the player for the animals (position, yaw, held item). */
  readonly mobPlayer: MobPlayer;
  readonly seedText: string | null;
  /** Seconds of simulated play in this world, across sessions. */
  playTimeS = 0;
  /** Number of fixed ticks run since this session started. */
  ticks = 0;

  private constructor(world: World, bus: GameBus, seedText: string | null, save: WorldSave | null) {
    this.bus = bus;
    this.world = world;
    this.seedText = seedText;
    const spawn = world.spawnPoint();
    this.player = new PlayerState(bus, { x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5 });
    this.clock = new GameClock(bus);
    // Load the player before the tracker and the simulation see anything: the tracker reads player.stats.
    if (save) {
      this.player.load(save.player);
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
    this.mobs = new MobManager(world, bus, this.clock, world.seed);
    this.mobPlayer = mobPlayerOf(this.player);
    this.mobs.onDeath((d) => {
      for (const s of d.drops) this.player.give(s.item, s.count);
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
    // Entities came with the world snapshot; the simulation rebuilt its runtime from them in its constructor,
    // resync again in case anything touched the world in between (the integration note asks for it after load).
    this.sim.resync();
  }

  /** A brand-new world. `seed` is the numeric seed, `seedText` what the player typed (null = random). */
  static create(seed: number, seedText: string | null, options: StateOptions = {}): GameState {
    const bus = options.bus ?? createBus();
    const world = new World(seed >>> 0, bus, { pool: options.pool });
    const state = new GameState(world, bus, seedText, null);
    state.prepareAroundPlayer(1);
    state.faceOpenView();
    return state;
  }

  /** Continues a saved world exactly. Throws (changing nothing outside) when the world snapshot is unusable. */
  static restore(save: WorldSave, options: StateOptions = {}): GameState {
    const bus = options.bus ?? createBus();
    const world = World.fromJSON(save.world, bus, { pool: options.pool });
    return new GameState(world, bus, save.seedText, save);
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
    this.playTimeS += dt;
    this.ticks++;
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
    return {
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
    };
  }

  dispose(): void {
    this.objectives.dispose();
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
