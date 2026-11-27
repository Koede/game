/** The settings form, bound to the Settings contract. Used inside the title screen's and the pause menu's windows. */
import { PHONE_MAX_RENDER_DISTANCE, isTouchFirst, type Settings } from '../../core/context';
import { Button, Segmented, Slider, Toggle } from '../kit/controls';
import { h } from '../kit/dom';
import { formatPercent } from '../kit/format';
import { PRESETS, applyPreset, detectPreset, presetById, type PresetId } from './settingsPresets';
import { COLOR_MODE_OPTIONS, DIFFICULTY_OPTIONS, colorModeHint, GRAPHICS_OPTIONS, ITEM_MAGNET_OPTIONS, LOOT_FILTER_OPTIONS, difficultyHint, graphicsHint, itemMagnetHint, lootFilterHint, UI_SCALE_OPTIONS, uiScaleHint } from './settingsText';

/** Ranges the sliders offer. Values outside them (from an old save) are shown clamped by the slider. */
export const SETTINGS_LIMITS = {
  renderDistance: { min: 2, max: 12, step: 1 },
  fov: { min: 55, max: 100, step: 1 },
  sensitivity: { min: 0.2, max: 3, step: 0.1 },
  volume: { min: 0, max: 1, step: 0.05 },
  textScale: { min: 0.85, max: 1.6, step: 0.05 },
  hudScale: { min: 0.8, max: 1.5, step: 0.05 },
} as const;

/** Backing up and restoring the saved world (title screen: all of it; elsewhere only `backUp`). Every action answers with a line to show. */
export interface SaveTools {
  /** A world is stored. */
  hasWorld(): boolean;
  /** Offers the saved world as a file. */
  backUp(): Promise<string>;
  /** The saved world as text, for copying where a download is blocked; null when there is none. */
  text?(): string | null;
  /** Replaces the saved world with the text of a backup (file or pasted). Absent while a world is open. */
  restore?(text: string): string;
  /** When the previous autosave was written, or null when there is none. Absent while a world is open. */
  earlier?(): { label: string } | null;
  /** Brings back the previous autosave. */
  restoreEarlier?(): string;
}

export interface SettingsPanelOptions {
  /** Current values. The panel works on its own copy. */
  settings: Settings;
  /** Called on EVERY change (also while a slider is dragged) with a fresh copy and the key that changed. */
  onChange: (settings: Settings, key: keyof Settings) => void;
  /** With a world open: the Dev Mode switch (on, off, any time). Absent on the title screen, where the mode is chosen for a new world. */
  dev?: { get(): boolean; set(on: boolean): void };
  /** Adds a Saves section: back up the world to a file, restore one, or go back to the previous autosave. */
  saves?: SaveTools;
}

const speed = (v: number): string => `${v.toFixed(1)}×`;
const percent = (v: number): string => `${Math.round(v * 100)}%`;

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
      this.section('Game', this.choice('difficulty', 'Difficulty', DIFFICULTY_OPTIONS, difficultyHint), this.choice('itemMagnet', 'Item magnet', ITEM_MAGNET_OPTIONS, itemMagnetHint), this.choice('lootFilter', 'Loot', LOOT_FILTER_OPTIONS, lootFilterHint), opts.dev ? this.devSwitch(opts.dev) : null),
      this.section(
        'View',
        this.choice('uiScale', 'Text and button size', UI_SCALE_OPTIONS, uiScaleHint),
        this.slider('renderDistance', 'Render distance', 'How far the world is drawn (phones start at 4, computers at 6). Lower it if the game stutters.', { ...L.renderDistance, max: isTouchFirst() ? PHONE_MAX_RENDER_DISTANCE : L.renderDistance.max }, (v) => `${v} chunks`),
        this.choice('graphics', 'Graphics', GRAPHICS_OPTIONS, graphicsHint),
        this.slider('fov', 'Field of view', '', L.fov, (v) => `${v}°`),
        this.toggle('showFps', 'Show frame rate', ''),
      ),
      this.section(
        'Controls',
        hasMouse() ? this.slider('mouseSensitivity', 'Mouse look speed', '', L.sensitivity, speed) : null,
        this.slider('touchSensitivity', 'Touch look speed', '', L.sensitivity, speed),
            this.toggle('invertY', 'Invert vertical look', ''),
        this.touchControls(),
        this.oneHanded(),
      ),
      this.section(
        'Accessibility',
        this.toggle('reduceMotion', 'Reduce motion', 'No view bob, sprint zoom, landing dip, flashes, pulses or sliding. Bars and counters still update.'),
        this.choice('colorMode', 'Colour-blind palette', COLOR_MODE_OPTIONS, colorModeHint),
        this.slider('textScale', 'Text size', 'Scales every word in the menus and the HUD.', L.textScale, percent),
        this.slider('hudScale', 'HUD and button size', 'Scales the meters, hotbar, compass and the touch buttons.', L.hudScale, percent),
        this.toggle('tapToMove', 'Tap to move', 'Tap the ground to walk there. Touching the stick or a key stops the walk. A tap no longer presses Use: use the Use button.'),
      ),
      this.section(
        'Feel',
        this.toggle('moveAssist', 'Forgiving jumps', 'A jump pressed just after leaving a ledge, or just before landing, still counts.'),
        this.toggle('autoStep', 'Auto-step', 'Walk up one-block ledges without jumping (on by default on phones).'),
        this.toggle('haptics', 'Vibration', 'Short buzzes on phones for mining, crafting and getting hurt.'),
        this.toggle('keepAwake', 'Keep screen on', 'The screen does not dim or sleep while you play. Letting go of the game (pause, another app) lets it sleep as usual.'),
        this.toggle('autoBuck', 'Auto-buck felled trees', 'A felled log is cut into pieces as soon as it lands. Off: cut it piece by piece with the axe.'),
        this.toggle('treeDamage', 'Tree damage to me', 'Falling trees hurt you and animals under them. Off for a relaxed game; trees still fall.'),
      ),
      this.section('Sound', this.slider('volume', 'Volume', '', L.volume, formatPercent)),
      opts.saves ? this.section('Saves', ...this.saveRows(opts.saves)) : null,
    );
  }

  /**
   * Back up and restore. The published page runs in a sandboxed frame where downloads and file pickers can be blocked, so
   * every step also works as text (a save is a few tens of KB): show it to copy, paste it to restore.
   * Restores replace the saved world, so the old one is kept as the earlier save (and the earlier save is a held button).
   */
  private saveRows(tools: SaveTools): HTMLElement[] {
    const status = h('div', { class: 'hw-setting__hint hw-saves__status', attrs: { role: 'status', 'aria-live': 'polite' } });
    const say = (line: string): void => {
      status.textContent = line;
    };
    const box = (label: string, readOnly: boolean): HTMLTextAreaElement => {
      const area = h('textarea', { class: 'hw-saves__text', attrs: { 'aria-label': label, rows: '5', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' } }) as HTMLTextAreaElement;
      area.readOnly = readOnly;
      area.hidden = true;
      return area;
    };
    const stack = (...kids: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'hw-saves__stack' }, kids);

    // --- back up ---
    const shown = box('Backup text', true);
    const fileBtn = new Button({
      label: 'Download a file',
      block: true,
      onClick: () => {
        if (!tools.hasWorld()) return say('There is no saved world to back up yet.');
        void tools.backUp().then(say, () => say('The backup could not be made.'));
      },
    });
    const textBtn = new Button({
      label: 'Show it as text to copy',
      block: true,
      kind: 'quiet',
      onClick: () => {
        const text = tools.text?.() ?? null;
        if (text === null) return say('There is no saved world to back up yet.');
        shown.value = text;
        shown.hidden = false;
        shown.focus();
        shown.select();
        const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        if (clip && typeof clip.writeText === 'function') clip.writeText(text).then(() => say('Copied. Paste it somewhere safe, e.g. a note to yourself.'), () => say('Select the text below and copy it.'));
        else say('Select the text below and copy it.');
      },
    });
    const rows: HTMLElement[] = [
      this.row('Back up', 'Saves live in this browser only. Keep a copy: restore it here later, or on another device. If the download is blocked here, use the text.', stack(fileBtn.el, tools.text ? textBtn.el : null, shown), true),
    ];

    // --- restore ---
    let earlierRow: HTMLElement | null = null;
    const refreshEarlier = (): void => {
      if (!tools.earlier || !tools.restoreEarlier) return;
      const restoreEarlier = tools.restoreEarlier;
      const found = tools.earlier();
      const next = found
        ? this.row(
            'Earlier save',
            `Written ${found.label}. Brings it back in place of the current world; the current one becomes the earlier save.`,
            new Button({
              label: 'Go back to it',
              block: true,
              holdMs: 1200,
              hint: 'Hold - replaces your saved world',
              onClick: () => {
                say(restoreEarlier());
                refreshEarlier();
              },
            }).el,
            true,
          )
        : null;
      if (earlierRow && next) earlierRow.replaceWith(next);
      else if (earlierRow) earlierRow.remove();
      else if (next) status.before(next);
      earlierRow = next;
    };
    if (tools.restore) {
      const restore = tools.restore;
      const done = (line: string): void => {
        say(line);
        refreshEarlier();
      };
      const input = h('input', { attrs: { type: 'file', accept: '.json,application/json', hidden: 'hidden', 'aria-label': 'Backup file' } }) as HTMLInputElement;
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        file.text().then((text) => done(restore(text)), () => say('That file could not be read.'));
      });
      const pickBtn = new Button({ label: 'Restore from a file', block: true, onClick: () => input.click() });
      const pasted = box('Backup text to restore', false);
      const apply = new Button({ label: 'Restore this text', block: true, onClick: () => done(restore(pasted.value.trim())) });
      apply.el.hidden = true;
      const pasteBtn = new Button({
        label: 'Restore from pasted text',
        block: true,
        kind: 'quiet',
        onClick: () => {
          pasted.hidden = false;
          apply.el.hidden = false;
          pasted.focus();
        },
      });
      rows.push(this.row('Restore', 'Pick a backup file, or paste its text. It replaces the saved world; the world it replaces is kept as the earlier save.', stack(pickBtn.el, input, pasteBtn.el, pasted, apply.el), true));
    }
    rows.push(status);
    refreshEarlier();
    return rows;
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
  private choice<K extends 'difficulty' | 'uiScale' | 'colorMode' | 'itemMagnet' | 'lootFilter' | 'graphics'>(
    key: K,
    label: string,
    options: readonly { value: Settings[K]; label: string }[],
    hintOf: (value: Settings[K]) => string,
  ): HTMLElement {
    const hint = h('div', { class: 'hw-setting__hint', text: hintOf(this.current[key]) });
    // Segmented works on strings; every choice in this row is a string union (Graphics is optional on Settings, hence the casts).
    const seg = new Segmented<string>({
      label,
      options: options.map((o) => ({ value: o.value as string, label: o.label })),
      value: this.current[key] as string,
      onChange: (v) => {
        hint.textContent = hintOf(v as Settings[K]);
        this.change(key, v as Settings[K]);
      },
    });
    this.sync.push(() => {
      seg.set(this.current[key] as string);
      hint.textContent = hintOf(this.current[key]);
    });
    return this.row(label, hint, seg.el, true);
  }

  private slider(
    key: 'renderDistance' | 'fov' | 'mouseSensitivity' | 'touchSensitivity' | 'volume' | 'textScale' | 'hudScale',
    label: string,
    hint: string,
    limits: { min: number; max: number; step: number },
    format: (value: number) => string,
  ): HTMLElement {
    const slider = new Slider({ label, ...limits, value: this.current[key], format, onChange: (v) => this.change(key, v) });
    this.sync.push(() => slider.set(this.current[key]));
    return this.row(label, hint, slider.el, true);
  }

  private toggle(key: 'invertY' | 'showFps' | 'moveAssist' | 'autoStep' | 'reduceMotion' | 'tapToMove' | 'haptics' | 'keepAwake' | 'autoBuck' | 'treeDamage', label: string, hint: string): HTMLElement {
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

  private oneHanded(): HTMLElement {
    const label = 'One-handed layout';
    const seg = new Segmented<Settings['oneHanded']>({
      label,
      options: [
        { value: 'off', label: 'Off' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
      value: this.current.oneHanded,
      onChange: (v) => this.change('oneHanded', v),
    });
    this.sync.push(() => seg.set(this.current.oneHanded));
    return this.row(label, 'Puts the stick and the buttons under one thumb. Look by dragging the upper screen.', seg.el, true);
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
