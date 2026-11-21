import { describe, expect, it } from 'vitest';
import { MOB_HIT_COOLDOWN_S, WEAPON_HIT_COOLDOWN_S } from '../core/constants';
import { createBus } from '../core/context';
import { item } from '../core/registry';
import { AnimalHands, type AnimalTargets } from './animals';
import { PlayerPhysics } from './physics';
import { flatWorld, idle, makePlayer, record } from './testKit';

/** Hands on one creature (id 7) that never refuses a hit, recording every hit's damage and stun. */
function rig() {
  const bus = createBus();
  const player = makePlayer(bus);
  const hits: Array<{ damage: number; stunS: number | undefined }> = [];
  const targets: AnimalTargets = {
    raycast: () => null,
    hit: (_id, damage, _x, _z, stunS) => {
      hits.push({ damage, stunS });
      return { ok: true };
    },
    feed: () => ({ ok: false, reason: 'no' }),
  };
  let swings = 0;
  const hands = new AnimalHands(targets, player, { triggerSwing: () => swings++ }, { advise: () => undefined });
  hands.target = 7;
  return { bus, player, hits, hands, swings: () => swings };
}

describe('the player swinging at automatons', () => {
  it('a maul hits for its weapon damage, then waits WEAPON_HIT_COOLDOWN_S of frame time', () => {
    const r = rig();
    r.player.give('iron_maul');
    expect(r.hands.strike()).toBe(true);
    expect(r.hits[0].damage).toBe(item('iron_maul').weapon!.damage);
    expect(r.swings()).toBe(1);
    // Past the creatures' own 0.4 s but not the maul's 0.5 s.
    r.player.combat.coolStrike(MOB_HIT_COOLDOWN_S + 0.01);
    expect(r.hands.strike()).toBe(false);
    r.player.combat.coolStrike(WEAPON_HIT_COOLDOWN_S - MOB_HIT_COOLDOWN_S);
    expect(r.hands.strike()).toBe(true);
    expect(r.hits).toHaveLength(2);
  });

  it('tools and bare hands swing every 0.4 s', () => {
    const r = rig();
    expect(r.hands.strike()).toBe(true);
    r.player.combat.coolStrike(MOB_HIT_COOLDOWN_S);
    expect(r.hands.strike()).toBe(true);
    expect(r.hits.map((h) => h.damage)).toEqual([1, 1]);
  });

  it('the arc maul stuns; other weapons pass no stun', () => {
    const r = rig();
    r.player.give('arc_maul');
    r.hands.strike();
    expect(r.hits[0]).toEqual({ damage: 12, stunS: 1 });
    const s = rig();
    s.player.give('steel_maul');
    s.hands.strike();
    expect(s.hits[0]).toEqual({ damage: 9, stunS: 0 });
  });

  it('each landed hit wears the maul by 1 until it breaks', () => {
    const r = rig();
    r.player.give('bronze_maul');
    const full = r.player.heldStack()!.durability!;
    expect(full).toBe(item('bronze_maul').tool!.durability);
    r.hands.strike();
    expect(r.player.heldStack()!.durability).toBe(full - 1);
    r.player.heldStack()!.durability = 1;
    const log = record(r.bus, 'tool:broke');
    r.player.combat.coolStrike(1);
    r.hands.strike();
    expect(r.player.heldStack()).toBeNull();
    expect(log.map((l) => l.e.item)).toEqual(['bronze_maul']);
  });

  it('a refused hit (the creature recovering) neither swings, wears nor starts the cooldown', () => {
    const r = rig();
    r.player.give('bronze_maul');
    const refusing: AnimalTargets = { raycast: () => null, hit: () => ({ ok: false }), feed: () => ({ ok: true }) };
    const hands = new AnimalHands(refusing, r.player, { triggerSwing: () => undefined }, { advise: () => undefined });
    hands.target = 1;
    const before = r.player.heldStack()!.durability;
    expect(hands.strike()).toBe(false);
    expect(r.player.heldStack()!.durability).toBe(before);
    expect(r.player.combat.strikeReady).toBe(true);
  });
});

describe('knockback through the real physics', () => {
  /** Lets a player standing on a flat floor settle, takes a blow from the north, then runs 1.5 s idle. */
  function knocked(species: string, amount: number): number {
    const bus = createBus();
    const world = flatWorld(bus);
    const player = makePlayer(bus, 0.5, 10, 0.5);
    const physics = new PlayerPhysics(world, player);
    for (let i = 0; i < 30; i++) physics.step(1 / 60, idle());
    player.damagePlayer(amount, 'automaton', 0.5, -1.5, species);
    for (let i = 0; i < 90; i++) physics.step(1 / 60, idle());
    expect(player.onGround).toBe(true);
    return player.position.z - 0.5;
  }

  it('throws the player away from the automaton, further for a heavy hitter, and lands them', () => {
    const mite = knocked('cinder_mite', 1);
    const hound = knocked('bellows_hound', 4);
    const colossus = knocked('slag_colossus', 6);
    expect(mite).toBeGreaterThan(0.5);
    expect(hound).toBeGreaterThan(mite + 1);
    expect(colossus).toBeGreaterThan(hound);
    // Never a launch across the map from one blow.
    expect(colossus).toBeLessThan(8);
  });
});
