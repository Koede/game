/** The pipe screen's DOM-free logic, partly against real pipe views (src/sim/testKit + pipeKit). */
import { describe, expect, it } from 'vitest';
import type { PortView } from '../../../sim';
import { run } from '../../../sim/pipeKit';
import { makeKit } from '../../../sim/testKit';
import {
  contentText, distanceText, filterChoices, filterSummary, lineSummary, nearPorts, pipeFooter, portKey, portTone, priorityNote, priorityText,
  pullAdvice, setFilterSlot,
} from './pipeText';

/** crate (with ore) -> bronze chutes -> crate, and a third crate on a branch. */
function itemLine() {
  const kit = makeKit();
  const a = kit.machine('crate', 0, 1, 0);
  a.slots[0] = { item: 'copper_ore', count: 20 };
  run(kit.world, 'item_pipe', [1, 1, 0], [5, 1, 0]);
  kit.machine('crate', 6, 1, 0);
  kit.machine('crate', 3, 1, 1);
  kit.sim.setPort(1, 1, 0, 1 /* Face.NX */, { mode: 'pull' });
  return kit;
}

describe('pipe screen text', () => {
  it('reads a real item line: summary, nearest-first ports, tones', () => {
    const kit = itemLine();
    kit.run(0.5);
    const view = kit.sim.pipeView(1, 1, 0)!;
    expect(lineSummary(view.network)).toBe('Item line - 5 pipes, 3 ends');
    expect(view.ports.map((p) => p.mode)).toEqual(['pull', 'push', 'push']);
    const pull = view.ports[0];
    expect(pull.status).toMatch(/^Moving/);
    expect(portTone(pull)).toBe('good');
    expect(portKey(pull)).toBe('1,1,0,1');
    expect(contentText(view.network)).toMatch(/^\d+ bundles? moving \(\d+ items?\)$/);
    expect(distanceText(pull.distance)).toBe('At this pipe');
    expect(distanceText(1)).toBe('1 block away');
    expect(distanceText(4.2)).toBe('4 blocks away');
  });

  it('tones every kind of status', () => {
    const p = (status: string, extra: Partial<PortView> = {}) => ({ status, mode: 'pull' as const, inert: false, blocked: 0, moving: false, ...extra });
    expect(portTone(p('Blocked', { blocked: 2 }))).toBe('bad');
    expect(portTone(p('Too hot for this pipe'))).toBe('bad');
    expect(portTone(p('Network too long', { inert: true }))).toBe('bad');
    expect(portTone(p('Off', { mode: 'off' }))).toBe('neutral');
    expect(portTone(p('Receiving Copper Ore', { mode: 'push' }))).toBe('good');
    expect(portTone(p('Ready', { mode: 'push' }))).toBe('neutral');
    expect(portTone(p('No destination'))).toBe('warn');
    expect(portTone(p('Destination full'))).toBe('warn');
  });

  it('edits the filter slot by slot', () => {
    expect(setFilterSlot([], 0, 'coal')).toEqual(['coal']);
    expect(setFilterSlot(['coal'], 1, 'copper_ore')).toEqual(['coal', 'copper_ore']);
    expect(setFilterSlot(['coal', 'copper_ore'], 0, 'tin_ore')).toEqual(['tin_ore', 'copper_ore']);
    expect(setFilterSlot(['coal', 'copper_ore'], 0, 'copper_ore')).toEqual(['copper_ore']);
    expect(setFilterSlot(['coal', 'copper_ore'], 2, 'coal')).toEqual(['coal', 'copper_ore']);
    expect(setFilterSlot(['coal', 'copper_ore', 'tin_ore'], 1, null)).toEqual(['coal', 'tin_ore']);
    expect(setFilterSlot(['a', 'b', 'c', 'd', 'e'], 5, 'f')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(filterSummary('item', { filter: [], filterMode: 'deny' })).toBe('Everything');
    expect(filterSummary('item', { filter: ['copper_ore', 'tin_ore'], filterMode: 'allow' })).toBe('Only Copper Ore and Tin Ore');
    expect(filterSummary('fluid', { filter: ['lava'], filterMode: 'deny' })).toBe('All but Lava');
  });

  it('offers the pack for item filters and every fluid for fluid filters', () => {
    const pack = [{ item: 'coal', count: 3 }, null, { item: 'copper_ore', count: 1 }, { item: 'coal', count: 9 }];
    expect(filterChoices('item', pack)).toEqual(['coal', 'copper_ore']);
    expect(filterChoices('fluid', pack)).toEqual(['water', 'lava', 'steam', 'crude_oil', 'fuel']);
  });

  it('words priority, fluid contents and long lists', () => {
    expect([2, 0, -1].map(priorityText)).toEqual(['+2', '0', '-1']);
    expect(priorityNote(1)).toMatch(/before/);
    expect(contentText({ family: 'fluid', fluidName: 'Water', litres: 1210.4, capacityL: 3000, packets: 0, items: 0 })).toBe('Water - 1,210 of 3,000 L');
    expect(contentText({ family: 'fluid', fluidName: null, litres: 0, capacityL: 500, packets: 0, items: 0 })).toBe('Empty - holds up to 500 L');
    expect(contentText({ family: 'fluid', fluidName: 'Water', litres: 0, capacityL: 500, packets: 0, items: 0 })).toBe('Water flowing through - none held (room for 500 L)');
    expect(contentText({ family: 'item', fluidName: null, litres: 0, capacityL: 0, packets: 0, items: 0 })).toBe('Nothing moving');
    expect(lineSummary({ family: 'fluid', pipes: 1, ports: 1, hot: true })).toBe('Hot fluid line - 1 pipe, 1 end');
    const ports = Array.from({ length: 11 }, (_, i) => ({ distance: i }) as PortView);
    expect(nearPorts(ports, false)).toMatchObject({ more: 3 });
    expect(nearPorts(ports, false).shown).toHaveLength(8);
    expect(nearPorts(ports, true)).toMatchObject({ more: 0 });
  });

  it('says when no end pulls, and points at the likeliest source', () => {
    const kit = itemLine();
    const view = kit.sim.pipeView(1, 1, 0)!;
    expect(pullAdvice(view.ports)).toBeNull();
    kit.sim.setPort(1, 1, 0, 1 /* Face.NX */, { mode: 'push' });
    const pushing = kit.sim.pipeView(1, 1, 0)!.ports;
    expect(pullAdvice(pushing)).toEqual({ text: 'No end is pulling - set the end you take from to Pull', source: portKey(pushing[0]) });
    const toFurnace = [
      { x: 0, y: 0, z: 0, dir: 0, mode: 'push' as const, inert: false, block: 'furnace_clay' },
      { x: 1, y: 0, z: 0, dir: 0, mode: 'push' as const, inert: false, block: 'crate' },
    ];
    expect(pullAdvice(toFurnace)?.source).toBe('1,0,0,0');
    expect(pullAdvice([])).toBeNull();
  });

  it('words the footer for touch or mouse', () => {
    expect(pipeFooter(true)).toMatch(/Tap a block's name/);
    expect(pipeFooter(false)).toMatch(/Click a block's name/);
  });
});
