import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { AGES, OBJECTIVES } from '../core/registry';
import { CELL, Journal, resumeLine, MAX_ENTRIES, isJournalSnapshot } from './journal';

describe('resumeLine', () => {
  it('says where you are and what is next', () => {
    expect(resumeLine(5, 'Light the furnace', { day: 4, kind: 'goal', text: 'Done: Gather logs.' })).toBe('Welcome back - day 5. Last: Done: Gather logs. Next: Light the furnace.');
    expect(resumeLine(1, null, undefined)).toBe('Welcome back - day 1.');
  });
});

describe('Journal', () => {
  it('writes a line when a goal is done and an age begins, once each', () => {
    const bus = createBus();
    let day = 1;
    const j = new Journal(() => day, bus);
    bus.emit('objective:completed', { id: OBJECTIVES[0].id });
    bus.emit('objective:completed', { id: OBJECTIVES[0].id });
    day = 3;
    bus.emit('age:advanced', { age: 1 });
    expect(j.entries.map((e) => e.kind)).toEqual(['goal', 'age']);
    expect(j.entries[0].text).toContain(OBJECTIVES[0].title);
    expect(j.entries[1]).toMatchObject({ day: 3 });
    expect(j.entries[1].text).toContain(AGES[1].name);
    j.dispose();
    bus.emit('player:death', { cause: 'fall' });
    expect(j.entries).toHaveLength(2);
  });

  it('keeps only the newest entries', () => {
    const j = new Journal(() => 1);
    for (let i = 0; i < MAX_ENTRIES + 10; i++) j.add('note', `n${i}`);
    expect(j.entries).toHaveLength(MAX_ENTRIES);
    expect(j.entries[0].text).toBe('n10');
  });

  it('fills the map as the player walks, including negative coordinates', () => {
    const j = new Journal(() => 1);
    expect(j.bounds()).toBeNull();
    j.explore(-100, 50);
    expect(j.isSeen(-100, 50)).toBe(true);
    expect(j.isSeen(-100 + 40, 50)).toBe(false);
    const before = j.seenCells;
    j.explore(-100 + 1, 50);
    expect(j.seenCells).toBe(before);
    j.explore(-100 + CELL * 6, 50);
    expect(j.seenCells).toBeGreaterThan(before);
    const b = j.bounds()!;
    expect(b.minX).toBeLessThan(-100);
    expect(b.maxX).toBeGreaterThan(-100 + CELL * 6);
  });

  it('round-trips through JSON and rejects damaged snapshots', () => {
    const a = new Journal(() => 2);
    a.add('goal', 'x', 'k');
    a.explore(5, 5);
    a.explore(300, -300);
    const snap = JSON.parse(JSON.stringify(a.toJSON())) as unknown;
    expect(isJournalSnapshot(snap)).toBe(true);
    const b = new Journal(() => 2);
    b.load(snap as ReturnType<Journal['toJSON']>);
    expect(b.seenCells).toBe(a.seenCells);
    expect(b.isSeen(300, -300)).toBe(true);
    expect(b.add('goal', 'x', 'k')).toBe(false);
    expect(isJournalSnapshot({ entries: [{ day: 1, kind: 'nope', text: 't' }], seen: {} })).toBe(false);
    expect(isJournalSnapshot(null)).toBe(false);
  });
});
