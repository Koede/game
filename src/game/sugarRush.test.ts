import { describe, expect, it } from 'vitest';
import { SUGAR_SPEED_MULT, SUGAR_WELL_FED_BURN_MULT, WELL_FED_DURATION_S } from '../core/constants';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { ITEMS, RECIPES, item } from '../core/registry';
import { Buffs } from './buffs';
import { eat } from './hunger';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.food = 5;
  const buffs: Array<GameEvents['buff:gained']> = [];
  bus.on('buff:gained', (e) => buffs.push(e));
  return { player, buffs };
}

describe('Sugar Rush', () => {
  it('sugar and sweet bakes carry the buff', () => {
    for (const key of ['sugar', 'sugar_cookie', 'sweet_bun', 'sugar_cake']) {
      expect(item(key).food?.buff, key).toBe('sugar_rush');
      expect(item(key).food?.buffS, key).toBeGreaterThan(0);
    }
  });

  it('eating a cookie starts Sugar Rush, speeds the player up and reports the buff', () => {
    const { player, buffs } = rig();
    player.give('sugar_cookie', 2);
    const r = eat(player, 0);
    expect(r.ok && r.buff).toBe('sugar_rush');
    expect(player.buffs.sugarS).toBe(item('sugar_cookie').food?.buffS);
    expect(player.buffs.speedMult).toBeCloseTo(SUGAR_SPEED_MULT);
    expect(buffs).toEqual([{ buff: 'sugar_rush', durationS: item('sugar_cookie').food?.buffS }]);
    expect(player.buffs.active().map((b) => b.buff)).toContain('sugar_rush');
  });

  it('a longer Sugar Rush is never shortened by a shorter one', () => {
    const { player } = rig();
    player.give('sugar_cake', 1);
    player.give('sugar', 1);
    eat(player, 0);
    const long = player.buffs.sugarS;
    player.food = 5;
    player.eatCooldownS = 0;
    eat(player, 1);
    expect(player.buffs.sugarS).toBe(long);
  });

  it('burns the Well-Fed timer faster while it runs, and only then', () => {
    const b = new Buffs();
    b.wellFedS = WELL_FED_DURATION_S;
    b.tick(10);
    expect(b.wellFedS).toBeCloseTo(WELL_FED_DURATION_S - 10);
    b.sugarS = 100;
    b.tick(10);
    expect(b.wellFedS).toBeCloseTo(WELL_FED_DURATION_S - 10 - 10 * SUGAR_WELL_FED_BURN_MULT);
    expect(b.sugarS).toBeCloseTo(90);
  });

  it('leaves hunger drain alone', () => {
    const b = new Buffs();
    b.sugarS = 60;
    expect(b.foodDrainMult).toBe(1);
  });

  it('stacks with Swift, ends, clears on respawn and survives a save', () => {
    const b = new Buffs();
    b.grant('swift', 100);
    b.sugarS = 5;
    expect(b.speedMult).toBeGreaterThan(SUGAR_SPEED_MULT);
    const c = new Buffs();
    c.load(JSON.parse(JSON.stringify(b.toJSON())));
    expect(c.sugarS).toBe(5);
    b.tick(6);
    expect(b.sugarS).toBe(0);
    expect(b.active().map((x) => x.buff)).not.toContain('sugar_rush');
    c.clear();
    expect(c.sugarS).toBe(0);
  });

  it('an old save without Sugar Rush loads with none', () => {
    const c = new Buffs();
    c.load({ wellWarmedS: 3 });
    expect(c.sugarS).toBe(0);
  });
});

describe('the resin to sugar chain is closed', () => {
  const make = (out: string) => RECIPES.filter((r) => r.output.item === out);
  it('every step has a recipe and every input is obtainable', () => {
    expect(make('glass_beaker')).toHaveLength(1);
    expect(make('pine_resin')[0].inputs.map((i) => i.item)).toEqual(['pine_sap']);
    expect(make('sugar')[0].inputs.map((i) => i.item).sort()).toEqual(['glass_beaker', 'pine_resin', 'water_pail']);
    for (const out of ['sugar_cookie', 'sweet_bun', 'sugar_cake']) expect(make(out).filter((r) => !r.id.endsWith('_milk') && !r.id.endsWith('_egg')), out).toHaveLength(1); // goat milk and eggs make other routes
    expect(ITEMS.some((i) => i.key === 'pine_sap')).toBe(true);
  });

  it('the beaker and the bucket come back from boiling and distilling', () => {
    expect(make('pine_resin')[0].byproducts?.map((b) => b.item)).toEqual(['glass_beaker']);
    expect(make('sugar')[0].byproducts?.map((b) => b.item).sort()).toEqual(['glass_beaker', 'pail']);
  });
});
