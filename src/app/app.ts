/**
 * The application shell: title screen -> New World / Continue -> loading -> play, and back to the title on
 * "Save and quit". Owns the save slot (settings + the world in progress), autosaving, the animation frame loop,
 * audio unlocking on the first gestures and the friendly notices when the game cannot run.
 */
import workerSource from 'virtual:worker';
import type { Settings } from '../core/context';
import { SaveSlot, type SaveDocument } from '../save/document';
import { UIRoot } from '../ui/kit/root';
import { TitleScreen } from '../ui/menus/title';
import { WorkerPool } from '../world';
import { installDebugHandle } from './debug';
import { Game } from './game';
import { hasWebGL2, injectAppCss, LoadingScreen, NO_WEBGL_NOTICE, showNotice } from './screens';
import { GameState, seedFrom } from './state';

/** Seconds of play between autosaves. */
export const AUTOSAVE_INTERVAL_S = 30;
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
  private doc: SaveDocument;
  private title: TitleScreen | null = null;
  private readonly loading = new LoadingScreen();
  private rafId = 0;
  private lastTime = 0;
  private sinceSave = 0;
  private settingsTimer = 0;
  private warnedVolatile = false;
  private readonly offs: (() => void)[] = [];

  constructor(readonly app: HTMLElement) {
    injectAppCss();
    this.root = new UIRoot(app);
    this.slot = new SaveSlot();
    this.doc = this.slot.read();
    this.settings = { ...this.doc.settings };
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

  get hasSave(): boolean {
    return this.doc.world !== null;
  }

  // ---- title -------------------------------------------------------------------------------------------------

  showTitle(): void {
    this.phase = 'title';
    if (!this.title) {
      this.title = new TitleScreen(this.root, {
        hasSave: this.hasSave,
        settings: this.settings,
        version: VERSION,
        onNewWorld: (seed) => this.newWorld(seed),
        onContinue: () => this.continueWorld(),
        onSettingsChange: (s, key) => this.changeSettings(s, key),
      });
    }
    this.title.setHasSave(this.hasSave);
    this.title.show();
  }

  private leaveTitle(): void {
    // Rebuilt next time: it copies the settings when it is created.
    this.title?.dispose();
    this.title = null;
  }

  // ---- starting a world --------------------------------------------------------------------------------------

  newWorld(seedText: string | null): void {
    if (this.phase !== 'title') return;
    const seed = seedFrom(seedText);
    this.start('Generating world', seedText ? `Seed "${seedText}" (${seed})` : `Seed ${seed}`, (pool) => GameState.create(seed, seedText, { pool }));
  }

  continueWorld(): void {
    if (this.phase !== 'title') return;
    const save = this.doc.world;
    if (!save) return;
    const seedLine = save.seedText ? `Seed "${save.seedText}"` : `Seed ${save.seed}`;
    this.start('Loading your world', seedLine, (pool) => GameState.restore(save, { pool }));
  }

  private start(label: string, seedLine: string, makeState: (pool: WorkerPool) => GameState): void {
    this.leaveTitle();
    this.phase = 'loading';
    this.loading.show(this.root.layers.menu, label, seedLine);
    // Let the loading screen paint before the heavy, synchronous part (textures, the first chunks).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const pool = new WorkerPool(workerSource);
        let state: GameState | null = null;
        try {
          state = makeState(pool);
          this.game = new Game({
            app: this.app,
            root: this.root,
            settings: this.settings,
            state,
            pool,
            onQuit: () => this.saveAndQuit(),
            onSettingsChange: (s, key) => this.changeSettings(s, key),
          });
        } catch (err) {
          state?.dispose();
          pool.dispose();
          this.failStart(err);
          return;
        }
        this.game.bus.on('game:paused', ({ paused }) => {
          if (paused) this.save();
        });
        this.lastTime = performance.now();
        this.loop();
      }),
    );
  }

  private failStart(err: unknown): void {
    console.warn('[app] the world could not start', err);
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
      if (!game) return;
      this.rafId = requestAnimationFrame(frame);
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      try {
        if (this.phase === 'loading') {
          game.loadingFrame(dt);
          this.loading.set(game.loadingProgress);
          if (game.ready) this.enterPlay();
        } else if (this.phase === 'playing') {
          game.frame(dt);
          if (!game.input.paused) {
            this.sinceSave += Math.min(dt, 0.1);
            if (this.sinceSave >= AUTOSAVE_INTERVAL_S) this.save();
          }
        }
      } catch (err) {
        console.error('[app] frame failed', err);
      }
    };
    this.rafId = requestAnimationFrame(frame);
  }

  // ---- saving ------------------------------------------------------------------------------------------------

  /** Writes the settings and, while a world is running, the world. Returns whether it reached real storage. */
  save(): boolean {
    this.sinceSave = 0;
    const game = this.game;
    if (game && (this.phase === 'playing' || this.phase === 'loading')) {
      try {
        this.doc.world = game.toSave();
      } catch (err) {
        console.error('[app] could not snapshot the world', err);
        return false;
      }
    }
    this.doc.settings = { ...this.settings };
    const result = this.slot.write(this.doc);
    this.lastSave = { ok: result.ok, reason: result.ok ? undefined : result.reason, at: Date.now() };
    if (result.ok) {
      game?.bus.emit('game:saved', {});
      return true;
    }
    const toasts = this.root.toasts;
    if (result.reason === 'quota') {
      toasts.show({ text: 'Storage is full: the game could not be saved. It is kept until this page closes.', kind: 'bad', durationMs: 6000 });
    } else if (!this.warnedVolatile && game) {
      this.warnedVolatile = true;
      toasts.show({ text: 'This page cannot keep saves: progress lasts until it is closed.', kind: 'warn', durationMs: 6000 });
    }
    return false;
  }

  saveAndQuit(): void {
    if (!this.game) return;
    this.save();
    this.stopGame();
    this.showTitle();
  }

  /** Tears the running world down without saving (debug reset, failed starts). */
  stopGame(): void {
    cancelAnimationFrame(this.rafId);
    this.loading.hide();
    const game = this.game;
    this.game = null;
    game?.dispose();
  }

  /** Forgets the saved world (debug / tests). */
  deleteSave(): void {
    this.doc.world = null;
    this.slot.write(this.doc);
    this.title?.setHasSave(false);
  }

  // ---- settings ----------------------------------------------------------------------------------------------

  changeSettings(next: Settings, _key: keyof Settings): void {
    Object.assign(this.settings, next);
    this.game?.bus.emit('settings:changed', {});
    window.clearTimeout(this.settingsTimer);
    this.settingsTimer = window.setTimeout(() => {
      this.doc.settings = { ...this.settings };
      // Only the settings change here: the world part of the document stays as last saved.
      this.slot.write(this.doc);
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
      if (this.phase !== 'playing' || !this.game) return;
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
