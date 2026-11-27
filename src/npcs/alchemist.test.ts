import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { alchemyAdvice, DISTILL_LADDER } from './alchemy';
import { NPCS } from './data';
import { TONICS } from './drinks';
import { LIKES, REWARDS } from './friendship';
import { lifeRig } from './life.rig';
import { ROUTINES } from './routines';
import { ALCHEMIST } from './scripts/alchemist';

describe('Veyra the alchemist', () => {
  it('is a person with a welcome gift of real items, a routine and a bank with the same pools as the others', () => {
    const v = NPCS.find((n) => n.id === 'veyra')!;
    expect([v.role, v.sprite, v.kind, v.scale]).toEqual(['alchemist', 'alchemist', 'person', 1]);
    for (const g of v.gift) expect(itemOrNull(g.item), g.item).toBeTruthy();
    expect(ROUTINES.veyra.night).toEqual([2, 1, 1]);
    expect(ALCHEMIST.greet.length).toBeGreaterThanOrEqual(8);
    expect(ALCHEMIST.idle.length).toBeGreaterThanOrEqual(50);
    expect(ALCHEMIST.idle.join(' ')).toMatch(/separatory funnel/);
  });

  it('likes only items that exist, and every reward and ladder rung is real', () => {
    for (const k of LIKES.veyra) expect(itemOrNull(k), k).toBeTruthy();
    for (const r of REWARDS.veyra) if (r) expect(itemOrNull(r.item), r.item).toBeTruthy();
    for (const r of DISTILL_LADDER) expect(itemOrNull(r.item), r.item).toBeTruthy();
  });

  it('points at the next rung of the distillery by what is in the pack', () => {
    expect(alchemyAdvice(() => false)).toMatch(/glass/);
    expect(alchemyAdvice((i) => i === 'glass_beaker')).toMatch(/pine sap/);
    expect(alchemyAdvice((i) => i === 'wash_beaker' || i === 'glass_beaker')).toMatch(/low wines/);
    expect(alchemyAdvice((i) => i === 'tincture_beaker' || i === 'glass_beaker')).toMatch(/charcoal/);
  });

  it('sells a tonic: pitch, then take, for coin', () => {
    const r = lifeRig({ coins: 30, tod: 0.4 });
    const { npcs, by, toasts } = r;
    const got: string[] = [];
    r.host.grantBuff = (b) => void got.push(b);
    npcs.speak(by('veyra')); // welcome gift
    npcs.speak(by('veyra')); // advice or chatter, then a pitch
    expect(toasts.some((t) => /coin for/.test(t))).toBe(true);
    npcs.speak(by('veyra'));
    expect(npcs.coins).toBeLessThan(30);
    expect(got.length).toBe(1);
    expect(TONICS.every((t) => t.cost > 0)).toBe(true);
  });
});
