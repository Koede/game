import { describe, expect, it } from 'vitest';
import {
  DT,
  EAT_COOLDOWN_S,
  FOOD_COST_PER_BLOCK_MINED,
  FOOD_COST_PER_JUMP,
  FOOD_DRAIN_PER_S,
  HUNGRY_AT,
  MAX_FOOD,
  MAX_HEALTH,
  REGEN_FOOD_COST,
  STARVE_INTERVAL_S,
  WELL_FED_DURATION_S,
} from '../core/constants';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { item } from '../core/registry';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { eat, eatRefusal, exertJump, exertMining, foodDrainPerS, isFull } from './hunger';
import { PlayerState, RESPAWN_MIN_FOOD, type PlayerSnapshot } from './playerState';
import { Survival } from './survival';

function rig() {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
  const seen = {
    damage: [] as Array<GameEvents['player:damage']>,
    ate: [] as Array<GameEvents['player:ate']>,
    flags: [] as string[],
    sfx: [] as string[],
    toasts: [] as Array<GameEvents['toast']>,
    buffs: [] as Array<GameEvents['buff:gained']>,
  };
  bus.on('player:damage', (e) => seen.damage.push(e));
  bus.on('player:ate', (e) => seen.ate.push(e));
  bus.on('flag', (e) => seen.flags.push(e.flag));
  bus.on('sfx', (e) => seen.sfx.push(e.name));
  bus.on('toast', (e) => seen.toasts.push(e));
  bus.on('buff:gained', (e) => seen.buffs.push(e));
  const run = (seconds: number): void => {
    for (let i = Math.round(seconds / DT); i > 0; i--) survival.tick(DT);
  };
  const hold = (key: string, count = 1): void => player.inventory.set(player.selectedSlot, { item: key, count });
  return { bus, world, player, survival, hunger: survival.hunger, seen, run, hold };
}

describe('Hunger: drain', () => {
  it('starts full and drains 1 point a minute at rest', () => {
    const r = rig();
    expect(r.player.food).toBe(MAX_FOOD);
    r.run(60);
    expect(r.player.food).toBeCloseTo(MAX_FOOD - 1, 5);
    expect(r.hunger.foodRate).toBeCloseTo(-FOOD_DRAIN_PER_S, 9);
  });

  it('drains 2.5x while sprinting and half as fast while Well-Fed', () => {
    const sprint = rig();
    sprint.player.sprinting = true;
    sprint.run(60);
    expect(sprint.player.food).toBeCloseTo(MAX_FOOD - 2.5, 5);

    const fed = rig();
    fed.player.buffs.wellFedS = 1000;
    fed.player.sprinting = true;
    fed.run(60);
    expect(fed.player.food).toBeCloseTo(MAX_FOOD - 1.25, 5);
    expect(foodDrainPerS(fed.player)).toBeCloseTo((FOOD_DRAIN_PER_S * 2.5) / 2, 9);
  });

  it('jumps and mined blocks cost food, halved while Well-Fed', () => {
    const r = rig();
    exertJump(r.player);
    exertMining(r.player);
    expect(r.player.food).toBeCloseTo(MAX_FOOD - FOOD_COST_PER_JUMP - FOOD_COST_PER_BLOCK_MINED, 9);
    r.player.buffs.wellFedS = 10;
    exertJump(r.player);
    expect(r.player.food).toBeCloseTo(MAX_FOOD - 1.5 * FOOD_COST_PER_JUMP - FOOD_COST_PER_BLOCK_MINED, 9);
  });

  it('the Well-Fed timer runs out', () => {
    const r = rig();
    r.player.buffs.wellFedS = 2;
    r.run(1);
    expect(r.hunger.wellFedTimeLeftS).toBeCloseTo(1, 5);
    r.run(1.5);
    expect(r.player.wellFed).toBe(false);
  });

  it('warns once when crossing into Hungry, again only after recovering', () => {
    const r = rig();
    r.player.food = HUNGRY_AT + 0.05;
    expect(r.player.hungry).toBe(false);
    r.run(6);
    expect(r.player.hungry).toBe(true);
    r.run(30);
    const warnings = () => r.seen.toasts.filter((t) => /hungry/i.test(t.text));
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0].kind).toBe('warn');
    r.player.feed(3);
    r.run(1);
    r.player.food = HUNGRY_AT + 0.01;
    r.run(1);
    expect(warnings()).toHaveLength(2);
  });

  it('never drains below zero and does nothing while dead', () => {
    const r = rig();
    r.player.food = 0.01;
    r.run(5);
    expect(r.player.food).toBe(0);
    r.player.food = 10;
    r.player.dead = true;
    r.run(60);
    expect(r.player.food).toBe(10);
  });
});

describe('Hunger: starvation and regeneration', () => {
  it('an empty bar hurts every 6 s but never takes the last health point', () => {
    const r = rig();
    r.player.food = 0;
    r.player.health = 3;
    r.run(STARVE_INTERVAL_S - 0.1);
    expect(r.seen.damage).toHaveLength(0);
    r.run(0.2);
    expect(r.seen.damage).toEqual([{ amount: 1, cause: 'hunger', health: 2 }]);
    r.run(STARVE_INTERVAL_S * 5);
    expect(r.player.health).toBe(1);
    expect(r.player.dead).toBe(false);
    expect(r.seen.damage).toHaveLength(2);
    expect(r.hunger.starving).toBe(true);
  });

  it('health regenerates only with food >= 12, each point costing 0.25 food', () => {
    const low = rig();
    low.player.health = 10;
    low.player.food = 11.9;
    low.run(20);
    expect(low.player.health).toBe(10);

    const fed = rig();
    fed.player.health = 10;
    fed.player.food = 16;
    fed.run(8.2);
    expect(fed.player.health).toBe(12);
    // Two points healed (4 s each): 0.5 food for them, plus 8.2 s of the ordinary drain.
    expect(fed.player.food).toBeCloseTo(16 - 2 * REGEN_FOOD_COST - 8.2 * FOOD_DRAIN_PER_S, 6);
  });

  it('Well-Fed heals twice as fast', () => {
    const r = rig();
    r.player.health = 10;
    r.player.buffs.wellFedS = 100;
    r.run(8.2);
    expect(r.player.health).toBe(14);
  });

  it('respawning tops the bar up to half and ends Well-Fed', () => {
    const r = rig();
    r.player.food = 0;
    r.player.buffs.wellFedS = 50;
    r.player.damage(MAX_HEALTH, 'fall');
    r.survival.respawn();
    expect(r.player.food).toBe(RESPAWN_MIN_FOOD);
    expect(r.player.wellFed).toBe(false);
    r.player.food = 17;
    r.player.damage(MAX_HEALTH, 'fall');
    r.survival.respawn();
    expect(r.player.food).toBe(17);
  });

  it('the starvation timer is saved with survival; old saves without it load', () => {
    const r = rig();
    r.player.food = 0;
    r.run(4);
    const snap = r.survival.toJSON();
    expect(snap.starveS).toBeCloseTo(4, 5);
    const copy = rig();
    copy.player.food = 0;
    copy.player.health = 5;
    copy.survival.load(snap);
    copy.run(2.05);
    expect(copy.seen.damage).toHaveLength(1);
    const { starveS: _unused, ...old } = snap;
    expect(() => copy.survival.load(old)).not.toThrow();
  });
});

describe('eat()', () => {
  it('eats one of the held food: food, events, flag and sound', () => {
    const r = rig();
    r.player.food = 5;
    r.hold('cooked_chop', 3);
    expect(eat(r.player)).toEqual({ ok: true, item: 'cooked_chop', hunger: 8, buff: null });
    expect(r.player.food).toBe(13);
    expect(r.player.heldStack()).toEqual({ item: 'cooked_chop', count: 2 });
    expect(r.seen.ate).toEqual([{ item: 'cooked_chop', hunger: 8 }]);
    expect(r.seen.flags).toEqual(['ate']);
    expect(r.seen.sfx).toEqual(['eat']);
  });

  it('caps at the full bar and refuses plain food when full, quietly between bites', () => {
    const r = rig();
    r.player.food = 18;
    r.hold('bread', 5);
    expect(eat(r.player).ok).toBe(true);
    expect(r.player.food).toBe(MAX_FOOD);
    expect(isFull(r.player)).toBe(true);
    // Straight away: the cooldown answers first, without a message.
    expect(eat(r.player)).toEqual({ ok: false, reason: 'cooldown', message: null });
    r.run(EAT_COOLDOWN_S + DT);
    expect(eat(r.player)).toEqual({ ok: false, reason: 'full', message: 'You are full' });
    expect(r.player.heldStack()!.count).toBe(4);
    expect(r.seen.ate).toHaveLength(1);
  });

  it('waits 0.6 s between bites', () => {
    const r = rig();
    r.player.food = 2;
    r.hold('carrot', 5);
    expect(eat(r.player).ok).toBe(true);
    r.run(EAT_COOLDOWN_S - 0.1);
    expect(eatRefusal(r.player, 'carrot')).toBe('cooldown');
    r.run(0.15);
    expect(eat(r.player).ok).toBe(true);
    expect(r.player.food).toBeCloseTo(8, 1);
  });

  it('a stew is eaten even on a full stomach and makes the player Well-Fed', () => {
    const r = rig();
    r.hold('hearth_stew');
    const result = eat(r.player);
    expect(result).toEqual({ ok: true, item: 'hearth_stew', hunger: 12, buff: 'well_fed' });
    expect(r.player.food).toBe(MAX_FOOD);
    expect(r.player.buffs.wellFedS).toBe(WELL_FED_DURATION_S);
    expect(r.seen.buffs).toEqual([{ buff: 'well_fed', durationS: WELL_FED_DURATION_S }]);
    expect(r.seen.toasts.some((t) => t.kind === 'good' && /Well-Fed/.test(t.text))).toBe(true);
    expect(r.player.heldStack()).toBeNull();
  });

  it('refuses what is not food, an empty hand, and the dead', () => {
    const r = rig();
    r.player.food = 5;
    r.hold('wheat');
    expect(eat(r.player)).toEqual({ ok: false, reason: 'not_food', message: null });
    r.player.inventory.set(r.player.selectedSlot, null);
    expect(eat(r.player)).toMatchObject({ ok: false, reason: 'not_food' });
    r.hold('potato');
    r.player.dead = true;
    expect(eat(r.player)).toMatchObject({ ok: false, reason: 'dead' });
    expect(r.player.food).toBe(5);
    expect(r.seen.ate).toHaveLength(0);
  });

  it('eats from any slot when asked', () => {
    const r = rig();
    r.player.food = 1;
    r.player.inventory.set(20, { item: 'raw_fowl', count: 2 });
    expect(eat(r.player, 20).ok).toBe(true);
    expect(r.player.inventory.get(20)!.count).toBe(1);
    expect(r.player.food).toBe(1 + item('raw_fowl').food!.hunger);
  });
});

describe('PlayerState: food in saves', () => {
  it('round-trips food and Well-Fed', () => {
    const r = rig();
    r.player.food = 7.25;
    r.player.buffs.wellFedS = 42;
    const snap = JSON.parse(JSON.stringify(r.player)) as PlayerSnapshot;
    expect(snap.food).toBe(7.25);
    const copy = new PlayerState(createBus());
    copy.load(snap);
    expect(copy.food).toBe(7.25);
    expect(copy.buffs.wellFedS).toBe(42);
    expect(copy.toJSON()).toEqual(r.player.toJSON());
  });

  it('a save from before hunger loads with a full bar and no Well-Fed', () => {
    const r = rig();
    const snap = r.player.toJSON();
    delete snap.food;
    delete snap.buffs.wellFedS;
    const copy = new PlayerState(createBus());
    copy.food = 3;
    copy.buffs.wellFedS = 9;
    copy.load(snap);
    expect(copy.food).toBe(MAX_FOOD);
    expect(copy.buffs.wellFedS).toBe(0);
  });

  it('clamps a nonsense food value', () => {
    const r = rig();
    const snap = r.player.toJSON();
    snap.food = 99;
    const copy = new PlayerState(createBus());
    copy.load(snap);
    expect(copy.food).toBe(MAX_FOOD);
    snap.food = Number.NaN;
    copy.load(snap);
    expect(copy.food).toBe(MAX_FOOD);
  });

  it('hoe wear goes through wearHeldTool and can break the tool', () => {
    const r = rig();
    r.player.inventory.set(0, { item: 'flint_hoe', count: 1, durability: 2 });
    expect(r.player.wearHeldTool(1)).toBe(false);
    expect(r.player.heldStack()!.durability).toBe(1);
    expect(r.player.wearHeldTool(1)).toBe(true);
    expect(r.player.heldStack()).toBeNull();
    expect(r.seen.sfx).toContain('tool_break');
  });
});
