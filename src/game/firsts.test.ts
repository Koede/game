/** R4 firsts: each feature event earns its achievement and writes one journal line; "Run your first spirit" listens to distill:step. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { CHEM, FLAG_FIRST_SPIRIT } from '../core/distill';
import type { GameEvents } from '../core/gameEvents';
import { OBJECTIVES } from '../core/registry';
import { Achievements, type ProgressFacts } from './achievements';
import { Journal } from './journal';
import { ObjectiveTracker } from './objectives';
import { PlayerState } from './playerState';

const facts: ProgressFacts = { age: 0, goalsDone: 0, made: 0, placed: 0, broken: 0, deaths: 0, day: 3, blocksSeen: 0, playTimeS: 0, drinks: 0 };

type Case = { [K in keyof GameEvents]: { event: K; payload: GameEvents[K]; achievement: string; journal: string; text: RegExp } }[keyof GameEvents];
const CASES: Case[] = [
  { event: 'fish:caught', payload: { item: 'raw_perch' }, achievement: 'first_fish', journal: 'first:fish', text: /first fish: raw perch/ },
  { event: 'waypoint:travelled', payload: { from: 'Waypoint 1', to: 'Waypoint 2' }, achievement: 'first_waypoint', journal: 'first:waypoint', text: /to Waypoint 2/ },
  { event: 'treasure:dug', payload: { x: 1, y: 2, z: 3 }, achievement: 'first_treasure', journal: 'first:treasure', text: /treasure crate/ },
  { event: 'enchant:applied', payload: { item: 'bronze_pickaxe', enchant: 'swift', level: 1 }, achievement: 'first_enchant', journal: 'first:enchant', text: /Enchanted my .* at the altar/ },
  { event: 'pet:tamed', payload: { id: 7, species: 'dog' }, achievement: 'first_pet', journal: 'first:pet', text: /stray dog/ },
  { event: 'town:built', payload: { template: 'storage_bay', built: 1 }, achievement: 'first_town_building', journal: 'first:town_building', text: /first building of the town/ },
  { event: 'town:bounty', payload: { item: 'oak_log', filled: 1 }, achievement: 'first_bounty', journal: 'first:bounty', text: /first build bounty for Gruk: oak log/ },
];

describe('firsts from feature events', () => {
  it.each(CASES)('$event earns $achievement once and writes one journal line', (c) => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    const a = new Achievements(bus, () => facts);
    const j = new Journal(() => 3, bus);
    expect(a.has(c.achievement)).toBe(false);
    const emit = bus.emit.bind(bus) as (e: string, p: unknown) => void;
    emit(c.event, c.payload);
    emit(c.event, c.payload);
    expect(a.has(c.achievement)).toBe(true);
    expect(a.toJSON().unlocked[c.achievement]).toBe(3);
    expect(toasts.filter((t) => t.startsWith('Achievement:'))).toHaveLength(1);
    const lines = j.entries.filter((e) => e.key === c.journal);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'first', day: 3 });
    expect(lines[0].text).toMatch(c.text);
  });

  it('a loaded achievement is not earned again, and dispose stops listening', () => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    const a = new Achievements(bus, () => facts);
    a.load({ unlocked: { first_fish: 1 } });
    bus.emit('fish:caught', { item: 'raw_trout' });
    expect(a.toJSON().unlocked.first_fish).toBe(1);
    a.dispose();
    bus.emit('pet:tamed', { id: 1, species: 'cat' });
    expect(a.has('first_pet')).toBe(false);
    expect(toasts).toEqual([]);
  });
});

describe('Run your first spirit', () => {
  it('is a goal, completed by a boiling flask finishing a run (not a vessel, not a working step)', () => {
    expect(OBJECTIVES.find((o) => o.id === 'first_spirit')).toMatchObject({ title: 'Run your first spirit', condition: { type: 'flag', flag: FLAG_FIRST_SPIRIT } });
    const bus = createBus();
    const o = new ObjectiveTracker(bus, new PlayerState(bus, { x: 0, y: 10, z: 0 }));
    bus.emit('distill:step', { x: 0, y: 0, z: 0, state: 'working', module: CHEM.flask });
    bus.emit('distill:step', { x: 0, y: 0, z: 0, state: 'done', module: CHEM.vessel });
    expect(o.hasFlag(FLAG_FIRST_SPIRIT)).toBe(false);
    bus.emit('distill:step', { x: 0, y: 0, z: 0, state: 'done', module: CHEM.flask });
    expect(o.hasFlag(FLAG_FIRST_SPIRIT)).toBe(true);
  });
});
