/** The hotbar: the first nine inventory slots, tappable, with the selected slot marked and its name shown on change. */
import { HOTBAR_SIZE } from '../../core/constants';
import type { GameBus } from '../../core/context';
import { itemOrNull } from '../../core/registry';
import type { PlayerState } from '../../game/playerState';
import { h, setText } from '../kit/dom';
import { SlotGrid } from '../kit/slot';
import { slotView } from '../screens/inventory/slotViews';

const NAME_LINGER_MS = 1600;

export class Hotbar {
  readonly el: HTMLDivElement;
  private readonly grid: SlotGrid;
  private readonly nameEl: HTMLDivElement;
  private readonly player: PlayerState;
  private nameTimer: ReturnType<typeof setTimeout> | null = null;
  private shownSelected = -1;
  private shownHeld = '';

  constructor(player: PlayerState, bus: GameBus) {
    this.player = player;
    this.grid = new SlotGrid({
      count: HOTBAR_SIZE,
      columns: HOTBAR_SIZE,
      size: 'sm',
      minSlotPx: 30,
      label: 'Hotbar',
      onPrimary: (i) => {
        if (i !== player.selectedSlot) {
          player.selectSlot(i);
          bus.emit('sfx', { name: 'ui_click', volume: 0.5 });
        }
        this.refresh();
      },
    });
    this.grid.slots.forEach((slot, i) => slot.el.setAttribute('data-key', String(i + 1)));
    this.nameEl = h('div', { class: 'hw-hotbar__name', attrs: { 'aria-live': 'polite' } });
    this.nameEl.hidden = true;
    this.el = h('div', { class: 'hw-hotbar' }, this.nameEl, this.grid.el);
    this.refresh();
  }

  /** Cheap: only slots whose stack changed touch the DOM. */
  refresh(): void {
    const slots = this.player.inventory.slots;
    for (let i = 0; i < HOTBAR_SIZE; i++) this.grid.set(i, slotView(slots[i]));
    const selected = this.player.selectedSlot;
    this.grid.setSelected(selected);
    const held = slots[selected]?.item ?? '';
    if (selected !== this.shownSelected || held !== this.shownHeld) {
      const first = this.shownSelected === -1;
      this.shownSelected = selected;
      this.shownHeld = held;
      if (!first && held) this.flashName(itemOrNull(held)?.name ?? held);
    }
  }

  dispose(): void {
    if (this.nameTimer !== null) clearTimeout(this.nameTimer);
    this.grid.dispose();
  }

  private flashName(name: string): void {
    setText(this.nameEl, name);
    this.nameEl.hidden = false;
    if (this.nameTimer !== null) clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => {
      this.nameEl.hidden = true;
      this.nameTimer = null;
    }, NAME_LINGER_MS);
  }
}
