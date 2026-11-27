/**
 * The application shell: title screen -> New World / Continue -> loading -> play, and back to the title on
 * "Save and quit". Owns the save slot (settings + the world in progress), autosaving, the animation frame loop,
 * audio unlocking on the first gestures and the friendly notices when the game cannot run.
 */
import workerSource from 'virtual:worker';
import type { Settings } from '../core/context';
import { parseGameMode, type GameMode } from '../core/gameMode';
import { SaveSlot, type WorldSave } from '../save/document';
import type { SaveResult } from '../save/storage';
import { UIRoot } from '../ui/kit/root';
import type { SaveTools } from '../ui/menus/settings';
import { TitleScreen } from '../ui/menus/title';
import { WorkerPool } from '../world';
import { installDebugHandle } from './debug';
import { diag, diagOn, initDiag, playerBrief } from './diag';
import { Game } from './game';
import { deliver } from './photo';
import { hasWebGL2, injectAppCss, LoadingScreen, NO_WEBGL_NOTICE, showNotice } from './screens';
import { GameState, seedFrom } from './state';
import { agoText, FrameGuard, Troubles } from './troubles';

/** Seconds of play between autosaves. */
export const AUTOSAVE_INTERVAL_S = 30;
/** A due autosave waits for a calm moment (standing still, a screen open) at most this many seconds more. */
export const AUTOSAVE_GRACE_S = 10;
/** Settings are written this long after the last change (sliders fire on every step). */
const SETTINGS_SAVE_DELAY_MS = 400;
export const VERSION = 'v0.1.0';

export type AppPhase = 'title' | 'loading' | 'playing' | 'unsupported';

export class App {
  readonly root: UIRoot;
  readonly slot: SaveSlot;
  readonly settings: Settings;
  phase: AppPhase = 'title';
  game: Game | null = null;
  /** Result of the last save attempt (debug / tests). */
  lastSave: { ok: boolean; reason?: string; at: number } | null = null;
  /** The world in the save slot as JSON text (what Continue loads and every save writes), or null. */
  private worldText: string | null;
  /** Mode of the world in the slot (named on the title's Continue button). */
  private savedMode: GameMode;
  private savedAge: number | undefined;
  private title: TitleScreen | null = null;
  private readonly loading = new LoadingScreen();
  private rafId = 0;
  private lastTime = 0;
  private sinceSave = 0;
  private settingsTimer = 0;
  private warnedVolatile = false;
  /** Frames of play since enterPlay (diagnostics only): the first ones are sampled one by one, then a heartbeat. */
  private diagFrames = 0;
  private readonly offs: (() => void)[] = [];
  private readonly guard = new FrameGuard();
  private readonly troubles: Troubles;

  constructor(readonly app: HTMLElement) {
    initDiag();
    injectAppCss();
    this.root = new UIRoot(app);
    this.slot = new SaveSlot();
    const doc = this.slot.read();
    this.settings = { ...doc.settings };
    this.worldText = doc.world ? JSON.stringify(doc.world) : null;
    this.savedMode = parseGameMode(doc.world?.mode);
    this.savedAge = doc.world?.objectives?.age;
    diag('app.boot', () => ({
      persistent: this.slot.persistent,
      slotProblem: this.slot.lastProblem ?? null,
      slotHeld: this.slot.held,
      hasSavedWorld: this.worldText !== null,
      savedWorldChars: this.worldText?.length ?? 0,
      settings: { ...this.settings },
      webgl2: hasWebGL2(),
    }));
    this.troubles = new Troubles(this.root.el, {
      game: () => this.game,
      playing: () => this.phase === 'playing',
      save: () => this.save(),
      savedAt: () => this.slot.store.savedAt(),
      persistent: () => this.slot.persistent,
      quit: () => {
        this.stopGame();
        this.showTitle();
      },
      resume: () => {
        this.guard.reset();
        this.lastTime = performance.now();
        this.loop();
      },
      stopLoop: () => cancelAnimationFrame(this.rafId),
    });
    installDebugHandle(this);
    this.listen();
    if (!hasWebGL2()) {
      this.phase = 'unsupported';
      showNotice(this.root.el, NO_WEBGL_NOTICE);
      return;
    }
    this.showTitle();
    if (this.slot.lastProblem) this.root.toasts.show({ text: this.slot.lastProblem, kind: 'bad' });
  }

  /** A saved world can be continued. */
  get hasSave(): boolean {
    return this.worldText !== null;
  }

  /** The title treats the slot as taken (Continue shown, New World held to confirm) also while it keeps an unreadable save. */
  private get slotTaken(): boolean {
    return this.hasSave || this.slot.held;
  }

  // ---- title -------------------------------------------------------------------------------------------------

  showTitle(): void {
    diag('app.phase', () => ({ from: this.phase, to: 'title', hasSave: this.hasSave, slotTaken: this.slotTaken }));
    this.phase = 'title';
    if (!this.title) {
      this.title = new TitleScreen(this.root, {
        hasSave: this.slotTaken,
        savedMode: this.savedMode,
        stage: this.savedAge,
        settings: this.settings,
        version: VERSION,
        onNewWorld: (seed, mode) => this.newWorld(seed, mode),
        onContinue: () => this.continueWorld(),
        onSettingsChange: (s, key) => this.changeSettings(s, key),
        saves: this.saveTools(),
      });
    }
    this.title.setStage(this.slotTaken ? this.savedAge : 0);
    this.title.setHasSave(this.slotTaken, this.savedMode);
    this.title.show();
  }

  private leaveTitle(): void {
    // Rebuilt next time: it copies the settings when it is created.
    this.title?.dispose();
    this.title = null;
  }

  // ---- starting a world --------------------------------------------------------------------------------------

  newWorld(seedText: string | null, mode: GameMode = 'survival'): void {
    if (this.phase !== 'title') return;
    const seed = seedFrom(seedText);
    this.start('Generating world', seedText ? `Seed "${seedText}" (${seed})` : `Seed ${seed}`, (pool) => GameState.create(seed, seedText, { pool, difficulty: this.settings.difficulty, mode }));
  }

  continueWorld(): void {
    if (this.phase !== 'title') return;
    if (!this.worldText) {
      // The slot holds a save this version cannot open: say so again rather than do nothing.
      if (this.slot.lastProblem) this.root.toasts.show({ text: this.slot.lastProblem, kind: 'bad', durationMs: 7000 });
      return;
    }
    const save = JSON.parse(this.worldText) as WorldSave;
    diag('app.continue', () => ({ seed: save.seed, savedPlayer: save.player, playTimeS: save.playTimeS, chars: this.worldText?.length ?? 0 }));
    const seedLine = save.seedText ? `Seed "${save.seedText}"` : `Seed ${save.seed}`;
    this.start('Loading your world', seedLine, (pool) => GameState.restore(save, { pool, difficulty: this.settings.difficulty }));
  }

  private start(label: string, seedLine: string, makeState: (pool: WorkerPool) => GameState): void {
    this.leaveTitle();
    diag('app.phase', () => ({ from: this.phase, to: 'loading', label, seedLine }));
    this.phase = 'loading';
    this.loading.show(this.root.layers.menu, label, seedLine);
    const startedAt = performance.now();
    // Let the loading screen paint before the heavy, synchronous part (textures, the first chunks).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const pool = new WorkerPool(workerSource);
        let state: GameState | null = null;
        try {
          state = makeState(pool);
          diag('app.state_made', () => ({ ms: Math.round(performance.now() - startedAt), player: playerBrief(state!.player), ticks: state!.ticks }));
          this.game = new Game({
            app: this.app,
            root: this.root,
            settings: this.settings,
            state,
            pool,
            onQuit: () => this.saveAndQuit(),
            onSettingsChange: (s, key) => this.changeSettings(s, key),
            saves: this.inGameSaveTools(),
          });
        } catch (err) {
          state?.dispose();
          pool.dispose();
          this.failStart(err);
          return;
        }
        this.game.bus.on('game:paused', ({ paused }) => {
          diag('game.paused', () => ({ paused, player: playerBrief(this.game!.state.player), ticks: this.game!.state.ticks }));
          if (paused) this.save();
        });
        this.troubles.attach(this.game);
        this.guard.reset();
        this.lastTime = performance.now();
        this.loop();
      }),
    );
  }

  private failStart(err: unknown): void {
    console.warn('[app] the world could not start', err);
    diag('app.start_failed', () => ({ error: err instanceof Error ? `${err.name}: ${err.message}` : String(err), stack: err instanceof Error ? err.stack : undefined }));
    this.loading.hide();
    const message = err instanceof Error ? err.message : String(err);
    if (/webgl/i.test(message)) {
      this.phase = 'unsupported';
      showNotice(this.root.el, { ...NO_WEBGL_NOTICE, detail: message });
      return;
    }
    this.showTitle();
    this.root.toasts.show({ text: 'That world could not be started. Your save was left as it was.', kind: 'bad', durationMs: 6000 });
  }

  private enterPlay(): void {
    const game = this.game;
    if (!game) return;
    diag('app.phase', () => ({ from: this.phase, to: 'playing', loadingFrames: game.frames, player: playerBrief(game.state.player) }));
    this.diagFrames = 0;
    this.phase = 'playing';
    this.loading.hide();
    this.sinceSave = 0;
    // Pointer lock wants a recent gesture: the New World / Continue tap usually still counts. A refusal is harmless.
    if (!game.input.touch) void game.inputManager.requestPointerCapture();
    const player = game.state.player;
    if (player.dead) game.bus.emit('player:death', { cause: player.deathCause ?? 'cold' });
    this.save();
  }

  // ---- the frame loop ----------------------------------------------------------------------------------------

  private loop(): void {
    cancelAnimationFrame(this.rafId);
    const frame = (now: number): void => {
      const game = this.game;
      if (!game || this.troubles.broken) return;
      this.rafId = requestAnimationFrame(frame);
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      try {
        if (this.phase === 'loading') {
          game.loadingFrame(dt);
          this.loading.set(game.loadingProgress);
          if (game.ready) this.enterPlay();
        } else if (this.phase === 'playing') {
          game.frame(dt, now);
          if (diagOn()) this.diagSample(game, dt);
          if (!game.stopped) {
            this.sinceSave += Math.min(dt, 0.1);
            const due = this.sinceSave >= AUTOSAVE_INTERVAL_S;
            if (due && (game.calm || this.sinceSave >= AUTOSAVE_INTERVAL_S + AUTOSAVE_GRACE_S)) this.save();
          }
        }
        this.guard.ok();
      } catch (err) {
        console.error('[app] frame failed', err);
        diag('frame.failed', () => ({ phase: this.phase, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err), stack: err instanceof Error ? err.stack : undefined }));
        if (this.guard.fail(now)) this.troubles.halt(err);
      }
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Diagnostics: every one of the first 45 frames of play (where position drift after Continue shows), then every 300th. */
  private diagSample(game: Game, dt: number): void {
    const n = this.diagFrames++;
    if (n >= 45 && n % 300 !== 0) return;
    diag('frame.sample', () => ({
      n,
      dtMs: Math.round(dt * 1000 * 10) / 10,
      frames: game.frames,
      ticks: game.state.ticks,
      paused: game.stopped,
      player: playerBrief(game.state.player),
    }));
  }

  // ---- saving ------------------------------------------------------------------------------------------------

  /** Writes the settings and, while a world is running, the world. Returns whether it reached real storage. */
  save(): boolean {
    this.sinceSave = 0;
    const game = this.game;
    // A world that stopped on repeated failures is never saved again (the fault could go into the save).
    if (this.troubles.broken) return false;
    if (game && (this.phase === 'playing' || this.phase === 'loading')) {
      try {
        this.worldText = game.toSaveJson();
        this.savedMode = game.state.mode;
        this.savedAge = game.state.objectives.age;
      } catch (err) {
        console.error('[app] could not snapshot the world', err);
        diag('save.snapshot_failed', { error: String(err), phase: this.phase });
        return false;
      }
    }
    const result = this.slot.writeText({ ...this.settings }, this.worldText);
    this.lastSave = { ok: result.ok, reason: result.ok ? undefined : result.reason, at: Date.now() };
    diag('save.write', () => ({
      ok: result.ok,
      reason: result.ok ? null : result.reason,
      phase: this.phase,
      chars: this.worldText?.length ?? 0,
      persistent: this.slot.persistent,
      player: game ? playerBrief(game.state.player) : null,
      ticks: game?.state.ticks ?? null,
    }));
    if (result.ok) {
      game?.bus.emit('game:saved', {});
      return true;
    }
    this.saveFailed(result, game !== null);
    return false;
  }

  private saveFailed(result: Exclude<SaveResult, { ok: true }>, playing: boolean): void {
    const toasts = this.root.toasts;
    if (result.reason === 'quota') {
      const kept = result.keptAt !== null ? `Your last save (${agoText(result.keptAt, Date.now())}) is still kept.` : 'Progress lasts until this page closes.';
      toasts.show({ text: `Storage is full: this save failed. ${kept}`, kind: 'bad', durationMs: 7000 });
    } else if (!this.warnedVolatile && playing) {
      this.warnedVolatile = true;
      toasts.show({ text: 'This page cannot keep saves: progress lasts until it is closed.', kind: 'warn', durationMs: 6000 });
    }
  }

  saveAndQuit(): void {
    if (!this.game) return;
    diag('app.save_and_quit', () => ({ phase: this.phase, player: playerBrief(this.game!.state.player), ticks: this.game!.state.ticks }));
    this.save();
    this.stopGame();
    this.showTitle();
  }

  /** Tears the running world down without saving (debug reset, failed starts). */
  stopGame(): void {
    cancelAnimationFrame(this.rafId);
    this.loading.hide();
    this.troubles.detach();
    const game = this.game;
    this.game = null;
    game?.dispose();
  }

  /**
   * The save tools while a world is open (pause menu): back up, and go back to the earlier autosave. Going back leaves the running world
   * without saving it again (the pause already saved it, and it becomes the earlier save) and returns to the title, where Continue plays the restored one.
   */
  private inGameSaveTools(): SaveTools {
    const t = this.saveTools();
    return {
      hasWorld: t.hasWorld,
      backUp: t.backUp,
      text: t.text,
      earlier: t.earlier,
      restoreEarlier: () => {
        const msg = t.restoreEarlier?.() ?? 'There is nothing to restore.';
        if (msg.startsWith('Restored')) {
          this.stopGame();
          this.showTitle();
        }
        return msg;
      },
    };
  }

  /** Backing up and restoring the saved world, offered in the title's Settings (see menus/settings.ts SaveTools). */
  private saveTools(): SaveTools {
    const take = (world: WorldSave): void => {
      this.worldText = JSON.stringify(world);
      this.savedMode = parseGameMode(world.mode);
      this.savedAge = world.objectives?.age;
      this.title?.setStage(this.savedAge);
      this.title?.setHasSave(this.slotTaken, this.savedMode);
      // A world that could not be read before no longer holds the slot.
      this.slot.lastProblem = null;
    };
    const restore = (text: string | null, what: string): string => {
      if (text === null) return 'There is nothing to restore.';
      const result = this.slot.importText(text, { ...this.settings });
      if (!result.ok) return result.message;
      take(result.world);
      return result.stored ? `Restored ${what}. Press Continue to play it.` : `Restored ${what} for this visit, but the browser will not keep it after you close the page.`;
    };
    return {
      hasWorld: () => this.slotTaken,
      backUp: async () => {
        const text = this.slot.exportText();
        if (text === null) return 'There is no saved world to back up yet.';
        const day = new Date().toISOString().slice(0, 10);
        const how = await deliver(new Blob([text], { type: 'application/json' }), `hearthwatt-save-${day}.json`, 'Hearthwatt save', true);
        return how === 'failed' ? 'The backup could not be made.' : how === 'shared' ? 'Backup shared.' : 'Backup file saved to your downloads.';
      },
      text: () => this.slot.exportText(),
      restore: (text) => restore(text, 'the backup'),
      earlier: () => {
        const at = this.slot.prevSavedAt();
        return this.slot.hasPrev ? { label: at === null ? 'earlier' : new Date(at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) } : null;
      },
      restoreEarlier: () => restore(this.slot.readPrev(), 'the earlier save'),
    };
  }

  /** Forgets the saved world (debug / tests). */
  deleteSave(): void {
    this.worldText = null;
    this.savedMode = 'survival';
    this.savedAge = undefined;
    this.slot.writeText({ ...this.settings }, null);
    this.title?.setHasSave(this.slotTaken, this.savedMode);
  }

  // ---- settings ----------------------------------------------------------------------------------------------

  changeSettings(next: Settings, _key: keyof Settings): void {
    Object.assign(this.settings, next);
    this.game?.bus.emit('settings:changed', {});
    window.clearTimeout(this.settingsTimer);
    this.settingsTimer = window.setTimeout(() => {
      // Only the settings change here: the world text stays exactly as last saved (never re-taken from live state).
      this.slot.writeText({ ...this.settings }, this.worldText);
    }, SETTINGS_SAVE_DELAY_MS);
  }

  // ---- page events -------------------------------------------------------------------------------------------

  private listen(): void {
    // Audio may only start inside a gesture: unlock it on the earliest events, not on click.
    const unlock = (): void => this.game?.audio.resume();
    for (const type of ['pointerdown', 'touchstart', 'keydown'] as const) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
      this.offs.push(() => window.removeEventListener(type, unlock, { capture: true }));
    }
    const hidden = (): void => {
      if (document.visibilityState !== 'hidden') return;
      if (this.phase !== 'playing' || !this.game || this.troubles.broken) return;
      this.save();
      // Come back to a paused game, not one that kept freezing the player while the phone was in a pocket.
      if (!this.game.ui.isOpen) this.game.bus.emit('ui:open', { screen: { type: 'pause' } });
    };
    const pagehide = (): void => {
      if (this.phase === 'playing') this.save();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pagehide);
    this.offs.push(() => document.removeEventListener('visibilitychange', hidden), () => window.removeEventListener('pagehide', pagehide));
  }
}
