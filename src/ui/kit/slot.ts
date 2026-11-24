/**
 * Item slots. A slot only DISPLAYS a stack and reports primary / secondary activation;
 * what a tap means (pick up, split, move, equip) is decided by the screen that owns it.
 */
import { h, setAttr, setFlag, setText, type Dispose } from './dom';
import { formatCount, titleFromKey } from './format';
import { ItemIcon } from './icons';
import { bindPress } from './press';

export interface SlotView {
  /** Item key. */
  item: string;
  /** Stack size. Shown when greater than 1. Default 1. */
  count?: number;
  /** Remaining durability as a fraction 0..1 (tools). Omit for items without durability. */
  durability?: number;
  /** Display name for the accessible label. Default: derived from the key. */
  name?: string;
  /** Loot rarity of the item ('fine' | 'rare' | 'legendary'): tints the slot edge. Data about the item, not the stack. */
  rarity?: string;
  /** Carries enchantments: draws a faint shimmer over the icon (CSS; off under reduce motion). */
  enchanted?: boolean;
}

export type SlotSize = 'sm' | 'md' | 'lg';

export interface ItemSlotOptions {
  size?: SlotSize;
  /** Tiny caption shown while the slot is empty: "Fuel", "Ore", "Out". */
  hint?: string;
  /** Accessible name of the slot itself ("Fuel slot 1"). */
  label?: string;
  /** Click, tap, Enter or Space. */
  onPrimary?: (slot: ItemSlot, ev: Event) => void;
  /** Right-click or long-press. */
  onSecondary?: (slot: ItemSlot, ev: Event) => void;
}

export class ItemSlot {
  readonly el: HTMLButtonElement;
  private readonly icon = new ItemIcon();
  private readonly countEl: HTMLSpanElement;
  private readonly durEl: HTMLSpanElement;
  private readonly durFill: HTMLElement;
  private readonly label: string;
  private readonly unbind: Dispose;
  private onPrimary: ItemSlotOptions['onPrimary'];
  private onSecondary: ItemSlotOptions['onSecondary'];
  private current: SlotView | null = null;
  private shownCount = '';
  private shownDur = -1;

  constructor(opts: ItemSlotOptions = {}) {
    this.label = opts.label ?? 'Slot';
    this.countEl = h('span', { class: 'hw-slot__count hw-num' });
    this.durFill = h('i');
    this.durEl = h('span', { class: 'hw-slot__dur' }, this.durFill);
    this.durEl.hidden = true;
    this.el = h(
      'button',
      { class: ['hw-slot', `hw-slot--${opts.size ?? 'md'}`], attrs: { type: 'button' } },
      opts.hint ? h('span', { class: 'hw-slot__hint', text: opts.hint }) : null,
      this.icon.el,
      this.durEl,
      this.countEl,
    );
    this.onPrimary = opts.onPrimary;
    this.onSecondary = opts.onSecondary;
    this.unbind = bindPress(this.el, {
      primary: (ev) => {
        if (!this.disabled) this.onPrimary?.(this, ev);
      },
      secondary: (ev) => {
        if (!this.disabled) this.onSecondary?.(this, ev);
      },
    });
    this.render(null);
  }

  /** Replaces the activation handlers (the slot-interaction controller takes over slots a screen created). */
  setHandlers(handlers: Pick<ItemSlotOptions, 'onPrimary' | 'onSecondary'>): void {
    this.onPrimary = handlers.onPrimary;
    this.onSecondary = handlers.onSecondary;
  }

  /** What the slot currently shows. */
  get view(): SlotView | null {
    return this.current;
  }

  get disabled(): boolean {
    return this.el.getAttribute('aria-disabled') === 'true';
  }

  /** Shows a stack, or null for an empty slot. Only touches the DOM for what actually changed. */
  set(view: SlotView | null): void {
    const next = view && view.item ? view : null;
    const prev = this.current;
    if (next === null && prev === null) return;
    if (next && prev && next.item === prev.item && next.count === prev.count && next.durability === prev.durability && next.name === prev.name && !next.enchanted === !prev.enchanted) {
      // Still refresh the icon: a provider installed later replaces the placeholder tile.
      this.icon.set(next.item);
      return;
    }
    this.render(next);
  }

  /** The slot the player has picked (hotbar selection, the stack being moved). */
  setSelected(on: boolean): void {
    setFlag(this.el, 'selected', on);
  }

  /** Draws attention to the slot (a valid drop target, the slot a hint is talking about). */
  setHighlight(on: boolean): void {
    setFlag(this.el, 'highlight', on);
  }

  /** Marks the slot as a favourite (a small star: sort and move-all leave it alone). */
  setFavourite(on: boolean): void {
    setFlag(this.el, 'favourite', on);
  }

  setDisabled(on: boolean): void {
    setAttr(this.el, 'aria-disabled', on ? 'true' : null);
  }

  dispose(): void {
    this.unbind();
  }

  private render(view: SlotView | null): void {
    // A copy, so a caller that mutates and re-submits the same object is still detected as a change.
    this.current = view ? { ...view } : null;
    this.icon.set(view ? view.item : null);
    setFlag(this.el, 'empty', view === null);
    setAttr(this.el, 'data-rarity', view?.rarity && view.rarity !== 'common' ? view.rarity : null);
    setFlag(this.el, 'enchanted', !!view?.enchanted);
    const count = view?.count ?? 1;
    const countText = view && count > 1 ? formatCount(count) : '';
    if (countText !== this.shownCount) {
      this.shownCount = countText;
      setText(this.countEl, countText);
    }
    const dur = view && view.durability !== undefined ? Math.min(1, Math.max(0, view.durability)) : -1;
    if (dur !== this.shownDur) {
      this.shownDur = dur;
      this.durEl.hidden = dur < 0;
      if (dur >= 0) {
        this.durFill.style.width = `${Math.round(dur * 100)}%`;
        setAttr(this.durEl, 'data-level', dur > 0.5 ? 'high' : dur > 0.2 ? 'mid' : 'low');
      }
    }
    const name = view ? view.name ?? titleFromKey(view.item) : 'empty';
    const detail = view ? `${name}${count > 1 ? `, ${count}` : ''}${dur >= 0 ? `, ${Math.round(dur * 100)}% durability` : ''}` : name;
    setAttr(this.el, 'aria-label', `${this.label}: ${detail}`);
  }
}

export interface SlotGridOptions {
  /** Number of slots. */
  count: number;
  /** Most columns to use. The grid drops to fewer columns before a slot gets smaller than a touch target. Default 9. */
  columns?: number;
  size?: SlotSize;
  /**
   * Smallest width in px a slot may shrink to before the grid drops a column. Default 44, a touch target;
   * a hotbar that has to stay on one row on a narrow phone can go lower.
   */
  minSlotPx?: number;
  /** Accessible name of the group ("Inventory", "Crate"). */
  label: string;
  onPrimary?: (index: number, ev: Event) => void;
  onSecondary?: (index: number, ev: Event) => void;
}

/** A grid of slots addressed by index. */
export class SlotGrid {
  readonly el: HTMLDivElement;
  readonly slots: readonly ItemSlot[];
  private selected: number | null = null;

  constructor(opts: SlotGridOptions) {
    const slots: ItemSlot[] = [];
    for (let i = 0; i < opts.count; i++) {
      slots.push(
        new ItemSlot({
          size: opts.size,
          label: `${opts.label} slot ${i + 1}`,
          onPrimary: opts.onPrimary ? (_slot, ev) => opts.onPrimary?.(i, ev) : undefined,
          onSecondary: opts.onSecondary ? (_slot, ev) => opts.onSecondary?.(i, ev) : undefined,
        }),
      );
    }
    this.slots = slots;
    this.el = h(
      'div',
      {
        class: ['hw-slotgrid', `hw-slotgrid--${opts.size ?? 'md'}`],
        attrs: { role: 'group', 'aria-label': opts.label },
        style: {
          '--hw-cols': String(opts.columns ?? 9),
          ...(opts.minSlotPx !== undefined ? { '--hw-slot-min': `${opts.minSlotPx}px` } : {}),
        },
      },
      slots.map((s) => s.el),
    );
  }

  set(index: number, view: SlotView | null): void {
    this.slots[index]?.set(view);
  }

  /** Updates every slot from an array (missing entries count as empty). */
  setAll(views: ArrayLike<SlotView | null | undefined>): void {
    for (let i = 0; i < this.slots.length; i++) this.slots[i].set(views[i] ?? null);
  }

  /** Marks one slot as selected (null clears the selection). */
  setSelected(index: number | null): void {
    if (index === this.selected) return;
    if (this.selected !== null) this.slots[this.selected]?.setSelected(false);
    this.selected = index;
    if (index !== null) this.slots[index]?.setSelected(true);
  }

  dispose(): void {
    for (const slot of this.slots) slot.dispose();
  }
}
