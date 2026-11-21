import { describe, expect, it } from 'vitest';
import { DT, INVENTORY_SIZE } from '../core/constants';
import { createBus, type GameBus } from '../core/context';
import { OBJECTIVES, blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { makeStack } from './inventory';
import { CHECK_INTERVAL_S, ObjectiveTracker, formatJoules, formatWatts, type ObjectivesSnapshot, type SimQuery } from './objectives';
import { PlayerState, type PlayerSnapshot } from './playerState';

interface Rig {
  bus: GameBus;
  player: PlayerState;
  tracker: ObjectiveTracker;
  sim: { tempC: number; tier: number; generationW: number; storedJ: number; calls: number };
  completed: string[];
  made(item: string, count?: number): void;
  placed(block: string): void;
  broken(block: string, times?: number): void;
  flag(flag: string): void;
}

function rig(): Rig {
  const bus = createBus();
  const player = new PlayerState(bus);
  const sim = { tempC: 0, tier: 0, generationW: 0, storedJ: 0, calls: 0 };
  const query: SimQuery = {
    maxFurnaceTempC: () => {
      sim.calls++;
      return sim.tempC;
    },
    maxFurnaceTier: () => sim.tier,
    generationW: () => sim.generationW,
    storedJ: () => sim.storedJ,
  };
  const tracker = new ObjectiveTracker(bus, player, query);
  const completed: string[] = [];
  bus.on('objective:completed', (e) => completed.push(e.id));
  const at = { x: 0, y: 0, z: 0 };
  return {
    bus,
    player,
    tracker,
    sim,
    completed,
    made: (item, count = 1) => bus.emit('item:made', { item, count, station: 'hand', recipeId: item }),
    placed: (block) => bus.emit('block:placed', { ...at, voxel: makeVoxel(blockId(block)) }),
    broken: (block, times = 1) => {
      for (let i = 0; i < times; i++) bus.emit('block:broken', { ...at, voxel: makeVoxel(blockId(block)) });
    },
    flag: (flag) => bus.emit('flag', { flag }),
  };
}

/** Plays the first five objectives: logs, planks, workbench, flint, pickaxe. */
function playFive(r: Rig): void {
  r.broken('pine_log', 4);
  r.placed('chopping_block');
  r.made('plank', 4);
  r.placed('workbench');
  r.player.give('flint', 3);
  r.made('flint_pickaxe');
  r.tracker.check();
}

describe('ObjectiveTracker', () => {
  it('walks through the first eleven objectives', () => {
    const r = rig();
    const { tracker } = r;
    const sounds: string[] = [];
    const toasts: string[] = [];
    r.bus.on('sfx', (e) => sounds.push(e.name));
    r.bus.on('toast', (e) => toasts.push(e.text));
    expect(tracker.current?.id).toBe('gather_logs');
    expect(tracker.progress()).toEqual({ current: 0, target: 4, fraction: 0, text: '0 / 4' });
    expect(tracker.upcoming).toHaveLength(OBJECTIVES.length - 1);

    r.broken('oak_log', 3);
    r.broken('pine_log', 1);
    tracker.check();
    expect(tracker.current?.id).toBe('gather_logs');
    expect(tracker.progress()).toEqual({ current: 3, target: 4, fraction: 0.75, text: '3 / 4' });
    r.broken('oak_log');
    tracker.check();
    expect(r.completed).toEqual(['gather_logs']);
    expect(toasts).toEqual([`Done: ${OBJECTIVES[0].title}`]);

    r.placed('chopping_block');
    tracker.check();
    expect(tracker.current?.id).toBe('make_planks');
    r.made('plank', 4);
    tracker.check();
    expect(tracker.current?.id).toBe('place_workbench');
    r.placed('workbench');
    tracker.check();
    expect(tracker.current?.id).toBe('find_flint');
    r.player.give('flint', 2);
    tracker.check();
    expect(tracker.progress()?.text).toBe('2 / 3');
    r.player.give('flint', 1);
    tracker.check();
    expect(tracker.current?.id).toBe('make_pickaxe');
    r.made('flint_pickaxe');
    tracker.check();
    expect(tracker.current?.id).toBe('collect_rubble');

    r.player.give('rubble', 12);
    tracker.check();
    expect(tracker.current?.id).toBe('collect_clay');
    r.player.give('clay', 6);
    tracker.check();
    expect(tracker.current?.id).toBe('place_furnace');

    r.placed('furnace_clay');
    tracker.check();
    expect(tracker.current?.id).toBe('light_furnace');
    expect(r.player.inventory.count('torch')).toBe(4);
    expect(tracker.progress()).toEqual({ current: 0, target: 1, fraction: 0, text: '' });
    r.flag('furnace_lit');
    tracker.check();
    r.made('charcoal', 3);
    tracker.check();
    expect(tracker.current?.id).toBe('make_charcoal');
    r.made('charcoal', 2);
    tracker.check();

    expect(r.completed).toEqual(OBJECTIVES.slice(0, 11).map((o) => o.id));
    expect(tracker.completed.map((o) => o.id)).toEqual(r.completed);
    expect(tracker.current?.id).toBe('get_warm');
    expect(tracker.upcoming[0].id).toBe(OBJECTIVES[12].id);
    expect(tracker.isComplete('place_furnace')).toBe(true);
    expect(tracker.isComplete('get_warm')).toBe(false);
    expect(sounds.filter((s) => s === 'objective')).toHaveLength(11);
    expect(tracker.age).toBe(0);
  });

  it('counts from the first moment and completes several objectives in one check', () => {
    const r = rig();
    // Everything for the first ten objectives happens before the tracker looks even once.
    r.flag('furnace_lit');
    r.made('charcoal', 4);
    r.placed('furnace_clay');
    r.player.give('clay', 6);
    r.player.give('rubble', 12);
    playFive(r);
    expect(r.completed).toEqual(OBJECTIVES.slice(0, 11).map((o) => o.id));
    expect(r.tracker.current?.id).toBe('get_warm');
    expect(r.player.inventory.count('torch')).toBe(4);
  });

  it('checks a few times per second, not every tick', () => {
    const r = rig();
    for (let i = 0; i < 20; i++) r.tracker.tick(DT);
    expect(r.sim.calls).toBeGreaterThanOrEqual(3);
    expect(r.sim.calls).toBeLessThanOrEqual(Math.ceil(1 / CHECK_INTERVAL_S) + 1);
    r.broken('oak_log', 4);
    expect(r.completed).toEqual([]);
    for (let i = 0; i < 6; i++) r.tracker.tick(DT);
    expect(r.completed).toEqual(['gather_logs']);
  });

  it('keeps a reward that does not fit and hands it over when there is room', () => {
    const r = rig();
    r.player.give('clay', 6);
    playFive(r);
    for (let i = 0; i < INVENTORY_SIZE; i++) if (!r.player.inventory.get(i)) r.player.inventory.set(i, makeStack('rubble', 99));
    r.placed('furnace_clay');
    const gained: string[] = [];
    r.bus.on('item:gained', (e) => gained.push(`${e.count} ${e.item}`));
    r.tracker.check();
    expect(r.tracker.isComplete('place_furnace')).toBe(true);
    expect(r.player.inventory.count('torch')).toBe(0);
    expect(r.tracker.toJSON().pendingRewards).toEqual([{ item: 'torch', count: 4 }]);
    r.tracker.check();
    expect(gained).toEqual([]);
    r.player.inventory.set(20, null);
    r.tracker.check();
    expect(r.player.inventory.get(20)).toEqual({ item: 'torch', count: 4 });
    expect(gained).toEqual(['4 torch']);
    expect(r.tracker.toJSON().pendingRewards).toEqual([]);
  });

  it('remembers the highest simulation values and formats progress', () => {
    const r = rig();
    const { tracker } = r;
    r.sim.tempC = 453.7;
    r.sim.generationW = 500;
    r.sim.storedJ = 250_000;
    tracker.check();
    expect(tracker.progressOf({ type: 'furnaceTemp', tempC: 800 })).toEqual({ current: 453.7, target: 800, fraction: 453.7 / 800, text: '453 / 800 C' });
    expect(tracker.progressOf({ type: 'generate', watts: 2000 }).text).toBe('500 W / 2 kW');
    expect(tracker.progressOf({ type: 'stored', joules: 1_000_000 }).text).toBe('250 kJ / 1 MJ');
    expect(tracker.progressOf({ type: 'furnaceTier', tier: 2 }).text).toBe('Tier 0 / 2');
    r.sim.tempC = 850;
    tracker.check();
    r.sim.tempC = 100;
    r.sim.generationW = 0;
    tracker.check();
    expect(tracker.progressOf({ type: 'furnaceTemp', tempC: 800 })).toEqual({ current: 800, target: 800, fraction: 1, text: '800 / 800 C' });
    expect(tracker.progressOf({ type: 'generate', watts: 2000 }).fraction).toBe(0.25);
    expect(tracker.progressOf({ type: 'make', item: 'plank', count: 4 }).fraction).toBe(0);
    expect(tracker.progressOf({ type: 'any', of: [{ type: 'flag', flag: 'x' }, { type: 'furnaceTemp', tempC: 1700 }] }).text).toBe('850 / 1700 C');
    expect(tracker.hasFlag('x')).toBe(false);
    expect(formatWatts(60_000)).toBe('60 kW');
    expect(formatWatts(1_500_000)).toBe('1.5 MW');
    expect(formatWatts(99.6)).toBe('100 W');
    expect(formatJoules(2_400_000)).toBe('2.4 MJ');
    expect(formatJoules(12)).toBe('12 J');
  });

  it('advances the age once per age as furnace tiers are reached', () => {
    const r = rig();
    const ages: number[] = [];
    const sounds: string[] = [];
    r.bus.on('age:advanced', (e) => ages.push(e.age));
    r.bus.on('sfx', (e) => sounds.push(e.name));
    r.placed('furnace_clay');
    r.tracker.check();
    expect(r.tracker.age).toBe(0);
    expect(ages).toEqual([]);
    r.sim.tier = 2;
    r.tracker.check();
    r.tracker.check();
    expect(ages).toEqual([1]);
    expect(r.tracker.age).toBe(1);
    // The furnace is lost: the age stays.
    r.sim.tier = 0;
    r.tracker.check();
    expect(r.tracker.age).toBe(1);
    r.bus.emit('furnace:upgraded', { x: 0, y: 0, z: 0, tier: 4 });
    r.tracker.check();
    expect(ages).toEqual([1, 2, 3]);
    expect(sounds.filter((s) => s === 'age')).toHaveLength(3);
    r.bus.emit('furnace:upgraded', { x: 0, y: 0, z: 0, tier: 5 });
    r.bus.emit('furnace:upgraded', { x: 0, y: 0, z: 0, tier: 99 });
    r.tracker.check();
    expect(ages).toEqual([1, 2, 3, 4]);
    expect(r.tracker.progressOf({ type: 'furnaceTier', tier: 5 }).fraction).toBe(1);
  });

  it('saves and loads in the middle of the list', () => {
    const r = rig();
    r.flag('furnace_lit');
    r.sim.tier = 2;
    r.sim.tempC = 640;
    playFive(r);
    expect(r.tracker.current?.id).toBe('collect_rubble');
    const saved = JSON.parse(JSON.stringify({ tracker: r.tracker, player: r.player })) as { tracker: ObjectivesSnapshot; player: PlayerSnapshot };

    const next = rig();
    const events: string[] = [];
    next.bus.on('objective:completed', (e) => events.push(e.id));
    next.bus.on('age:advanced', (e) => events.push(`age ${e.age}`));
    next.bus.on('toast', (e) => events.push(e.text));
    next.player.load(saved.player);
    next.tracker.load(saved.tracker);
    expect(events).toEqual([]);
    expect(next.tracker.toJSON()).toEqual(r.tracker.toJSON());
    expect(next.tracker.current?.id).toBe('collect_rubble');
    expect(next.tracker.completed.map((o) => o.id)).toEqual(OBJECTIVES.slice(0, 6).map((o) => o.id));
    expect(next.tracker.age).toBe(1);
    expect(next.tracker.hasFlag('furnace_lit')).toBe(true);
    expect(next.tracker.progressOf({ type: 'furnaceTemp', tempC: 800 }).current).toBe(640);
    next.tracker.check();
    expect(events).toEqual([]);

    // Play on: rubble, clay, the furnace, and the fire that was already lit before the save.
    next.player.give('rubble', 12);
    next.player.give('clay', 6);
    next.placed('furnace_clay');
    next.tracker.check();
    expect(next.completed).toEqual(['collect_rubble', 'collect_clay', 'place_furnace', 'light_furnace']);
    expect(next.tracker.current?.id).toBe('make_charcoal');
  });

  it('has nothing current once every objective is complete', () => {
    const r = rig();
    r.tracker.load({
      completed: OBJECTIVES.map((o) => o.id),
      flags: [],
      peaks: { tempC: 0, tier: 5, generationW: 0, storedJ: 0 },
      age: 4,
      pendingRewards: [{ item: 'not_an_item', count: 1 }],
    });
    expect(r.tracker.allDone).toBe(true);
    expect(r.tracker.current).toBeNull();
    expect(r.tracker.progress()).toBeNull();
    expect(r.tracker.upcoming).toEqual([]);
    expect(r.tracker.completed).toHaveLength(OBJECTIVES.length);
    expect(r.tracker.toJSON().pendingRewards).toEqual([]);
    r.tracker.check();
    expect(r.completed).toEqual([]);
    r.tracker.dispose();
    r.flag('late');
    expect(r.tracker.hasFlag('late')).toBe(false);
  });
});
