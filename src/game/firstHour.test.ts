import { describe, expect, it } from 'vitest';
import { OBJECTIVES } from '../core/registry';
import { CAMP_GOALS } from './campGoals';
import { CAMP_SLOTS, FIRST_HOUR_LAST_MAIN, firstHourPath, firstHourStep } from './firstHour';

const facts = (complete: string[], camp: string[] | null) => ({ isComplete: (id: string) => complete.includes(id), campDone: camp ? new Set(camp) : null });

describe('first hour path', () => {
  it('every slot names a real camp goal and a real main goal', () => {
    for (const s of CAMP_SLOTS) {
      expect(CAMP_GOALS.some((g) => g.id === s.camp)).toBe(true);
      if (s.after) expect(OBJECTIVES.some((o) => o.id === s.after)).toBe(true);
    }
    expect(OBJECTIVES.some((o) => o.id === FIRST_HOUR_LAST_MAIN)).toBe(true);
  });

  it('keeps the main goals in tracker order and puts the camp goals where they belong', () => {
    const path = firstHourPath(true);
    const mains = path.filter((e) => e.kind === 'main').map((e) => e.id);
    const order = OBJECTIVES.map((o) => o.id).filter((id) => mains.includes(id));
    expect(mains).toEqual(order);
    expect(path[0]).toEqual({ kind: 'camp', id: 'meet_builder' });
    const at = (id: string) => path.findIndex((e) => e.id === id);
    expect(at('first_night')).toBe(at('get_warm') + 1);
    expect(at('first_bounty')).toBe(at('eat_food') + 1);
  });

  it('a world without a camp track gets only the main goals', () => {
    expect(firstHourPath(false).every((e) => e.kind === 'main')).toBe(true);
  });
});

describe('firstHourStep', () => {
  it('starts with meeting Gruk, then moves to wood', () => {
    expect(firstHourStep(facts([], []))?.id).toBe('meet_builder');
    const s = firstHourStep(facts([], ['meet_builder']));
    expect(s).toMatchObject({ kind: 'main', id: 'gather_logs' });
    expect(s!.index).toBe(2);
  });

  it('sleeps a night after warming up, and fills a bounty after eating', () => {
    const upToWarm = firstHourPath(true).filter((e) => e.kind === 'main').map((e) => e.id);
    const beforeWarm = upToWarm.slice(0, upToWarm.indexOf('get_warm') + 1);
    expect(firstHourStep(facts(beforeWarm, ['meet_builder']))?.id).toBe('first_night');
    expect(firstHourStep(facts(upToWarm, ['meet_builder', 'first_night']))?.id).toBe('first_bounty');
  });

  it('is null when the whole hour is done, and for a player already past it', () => {
    const all = OBJECTIVES.map((o) => o.id);
    expect(firstHourStep(facts(all, CAMP_GOALS.map((g) => g.id)))).toBeNull();
    expect(firstHourStep(facts(all, null))).toBeNull();
  });
});
