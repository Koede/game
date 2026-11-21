import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import { blockOf } from '../core/registry';
import type { Slot, ToolKind } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import { HandWork } from './handWork';
import type { HandEntity, HandRecipe, HandRules, HandStationDef } from './handTypes';

// Fake content on real block and item keys: 'stone' is the quern, 'dirt' the anvil, 'gravel' the rack, 'plank' the trough.
const def = (key: string, over: Partial<HandStationDef>): HandStationDef => ({
  key, name: key, strokesPerS: 3, tool: null, sound: null, pitch: 1, hot: false, timed: false, batch: 0, needsSky: false, rainResets: false, ...over,
});
const STATIONS: Record<string, HandStationDef> = {
  stone: def('quern', { name: 'Hand Quern', sound: 'grind' }),
  dirt: def('anvil', { name: 'Stone Anvil', tool: 'pickaxe', hot: true, strokesPerS: 2.5 }),
  gravel: def('rack', { name: 'Drying Rack', timed: true, strokesPerS: 0, batch: 8, needsSky: true, rainResets: true }),
  plank: def('trough', { name: 'Tanning Trough', timed: true, strokesPerS: 0, batch: 8 }),
};
const recipe = (r: Partial<HandRecipe> & Pick<HandRecipe, 'id' | 'station' | 'inputs' | 'output'>): HandRecipe =>
  ({ toolOutput: null, bonus: null, strokes: 0, timeS: 0, ...r });
const RECIPES: Record<string, HandRecipe[]> = {
  quern: [recipe({ id: 'flour', station: 'quern', inputs: [{ item: 'wheat', count: 1 }], output: { item: 'flour', count: 1 }, strokes: 6 })],
  anvil: [recipe({ id: 'copper_plate', station: 'anvil', inputs: [{ item: 'copper_ingot', count: 2 }], output: { item: 'copper_plate', count: 1 }, strokes: 8 })],
  rack: [recipe({ id: 'leather', station: 'rack', inputs: [{ item: 'soaked_hide', count: 1 }], output: { item: 'leather', count: 1 }, timeS: 10 })],
  trough: [recipe({ id: 'soaked_hide', station: 'trough', inputs: [{ item: 'hide', count: 1 }], output: { item: 'soaked_hide', count: 1 }, timeS: 6 })],
};
const rules: HandRules = {
  station: (k) => STATIONS[k] ?? null,
  recipes: (s) => RECIPES[s] ?? [],
  toolKind: (i): ToolKind | null => (i === 'flint_pickaxe' ? 'pickaxe' : null),
  itemName: (i) => i.replace(/_/g, ' '),
  stackLimit: () => 16,
};

function setup() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 2.5 });
  const flags: string[] = [];
  const released: Slot[][] = [];
  const hand = new HandWork({
    world, bus, player, rules, random: mulberry32(1), flag: (f) => flags.push(f),
    release: (_x, _y, _z, held) => released.push([...held]),
  });
  bus.on('block:changed', (ev) => hand.blockChanged(ev.x, ev.y, ev.z, blockOf(ev.from), blockOf(ev.to)));
  const seen = <K extends keyof GameEvents>(type: K): Array<GameEvents[K]> => {
    const list: Array<GameEvents[K]> = [];
    bus.on(type, (p) => list.push(p));
    return list;
  };
  const hold = (item: string, count = 1): void => {
    player.inventory.set(player.selectedSlot, { item, count });
  };
  const run = (s: number, sunUp = true, wet: (() => boolean) | null = null): void => {
    for (let i = 0; i < Math.round(s / DT); i++) hand.tick(DT, sunUp, wet);
  };
  return { bus, world, player, hand, flags, released, seen, hold, run };
}

describe('stroke stations', () => {
  it('creates an entity from block:changed and removes it, handing the contents over', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    expect(t.hand.count).toBe(1);
    const e = t.world.getEntity(5, 5, 5) as HandEntity;
    expect(e.kind).toBe('hand');
    e.slots[0] = { item: 'wheat', count: 3 };
    t.world.put(5, 5, 5, 'oak_log');
    expect(t.hand.count).toBe(0);
    expect(t.world.getEntity(5, 5, 5)).toBeUndefined();
    expect(t.released[0]).toEqual([{ item: 'wheat', count: 3 }, null]);
  });

  it('inserts, strokes, finishes and hands the output over to an empty hand', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    const strokes = t.seen('hand:stroke');
    const done = t.seen('hand:done');
    const made = t.seen('item:made');
    t.hold('wheat', 5);
    expect(t.hand.stroke(5, 5, 5, 'wheat')).toEqual({ ok: true, did: 'insert' });
    expect(t.player.inventory.count('wheat')).toBe(0);
    expect((t.world.getEntity(5, 5, 5) as HandEntity).slots[0]).toEqual({ item: 'wheat', count: 5 });
    const foodBefore = t.player.food;
    for (let i = 0; i < 5; i++) expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: true, did: 'stroke' });
    expect(t.hand.view(5, 5, 5)?.label).toBe('Hand Quern - wheat 5/6 strokes');
    expect(t.hand.stroke(5, 5, 5, '')).toEqual({ ok: true, did: 'done', done: true });
    expect(strokes).toHaveLength(6);
    expect(strokes[5]).toMatchObject({ station: 'quern', progress: 6, needed: 6, double: false });
    expect(done).toEqual([{ x: 5, y: 5, z: 5, station: 'quern', output: 'flour', count: 1 }]);
    expect(t.flags).toEqual(['hand_quern']);
    expect(foodBefore - t.player.food).toBeCloseTo(0.06, 5);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ state: 'ready', label: 'Hand Quern - flour ready' });
    // Output waiting: a full hand is refused with the plan's sentence; an empty hand takes it.
    t.hold('wheat', 1);
    expect(t.hand.stroke(5, 5, 5, 'wheat')).toEqual({ ok: false, reason: 'Take the flour first' });
    expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: true, did: 'take' });
    expect(t.player.inventory.count('flour')).toBe(1);
    expect(made).toEqual([{ item: 'flour', count: 1, station: 'quern', recipeId: 'flour' }]);
    expect((t.world.getEntity(5, 5, 5) as HandEntity).slots[0]).toEqual({ item: 'wheat', count: 4 });
  });

  it('refuses with the plan sentences', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    t.world.put(6, 5, 5, 'dirt');
    expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: false, reason: 'Nothing to work' });
    t.hold('flour');
    expect(t.hand.stroke(5, 5, 5, 'flour')).toEqual({ ok: false, reason: 'Hand Quern cannot work flour' });
    t.hold('copper_ingot', 1);
    expect(t.hand.stroke(6, 5, 5, 'copper_ingot')).toEqual({ ok: true, did: 'insert' });
    expect(t.hand.stroke(6, 5, 5, null)).toEqual({ ok: false, reason: 'Needs 2 copper ingot' });
    t.hold('wheat');
    expect(t.hand.stroke(6, 5, 5, 'wheat')).toEqual({ ok: false, reason: 'Busy with copper ingot' });
    expect(t.hand.stroke(1, 1, 1, null)).toMatchObject({ ok: false });
  });

  it('counts strokes double with the tool, or inside the hot window, but never triple', () => {
    const t = setup();
    t.world.put(6, 5, 5, 'dirt');
    const strokes = t.seen('hand:stroke');
    t.hold('copper_ingot', 8);
    t.hand.stroke(6, 5, 5, 'copper_ingot');
    // 8 needed: four tool strokes finish it.
    for (let i = 0; i < 3; i++) t.hand.stroke(6, 5, 5, 'flint_pickaxe');
    expect(strokes.map((s) => s.progress)).toEqual([2, 4, 6]);
    expect(strokes.every((s) => s.double)).toBe(true);
    expect(t.hand.stroke(6, 5, 5, 'flint_pickaxe')).toMatchObject({ ok: true, done: true });
    expect(t.hand.stroke(6, 5, 5, null)).toEqual({ ok: true, did: 'take' });
    // Hot window: bare hands count double; tool and hot do not stack.
    t.hand.openHotWindow(6, 5, 5);
    expect(t.hand.view(6, 5, 5)?.hot).toBe(true);
    t.hand.stroke(6, 5, 5, null);
    t.hand.stroke(6, 5, 5, 'flint_pickaxe');
    expect(strokes.slice(-2).map((s) => s.progress)).toEqual([2, 4]);
    expect(t.hand.view(6, 5, 5)?.label).toBe('Stone Anvil - copper ingot 4/8 strokes (hot)');
    t.run(21);
    expect(t.hand.view(6, 5, 5)?.hot).toBe(false);
    expect(t.hand.activeCount).toBe(0);
    t.hand.stroke(6, 5, 5, null);
    expect(strokes[strokes.length - 1]).toMatchObject({ progress: 5, double: false });
  });

  it('returns the input on request, and refuses while an output waits', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    t.hold('wheat', 3);
    t.hand.stroke(5, 5, 5, 'wheat');
    expect(t.hand.handReturn(5, 5, 5)).toEqual({ ok: true, did: 'return' });
    expect(t.player.inventory.count('wheat')).toBe(3);
    expect(t.hand.handReturn(5, 5, 5)).toEqual({ ok: false, reason: 'Nothing loaded' });
  });

  it('refuses a take when the pack cannot hold the output', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    const e = t.world.getEntity(5, 5, 5) as HandEntity;
    e.slots[1] = { item: 'flour', count: 3 };
    for (let i = 0; i < t.player.inventory.size; i++) t.player.inventory.set(i, { item: 'plank', count: 99 });
    expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: false, reason: 'Your pack is full' });
  });

  it('survives save and load mid-work', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'stone');
    t.hold('wheat', 2);
    t.hand.stroke(5, 5, 5, 'wheat');
    t.hand.stroke(5, 5, 5, null);
    t.hand.stroke(5, 5, 5, null);
    const saved = JSON.parse(JSON.stringify(t.world.getEntity(5, 5, 5))) as HandEntity;
    delete (saved as { made?: unknown }).made;
    saved.progress = Number.NaN;
    const t2 = setup();
    t2.world.setEntity(saved);
    t2.hand.track(saved, STATIONS.stone);
    expect(t2.hand.view(5, 5, 5)?.progress).toBe(0);
    saved.progress = 2;
    expect(t2.hand.view(5, 5, 5)?.label).toBe('Hand Quern - wheat 2/6 strokes');
    for (let i = 0; i < 4; i++) t2.hand.stroke(5, 5, 5, null);
    expect(t2.hand.view(5, 5, 5)?.state).toBe('ready');
  });
});

describe('timed stations', () => {
  const rackWith = (t: ReturnType<typeof setup>, n = 2): void => {
    t.world.put(5, 5, 5, 'gravel');
    t.hold('soaked_hide', n);
    t.hand.stroke(5, 5, 5, 'soaked_hide');
  };

  it('runs a batch under open sky by day and hands all of it over', () => {
    const t = setup();
    rackWith(t, 3);
    expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: false, reason: 'Drying Rack works by itself - wait' });
    t.run(9);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ state: 'working', fraction: expect.closeTo(0.9, 1) });
    t.run(1.5);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ state: 'ready', output: { item: 'leather', count: 3 }, input: null });
    expect(t.hand.activeCount).toBe(0);
    expect(t.hand.stroke(5, 5, 5, null)).toEqual({ ok: true, did: 'take' });
    expect(t.player.inventory.count('leather')).toBe(3);
  });

  it('pauses at night and under a roof, and says why', () => {
    const t = setup();
    rackWith(t);
    t.run(4, false);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ state: 'waiting', waitReason: 'Needs daylight', progress: 0 });
    t.run(3);
    t.world.put(5, 9, 5, 'oak_log');
    t.run(5);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ state: 'waiting', waitReason: 'Needs open sky' });
    expect(t.hand.view(5, 5, 5)?.progress).toBeCloseTo(3, 0);
    t.world.put(5, 9, 5, 'air');
    t.run(8);
    expect(t.hand.view(5, 5, 5)?.state).toBe('ready');
  });

  it('rain resets the rack, but a roof keeps the rain off', () => {
    const t = setup();
    rackWith(t);
    t.run(5);
    t.run(0.5, true, () => true);
    expect(t.hand.view(5, 5, 5)).toMatchObject({ progress: 0, waitReason: expect.stringContaining('Rain') });
    t.run(5, true, () => false);
    expect(t.hand.view(5, 5, 5)?.progress).toBeCloseTo(5, 0);
    t.world.put(5, 8, 5, 'glass');
    t.run(2, true, () => true);
    expect(t.hand.view(5, 5, 5)?.waitReason).toBeNull();
    expect(t.hand.view(5, 5, 5)?.progress).toBeCloseTo(7, 0);
  });

  it('a trough soaks anywhere, in the dark and the rain, and rejects a full batch', () => {
    const t = setup();
    t.world.put(5, 5, 5, 'plank');
    t.world.put(5, 9, 5, 'oak_log');
    t.hold('hide', 12);
    t.hand.stroke(5, 5, 5, 'hide');
    expect((t.world.getEntity(5, 5, 5) as HandEntity).slots[0]?.count).toBe(8);
    t.hold('hide', 4);
    expect(t.hand.stroke(5, 5, 5, 'hide')).toEqual({ ok: false, reason: 'Tanning Trough is full' });
    t.run(6.5, false, () => true);
    expect(t.hand.view(5, 5, 5)?.output).toEqual({ item: 'soaked_hide', count: 8 });
  });

  it('more input mid-way shares the clock; save and load resumes the timer', () => {
    const t = setup();
    rackWith(t, 1);
    t.run(6);
    t.hold('soaked_hide', 1);
    t.hand.stroke(5, 5, 5, 'soaked_hide');
    const saved = JSON.parse(JSON.stringify(t.world.getEntity(5, 5, 5))) as HandEntity;
    const t2 = setup();
    t2.world.setEntity(saved);
    t2.world.put(5, 5, 5, 'gravel');
    expect(t2.hand.count).toBe(1);
    t2.run(4.5);
    expect(t2.hand.view(5, 5, 5)?.output).toEqual({ item: 'leather', count: 2 });
  });
});

describe('perf', () => {
  it('ticks only the stations with a clock running', () => {
    const t = setup();
    for (let i = 0; i < 400; i++) t.world.put(i, 5, 0, 'stone');
    t.world.put(0, 5, 2, 'gravel');
    expect(t.hand.count).toBe(401);
    expect(t.hand.activeCount).toBe(0);
    t.hold('soaked_hide', 4);
    t.hand.stroke(0, 5, 2, 'soaked_hide');
    expect(t.hand.activeCount).toBe(1);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) t.hand.tick(DT, true, null);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
