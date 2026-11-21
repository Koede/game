/**
 * Dev Mode's creative menu: every registry item in a searchable, tabbed grid beside/above the player's own pack.
 * Tap = one item, Shift-click / long-press / "Full stacks" = a full stack; drag onto a pack slot (desktop);
 * "Trash" removes the picked stack; "Clear pack" (hold) empties the pack. Reuses ItemSlot, Tabs and InventoryPanel.
 */
import { HOTBAR_SIZE } from '../../../core/constants';
import { fullDurability, makeStack, stackLimit } from '../../../game/inventory';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button, TextField, Toggle } from '../../kit/controls';
import { h } from '../../kit/dom';
import { ItemSlot } from '../../kit/slot';
import { Tabs } from '../../kit/tabs';
import { Window } from '../../kit/window';
import { InventoryPanel } from '../inventory/inventoryPanel';
import { itemCard } from '../inventory/slotViews';
import { buildCatalogue, clearSlot, CREATIVE_TABS, filterCatalogue, grantItem, tabCounts, type CatalogueEntry, type CreativeTabId } from './catalogue';

const DRAG_TYPE = 'application/x-hearthwatt-item';

export const CREATIVE_HINT_TOUCH = 'Tap an item: one into your pack. Long-press: a full stack. Pick a pack stack, then Trash.';
export const CREATIVE_HINT_MOUSE = 'Click: one. Shift-click or right-click: a full stack. Drag onto a pack slot. Pick a stack, then Trash.';
const coarse = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function createCreativeScreen(ctx: ScreenContext): GameScreen | null {
  const player = ctx.player;
  if (!player.dev) return null;
  const inventory = player.inventory;
  const entries = buildCatalogue();
  const bag = new InventoryPanel(ctx.slots, inventory);
  const disposers: (() => void)[] = [];

  // ---- options row ----
  const fullStacks = new Toggle({ label: 'Full stacks', value: false });
  const freePlace = new Toggle({ label: 'Free placing', value: player.devFreePlace, onChange: (v) => (player.devFreePlace = v) });
  const flight = new Toggle({ label: 'Flight', value: player.flying, onChange: (v) => (player.flying = v) });
  const trash = new Button({ label: 'Trash', kind: 'quiet', size: 'sm', icon: 'close', onClick: () => trashPicked() });
  const clearAll = new Button({ label: 'Clear pack', kind: 'danger', size: 'sm', holdMs: 900, hint: 'Hold', onClick: () => clearPack() });
  const options = h('div', { class: 'hw-creative__options' }, fullStacks.el, freePlace.el, flight.el, trash.el, clearAll.el);

  // ---- catalogue ----
  const info = h('p', { class: 'hw-creative__info', text: 'Pick an item to see what it is.', attrs: { role: 'status' } });
  const showInfo = (e: CatalogueEntry): void => {
    info.textContent = `${e.name}: ${e.desc || 'No description.'}`;
  };
  const give = (e: CatalogueEntry, full: boolean): void => {
    const left = grantItem(inventory, e.key, full);
    showInfo(e);
    if (left > 0) {
      ctx.bus.emit('toast', { text: 'Your pack is full', kind: 'warn' });
      ctx.bus.emit('sfx', { name: 'error' });
    } else ctx.bus.emit('sfx', { name: 'pickup' });
    ctx.invalidate();
  };
  const slots = new Map<string, ItemSlot>();
  const grid = h('div', { class: 'hw-creative__grid', attrs: { role: 'group', 'aria-label': 'All items' } });
  for (const e of entries) {
    const slot = new ItemSlot({
      size: 'md',
      label: e.name,
      onPrimary: (_s, ev) => give(e, fullStacks.value || (ev as MouseEvent).shiftKey === true),
      onSecondary: () => give(e, true),
    });
    slot.set({ item: e.key, name: e.name });
    slot.el.draggable = true;
    slot.el.dataset.item = e.key;
    slot.el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer?.setData(DRAG_TYPE, e.key);
      ev.dataTransfer?.setData('text/plain', e.key);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
    });
    slot.el.addEventListener('focus', () => showInfo(e));
    slot.el.addEventListener('mouseenter', () => showInfo(e));
    disposers.push(ctx.root.tooltip.attach(slot.el, () => itemCard({ item: e.key, count: 1 }), { touch: 'none' }));
    slots.set(e.key, slot);
    grid.appendChild(slot.el);
  }
  const empty = h('p', { class: 'hw-creative__empty', text: 'Nothing matches.' });
  empty.hidden = true;

  let tab: CreativeTabId = 'all';
  let query = '';
  const tabs = new Tabs({
    label: 'Item groups',
    tabs: CREATIVE_TABS.map((t) => ({ id: t.id, label: t.label })),
    active: tab,
    onChange: (id) => {
      tab = id as CreativeTabId;
      apply();
    },
  });
  const search = new TextField({
    label: 'Search items',
    placeholder: 'Search name or description',
    maxLength: 40,
    onInput: (v) => {
      query = v;
      apply();
    },
  });
  function apply(): void {
    const shown = new Set(filterCatalogue(entries, tab, query).map((e) => e.key));
    for (const [key, slot] of slots) slot.el.hidden = !shown.has(key);
    empty.hidden = shown.size > 0;
    const counts = tabCounts(entries, query);
    for (const t of CREATIVE_TABS) tabs.setBadge(t.id, counts[t.id]);
  }
  apply();

  // ---- trash / clear ----
  function trashPicked(): void {
    const pick = ctx.slots.picked;
    const group = pick ? ctx.slots.logic.groups.get(pick.group) : null;
    if (pick && group && group.inventory === inventory) {
      clearSlot(inventory, group.start + pick.index);
      ctx.slots.cancel();
      ctx.bus.emit('sfx', { name: 'ui_click' });
    } else {
      ctx.bus.emit('toast', { text: 'Pick a stack in your pack first, then Trash', kind: 'info' });
    }
    ctx.invalidate();
  }
  function clearPack(): void {
    ctx.slots.cancel();
    for (let i = 0; i < inventory.size; i++) clearSlot(inventory, i);
    ctx.invalidate();
  }

  // ---- drop onto the player's slots (desktop) ----
  const wireDrop = (views: readonly ItemSlot[], start: number): void => {
    views.forEach((view, i) => {
      view.el.addEventListener('dragover', (ev) => {
        if (ev.dataTransfer?.types.includes(DRAG_TYPE)) {
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
        }
      });
      view.el.addEventListener('drop', (ev) => {
        const key = ev.dataTransfer?.getData(DRAG_TYPE);
        if (!key) return;
        ev.preventDefault();
        const count = fullStacks.value || ev.shiftKey ? stackLimit(key) : 1;
        inventory.set(start + i, makeStack(key, count, fullDurability(key)));
        ctx.bus.emit('sfx', { name: 'pickup' });
        ctx.invalidate();
      });
    });
  };
  wireDrop(bag.hotbar.slots, 0);
  wireDrop(bag.pack.slots, HOTBAR_SIZE);

  const body = h(
    'div',
    { class: 'hw-craft hw-creative' },
    h('section', { class: 'hw-craft__bag' }, bag.el, options),
    h('section', { class: 'hw-craft__make hw-creative__make' }, search.el, tabs.el, h('div', { class: 'hw-creative__scroll' }, grid, empty), info),
  );
  const window = new Window({
    title: 'Creative',
    subtitle: 'Dev Mode: every item in the game',
    size: 'lg',
    fit: 'tall',
    scroll: false,
    body,
    footer: coarse() ? CREATIVE_HINT_TOUCH : CREATIVE_HINT_MOUSE,
  });
  return {
    window,
    refresh: () => {
      ctx.slots.refresh();
      freePlace.set(player.devFreePlace);
      flight.set(player.flying);
      trash.setDisabled(!ctx.slots.picked, 'Pick a stack in your pack first');
    },
    dispose: () => {
      for (const d of disposers) d();
      bag.dispose();
    },
  };
}
