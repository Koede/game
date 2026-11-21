import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { blockId, creature } from '../core/registry';
import { Facing, makeVoxel } from '../core/types';
import { killerLine } from '../game';
import { isWorldSave } from '../save/document';
import { GameState } from './state';

/** Feet height of a stone platform high in the air (no terrain, no animals, no spawns can reach it). */
const FLOOR_Y = 84;

/**
 * A session on `difficulty` at night with the player standing on a 15x15 stone platform in the sky above spawn.
 * Returns the player's feet cell and a log of the combat events.
 */
function skyArena(difficulty: Difficulty = 'normal') {
  const state = GameState.create(4242, null, { difficulty });
  const p = state.player.position;
  const cx = Math.floor(p.x);
  const cz = Math.floor(p.z);
  state.world.ensureLoadedAround(cx, cz, 2);
  const stone = makeVoxel(blockId('stone'));
  for (let x = cx - 7; x <= cx + 7; x++) for (let z = cz - 7; z <= cz + 7; z++) state.world.setVoxel(x, FLOOR_Y - 1, z, stone, 'sim');
  state.player.position.x = cx + 0.5;
  state.player.position.y = FLOOR_Y;
  state.player.position.z = cz + 0.5;
  state.player.velocity.x = state.player.velocity.y = state.player.velocity.z = 0;
  state.player.yaw = 0;
  state.clock.setTimeOfDay(0.85);
  const attacked: GameEvents['player:attacked'][] = [];
  const damage: GameEvents['player:damage'][] = [];
  state.bus.on('player:attacked', (e) => attacked.push(e));
  state.bus.on('player:damage', (e) => damage.push(e));
  // Keep the player warm and fed so nothing but the automatons hurts them.
  const run = (seconds: number, each?: () => void) => {
    for (let t = 0; t < seconds; t += 0.05) {
      state.player.warmth = 100;
      state.player.food = 20;
      state.tick();
      each?.();
    }
  };
  /** An automaton `dz` blocks north of the player (in front of them), facing them. */
  const spawn = (species: string, dz: number) =>
    state.mobs.add(creature(species), { x: cx + 0.5, y: FLOOR_Y, z: cz + 0.5 - dz, yaw: Math.PI }, false);
  return { state, cx, cz, attacked, damage, run, spawn };
}

const hostileCount = (s: GameState) => s.mobs.hostiles.all.filter((m) => m.health > 0 && m.hostile?.role === 'natural').length;

describe('the Emberbound wired into a session (spec 19)', () => {
  it('a forge warden hurts the player once per blow through one damage path (Normal: 3)', () => {
    const a = skyArena('normal');
    a.spawn('forge_warden', 2.4);
    a.run(1.2);
    expect(a.attacked.length).toBeGreaterThanOrEqual(1);
    const automaton = a.damage.filter((d) => d.cause === 'automaton');
    // Exactly one damage per 'player:attacked': the hit was not announced or applied twice.
    expect(automaton.length).toBe(a.attacked.length);
    expect(automaton[0].amount).toBe(3);
    expect(a.attacked[0]).toMatchObject({ species: 'forge_warden', amount: 3 });
    expect(a.state.player.combat.lastAttacker).toBe('forge_warden');
    a.state.dispose();
  });

  it('Hard multiplies once (3 x 1.25), armour still counts', () => {
    const a = skyArena('hard');
    a.spawn('forge_warden', 2.4);
    a.run(1.2);
    expect(a.damage.find((d) => d.cause === 'automaton')?.amount).toBeCloseTo(3.75, 6);
    a.state.dispose();

    const b = skyArena('hard');
    b.state.player.give('steel_cuirass', 1);
    b.spawn('forge_warden', 2.4);
    b.run(1.2);
    expect(b.damage.find((d) => d.cause === 'automaton')?.amount).toBeCloseTo(3.75 * 0.6, 6);
    b.state.dispose();
  });

  it('setDifficulty switches both halves together; Peaceful removes the automatons and hurts nobody', () => {
    const a = skyArena('normal');
    a.spawn('forge_warden', 2.4);
    a.spawn('cinder_mite', 4);
    expect(hostileCount(a.state)).toBe(2);
    a.state.setDifficulty('peaceful');
    expect(a.state.difficulty).toBe('peaceful');
    expect(a.state.player.combat.difficulty).toBe('peaceful');
    a.run(2);
    expect(hostileCount(a.state)).toBe(0);
    expect(a.damage).toHaveLength(0);
    a.state.setDifficulty('hard');
    expect(a.state.player.combat.difficulty).toBe('hard');
    a.state.dispose();
  });

  it('a session started on Peaceful completes the combat objectives flag', () => {
    const a = skyArena('peaceful');
    a.run(0.2);
    expect(a.state.player.combat.difficulty).toBe('peaceful');
    expect(a.state.objectives.toJSON().flags).toContain('peaceful');
    a.state.dispose();
  });

  it('a hot furnace keeps automatons out of its warm zone and the player safe inside it', () => {
    const a = skyArena('normal');
    const fx = a.cx + 2;
    const fz = a.cz;
    expect(a.state.world.setVoxel(fx, FLOOR_Y, fz, makeVoxel(blockId('furnace_clay'), Facing.West), 'player')).toBe(true);
    const slots = a.state.sim.furnaceSlots(fx, FLOOR_Y, fz)!;
    slots.fuel.add('charcoal', 8);
    expect(a.state.sim.light(fx, FLOOR_Y, fz)).toEqual({ ok: true });
    const f = a.state.sim.furnaceAt(fx, FLOOR_Y, fz)!;
    f.tempC = 400;
    a.run(0.5);
    expect(a.state.sim.isSafe(a.cx + 0.5, FLOOR_Y, a.cz + 0.5)).toBe(true);
    const warden = a.spawn('forge_warden', 6.9);
    a.run(4);
    expect(a.damage.filter((d) => d.cause === 'automaton')).toHaveLength(0);
    // It halted at the edge of the zone (radius 6 around the furnace's centre) instead of walking in.
    expect(Math.hypot(warden.x - (fx + 0.5), warden.z - (fz + 0.5))).toBeGreaterThan(5.5);
    a.state.dispose();
  });

  it('death by an automaton names it, and a kiln sentry bolt sets the player burning', () => {
    const a = skyArena('normal');
    a.state.player.health = 2;
    a.spawn('forge_warden', 2.4);
    a.run(1.2);
    expect(a.state.player.dead).toBe(true);
    expect(a.state.player.deathCause).toBe('automaton');
    expect(a.state.player.killedBy).toBe('forge_warden');
    expect(killerLine(a.state.player.deathCause, a.state.player.killedBy)).toBe('Felled by a Forge Warden');
    a.state.dispose();

    const b = skyArena('normal');
    let burned = false;
    b.spawn('kiln_sentry', 6);
    b.run(5, () => {
      burned ||= b.state.player.combat.burning;
    });
    expect(b.attacked.some((e) => e.species === 'kiln_sentry' && e.attack === 'bolt')).toBe(true);
    expect(burned).toBe(true);
    expect(b.damage.some((d) => d.cause === 'ember')).toBe(true);
    b.state.dispose();
  });

  it('automatons are saved with the world and come back on Continue', () => {
    const a = skyArena('normal');
    const warden = a.spawn('forge_warden', 5);
    a.spawn('cinder_mite', 6);
    warden.health = 9;
    a.run(0.1);
    const save = JSON.parse(JSON.stringify(a.state.toSave())) as unknown;
    expect(isWorldSave(save)).toBe(true);
    if (!isWorldSave(save)) return;
    const copy = GameState.restore(save, { difficulty: 'normal' });
    copy.prepareAroundPlayer(2);
    const back = copy.mobs.hostiles.all.map((m) => [m.spec.key, m.health]).sort();
    const before = a.state.mobs.hostiles.all.map((m) => [m.spec.key, m.health]).sort();
    expect(back).toEqual(before);
    expect(back).toContainEqual(['forge_warden', 9]);
    a.state.dispose();
    copy.dispose();
  });
});
