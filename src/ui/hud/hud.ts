/**
 * The in-game HUD. Phone layout keeps the thumbs' zones free: the hotbar sits at the bottom centre, everything
 * else along the top (the top-right corner stays clear for the touch overlay's bag and pause buttons).
 */
import type { GameBus, InputState, Settings } from '../../core/context';
import { AGES, OBJECTIVES } from '../../core/registry';
import type { IWorld } from '../../core/types';
import type { GameClock } from '../../game/clock';
import type { ObjectiveTracker } from '../../game/objectives';
import type { PlayerState } from '../../game/playerState';
import type { Survival } from '../../game/survival';
import { h, setFlag, setText } from '../kit/dom';
import type { UIRoot } from '../kit/root';
import { Compass } from './compass';
import { Crosshair } from './crosshair';
import { FeedView, Vignettes } from './feed';
import { GoalTracker } from './goal';
import { Hotbar } from './hotbar';
import hudCss from './hud.css';
import { summarizeGrid } from './hudMath';
import type { UISimQuery } from './query';
import { DayDial, PowerStrip } from './status';
import { Vitals } from './vitals';

export interface HudDeps {
  bus: GameBus;
  settings: Settings;
  world: IWorld;
  player: PlayerState;
  clock: GameClock;
  objectives: ObjectiveTracker;
  survival: Survival;
  /** The current simulation query (it can be swapped after the HUD exists). */
  sim: () => UISimQuery;
  input: InputState;
}

const SLOW_S = 0.125;
const GRID_S = 0.5;
/** A toast repeating a banner that was just shown is dropped (the tracker toasts what the banner announces). */
const ECHO_MS = 400;

function injectCss(): void {
  if (document.getElementById('hw-hud-css')) return;
  const style = document.createElement('style');
  style.id = 'hw-hud-css';
  style.textContent = hudCss;
  document.head.appendChild(style);
}

export class Hud {
  readonly el: HTMLDivElement;
  private readonly deps: HudDeps;
  private readonly root: UIRoot;
  private readonly top: HTMLDivElement;
  private readonly vitals = new Vitals();
  private readonly goal: GoalTracker;
  private readonly compass = new Compass();
  private readonly dial = new DayDial();
  private readonly power = new PowerStrip();
  private readonly crosshair = new Crosshair();
  private readonly feed = new FeedView();
  private readonly vignettes = new Vignettes();
  private readonly hotbar: Hotbar;
  private readonly fpsEl: HTMLDivElement;
  private readonly offs: (() => void)[] = [];
  private readonly observer: ResizeObserver | null;
  private slow = SLOW_S;
  private gridTimer = GRID_S;
  private hotbarDirty = true;
  private fpsFrames = 0;
  private fpsTime = 0;
  private echo: { text: string; until: number } | null = null;
  private targetKey = '';

  constructor(root: UIRoot, deps: HudDeps) {
    injectCss();
    this.root = root;
    this.deps = deps;
    const bus = deps.bus;
    this.goal = new GoalTracker(bus);
    this.hotbar = new Hotbar(deps.player, bus);
    this.fpsEl = h('div', { class: 'hw-fps hw-num' });
    this.fpsEl.hidden = true;
    this.top = h(
      'div',
      { class: 'hw-hud__top' },
      h('div', { class: 'hw-hud__left' }, this.vitals.el, this.fpsEl),
      h('div', { class: 'hw-hud__mid' }, this.goal.el),
      h('div', { class: 'hw-hud__right' }, this.compass.el, this.dial.el, this.power.el),
    );
    this.el = h(
      'div',
      { class: 'hw-hud' },
      this.vignettes.el,
      this.top,
      this.feed.el,
      this.crosshair.el,
      h('div', { class: 'hw-hud__bottom' }, this.hotbar.el),
    );
    root.layers.hud.appendChild(this.el);

    this.offs.push(
      bus.on('toast', (t) => this.toast(t.text, t.kind, t.item)),
      bus.on('objective:completed', ({ id }) => this.objectiveBanner(id)),
      bus.on('age:advanced', ({ age }) => this.ageBanner(age)),
      bus.on('item:gained', ({ item, count }) => this.feed.push(item, count)),
      bus.on('player:damage', ({ amount }) => this.vignettes.damage(amount)),
      bus.on('inventory:changed', () => (this.hotbarDirty = true)),
      bus.on('hotbar:selected', () => (this.hotbarDirty = true)),
      bus.on('power:alert', (a) => {
        this.gridTimer = GRID_S;
        // The simulation toasts the meltdown warning itself.
        if (a.kind !== 'meltdown_warning') this.toast(a.message, a.kind === 'recovered' ? 'good' : a.kind === 'overload' ? 'bad' : 'warn');
      }),
    );
    // Toasts and banners start below whatever the HUD keeps along the top edge.
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.placeToasts()) : null;
    this.observer?.observe(this.top);
    this.update();
  }

  frame(dt: number): void {
    const d = this.deps;
    this.compass.aim(d.player);
    if (this.hotbarDirty) {
      this.hotbarDirty = false;
      this.hotbar.refresh();
    }
    this.countFps(dt);
    this.slow += dt;
    this.gridTimer += dt;
    if (this.slow >= SLOW_S) {
      this.slow = 0;
      this.update();
    }
  }

  /** Same arguments as IView.setTarget. */
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void {
    let name: string | null = null;
    if (target) {
      const block = this.deps.world.getBlock(target.x, target.y, target.z);
      name = block.id === 0 ? null : block.name;
    }
    const key = `${name}|${mining}`;
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.crosshair.set(name, mining);
  }

  /** A screen covers the view: the crosshair and the gain feed step back. */
  setScreenOpen(open: boolean): void {
    setFlag(this.el, 'screen', open);
  }

  refreshIcons(): void {
    this.hotbarDirty = true;
    this.feed.refreshIcons();
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.observer?.disconnect();
    this.hotbar.dispose();
    this.el.remove();
  }

  private update(): void {
    const d = this.deps;
    setFlag(this.el, 'touch', d.input.touch);
    this.vitals.update(d.player, d.survival);
    this.goal.update(d.objectives);
    const home = d.player.home;
    this.compass.update(d.player, home ? d.sim().furnaceAt(home.x, home.y, home.z) : null);
    this.dial.update(d.clock.timeOfDay, d.clock.day);
    if (this.gridTimer >= GRID_S) {
      this.gridTimer = 0;
      this.power.update(summarizeGrid(d.sim().allNetworks()));
    }
    this.vignettes.update(d.player.warmth, d.player.wellWarmed);
    this.feed.tick();
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
    this.root.banner.show({ kicker: 'A new age begins', title: age.name, subtitle: age.blurb, tone: index >= 2 ? 'power' : 'heat', size: 'lg' });
    this.echo = { text: `${age.name}:`, until: performance.now() + ECHO_MS };
  }

  private placeToasts(): void {
    const rect = this.top.getBoundingClientRect();
    const safeTop = Math.max(0, parseFloat(getComputedStyle(this.top).paddingTop) - 8);
    this.root.layers.toasts.style.setProperty('--hw-toast-top', `${Math.round(rect.bottom - safeTop + 6)}px`);
    this.el.style.setProperty('--hw-hud-top', `${Math.round(rect.bottom)}px`);
  }
}
