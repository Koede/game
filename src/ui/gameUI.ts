/**
 * GameUI owns the HUD and every in-game screen: it answers 'ui:open' / 'ui:close', keeps one screen open at a
 * time, writes InputState.uiOpen, refreshes the open screen ~8 times per second and after relevant events, and
 * shows the death and win screens. More screens plug in through registerScreen (furnace and machines, 7.4b).
 */
import type { GameBus, InputState, Settings } from '../core/context';
import type { GameEvents, ScreenRequest } from '../core/gameEvents';
import type { IWorld, WeatherState } from '../core/types';
import type { GameClock } from '../game/clock';
import type { ObjectiveTracker } from '../game/objectives';
import type { PlayerState } from '../game/playerState';
import type { Survival } from '../game/survival';
import { BackGesture } from './hud/backGesture';
import { Hud } from './hud/hud';
import type { TownChipInfo } from './hud/townChip';
import { NO_UI_SIM, type UISimQuery } from './hud/query';
import { setIconProvider, type IconProvider } from './kit/icons';
import type { UIRoot } from './kit/root';
import type { Window } from './kit/window';
import { PauseMenu } from './menus/pause';
import { createDeathScreen } from './screens/death/deathScreen';
import { createCreativeScreen } from './screens/creative/creativeScreen';
import { createInventoryScreen } from './screens/inventory/inventoryScreen';
import type { Achievements } from '../game/achievements';
import type { DailyGoals } from '../game/dailyGoals';
import type { Journal } from '../game/journal';
import { createCaravanScreen } from './screens/caravan/caravanScreen';
import { createLogScreen } from './screens/log/logScreen';
import { SlotController } from './screens/slots';
import { createWinScreen } from './screens/win/winScreen';
import { createWorkbenchScreen } from './screens/workbench/workbenchScreen';

export interface GameScreen {
  /** Built by the factory, not opened: GameUI opens it in the windows layer and watches it close. */
  readonly window: Window;
  /** ~8 Hz while open and after relevant events. Update in place; never rebuild DOM that did not change. */
  refresh(): void;
  /** Once, after the window closed for any reason. */
  dispose(): void;
}

export interface ScreenContext {
  readonly request: ScreenRequest;
  readonly root: UIRoot;
  readonly bus: GameBus;
  readonly world: IWorld;
  readonly player: PlayerState;
  readonly clock: GameClock;
  readonly objectives: ObjectiveTracker;
  readonly survival: Survival;
  /** The diary and explored map (docs/api/journal.md); absent in test harnesses. */
  readonly journal?: Journal;
  /** Places worth a dot on the journal map: waypoint stones (src/game/exploration.ts). */
  readonly mapMarkers?: () => readonly { x: number; z: number; name: string; kind: 'waypoint' }[];
  readonly achievements?: Achievements;
  readonly dailyGoals?: DailyGoals;
  /** The current simulation query (follows setSim). */
  readonly sim: UISimQuery;
  /** The world's weather now (spec 15), or null when the game has none. */
  readonly weather: WeatherState | null;
  /** The player is on a touch screen (texts say "Tap" rather than "Click"). */
  readonly touch: boolean;
  /** A fresh slot-interaction controller for this screen; disposed by GameUI on close. */
  readonly slots: SlotController;
  /** Refresh on the next frame. */
  invalidate(): void;
  close(): void;
}

export type ScreenFactory<R extends ScreenRequest = ScreenRequest> = (request: R, ctx: ScreenContext) => GameScreen | null;
type ScreenType = ScreenRequest['type'];
type RequestOf<T extends ScreenType> = Extract<ScreenRequest, { type: T }>;

export interface GameUIDeps {
  bus: GameBus;
  input: InputState;
  /** Read by reference (showFps). */
  settings: Settings;
  world: IWorld;
  player: PlayerState;
  clock: GameClock;
  objectives: ObjectiveTracker;
  survival: Survival;
  /** The hard-winter goal to show in place of the guided goal while it is autumn or winter (src/game/winter.ts). */
  winterGoal?: () => { title: string; text: string } | null;
  journal?: Journal;
  mapMarkers?: () => readonly { x: number; z: number; name: string; kind: 'waypoint' }[];
  achievements?: Achievements;
  dailyGoals?: DailyGoals;
  sim?: UISimQuery;
  /** The world's weather (spec 15): the HUD dial's glyph and moon, the Hearth Log's forecast. */
  weather?: () => WeatherState | null;
  /** Where tap to move is walking to (the HUD draws a ring there), or null. */
  tapGoal?: () => { x: number; y: number; z: number } | null;
  /** Lets the mouse go when a screen opens (normally InputManager.releasePointerCapture). GameUI never touches pointer lock itself. */
  releasePointer?: () => void;
  /** The town chip and the pause menu's Town entry: null when the world has no town to show. */
  town?: () => TownChipInfo | null;
  /** When given, GameUI shows the kit's PauseMenu as its 'pause' screen. */
  pause?: { onSettingsChange(settings: Settings, key: keyof Settings): void; onQuit(): void; dev?: { get(): boolean; set(on: boolean): void } };
}

interface Active {
  /** null for the death and win screens. */
  request: ScreenRequest | null;
  kind: string;
  screen: GameScreen;
  slots: SlotController;
  /** Death: cannot be closed by Escape, E, back or 'ui:close'. */
  modal: boolean;
  offClose: () => void;
}

const REFRESH_INTERVAL_S = 0.125;
/** Events after which the open screen refreshes on the next frame instead of waiting for its turn. */
const REFRESH_EVENTS: readonly (keyof GameEvents)[] = [
  'inventory:changed', 'item:made', 'furnace:lit', 'furnace:out', 'furnace:pumped', 'furnace:smelted', 'furnace:upgraded',
  'furnace:ignition', 'machine:job', 'machine:placed', 'machine:removed', 'power:alert', 'objective:completed', 'time:phase',
];

const sameRequest = (a: ScreenRequest, b: ScreenRequest): boolean => JSON.stringify(a) === JSON.stringify(b);

export class GameUI {
  readonly hud: Hud;
  private readonly root: UIRoot;
  private readonly deps: GameUIDeps;
  private readonly factories = new Map<ScreenType, ScreenFactory<never>>();
  private readonly offs: (() => void)[] = [];
  private sim: UISimQuery;
  private active: Active | null = null;
  private dirty = false;
  private sinceRefresh = 0;
  private switching = false;
  private readonly back: BackGesture;
  /** The game was won while the death screen was up: celebrate after the respawn. */
  private winPending = false;

  constructor(root: UIRoot, deps: GameUIDeps) {
    this.root = root;
    this.deps = deps;
    this.sim = deps.sim ?? NO_UI_SIM;
    this.hud = new Hud(root, {
      bus: deps.bus,
      settings: deps.settings,
      world: deps.world,
      player: deps.player,
      clock: deps.clock,
      objectives: deps.objectives,
      survival: deps.survival,
      winterGoal: () => deps.winterGoal?.() ?? null,
      sim: () => this.sim,
      input: deps.input,
      weather: () => deps.weather?.() ?? null,
      town: deps.town,
      tapGoal: () => deps.tapGoal?.() ?? null,
    });
    const bus = deps.bus;
    this.offs.push(
      bus.on('ui:open', ({ screen }) => {
        // A screen that cannot be built (its machine is not set up yet) says so, instead of leaving the tap mute.
        if (!this.open(screen) && !this.active?.modal) bus.emit('toast', { text: 'There is nothing to open here yet', kind: 'info' });
      }),
      bus.on('ui:close', () => this.close()),
      bus.on('player:death', () => this.showDeath()),
      bus.on('player:respawn', () => (this.active?.kind === 'death' ? this.closeActive() : undefined)),
      bus.on('game:won', () => this.showWin()),
    );
    for (const type of REFRESH_EVENTS) this.offs.push(bus.on(type, () => (this.dirty = true)));
    const onKey = (ev: KeyboardEvent): void => this.onKey(ev);
    document.addEventListener('keydown', onKey);
    this.back = new BackGesture(() => {
      if (this.active?.modal) return false;
      this.closeActive();
      return true;
    });
    this.offs.push(() => document.removeEventListener('keydown', onKey), () => this.back.dispose());

    this.registerScreen('inventory', createInventoryScreen);
    this.registerScreen('workbench', createWorkbenchScreen);
    this.registerScreen('log', createLogScreen);
    this.registerScreen('caravan', createCaravanScreen);
    this.registerScreen('creative', (_request, ctx) => createCreativeScreen(ctx));
    const pause = deps.pause;
    if (pause) {
      this.registerScreen('pause', () => {
        const menu = new PauseMenu(root, { settings: deps.settings, onSettingsChange: pause.onSettingsChange, dev: pause.dev, onResume: () => undefined, onQuit: pause.onQuit, onTown: deps.town?.() ? () => deps.bus.emit('ui:open', { screen: { type: 'town' } }) : undefined });
        menu.window.setSubtitle(deps.player.dev ? 'Dev Mode world' : 'Survival world');
        return { window: menu.window, refresh: () => undefined, dispose: () => undefined };
      });
    }
  }

  /** The request of the open screen (null when none, or while the death / win screen is up). */
  get current(): ScreenRequest | null {
    return this.active?.request ?? null;
  }

  get isOpen(): boolean {
    return this.active !== null;
  }

  registerScreen<T extends ScreenType>(type: T, factory: ScreenFactory<RequestOf<T>>): void {
    this.factories.set(type, factory as ScreenFactory<never>);
  }

  setSim(sim: UISimQuery): void {
    this.sim = sim;
    this.dirty = true;
  }

  setIconProvider(provider: IconProvider | null): void {
    setIconProvider(provider);
    this.hud.refreshIcons();
    this.dirty = true;
  }

  /** Opens a screen (closing the current one). False when nothing is registered for it or the factory refused. */
  open(request: ScreenRequest): boolean {
    if (this.active?.modal) return false;
    if (this.active?.request && sameRequest(this.active.request, request)) return true;
    const factory = this.factories.get(request.type) as ScreenFactory<ScreenRequest> | undefined;
    if (!factory) return false;
    return this.show(request.type, request, false, (ctx) => factory(request, ctx));
  }

  /** Closes the open screen (not the death screen: only Respawn does that). */
  close(): void {
    if (this.active && !this.active.modal) this.closeActive();
  }

  /** Call every animation frame, also while paused. */
  frame(dt: number): void {
    this.hud.frame(dt);
    this.sinceRefresh += dt;
    if (!this.active || (!this.dirty && this.sinceRefresh < REFRESH_INTERVAL_S)) return;
    this.dirty = false;
    this.sinceRefresh = 0;
    try {
      this.active.screen.refresh();
    } catch (err) {
      console.error('[ui] screen refresh failed', err);
    }
  }

  /** Mirror of IView.setTarget: the crosshair shows the block's name and the mining ring. */
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void {
    this.hud.setTarget(target, mining);
  }

  /**
   * Shows `name` under the crosshair instead of the block's (an animal: "Goat - 6/8"; a drop: "Stone ×12" tinted by
   * `rarity`); null shows the block again.
   */
  setTargetName(name: string | null, rarity: string | null = null): void {
    this.hud.setTargetName(name, rarity);
  }

  dispose(): void {
    if (this.active) this.closeActive();
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.hud.dispose();
  }

  private context(request: ScreenRequest, slots: SlotController): ScreenContext {
    const ui = this;
    const d = this.deps;
    return {
      request,
      root: this.root,
      bus: d.bus,
      world: d.world,
      player: d.player,
      clock: d.clock,
      objectives: d.objectives,
      survival: d.survival,
      journal: d.journal,
      mapMarkers: d.mapMarkers,
      achievements: d.achievements,
      dailyGoals: d.dailyGoals,
      get sim() {
        return ui.sim;
      },
      get weather() {
        return d.weather?.() ?? null;
      },
      get touch() {
        return d.input.touch;
      },
      slots,
      invalidate: () => (this.dirty = true),
      close: () => {
        if (this.active?.slots === slots) this.closeActive();
      },
    };
  }

  private show(kind: string, request: ScreenRequest | null, modal: boolean, build: (ctx: ScreenContext) => GameScreen | null): boolean {
    const slots = new SlotController(this.deps.bus, this.root.layers.tooltip, this.root.tooltip);
    slots.onChange = () => (this.dirty = true);
    const player = this.deps.player;
    slots.dropper = { inventory: player.inventory, drop: (slot, count) => player.dropSlot(slot, count) };
    let screen: GameScreen | null = null;
    try {
      screen = build(this.context(request ?? { type: 'inventory' }, slots));
    } catch (err) {
      console.error(`[ui] could not build the ${kind} screen`, err);
    }
    if (!screen) {
      slots.dispose();
      return false;
    }
    const wasOpen = this.active !== null;
    if (this.active) {
      this.switching = true;
      this.closeActive();
      this.switching = false;
    }
    const active: Active = { request, kind, screen, slots, modal, offClose: () => undefined };
    this.active = active;
    // The picked-stack bar docks over the window's footer unless the screen placed it: it never shifts the slots.
    if (!slots.actionBar.parentElement) screen.window.frame.querySelector('.hw-window__inner')?.appendChild(slots.actionBar);
    screen.window.open(this.root.layers.windows);
    active.offClose = screen.window.whenClosed(() => {
      if (this.active === active) this.finishClose(active);
    });
    const input = this.deps.input;
    input.uiOpen = true;
    if (kind === 'pause') this.setPaused(true);
    this.deps.releasePointer?.();
    this.hud.setScreenOpen(true);
    if (request) this.deps.bus.emit('ui:opened', { screen: request });
    if (!wasOpen) this.deps.bus.emit('sfx', { name: 'ui_open' });
    this.back.arm();
    this.dirty = false;
    this.sinceRefresh = 0;
    screen.refresh();
    return true;
  }

  private closeActive(): void {
    const active = this.active;
    if (!active) return;
    // Closing the window calls finishClose through whenClosed; a window that was already gone needs it directly.
    if (active.screen.window.isOpen) active.screen.window.close();
    if (this.active === active) this.finishClose(active);
  }

  private finishClose(active: Active): void {
    this.active = null;
    active.offClose();
    active.slots.dispose();
    try {
      active.screen.dispose();
    } catch (err) {
      console.error(`[ui] disposing the ${active.kind} screen failed`, err);
    }
    if (active.kind === 'pause') this.setPaused(false);
    if (this.switching) return;
    this.deps.input.uiOpen = false;
    this.hud.setScreenOpen(false);
    this.back.disarm();
    this.deps.bus.emit('ui:closed', {});
    this.deps.bus.emit('sfx', { name: 'ui_close' });
    if (this.winPending && active.kind === 'death') {
      this.winPending = false;
      this.showWin();
    }
  }

  private setPaused(paused: boolean): void {
    if (this.deps.input.paused === paused) return;
    this.deps.input.paused = paused;
    this.deps.bus.emit('game:paused', { paused });
  }

  private showDeath(): void {
    const d = this.deps;
    this.show('death', null, true, (ctx) => createDeathScreen(ctx, () => d.survival.respawn()));
  }

  private showWin(): void {
    if (this.active?.modal) {
      this.winPending = true;
      return;
    }
    this.show('win', null, false, (ctx) => createWinScreen(ctx));
  }

  private onKey(ev: KeyboardEvent): void {
    const active = this.active;
    if (!active || active.modal || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const target = ev.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
    if (active.kind === 'pause' || active.kind === 'win') return;
    if (ev.code === 'KeyE') {
      ev.preventDefault();
      this.closeActive();
    } else if (ev.code === 'KeyL') {
      ev.preventDefault();
      if (active.kind === 'log') this.closeActive();
      else this.open({ type: 'log' });
    }
  }
}
