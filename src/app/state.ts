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
    this.sim = new Simulation(world, bus, this.player, this.clock);
    this.survival = new Survival(world, this.player, this.clock, (x, z) => world.biomeAt(x, z));
    this.objectives = new ObjectiveTracker(bus, this.player, this.sim);
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
    return new GameState(world, bus, seedText, null);
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

  /** One fixed simulation step (spec section 4: clock, simulation, survival, objectives). */
  tick(dt: number = DT): void {
    this.clock.tick(dt);
    this.sim.tick(dt);
    this.survival.tick(dt);
    this.objectives.tick(dt);
    this.playTimeS += dt;
    this.ticks++;
  }

  /** Everything needed to continue this world later, as plain JSON-safe data. */
  toSave(): WorldSave {
    return {
      seed: this.world.seed,
      seedText: this.seedText,
      world: this.world.toJSON(),
      player: this.player.toJSON(),
      clock: this.clock.toJSON(),
      survival: this.survival.toJSON(),
      objectives: this.objectives.toJSON(),
      playTimeS: this.playTimeS,
    };
  }

  dispose(): void {
    this.objectives.dispose();
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
