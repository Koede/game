/**
 * The player's 36 slots: the backpack above the marked hotbar row. Every screen that shows the bag uses this. The
 * backpack's pockets (named sections) are labelled inside its grid when there is more than one; Sort sorts each pocket
 * on its own; Undo appears for the one step the bag can take back (docs/api/inventory.md, "Moves").
 */
import { EMPTY_BACKPACK, EMPTY_BACKPACK_HOTBAR, rangeIsEmpty } from './emptyState';
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../../../core/constants';
import type { Inventory } from '../../../game/inventory';
import { setSortMode, sortModeOf, sortRange, type SortMode } from '../../../game/inventoryTools';
import { bagSections, pocketsOf } from '../../../game/pockets';
import { Button } from '../../kit/controls';
import { h } from '../../kit/dom';
import { SlotGrid } from '../../kit/slot';
import type { QuickTarget, SlotBinding, SlotController } from '../slots';

export interface InventoryPanelOptions {
  /** Group ids become `<id>-pack` and `<id>-hotbar`. Default 'bag'. */
  id?: string;
  /** Heading above the backpack. Default 'Backpack'. */
  label?: string;
  /** Quick-move destinations for both groups. Default: the screen's other inventories, else hotbar <-> backpack. */
  quickTo?: readonly QuickTarget[];
  /** Show the Sort button (default true; the player's own pack only). */
  sortable?: boolean;
}

/**
 * With a mouse, nine slots in a row even on a narrow window (below a full touch target, still a fingertip). With a
 * finger the backpack keeps every slot a full touch target and drops to fewer columns (7 on a 390 px phone); the
 * hotbar row stays nine wide so it lines up with the HUD's hotbar.
 */
const MIN_SLOT_PX = 32;
const touchFirst = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const ORDER_LABEL: Record<SortMode, string> = { kind: 'Order: kind', recent: 'Order: newest' };

export class InventoryPanel {
  readonly el: HTMLDivElement;
  readonly pack: SlotGrid;
  readonly hotbar: SlotGrid;
  private readonly emptyNote: HTMLParagraphElement;
  private readonly bindings: SlotBinding[];
  private readonly offChange: () => void;
  private readonly offRefresh: () => void;
  private readonly slots: SlotController;
  private readonly inventory: Inventory;
  private readonly undoBtn: Button;
  private readonly orderBtn: Button;
  private pocketEls: HTMLElement[] = [];
  private pocketKey = '';

  constructor(slots: SlotController, inventory: Inventory, opts: InventoryPanelOptions = {}) {
    const id = opts.id ?? 'bag';
    this.slots = slots;
    this.inventory = inventory;
    // The player's own bag (no quick-move override) gets the sections: Shift and two-finger taps go round them.
    const isBag = opts.quickTo === undefined;
    const sections = isBag ? () => bagSections(inventory) : undefined;
    this.emptyNote = h('p', { class: 'hw-bag__empty', text: EMPTY_BACKPACK });
    const packCount = Math.min(INVENTORY_SIZE, inventory.size) - HOTBAR_SIZE;
    this.pack = new SlotGrid({ count: packCount, columns: 9, label: opts.label ?? 'Backpack', minSlotPx: touchFirst() ? undefined : MIN_SLOT_PX });
    this.hotbar = new SlotGrid({ count: HOTBAR_SIZE, columns: 9, label: 'Hotbar', minSlotPx: MIN_SLOT_PX });
    this.undoBtn = new Button({ label: 'Undo', size: 'sm', kind: 'quiet', onClick: () => void slots.undo() });
    this.undoBtn.el.hidden = true;
    this.orderBtn = new Button({ label: ORDER_LABEL[sortModeOf(inventory)], size: 'sm', kind: 'quiet', onClick: () => this.toggleOrder() });
    const tools: HTMLElement[] = [this.undoBtn.el];
    if (opts.sortable !== false) {
      tools.push(this.orderBtn.el, new Button({ label: 'Sort', size: 'sm', kind: 'quiet', onClick: () => this.sort() }).el);
    }
    this.el = h(
      'div',
      { class: 'hw-bag' },
      h('div', { class: 'hw-bag__headrow' }, h('h3', { class: 'hw-heading hw-bag__head', text: opts.label ?? 'Backpack' }), h('div', { class: 'hw-bag__tools' }, ...tools)),
      this.pack.el,
      this.emptyNote,
      h('h3', { class: 'hw-heading hw-bag__head hw-bag__head--hotbar', text: 'Hotbar' }),
      h('div', { class: 'hw-bag__hotbar' }, this.hotbar.el),
    );
    // Only the player's own pack says it is empty; a crate or machine panel passes its own label.
    const sync = (): void => {
      const ownPack = opts.label === undefined;
      const packEmpty = ownPack && rangeIsEmpty(inventory.slots, HOTBAR_SIZE, packCount);
      const hotbarEmpty = rangeIsEmpty(inventory.slots, 0, HOTBAR_SIZE);
      this.emptyNote.hidden = !packEmpty;
      // The hotbar counts: with logs in it the pack is not "all empty", and the note says where picked-up items go.
      this.emptyNote.textContent = hotbarEmpty ? EMPTY_BACKPACK : EMPTY_BACKPACK_HOTBAR;
      // On a phone the 27 empty slots would push the recipes off the first screen: fold the grid away while the pack is empty.
      this.pack.el.hidden = packEmpty && touchFirst();
      if (isBag) this.syncPockets();
    };
    sync();
    this.offChange = inventory.onChange(sync);
    const refresh = (): void => {
      this.undoBtn.el.toggleAttribute('hidden', !slots.canUndo);
    };
    refresh();
    slots.refreshed.add(refresh);
    this.offRefresh = () => {
      slots.refreshed.delete(refresh);
    };
    this.bindings = [
      slots.bind({ id: `${id}-pack`, label: opts.label ?? 'Backpack', inventory, views: this.pack.slots, start: HOTBAR_SIZE, quickTo: opts.quickTo, sections }),
      slots.bind({ id: `${id}-hotbar`, label: 'Hotbar', inventory, views: this.hotbar.slots, start: 0, quickTo: opts.quickTo, sections }),
    ];
  }

  dispose(): void {
    this.offChange();
    this.offRefresh();
    for (const b of this.bindings) b.unbind();
    // The bag closing ends the undo: one step, cleared when the bag goes (it is never saved).
    this.slots.clearHistory();
    this.pack.dispose();
    this.hotbar.dispose();
  }

  /** Sorts each pocket of the pack in the chosen order. Clears the undo step (a sort is not undone). */
  private sort(): void {
    this.slots.clearHistory();
    for (const p of pocketsOf(this.inventory)) sortRange(this.inventory, p.start, p.end);
    this.slots.refresh();
  }

  private toggleOrder(): void {
    const next: SortMode = sortModeOf(this.inventory) === 'kind' ? 'recent' : 'kind';
    setSortMode(this.inventory, next);
    this.orderBtn.setLabel(ORDER_LABEL[next]);
    this.slots.refresh();
  }

  /** Labels each pocket inside the pack grid (full-width cells, so the nine columns stay intact). One pocket: no labels. */
  private syncPockets(): void {
    const ps = pocketsOf(this.inventory);
    const key = ps.map((p) => `${p.name}:${p.start}`).join('|');
    if (key === this.pocketKey) return;
    this.pocketKey = key;
    for (const el of this.pocketEls) el.remove();
    this.pocketEls = [];
    if (ps.length < 2) return;
    for (const p of ps) {
      const first = this.pack.slots[p.start - HOTBAR_SIZE]?.el;
      if (!first) continue;
      const label = h('div', { class: 'hw-pocket-label', text: p.name });
      this.pack.el.insertBefore(label, first);
      this.pocketEls.push(label);
    }
  }
}
