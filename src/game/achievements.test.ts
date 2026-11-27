import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { ACHIEVEMENTS, Achievements, isAchievementsSnapshot, titleStage, type ProgressFacts } from './achievements';

const base: ProgressFacts = { age: 0, goalsDone: 0, made: 0, placed: 0, broken: 0, deaths: 0, day: 1, blocksSeen: 0, playTimeS: 0, drinks: 0, goalDone: () => false, flag: () => false };

describe('Achievements', () => {
  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlocks once, toasts, and waits a second between checks', () => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    let facts = { ...base };
    const a = new Achievements(bus, () => facts);
    expect(a.tick(0.5)).toEqual([]);
    facts = { ...base, broken: 1, day: 4 };
    expect(a.tick(0.4)).toEqual([]);
    expect(a.tick(0.2).map((s) => s.id)).toEqual(['first_steps']);
    expect(a.tick(2)).toEqual([]);
    expect(toasts).toEqual(['Achievement: First Steps']);
    expect(a.toJSON().unlocked).toEqual({ first_steps: 4 });
  });

  it('round-trips and ignores unknown ids', () => {
    const a = new Achievements(createBus(), () => base);
    a.load({ unlocked: { builder: 3, gone: 9 } });
    expect(a.has('builder')).toBe(true);
    expect(a.count).toBe(1);
    expect(isAchievementsSnapshot(a.toJSON())).toBe(true);
    expect(isAchievementsSnapshot({ unlocked: [] })).toBe(false);
  });

  it('maps the age to a title stage', () => {
    expect([undefined, 0, 2, 9, -1].map(titleStage)).toEqual([0, 0, 2, 5, 0]);
  });

  it('unlocks event achievements once and flag/goal ones from the facts', () => {
    const bus = createBus();
    const toasts: string[] = [];
    bus.on('toast', (t) => toasts.push(t.text));
    const a = new Achievements(bus, () => ({ ...base, day: 3, flag: (f) => f === 'ignited', goalDone: (id) => id === 'make_steel' }));
    bus.emit('photo:snap', {});
    bus.emit('photo:snap', {});
    expect(a.has('photographer')).toBe(true);
    expect(toasts.filter((t) => t.includes('Say Cheese'))).toHaveLength(1);
    expect(a.check().map((s) => s.id).sort()).toEqual(['ignited', 'steelmaker']);
    a.dispose();
    bus.emit('brew:done', { x: 0, y: 0, z: 0, drink: 'tea' });
    expect(a.has('brewer')).toBe(false);
  });
});
