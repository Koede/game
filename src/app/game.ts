/**
 * One playable world in the browser: the DOM-free GameState plus the renderer, input, player controller, UI and
 * audio, wired in dependency order, and the per-frame game loop of spec section 4.
 *
 * Frame order: controls + player physics -> fixed 20 Hz ticks (clock, weather, simulation, animals, survival,
 * objectives; at most 5 per frame) -> world streaming (after the controller so edits show this frame) -> audio -> UI
 * -> animal models (interpolated) -> render.
 */
import { saveShot } from './photo';
import { resumeLine } from '../game/journal';
import { GOGGLES, inspect, type InspectProbe } from '../workshop/inspector';
import { isKinetic, Workshop } from '../workshop/workshop';
import { setCraftGate } from '../game/crafting';
import { Magic } from '../magic/magic';
import { MagicRenderer } from '../render/magic/magicRenderer';
import { WorkshopRenderer } from '../render/workshop/workshopRenderer';
import { createDeskScreen } from '../ui/screens/notebook/deskScreen';
import { createWorkshopScreen } from '../ui/screens/workshop/workshopScreen';
import { createJobsScreen } from '../ui/screens/jobs/jobsScreen';
import { createNotebookScreen } from '../ui/screens/notebook/notebookScreen';
import { AudioEngine } from '../audio';
import { DT, REACH } from '../core/constants';
import { isFluidEndpoint } from '../core/registry';
import type { Face } from '../core/types';
import { collectLeafDrops } from '../game/leafDrops';
import { aimGroundItem, dropLabel } from '../game/groundAim';
import { VehicleHud } from '../ui/vehicleHud';
import { TractorRenderer } from '../render/vehicles/tractorRenderer';
import { VehicleManager, wrapIntentSource } from '../vehicles';
import { seatOf, type Tractor } from '../vehicles/tractor';
import { createInputState, type InputState, type IView, type Settings } from '../core/context';
import { InputManager, PlayerController } from '../player';
import { createIconProvider, Renderer, simTransportFeed } from '../render';
import { GroundItemRenderer } from '../render/groundItems';
import { FallingTreeRenderer } from '../render/fallingTrees';
import { FallingTrees } from '../game/fallingTrees';
import { MobRenderer } from '../render/mobs';
import { NightlifeFx } from '../render/nightlifeFx';
import { critters, darkOf, type Critter, type NightEnv } from '../sim/nightlife';
import { NPCS } from '../npcs/data';
import { loadNpcArt } from '../render/npcs/art';
import { NPC_ART } from '../render/npcs/artManifest';
import { NpcRenderer } from '../render/npcs/npcRenderer';
import type { WorldSave } from '../save/document';
import { GameUI } from '../ui/gameUI';
import type { UIRoot } from '../ui/kit/root';
import { registerStationScreens } from '../ui/screens/furnace';
import type { WorkerPool } from '../world';
import { AmbienceProbe } from './ambience';
import {
  applyStructureHide,
  blockUnder,
  drinkElixir,
  extendRoadMove,
  followRide,
  hiddenStructureCells,
  PLAYER_ROAD_HALF,
  registerDistillRig,
  PLAYER_ROAD_HEIGHT,
  showRodAura,
  tractorRoadFactor,
  TRACTOR_ROAD_HALF,
  TRACTOR_ROAD_HEIGHT,
  walkRoadFactor,
} from './gameWiring';
import { clampFrameDt, FixedStep } from './loop';
import { GameState } from './state';

/** Milliseconds of chunk work per frame while playing, and while the loading screen hides the world. */
export const STREAM_BUDGET_MS = 4;
export const LOADING_BUDGET_MS = 14;
/** Chunks around the player that must be meshed before play starts (Chebyshev radius in chunks). */
export const READY_RADIUS = 2;
/** While nothing moves (paused, held, or a window covering the whole view) the world is redrawn this often at most. */
export const STILL_REDRAW_MS = 1000;
/** Frames drawn after the view was invalidated (a resize clears the canvas once the renderer catches up). */
const DIRTY_FRAMES = 3;
/** While a window is open, how often to check whether it covers the whole view. */
const COVER_CHECK_MS = 700;

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

/** Fixture blocks (src/content/areas/tavern_fixtures.ts) and the NPC role each one speaks as. */
const FIXTURE_ROLES: Readonly<Record<string, 'board' | 'clock' | 'jukebox' | 'party'>> = { quest_board: 'board', wall_clock: 'clock', jukebox: 'jukebox', party_button: 'party' };

export class Game {
  readonly state: GameState;
  readonly input: InputState = createInputState();
  readonly renderer: Renderer;
  /** The animals' models, drawn into the renderer's scene (updated before every render). */
  readonly mobRenderer: MobRenderer;
  /** The tavern's people as pixel sprites. */
  readonly npcRenderer: NpcRenderer;
  /** Items lying in the world, one instanced draw per kind. */
  readonly itemRenderer: GroundItemRenderer;
  /** Trees on their way down (game/fallingTrees.ts) and their drawing. */
  readonly trees: FallingTrees;
  readonly treeRenderer: FallingTreeRenderer;
  /** Jar fills, wellsprings and items on pedestals and altars (src/render/magic). */
  readonly magicRenderer: MagicRenderer;
  /** Turning cogs, links, arms and pistons of the workshop (src/render/workshop). */
  readonly workshopRenderer: WorkshopRenderer;
  readonly inputManager: InputManager;
  readonly ui: GameUI;
  readonly controller: PlayerController;
  /** Tractors (docs/api/tractor.md): their state, the driving controls, model and HUD. */
  readonly vehicles: VehicleManager;
  /** Essentia & Research (docs/api/magic.md): research, jars, the land's drawn essentia. */
  readonly magic: Magic;
  /** The Bronze workshop pieces (docs/api/workshop.md): cranks, shafts, belts, mechanical stations. */
  readonly workshop: Workshop;
  private readonly tractorRenderer: TractorRenderer;
  private readonly vehicleHud: VehicleHud;
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
  /**
   * Set by the app while the world must not run (the graphics were lost, frames keep failing): no controls and no
   * ticks, as if paused, without opening the pause menu.
   */
  held = false;
  /** Frames still to draw whatever happens (after a pause, a resize, a settings change, a restored context). */
  private dirtyFrames = DIRTY_FRAMES;
  private wasStill = false;
  private lastDraw = 0;
  private nightlifeFx!: NightlifeFx;
  private readonly nightList: Critter[] = [];
  private nightEnv!: NightEnv;
  /** An opaque window covers the whole view (phone screens): the world behind it is not redrawn every frame. */
  private covered = false;
  /** Photo mode asked for a shot: saved from the next rendered frame. */
  private shotPending = false;
  private coverCheckedAt = -Infinity;
  private readonly offs: (() => void)[] = [];
  constructor(opts: GameOptions) {
    const { state, settings, root } = opts;
    state.player.assist.magnet = settings.itemMagnet;
    state.player.assist.lootFilter = settings.lootFilter;
    this.state = state;
    this.settings = settings;
    this.pool = opts.pool;
    const { bus, world, player, clock, sim, survival, objectives } = state;
    this.offs.push(collectLeafDrops(bus, player));
    // Vehicles, Magic and the Workshop live in GameState (headless, persisted there); the browser adds renderers and screens.
    this.vehicles = state.vehicles;
    this.magic = state.magic;
    this.workshop = state.workshop;
    setCraftGate(state.restoration.gate((id) => this.magic.craftGate(id)));
    this.offs.push(() => setCraftGate(null));

    // Throws a clear error without WebGL2; the app turns it into the friendly message.
    this.renderer = new Renderer(opts.app, world, bus, clock, settings);
    this.renderer.setWeather(state.weather.state);
    // Items and fluids in pipes (spec 16): the renderer reads the simulation's transport snapshot every frame.
    this.renderer.setTransport(simTransportFeed(sim));
    this.mobRenderer = new MobRenderer(this.renderer, world);
    this.npcRenderer = new NpcRenderer(this.renderer);
    void loadNpcArt(NPC_ART, Object.fromEntries(NPCS.map((n) => [n.id, n.scale])));
    this.itemRenderer = new GroundItemRenderer(this.renderer, world);
    this.treeRenderer = new FallingTreeRenderer(this.renderer, (p) => this.renderer.spawnParticle(p));
    this.trees = new FallingTrees(world, player, bus, { persist: world, autoBuck: () => this.settings.autoBuck, treeDamage: () => this.settings.treeDamage, victims: state.mobs, reduceMotion: () => this.settings.reduceMotion });
    this.magicRenderer = new MagicRenderer(this.renderer, world, this.magic);
    this.workshopRenderer = new WorkshopRenderer(this.renderer);
    try {
      this.inputManager = new InputManager({
        container: opts.app,
        touchLayer: root.layers.touch,
        settings,
        state: this.input,
        bus,
        // The touch quick menu reads these each frame (the controller is created just below, before any frame runs).
        quickState: () => ({ dead: state.player.dead, photo: this.controller?.photo.active ?? false, emote: this.controller?.emotes.kind ?? null }),
      });
      this.ui = new GameUI(root, {
        bus,
        input: this.input,
        settings,
        world,
        player,
        clock,
        objectives,
        survival,
        journal: state.journal,
        achievements: state.achievements,
        sim,
        weather: () => state.weather.state,
        releasePointer: () => this.inputManager.releasePointerCapture(),
        pause: {
          onSettingsChange: opts.onSettingsChange,
          onQuit: opts.onQuit,
          dev: { get: () => state.mode === 'dev', set: (on) => state.setMode(on ? 'dev' : 'survival') },
        },
      });
      this.ui.setIconProvider(createIconProvider());
      registerStationScreens(this.ui, sim);
      this.ui.registerScreen('workshop', (_request, ctx) => createWorkshopScreen(ctx));
      this.ui.registerScreen('jobs', (request, ctx) => createJobsScreen(ctx, state.npcs, request.type === 'jobs' ? request.person : undefined));
      this.ui.registerScreen('notebook', (request, ctx) => createNotebookScreen(ctx, this.magic.notebook(), request.type === 'notebook' && request.table === true));
      this.ui.registerScreen('rune_desk', (request, ctx) => createDeskScreen(ctx, this.magic.desk(request.x, request.y, request.z, request.type === 'rune_desk' && request.bench === true), request.type === 'rune_desk' && request.bench === true));
      registerDistillRig(this.ui);
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
      this.controller = new PlayerController({ world, bus, player, view, input: wrapIntentSource(this.inputManager, this.vehicles), settings, state: this.input, animals: state.mobs, talk: (ox, oy, oz, dx, dy, dz) => state.npcs.talk(ox, oy, oz, dx, dy, dz), transport: sim, brew: sim, hands: sim, jukeboxOn: () => state.npcs.jukeboxOn });
      this.vehicles.bindPhysics(this.controller.physics);
      this.armRoadSpeed();
      this.armElixirDrink();
      this.controller.interaction.treeChop = (hit) => this.trees.chop(hit);
      this.controller.fallenAim = (o, d, maxDist) => this.trees.aimHit(o, d, maxDist);
      this.controller.interaction.beforeUse = (hit) => {
        // Picking a stop for a resident's job (docs/api/jobs.md): this Use sets it.
        if (state.npcs.pickingStop) return state.npcs.jobPick(hit) ? 'screen' : null;
        if (hit) {
          const held = player.heldStack();
          const shop = this.workshop.use(hit.x, hit.y, hit.z, held, (n) => player.consumeHeld(n));
          if (shop !== null) return shop;
        }
        if (!hit && player.heldStack()?.item === GOGGLES) {
          bus.emit('ui:open', { screen: { type: 'workshop' } });
          return 'screen';
        }
        // The tavern's fixtures are blocks: the quest board and the wall clock talk when used.
        const fixture = hit ? FIXTURE_ROLES[hit.block.key] : undefined;
        if (fixture && state.npcs.useFixture(fixture) !== null) return 'worked';
        const repaired = state.restoration.use(hit);
        if (repaired !== null) return repaired;
        const explored = state.exploration.use(hit, player.heldStack());
        if (explored !== null) return explored;
        return this.magic.use(hit ? { x: hit.x, y: hit.y, z: hit.z, block: hit.block, face: hit.face } : null);
      };
      state.exploration.teleport = (x, y, z) => this.controller.teleport(x, y, z);
      this.nightlifeFx = new NightlifeFx((p) => renderer.spawnParticle(p));
      this.nightEnv = { seed: world.seed, dark: 0, raining: false, timeS: 0, biomeAt: (x, z) => world.biomeAt(x, z), surfaceY: (x, z) => world.surfaceY(Math.floor(x), Math.floor(z)) };
      this.tractorRenderer = new TractorRenderer(this.renderer, world);
      this.vehicleHud = new VehicleHud(root.layers.hud, () => this.input.touch);
      this.audio = new AudioEngine(bus, settings);
      this.ambience = new AmbienceProbe(world, player, clock, state.weather.state);
    } catch (err) {
      this.itemRenderer.dispose();
    this.trees.dispose();
    this.treeRenderer.dispose();
      this.magicRenderer.dispose();
      this.workshopRenderer.dispose();
      this.mobRenderer.dispose();
    this.npcRenderer.dispose();
      this.renderer.dispose();
      throw err;
    }
    if (state.resumed) {
      const last = [...state.journal.entries].reverse().find((e) => e.kind !== 'death');
      bus.emit('toast', { text: resumeLine(state.clock.day, state.objectives.current?.title ?? null, last), kind: 'info' });
    }
    this.offs.push(
      bus.on('photo:snap', () => (this.shotPending = true)),
      bus.on('photo:mode', ({ on }) => root.el.classList.toggle('hw-root--photo', on)),
    );
    const onKey = (down: boolean) => (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyF') this.vehicles.setWorkKey(down);
      else if (e.code === 'KeyR' && down && !e.repeat) this.vehicles.pressSwapKey();
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    this.offs.push(() => window.removeEventListener('keydown', keyDown), () => window.removeEventListener('keyup', keyUp));
    const invalidate = (): void => this.invalidateView();
    window.addEventListener('resize', invalidate);
    this.offs.push(
      () => window.removeEventListener('resize', invalidate),
      bus.on('settings:changed', () => {
        // Spec 19.3: the difficulty applies to the automatons and the player's side together, at once.
        state.setDifficulty(settings.difficulty);
        state.player.assist.magnet = settings.itemMagnet;
        state.player.assist.lootFilter = settings.lootFilter;
        invalidate();
      }),
      bus.on('ui:opened', () => {
        this.coverCheckedAt = -Infinity;
        invalidate();
      }),
      bus.on('ui:closed', () => {
        this.covered = false;
        invalidate();
      }),
    );
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

  /** Fireflies, bats and owls (src/sim/nightlife.ts) around the player, drawn as particles. */
  private drawNightlife(dt: number): void {
    if (dt <= 0) return;
    const { world, clock, weather, player } = this.state;
    this.nightEnv.dark = darkOf(clock.sunlight());
    this.nightEnv.timeS = clock.worldTimeS;
    this.nightEnv.raining = weather.state.precipitation === 'rain' && weather.state.intensity > 0.2;
    this.nightlifeFx.update(dt, this.nightEnv.dark < 0.15 ? [] : critters(this.nightEnv, player.position.x, player.position.z, this.nightList));
  }

  /** A frame while the loading screen is up: stream chunks and draw behind it, nothing moves. */
  loadingFrame(rawDt: number): void {
    if (this.disposed) return;
    const dt = clampFrameDt(rawDt);
    const p = this.state.player;
    this.state.world.update(p.position.x, p.position.z, this.settings.renderDistance, LOADING_BUDGET_MS);
    this.renderer.setView(p.position.x, p.eyeY, p.position.z, p.yaw, p.pitch);
    this.mobRenderer.update(0, this.state.mobs.views(1));
    this.itemRenderer.update(0, p.ground.items);
    this.renderer.render(dt);
  }

  /** Draw the world on the next few frames even if nothing moves (a resize, a restored graphics context). */
  invalidateView(): void {
    this.dirtyFrames = DIRTY_FRAMES;
  }

  /** True while the world is not running: the pause menu, or held by the app. */
  get stopped(): boolean {
    return this.input.paused || this.held;
  }

  /** Nothing much is happening (no walking, no mining) or a window is open: a good moment for an autosave. */
  get calm(): boolean {
    if (this.ui.isOpen) return true;
    const v = this.state.player.velocity;
    return Math.hypot(v.x, v.z) < 0.1 && !this.controller.interaction.mining;
  }

  /** One animation frame of play. `rawDt` in seconds; clamped to 0.1. `now` (ms) paces redraws while still. */
  frame(rawDt: number, now = performance.now()): void {
    if (this.disposed) return;
    const dt = clampFrameDt(rawDt);
    const { state } = this;
    const paused = this.stopped;
    if (paused) {
      // Keep the input layer in step (it releases everything while paused) without moving the player.
      this.inputManager.frame(dt);
    } else {
      const tractor = this.vehicles.driving;
      const tractorFrom = tractor ? { x: tractor.x, z: tractor.z, y: tractor.y } : null;
      this.controller.update(dt);
      if (tractor && tractorFrom && this.vehicles.driving === tractor) this.boostTractor(tractor, tractorFrom);
      if (followRide(state.player, this.workshop.onRide())) this.controller.physics.reset();
      const ticks = this.step.advance(dt);
      for (let i = 0; i < ticks; i++) this.tickOnce();
    }
    const p = state.player;
    // Nothing moves while paused: chunks stream again on resume.
    if (!paused) state.world.update(p.position.x, p.position.z, this.settings.renderDistance, STREAM_BUDGET_MS);
    this.audio.setListener(p.position.x, p.eyeY, p.position.z, p.yaw);
    this.audio.setAmbience(this.ambience.update(dt));
    this.showAnimalName();
    this.showStationName();
    // The aura line is separate from the crosshair name, including when that name is a block and when the rod reads null.
    showRodAura(this.ui.hud, this.magic.rodReading());
    this.ui.hud.setScan(this.magic.scanProgress(), this.magic.scanResult());
    this.vehicleHud.update(this.vehicles.status());
    this.ui.frame(dt);
    const motions = this.workshop.contra.motions();
    applyStructureHide(this.renderer.scene.getObjectByName('chunks'), hiddenStructureCells(motions, this.workshop.contra.vacating()));
    if (this.shouldDraw(paused, now)) {
      // Animals are interpolated between the last two ticks; frozen in place while paused.
      this.mobRenderer.setBolts(state.mobs.projectiles(paused ? 1 : this.step.alpha)); // ember bolts in flight
      this.mobRenderer.update(paused ? 0 : dt, state.mobs.views(paused ? 1 : this.step.alpha));
      this.npcRenderer.reduceMotion = this.settings.reduceMotion;
      this.npcRenderer.update(paused ? 0 : dt, state.npcs.views(), state.clock.sunlight(), state.player.position);
      this.tractorRenderer.update(paused ? 0 : dt, this.vehicles.views());
      this.itemRenderer.update(paused ? 0 : dt, state.player.ground.items, state.player.collectors.running);
      this.treeRenderer.update(this.trees.trees(), this.trees.logs());
      const pp = state.player.position;
      this.magicRenderer.update(paused ? 0 : dt, this.magic.jarFills(), this.magic.nodesAround(pp.x, pp.z, 3), this.magic.displays(), pp);
      this.workshopRenderer.update(paused ? 0 : dt, this.workshop.view(pp.x, pp.z), motions);
      this.drawNightlife(paused ? 0 : dt);
      this.renderer.render(paused ? 0 : dt);
      if (this.shotPending) {
        this.shotPending = false;
        const canvas = this.renderer.canvas;
        void saveShot(canvas, state.clock.day, state.clock.phase).then((ok) => {
          if (ok) this.state.bus.emit('toast', { text: 'Photo saved', kind: 'good' });
        });
      }
      this.lastDraw = now;
    }
    this.frames++;
  }

  /**
   * Whether to draw the world this frame. While paused the scene does not change: it is drawn as the pause starts,
   * when invalidated, and then about once a second. Behind a window that covers the whole view (the phone screens)
   * the simulation keeps running but nobody sees the world, so it is drawn just as rarely.
   */
  private shouldDraw(paused: boolean, now: number): boolean {
    const still = paused || this.coversView(now);
    if (still !== this.wasStill) {
      this.wasStill = still;
      this.dirtyFrames = Math.max(this.dirtyFrames, 1);
    }
    if (this.dirtyFrames > 0) {
      this.dirtyFrames--;
      return true;
    }
    return !still || now - this.lastDraw >= STILL_REDRAW_MS;
  }

  /** An open window hides the whole view (every probe point lands on it): checked on opening and then now and then. */
  private coversView(now: number): boolean {
    if (!this.ui.isOpen) return false;
    if (now - this.coverCheckedAt < COVER_CHECK_MS) return this.covered;
    this.coverCheckedAt = now;
    this.covered = windowCoversView();
    return this.covered;
  }

  private readonly inspectProbe: InspectProbe = {
    workshop: (x, y, z) => this.workshop.describe(x, y, z),
    furnace: (x, y, z) => {
      const f = this.state.sim.furnaceView(x, y, z);
      return f ? { name: f.spec.name, tempC: f.tempC, burning: f.burning, burnTimeLeftS: f.burnTimeLeftS } : null;
    },
    machine: (x, y, z) => this.state.sim.machineView(x, y, z),
  };

  /** Magic names under the crosshair: jars, pedestals and the altar, servants, a held rod's reading, the lens. */
  private magicLabel(x: number, y: number, z: number, key: string): string | null {
    const m = this.magic;
    return m.mirrorText(x, y, z) ?? m.jarText(x, y, z) ?? m.altarText(x, y, z) ?? m.servantText(x, y, z) ?? m.lensLabel(key) ?? m.rodReading();
  }

  /** A drop lying under the aim: the crosshair names it first (the name and rarity last shown, as "text|rarity"). */
  private namedDrop: string | null = null;
  /** Stands in for the station name while a drop is shown, so the station's own name comes back when the drop goes. */
  private readonly dropMark = '\u0000drop';
  private readonly aimScratch = { x: 0, y: 0, z: 0 };
  /** The crosshair names the hand station under it with what it is doing ("Chopping Block - oak log 2/3 strokes"). */
  private namedStation: string | null = null;
  private showStationName(): void {
    const drop = this.controller.targetAnimal === null ? this.dropUnderAim() : null;
    if (drop !== null) {
      const key = `${drop.text}|${drop.rarity ?? ''}`;
      if (key !== this.namedDrop) {
        this.namedDrop = key;
        this.ui.setTargetName(drop.text, drop.rarity);
      }
      this.namedStation = this.dropMark;
      return;
    }
    this.namedDrop = null;
    let label: string | null = null;
    const hit = this.controller.targetAnimal === null ? this.controller.target : null;
    if (hit && hit.block.handStation !== null) label = this.state.sim.handView(hit.x, hit.y, hit.z)?.label ?? null;
    else if (hit && (label = this.magicLabel(hit.x, hit.y, hit.z, hit.block.key)) !== null) { /* magic */ }
    else if (!hit && (label = this.magic.rodReading()) !== null) { /* rod reading at the sky */ }
    else if (hit && this.state.player.inventory.has(GOGGLES)) label = inspect(this.inspectProbe, hit.x, hit.y, hit.z);
    else if (hit && isKinetic(hit.block.key)) label = hit.block.name;
    if (label === this.namedStation) return;
    this.namedStation = label;
    this.ui.setTargetName(label);
  }

  /** The drop the view is aimed at, nearer than the block behind it, as the crosshair names it; null for none. */
  private dropUnderAim(): { text: string; rarity: string | null } | null {
    const p = this.state.player;
    if (p.dead || p.ground.items.length === 0) return null;
    const d = p.viewDir(this.aimScratch);
    const hit = this.controller.target;
    const e = aimGroundItem(p.ground.items, p.position.x, p.eyeY, p.position.z, d.x, d.y, d.z, REACH, hit ? hit.distance : Infinity);
    return e ? dropLabel(e.item, e.count) : null;
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

  /**
   * Asphalt speeds up walking (not sprint, swim or flight) and a driven tractor. The physics and the tractor
   * integrator have no speed hook, so the extra slice of the move they already took is swept here.
   */
  private armRoadSpeed(): void {
    const physics = this.controller.physics;
    const step = physics.step.bind(physics);
    physics.step = (dt, input) => {
      const player = this.state.player;
      const pos = player.position;
      const under = blockUnder(this.state.world, pos.x, pos.y, pos.z);
      const x0 = pos.x;
      const z0 = pos.z;
      const result = step(dt, input);
      const factor = walkRoadFactor(under, {
        onGround: player.onGround,
        sprinting: result.sprinting,
        inLiquid: physics.inLiquid,
        flying: player.flying && player.dev,
      });
      if (factor !== 1) result.walked += extendRoadMove(this.state.world, pos, x0, z0, factor, PLAYER_ROAD_HALF, PLAYER_ROAD_HEIGHT);
      return result;
    };
  }

  /** The tractor already moved at 1x inside the controller. Add the asphalt remainder and put the driver back in the seat. */
  private boostTractor(tractor: Tractor, from: { x: number; y: number; z: number }): void {
    const moved = tractor.x !== from.x || tractor.z !== from.z;
    const factor = tractorRoadFactor(blockUnder(this.state.world, from.x, from.y, from.z), moved);
    if (factor === 1) return;
    extendRoadMove(this.state.world, tractor, from.x, from.z, factor, TRACTOR_ROAD_HALF, TRACTOR_ROAD_HEIGHT);
    const seat = seatOf(tractor);
    const p = this.state.player.position;
    p.x = seat.x;
    p.y = seat.y;
    p.z = seat.z;
  }

  /** An elixir is not a drink item. Use that nothing else claimed drinks it through elixirGrant. */
  private armElixirDrink(): void {
    const interaction = this.controller.interaction;
    const use = interaction.use.bind(interaction);
    interaction.use = (hit, forcePlace) => {
      const outcome = use(hit, forcePlace);
      if (outcome !== 'none') return outcome;
      const drank = drinkElixir(this.state.player);
      switch (drank.kind) {
        case 'no':
          return outcome;
        case 'refused':
          return 'refused';
        case 'drunk':
          this.renderer.triggerSwing();
          return 'drank';
        default: {
          const never: never = drank;
          return never;
        }
      }
    };
  }

  /** Runs `n` fixed simulation ticks right now (debug / tests). */
  tick(n: number): void {
    for (let i = 0; i < n; i++) this.tickOnce();
  }

  /** One fixed step: the game state, then leaf decay (world/leafDecay.ts) beside the water ticks. */
  private tickOnce(): void {
    this.state.tick(DT);
    this.state.world.leaves.tick();
    this.trees.tick(DT);
  }

  toSave(): WorldSave {
    return this.state.toSave();
  }

  /** The save as JSON text (one serialisation, no deep copies). */
  toSaveJson(): string {
    return this.state.toSaveJson();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.vehicleHud.dispose();
    this.tractorRenderer.dispose();
    this.ui.dispose();
    this.controller.dispose();
    this.inputManager.dispose();
    this.audio.dispose();
    this.itemRenderer.dispose();
    this.trees.dispose();
    this.treeRenderer.dispose();
    this.magicRenderer.dispose();
    this.workshopRenderer.dispose();
    this.mobRenderer.dispose();
    this.npcRenderer.dispose();
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

/** Points (fractions of the viewport) that must all land on an opaque window for it to count as covering the view. */
const COVER_PROBES: readonly (readonly [number, number])[] = [[0.03, 0.03], [0.97, 0.03], [0.5, 0.5], [0.03, 0.97], [0.97, 0.97]];

function windowCoversView(): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const [fx, fy] of COVER_PROBES) {
    const el = document.elementFromPoint(fx * w, fy * h);
    const win = el?.closest<HTMLElement>('.hw-window');
    if (!win || !opaque(win)) return false;
  }
  return true;
}

function opaque(el: HTMLElement): boolean {
  const bg = getComputedStyle(el).backgroundColor;
  const m = /rgba?\(([^)]+)\)/.exec(bg);
  if (!m) return false;
  const parts = m[1].split(',').map((v) => Number.parseFloat(v));
  return parts.length < 4 || parts[3] >= 0.98;
}
