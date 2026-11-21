import { describe, expect, it } from 'vitest';
import { DT, FLAG_AUTOMATON_SALVAGED, FLAG_PEACEFUL, MAX_HEALTH, MOB_HIT_COOLDOWN_S, WEAPON_HIT_COOLDOWN_S } from '../core/constants';
import { createBus, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { OBJECTIVES, creature } from '../core/registry';
import { GameClock } from './clock';
import { KNOCKBACK_DEFAULT, KNOCKBACK_LIFT, difficultyDamage, killerLine, strikeCooldownOf, stunOf } from './combat';
import { FakeWorld } from './fakeWorld';
import { ObjectiveTracker } from './objectives';
import { PlayerState, type PlayerSnapshot } from './playerState';
import { Survival } from './survival';

interface Rig {
  bus: GameBus;
  player: PlayerState;
  survival: Survival;
  damage: Array<GameEvents['player:damage']>;
  attacked: Array<GameEvents['player:attacked']>;
  sfx: string[];
  run(seconds: number): void;
}

/** A player standing at (0.5, 10, 0.5) on stone, by day, with Survival ticking. */
function rig(): Rig {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.onGround = true;
  const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
  const damage: Array<GameEvents['player:damage']> = [];
  const attacked: Array<GameEvents['player:attacked']> = [];
  const sfx: string[] = [];
  bus.on('player:damage', (e) => damage.push(e));
  bus.on('player:attacked', (e) => attacked.push(e));
  bus.on('sfx', (e) => sfx.push(e.name));
  const run = (seconds: number): void => {
    for (let i = Math.round(seconds / DT); i > 0; i--) survival.tick(DT);
  };
  return { bus, player, survival, damage, attacked, sfx, run };
}

const total = (d: Array<GameEvents['player:damage']>, cause?: string): number =>
  d.filter((e) => cause === undefined || e.cause === cause).reduce((s, e) => s + e.amount, 0);

describe('damagePlayer: difficulty', () => {
  it('Normal deals the raw damage, Hard x1.25, Peaceful nothing at all (no event, no push)', () => {
    const r = rig();
    expect(r.player.damagePlayer(4, 'automaton', 0.5, -3, 'bellows_hound')).toBe(4);
    expect(r.player.health).toBe(MAX_HEALTH - 4);

    const hard = rig();
    hard.player.combat.setDifficulty('hard');
    expect(hard.player.difficulty).toBe('hard');
    expect(hard.player.damagePlayer(4, 'automaton', 0.5, -3, 'bellows_hound')).toBe(5);
    expect(hard.attacked[0].amount).toBe(5);

    const calm = rig();
    calm.player.combat.setDifficulty('peaceful');
    expect(calm.player.damagePlayer(4, 'automaton', 0.5, -3, 'bellows_hound')).toBe(0);
    expect(calm.player.health).toBe(MAX_HEALTH);
    expect(calm.attacked).toHaveLength(0);
    expect(calm.player.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('scales only what automatons do', () => {
    expect(difficultyDamage(2, 'ember', 'hard')).toBe(2.5);
    expect(difficultyDamage(2, 'fall', 'hard')).toBe(2);
    expect(difficultyDamage(2, 'cold', 'peaceful')).toBe(2);
  });
});

describe('damagePlayer: armour', () => {
  it('the best armour carried anywhere in the inventory softens blows; the padded coat alone does nothing', () => {
    const coat = rig();
    coat.player.inventory.add('padded_coat', 1, undefined, 20);
    expect(coat.player.damagePlayer(4, 'automaton', 0, 0, 'forge_warden')).toBe(4);

    const plated = rig();
    plated.player.inventory.add('plated_coat', 1, undefined, 30);
    expect(plated.player.damagePlayer(4, 'automaton', 0, 0, 'forge_warden')).toBeCloseTo(3);

    const both = rig();
    both.player.give('plated_coat');
    both.player.give('steel_cuirass');
    expect(both.player.damagePlayer(5, 'automaton', 0, 0, 'forge_warden')).toBeCloseTo(3);
    // The event carries the damage before armour (after difficulty).
    expect(both.attacked[0].amount).toBe(5);
    expect(both.damage[0].amount).toBeCloseTo(3);
  });

  it('armour is for blows only: burning, falls and the cold go straight through', () => {
    const r = rig();
    r.player.give('steel_cuirass');
    r.player.damagePlayer(1, 'ember', 0, 0, 'kiln_sentry');
    r.player.damage(2, 'fall');
    expect(r.damage.map((e) => e.amount)).toEqual([1, 2]);
  });

  it('hard and armour combine: difficulty first, then the reduction', () => {
    const r = rig();
    r.player.combat.setDifficulty('hard');
    r.player.give('steel_cuirass');
    expect(r.player.damagePlayer(4, 'automaton', 0, 0, 'forge_warden')).toBeCloseTo(4 * 1.25 * 0.6);
  });
});

describe('damagePlayer: knockback and the HUD event', () => {
  it('pushes the player away from the source with the species knockback and a small hop', () => {
    const r = rig();
    // The hound charges from the north (-Z): the player flies south (+Z).
    r.player.damagePlayer(4, 'automaton', 0.5, -4, 'bellows_hound');
    expect(r.player.velocity.x).toBeCloseTo(0);
    expect(r.player.velocity.z).toBeCloseTo(creature('bellows_hound').hostile!.knockback!);
    expect(r.player.velocity.y).toBe(KNOCKBACK_LIFT);
    expect(r.attacked[0]).toMatchObject({ species: 'bellows_hound', attack: 'dash', amount: 4, x: 0.5, z: -4 });
  });

  it('a species without its own knockback pushes by the default; no hop in the air', () => {
    const r = rig();
    r.player.onGround = false;
    r.player.velocity.y = -2;
    r.player.damagePlayer(1, 'automaton', 3.5, 0.5, 'cinder_mite', 10.2);
    expect(r.player.velocity.x).toBeCloseTo(-KNOCKBACK_DEFAULT);
    expect(r.player.velocity.y).toBe(-2);
    expect(r.attacked[0]).toMatchObject({ attack: 'melee', y: 10.2 });
  });

  it('a blow from exactly where the player stands pushes them backwards from where they look', () => {
    const r = rig();
    r.player.yaw = 0; // looking north
    r.player.damagePlayer(1, 'automaton', 0.5, 0.5, 'cinder_mite');
    expect(r.player.velocity.z).toBeCloseTo(KNOCKBACK_DEFAULT);
  });

  it('ignores the dead and zero damage', () => {
    const r = rig();
    expect(r.player.damagePlayer(0, 'automaton', 0, 0, 'cinder_mite')).toBe(0);
    r.player.damage(MAX_HEALTH, 'fall');
    expect(r.player.damagePlayer(3, 'automaton', 0, 0, 'cinder_mite')).toBe(0);
    expect(r.attacked).toHaveLength(0);
  });
});

describe('takeHit and knock: the hooks for an attacker that applied the difficulty and announced itself', () => {
  it('takeHit applies armour, remembers the attacker and burns for a bolt - but emits nothing and scales nothing', () => {
    const r = rig();
    r.player.combat.setDifficulty('hard');
    r.player.give('plated_coat');
    expect(r.player.combat.takeHit(2.5, 'automaton', 0, -8, 'kiln_sentry')).toBeCloseTo(2.5 * 0.75);
    expect(r.attacked).toHaveLength(0);
    expect(r.player.combat.lastAttacker).toBe('kiln_sentry');
    expect(r.player.combat.burning).toBe(true);
    expect(r.player.velocity).toEqual({ x: 0, y: 0, z: 0 });
    // A warden's blow does not set anyone on fire.
    const w = rig();
    w.player.combat.takeHit(3, 'automaton', 0, 0, 'forge_warden');
    expect(w.player.combat.burning).toBe(false);
    expect(w.player.health).toBe(MAX_HEALTH - 3);
  });

  it('knock adds to the velocity the player already has', () => {
    const r = rig();
    r.player.velocity.x = 1;
    r.player.combat.knock(8, 4, -2);
    expect(r.player.velocity).toEqual({ x: 9, y: 4, z: -2 });
    r.player.combat.knock(Number.NaN, 0, 0);
    expect(r.player.velocity).toEqual({ x: 9, y: 4, z: -2 });
  });
});

describe('burning', () => {
  it("a kiln sentry's bolt: 2 damage, then 'ember' 1/s for 2 s", () => {
    const r = rig();
    r.player.damagePlayer(2, 'automaton', 0.5, -10, 'kiln_sentry');
    expect(r.player.combat.burning).toBe(true);
    r.run(0.95);
    expect(total(r.damage, 'ember')).toBe(0);
    r.run(0.1);
    expect(total(r.damage, 'ember')).toBe(1);
    r.run(1);
    expect(total(r.damage, 'ember')).toBe(2);
    expect(r.player.combat.burning).toBe(false);
    r.run(3);
    expect(total(r.damage, 'ember')).toBe(2);
    expect(r.player.health).toBe(MAX_HEALTH - 4);
  });

  it('a second bolt refreshes the burn instead of stacking it', () => {
    const r = rig();
    r.player.combat.ignite(2, 1);
    r.run(1.5);
    r.player.combat.ignite(2, 1);
    expect(r.player.combat.burnTimeLeftS).toBeCloseTo(2);
    r.run(5);
    // Burned at 1 s, 2 s and 3 s: three points, never two at once.
    expect(r.damage.filter((e) => e.cause === 'ember').map((e) => e.amount)).toEqual([1, 1, 1]);
  });

  it('hard burns 1.25 a second; armour does not help', () => {
    const r = rig();
    r.player.combat.setDifficulty('hard');
    r.player.give('steel_cuirass');
    r.player.combat.ignite(2, 1);
    r.run(2.05);
    expect(total(r.damage, 'ember')).toBeCloseTo(2.5);
  });

  it('water puts it out with a hiss, and nobody catches fire in water', () => {
    const r = rig();
    r.player.combat.ignite(2, 1);
    r.run(0.5);
    r.player.inWater = true;
    r.run(0.05);
    expect(r.player.combat.burning).toBe(false);
    expect(r.sfx).toContain('steam_hiss');
    r.run(3);
    expect(total(r.damage, 'ember')).toBe(0);
    r.player.combat.ignite(2, 1);
    expect(r.player.combat.burning).toBe(false);
  });

  it('Peaceful puts it out and refuses new fires', () => {
    const r = rig();
    r.player.combat.ignite(2, 1);
    r.player.combat.setDifficulty('peaceful');
    expect(r.player.combat.burning).toBe(false);
    r.player.combat.ignite(2, 1);
    expect(r.player.combat.burning).toBe(false);
  });

  it('death and respawn put it out', () => {
    const r = rig();
    r.player.combat.ignite(2, 1);
    r.player.damage(MAX_HEALTH, 'fall');
    expect(r.player.combat.burning).toBe(false);
    r.survival.respawn();
    r.run(3);
    expect(total(r.damage, 'ember')).toBe(0);
  });
});

describe('the death screen knows who did it', () => {
  it('a blow names the automaton: "Felled by a Forge Warden"', () => {
    const r = rig();
    r.player.health = 2;
    r.player.damagePlayer(3, 'automaton', 0, 0, 'forge_warden');
    expect(r.player.dead).toBe(true);
    expect(r.player.deathCause).toBe('automaton');
    expect(r.player.killedBy).toBe('forge_warden');
    expect(killerLine(r.player.deathCause, r.player.killedBy)).toBe('Felled by a Forge Warden');
    expect(killerLine('automaton', 'arc_drone')).toBe('Felled by an Arc Drone');
  });

  it('burning to death names whose bolt it was', () => {
    const r = rig();
    r.player.health = 2.5;
    r.player.damagePlayer(2, 'automaton', 0, -8, 'kiln_sentry');
    r.run(1.05);
    expect(r.player.dead).toBe(true);
    expect(r.player.deathCause).toBe('ember');
    expect(killerLine(r.player.deathCause, r.player.killedBy)).toBe("Burned by a Kiln Sentry's ember");
  });

  it('other deaths name nobody, even after a fight; respawn forgets the killer', () => {
    const r = rig();
    r.player.damagePlayer(1, 'automaton', 0, 0, 'cinder_mite');
    r.player.damage(MAX_HEALTH, 'fall');
    expect(r.player.killedBy).toBeNull();
    expect(killerLine('fall', 'cinder_mite')).toBeNull();
    const k = rig();
    k.player.health = 1;
    k.player.damagePlayer(1, 'automaton', 0, 0, 'cinder_mite');
    k.survival.respawn();
    expect(k.player.killedBy).toBeNull();
  });

  it('an attacker announced by someone else still counts', () => {
    const r = rig();
    r.bus.emit('player:attacked', { species: 'slag_colossus', attack: 'slam', amount: 6, x: 0, y: 10, z: 0 });
    r.player.damage(MAX_HEALTH, 'automaton');
    expect(r.player.killedBy).toBe('slag_colossus');
  });
});

describe('saving', () => {
  it('keeps burning and the killer through a save', () => {
    const r = rig();
    r.player.damagePlayer(2, 'automaton', 0, -8, 'kiln_sentry');
    r.run(0.5);
    const snap = JSON.parse(JSON.stringify(r.player.toJSON())) as PlayerSnapshot;
    const back = rig();
    back.player.load(snap);
    expect(back.player.combat.burnTimeLeftS).toBeCloseTo(1.5);
    expect(back.player.combat.lastAttacker).toBe('kiln_sentry');
    back.run(2);
    expect(total(back.damage, 'ember')).toBe(2);

    const dead = rig();
    dead.player.health = 1;
    dead.player.damagePlayer(3, 'automaton', 0, 0, 'forge_warden');
    const restored = rig();
    restored.player.load(JSON.parse(JSON.stringify(dead.player.toJSON())) as PlayerSnapshot);
    expect(restored.player.killedBy).toBe('forge_warden');
  });

  it('loads saves from before the Emberbound: not burning, nobody to blame', () => {
    const r = rig();
    const snap = r.player.toJSON();
    delete snap.combat;
    delete snap.killedBy;
    const back = rig();
    back.player.load(snap);
    expect(back.player.combat.burning).toBe(false);
    expect(back.player.killedBy).toBeNull();
    back.player.load({ ...snap, combat: { burnLeftS: Number.NaN, burnPerS: -1, burnAccS: 9, lastAttacker: null } });
    expect(back.player.combat.burning).toBe(false);
  });
});

describe('swinging weapons', () => {
  it('mauls wait WEAPON_HIT_COOLDOWN_S between hits, tools and hands MOB_HIT_COOLDOWN_S', () => {
    expect(strikeCooldownOf('bronze_maul')).toBe(WEAPON_HIT_COOLDOWN_S);
    expect(strikeCooldownOf('arc_maul')).toBe(0.5);
    expect(strikeCooldownOf('iron_pickaxe')).toBe(MOB_HIT_COOLDOWN_S);
    expect(strikeCooldownOf(null)).toBe(0.4);
  });

  it('only the arc maul stuns', () => {
    expect(stunOf('arc_maul')).toBe(1);
    expect(stunOf('steel_maul')).toBe(0);
    expect(stunOf('flint_axe')).toBe(0);
    expect(stunOf(null)).toBe(0);
  });

  it('the swing cooldown counts down by frame time', () => {
    const r = rig();
    const c = r.player.combat;
    expect(c.strikeReady).toBe(true);
    c.startStrikeCooldown('iron_maul');
    expect(c.strikeReady).toBe(false);
    c.coolStrike(0.45);
    expect(c.strikeReady).toBe(false);
    c.coolStrike(0.05);
    expect(c.strikeReady).toBe(true);
  });
});

describe('objectives', () => {
  const ids = OBJECTIVES.map((o) => o.id);

  it('Peaceful raises the flag that completes the combat objectives', () => {
    const r = rig();
    const tracker = new ObjectiveTracker(r.bus, r.player);
    const flags: string[] = [];
    r.bus.on('flag', (e) => flags.push(e.flag));
    r.player.combat.setDifficulty('normal');
    expect(flags).toEqual([]);
    r.player.combat.setDifficulty('peaceful');
    expect(flags).toEqual([FLAG_PEACEFUL]);
    expect(tracker.hasFlag(FLAG_PEACEFUL)).toBe(true);
    expect(tracker.progressOf(OBJECTIVES[ids.indexOf('salvage_automaton')].condition).fraction).toBe(1);
    expect(tracker.progressOf(OBJECTIVES[ids.indexOf('ward_base')].condition).fraction).toBe(1);
  });

  it('a session already on Peaceful before the tracker existed still gets the flag on the next check', () => {
    const r = rig();
    r.player.combat.setDifficulty('peaceful');
    const tracker = new ObjectiveTracker(r.bus, r.player);
    expect(tracker.hasFlag(FLAG_PEACEFUL)).toBe(false);
    tracker.check();
    expect(tracker.hasFlag(FLAG_PEACEFUL)).toBe(true);
    // Once raised it stays, even back on Normal.
    r.player.combat.setDifficulty('normal');
    tracker.check();
    expect(tracker.hasFlag(FLAG_PEACEFUL)).toBe(true);
  });

  it("'automaton:salvaged' alone completes Salvage an automaton", () => {
    const r = rig();
    const tracker = new ObjectiveTracker(r.bus, r.player);
    r.bus.emit('automaton:salvaged', { id: 3, species: 'cinder_mite', x: 0, y: 10, z: 0, drops: [] });
    expect(tracker.hasFlag(FLAG_AUTOMATON_SALVAGED)).toBe(true);
    expect(tracker.progressOf(OBJECTIVES[ids.indexOf('salvage_automaton')].condition).fraction).toBe(1);
    // ward_base still needs a beacon on Normal.
    expect(tracker.progressOf(OBJECTIVES[ids.indexOf('ward_base')].condition).fraction).toBe(0);
  });
});
