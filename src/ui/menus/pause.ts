/** The pause menu: one small window whose body switches between the menu, Settings and How to Play. */
import type { Settings } from '../../core/context';
import { Button } from '../kit/controls';
import { h } from '../kit/dom';
import type { UIRoot } from '../kit/root';
import { Window } from '../kit/window';
import { SearchBox, matches } from '../kit/search';
import { HowToPlay, howToTopics, type HowToPlayOptions } from './howto';
import { SettingsPanel } from './settings';

/** A page the pause menu can jump to: it shows as a button, and the search finds it by label, hint or keywords. */
export interface PageLink {
  id: string;
  label: string;
  /** One short line on what the page holds. */
  hint: string;
  /** Extra words the search matches (older names, what is inside). */
  keywords?: string;
  /** Hidden while false (a page the player has not unlocked). Read each time the menu opens. */
  available?: () => boolean;
  open: () => void;
}

export interface PauseMenuOptions {
  /** Pages shown as buttons under Resume and found by the search (Hearth Log, Notebook, Workshop Guide, Jobs, Town...). */
  pages?: readonly PageLink[];
  settings: Settings;
  /** Same contract as SettingsPanel: called on every change with a fresh copy. */
  onSettingsChange: (settings: Settings, key: keyof Settings) => void;
  /** The menu was closed to keep playing (Resume, the close button or Escape). */
  onResume: () => void;
  /** "Save and quit to title" was chosen. The menu has already closed; `onResume` is not called. */
  onQuit: () => void;
  /** When given, a Town entry opens the Town page (the world has a town to show). */
  onTown?: () => void;
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

  private show(view: View, query = ''): void {
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
    } else win.setBody(new HowToPlay({ ...this.opts.controls, query }).el);
  }

  /** The page links that are available now: the Town entry (older option) joins `pages` unless one is already there. */
  private pageLinks(): PageLink[] {
    const links = (this.opts.pages ?? []).filter((p) => p.available?.() !== false);
    if (this.opts.onTown && !links.some((p) => p.id === 'town')) {
      links.push({ id: 'town', label: 'Town', hint: 'Gruk\'s building, who lives where', keywords: 'settlement villagers residents camp', open: () => this.opts.onTown?.() });
    }
    return links;
  }

  private menuView(): HTMLElement {
    const quit = (): void => {
      this.quitting = true;
      this.win?.close();
      this.opts.onQuit();
    };
    const pages = this.pageLinks();
    const settingsWords = 'settings options difficulty peaceful hard graphics quality ui size large sound volume music loot filter magnet dev mode controls sensitivity fps';
    const settingsLink: PageLink = { id: 'settings', label: 'Settings', hint: 'Difficulty, graphics, sound, controls', keywords: settingsWords, open: () => this.show('settings') };
    const howtoLink: PageLink = { id: 'howto', label: 'How to Play', hint: 'The loop, staying alive, controls', keywords: 'help guide tutorial controls keys', open: () => this.show('howto') };
    const all: PageLink[] = [...pages, settingsLink, howtoLink];
    const topics = howToTopics(this.opts.controls);
    const list = h('div', { class: 'hw-menu__pages' });
    const results = h('div', { class: 'hw-menu__results', attrs: { role: 'list', 'aria-label': 'Search results' } });
    results.hidden = true;
    const none = h('p', { class: 'hw-menu__none', text: 'Nothing found. Try one word: "water", "jobs", "aspects".' });
    none.hidden = true;
    const row = (p: PageLink): HTMLElement => {
      const b = new Button({ label: p.label, block: true, onClick: p.open }).el;
      b.dataset.page = p.id;
      return b;
    };
    const result = (title: string, hint: string, open: () => void, id: string): HTMLElement => {
      const b = h('button', { class: 'hw-menu__result', attrs: { type: 'button', role: 'listitem', 'data-result': id } }, h('strong', { text: title }), h('span', { text: hint }));
      b.addEventListener('click', open);
      return b;
    };
    list.append(...pages.map(row), h('div', { class: 'hw-menu__pair' }, row(settingsLink), row(howtoLink)));
    const search = new SearchBox({
      label: 'Search pages and help',
      placeholder: 'Search pages and help',
      onInput: (q) => {
        const query = q.trim();
        list.hidden = query !== '';
        results.replaceChildren();
        if (!query) {
          results.hidden = true;
          none.hidden = true;
          return;
        }
        const found: HTMLElement[] = all.filter((p) => matches(query, p.label, p.hint, p.keywords)).map((p) => result(p.label, p.hint, p.open, p.id));
        const hits = topics.filter((t) => matches(query, t.section, t.text));
        if (hits.length) {
          const sections = [...new Set(hits.map((t) => t.section))];
          found.push(result(`How to Play: ${hits.length} match${hits.length === 1 ? '' : 'es'}`, `${sections.join(', ')} - "${hits[0].text.slice(0, 80)}${hits[0].text.length > 80 ? '...' : ''}"`, () => this.show('howto', query), 'howto-hits'));
        }
        results.replaceChildren(...found);
        results.hidden = found.length === 0;
        none.hidden = found.length > 0;
      },
    });
    return h(
      'div',
      { class: 'hw-menu' },
      new Button({ label: 'Resume', kind: 'primary', size: 'lg', block: true, icon: 'play', onClick: () => this.close() }).el,
      search.el,
      list,
      results,
      none,
      h('div', { class: 'hw-menu__gap' }),
      new Button({ label: 'Save and quit to title', kind: 'quiet', block: true, onClick: quit }).el,
    );
  }
}
