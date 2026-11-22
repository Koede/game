/** The scrolling recipe list with optional category chips. This is the game's tech tree as the player sees it. */
import { h, setAttr, setText } from './dom';
import { Chip } from './gauges';
import { RecipeRow, type RecipeRowView } from './recipe';
import { edgeFade } from './scrollFade';

export interface RecipeCategory {
  id: string;
  label: string;
}

export interface RecipeListOptions {
  /** Accessible name of the list. */
  label: string;
  /** The player asked to make recipe `id` `count` times (1, or the batch size). */
  onMake: (id: string, count: number) => void;
  /** Filter chips above the list. An "All" chip is added in front. Rows match by `RecipeRowView.category`. */
  categories?: readonly RecipeCategory[];
  /** Batch size of the second button. 0 removes it. Default 5. */
  many?: number;
  /** Shown when there is nothing to list. */
  emptyText?: string;
  /** Called when the player picks a category chip (null = All). */
  onCategory?: (id: string | null) => void;
  /**
   * Simple list: rows are simple rows (see RecipeRowOptions.simple) and a two-way switch sits on top: "Can make now"
   * (the default while anything can be made) or "Everything". The category chips show only under Everything.
   */
  simple?: boolean;
}

type Mode = 'ready' | 'all';
/** What the player chose per list for the session (a simple list follows the ingredients until they choose). */
const chosenModes = new Map<string, Mode>();

const ALL = '';

export class RecipeList {
  readonly el: HTMLDivElement;
  private readonly scroller: HTMLDivElement;
  private readonly emptyEl: HTMLParagraphElement;
  private readonly rows = new Map<string, RecipeRow>();
  private readonly chips = new Map<string, Chip>();
  private readonly readyCounts = new Map<string, number>();
  private readonly onMake: (id: string, count: number) => void;
  private readonly many: number | undefined;
  private readonly emptyText: string;
  private views: readonly RecipeRowView[] = [];
  private active = ALL;
  private readonly simple: boolean;
  private readonly label: string;
  private readonly modeChips = new Map<Mode, Chip>();
  private readonly catBar: HTMLDivElement | null;
  private mode: Mode = 'ready';

  constructor(opts: RecipeListOptions) {
    this.onMake = opts.onMake;
    this.many = opts.many;
    this.simple = opts.simple ?? false;
    this.label = opts.label;
    this.emptyText = opts.emptyText ?? 'Nothing to make here yet.';
    this.emptyEl = h('p', { class: 'hw-recipes__empty', text: this.emptyText });
    this.scroller = h('div', { class: 'hw-recipes__scroll', attrs: { role: 'list', 'aria-label': opts.label, tabindex: 0 } }, this.emptyEl);
    const categories = opts.categories ?? [];
    let catBar: HTMLDivElement | null = null;
    if (categories.length > 0) {
      catBar = h('div', { class: 'hw-recipes__cats', attrs: { role: 'toolbar', 'aria-label': `${opts.label} categories` } });
      for (const cat of [{ id: ALL, label: 'All' }, ...categories]) {
        const chip = new Chip({
          label: cat.label,
          selected: cat.id === ALL,
          onClick: () => {
            this.setCategory(cat.id === ALL ? null : cat.id);
            opts.onCategory?.(this.category);
          },
        });
        this.chips.set(cat.id, chip);
        catBar.appendChild(chip.el);
      }
      edgeFade(catBar);
    }
    this.catBar = catBar;
    let modeBar: HTMLDivElement | null = null;
    if (this.simple) {
      modeBar = h('div', { class: 'hw-recipes__mode', attrs: { role: 'toolbar', 'aria-label': `${opts.label} filter` } });
      for (const [mode, label] of [['ready', 'Can make now'], ['all', 'Everything']] as const) {
        const chip = new Chip({ label, selected: false, onClick: () => this.choose(mode) });
        this.modeChips.set(mode, chip);
        modeBar.appendChild(chip.el);
      }
      this.mode = chosenModes.get(opts.label) ?? 'ready';
    }
    this.el = h('div', { class: 'hw-recipes' }, modeBar, catBar, this.scroller);
    this.syncMode();
  }

  /** The player's pick of the two views (simple lists). */
  private choose(mode: Mode): void {
    chosenModes.set(this.label, mode);
    this.mode = mode;
    this.syncMode();
    this.applyFilter();
    this.scroller.scrollTop = 0;
  }

  private syncMode(): void {
    if (!this.simple) return;
    for (const [mode, chip] of this.modeChips) chip.setSelected(mode === this.mode);
    if (this.catBar) this.catBar.hidden = this.mode !== 'all';
    setAttr(this.el, 'data-mode', this.mode);
  }

  /** The selected category id, or null for All. */
  get category(): string | null {
    return this.active === ALL ? null : this.active;
  }

  /** Shows only one category (null = All) without calling onCategory. */
  setCategory(id: string | null): void {
    const next = id ?? ALL;
    if (next === this.active || !this.chips.has(next)) return;
    this.chips.get(this.active)?.setSelected(false);
    this.active = next;
    const chip = this.chips.get(next);
    chip?.setSelected(true);
    // The chip bar scrolls sideways on phones: keep the picked chip fully in view.
    chip?.el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.applyFilter();
    this.scroller.scrollTop = 0;
  }

  /**
   * Shows these recipes in this order. Rows are matched by id and updated in place: the scroll position,
   * focus and any pressed button survive, so this is safe to call several times per second.
   */
  setRows(views: readonly RecipeRowView[]): void {
    this.views = views;
    const seen = new Set<string>();
    let moved = false;
    const scrollTop = this.scroller.scrollTop;
    let cursor: Element | null = this.scroller.firstElementChild;
    for (const view of views) {
      seen.add(view.id);
      let row = this.rows.get(view.id);
      if (row) row.update(view);
      else {
        row = new RecipeRow(view, { onMake: this.onMake, many: this.many, simple: this.simple });
        this.rows.set(view.id, row);
      }
      if (cursor === row.el) cursor = cursor.nextElementSibling;
      else {
        this.scroller.insertBefore(row.el, cursor);
        moved = true;
      }
    }
    for (const [id, row] of this.rows) {
      if (seen.has(id)) continue;
      row.dispose();
      row.el.remove();
      this.rows.delete(id);
    }
    if (this.scroller.lastElementChild !== this.emptyEl) this.scroller.appendChild(this.emptyEl);
    this.applyFilter();
    if (moved && this.scroller.scrollTop !== scrollTop) this.scroller.scrollTop = scrollTop;
  }

  dispose(): void {
    for (const row of this.rows.values()) row.dispose();
    this.rows.clear();
  }

  private applyFilter(): void {
    this.readyCounts.clear();
    let visible = 0;
    let readyTotal = 0;
    for (const view of this.views) if (view.available > 0 && !view.locked) readyTotal++;
    // Until the player picks a view, a simple list shows what can be made, or everything when that is nothing.
    if (this.simple && !chosenModes.has(this.label)) {
      const auto: Mode = readyTotal > 0 ? 'ready' : 'all';
      if (auto !== this.mode) {
        this.mode = auto;
        this.syncMode();
      }
    }
    readyTotal = 0;
    for (const view of this.views) {
      const row = this.rows.get(view.id);
      if (!row) continue;
      const canNow = view.available > 0 && !view.locked;
      const show = this.simple && this.mode === 'ready' ? canNow : this.active === ALL || view.category === this.active;
      if (row.el.hidden === show) row.el.hidden = !show;
      if (show) visible++;
      if (canNow) {
        readyTotal++;
        if (view.category !== undefined) this.readyCounts.set(view.category, (this.readyCounts.get(view.category) ?? 0) + 1);
      }
    }
    for (const [id, chip] of this.chips) chip.setCount(id === ALL ? readyTotal : this.readyCounts.get(id) ?? 0);
    this.modeChips.get('ready')?.setCount(readyTotal);
    this.modeChips.get('all')?.setCount(this.views.length);
    if (this.emptyEl.hidden !== visible > 0) this.emptyEl.hidden = visible > 0;
    if (visible === 0) {
      setText(this.emptyEl, this.views.length === 0 ? this.emptyText : this.simple && this.mode === 'ready' ? 'Nothing to make right now. Tap Everything to see what is missing.' : 'Nothing in this category yet.');
    }
  }
}
