import { describe, expect, it } from 'vitest';
import { lifeRig } from './life.rig';
import { CONTESTS, JUDGES, SEASON_DAYS, daysToFestival, festivalDay, festivalOn, judge, judgeScore, medalFor, seasonOf, suits } from './festival';

const seq = (): (() => number) => {
  let i = 0;
  return () => ((i += 0.318) % 1);
};
const none = (): number => 0;

describe('seasons and the festival day', () => {
  it('turns a season every SEASON_DAYS and holds the festival on the last day', () => {
    expect(seasonOf(1)).toEqual({ name: 'Thaw', index: 0, dayIn: 1 });
    expect(seasonOf(SEASON_DAYS).dayIn).toBe(SEASON_DAYS);
    expect(seasonOf(SEASON_DAYS + 1).name).toBe('Bloom');
    expect(seasonOf(SEASON_DAYS * 4 + 1).name).toBe('Thaw');
    expect(festivalDay(SEASON_DAYS)).toBe(true);
    expect(festivalDay(SEASON_DAYS - 1)).toBe(false);
    expect(daysToFestival(SEASON_DAYS)).toBe(0);
    expect(daysToFestival(1)).toBe(SEASON_DAYS - 1);
    expect(festivalOn(SEASON_DAYS, 'evening')).toBe(true);
    expect(festivalOn(SEASON_DAYS, 'night')).toBe(true);
    expect(festivalOn(SEASON_DAYS, 'day')).toBe(false);
    expect(festivalOn(3, 'night')).toBe(false);
  });
});

describe('judging', () => {
  const trust0 = (): number => 0;
  it('has four real judges per contest and marks between 1 and 10', () => {
    for (const c of CONTESTS) expect(JUDGES[c]).toHaveLength(4);
    for (const c of CONTESTS) {
      const r = judge({ contest: c, item: c === 'dance' ? null : c === 'cook' ? 'hearth_stew' : 'sweet_bun', trust: trust0, stage: false }, seq());
      expect(r.marks).toHaveLength(4);
      for (const [, m] of r.marks) expect(m >= 1 && m <= 10).toBe(true);
      expect(r.total).toBe(r.marks.reduce((a, [, m]) => a + m, 0));
    }
  });

  it('rewards what a judge likes, friendship and a stage', () => {
    const plain = judgeScore('rosa', { contest: 'cook', item: 'sweet_bun', trust: trust0, stage: false }, none);
    const liked = judgeScore('rosa', { contest: 'cook', item: 'hearth_stew', trust: trust0, stage: false }, none);
    expect(liked).toBeGreaterThan(plain);
    const friend = judgeScore('rosa', { contest: 'cook', item: 'sweet_bun', trust: () => 60, stage: false }, none);
    expect(friend).toBeGreaterThan(plain);
    const a = judgeScore('mara', { contest: 'dance', item: null, trust: trust0, stage: false }, none);
    const b = judgeScore('mara', { contest: 'dance', item: null, trust: trust0, stage: true }, none);
    expect(b).toBe(a + 1);
  });

  it('pays gold, silver, bronze or thanks by the total', () => {
    expect(medalFor(40).name).toBe('gold');
    expect(medalFor(30).name).toBe('gold');
    expect(medalFor(29).name).toBe('silver');
    expect(medalFor(14).name).toBe('bronze');
    expect(medalFor(13).name).toBe('none');
    expect(medalFor(30).coin).toBeGreaterThan(medalFor(22).coin);
  });

  it('says which items suit which contest', () => {
    expect(suits('cook', 'hearth_stew')).toBe(true);
    expect(suits('cook', 'coal')).toBe(false);
    expect(suits('dance', null)).toBe(true);
    expect(suits('brew', 'hearth_stew')).toBe(false);
  });
});

describe('the festival night', () => {
  const fest = (): ReturnType<typeof lifeRig> => {
    const r = lifeRig({ coins: 0, tod: 0.7 });
    r.state.day = SEASON_DAYS;
    return r;
  };

  it('starts the music at dusk on a festival day and stops it at dawn', () => {
    const r = fest();
    expect(r.npcs.jukeboxOn).toBe(false);
    r.npcs.tick(0.1);
    expect(r.npcs.jukeboxOn).toBe(true);
    expect(r.npcs.festivalNow()).toBe(true);
    expect(r.toasts.join('|')).toMatch(/festival/i);
    r.state.tod = 0.05;
    r.state.day = SEASON_DAYS + 1;
    r.npcs.tick(0.1);
    expect(r.npcs.jukeboxOn).toBe(false);
    expect(r.npcs.festivalNow()).toBe(false);
  });

  it('does not touch a jukebox the player already switched on', () => {
    const r = fest();
    r.npcs.speak(r.by('jukebox'));
    r.npcs.tick(0.1);
    r.state.tod = 0.05;
    r.state.day++;
    r.npcs.tick(0.1);
    expect(r.npcs.jukeboxOn).toBe(true);
  });

  it('lets the player enter each contest once, judged and paid', () => {
    const r = fest();
    r.npcs.tick(0.1);
    const menu = r.npcs.serviceMenu();
    const port = r.npcs.servicePort('rosa');
    expect(menu.buy('fest:dance', port)).toBeTruthy();
    expect(r.toasts.join('|')).toMatch(/dance contest: .* of 40/);
    expect(menu.buy('fest:dance', port)).toBeNull(); // entered tonight
    expect(menu.buy('fest:cook', port)).toMatch(/Hold a dish/);
    r.state.held = { item: 'hearth_stew', count: 2 };
    expect(menu.buy('fest:cook', port)).toBeTruthy();
    expect(r.state.held?.count).toBe(1);
    expect(r.toasts.join('|')).toMatch(/cooking contest/);
    const f = r.npcs.festivalRecord();
    expect(f.gold + f.silver + f.bronze).toBeLessThanOrEqual(2);
  });

  it('is closed by day and off-season, and the record is saved', () => {
    const day = lifeRig({ tod: 0.3 });
    day.state.day = SEASON_DAYS;
    expect(day.npcs.serviceMenu().buy('fest:dance', day.npcs.servicePort('rosa'))).toBeNull();
    const r = fest();
    r.npcs.tick(0.1);
    r.npcs.serviceMenu().buy('fest:dance', r.npcs.servicePort('rosa'));
    const snap = JSON.parse(JSON.stringify(r.npcs.toJSON()));
    expect(snap.festival.entered.dance).toBe(SEASON_DAYS);
    const b = lifeRig({ tod: 0.7 });
    b.state.day = SEASON_DAYS;
    b.npcs.load(snap);
    expect(b.npcs.serviceMenu().buy('fest:dance', b.npcs.servicePort('rosa'))).toBeNull();
  });
});
