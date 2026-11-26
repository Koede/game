import { describe, expect, it } from 'vitest';
import { LEGENDARIES } from '../content/legendary';
import { createBus } from '../core/context';
import { Journal } from './journal';
import { humBars, legendaryNoteKey, legendaryPages, legendarySummary, noteLegendaries, watchLegendaries } from './legendaryNotes';

describe('the legendary notebook pages', () => {
  it('shows a found weapon in full and an unfound one as a silhouette with its rumour', () => {
    const pages = legendaryPages((i) => i === 'emberfang');
    expect(pages).toHaveLength(LEGENDARIES.length);
    const found = pages.find((p) => p.item === 'emberfang')!;
    expect(found).toMatchObject({ found: true, title: 'Emberfang' });
    expect(found.lines).toHaveLength(3);
    const hidden = pages.find((p) => p.item === 'gale_reed')!;
    expect(hidden).toMatchObject({ found: false, title: '???' });
    expect(hidden.lines).toHaveLength(1);
    expect(JSON.stringify(hidden)).not.toContain('Gale Reed');
  });

  it('writes one journal note the first time a legendary is in the pack, never twice', () => {
    const j = new Journal(() => 3);
    expect(noteLegendaries([null, { item: 'bronze_pickaxe', count: 1 }], j)).toEqual([]);
    expect(noteLegendaries([{ item: 'rootsong', count: 1 }], j)).toEqual(['Rootsong']);
    expect(noteLegendaries([{ item: 'rootsong', count: 1 }], j)).toEqual([]);
    expect(j.has(legendaryNoteKey('rootsong'))).toBe(true);
    expect(j.toJSON().entries.at(-1)!.text).toContain('Rootsong');
  });

  it('watches the pack: a toast and a note when one arrives', () => {
    const bus = createBus();
    const j = new Journal(() => 1);
    let slots: ({ item: string; count: number } | null)[] = [];
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    const stop = watchLegendaries(bus, () => slots, j);
    expect(toasts).toEqual([]);
    slots = [{ item: 'starcleaver', count: 1 }];
    bus.emit('inventory:changed', {});
    expect(toasts).toEqual(['Noted in your notebook: Starcleaver']);
    bus.emit('inventory:changed', {});
    expect(toasts).toHaveLength(1);
    stop();
  });
});

describe('the Legends screen and the hum chip (pure parts)', () => {
  it('counts what is found', () => {
    expect(legendarySummary(legendaryPages(() => false))).toBe('0 of 8 found');
    expect(legendarySummary(legendaryPages((i) => i === 'emberfang' || i === 'tidebrand'))).toBe('2 of 8 found');
  });

  it('shows one to three hum bars, more when nearer, none for silence', () => {
    expect(humBars(0)).toBe(0);
    expect(humBars(-1)).toBe(0);
    expect(humBars(0.1)).toBe(1);
    expect(humBars(0.5)).toBe(2);
    expect(humBars(0.99)).toBe(3);
    expect(humBars(1)).toBe(3);
  });
});
