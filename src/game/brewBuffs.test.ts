import { describe, expect, it } from 'vitest';
import { DRINK_BUFFS, DRINK_BUFF_KEYS } from '../core/brewing';
import {
  BOILING_KEEPS_S,
  DRINK_BUFF_S,
  DRINK_COOLDOWN_S,
  DT,
  FLAG_SIX_CUPS,
  FOOD_DRAIN_PER_S,
  HEARTHKEPT_DRAIN_MULT,
  LASTING_DRAIN_MULT,
  MAX_FOOD,
  MAX_HEALTH,
  MAX_WARMTH,
  MENDING_REGEN_MULT,
  VIGOR_MINING_MULT,
  WARMTH_DRAIN_WATER,
} from '../core/constants';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { block, DRINKS, item } from '../core/registry';
import { GameClock } from './clock';
import { Buffs } from './buffs';
import { coolCarried, coolStack, drink } from './drink';
import { FakeWorld } from './fakeWorld';
import { foodDrainPerS } from './hunger';
import { makeStack } from './inventory';
import { miningTime } from './mining';
import { PlayerState, type PlayerSnapshot } from './playerState';
import { REGEN_INTERVAL_S, Survival } from './survival';

function rig() {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
  const seen = {
    drank: [] as Array<GameEvents['player:drank']>,
    flags: [] as string[],
    sfx: [] as string[],
    toasts: [] as string[],
    buffs: [] as Array<GameEvents['buff:gained']>,
  };
  bus.on('player:drank', (e) => seen.drank.push(e));
  bus.on('flag', (e) => seen.flags.push(e.flag));
  bus.on('sfx', (e) => seen.sfx.push(e.name));
  bus.on('toast', (e) => seen.toasts.push(e.text));
  bus.on('buff:gained', (e) => seen.buffs.push(e));
  const run = (seconds: number): void => {
    for (let i = Math.round(seconds / DT); i > 0; i--) survival.tick(DT);
  };
  const hold = (key: string, slot = player.selectedSlot): void => player.inventory.set(slot, makeStack(key, 1));
  return { bus, world, player, survival, seen, run, hold };
}

const DRINK_FOR: Record<string, string> = {};
for (const d of DRINKS) DRINK_FOR[d.drink!.buff] = d.key;

describe('Buffs', () => {
  it('has six drinks, one item each, in two families of three', () => {
    expect(DRINKS.length).toBe(6);
    expect(DRINK_BUFF_KEYS.map((b) => DRINK_FOR[b]).every(Boolean)).toBe(true);
    expect(DRINK_BUFF_KEYS.filter((b) => DRINK_BUFFS[b].family === 'tea')).toHaveLength(3);
  });

  it('grants, refreshes without shortening, expires', () => {
    const b = new Buffs();
    expect(b.grant('spring', 100)).toEqual({ replaced: null, refreshed: false });
    b.tick(30);
    expect(b.timeLeftS('spring')).toBe(70);
    expect(b.grant('spring', 50).refreshed).toBe(true);
    expect(b.timeLeftS('spring')).toBe(70);
    b.grant('spring', 180);
    expect(b.timeLeftS('spring')).toBe(180);
    b.tick(180);
    expect(b.has('spring')).toBe(false);
    expect(b.active()).toEqual([]);
  });

  it('a drink replaces the other of its family but not the other family', () => {
    const b = new Buffs();
    b.grant('spring', 100);
    b.grant('swift', 100);
    expect(b.grant('mending', 60)).toEqual({ replaced: 'spring', refreshed: false });
    expect(b.has('spring')).toBe(false);
    expect(b.has('mending') && b.has('swift')).toBe(true);
    expect(b.grant('vigor', 60).replaced).toBe('swift');
    expect(b.active().map((a) => a.buff).sort()).toEqual(['mending', 'vigor']);
  });

  it('keeps Well-Warmed and Well-Fed alongside the drinks', () => {
    const b = new Buffs();
    b.wellFedS = 5;
    b.wellWarmedS = 7;
    b.grant('lasting', 9);
    expect(b.active().map((a) => a.buff)).toEqual(['well_warmed', 'well_fed', 'lasting']);
    b.tick(6); // Hunger ticks Well-Fed and the drinks; Survival ticks Well-Warmed
    expect(b.wellFedS).toBe(0);
    expect(b.wellWarmedS).toBe(7);
  });

  it('round-trips through JSON and loads an old save with no drinks', () => {
    const b = new Buffs();
    b.wellFedS = 12;
    b.grant('hearthkept', 44);
    b.grant('vigor', 21);
    const copy = new Buffs();
    copy.grant('spring', 5);
    copy.load(JSON.parse(JSON.stringify(b.toJSON())));
    expect(copy.toJSON()).toEqual(b.toJSON());
    expect(copy.has('spring')).toBe(false);
    copy.load({ wellWarmedS: 3 });
    expect(copy.toJSON()).toEqual({ wellWarmedS: 3, wellFedS: 0, drinks: {} });
  });

  it('ignores nonsense in a save', () => {
    const b = new Buffs();
    b.load({ wellWarmedS: NaN, wellFedS: -4, drinks: { spring: -3, swift: NaN, vigor: 10 } });
    expect(b.toJSON()).toEqual({ wellWarmedS: 0, wellFedS: 0, drinks: { vigor: 10 } });
  });
});

describe('drink()', () => {
  it('drinks: buff, cup back in the same slot, event, sip and toast', () => {
    const r = rig();
    r.hold(DRINK_FOR.spring, 3);
    r.player.selectedSlot = 3;
    const res = drink(r.player);
    expect(res).toEqual({ ok: true, item: DRINK_FOR.spring, buff: 'spring', replaced: null });
    expect(r.player.inventory.get(3)).toEqual(makeStack('clay_cup', 1));
    expect(r.player.buffs.timeLeftS('spring')).toBe(DRINK_BUFF_S);
    expect(r.seen.drank).toEqual([{ item: DRINK_FOR.spring }]);
    expect(r.seen.sfx).toContain('sip');
    expect(r.seen.buffs).toEqual([{ buff: 'spring', durationS: DRINK_BUFF_S }]);
    expect(r.seen.toasts.some((t) => t.startsWith('Spring'))).toBe(true);
  });

  it('refuses a non-drink, the dead, and a second sip inside the cooldown, changing nothing', () => {
    const r = rig();
    r.hold('bread');
    expect(drink(r.player)).toMatchObject({ ok: false, reason: 'not_drink' });
    r.hold(DRINK_FOR.swift);
    r.player.dead = true;
    expect(drink(r.player)).toMatchObject({ ok: false, reason: 'dead' });
    r.player.dead = false;
    expect(drink(r.player).ok).toBe(true);
    r.hold(DRINK_FOR.vigor);
    expect(drink(r.player)).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(r.player.inventory.get(r.player.selectedSlot)!.item).toBe(DRINK_FOR.vigor);
    r.run(DRINK_COOLDOWN_S + 0.1);
    expect(drink(r.player).ok).toBe(true);
  });

  it('family replacement toasts "X replaces Y" and keeps the other family', () => {
    const r = rig();
    r.hold(DRINK_FOR.spring);
    drink(r.player);
    r.run(DRINK_COOLDOWN_S + 0.1);
    r.hold(DRINK_FOR.swift);
    drink(r.player);
    r.run(DRINK_COOLDOWN_S + 0.1);
    r.hold(DRINK_FOR.mending);
    const res = drink(r.player);
    expect(res).toMatchObject({ ok: true, replaced: 'spring' });
    expect(r.seen.toasts).toContain('Mending replaces Spring');
    expect(r.player.buffs.has('spring')).toBe(false);
    expect(r.player.buffs.has('swift')).toBe(true);
  });

  it('Hearthkept adds its warmth on drinking, capped at the maximum', () => {
    const r = rig();
    r.player.warmth = 40;
    r.hold(DRINK_FOR.hearthkept);
    drink(r.player);
    expect(r.player.warmth).toBe(50);
    r.run(2);
    r.player.warmth = MAX_WARMTH - 3;
    r.hold(DRINK_FOR.hearthkept);
    drink(r.player);
    expect(r.player.warmth).toBe(MAX_WARMTH);
  });

  it('emits six_cups once, when the sixth distinct drink is drunk', () => {
    const r = rig();
    for (const d of DRINKS) {
      r.hold(d.key);
      expect(drink(r.player).ok).toBe(true);
      r.run(DRINK_COOLDOWN_S + 0.1);
    }
    expect(r.seen.flags.filter((f) => f === FLAG_SIX_CUPS)).toHaveLength(1);
    r.hold(DRINKS[0].key);
    drink(r.player);
    expect(r.seen.flags.filter((f) => f === FLAG_SIX_CUPS)).toHaveLength(1);
    expect(Object.keys(r.player.stats.drunk ?? {})).toHaveLength(6);
  });

  it('expires after DRINK_BUFF_S of survival ticks', () => {
    const r = rig();
    r.hold(DRINK_FOR.lasting);
    drink(r.player);
    r.run(DRINK_BUFF_S - 1);
    expect(r.player.buffs.has('lasting')).toBe(true);
    r.run(2);
    expect(r.player.buffs.has('lasting')).toBe(false);
  });
});

describe('each buff at its hook', () => {
  it('Lasting halves the food drain and multiplies with Well-Fed', () => {
    const r = rig();
    expect(foodDrainPerS(r.player)).toBeCloseTo(FOOD_DRAIN_PER_S);
    r.player.buffs.grant('lasting', 100);
    expect(foodDrainPerS(r.player)).toBeCloseTo(FOOD_DRAIN_PER_S * LASTING_DRAIN_MULT);
    r.player.buffs.wellFedS = 100;
    expect(foodDrainPerS(r.player)).toBeCloseTo(FOOD_DRAIN_PER_S * LASTING_DRAIN_MULT * 0.5);
    r.run(60);
    expect(MAX_FOOD - r.player.food).toBeCloseTo(60 * FOOD_DRAIN_PER_S * LASTING_DRAIN_MULT * 0.5, 3);
  });

  it('Vigor speeds mining by its multiplier and stacks with Well-Warmed', () => {
    const stone = block('stone');
    const pick = makeStack('flint_pickaxe', 1, 10);
    const base = miningTime(stone, pick, false);
    expect(miningTime(stone, pick, false, VIGOR_MINING_MULT)).toBeCloseTo(base / VIGOR_MINING_MULT);
    const warm = miningTime(stone, pick, true);
    expect(miningTime(stone, pick, true, VIGOR_MINING_MULT)).toBeCloseTo(warm / VIGOR_MINING_MULT);
    const b = new Buffs();
    expect(b.miningMult).toBe(1);
    b.grant('vigor', 5);
    expect(b.miningMult).toBe(VIGOR_MINING_MULT);
  });

  it('Hearthkept slows the cold drain', () => {
    const cold = (withBuff: boolean): number => {
      const r = rig();
      r.player.inWater = true;
      if (withBuff) r.player.buffs.grant('hearthkept', 1000);
      r.run(10);
      return MAX_WARMTH - r.player.warmth;
    };
    expect(cold(false)).toBeGreaterThan(0);
    expect(cold(false)).toBeCloseTo(10 * WARMTH_DRAIN_WATER, 1);
    expect(cold(true)).toBeCloseTo(cold(false) * HEARTHKEPT_DRAIN_MULT, 1);
  });

  it('Mending heals twice as fast', () => {
    const secondsToHeal = (withBuff: boolean): number => {
      const r = rig();
      r.player.health = MAX_HEALTH - 5;
      r.player.sinceDamageS = 1000;
      if (withBuff) r.player.buffs.grant('mending', 1000);
      let t = 0;
      while (r.player.health < MAX_HEALTH - 5 + 1 && t < 60) {
        r.survival.tick(DT);
        t += DT;
      }
      return t;
    };
    expect(secondsToHeal(false)).toBeCloseTo(REGEN_INTERVAL_S, 1);
    expect(secondsToHeal(true)).toBeCloseTo(REGEN_INTERVAL_S / MENDING_REGEN_MULT, 1);
  });

  it('Spring and Swift are read by physics (multipliers)', () => {
    const b = new Buffs();
    expect([b.jumpMult, b.speedMult]).toEqual([1, 1]);
    b.grant('spring', 5);
    b.grant('swift', 5);
    expect(b.jumpMult).toBeCloseTo(1.35);
    expect(b.speedMult).toBeCloseTo(1.2);
  });
});

describe('saves', () => {
  it('a drink buff survives a save and load; an old save has none', () => {
    const r = rig();
    r.hold(DRINK_FOR.vigor);
    drink(r.player);
    r.run(10);
    const snap = JSON.parse(JSON.stringify(r.player)) as PlayerSnapshot;
    const copy = new PlayerState(createBus());
    copy.load(snap);
    expect(copy.buffs.timeLeftS('vigor')).toBeCloseTo(DRINK_BUFF_S - 10, 1);
    expect(copy.toJSON()).toEqual(r.player.toJSON());
    delete snap.buffs.drinks;
    delete snap.stats.drunk;
    const old = new PlayerState(createBus());
    old.buffs.grant('swift', 50);
    old.load(snap);
    expect(old.buffs.has('swift') || old.buffs.has('vigor')).toBe(false);
    expect(old.stats.drunk).toEqual({});
  });

  it('respawn clears the drink buffs', () => {
    const r = rig();
    r.player.buffs.grant('spring', 100);
    r.player.respawn(true);
    expect(r.player.buffs.has('spring')).toBe(false);
  });
});

describe('the carried boiling pail', () => {
  const boiling = 'boiling_pail';
  it('counts its durability down and turns back into a water bucket', () => {
    expect(item(boiling).cools).toEqual({ to: 'water_pail', afterS: BOILING_KEEPS_S });
    const stack = makeStack(boiling, 1, BOILING_KEEPS_S);
    expect(coolStack(stack, 30)).toBe(stack);
    expect(stack.durability).toBe(BOILING_KEEPS_S - 30);
    const cooled = coolStack(stack, BOILING_KEEPS_S);
    expect(cooled).toMatchObject({ item: 'water_pail', count: 1 });
    expect(cooled!.durability).toBeUndefined();
  });

  it('is null for things that do not cool, and a missing durability counts as fresh', () => {
    expect(coolStack(makeStack('water_pail', 1), 5)).toBeNull();
    const stack = makeStack(boiling, 1);
    coolStack(stack, 10);
    expect(stack.durability).toBe(BOILING_KEEPS_S - 10);
  });

  it('cools in the pack through Survival ticks, in its own slot, with a toast', () => {
    const r = rig();
    r.player.inventory.set(7, makeStack(boiling, 1, BOILING_KEEPS_S));
    r.run(BOILING_KEEPS_S - 2);
    expect(r.player.inventory.get(7)!.item).toBe(boiling);
    expect(r.player.inventory.get(7)!.durability).toBeCloseTo(2, 1);
    r.run(3);
    expect(r.player.inventory.get(7)).toMatchObject({ item: 'water_pail', count: 1 });
    expect(r.seen.toasts.some((t) => t.includes('cooled'))).toBe(true);
  });

  it('only notifies the inventory about once a second', () => {
    const r = rig();
    r.player.inventory.set(0, makeStack(boiling, 1, BOILING_KEEPS_S));
    let changes = 0;
    r.player.inventory.onChange(() => changes++);
    for (let i = Math.round(5 / DT); i > 0; i--) coolCarried(r.player, DT);
    expect(changes).toBeGreaterThanOrEqual(4);
    expect(changes).toBeLessThanOrEqual(7);
  });

  it('does not cool while the player is dead', () => {
    const r = rig();
    r.player.inventory.set(0, makeStack(boiling, 1, 5));
    r.player.dead = true;
    r.run(10);
    expect(r.player.inventory.get(0)!.item).toBe(boiling);
  });
});
