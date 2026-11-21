/**
 * The player's inventory beside a station screen: a permanent side column on wide screens, a drawer with a
 * handle on phones (CSS decides which; see furnace.css). The drawer remembers whether it was open.
 */
import { INVENTORY_SIZE } from '../../../core/constants';
import type { Inventory } from '../../../game/inventory';
import { h, setAttr, setText } from '../../kit/dom';
import { glyph } from '../../kit/icons';
import { slotHint } from '../inventory/craftingScreen';
import { InventoryPanel } from '../inventory/inventoryPanel';
import type { QuickTarget, SlotController } from '../slots';

let rememberOpen = false;

export class BagDrawer {
  readonly el: HTMLElement;
  readonly panel: InventoryPanel;
  private readonly handle: HTMLButtonElement;
  private readonly count: HTMLSpanElement;
  private readonly inventory: Inventory;
  private open = rememberOpen;

  /**
   * `carry` (the slot controller's action bar) sits next to the bag, open or closed: below it, or on top of the
   * bottom-anchored drawer on phones, so it never pushes a slot from under the finger between two taps.
   */
  constructor(slots: SlotController, inventory: Inventory, quickTo: readonly QuickTarget[], carry: HTMLElement) {
    this.inventory = inventory;
    this.panel = new InventoryPanel(slots, inventory, { quickTo });
    this.count = h('span', { class: 'hw-drawer__count hw-num' });
    this.handle = h(
      'button',
      { class: 'hw-drawer__handle', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Backpack' } },
      h('span', { class: 'hw-drawer__icon' }, glyph('bag', 18)),
      h('span', { class: 'hw-drawer__label', text: 'Backpack' }),
      this.count,
      h('span', { class: 'hw-drawer__chev' }, glyph('play', 12)),
    );
    this.handle.addEventListener('click', () => this.setOpen(!this.open));
    this.el = h(
      'aside',
      { class: 'hw-drawer', attrs: { 'aria-label': 'Your backpack' } },
      this.handle,
      h('div', { class: 'hw-drawer__sheet' }, this.panel.el, h('p', { class: 'hw-drawer__hint', text: slotHint() })),
      carry,
    );
    this.setOpen(this.open);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    rememberOpen = open;
    setAttr(this.el, 'data-open', open ? 'true' : null);
    setAttr(this.handle, 'aria-expanded', String(open));
  }

  refresh(): void {
    let used = 0;
    for (const s of this.inventory.slots) if (s) used++;
    setText(this.count, `${used}/${Math.min(INVENTORY_SIZE, this.inventory.size)}`);
  }

  dispose(): void {
    this.panel.dispose();
  }
}
