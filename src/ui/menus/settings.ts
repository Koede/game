/** The settings form, bound to the Settings contract. Used inside the title screen's and the pause menu's windows. */
import { PHONE_MAX_RENDER_DISTANCE, isTouchFirst, type Settings } from '../../core/context';
import { Segmented, Slider, Toggle } from '../kit/controls';
import { h } from '../kit/dom';
import { formatPercent } from '../kit/format';
import { PRESETS, applyPreset, detectPreset, presetById, type PresetId } from './settingsPresets';
import { DIFFICULTY_OPTIONS, ITEM_MAGNET_OPTIONS, difficultyHint, itemMagnetHint, UI_SCALE_OPTIONS, uiScaleHint } from './settingsText';

/** Ranges the sliders offer. Values outside them (from an old save) are shown clamped by the slider. */
export const SETTINGS_LIMITS = {
  renderDistance: { min: 2, max: 12, step: 1 },
  fov: { min: 55, max: 100, step: 1 },
  sensitivity: { min: 0.2, max: 3, step: 0.1 },
  volume: { min: 0, max: 1, step: 0.05 },
} as const;

export interface SettingsPanelOptions {
  /** Current values. The panel works on its own copy. */
  settings: Settings;
  /** Called on EVERY change (also while a slider is dragged) with a fresh copy and the key that changed. */
  onChange: (settings: Settings, key: keyof Settings) => void;
  /** With a world open: the Dev Mode switch (on, off, any time). Absent on the title screen, where the mode is chosen for a new world. */
  dev?: { get(): boolean; set(on: boolean): void };
}

const speed = (v: number): string => `${v.toFixed(1)}×`;

/** A mouse (or trackpad) is attached: without one the mouse setting means nothing to the player. */
const hasMouse = (): boolean => typeof matchMedia !== 'function' || matchMedia('(any-pointer: fine)').matches;

export class SettingsPanel {
  readonly el: HTMLDivElement;
  private current: Settings;
  private readonly onChange: (settings: Settings, key: keyof Settings) => void;
  private readonly sync: (() => void)[] = [];
  /** Keeps the Quick setup row honest when a single value is changed by hand. */
  private refreshPresets: (() => void) | null = null;

  constructor(opts: SettingsPanelOptions) {
    this.current = { ...opts.settings };
    this.onChange = opts.onChange;
    const L = SETTINGS_LIMITS;
    this.el = h(
      'div',
      { class: 'hw-settings' },
      this.section('Quick setup', this.presets()),
      this.section('Game', this.choice('difficulty', 'Difficulty', DIFFICULTY_OPTIONS, difficultyHint), this.choice('itemMagnet', 'Item magnet', ITEM_MAGNET_OPTIONS, itemMagnetHint), opts.dev ? this.devSwitch(opts.dev) : null),
      this.section(
        'View',
        this.choice('uiScale', 'Text and button size', UI_SCALE_OPTIONS, uiScaleHint),
        this.slider('renderDistance', 'Render distance', 'How far the world is drawn (phones start at 4, computers at 6). Lower it if the game stutters.', { ...L.renderDistance, max: isTouchFirst() ? PHONE_MAX_RENDER_DISTANCE : L.renderDistance.max }, (v) => `${v} chunks`),
        this.slider('fov', 'Field of view', '', L.fov, (v) => `${v}°`),
        this.toggle('showFps', 'Show frame rate', ''),
      ),
      this.section(
        'Controls',
        hasMouse() ? this.slider('mouseSensitivity', 'Mouse look speed', '', L.sensitivity, speed) : null,
        this.slider('touchSensitivity', 'Touch look speed', '', L.sensitivity, speed),
            this.toggle('invertY', 'Invert vertical look', ''),
        this.touchControls(),
      ),
      this.section(
        'Accessibility',
        this.toggle('reduceMotion', 'Reduce motion', 'No view bob, sprint zoom, landing dip, screen shake, flashes, pulses or sliding. Bars and counters still update.'),
        this.toggle('colorSafe', 'Colour-blind-safe colours', 'Good, warning and bad show as blue, yellow and orange instead of green, yellow and red.'),
      ),
      this.section(
        'Feel',
        this.toggle('moveAssist', 'Forgiving jumps', 'A jump pressed just after leaving a ledge, or just before landing, still counts.'),
        this.toggle('autoStep', 'Auto-step', 'Walk up one-block ledges without jumping (on by default on phones).'),
        this.toggle('haptics', 'Vibration', 'Short buzzes on phones for mining, crafting and getting hurt.'),
      ),
      this.section('Sound', this.slider('volume', 'Volume', '', L.volume, formatPercent)),
    );
  }

  /** A copy of the values as the panel currently shows them. */
  get settings(): Settings {
    return { ...this.current };
  }

  /** Shows other values (after loading a save) without calling onChange. */
  set(settings: Settings): void {
    this.current = { ...settings };
    for (const fn of this.sync) fn();
  }

  private change<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    this.onChange({ ...this.current }, key);
    this.refreshPresets?.();
  }

  private section(title: string, ...rows: (HTMLElement | null)[]): HTMLElement {
    return h('section', { class: 'hw-settings__section' }, h('h3', { class: 'hw-heading', text: title }), rows);
  }

  private row(label: string, hint: string | HTMLElement, control: HTMLElement, wide: boolean): HTMLElement {
    const hintEl = typeof hint === 'string' ? (hint ? h('div', { class: 'hw-setting__hint', text: hint }) : null) : hint;
    return h(
      'div',
      { class: ['hw-setting', wide && 'hw-setting--wide'] },
      h('div', { class: 'hw-setting__text' }, h('div', { class: 'hw-setting__label', text: label }), hintEl),
      h('div', { class: 'hw-setting__control' }, control),
    );
  }

  /** A segmented choice whose hint says what the picked value means (Difficulty, UI size). */
  private choice<K extends 'difficulty' | 'uiScale' | 'itemMagnet'>(
    key: K,
    label: string,
    options: readonly { value: Settings[K]; label: string }[],
    hintOf: (value: Settings[K]) => string,
  ): HTMLElement {
    const hint = h('div', { class: 'hw-setting__hint', text: hintOf(this.current[key]) });
    const seg = new Segmented<Settings[K]>({
      label,
      options: [...options],
      value: this.current[key],
      onChange: (v) => {
        hint.textContent = hintOf(v);
        this.change(key, v);
      },
    });
    this.sync.push(() => {
      seg.set(this.current[key]);
      hint.textContent = hintOf(this.current[key]);
    });
    return this.row(label, hint, seg.el, true);
  }

  private slider(
    key: 'renderDistance' | 'fov' | 'mouseSensitivity' | 'touchSensitivity' | 'volume',
    label: string,
    hint: string,
    limits: { min: number; max: number; step: number },
    format: (value: number) => string,
  ): HTMLElement {
    const slider = new Slider({ label, ...limits, value: this.current[key], format, onChange: (v) => this.change(key, v) });
    this.sync.push(() => slider.set(this.current[key]));
    return this.row(label, hint, slider.el, true);
  }

  private toggle(key: 'invertY' | 'showFps' | 'moveAssist' | 'autoStep' | 'reduceMotion' | 'colorSafe' | 'haptics', label: string, hint: string): HTMLElement {
    const toggle = new Toggle({ label, value: this.current[key], onChange: (v) => this.change(key, v) });
    this.sync.push(() => toggle.set(this.current[key]));
    return this.row(label, hint, toggle.el, false);
  }

  /** Phone: light / Phone: pretty / Desktop in one tap; shows none picked once a slider has been moved by hand. */
  private presets(): HTMLElement {
    const label = 'Quick setup';
    const touch = isTouchFirst();
    const pick = (): PresetId => (detectPreset(this.current, touch) ?? 'custom') as PresetId;
    const hintOf = (id: PresetId | 'custom'): string => (id === 'custom' ? 'Pick one to set the view distance and picture width. You can still fine-tune below.' : presetById(id).hint);
    const hint = h('div', { class: 'hw-setting__hint', text: hintOf(pick()) });
    const seg = new Segmented<PresetId>({
      label,
      options: PRESETS.map((p) => ({ value: p.id, label: p.label })),
      value: pick(),
      onChange: (id) => {
        const next = applyPreset(this.current, id, touch);
        for (const key of ['renderDistance', 'fov', 'showFps'] as const) this.change(key, next[key]);
        for (const fn of this.sync) fn();
      },
    });
    this.refreshPresets = () => {
      seg.set(pick());
      hint.textContent = hintOf(pick());
    };
    this.sync.push(this.refreshPresets);
    return this.row(label, hint, seg.el, true);
  }

  /** Dev Mode: creative items, no damage or hunger, free building, flight. Off again with the same switch. */
  private devSwitch(dev: { get(): boolean; set(on: boolean): void }): HTMLElement {
    const label = 'Dev Mode';
    const toggle = new Toggle({ label, value: dev.get(), onChange: (v) => dev.set(v) });
    this.sync.push(() => toggle.set(dev.get()));
    return this.row(label, 'Creative item menu, no damage or hunger, free building and flight. Switch it off again here to play as survival.', toggle.el, false);
  }

  private touchControls(): HTMLElement {
    const label = 'On-screen controls';
    const seg = new Segmented<Settings['touchControls']>({
      label,
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ],
      value: this.current.touchControls,
      onChange: (v) => this.change('touchControls', v),
    });
    this.sync.push(() => seg.set(this.current.touchControls));
    return this.row(label, 'Auto shows them on devices with a touch screen.', seg.el, true);
  }
}
