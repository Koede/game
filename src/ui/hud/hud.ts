/**
 * The in-game HUD. Phone layout keeps the thumbs' zones free: the hotbar sits at the bottom centre, everything
 * else along the top (the top-right corner stays clear for the touch overlay's bag and pause buttons).
 */
import type { GameBus, InputState, Settings } from '../../core/context';
import { AGES, OBJECTIVES } from '../../core/registry';
import type { IWorld, WeatherState } from '../../core/types';
import type { GameClock } from '../../game/clock';
import type { ObjectiveTracker } from '../../game/objectives';
import type { PlayerState } from '../../game/playerState';
import type { Survival } from '../../game/survival';
import { h, setFlag, setText } from '../kit/dom';
import type { UIRoot } from '../kit/root';
import { applyAccessibility, applyUiScale } from '../kit/uiScale';
import { TapMarker, type TapGoalView } from './tapMarker';
import { CombatCues } from './combatCues';
import { parseTargetName, type TargetInfo } from './combatMath';
import { Compass } from './compass';
import { Crosshair } from './crosshair';
import { ScanFx } from './scanFx';
import type { ScanDone, ScanProgress } from '../../magic/magic';
import { FeedView, Vignettes } from './feed';
import { GoalTracker } from './goal';
import { Hotbar } from './hotbar';
import { BuildChip } from './buildChip';
import { TownChip, type TownChipInfo } from './townChip';
import { HumChip } from './humChip';
import { NudgeBar } from './nudge';
import { QuickCraft } from './quickCraft';
import hudCss from './hud.css';
import combatCss from './combat.css';
import { summarizeGrid } from './hudMath';
import { CoachMarks } from './coach';
import { cropLabel } from './cropText';
import type { UISimQuery } from './query';
import { DayDial, PowerStrip } from './status';
import { Vitals } from './vitals';
import { NpcDialogue } from './npcDialogue';

export interface HudDeps {
  bus: GameBus;
  settings: Settings;
  world: IWorld;
  player: PlayerState;
  clock: GameClock;
  objectives: ObjectiveTracker;
  survival: Survival;
  /** A hard-winter goal that takes the goal plate while the season asks for it; null or missing = the guided goal. */
  winterGoal?: () => { title: string; text: string } | null;
  /** The current simulation query (it can be swapped after the HUD exists). */
  sim: () => UISimQuery;
  input: InputState;
  /** The world's weather (spec 15) for the dial's glyph and moon; null or missing = none. */
  weather?: () => WeatherState | null;
  /** The town chip under the goal tracker: the camp goal or the building going up; null hides it. */
  town?: () => TownChipInfo | null;
  /** Where tap to move is walking to, or null (the controller's TapMove; the HUD draws a ring there). */
  tapGoal?: () => TapGoalView | null;
}

const SLOW_S = 0.125;
const GRID_S = 0.5;
/** A toast repeating a banner that was just shown is dropped (the tracker toasts what the banner announces). */
const ECHO_MS = 400;

function injectCss(): void {
  if (document.getElementById('hw-hud-css')) return;
  const style = document.createElement('style');
  style.id = 'hw-hud-css';
  style.textContent = `${hudCss}\n${combatCss}`;
  document.head.appendChild(style);
}

export class Hud {
  readonly el: HTMLDivElement;
  private readonly deps: HudDeps;
  private readonly root: UIRoot;
  private readonly top: HTMLDivElement;
  private readonly devBtn: HTMLButtonElement;
  private readonly dialogue: NpcDialogue;
  private readonly vitals = new Vitals();
  /** The heat view chip (src/ui/hud/vitals.ts): `onHeatToggle` is set by the game, `setHeatView` mirrors the state on the chip. */
  set onHeatToggle(fn: (() => void) | null) {
    this.vitals.onHeatToggle = fn;
  }
  setHeatView(on: boolean): void {
    this.vitals.heatOn = on;
  }
  private readonly goal: GoalTracker;
  private readonly townChip: TownChip;
  private readonly compass = new Compass();
  private readonly quick: QuickCraft;
  private readonly build: BuildChip;
  private readonly hum: HumChip;
  private readonly nudge: NudgeBar;
  private readonly dial = new DayDial();
  private readonly power = new PowerStrip();
  private readonly crosshair = new Crosshair();
  private readonly scanFx = new ScanFx();
  private readonly feed = new FeedView();
  private readonly vignettes = new Vignettes();
  private readonly hotbar: Hotbar;
  private readonly coach = new CoachMarks();
  private goalDone = false;
  private readonly fpsEl: HTMLDivElement;
  private readonly offs: (() => void)[] = [];
  private readonly observer: ResizeObserver | null;
  private slow = SLOW_S;
  private readonly tapMark = new TapMarker();
  /** Work done at the aimed hand station, 0..1, or -1 when the target is not one at work. */
  private workFraction = -1;
  private gridTimer = GRID_S;
  private hotbarDirty = true;
  private fpsFrames = 0;
  private fpsTime = 0;
  private echo: { text: string; until: number } | null = null;
  private targetKey = '';
  private blockName: string | null = null;
  private mining = -1;
  private nameOverride: string | null = null;
  /** The rarity tint of the override (a dropped item under the aim), or null. */
  private nameRarity: string | null = null;
  /** The creature named by the override ("Forge Warden - 9/16"), shown with a health bar. */
  private creature: TargetInfo | null = null;
  private readonly cues: CombatCues;
  private readonly targetAt = { has: false, x: 0, y: 0, z: 0 };
  private screenOpen = false;
  /**
   * Goals completed and ages begun while a screen covered the view: announced once it closes. The matching
   * "Done: ..." toast is dropped then, so a goal is announced once, not as a toast now and a banner later.
   */
  private heldGoal: string | null = null;
  private heldAge: number | null = null;
  /** Rod aura line in the status cluster. Hidden until setAura is given a string. */
  private readonly auraEl: HTMLDivElement;
  private auraText: string | null = null;

  constructor(root: UIRoot, deps: HudDeps) {
    injectCss();
    this.root = root;
    this.deps = deps;
    const bus = deps.bus;
    this.goal = new GoalTracker(bus);
    this.townChip = new TownChip(bus);
    this.hotbar = new Hotbar(deps.player, bus);
    this.quick = new QuickCraft(deps.player, bus);
    this.build = new BuildChip(deps.world, deps.player, bus);
    this.hum = new HumChip(bus);
    this.nudge = new NudgeBar(deps.world, deps.player, deps.objectives);
    this.fpsEl = h('div', { class: 'hw-fps hw-num' });
    this.fpsEl.hidden = true;
    this.auraEl = h('div', { class: 'hw-aura hw-hud-plate', attrs: { role: 'status' } });
    this.auraEl.hidden = true;
    this.top = h(
      'div',
      { class: 'hw-hud__top' },
      h('div', { class: 'hw-hud__left' }, this.vitals.el, this.fpsEl),
      h('div', { class: 'hw-hud__mid' }, this.goal.el, this.townChip.el, this.nudge.el),
      h('div', { class: 'hw-hud__right' }, this.compass.el, this.dial.el, this.power.el, this.auraEl, this.quick.el, this.build.el, this.hum.el),
    );
    this.devBtn = this.devButton(bus);
    this.devBtn.hidden = !deps.player.dev;
    const bottom = h('div', { class: 'hw-hud__bottom' }, this.hotbar.el);
    this.cues = new CombatCues(this.top, bottom, () => deps.input.touch);
    this.el = h(
      'div',
      { class: 'hw-hud' },
      this.vignettes.el,
      this.cues.el,
      this.top,
      this.crosshair.el,
      this.scanFx.el,
      this.tapMark.el,
      bottom,
      this.coach.el,
      this.devBtn,
    );
    root.layers.hud.appendChild(this.el);
    this.dialogue = new NpcDialogue(bus, this.el);
    // The feed shares the toast layer's column on narrow screens, so gains and toasts never cover each other.
    root.layers.toasts.appendChild(this.feed.el);

    this.offs.push(
      bus.on('toast', (t) => this.toast(t.text, t.kind, t.item)),
      bus.on('objective:completed', ({ id }) => this.objectiveBanner(id)),
      bus.on('age:advanced', ({ age }) => this.ageBanner(age)),
      bus.on('item:gained', ({ item, count }) => this.feed.push(item, count)),
      bus.on('block:broken', () => this.coach.blockBroken()),
      bus.on('hand:stroke', (e) => this.handChanged(e.x, e.y, e.z)),
      bus.on('hand:done', (e) => this.handChanged(e.x, e.y, e.z)),
      bus.on('hand:taken', (e) => this.handChanged(e.x, e.y, e.z)),
      bus.on('ui:open', ({ screen }) => {
        if (screen.type === 'log') this.coach.goalOpened();
      }),
      bus.on('player:damage', ({ amount }) => this.vignettes.damage(amount)),
      // Spec 19.5: where the blow came from, and the telegraph of one coming from out of view.
      bus.on('player:attacked', ({ x, z, amount }) => this.cues.hit(x, z, amount)),
      bus.on('hostile:windup', (e) => this.cues.windup(e.id, e.species, e.attack, e.x, e.y, e.z, e.durationS)),
      bus.on('hostile:attack', ({ id }) => this.cues.release(id)),
      bus.on('hostile:dormant', ({ id }) => this.cues.forget(id)),
      bus.on('mob:died', ({ id }) => this.cues.forget(id)),
      bus.on('player:death', () => this.cues.clear()),
      bus.on('player:respawn', () => this.cues.clear()),
      bus.on('settings:changed', () => { applyUiScale(root.el, deps.settings.uiScale); applyAccessibility(root.el, deps.settings); }),
      bus.on('inventory:changed', () => (this.hotbarDirty = true)),
      bus.on('hotbar:selected', () => (this.hotbarDirty = true)),
      bus.on('power:alert', (a) => {
        this.gridTimer = GRID_S;
        // The simulation toasts the meltdown warning itself.
        if (a.kind !== 'meltdown_warning') this.toast(a.message, a.kind === 'recovered' ? 'good' : a.kind === 'overload' ? 'bad' : 'warn');
      }),
    );
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKey);
    // Toasts and banners start below whatever the HUD keeps along the top edge.
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.placeToasts()) : null;
    this.observer?.observe(this.top);
    applyUiScale(root.el, deps.settings.uiScale);
    applyAccessibility(root.el, deps.settings);
    this.update();
  }

  /** Build / quick-craft shortcuts (Z undo, C mark, V paste, N what next, X repeat the last hand recipe) while no screen is open. */
  private readonly onKey = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.screenOpen || this.deps.input.paused || this.deps.player.dead) return;
    if (e.code === 'KeyN') this.nudge.toggle();
    else if (e.code === 'KeyX') this.quick.repeat();
    else this.build.key(e.code);
  };

  frame(dt: number): void {
    const d = this.deps;
    this.compass.aim(d.player);
    this.tapMark.update(d.tapGoal?.() ?? null, { x: d.player.position.x, y: d.player.eyeY, z: d.player.position.z }, d.player.yaw, d.player.pitch, d.settings.fov, window.innerWidth / Math.max(1, window.innerHeight));
    this.nudge.frame(dt);
    this.coach.look(d.player.yaw, d.player.pitch, d.input.touch);
    if (this.hotbarDirty) {
      this.hotbarDirty = false;
      this.hotbar.refresh();
    }
    this.cues.frame(dt, d.player, d.settings.fov);
    this.countFps(dt);
    this.slow += dt;
    this.gridTimer += dt;
    if (this.slow >= SLOW_S) {
      this.slow = 0;
      this.update();
    }
  }

  /** Same arguments as IView.setTarget (called every frame: the name is looked up only when the target moves). */
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void {
    const t = this.targetAt;
    const moved = target === null ? t.has : !t.has || t.x !== target.x || t.y !== target.y || t.z !== target.z;
    if (moved) {
      t.has = target !== null;
      if (target) {
        t.x = target.x;
        t.y = target.y;
        t.z = target.z;
      }
      this.blockName = this.targetLabel();
    }
    this.mining = mining;
    this.showTarget();
  }

  /** The block under the crosshair in words; a crop says how it grows, a cup or bucket the step it is at (refreshed on the slow tick). */
  private targetLabel(): string | null {
    const t = this.targetAt;
    this.workFraction = -1;
    if (!t.has) return null;
    const crop = this.deps.sim().cropView(t.x, t.y, t.z);
    if (crop) return cropLabel(crop);
    const brew = this.deps.sim().brewView(t.x, t.y, t.z);
    if (brew) return brew.text;
    const hand = this.deps.sim().handView(t.x, t.y, t.z);
    this.workFraction = hand && hand.fraction > 0 ? hand.fraction : -1;
    if (hand) return hand.label;
    const block = this.deps.world.getBlock(t.x, t.y, t.z);
    if (block.id === 0) return null;
    const machine = this.deps.sim().machineView(t.x, t.y, t.z);
    return machine && machine.status ? `${block.name} - ${machine.status}` : block.name;
  }

  /**
   * A name that replaces the block's under the crosshair (an animal: "Goat - 6/8"), or null to show the block
   * again. `rarity` tints a dropped item's name. Cheap to call every frame: the label only changes when the text does.
   */
  setTargetName(name: string | null, rarity: string | null = null): void {
    if (name !== this.nameOverride) this.creature = parseTargetName(name);
    this.nameOverride = name;
    this.nameRarity = rarity;
    this.showTarget();
  }

  /**
   * The rod's aura line (`Magic.rodReading`) in the status cluster. `null` hides it.
   * The string is shown as given: this adds no figures of its own. Game calls it; the HUD does not read the rod.
   */
  setAura(text: string | null): void {
    if (text === this.auraText) return;
    this.auraText = text;
    this.auraEl.hidden = text === null;
    if (text === null) this.auraEl.setAttribute('hidden', '');
    else {
      this.auraEl.removeAttribute('hidden');
      setText(this.auraEl, text);
    }
  }

  /** The notebook scan over the crosshair (`Magic.scanProgress` / `scanResult`); call every frame, idle it is two comparisons. */
  setScan(progress: ScanProgress | null, done: ScanDone | null): void {
    this.scanFx.update(progress, done, performance.now());
    this.crosshair.el.toggleAttribute('data-scan', progress !== null);
  }

  private showTarget(): void {
    const name = this.nameOverride ?? this.blockName;
    // Mining fills the ring; so does the work bar of a hand station (Hand Quern - wheat 3/6 strokes).
    const mining = this.nameOverride !== null ? -1 : this.mining >= 0 ? this.mining : this.workFraction;
    const rarity = this.nameOverride !== null ? this.nameRarity : null;
    const key = `${name}|${mining}|${rarity}`;
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.crosshair.set(name, mining, this.nameOverride !== null ? this.creature : null, rarity);
  }

  /** A stroke, a finished job or a take at the aimed station: the aiming line follows at once, not on the slow tick. */
  private handChanged(x: number, y: number, z: number): void {
    const t = this.targetAt;
    if (!t.has || t.x !== x || t.y !== y || t.z !== z) return;
    this.blockName = this.targetLabel();
    this.showTarget();
  }

  /** A screen covers the view: the crosshair and the gain feed step back. */
  /** Dev Mode: the always-visible Creative button (E and the touch backpack button open the same screen). */
  private devButton(bus: GameBus): HTMLButtonElement {
    const button = h('button', { class: 'hw-devchip', attrs: { type: 'button', 'aria-label': 'Open the creative menu (Dev Mode)' } }, h('b', { text: 'DEV' }), h('span', { text: 'Items' }));
    button.addEventListener('click', () => bus.emit('ui:open', { screen: { type: 'creative' } }));
    return button;
  }

  setScreenOpen(open: boolean): void {
    this.screenOpen = open;
    setFlag(this.el, 'screen', open);
    // An objective banner would sit on top of the screen's content; announcements wait for the view to return.
    setFlag(this.root.layers.toasts, 'screen', open);
    this.feed.el.hidden = open;
    if (!open && this.heldAge !== null) {
      const age = this.heldAge;
      this.heldAge = null;
      this.ageBanner(age);
    }
    if (!open && this.heldGoal !== null) {
      const id = this.heldGoal;
      this.heldGoal = null;
      this.objectiveBanner(id);
    }
  }

  refreshIcons(): void {
    this.hotbarDirty = true;
    this.feed.refreshIcons();
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.observer?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKey);
    this.build.dispose();
    this.hum.dispose();
    this.hotbar.dispose();
    this.dialogue.dispose();
    this.feed.el.remove();
    this.el.remove();
  }

  private update(): void {
    const d = this.deps;
    this.devBtn.hidden = !d.player.dev;
    setFlag(this.el, 'touch', d.input.touch);
    this.vitals.update(d.player, d.survival);
    this.goal.update(d.objectives, d.winterGoal?.() ?? null);
    this.townChip.update(d.town?.() ?? null);
    this.quick.update();
    this.build.update();
    const home = d.player.home;
    this.compass.update(d.player, home ? d.sim().furnaceAt(home.x, home.y, home.z) : null);
    this.dial.update(d.clock.timeOfDay, d.clock.day, d.weather?.() ?? null);
    if (this.gridTimer >= GRID_S) {
      this.gridTimer = 0;
      this.power.update(summarizeGrid(d.sim().allNetworks()));
    }
    this.vignettes.update(d.player.warmth, d.player.wellWarmed, d.player.food);
    this.cues.setBurning(d.player.combat.burning);
    // Settings are read by reference: a change made anywhere (title, pause menu) shows within a slow tick.
    applyUiScale(this.root.el, d.settings.uiScale);
    applyAccessibility(this.root.el, d.settings);
    this.feed.tick();
    // The goal tip waits for the first finished goal (the list is built on each read: ask only until then).
    if (!this.goalDone && d.objectives.completed.length > 0) {
      this.goalDone = true;
      this.coach.objectiveCompleted();
    }
    this.coach.render(d.input.touch, this.screenOpen, this.goal.el);
    if (this.targetAt.has) {
      this.blockName = this.targetLabel();
      this.showTarget();
    }
  }

  private countFps(dt: number): void {
    const show = this.deps.settings.showFps;
    if (this.fpsEl.hidden === show) this.fpsEl.hidden = !show;
    if (!show) return;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime < 0.5) return;
    setText(this.fpsEl, `${Math.round(this.fpsFrames / this.fpsTime)} fps`);
    this.fpsFrames = 0;
    this.fpsTime = 0;
  }

  private toast(text: string, kind: 'info' | 'good' | 'warn' | 'bad' | undefined, item?: string): void {
    if (this.echo && performance.now() < this.echo.until && text.startsWith(this.echo.text)) return;
    this.root.toasts.show({ text, kind, item });
  }

  private objectiveBanner(id: string): void {
    const spec = OBJECTIVES.find((o) => o.id === id);
    if (!spec) return;
    if (this.screenOpen) {
      this.heldGoal = id;
      this.echo = { text: `Done: ${spec.title}`, until: performance.now() + ECHO_MS };
      return;
    }
    const next = this.deps.objectives.current;
    this.root.banner.show({
      kicker: 'Goal complete',
      title: spec.title,
      subtitle: next && next.id !== id ? `Next: ${next.title}` : undefined,
      tone: 'good',
      size: 'md',
    });
    this.echo = { text: `Done: ${spec.title}`, until: performance.now() + ECHO_MS };
    this.slow = SLOW_S;
  }

  private ageBanner(index: number): void {
    const age = AGES[index];
    if (!age) return;
    if (this.screenOpen) {
      this.heldAge = index;
      this.echo = { text: `${age.name}:`, until: performance.now() + ECHO_MS };
      return;
    }
    this.root.banner.show({ kicker: 'A new age begins', title: age.name, subtitle: age.blurb, tone: index >= 2 ? 'power' : 'heat', size: 'lg' });
    this.echo = { text: `${age.name}:`, until: performance.now() + ECHO_MS };
  }

  private placeToasts(): void {
    const rect = this.top.getBoundingClientRect();
    const safeTop = Math.max(0, parseFloat(getComputedStyle(this.top).paddingTop) - 8);
    this.root.layers.toasts.style.setProperty('--hw-toast-top', `${Math.round(rect.bottom - safeTop + 6)}px`);
  }
}
