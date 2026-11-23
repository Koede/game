/**
 * THE FURNACE screen: one page, no tabs. Header with the tier and the upgrade; the FIREBOX panel; the crucibles; one
 * list of what can be made right now (smelt and forge together, "Everything" on a switch); the player's backpack as
 * a side column (wide) or drawer (phones). The rarely needed parts - the hearth structure, the power grid, the
 * Hearth Log - are three small floating buttons on the right edge; a press enlarges that panel as a sheet over the page.
 */
import { MAX_FURNACE_TIER } from '../../../core/registry';
import { INVENTORY_SIZE } from '../../../core/constants';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h, setAttr } from '../../kit/dom';
import { heatColor } from '../../kit/format';
import { Window } from '../../kit/window';
import { HearthLogView } from '../log/hearthLog';
import type { QuickTarget } from '../slots';
import { BagDrawer } from './bagDrawer';
import { FireboxPanel } from './firebox';
import { ExperimentPanel } from '../experimentPanel';
import { ForgeTab } from './forgeTab';
import { GridTab } from './gridTab';
import { pretty, type ScreenSim } from './simApi';
import { SmeltTab } from './smeltTab';
import { ghostFor } from './hearthGhost';
import { StructureTab } from './structureTab';
import { structureBadge } from './structureText';
import { injectStationCss } from './styles';
import { UpgradeControl } from './upgrade';

/** The sheets that open over the page. */
export type FurnaceSheet = 'structure' | 'grid' | 'log';
const SHEETS: readonly { id: FurnaceSheet; label: string; title: string }[] = [
  { id: 'structure', label: 'Hearth', title: 'The hearth' },
  { id: 'grid', label: 'Power', title: 'Power grid' },
  { id: 'log', label: 'Log', title: 'Hearth log' },
];

const STRUCTURE_REFRESH_MS = 240;

/** Phones (a finger, and little width or height): the firebox folds to a strip and the backpack to a corner button. */
const COMPACT_QUERY = '(pointer: coarse) and (max-width: 499.98px), (pointer: coarse) and (max-height: 519.98px)';

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

  // Quick move out of the bag goes to the crucibles first (the page is about loading and making), then the firebox.
  const bagQuick: QuickTarget[] = ['cru-in', 'fuel'];
  const ghost = ghostFor(bus, sim);
  const sheets = new Map<FurnaceSheet, { el: HTMLElement; open: boolean }>();
  let openSheet: FurnaceSheet | null = null;
  const showSheet = (id: FurnaceSheet | null): void => {
    openSheet = id;
    for (const [sid, s] of sheets) {
      s.open = sid === id;
      s.el.hidden = sid !== id;
    }
    structureAt = -Infinity;
    refresh();
  };
  const upgrade = new UpgradeControl({ sim, pos, bus, changed, onStructure: (tier) => {
    upgrade.setOpen(false);
    ghost.choose(pos.x, pos.y, pos.z, { tier });
    showSheet('structure');
  } });
  const fire = new FireboxPanel({
    sim, pos, bus, player, clock: ctx.clock, slots: ctx.slots, toBag: TO_BAG, changed,
    spareSmeltable: () => ctx.objectives.current?.id === 'make_charcoal',
  });
  const pour = (index: number, key: string): void => {
    const result = sim.pourCrucible(pos.x, pos.y, pos.z, index, key);
    if (!result.ok) {
      bus.emit('toast', { text: pretty(result.reason), kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    }
    changed();
  };
  const smelt = new SmeltTab({ slots: ctx.slots, toBag: TO_BAG, bus, sources, changed, pour });
  const forge = new ForgeTab({ sim, pos, bus, changed, load: (id) => smelt.load(id), extra: new ExperimentPanel({ player, bus, station: 'furnace', changed }) });
  const grid = new GridTab({ sim, pos, bus, changed });
  const structure = new StructureTab({ sim, pos, bus, ghost, changed });
  const log = new HearthLogView(ctx.objectives, () => ctx.weather);
  const bag = new BagDrawer(ctx.slots, player.inventory, bagQuick, ctx.slots.actionBar);
  fire.bindSlots(furnaceSlots);
  smelt.bindSlots(furnaceSlots);

  const sheetBody: Record<FurnaceSheet, HTMLElement> = { structure: structure.el, grid: grid.el, log: log.el };
  const sheetButtons = new Map<FurnaceSheet, Button>();
  const buttons: Button[] = [];
  for (const spec of SHEETS) {
    const back = new Button({ label: 'Back', kind: 'quiet', onClick: () => showSheet(null) });
    buttons.push(back);
    const el = h(
      'section',
      { class: 'hw-fx__sheet', attrs: { 'data-sheet': spec.id, 'aria-label': spec.title } },
      h('header', { class: 'hw-fx__sheethead' }, h('h3', { class: 'hw-fx__sheettitle', text: spec.title }), back.el),
      h('div', { class: 'hw-fx__sheetbody' }, sheetBody[spec.id]),
    );
    el.hidden = true;
    sheets.set(spec.id, { el, open: false });
    const open = new Button({ label: spec.label, kind: 'quiet', onClick: () => showSheet(spec.id) });
    open.el.classList.add('hw-fx__morebtn');
    setAttr(open.el, 'data-sheet', spec.id);
    sheetButtons.set(spec.id, open);
    buttons.push(open);
  }
  const moreRow = h('div', { class: 'hw-fx__float', attrs: { role: 'toolbar', 'aria-label': 'Hearth, power and log' } }, ...[...sheetButtons.values()].map((b) => b.el));

  const main = h('div', { class: 'hw-fx__main' }, h('div', { class: 'hw-fx__pane' }, smelt.el, forge.el), moreRow);
  const layout = h('div', { class: 'hw-fx' }, h('div', { class: 'hw-fx__fire' }, fire.el), main, bag.el, upgrade.sheet, ...[...sheets.values()].map((s) => s.el));

  const compact = typeof matchMedia === 'function' ? matchMedia(COMPACT_QUERY) : null;
  const applyCompact = (): void => setAttr(layout, 'data-compact', compact?.matches ? 'true' : null);
  compact?.addEventListener('change', applyCompact);
  applyCompact();

  // The structure view scans the shell: 4 times a second is plenty (and at once when its sheet opens).
  let structureAt = -Infinity;

  const window = new Window({
    title: first.spec.name,
    size: 'lg',
    fit: 'tall',
    scroll: false,
    headerRight: upgrade.button.el,
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
    window.setSubtitle(`Tier ${view.tier} of ${MAX_FURNACE_TIER}${view.home ? ' - home' : ''}`);
    window.setAccent(view.ignited ? heatColor(5000) : view.hot ? heatColor(view.tempC) : null);
    upgrade.update(view);
    fire.update(view, forge.selected);
    smelt.update(view);
    forge.update(view, sources().length - 1);
    const gridAlert = grid.alert(view);
    if (openSheet === 'grid') grid.update(view);
    const now = performance.now();
    if (openSheet === 'structure' && now - structureAt >= STRUCTURE_REFRESH_MS) {
      structureAt = now;
      structure.update();
    }
    if (openSheet === 'log') log.refresh();
    const mark = (id: FurnaceSheet, text: string | null): void => {
      const b = sheetButtons.get(id);
      if (!b) return;
      b.setLabel(text ? `${SHEETS.find((s) => s.id === id)?.label} ${text}` : SHEETS.find((s) => s.id === id)?.label ?? '');
    };
    mark('grid', gridAlert ? '!' : null);
    mark('structure', structureBadge(view));
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
    } else if (ev.code === 'Escape' && (upgrade.open || openSheet)) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (upgrade.open) upgrade.setOpen(false);
      else showSheet(null);
    }
  };
  document.addEventListener('keydown', onKey, true);
  refresh();

  return {
    window,
    refresh,
    dispose: () => {
      document.removeEventListener('keydown', onKey, true);
      compact?.removeEventListener('change', applyCompact);
      fire.dispose();
      smelt.dispose();
      forge.dispose();
      grid.dispose();
      structure.dispose();
      bag.dispose();
      upgrade.dispose();
      for (const b of buttons) b.dispose();
    },
  };
}
