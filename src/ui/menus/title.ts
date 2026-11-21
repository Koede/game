/** The front door: wordmark, one line of promise, and the way into a world. */
import type { Difficulty, Settings } from '../../core/context';
import { Button, Segmented, TextField } from '../kit/controls';
import { h, setText } from '../kit/dom';
import { heatColor } from '../kit/format';
import type { UIRoot } from '../kit/root';
import { applyUiScale } from '../kit/uiScale';
import { Window } from '../kit/window';
import { EmberField } from './fire';
import { HowToPlay, type HowToPlayOptions } from './howto';
import { SettingsPanel } from './settings';
import { DIFFICULTY_OPTIONS, difficultyHint } from './settingsText';

export interface TitleScreenOptions {
  /** Whether a saved world exists: adds Continue and makes New World a hold-to-confirm button. */
  hasSave: boolean;
  settings: Settings;
  /**
   * Start a fresh world. `seed` is what the player typed, or null for a random world. The difficulty picked beside
   * New World has already been passed to `onSettingsChange` (key 'difficulty'): read it from the settings.
   */
  onNewWorld: (seed: string | null) => void;
  onContinue: () => void;
  /** Same contract as SettingsPanel: called on every change with a fresh copy. */
  onSettingsChange: (settings: Settings, key: keyof Settings) => void;
  /** Control lists for How to Play, when the real bindings differ from the defaults. */
  controls?: HowToPlayOptions;
  /** Small print in the corner, e.g. "v0.1.0". */
  version?: string;
  /** Names of the five ages for the strip under the promise. Default: the ages of the spec. */
  ages?: readonly string[];
}

const WORD_HEAT = 'HEARTH';
const WORD_POWER = 'WATT';
/** The first six letters climb the heat ramp to white heat; the last four are electric. */
const LETTER_TEMPS = [640, 800, 960, 1120, 1300, 1500];
const DEFAULT_AGES = ['Ember', 'Forge', 'Current', 'Atomic', 'Star'];
const AGE_COLORS = [heatColor(800), heatColor(1150), 'var(--hw-power)', 'var(--hw-power-hi)', heatColor(1500)];
const PROMISE = ['Start with a clay furnace.', 'End with a star.'];

export class TitleScreen {
  readonly el: HTMLElement;
  private readonly root: UIRoot;
  private readonly opts: TitleScreenOptions;
  private readonly fire = new EmberField();
  private readonly menu: HTMLDivElement;
  private readonly wordmark: HTMLHeadingElement;
  private readonly fitObserver: ResizeObserver | null;
  private readonly seed: TextField;
  private readonly difficulty: Segmented<Difficulty>;
  private readonly difficultyHint: HTMLParagraphElement;
  private settings: Settings;
  private hasSave: boolean;
  private buttons: Button[] = [];
  private sub: Window | null = null;
  private shown = false;

  constructor(root: UIRoot, opts: TitleScreenOptions) {
    this.root = root;
    this.opts = opts;
    this.settings = { ...opts.settings };
    this.hasSave = opts.hasSave;
    this.seed = new TextField({
      label: 'World seed',
      placeholder: 'Leave empty for a random world',
      maxLength: 32,
      mono: true,
      onEnter: () => (this.hasSave ? undefined : this.newWorld()),
    });
    this.difficultyHint = h('p', { class: 'hw-title__hint', text: difficultyHint(this.settings.difficulty) });
    this.difficulty = new Segmented<Difficulty>({
      label: 'Difficulty',
      options: [...DIFFICULTY_OPTIONS],
      value: this.settings.difficulty,
      onChange: (d) => {
        setText(this.difficultyHint, difficultyHint(d));
        this.changeSettings({ ...this.settings, difficulty: d }, 'difficulty');
      },
    });
    applyUiScale(root.el, this.settings.uiScale);
    this.menu = h('div', { class: 'hw-title__menu' });
    const ages = opts.ages ?? DEFAULT_AGES;
    this.wordmark = h(
      'h1',
      { class: 'hw-title__wordmark', attrs: { 'aria-label': 'Hearthwatt' } },
      h(
        'span',
        { class: 'hw-title__heat', attrs: { 'aria-hidden': 'true' } },
        [...WORD_HEAT].map((ch, i) => h('span', { text: ch, style: { color: heatColor(LETTER_TEMPS[i]) } })),
      ),
      h('span', { class: 'hw-title__power', text: WORD_POWER, attrs: { 'aria-hidden': 'true' } }),
    );
    const brand = h(
      'header',
      { class: 'hw-title__brand' },
      this.wordmark,
      h('p', { class: 'hw-title__promise' }, PROMISE.map((line) => h('span', { text: line }))),
      h(
        'ol',
        { class: 'hw-title__ages', attrs: { 'aria-label': 'The five ages' } },
        ages.map((name, i) => h('li', { style: { '--hw-age': AGE_COLORS[i % AGE_COLORS.length] } }, h('i'), h('span', { text: name }))),
      ),
    );
    this.el = h(
      'main',
      { class: 'hw-title' },
      this.fire.el,
      h(
        'div',
        { class: 'hw-title__inner' },
        brand,
        this.menu,
      ),
      opts.version ? h('p', { class: 'hw-title__version hw-num', text: opts.version }) : null,
    );
    this.buildMenu();
    this.fitObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.fitWordmark(brand.clientWidth)) : null;
    this.fitObserver?.observe(brand);
    // The stylesheet sizes the wordmark for the display face; a wider fallback font must not run off a phone screen.
    void document.fonts?.ready.then(() => this.fitWordmark(brand.clientWidth));
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Mounts the title screen in the root's menu layer. */
  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.root.layers.menu.appendChild(this.el);
    this.fire.start();
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.sub?.close();
    this.fire.stop();
    this.el.remove();
  }

  /** Call after a save was written or deleted while the title is alive. */
  setHasSave(hasSave: boolean): void {
    if (hasSave === this.hasSave) return;
    this.hasSave = hasSave;
    this.buildMenu();
  }

  dispose(): void {
    this.hide();
    this.fitObserver?.disconnect();
    this.fire.dispose();
    for (const button of this.buttons) button.dispose();
    this.buttons = [];
  }

  /** Shrinks the wordmark, if needed, so it fits the given width whatever font ended up rendering it. */
  private fitWordmark(available: number): void {
    const mark = this.wordmark;
    mark.style.removeProperty('font-size');
    if (available <= 0) return;
    const natural = mark.scrollWidth;
    if (natural > available) mark.style.fontSize = `${Math.floor((parseFloat(getComputedStyle(mark).fontSize) * available) / natural)}px`;
  }

  private buildMenu(): void {
    for (const button of this.buttons) button.dispose();
    const newWorld = new Button({
      label: 'New World',
      kind: this.hasSave ? 'default' : 'primary',
      size: 'lg',
      block: true,
      holdMs: this.hasSave ? 900 : undefined,
      hint: this.hasSave ? 'Hold - replaces your saved world' : undefined,
      onClick: () => this.newWorld(),
    });
    const resume = this.hasSave
      ? new Button({ label: 'Continue', kind: 'primary', size: 'lg', block: true, icon: 'play', onClick: () => this.opts.onContinue() })
      : null;
    const settings = new Button({ label: 'Settings', kind: 'quiet', block: true, onClick: () => this.openSettings() });
    const howTo = new Button({ label: 'How to Play', kind: 'quiet', block: true, onClick: () => this.openHowTo() });
    this.buttons = [newWorld, settings, howTo, ...(resume ? [resume] : [])];
    this.menu.replaceChildren(
      ...(resume ? [resume.el] : []),
      h(
        'div',
        { class: 'hw-title__new' },
        newWorld.el,
        this.seed.el,
        h(
          'div',
          { class: 'hw-title__difficulty' },
          h('span', { class: 'hw-title__label', text: 'Difficulty' }),
          this.difficulty.el,
          this.difficultyHint,
        ),
      ),
      h('div', { class: 'hw-title__pair' }, settings.el, howTo.el),
    );
  }

  private newWorld(): void {
    const seed = this.seed.value.trim();
    this.opts.onNewWorld(seed === '' ? null : seed);
  }

  /** Every settings change made on the title (its Settings window or the New World difficulty) goes through here. */
  private changeSettings(settings: Settings, key: keyof Settings): void {
    this.settings = settings;
    if (key === 'difficulty') {
      this.difficulty.set(settings.difficulty);
      setText(this.difficultyHint, difficultyHint(settings.difficulty));
    }
    applyUiScale(this.root.el, settings.uiScale);
    this.opts.onSettingsChange({ ...settings }, key);
  }

  private openSub(win: Window): void {
    this.sub = win;
    win.open(this.root.layers.windows);
  }

  private openSettings(): void {
    const panel = new SettingsPanel({
      settings: this.settings,
      onChange: (settings, key) => this.changeSettings(settings, key),
    });
    this.openSub(new Window({ title: 'Settings', size: 'md', body: panel.el, onClose: () => (this.sub = null) }));
  }

  private openHowTo(): void {
    this.openSub(new Window({ title: 'How to Play', size: 'md', body: new HowToPlay(this.opts.controls).el, onClose: () => (this.sub = null) }));
  }
}
