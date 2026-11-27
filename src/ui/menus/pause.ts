/** The pause menu: one small window whose body switches between the menu, Settings and How to Play. */
import type { Settings } from '../../core/context';
import { Button } from '../kit/controls';
import { h } from '../kit/dom';
import type { UIRoot } from '../kit/root';
import { Window } from '../kit/window';
import { HowToPlay, type HowToPlayOptions } from './howto';
import { SettingsPanel } from './settings';

export interface PauseMenuOptions {
  settings: Settings;
  /** Same contract as SettingsPanel: called on every change with a fresh copy. */
  onSettingsChange: (settings: Settings, key: keyof Settings) => void;
  /** The menu was closed to keep playing (Resume, the close button or Escape). */
  onResume: () => void;
  /** "Save and quit to title" was chosen. The menu has already closed; `onResume` is not called. */
  onQuit: () => void;
  /** When given, a Town entry opens the Town page (the world has a town to show). */
  onTown?: () => void;
  /** Open the Hearth Log scrolled to its Journal or Achievements (the menu closes first). */
  onLog?: (focus: 'journal' | 'achievements') => void;
  /** The Dev Mode switch shown in Settings (see SettingsPanelOptions.dev). */
  dev?: { get(): boolean; set(on: boolean): void };
  /** Control lists for How to Play, when the real bindings differ from the defaults. */
  controls?: HowToPlayOptions;
}

type View = 'menu' | 'settings' | 'howto';
const TITLES: Record<View, string> = { menu: 'Paused', settings: 'Settings', howto: 'How to Play' };

export class PauseMenu {
  private readonly root: UIRoot;
  private readonly opts: PauseMenuOptions;
  private settings: Settings;
  private win: Window | null = null;
  private backButton: HTMLElement | null = null;
  private quitting = false;

  constructor(root: UIRoot, opts: PauseMenuOptions) {
    this.root = root;
    this.opts = opts;
    this.settings = { ...opts.settings };
  }

  get isOpen(): boolean {
    return this.win?.isOpen ?? false;
  }

  /**
   * The menu's window, built ready to open but not attached (GameUI opens it itself, as a screen).
   * Each call after the previous window closed builds a fresh one.
   */
  get window(): Window {
    return this.win ?? this.build();
  }

  /** Opens the menu in the root's window layer (closing any other window). */
  open(): void {
    const win = this.window;
    if (!win.isOpen) win.open(this.root.layers.windows);
  }

  private build(): Window {
    this.quitting = false;
    const back = new Button({ label: 'Back', kind: 'quiet', size: 'sm', icon: 'back', onClick: () => this.show('menu') });
    back.el.hidden = true;
    const win = new Window({
      title: TITLES.menu,
      size: 'sm',
      headerRight: back.el,
      onClose: () => {
        this.win = null;
        if (!this.quitting) this.opts.onResume();
      },
    });
    this.win = win;
    this.backButton = back.el;
    this.show('menu');
    return win;
  }

  /** Closes the menu as if Resume had been pressed. */
  close(): void {
    this.win?.close();
  }

  /** Updates the values the Settings view starts from (after a save was loaded). */
  setSettings(settings: Settings): void {
    this.settings = { ...settings };
  }

  private show(view: View): void {
    const win = this.win;
    if (!win) return;
    win.setTitle(TITLES[view]);
    if (this.backButton) this.backButton.hidden = view === 'menu';
    if (view === 'menu') win.setBody(this.menuView());
    else if (view === 'settings') {
      win.setBody(
        new SettingsPanel({
          settings: this.settings,
          dev: this.opts.dev,
          onChange: (settings, key) => {
            this.settings = settings;
            this.opts.onSettingsChange(settings, key);
          },
        }).el,
      );
    } else win.setBody(new HowToPlay(this.opts.controls).el);
  }

  private menuView(): HTMLElement {
    const quit = (): void => {
      this.quitting = true;
      this.win?.close();
      this.opts.onQuit();
    };
    return h(
      'div',
      { class: 'hw-menu' },
      new Button({ label: 'Resume', kind: 'primary', size: 'lg', block: true, icon: 'play', onClick: () => this.close() }).el,
      this.opts.onTown ? new Button({ label: 'Town', block: true, onClick: () => this.opts.onTown?.() }).el : null,
      this.opts.onLog ? new Button({ label: 'Journal', block: true, onClick: () => this.opts.onLog?.('journal') }).el : null,
      this.opts.onLog ? new Button({ label: 'Achievements', block: true, onClick: () => this.opts.onLog?.('achievements') }).el : null,
      new Button({ label: 'Settings', block: true, onClick: () => this.show('settings') }).el,
      new Button({ label: 'How to Play', block: true, onClick: () => this.show('howto') }).el,
      h('div', { class: 'hw-menu__gap' }),
      new Button({ label: 'Save and quit to title', kind: 'quiet', block: true, onClick: quit }).el,
    );
  }
}
