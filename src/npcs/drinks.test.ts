import { describe, expect, it } from 'vitest';
import { DRINKS, drinkById } from './drinks';
import { lifeRig } from './life.rig';

/** Rosa pitches the offers in turn (room, ale, tea, brew); step to the one asked for and take it. */
function buy(r: ReturnType<typeof lifeRig>, id: string): void {
  r.npcs.serviceMenu().buy(`drink:${id}`, r.npcs.servicePort('rosa'));
}

describe('Rosa\'s drinks', () => {
  it('lists three drinks with sane prices and buffs', () => {
    expect(DRINKS.map((d) => d.id)).toEqual(['ale', 'tea', 'brew']);
    for (const d of DRINKS) {
      expect(d.cost).toBeGreaterThan(0);
      expect(d.buffs.length).toBeGreaterThan(0);
    }
    expect(drinkById('brew')!.cost).toBeGreaterThan(drinkById('ale')!.cost);
  });

  it('serves each drink for coin and grants its buffs through the host', () => {
    const r = lifeRig({ coins: 100, tod: 0.3 });
    const got: Array<[string, number]> = [];
    r.host.grantBuff = (b, s) => void got.push([b, s]);
    buy(r, 'ale');
    buy(r, 'tea');
    buy(r, 'brew');
    expect(got.map((g) => g[0])).toEqual(['well_warmed', 'mending', 'vigor', 'strength']);
    expect(r.npcs.coins).toBe(100 - 6 - 5 - 14);
  });

  it('refuses when poor and rations the strong brew to two a day', () => {
    const r = lifeRig({ coins: 100, tod: 0.3 });
    const got: string[] = [];
    r.host.grantBuff = (b) => void got.push(b);
    for (let i = 0; i < 4; i++) buy(r, 'brew');
    expect(got.filter((b) => b === 'vigor')).toHaveLength(2);
    expect(r.npcs.coins).toBe(100 - 28);
    r.state.day++;
    buy(r, 'brew');
    expect(got.filter((b) => b === 'vigor')).toHaveLength(3);
    const poor = lifeRig({ coins: 2, tod: 0.3 });
    poor.host.grantBuff = () => void got.push('x');
    buy(poor, 'ale');
    expect(poor.npcs.coins).toBe(2);
    expect(poor.toasts.join('|')).toContain('you carry 2');
  });

  it('is offered in the walk-up flow and the ration survives a save', () => {
    const r = lifeRig({ coins: 100, tod: 0.3 });
    const got: string[] = [];
    r.host.grantBuff = (b) => void got.push(b);
    const rosa = r.by('rosa');
    r.npcs.speak(rosa);
    r.npcs.speak(rosa); // pitch: ale (rooms are shut by day)
    r.npcs.speak(rosa); // accept
    expect(got).toEqual(['well_warmed']);
    buy(r, 'brew');
    buy(r, 'brew');
    const snap = JSON.parse(JSON.stringify(r.npcs.toJSON()));
    const again = lifeRig({ coins: 100, tod: 0.3 });
    again.host.grantBuff = (b) => void got.push(b);
    again.npcs.load(snap);
    again.npcs.coins = 100;
    got.length = 0;
    buy(again, 'brew');
    expect(got).toEqual([]);
  });
});
