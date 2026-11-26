import { describe, expect, it } from 'vitest';
import { CAMP_GOALS, currentGoal, doneGoals, type CampFacts } from './campGoals';

const none: CampFacts = { metBuilder: false, warmed: false, rested: false, standing: 0, lodgeLevel: 0, residents: 0 };

describe('camp goals', () => {
  it('start with Gruk and finish with a home for three, in a fixed order', () => {
    expect(CAMP_GOALS.map((g) => g.id)).toEqual(['meet_builder', 'warm_up', 'first_night', 'first_bounty', 'open_lodge', 'first_newcomer', 'three_neighbours']);
    expect(currentGoal(doneGoals(none))?.id).toBe('meet_builder');
  });

  it('is one goal at a time, from the facts', () => {
    const f1 = doneGoals({ ...none, metBuilder: true });
    expect([...f1]).toEqual(['meet_builder']);
    expect(currentGoal(f1)?.id).toBe('warm_up');
    const f2 = doneGoals({ ...none, metBuilder: true, warmed: true, rested: true });
    expect(currentGoal(f2)?.id).toBe('first_bounty');
  });

  it('counts the work behind you: a world with a lodge and a neighbour has done everything before it', () => {
    const done = doneGoals({ ...none, lodgeLevel: 2, residents: 1 });
    expect(currentGoal(done)?.id).toBe('three_neighbours');
    for (const id of ['meet_builder', 'warm_up', 'first_night', 'first_bounty', 'open_lodge', 'first_newcomer']) expect(done.has(id), id).toBe(true);
  });

  it('is finished with three neighbours, and a seen goal stays done', () => {
    expect(currentGoal(doneGoals({ ...none, lodgeLevel: 4, residents: 3 }))).toBeNull();
    const seen = new Set(['warm_up']);
    const done = doneGoals(none, seen);
    expect(done.has('warm_up')).toBe(true);
    expect(done.has('meet_builder')).toBe(true);
  });

  it('is not part of the main goal list, so no save can be stuck on one', async () => {
    const { OBJECTIVES } = await import('../core/registry');
    await import('../content');
    for (const g of CAMP_GOALS) expect(OBJECTIVES.some((o) => o.id === g.id), g.id).toBe(false);
  });
});
