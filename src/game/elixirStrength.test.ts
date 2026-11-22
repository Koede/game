import { describe, expect, it } from 'vitest';
import { drinkElixir } from '../app/gameWiring';
import { DRINK_BUFF_S, REACH } from '../core/constants';
import { createBus } from '../core/context';
import { ELIXIR_STRENGTH_ADD, ELIXIR_TIME_MULT } from '../core/distill';
import { block } from '../core/registry';
import { hitDamage } from '../mobs/mob';
import { AnimalHands, type AnimalTargets } from '../player/animals';
import { Interaction } from '../player/interaction';
import { PlayerPhysics } from '../player/physics';
import { createRayHit, raycast, type RayHit } from '../player/raycast';
import { flatWorld } from '../player/testKit';
import { Buffs } from './buffs';
import { drink } from './drink';
import { miningTime } from './mining';
import { PlayerState, type PlayerSnapshot } from './playerState';

const ELIXIR_S = DRINK_BUFF_S * ELIXIR_TIME_MULT;

function holdElixir(): PlayerState {
  const bus = createBus();
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.inventory.set(0, { item: 'elixir_swift', count: 4 });
  player.selectedSlot = 0;
  return player;
}

/** Damage AnimalHands actually deals, the melee read that adds buff strength. */
function swingDamage(player: PlayerState): number {
  const hits: number[] = [];
  const targets: AnimalTargets = {
    raycast: () => null,
    hit: (_id, damage) => {
      hits.push(damage);
      return { ok: true };
    },
    feed: () => ({ ok: false, reason: 'no' }),
  };
  const hands = new AnimalHands(targets, player, { triggerSwing: () => undefined }, { advise: () => undefined });
  hands.target = 1;
  expect(hands.strike()).toBe(true);
  player.combat.coolStrike(1);
  return hits[0];
}

/** Seconds Interaction takes to break the dirt in front of the player. */
function mineDirt(player: PlayerState): number {
  const bus = createBus();
  const world = flatWorld(bus);
  world.put(0, 10, -2, 'dirt');
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
  const hit = createRayHit();
  const aim = (): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, 0.5 - ex, 10.5 - ey, -1.5 - ez, REACH, false, hit);
  };
  const dt = 1 / 60;
  let t = 0;
  while (t < 5) {
    const before = interaction.edits;
    interaction.updateMining(dt, true, aim());
    t += dt;
    if (interaction.edits !== before) return t;
  }
  return Infinity;
}

describe('elixir strength', () => {
  it('drinking an elixir raises melee damage and mining speed by 1, then both revert', () => {
    const player = holdElixir();
    const dirt = block('dirt');
    const bareMelee = hitDamage(null);
    const bareMine = miningTime(dirt, null, false);
    expect(player.buffs.strength).toBe(0);
    expect(swingDamage(player)).toBe(bareMelee);
    expect(mineDirt(player)).toBeCloseTo(bareMine, 1);

    const drank = drinkElixir(player);
    expect(drank.kind).toBe('drunk');
    expect(player.buffs.strength).toBe(ELIXIR_STRENGTH_ADD);
    expect(player.buffs.strengthS).toBe(ELIXIR_S);
    expect(player.buffs.timeLeftS('swift')).toBe(ELIXIR_S);
    expect(player.buffs.miningMult).toBe(1);
    expect(swingDamage(player)).toBe(bareMelee + ELIXIR_STRENGTH_ADD);
    const boosted = miningTime(dirt, null, false, player.buffs.miningMult, player.buffs.strength);
    expect(boosted).toBeCloseTo(dirt.hardness / (1 + ELIXIR_STRENGTH_ADD));
    expect(mineDirt(player)).toBeCloseTo(boosted, 1);

    player.buffs.tick(ELIXIR_S);
    expect(player.buffs.strength).toBe(0);
    expect(player.buffs.strengthS).toBe(0);
    expect(player.buffs.has('swift')).toBe(false);
    expect(swingDamage(player)).toBe(bareMelee);
    expect(miningTime(dirt, null, false, player.buffs.miningMult, player.buffs.strength)).toBeCloseTo(bareMine);
    player.dispose();
  });

  it('a second elixir keeps the higher strength and only refreshes the duration', () => {
    const player = holdElixir();
    expect(drinkElixir(player).kind).toBe('drunk');
    player.buffs.tick(100);
    player.drinkCooldownS = 0;
    expect(drinkElixir(player).kind).toBe('drunk');
    expect(player.buffs.strength).toBe(ELIXIR_STRENGTH_ADD);
    expect(player.buffs.strengthS).toBe(ELIXIR_S);
    expect(player.buffs.timeLeftS('swift')).toBe(ELIXIR_S);

    const b = new Buffs();
    b.grantStrength(1, 30);
    b.tick(10);
    b.grantStrength(1, 10);
    expect(b.strength).toBe(1);
    expect(b.strengthS).toBe(20);
    b.grantStrength(2, 5);
    expect(b.strength).toBe(2);
    expect(b.strengthS).toBe(20);
    b.grantStrength(1, 100);
    expect(b.strength).toBe(2);
    expect(b.strengthS).toBe(100);

    player.inventory.set(1, { item: 'green_tea', count: 1 });
    player.selectedSlot = 1;
    player.drinkCooldownS = 0;
    expect(drink(player).ok).toBe(true);
    expect(player.buffs.strength).toBe(ELIXIR_STRENGTH_ADD);
    player.dispose();
  });

  it('an old save with no strength field loads as 0', () => {
    const b = new Buffs();
    b.grantStrength(1, 40);
    b.tick(5);
    const copy = new Buffs();
    copy.load(JSON.parse(JSON.stringify(b.toJSON())));
    expect(copy.strength).toBe(1);
    expect(copy.strengthS).toBeCloseTo(35);
    copy.load({ wellWarmedS: 3 });
    expect(copy.strength).toBe(0);
    expect(copy.strengthS).toBe(0);
    expect(copy.toJSON()).toEqual({ wellWarmedS: 3, wellFedS: 0, drinks: {} });

    const player = holdElixir();
    drinkElixir(player);
    const snap = JSON.parse(JSON.stringify(player.toJSON())) as PlayerSnapshot;
    expect(snap.buffs.strength).toBe(1);
    delete snap.buffs.strength;
    delete snap.buffs.strengthS;
    const old = new PlayerState(createBus());
    old.buffs.grantStrength(4, 80);
    old.load(snap);
    expect(old.buffs.strength).toBe(0);
    expect(old.buffs.strengthS).toBe(0);
    expect(old.buffs.timeLeftS('swift')).toBe(ELIXIR_S);
    player.dispose();
    old.dispose();
  });
});
