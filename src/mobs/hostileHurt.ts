/**
 * Automatons taking damage (spec 19.4): the player's hits (shield arm, knockback by bulk, waking, the arc maul's stun)
 * and any hurt (lava too). At 0 health an automaton breaks apart at once: sfx automaton_break, 'mob:died', and for a
 * player kill 'automaton:salvaged' with its drops plus the flag FLAG_AUTOMATON_SALVAGED; the drops reach the player
 * through the manager's death listeners. Its corpse only fades (CORPSE_FADE_S).
 */
import { FLAG_AUTOMATON_SALVAGED, MOB_DEATH_S, MOB_HIT_COOLDOWN_S } from '../core/constants';
import type { GameBus } from '../core/context';
import { angleDiff, bodyHeight, yawTowards } from './brain';
import { voicePitch } from './attacks';
import { FLASH_S, KNOCK_H, KNOCK_V } from './constants';
import { PROVOKED_S, wake } from './hostileBrain';
import type { HostileCtx } from './hostileCtx';
import { rollDrops } from './mob';
import type { DeathCause, HitResult, Mob, MobDeath } from './types';

/** A hit throws an automaton back by KNOCK_H scaled by min(1, this / its health): the colossus barely moves. */
const KNOCK_MASS = 8;

export interface HurtEnv {
  readonly bus: GameBus;
  readonly rng: () => number;
  readonly ctx: HostileCtx;
  died(d: MobDeath): void;
}

/**
 * The player hits automaton `m` for `damage` from (fromX, fromZ): a shield arm facing the blow (within 90 degrees of
 * where it faces, not while stunned) takes `shieldFront` of it, a knock back scaled by its bulk, a flash and a clang;
 * it wakes, turns on the player and stays awake in daylight for PROVOKED_S; `stunS` > 0 (the arc maul) stuns it (a
 * wind-up or dash is broken off). Refused for MOB_HIT_COOLDOWN_S after a hit (the weapon's own swing timer is the
 * player's).
 */
export function hitHostile(env: HurtEnv, m: Mob, damage: number, fromX: number, fromZ: number, stunS: number): HitResult {
  if (m.state === 'dying') return { ok: false, reason: 'dead' };
  if (m.hitCooldownS > 0) return { ok: false, reason: 'cooldown' };
  const s = m.spec.hostile!;
  const h = m.hostile!;
  m.hitCooldownS = MOB_HIT_COOLDOWN_S;
  const dx = fromX - m.x;
  const dz = fromZ - m.z;
  if (s.shieldFront !== undefined && h.stunS <= 0 && Math.abs(angleDiff(m.yaw, yawTowards(dx, dz))) <= Math.PI / 2) damage *= s.shieldFront;
  if (!s.stationary) {
    const k = Math.min(1, KNOCK_MASS / m.spec.health);
    const d = Math.hypot(dx, dz) || 1;
    m.vx = (-dx / d) * KNOCK_H * k;
    m.vz = (-dz / d) * KNOCK_H * k;
    if (m.onGround && !s.flying) m.vy = KNOCK_V * k;
  }
  if (h.mode === 'dormant') wake(env.ctx, m);
  if (h.mode === 'dormant' || h.mode === 'roam') h.mode = 'chase';
  h.aware = true;
  h.unseenS = 0;
  h.roamS = 0;
  h.lastX = fromX;
  h.lastZ = fromZ;
  h.provokedS = PROVOKED_S;
  if (stunS > 0) {
    h.stunS = Math.max(h.stunS, stunS);
    if (h.mode === 'windup' || h.mode === 'dash') h.mode = 'chase';
  }
  hurtHostile(env, m, damage, 'player');
  return { ok: true, health: Math.max(0, m.health), killed: m.health <= 0 };
}

/** Takes `damage` off an automaton: flash, 'mob:hurt', a clang; at 0 it breaks apart (see the file comment). */
export function hurtHostile(env: HurtEnv, m: Mob, damage: number, cause: DeathCause): void {
  m.health -= damage;
  m.hurtS = FLASH_S;
  const y = m.y + bodyHeight(m) * 0.6;
  const bus = env.bus;
  bus.emit('mob:hurt', { id: m.id, species: m.spec.key, health: Math.max(0, m.health) });
  bus.emit('sfx', { name: 'automaton_hurt', x: m.x, y, z: m.z, pitch: voicePitch(m.spec) });
  if (m.health > 0) return;
  m.state = 'dying';
  m.deadS = MOB_DEATH_S;
  m.vx = m.vz = 0;
  m.deathCause = cause;
  m.hostile!.mode = 'roam';
  bus.emit('sfx', { name: 'automaton_break', x: m.x, y, z: m.z, pitch: voicePitch(m.spec) });
  const drops = cause === 'player' ? rollDrops(m.spec.drops, env.rng) : [];
  bus.emit('mob:died', { id: m.id, species: m.spec.key });
  if (cause === 'player') {
    bus.emit('automaton:salvaged', { id: m.id, species: m.spec.key, x: m.x, y: m.y, z: m.z, drops });
    bus.emit('flag', { flag: FLAG_AUTOMATON_SALVAGED });
  }
  env.died({ id: m.id, species: m.spec.key, x: m.x, y: m.y, z: m.z, cause, drops });
}
