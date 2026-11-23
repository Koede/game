/**
 * Machine screens ('machine' and 'crate' requests): the machine's panel by role, its on/off switch, the network
 * it is on (compact), and the player's backpack beside it (stacked under it on phones). Crates get 27 slots.
 */
import { HOTBAR_SIZE, STATION_CRATE_RADIUS } from '../../../core/constants';
import { block, machine } from '../../../core/registry';
import type { MachineRole } from '../../../core/types';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Toggle } from '../../kit/controls';
import { h } from '../../kit/dom';
import { SlotGrid } from '../../kit/slot';
import { Window } from '../../kit/window';
import { slotHint } from '../inventory/craftingScreen';
import { InventoryPanel } from '../inventory/inventoryPanel';
import { createFurnaceScreen, TO_BAG } from '../furnace/furnaceScreen';
import { pretty, type ScreenSim } from '../furnace/simApi';
import { injectStationCss } from '../furnace/styles';
import { CATEGORY_LABELS, contents, labelName, sortPack } from '../../../game/storage';
import { itemOrNull } from '../../../core/registry';
import { machineLayout } from './machineText';
import { MachinePanel } from './machinePanel';
import { NetworkPanel } from './networkPanel';

const ROLE_TEXT: Record<MachineRole, string> = {
  furnace: 'Furnace',
  generator: 'Generator',
  consumer: 'Machine',
  storage: 'Storage',
  crate: 'Storage',
  boiler: 'Steam',
  crop: 'Crop',
  bush: 'Plant',
  tank: 'Fluid storage',
  hearth_part: 'Hearth part',
  brew: 'Brewing',
  hand: 'Handwork',
  chem: 'Distillery',
};

type At = { x: number; y: number; z: number };

export function createMachineScreen(request: At, ctx: ScreenContext, sim: ScreenSim): GameScreen | null {
  const { x, y, z } = request;
  const first = sim.machineView(x, y, z);
  if (!first) return sim.furnaceView(x, y, z) ? createFurnaceScreen(request, ctx, sim) : null;
  injectStationCss();
  const layout = machineLayout(first.kind, first.role);
  if (layout === 'crate') return createCrateScreen(request, ctx, sim);
  const inventory = sim.machineSlots(x, y, z);
  const panel = new MachinePanel(first, layout, ctx.slots, inventory && inventory.size > 0 ? inventory : null, TO_BAG);
  const net = new NetworkPanel({ compact: true, emptyText: 'Not connected: lay cable to generators, batteries or machines.' });
  const toggle = new Toggle({
    label: `Switch the ${first.name} on or off`,
    tone: 'power',
    value: first.on,
    onChange: (on) => {
      const r = sim.setMachineOn(x, y, z, on);
      if (!r.ok) ctx.bus.emit('toast', { text: pretty(r.reason), kind: 'warn' });
      ctx.invalidate();
    },
  });
  // The pack only beside machines that hold items; the network only for machines on cables; the switch only where
  // switching does something (not a tank or a hearth part).
  const hasSlots = inventory !== null && inventory.size > 0;
  const bag = hasSlots ? new InventoryPanel(ctx.slots, ctx.player.inventory) : null;
  const powered = block(machine(first.kind).blocks[0]).power === 'device';
  const switchable = first.role !== 'tank' && first.role !== 'hearth_part';
  const body = h(
    'div',
    { class: ['hw-mscreen', !bag && 'hw-mscreen--solo'] },
    h('div', { class: 'hw-mscreen__machine' }, panel.el),
    bag ? h('div', { class: 'hw-mscreen__bag' }, bag.el, ctx.slots.actionBar) : null,
    powered ? h('div', { class: 'hw-mscreen__net' }, h('h3', { class: 'hw-heading', text: 'Power network' }), net.el) : null,
  );
  const window = new Window({
    title: first.name,
    subtitle: ROLE_TEXT[first.role],
    headerRight: switchable ? toggle.el : undefined,
    size: bag ? 'lg' : 'md',
    body,
    footer: hasSlots ? slotHint() : undefined,
  });
  window.frame.classList.add('hw-mach-window');
  window.setAccent('var(--hw-power)');

  return {
    window,
    refresh: () => {
      const view = sim.machineView(x, y, z);
      if (!view || view.kind !== first.kind) {
        ctx.close();
        return;
      }
      toggle.set(view.on);
      panel.update(view);
      if (powered) {
        const stats = sim.networkAt(x, y, z);
        net.update(stats, stats !== null && stats.members.length <= 1);
      }
      window.setAccent(view.running ? 'var(--hw-power)' : null);
      ctx.slots.refresh();
    },
    dispose: () => {
      panel.dispose();
      net.dispose();
      bag?.dispose();
    },
  };
}

/** A crate: its 27 slots above (or beside) the backpack; quick move goes across. */
export function createCrateScreen(request: At, ctx: ScreenContext, sim: ScreenSim): GameScreen | null {
  const { x, y, z } = request;
  const inventory = sim.machineSlots(x, y, z);
  if (!inventory || inventory.size === 0) return null;
  injectStationCss();
  const grid = new SlotGrid({ count: inventory.size, columns: 9, label: 'Crate', minSlotPx: 32 });
  const binding = ctx.slots.bind({ id: 'crate', label: 'Crate', inventory, views: grid.slots, quickTo: TO_BAG });
  const bag = new InventoryPanel(ctx.slots, ctx.player.inventory, { quickTo: ['crate'] });
  const note = h('p', { class: 'hw-mscreen__note', text: `Furnaces and workbenches within ${STATION_CRATE_RADIUS} blocks borrow from this crate. Machines touching it push their output into it.` });
  // Storage network (docs/api/storage.md): a label, a sort button and the contents of every chest in range.
  const label = h('select', { class: 'hw-mscreen__label', attrs: { 'aria-label': 'Chest label' } });
  const options = ['', ...CATEGORY_LABELS];
  const customLabel = sim.crateLabel(x, y, z);
  if (customLabel && !options.includes(customLabel)) options.push(customLabel);
  for (const o of options) label.append(h('option', { text: labelName(o), attrs: { value: o } }));
  label.value = customLabel;
  label.addEventListener('change', () => {
    const r = sim.setCrateLabel(x, y, z, label.value);
    if (!r.ok) ctx.bus.emit('toast', { text: r.reason, kind: 'warn' });
    ctx.invalidate();
  });
  const sort = h('button', { class: 'hw-btn', text: 'Sort my pack into chests', attrs: { type: 'button' }, on: { click: () => {
    const moved = sortPack(ctx.player.inventory, sim.storageNetwork(x, y, z), HOTBAR_SIZE);
    ctx.bus.emit('toast', { text: moved > 0 ? `Sorted ${moved} items into the chests` : 'Nothing to sort here', kind: moved > 0 ? 'good' : 'info' });
    ctx.invalidate();
  } } });
  const list = h('ul', { class: 'hw-mscreen__contents' });
  const onToggle = (): void => ctx.invalidate();
  const storage = h('details', { class: 'hw-mscreen__storage' }, h('summary', { text: 'Storage network' }), h('label', {}, 'Label ', label), sort, list);
  storage.addEventListener('toggle', onToggle);
  const body = h(
    'div',
    { class: 'hw-mscreen hw-mscreen--crate' },
    h('div', { class: 'hw-mscreen__machine' }, h('h3', { class: 'hw-heading', text: 'Crate' }), grid.el, note, storage),
    h('div', { class: 'hw-mscreen__bag' }, bag.el, ctx.slots.actionBar),
  );
  const window = new Window({ title: 'Crate', subtitle: `${inventory.size} slots`, size: 'lg', body, footer: slotHint() });
  window.frame.classList.add('hw-mach-window');
  return {
    window,
    refresh: () => {
      if (!sim.machineView(x, y, z)) {
        ctx.close();
        return;
      }
      ctx.slots.refresh();
      if (storage.open) {
        const lines = contents(sim.storageNetwork(x, y, z));
        list.replaceChildren(...(lines.length ? lines.map((l) => h('li', { text: `${itemOrNull(l.item)?.name ?? l.item} x${l.total} (${l.where.join(', ')})` })) : [h('li', { text: 'Empty' })]));
      }
    },
    dispose: () => {
      binding.unbind();
      grid.dispose();
      bag.dispose();
    },
  };
}
