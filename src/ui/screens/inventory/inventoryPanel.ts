/** The player's 36 slots: the backpack above the marked hotbar row. Every screen that shows the bag uses this. */
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../../../core/constants';
import type { Inventory } from '../../../game/inventory';
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
}

/**
 * With a mouse, nine slots in a row even on a narrow window (below a full touch target, still a fingertip). With a
 * finger the backpack keeps every slot a full touch target and drops to fewer columns (7 on a 390 px phone); the
 * hotbar row stays nine wide so it lines up with the HUD's hotbar.
 */
const MIN_SLOT_PX = 32;
const touchFirst = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export class InventoryPanel {
  readonly el: HTMLDivElement;
  readonly pack: SlotGrid;
  readonly hotbar: SlotGrid;
  private readonly bindings: SlotBinding[];

  constructor(slots: SlotController, inventory: Inventory, opts: InventoryPanelOptions = {}) {
    const id = opts.id ?? 'bag';
    const packCount = Math.min(INVENTORY_SIZE, inventory.size) - HOTBAR_SIZE;
    this.pack = new SlotGrid({ count: packCount, columns: 9, label: opts.label ?? 'Backpack', minSlotPx: touchFirst() ? undefined : MIN_SLOT_PX });
    this.hotbar = new SlotGrid({ count: HOTBAR_SIZE, columns: 9, label: 'Hotbar', minSlotPx: MIN_SLOT_PX });
    this.el = h(
      'div',
      { class: 'hw-bag' },
      h('h3', { class: 'hw-heading hw-bag__head', text: opts.label ?? 'Backpack' }),
      this.pack.el,
      h('h3', { class: 'hw-heading hw-bag__head hw-bag__head--hotbar', text: 'Hotbar' }),
      h('div', { class: 'hw-bag__hotbar' }, this.hotbar.el),
    );
    this.bindings = [
      slots.bind({ id: `${id}-pack`, label: opts.label ?? 'Backpack', inventory, views: this.pack.slots, start: HOTBAR_SIZE, quickTo: opts.quickTo }),
      slots.bind({ id: `${id}-hotbar`, label: 'Hotbar', inventory, views: this.hotbar.slots, start: 0, quickTo: opts.quickTo }),
    ];
  }

  dispose(): void {
    for (const b of this.bindings) b.unbind();
    this.pack.dispose();
    this.hotbar.dispose();
  }
}
