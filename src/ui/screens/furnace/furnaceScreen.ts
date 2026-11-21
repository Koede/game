/**
 * THE FURNACE screen: header with tier, age and the upgrade; the FIREBOX panel that stays in view whatever tab
 * is open; tabs SMELT, FORGE, GRID and LOG; the player's backpack as a side column (wide) or drawer (phones).
 */
import { AGES } from '../../../core/registry';
import { INVENTORY_SIZE } from '../../../core/constants';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h, setAttr } from '../../kit/dom';
import { heatColor } from '../../kit/format';
import { Window } from '../../kit/window';
import { HearthLogView } from '../log/hearthLog';
import type { QuickTarget } from '../slots';
import { BagDrawer } from './bagDrawer';
import { FireboxPanel } from './firebox';
import { ForgeTab } from './forgeTab';
import { GridTab } from './gridTab';
import type { ScreenSim } from './simApi';
import { SmeltTab } from './smeltTab';
import { injectStationCss } from './styles';
import { UpgradeControl } from './upgrade';

export type FurnaceTab = 'smelt' | 'forge' | 'grid' | 'log';
const TABS: readonly { id: FurnaceTab; label: string }[] = [
  { id: 'smelt', label: 'Smelt' },
  { id: 'forge', label: 'Forge' },
  { id: 'grid', label: 'Grid' },
  { id: 'log', label: 'Log' },
];

/** The tab the player last used (kept for the session). */
let lastTab: FurnaceTab = 'smelt';

/** Quick move from the bag: into the player's whole inventory range, hotbar first. */
export const TO_BAG: readonly QuickTarget[] = [{ group: 'bag-pack', start: 0, end: INVENTORY_SIZE }];

export function createFurnaceScreen(request: { x: number; y: number; z: number }, ctx: ScreenContext, sim: ScreenSim): GameScreen | null {
  const pos = { x: request.x, y: request.y, z: request.z };
  const furnaceSlots = sim.furnaceSlots(pos.x, pos.y, pos.z);
  const first = sim.furnaceView(pos.x, pos.y, pos.z);
  if (!furnaceSlots || !first) return null;
  injectStationCss();
  const { bus, player } = ctx;
  const changed = (): void => ctx.invalidate();
  const sources = (): ReturnType<ScreenSim['stationSources']> => sim.stationSources(pos.x, pos.y, pos.z);

  // Quick move out of the bag goes to the firebox or the crucibles; which first depends on the tab.
  const bagQuick: QuickTarget[] = ['fuel', 'cru-in'];
  const upgrade = new UpgradeControl({ sim, pos, bus, changed });
  const fire = new FireboxPanel({ sim, pos, bus, player, clock: ctx.clock, slots: ctx.slots, toBag: TO_BAG, changed });
  const smelt = new SmeltTab({ slots: ctx.slots, toBag: TO_BAG, bus, sources, changed });
  const forge = new ForgeTab({ sim, pos, bus, changed });
  const grid = new GridTab({ sim, pos, bus, changed });
  const log = new HearthLogView(ctx.objectives);
  const bag = new BagDrawer(ctx.slots, player.inventory, bagQuick);
  fire.bindSlots(furnaceSlots);
  smelt.bindSlots(furnaceSlots);

  const panes: Record<FurnaceTab, HTMLElement> = {
    smelt: h('div', { class: 'hw-fx__pane', attrs: { 'data-pane': 'smelt' } }, smelt.el),
    forge: h('div', { class: 'hw-fx__pane hw-fx__pane--fill', attrs: { 'data-pane': 'forge' } }, forge.el),
    grid: h('div', { class: 'hw-fx__pane', attrs: { 'data-pane': 'grid' } }, grid.el),
    log: h('div', { class: 'hw-fx__pane', attrs: { 'data-pane': 'log' } }, log.el),
  };
  const carry = h('div', { class: 'hw-fx__carry' }, ctx.slots.actionBar);
  const main = h('div', { class: 'hw-fx__main' }, ...TABS.map((t) => panes[t.id]), carry);
  const layout = h('div', { class: 'hw-fx' }, h('div', { class: 'hw-fx__fire' }, fire.el), main, bag.el, upgrade.sheet);

  let tab = lastTab;
  const showTab = (id: FurnaceTab): void => {
    tab = id;
    lastTab = id;
    for (const t of TABS) panes[t.id].hidden = t.id !== id;
    bagQuick.splice(0, bagQuick.length, ...(id === 'smelt' ? ['cru-in', 'fuel'] : ['fuel', 'cru-in']));
    setAttr(layout, 'data-tab', id);
    refresh();
  };

  const window = new Window({
    title: first.spec.name,
    size: 'lg',
    fit: 'tall',
    scroll: false,
    headerRight: upgrade.button.el,
    tabs: TABS,
    activeTab: tab,
    onTab: (id) => showTab(id as FurnaceTab),
    body: layout,
  });
  window.frame.classList.add('hw-fx-window');

  let tier = first.tier;
  function refresh(): void {
    const view = sim.furnaceView(pos.x, pos.y, pos.z);
    if (!view) {
      ctx.close();
      return;
    }
    if (view.tier !== tier) {
      tier = view.tier;
      const slots = sim.furnaceSlots(pos.x, pos.y, pos.z);
      if (slots) {
        fire.bindSlots(slots);
        smelt.bindSlots(slots);
      }
    }
    window.setTitle(view.spec.name);
    const age = AGES[view.spec.age]?.name ?? '';
    window.setSubtitle(`${age} - tier ${view.tier} of 5${view.home ? ' - home' : ''}`);
    window.setAccent(view.ignited ? heatColor(5000) : view.hot ? heatColor(view.tempC) : null);
    upgrade.update(view);
    fire.update(view, tab === 'forge' ? forge.selected : null);
    if (tab === 'smelt') smelt.update(view);
    forge.update(view, sources().length - 1);
    if (tab === 'grid') grid.update(view);
    if (tab === 'log') log.refresh();
    window.tabs?.setBadge('forge', forge.ready > 0 ? forge.ready : null);
    const done = view.crucibles.filter((c) => c.output !== null).length;
    window.tabs?.setBadge('smelt', done > 0 ? `${done} done` : null);
    window.tabs?.setBadge('grid', grid.alert(view) ? '!' : null);
    ctx.slots.refresh();
    bag.refresh();
  }

  const onKey = (ev: KeyboardEvent): void => {
    const t = ev.target;
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
    if (ev.code === 'KeyP') {
      ev.preventDefault();
      fire.pump();
    } else if (ev.code === 'KeyB') {
      ev.preventDefault();
      bag.setOpen(!bag.isOpen);
    } else if (ev.code === 'Escape' && upgrade.open) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      upgrade.setOpen(false);
    }
  };
  document.addEventListener('keydown', onKey, true);
  showTab(tab);

  return {
    window,
    refresh,
    dispose: () => {
      document.removeEventListener('keydown', onKey, true);
      fire.dispose();
      smelt.dispose();
      forge.dispose();
      grid.dispose();
      bag.dispose();
      upgrade.dispose();
    },
  };
}
