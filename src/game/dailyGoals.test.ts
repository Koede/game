import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { DAYS_PER_SEASON } from '../sim/seasons';
import { DAILY_COUNT, DAILY_KEEPSAKES, DAILY_POOL, DailyGoals, KEEPSAKES, SEASONAL_GOALS, dailyFor, isDailyGoalsSnapshot, keepsakeOf, seasonKeyOf, type GoalFacts } from './dailyGoals';

const zero: GoalFacts = { made: 0, placed: 0, broken: 0, drunk: 0, explored: 0 };

function rig(opts: { room?: number } = {}) {
  const bus = createBus();
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  const s = { day: 1, facts: { ...zero }, room: opts.room ?? 99, given: [] as string[] };
  const goals = new DailyGoals({
    bus,
    seed: 7,
    day: () => s.day,
    facts: () => s.facts,
    give: (item, count) => {
      const took = Math.min(count, s.room);
      s.room -= took;
      for (let i = 0; i < took; i++) s.given.push(item);
      return count - took;
    },
  });
  return { goals, s, toasts };
}

describe('DailyGoals content', () => {
  it('has unique ids and every reward points at something real', () => {
    const ids = [...DAILY_POOL, ...Object.values(SEASONAL_GOALS).flat()].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of Object.values(SEASONAL_GOALS).flat()) expect(g.reward.kind === 'cosmetic' && keepsakeOf(g.reward.id)).toBeTruthy();
    expect(new Set(KEEPSAKES.map((k) => k.id)).size).toBe(KEEPSAKES.length);
  });

  it('picks three goals of different kinds, the same for a seed and day, and rotates by day', () => {
    const a = dailyFor(5, 3);
    expect(a).toHaveLength(DAILY_COUNT);
    expect(new Set(a.map((g) => g.metric)).size).toBe(DAILY_COUNT);
    expect(dailyFor(5, 3)).toEqual(a);
    const days = new Set(Array.from({ length: 20 }, (_, i) => dailyFor(5, i + 1).map((g) => g.id).join()));
    expect(days.size).toBeGreaterThan(5);
  });

  it('turns the season key every DAYS_PER_SEASON days and the year after four seasons', () => {
    expect(seasonKeyOf(1)).toBe('0:spring');
    expect(seasonKeyOf(DAYS_PER_SEASON)).toBe('0:spring');
    expect(seasonKeyOf(DAYS_PER_SEASON + 1)).toBe('0:summer');
    expect(seasonKeyOf(DAYS_PER_SEASON * 4 + 1)).toBe('1:spring');
  });
});

describe('DailyGoals', () => {
  it('completes a daily goal from progress made since the day began, paying once', () => {
    const { goals, s, toasts } = rig();
    s.facts = { ...zero, made: 500, placed: 500, broken: 500, drunk: 500, explored: 90000 };
    goals.sync(); // first look: the base is whatever the numbers already are
    expect(goals.daily().every((g) => !g.done && g.current === 0)).toBe(true);
    const first = dailyFor(7, 1)[0];
    s.facts[first.metric] += first.target;
    goals.sync();
    goals.sync();
    expect(goals.daily().find((g) => g.id === first.id)?.done).toBe(true);
    expect(s.given.length + goals.keepsakes.length).toBe(first.reward.kind === 'item' ? first.reward.count : 1);
    expect(toasts.filter((t) => t.startsWith('Daily goal'))).toHaveLength(1);
  });

  it('gives a keepsake when all three are done, and rotates with a new day', () => {
    const { goals, s, toasts } = rig();
    goals.sync();
    for (const g of dailyFor(7, 1)) s.facts[g.metric] += g.target;
    goals.sync();
    expect(goals.bonusPaid).toBe(true);
    expect(goals.keepsakes).toHaveLength(1);
    expect(DAILY_KEEPSAKES.some((k) => k.id === goals.keepsakes[0])).toBe(true);
    expect(goals.worn).toBe(goals.keepsakes[0]);
    s.day = 2;
    goals.sync();
    expect(goals.bonusPaid).toBe(false);
    expect(goals.daily().every((g) => !g.done)).toBe(true);
    expect(toasts).toContain('New daily goals in the Hearth Log');
  });

  it('holds item rewards until the pack has room', () => {
    const { goals, s } = rig({ room: 0 });
    goals.sync();
    const g = dailyFor(7, 1).find((x) => x.reward.kind === 'item')!;
    s.facts[g.metric] += g.target;
    goals.sync();
    expect(s.given).toHaveLength(0);
    s.room = 99;
    goals.sync();
    expect(s.given.length).toBeGreaterThan(0);
  });

  it('runs a seasonal goal across the season, pays a keepsake once, and starts fresh the next season', () => {
    const { goals, s } = rig();
    goals.sync();
    const [a] = SEASONAL_GOALS.spring;
    s.day = 4;
    s.facts[a.metric] += a.target;
    goals.sync();
    expect(goals.seasonal().season).toBe('spring');
    expect(goals.seasonal().goals[0].done).toBe(true);
    expect(goals.keepsakes).toContain(a.reward.kind === 'cosmetic' ? a.reward.id : '');
    const snap = JSON.parse(JSON.stringify(goals.toJSON()));
    expect(isDailyGoalsSnapshot(snap)).toBe(true);
    const copy = rig();
    copy.s.day = 4;
    copy.s.facts = { ...s.facts };
    copy.goals.load(snap);
    copy.goals.sync();
    expect(copy.goals.keepsakes).toHaveLength(goals.keepsakes.length); // a reload never pays again
    s.day = DAYS_PER_SEASON + 1;
    goals.sync();
    expect(goals.seasonal().season).toBe('summer');
    expect(goals.seasonal().goals.every((g) => !g.done && g.current === 0)).toBe(true);
    expect(goals.keepsakes.length).toBeGreaterThanOrEqual(1);
  });

  it('wears only what it owns, and drops unknown keepsakes on load', () => {
    const { goals } = rig();
    goals.wear('k_sun_hat');
    expect(goals.worn).toBeNull();
    goals.load({ ...goals.toJSON(), keepsakes: ['k_sun_hat', 'gone'], worn: 'gone' });
    expect(goals.keepsakes).toEqual(['k_sun_hat']);
    expect(goals.worn).toBeNull();
    goals.wear('k_sun_hat');
    expect(goals.worn).toBe('k_sun_hat');
    expect(isDailyGoalsSnapshot({ day: 1 })).toBe(false);
  });
});
