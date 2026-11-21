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
    return this.win !== null;
  }

  /** Opens the menu in the root's window layer (closing any other window). */
  open(): void {
    if (this.win) return;
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
    win.open(this.root.layers.windows);
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
      new Button({ label: 'Settings', block: true, onClick: () => this.show('settings') }).el,
      new Button({ label: 'How to Play', block: true, onClick: () => this.show('howto') }).el,
      h('div', { class: 'hw-menu__gap' }),
      new Button({ label: 'Save and quit to title', kind: 'quiet', block: true, onClick: quit }).el,
    );
  }
}
