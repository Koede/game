/**
 * One playable world in the browser: the DOM-free GameState plus the renderer, input, player controller, UI and
 * audio, wired in dependency order, and the per-frame game loop of spec section 4.
 *
 * Frame order: controls + player physics -> fixed 20 Hz ticks (clock, weather, simulation, animals, survival,
 * objectives; at most 5 per frame) -> world streaming (after the controller so edits show this frame) -> audio -> UI
 * -> animal models (interpolated) -> render.
 */
import { AudioEngine } from '../audio';
import { DT } from '../core/constants';
import { createInputState, type InputState, type IView, type Settings } from '../core/context';
import { InputManager, PlayerController } from '../player';
import { createIconProvider, Renderer } from '../render';
import { MobRenderer } from '../render/mobs';
import type { WorldSave } from '../save/document';
import { GameUI } from '../ui/gameUI';
import type { UIRoot } from '../ui/kit/root';
import { registerStationScreens } from '../ui/screens/furnace';
import type { WorkerPool } from '../world';
import { AmbienceProbe } from './ambience';
import { clampFrameDt, FixedStep } from './loop';
import { GameState } from './state';

/** Milliseconds of chunk work per frame while playing, and while the loading screen hides the world. */
export const STREAM_BUDGET_MS = 4;
export const LOADING_BUDGET_MS = 14;
/** Chunks around the player that must be meshed before play starts (Chebyshev radius in chunks). */
export const READY_RADIUS = 2;

export interface GameOptions {
  app: HTMLElement;
  root: UIRoot;
  /** Shared, mutated in place by the app when the player changes a setting. */
  settings: Settings;
  state: GameState;
  /** Owned by the game from now on: disposed with it. */
  pool: WorkerPool;
  /** "Save and quit to title" was chosen in the pause menu. */
  onQuit: () => void;
  onSettingsChange: (settings: Settings, key: keyof Settings) => void;
}

/** Number of chunk columns the world meshes within `r` chunks of the player (the streamer's view circle). */
export function chunksInView(r: number): number {
  let n = 0;
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r + r) n++;
  return n;
}

export class Game {
  readonly state: GameState;
  readonly input: InputState = createInputState();
  readonly renderer: Renderer;
  /** The animals' models, drawn into the renderer's scene (updated before every render). */
  readonly mobRenderer: MobRenderer;
  readonly inputManager: InputManager;
  readonly ui: GameUI;
  readonly controller: PlayerController;
  readonly audio: AudioEngine;
  readonly ambience: AmbienceProbe;
  /** Frames drawn and fixed ticks run since the game started (debug / tests). */
  frames = 0;
  private readonly step = new FixedStep();
  private readonly pool: WorkerPool;
  private readonly settings: Settings;
  private readonly readyTarget = chunksInView(READY_RADIUS);
  private disposed = false;
  /** The animal whose name and health the crosshair shows, and the health it showed (refreshed when either changes). */
  private namedAnimal: number | null = null;
  private namedHealth = -1;

  constructor(opts: GameOptions) {
    const { state, settings, root } = opts;
    this.state = state;
    this.settings = settings;
    this.pool = opts.pool;
    const { bus, world, player, clock, sim, survival, objectives } = state;

    // Throws a clear error without WebGL2; the app turns it into the friendly message.
    this.renderer = new Renderer(opts.app, world, bus, clock, settings);
    this.renderer.setWeather(state.weather.state);
    this.mobRenderer = new MobRenderer(this.renderer, world);
    try {
      this.inputManager = new InputManager({ container: opts.app, touchLayer: root.layers.touch, settings, state: this.input, bus });
      this.ui = new GameUI(root, {
        bus,
        input: this.input,
        settings,
        world,
        player,
        clock,
        objectives,
        survival,
        sim,
        weather: () => state.weather.state,
        releasePointer: () => this.inputManager.releasePointerCapture(),
        pause: { onSettingsChange: opts.onSettingsChange, onQuit: opts.onQuit },
      });
      this.ui.setIconProvider(createIconProvider());
      registerStationScreens(this.ui, sim);
      const renderer = this.renderer;
      const ui = this.ui;
      // The controller draws through IView; the crosshair (HUD) needs the same target as the outline.
      const view: IView = {
        setView: (x, y, z, yaw, pitch) => renderer.setView(x, y, z, yaw, pitch),
        setFov: (deg) => renderer.setFov(deg),
        setTarget: (target, mining) => {
          renderer.setTarget(target, mining);
          ui.setTarget(target, mining);
        },
        setHeldItem: (key) => renderer.setHeldItem(key),
        triggerSwing: () => renderer.triggerSwing(),
      };
      this.controller = new PlayerController({ world, bus, player, view, input: this.inputManager, settings, state: this.input, animals: state.mobs });
      this.audio = new AudioEngine(bus, settings);
      this.ambience = new AmbienceProbe(world, player, clock, state.weather.state);
    } catch (err) {
      this.mobRenderer.dispose();
      this.renderer.dispose();
      throw err;
    }
    state.prepareAroundPlayer(1);
    const p = player.position;
    this.renderer.setView(p.x, player.eyeY, p.z, player.yaw, player.pitch);
    this.renderer.setFov(settings.fov);
  }

  get bus() {
    return this.state.bus;
  }

  /** 0..1: how much of the area around the player is ready to be shown. */
  get loadingProgress(): number {
    if (this.ready) return 1;
    const meshed = this.state.world.stats().meshed;
    return Math.min(0.99, meshed / this.readyTarget);
  }

  /** True once the chunks around the player are meshed (play can start). */
  get ready(): boolean {
    const p = this.state.player.position;
    return this.state.world.isReadyAround(Math.floor(p.x), Math.floor(p.z), READY_RADIUS);
  }

  /** Teleports with the controller so no fall damage is dealt, and makes sure the ground there exists. */
  teleport(x: number, y: number, z: number): void {
    this.state.world.ensureLoadedAround(Math.floor(x), Math.floor(z), 1);
    this.controller.teleport(x, y, z);
    this.ambience.invalidate();
  }

  /** A frame while the loading screen is up: stream chunks and draw behind it, nothing moves. */
  loadingFrame(rawDt: number): void {
    if (this.disposed) return;
    const dt = clampFrameDt(rawDt);
    const p = this.state.player;
    this.state.world.update(p.position.x, p.position.z, this.settings.renderDistance, LOADING_BUDGET_MS);
    this.renderer.setView(p.position.x, p.eyeY, p.position.z, p.yaw, p.pitch);
    this.mobRenderer.update(0, this.state.mobs.views(1));
    this.renderer.render(dt);
  }

  /** One animation frame of play. `rawDt` in seconds; clamped to 0.1. */
  frame(rawDt: number): void {
    if (this.disposed) return;
    const dt = clampFrameDt(rawDt);
    const { state } = this;
    const paused = this.input.paused;
    if (paused) {
      // Keep the input layer in step (it releases everything while paused) without moving the player.
      this.inputManager.frame(dt);
    } else {
      this.controller.update(dt);
      const ticks = this.step.advance(dt);
      for (let i = 0; i < ticks; i++) state.tick(DT);
    }
    const p = state.player;
    state.world.update(p.position.x, p.position.z, this.settings.renderDistance, STREAM_BUDGET_MS);
    this.audio.setListener(p.position.x, p.eyeY, p.position.z, p.yaw);
    this.audio.setAmbience(this.ambience.update(dt));
    this.showAnimalName();
    this.ui.frame(dt);
    // Animals are interpolated between the last two ticks; frozen in place while paused.
    this.mobRenderer.update(paused ? 0 : dt, state.mobs.views(paused ? 1 : this.step.alpha));
    this.renderer.render(paused ? 0 : dt);
    this.frames++;
  }

  /** The crosshair names the animal under it with its health ("Goat - 6/8"), refreshed when either changes. */
  private showAnimalName(): void {
    const id = this.controller.targetAnimal;
    const health = id !== null ? (this.state.mobs.get(id)?.health ?? -1) : -1;
    if (id === this.namedAnimal && health === this.namedHealth) return;
    this.namedAnimal = id;
    this.namedHealth = health;
    this.ui.setTargetName(id !== null ? this.state.mobs.describe(id) || null : null);
  }

  /** Runs `n` fixed simulation ticks right now (debug / tests). */
  tick(n: number): void {
    for (let i = 0; i < n; i++) this.state.tick(DT);
  }

  toSave(): WorldSave {
    return this.state.toSave();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ui.dispose();
    this.controller.dispose();
    this.inputManager.dispose();
    this.audio.dispose();
    this.mobRenderer.dispose();
    // Release the GPU context now rather than whenever the browser collects it: a phone allows only a few.
    try {
      this.renderer.gl.forceContextLoss();
    } catch {
      /* already lost */
    }
    this.renderer.dispose();
    this.state.dispose();
    this.pool.dispose();
  }
}
