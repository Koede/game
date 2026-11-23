import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { lifeRig } from './life.rig';
import { LOOT, SPAR_COST, SPAR_FRIEND_COST, SPAR_LEVELS, SPAR_PER_DAY, fight, sparCost, sparLevel, warmUpS, winChance } from './sparring';

describe('sparring maths', () => {
  it('levels from bouts, gets easier with skill and pays real items', () => {
    expect(sparLevel(0)).toBe(0);
    expect(sparLevel(SPAR_LEVELS[0])).toBe(1);
    expect(sparLevel(999)).toBe(SPAR_LEVELS.length);
    expect(winChance(5)).toBeGreaterThan(winChance(0));
    expect(winChance(5)).toBeLessThanOrEqual(0.9);
    expect(warmUpS(3)).toBeGreaterThan(warmUpS(0));
    expect(sparCost(0)).toBe(SPAR_COST);
    expect(sparCost(30)).toBe(SPAR_FRIEND_COST);
    for (const l of LOOT) for (const x of l) expect(itemOrNull(x.item), x.item).toBeTruthy();
    expect(LOOT.length).toBe(SPAR_LEVELS.length + 1);
  });

  it('draws a win with loot or a loss with none, by the rng', () => {
    expect(fight(0, () => 0.0).loot).not.toBeNull();
    expect(fight(0, () => 0.99)).toEqual({ won: false, loot: null });
  });
});

describe('Gruk sparring', () => {
  function ready(coins: number) {
    const r = lifeRig({ coins, tod: 0.3 });
    r.npcs.speak(r.by('gruk')); // welcome gift
    const buffs: Array<[string, number]> = [];
    r.host.grantBuff = (b, s) => void buffs.push([b, s]);
    return { ...r, buffs };
  }
  const spar = (r: ReturnType<typeof ready>): void => void r.npcs.serviceMenu('gruk').buy('spar', r.npcs.servicePort('gruk'));

  it('takes coin, trains the skill, warms you up and reports the bout', () => {
    const r = ready(100);
    for (let i = 0; i < SPAR_PER_DAY; i++) spar(r);
    expect(r.npcs.coins).toBe(100 - SPAR_PER_DAY * SPAR_COST);
    expect(r.npcs.sparSkill()).toBe(1);
    expect(r.buffs).toHaveLength(SPAR_PER_DAY);
    expect(r.buffs.every((b) => b[0] === 'strength')).toBe(true);
    expect(r.toasts.join('|')).toMatch(/won the bout|lost the bout/);
  });

  it('stops at three bouts a day, resumes the next, and refuses when poor', () => {
    const r = ready(500);
    for (let i = 0; i < SPAR_PER_DAY + 2; i++) spar(r);
    expect(r.buffs).toHaveLength(SPAR_PER_DAY);
    r.state.day++;
    spar(r);
    expect(r.buffs).toHaveLength(SPAR_PER_DAY + 1);
    const poor = ready(3);
    spar(poor);
    expect(poor.buffs).toHaveLength(0);
    expect(poor.npcs.coins).toBe(3);
  });

  it('levels up over many days and saves its skill', () => {
    const r = ready(5000);
    for (let d = 0; d < 6; d++) {
      for (let i = 0; i < SPAR_PER_DAY; i++) spar(r);
      r.state.day++;
    }
    expect(r.npcs.sparSkill()).toBeGreaterThanOrEqual(2);
    const snap = JSON.parse(JSON.stringify(r.npcs.toJSON()));
    const b = lifeRig();
    b.npcs.load(snap);
    expect(b.npcs.sparSkill()).toBe(r.npcs.sparSkill());
  });

  it('is pitched on a later visit and taken on the next Use', () => {
    const r = ready(100);
    r.npcs.speak(r.by('gruk')); // talk + hire offer (visit 1)
    r.npcs.tick(11);
    r.npcs.speak(r.by('gruk')); // talk + spar pitch (visit 2)
    expect(r.toasts.join('|')).toContain('put up your fists');
    r.npcs.speak(r.by('gruk')); // accept
    expect(r.buffs).toHaveLength(1);
  });
});
