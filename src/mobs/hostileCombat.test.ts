import { describe, expect, it } from 'vitest';
import { DT, EMBER_BOLT_GRAVITY, HOSTILE_DAMAGE_MULT, WEAPON_HIT_COOLDOWN_S } from '../core/constants';
import { creature } from '../core/registry';
import { arena } from './hostileKit';
import { aimLob } from './projectiles';
import { lineClear } from './sight';
import { FlatWorld } from './testKit';

const spec = (key: string) => creature(key).hostile!;

describe('telegraphed attacks', () => {
  it('a forge warden winds up 0.5 s, then hits for 3, once per 1.6 s period', () => {
    const a = arena();
    a.player.z = 2.8;
    a.spawn('forge_warden', 0.5, 11, 0.5, Math.PI);
    a.run(4);
    const windups = a.names('hostile:windup');
    const attacks = a.names('hostile:attack');
    expect(windups.length).toBeGreaterThanOrEqual(2);
    expect(windups[0].t).toBeLessThan(0.5);
    expect((windups[0].payload as { durationS: number }).durationS).toBe(0.5);
    expect(attacks[0].t - windups[0].t).toBeCloseTo(spec('forge_warden').windupS, 1);
    expect(windups[1].t - windups[0].t).toBeCloseTo(spec('forge_warden').cooldownS, 1);
    expect(a.blows[0]).toMatchObject({ amount: 3, cause: 'automaton', kind: 'forge_warden' });
    expect(a.blows[0].t).toBeCloseTo(attacks[0].t, 5);
    // 'player:attacked' comes first, with the same amount.
    const attacked = a.names('player:attacked')[0];
    expect(attacked.payload).toMatchObject({ species: 'forge_warden', attack: 'melee', amount: 3 });
    expect(a.log.indexOf(a.log.find((e) => e.name === 'player:attacked')!)).toBeLessThan(a.log.length);
  });

  it('the wind-up sound starts so that it swells into the release', () => {
    const a = arena();
    a.player.z = 3.2;
    a.spawn('slag_colossus', 0.5, 11, 0.5, Math.PI);
    a.run(3);
    const wind = a.names('hostile:windup')[0];
    const sound = a.names('sfx').find((e) => (e.payload as { name: string }).name === 'automaton_windup')!;
    expect(sound.t - wind.t).toBeCloseTo(spec('slag_colossus').windupS - 0.5, 1);
    expect((sound.payload as { pitch: number }).pitch).toBeLessThan(1);
  });

  it('stepping out of reach during the wind-up dodges the blow', () => {
    const a = arena();
    a.player.z = 2.8;
    a.spawn('forge_warden', 0.5, 11, 0.5, Math.PI);
    a.run(0.6, () => {
      if (a.names('hostile:windup').length > 0) a.player.z = 6;
    });
    a.run(0.3);
    expect(a.names('hostile:attack').length).toBe(1);
    expect(a.blows).toHaveLength(0);
  });

  it('melee needs the player in the front arc; a slam hits all around', () => {
    const a = arena();
    const warden = a.spawn('forge_warden', 0.5, 11, 0.5, Math.PI);
    a.player.z = 2.8;
    a.run(0.6, () => {
      // Hop behind it the moment the wind-up starts (it turns slowly while winding up).
      if (a.names('hostile:windup').length > 0 && a.player.z > 0) a.player.z = -1.8;
    });
    expect(a.blows).toHaveLength(0);
    expect(warden.hostile!.mode).not.toBe('windup');

    const b = arena();
    b.spawn('slag_colossus', 0.5, 11, 0.5, 0);
    b.player.z = 3;
    b.run(1.6);
    expect(b.blows[0]).toMatchObject({ amount: 6, kind: 'slag_colossus' });
    expect(Math.hypot(b.knocks[0][0], b.knocks[0][2])).toBeCloseTo(10, 3);
    expect(b.knocks[0][2]).toBeGreaterThan(0);
  });

  it('a slam misses beyond its radius', () => {
    const b = arena();
    const c = b.spawn('slag_colossus', 0.5, 11, 0.5, 0);
    b.player.z = 3;
    b.run(0.2, () => undefined);
    b.run(1.5, () => {
      if (c.hostile!.mode === 'windup') b.player.z = 4.5;
    });
    expect(b.names('hostile:attack').length).toBeGreaterThan(0);
    expect(b.blows).toHaveLength(0);
  });

  it('a bellows hound crouches 0.8 s, then charges and hits once with knockback', () => {
    const a = arena();
    const hound = a.spawn('bellows_hound', 0.5, 11, -5.5, 0);
    a.player.z = 0.5;
    a.run(2.5);
    const w = a.names('hostile:windup')[0];
    const atk = a.names('hostile:attack')[0];
    expect(atk.t - w.t).toBeCloseTo(0.8, 1);
    expect(a.blows).toHaveLength(1);
    expect(a.blows[0].amount).toBe(4);
    expect(a.blows[0].t - atk.t).toBeLessThan(0.6);
    expect(a.knocks[0][2]).toBeGreaterThan(7);
    // It ran on past where the player stood.
    expect(hound.z).toBeGreaterThan(0.5);
  });

  it('an arc drone hovers 2-4 blocks up and zaps for 2, double when the player stands in water', () => {
    const a = arena();
    const drone = a.spawn('arc_drone', 0.5, 13, -4.5);
    a.run(3);
    const lift = drone.y - 11;
    expect(lift).toBeGreaterThanOrEqual(1.8);
    expect(lift).toBeLessThanOrEqual(4.2);
    expect(a.blows[0]).toMatchObject({ amount: 2, kind: 'arc_drone' });

    const b = arena();
    b.world.fill(-2, 9, -2, 2, 11, 2, 'water');
    b.player.y = 10.2;
    b.spawn('arc_drone', 0.5, 13, -4.5);
    b.run(3);
    expect(b.blows[0].amount).toBe(2 * spec('arc_drone').wetMult!);
  });

  it('a kiln sentry never moves, turns to aim and lobs bolts that strike the player', () => {
    const a = arena();
    const sentry = a.spawn('kiln_sentry', 0.5, 11, -9.5, 0);
    a.run(5);
    expect(sentry.x).toBe(0.5);
    expect(sentry.z).toBe(-9.5);
    // Turned around to face the player in the south (yaw pi).
    expect(Math.abs(Math.abs(sentry.yaw) - Math.PI)).toBeLessThan(0.2);
    const fired = a.names('projectile:fired');
    const hits = a.names('projectile:hit');
    expect(fired.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].payload).toMatchObject({ target: 'player', kind: 'ember_bolt', species: 'kiln_sentry' });
    expect(a.blows[0]).toMatchObject({ amount: 2, cause: 'automaton', kind: 'kiln_sentry' });
    expect(a.names('player:attacked')[0].payload).toMatchObject({ attack: 'bolt' });
    // The vent flared 0.7 s before each shot.
    expect(fired[0].t - a.names('hostile:windup')[0].t).toBeCloseTo(0.7, 1);
    // Views of the bolt for the renderer while it flew.
    expect(a.mobs.projectiles(0.5)).toHaveLength(0);
  });

  it('bolts hit the first solid block and never break it', () => {
    const a = arena();
    a.spawn('kiln_sentry', 0.5, 11, -9.5, Math.PI);
    a.run(0.3);
    // A glass pane between them: the sentry sees through it, the bolt does not pass.
    a.world.fill(-3, 11, -4, 3, 15, -4, 'glass');
    a.run(4);
    const hits = a.names('projectile:hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].payload).toMatchObject({ target: 'block' });
    expect(a.world.getBlock(0, 12, -4).key).toBe('glass');
    expect(a.blows).toHaveLength(0);
  });

  it('aimLob lands on its target', () => {
    for (const [tx, ty] of [[10, 0], [12, 2], [5, -4]]) {
      const v = aimLob(0, 1, 0, tx, 1 + ty, 0, 14, EMBER_BOLT_GRAVITY, [0, 0, 0]);
      const t = tx / v[0];
      const y = 1 + v[1] * t - 0.5 * EMBER_BOLT_GRAVITY * t * t;
      expect(y).toBeCloseTo(1 + ty, 3);
    }
  });

  it('Hard multiplies damage by 1.25', () => {
    const a = arena({ difficulty: 'hard' });
    a.player.z = 2.8;
    a.spawn('forge_warden', 0.5, 11, 0.5, Math.PI);
    a.run(1.2);
    expect(a.blows[0].amount).toBeCloseTo(3 * HOSTILE_DAMAGE_MULT.hard, 5);
  });
});

describe('fighting back', () => {
  it('the warden shield halves blows from the front only', () => {
    const a = arena();
    const w = a.spawn('forge_warden', 0.5, 11, 0.5, 0);
    a.player.z = 30;
    a.mobs.hit(w.id, 4, 0.5, -1.5);
    expect(w.health).toBe(16 - 2);
    w.hitCooldownS = 0;
    w.yaw = 0;
    a.mobs.hit(w.id, 4, 0.5, 2.5);
    expect(w.health).toBe(14 - 4);
  });

  it('a weapon sets its own cooldown; the arc maul stuns and breaks off a wind-up', () => {
    const a = arena();
    const w = a.spawn('forge_warden', 0.5, 11, 0.5, Math.PI);
    a.player.z = 2.8;
    a.run(0.5, () => undefined);
    expect(w.hostile!.mode).toBe('windup');
    const r = a.mobs.hit(w.id, 12, 0.5, 2.8, { cooldownS: WEAPON_HIT_COOLDOWN_S, stunS: 1 });
    expect(r.ok).toBe(true);
    expect(a.mobs.hit(w.id, 1, 0.5, 2.8).ok).toBe(false);
    a.run(WEAPON_HIT_COOLDOWN_S + DT);
    expect(a.mobs.hit(w.id, 1, 0.5, 2.8).ok).toBe(true);
    const attacksBefore = a.names('hostile:attack').length;
    a.run(0.4);
    expect(a.names('hostile:attack').length).toBe(attacksBefore);
    expect(a.blows).toHaveLength(0);
  });

  it('breaking an automaton apart salvages it: drops, events, the flag', () => {
    const a = arena();
    const deaths: { drops: { item: string; count: number }[]; cause: string }[] = [];
    a.mobs.onDeath((d) => deaths.push(d));
    const mite = a.spawn('cinder_mite', 0.5, 11, -6.5);
    a.player.z = 20;
    for (let i = 0; i < 4; i++) {
      mite.hitCooldownS = 0;
      a.mobs.hit(mite.id, 1, 0.5, 20);
    }
    expect(a.names('automaton:salvaged')).toHaveLength(1);
    expect(a.names('mob:died')).toHaveLength(1);
    expect(a.names('flag')[0].payload).toEqual({ flag: 'automaton_salvaged' });
    expect(deaths[0].cause).toBe('player');
    const sfx = a.names('sfx').map((e) => (e.payload as { name: string }).name);
    expect(sfx).toContain('automaton_hurt');
    expect(sfx).toContain('automaton_break');
    expect(sfx).not.toContain('cinder_mite');
    expect(a.mobs.describe(mite.id)).toBe('');
    a.run(1);
    expect(a.mobs.get(mite.id)).toBeUndefined();
  });

  it('is targeted by raycast and named for the HUD', () => {
    const a = arena();
    const w = a.spawn('forge_warden', 0.5, 11, -2.5);
    a.run(DT);
    const hit = a.mobs.raycast(0.5, 12.6, 0.5, 0, 0, -1, 5);
    expect(hit?.id).toBe(w.id);
    expect(a.mobs.describe(w.id)).toBe('Forge Warden - 16/16');
  });
});

describe('senses and steering', () => {
  it('line of sight: opaque blocks stop eyes, any solid block stops arcs', () => {
    const w = new FlatWorld();
    expect(lineClear(w, 0.5, 12, 0.5, 0.5, 12, 10.5, 'sight')).toBe(true);
    w.put(0, 12, 5, 'stone');
    expect(lineClear(w, 0.5, 12, 0.5, 0.5, 12, 10.5, 'sight')).toBe(false);
    w.put(0, 12, 5, 'glass');
    expect(lineClear(w, 0.5, 12, 0.5, 0.5, 12, 10.5, 'sight')).toBe(true);
    expect(lineClear(w, 0.5, 12, 0.5, 0.5, 12, 10.5, 'solid')).toBe(false);
    // Diagonals through a corner gap are not skipped.
    w.put(3, 12, 3, 'stone');
    expect(lineClear(w, 0.5, 12.5, 0.5, 6.5, 12.5, 6.5, 'sight')).toBe(false);
  });

  it('notices within 16 blocks with sight, 6 without; forgets 10 s after losing the player', () => {
    const a = arena();
    const w = a.spawn('forge_warden', 0.5, 11, -12.5);
    a.run(0.5);
    expect(w.hostile!.aware).toBe(true);
    expect(a.names('hostile:woke')).toHaveLength(1);

    const b = arena();
    b.world.fill(-6, 11, -4, 6, 14, -4, 'stone');
    const hidden = b.spawn('forge_warden', 0.5, 11, -12.5);
    b.run(1);
    expect(hidden.hostile!.aware).toBe(false);
    b.player.z = -7.5;
    b.run(0.5);
    expect(hidden.hostile!.aware).toBe(true);
    b.player.x = 40;
    b.run(9);
    expect(hidden.hostile!.aware).toBe(true);
    b.run(2);
    expect(hidden.hostile!.aware).toBe(false);
  });

  it('steers at the player and hops one block', () => {
    const a = arena();
    a.world.fill(-3, 11, -8, 3, 11, -8, 'stone');
    const w = a.spawn('forge_warden', 0.5, 11, -14.5);
    a.player.z = 0.5;
    a.run(6);
    expect(w.z).toBeGreaterThan(-4);
  });

  it('gives up after 4 s against a wall it cannot climb and roams', () => {
    const a = arena();
    a.world.fill(-12, 11, -6, 12, 13, -6, 'stone');
    const w = a.spawn('forge_warden', 0.5, 11, -8.5);
    a.player.z = -3.5;
    let roamed = false;
    a.run(7, () => {
      if (w.hostile!.mode === 'roam' && w.hostile!.aware) roamed = true;
    });
    expect(roamed).toBe(true);
  });

  it('never enters a safe zone: halts at its edge, and does not attack anyone inside', () => {
    const a = arena();
    a.zones.push({ x0: -5, z0: -5, x1: 5, z1: 5 });
    const mites = [a.spawn('cinder_mite', 0.5, 11, -12.5), a.spawn('forge_warden', 8.5, 11, -10.5), a.spawn('bellows_hound', -9.5, 11, 0.5)];
    a.run(30, () => {
      for (const m of mites) expect(Math.max(Math.abs(m.x), Math.abs(m.z))).toBeGreaterThan(4.5);
    });
    expect(a.names('hostile:windup')).toHaveLength(0);
    expect(a.blows).toHaveLength(0);
  });

  it('walks out of a zone that appears around it', () => {
    const a = arena();
    const w = a.spawn('forge_warden', 0.5, 11, -2.5);
    a.player.z = 30;
    a.zones.push({ x0: -6, z0: -6, x1: 6, z1: 6 });
    a.run(8);
    expect(Math.max(Math.abs(w.x), Math.abs(w.z))).toBeGreaterThan(6);
  });
});

describe('daylight', () => {
  it('winds down under open sky at dawn, wakes when hit or when night falls', () => {
    const a = arena({ light: 0.6 });
    a.player.z = 40;
    const m = a.spawn('cinder_mite', 0.5, 11, 0.5);
    a.run(1);
    expect(m.hostile!.mode).not.toBe('dormant');
    a.run(1.5);
    expect(m.hostile!.mode).toBe('dormant');
    expect(a.names('hostile:dormant')).toHaveLength(1);
    a.run(2);
    expect(m.hostile!.glow).toBeLessThan(0.05);
    expect(a.mobs.views(1).find((v) => v.id === m.id)?.dormant).toBe(true);
    // Takes normal damage and wakes when hit.
    a.mobs.hit(m.id, 1, 0.5, 3);
    expect(m.health).toBe(3);
    expect(m.hostile!.mode).not.toBe('dormant');
    expect(m.hostile!.aware).toBe(true);
    // Night falls on another, dormant one: it wakes.
    const b = arena({ light: 0.6 });
    b.player.z = 40;
    const n = b.spawn('cinder_mite', 0.5, 11, 0.5);
    b.run(3);
    expect(n.hostile!.mode).toBe('dormant');
    b.clock.light = 0.05;
    b.run(0.2);
    expect(n.hostile!.mode).not.toBe('dormant');
  });

  it('keeps going under a roof, and dormant ones despawn beyond 48 blocks', () => {
    const a = arena({ light: 0.6 });
    a.world.fill(-4, 14, -4, 4, 14, 4, 'stone');
    a.player.z = 40;
    const roofed = a.spawn('cinder_mite', 0.5, 11, 0.5);
    const open = a.spawn('cinder_mite', 10.5, 11, 0.5);
    a.run(3);
    expect(roofed.hostile!.mode).not.toBe('dormant');
    expect(open.hostile!.mode).toBe('dormant');
    a.player.z = 60;
    a.run(1.1);
    expect(a.mobs.get(open.id)).toBeUndefined();
    expect(a.mobs.get(roofed.id)).toBeDefined();
  });

  it('removes natural automatons beyond 64 blocks', () => {
    const a = arena();
    const m = a.spawn('cinder_mite', 0.5, 11, 0.5);
    a.player.z = 70;
    a.run(1.1);
    expect(a.mobs.get(m.id)).toBeUndefined();
  });
});

describe('difficulty', () => {
  it('Peaceful removes natural automatons and bolts at once', () => {
    const a = arena();
    a.spawn('cinder_mite', 0.5, 11, -6.5);
    a.mobs.setDifficulty('peaceful');
    expect(a.mobs.hostiles.all).toHaveLength(0);
    a.run(1);
    expect(a.mobs.views(1)).toHaveLength(0);
  });
});
