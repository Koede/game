import { describe, expect, it } from 'vitest';
import { lifeRig } from './life.rig';
import { DAYS_PER_SEASON, seasonOf as yearSeason } from '../sim/seasons';
import { CONTESTS, FESTIVALS, JUDGES, SEASON_DAYS, contestsOn, daysToFestival, festivalDay, festivalLine, festivalOf, festivalOn, judge, judgeScore, medalFor, seasonOf, signatureQuality, suits } from './festival';
import { FESTIVAL_DRAW, rollNight } from './moveIn';
import { FEST_SPOTS } from './routines';

const seq = (): (() => number) => {
  let i = 0;
  return () => ((i += 0.318) % 1);
};
const none = (): number => 0;

describe('seasons and the festival day', () => {
  it('turns a season every SEASON_DAYS and holds the festival on the last day', () => {
    expect(seasonOf(1)).toEqual({ season: 'spring', name: 'Spring', index: 0, dayIn: 1 });
    expect(seasonOf(SEASON_DAYS).dayIn).toBe(SEASON_DAYS);
    expect(seasonOf(SEASON_DAYS + 1).season).toBe('summer');
    expect(seasonOf(SEASON_DAYS * 4 + 1).season).toBe('spring');
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
    expect(r.toasts.join('|')).toMatch(/Sowing Fair begins/);
    r.state.tod = 0.05;
    r.state.day = SEASON_DAYS + 1;
    r.npcs.tick(0.1);
    expect(r.npcs.jukeboxOn).toBe(false);
    expect(r.npcs.festivalNow()).toBe(false);
  });

  it('does not touch a jukebox the player already switched on', () => {
    const r = fest();
    r.npcs.useFixture('jukebox');
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

describe('the four festivals', () => {
  it('follows the crop seasons: one festival per season, each with its own contest', () => {
    expect(SEASON_DAYS).toBe(DAYS_PER_SEASON);
    for (let k = 0; k < 4; k++) {
      const day = SEASON_DAYS * (k + 1);
      expect(festivalOf(day).season).toBe(yearSeason(day));
      expect(contestsOn(day)).toEqual(['dance', 'cook', 'brew', festivalOf(day).signature]);
    }
    expect(new Set(Object.values(FESTIVALS).map((f) => f.signature)).size).toBe(4);
    expect(festivalOf(SEASON_DAYS * 3).name).toBe('Harvest Fair');
    expect(festivalLine(1, true)).toMatch(/Sowing Fair, in 5 days/);
    expect(festivalLine(SEASON_DAYS, true)).toMatch(/^Tonight: the Sowing Fair/);
  });

  it('judges the festival show pieces by size, rarity and brightness', () => {
    expect(signatureQuality('crop', 'wheat', 64)).toBeGreaterThan(signatureQuality('crop', 'wheat', 4));
    expect(signatureQuality('crop', 'coal', 64)).toBe(0);
    expect(signatureQuality('fish', 'raw_glowfin', 1)).toBeGreaterThan(signatureQuality('fish', 'cooked_perch', 1));
    expect(signatureQuality('fish', 'raw_beef', 1)).toBe(0);
    expect(signatureQuality('lantern', 'kerosene_lamp', 1)).toBeGreaterThan(signatureQuality('lantern', 'torch', 1));
    expect(signatureQuality('sow', 'frost_lily', 1)).toBeGreaterThan(signatureQuality('sow', 'wheat_seeds', 3));
    expect(suits('fish', 'raw_trout')).toBe(true);
    expect(suits('lantern', 'hearth_stew')).toBe(false);
    const big = judge({ contest: 'crop', item: 'potato', count: 64, trust: () => 0, stage: false }, none).total;
    const small = judge({ contest: 'crop', item: 'potato', count: 2, trust: () => 0, stage: false }, none).total;
    expect(big).toBeGreaterThan(small);
  });

  const night = (day: number): ReturnType<typeof lifeRig> => {
    const r = lifeRig({ coins: 0, tod: 0.7 });
    r.state.day = day;
    r.npcs.tick(0.1);
    return r;
  };

  it("opens only that season's own contest, keeps the show piece, and pays town standing for a podium", () => {
    const r = night(SEASON_DAYS * 3); // the Harvest Fair
    const menu = r.npcs.serviceMenu();
    const port = r.npcs.servicePort('rosa');
    expect(menu.buy('fest:fish', port)).toBeNull(); // the Bonfire's catch, not tonight
    expect(menu.buy('fest:crop', port)).toMatch(/wheat, potatoes or carrots/);
    const rep0 = r.npcs.townPage().standing.value;
    r.state.held = { item: 'wheat', count: 64 };
    expect(menu.buy('fest:crop', port)).toBeTruthy();
    expect(r.state.held?.count).toBe(64);
    expect(r.toasts.join('|')).toMatch(/harvest basket: .* of 40/);
    const rec = r.npcs.festivalRecord();
    expect(rec.entries).toBe(1);
    if (rec.gold + rec.silver + rec.bronze > 0) expect(r.npcs.townPage().standing.value).toBeGreaterThan(rep0);
    expect(menu.buy('fest:crop', port)).toBeNull();
  });

  it('a full basket from a friend of the judges takes the crown, and the record survives a reload', () => {
    const r = night(SEASON_DAYS * 3);
    for (const j of ['rosa', 'bram', 'gruk', 'mara']) r.npcs.servicePort('rosa').addTrust(j, 90);
    r.state.held = { item: 'carrot', count: 64 };
    r.npcs.serviceMenu().buy('fest:crop', r.npcs.servicePort('rosa'));
    expect(r.npcs.festivalRecord().crowns).toBe(1);
    const snap = JSON.parse(JSON.stringify(r.npcs.toJSON()));
    const b = lifeRig({ tod: 0.7 });
    b.npcs.load(snap);
    expect(b.npcs.festivalRecord()).toMatchObject({ entries: 1, crowns: 1, gold: 1 });
    expect(snap.festival.entered.crop).toBe(SEASON_DAYS * 3);
  });

  it('the town page names the next festival, and Gruk comes in to watch on the night', () => {
    const r = night(SEASON_DAYS * 2);
    expect(r.npcs.townPage().festival).toMatchObject({ name: 'Midsummer Bonfire', tonight: true });
    for (let i = 0; i < 120; i++) r.npcs.tick(0.5);
    const g = r.npcs.views().find((v) => v.id === 'gruk')!;
    expect([g.x - 100 - 0.5, g.z - 100 - 0.5]).toEqual([FEST_SPOTS.gruk[0], FEST_SPOTS.gruk[2]]);
  });

  it('word of a festival you took part in draws newcomers the night after', () => {
    expect(rollNight({ arrived: [] }, [{ id: 'r', emptyNights: 1 }], [{ id: 'mara', eligible: true, triggerMet: true, reputationOk: true }], () => 0.1).arrival).toBeNull();
    expect(rollNight({ arrived: [] }, [{ id: 'r', emptyNights: 1 }], [{ id: 'mara', eligible: true, triggerMet: true, reputationOk: true }], () => 0.1, FESTIVAL_DRAW).arrival).not.toBeNull();
    expect(rollNight({ arrived: [] }, [{ id: 'r', emptyNights: 0 }], [{ id: 'mara', eligible: true, triggerMet: true, reputationOk: true }], () => 0, FESTIVAL_DRAW).arrival).toBeNull();
  });
});

describe('entering by talking to Rosa', () => {
  it("holding a show piece that suits the festival's own contest enters it, and it does not go onto the bar", () => {
    const r = lifeRig({ coins: 0, tod: 0.7 });
    r.state.day = SEASON_DAYS * 2; // the Midsummer Bonfire
    r.npcs.tick(0.1);
    const rosa = r.by('rosa');
    r.npcs.speak(rosa); // the welcome gift
    r.state.held = { item: 'cooked_salmon', count: 2 };
    r.npcs.speak(rosa);
    expect(r.state.held?.count).toBe(1);
    expect(r.toasts.join('|')).toMatch(/Bonfire catch: .* of 40/);
    expect(r.npcs.barStock()).toBe(0);
    // Entered once: the next fish goes on the bar as on any night.
    r.npcs.speak(rosa);
    expect(r.npcs.barStock()).toBe(1);
  });

  it('a pitched cooking contest takes the held dish to the judges instead of the bar', () => {
    const r = lifeRig({ coins: 0, tod: 0.7 });
    r.state.day = SEASON_DAYS;
    r.npcs.tick(0.1);
    const rosa = r.by('rosa');
    r.npcs.speak(rosa);
    r.npcs.serviceMenu().focus('fest:cook');
    r.npcs.speak(rosa); // talk, and the cooking contest is pitched
    expect(r.says.map((x) => x.text).join('|')).toMatch(/cooking contest is open/);
    r.state.held = { item: 'hearth_stew', count: 1 };
    r.npcs.speak(rosa);
    expect(r.toasts.join('|')).toMatch(/cooking contest: .* of 40/);
    expect(r.npcs.barStock()).toBe(0);
  });
});
