/**
 * The attack state machine of spec 19.1 / 19.2: when a wind-up may start, the telegraph itself (event, sound timed to
 * peak at the release), and the release judged against where the player is THEN - melee in a 90-degree front arc,
 * slam all around, zap with a clear line (double in water), dash charge, ember bolt lobbed to land on the player.
 */
import { EMBER_BOLT_GRAVITY, HOSTILE_DASH_OVERRUN, PLAYER_HEIGHT, PLAYER_WIDTH } from '../core/constants';
import type { CreatureSpec, HostileSpec } from '../core/types';
import { angleDiff, bodyHeight, halfWidth, yawTowards } from './brain';
import type { HostileCtx } from './hostileCtx';
import { aimLob } from './projectiles';
import { lineClear } from './sight';
import type { Mob } from './types';

/** The wind-up sound swells for this long: it starts this much before the release (spec timing advice). */
const WINDUP_SOUND_S = 0.5;
/** A melee blow lands within this half-angle of the automaton's facing (a 90-degree arc). */
const MELEE_HALF_ARC = Math.PI / 4;
/** Knockback of a blow from a type without its own number, and the lift every knockback carries (blocks/s). */
const DEFAULT_KNOCK = 3;
const KNOCK_LIFT = 4;
const PLAYER_HALF = PLAYER_WIDTH / 2;

/** Pitch of an automaton's wind-up and footsteps: small ones high, the colossus low. */
export function voicePitch(spec: CreatureSpec): number {
  if (spec.key === 'cinder_mite') return 1.35;
  if (spec.key === 'slag_colossus') return 0.72;
  return 1;
}

/** Where the attack comes out of: the sentry's mouth, the drone's coil, the chest of the rest (feet + this). */
export const muzzleHeight = (m: Mob): number => bodyHeight(m) * (m.spec.hostile?.flying ? 0.75 : 0.65);

/** Horizontal distance from the automaton's body edge to the player's (melee reach is measured between them). */
const edgeGap = (m: Mob, hd: number): number => hd - halfWidth(m) - PLAYER_HALF;

/** Player's feet are level enough with the automaton for a blow or a slam to connect. */
const levelWith = (m: Mob, dy: number): boolean => dy > -1.2 && dy < bodyHeight(m) + 0.2;

/** Whether the player is in place for this automaton to begin a wind-up now (range, sight, footing). */
export function inAttackPosition(ctx: HostileCtx, m: Mob, spec: HostileSpec, sees: boolean): boolean {
  const p = ctx.player;
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  const hd = Math.hypot(dx, dz);
  const dy = p.y - m.y;
  if (!sees) return false;
  switch (spec.attack) {
    case 'melee':
      return edgeGap(m, hd) <= spec.range * 0.85 && levelWith(m, dy);
    case 'slam':
      return hd <= spec.range * 0.8 && levelWith(m, dy);
    case 'dash':
      return m.onGround && hd <= spec.range && hd >= 1.5 && Math.abs(dy) < 1.5;
    case 'bolt':
    case 'zap': {
      const my = m.y + muzzleHeight(m);
      return Math.hypot(dx, p.y + PLAYER_HEIGHT / 2 - my, dz) <= spec.range;
    }
  }
}

/** Starts the telegraph: 'hostile:windup' now; the sound follows so that it swells into the release. */
export function startWindup(ctx: HostileCtx, m: Mob, spec: HostileSpec): void {
  const h = m.hostile!;
  h.mode = 'windup';
  h.windS = 0;
  h.windSfx = false;
  h.periodS = 0;
  ctx.bus.emit('hostile:windup', { id: m.id, species: m.spec.key, attack: spec.attack, x: m.x, y: m.y, z: m.z, durationS: spec.windupS });
  windupSound(ctx, m, spec);
}

/** Plays the wind-up sound once the wind-up is WINDUP_SOUND_S from its release (at once for short wind-ups). */
export function windupSound(ctx: HostileCtx, m: Mob, spec: HostileSpec): void {
  const h = m.hostile!;
  if (h.windSfx || h.windS < spec.windupS - WINDUP_SOUND_S) return;
  h.windSfx = true;
  ctx.bus.emit('sfx', { name: 'automaton_windup', x: m.x, y: m.y + muzzleHeight(m), z: m.z, pitch: voicePitch(m.spec) });
}

/** The wind-up ended: release the attack and judge it against where the player is now. */
export function release(ctx: HostileCtx, m: Mob, spec: HostileSpec): void {
  const h = m.hostile!;
  const p = ctx.player;
  const my = m.y + muzzleHeight(m);
  ctx.bus.emit('hostile:attack', { id: m.id, species: m.spec.key, attack: spec.attack, x: m.x, y: m.y, z: m.z });
  h.mode = 'chase';
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  const hd = Math.hypot(dx, dz);
  const dy = p.y - m.y;
  const pcy = p.y + PLAYER_HEIGHT / 2;
  switch (spec.attack) {
    case 'melee': {
      sound(ctx, m, 'automaton_attack');
      const facing = Math.abs(angleDiff(m.yaw, yawTowards(dx, dz))) <= MELEE_HALF_ARC;
      if (!ctx.playerSafe && edgeGap(m, hd) <= spec.range && levelWith(m, dy) && facing) {
        ctx.hurtPlayer(m, spec, 1, dx, dz, spec.knockback ?? DEFAULT_KNOCK, m.x, my, m.z);
      }
      return;
    }
    case 'slam':
      sound(ctx, m, 'automaton_attack');
      if (!ctx.playerSafe && hd <= spec.range + PLAYER_HALF && dy > -1.5 && dy < 2) {
        ctx.hurtPlayer(m, spec, 1, dx, dz, spec.knockback ?? DEFAULT_KNOCK, m.x, my, m.z);
      }
      return;
    case 'zap': {
      sound(ctx, m, 'arc_zap');
      const dist = Math.hypot(dx, pcy - my, dz);
      if (!ctx.playerSafe && dist <= spec.range && lineClear(ctx.world, m.x, my, m.z, p.x, pcy, p.z, 'solid')) {
        ctx.hurtPlayer(m, spec, ctx.playerWet ? (spec.wetMult ?? 1) : 1, dx, dz, spec.knockback ?? 0, m.x, my, m.z);
      }
      return;
    }
    case 'bolt': {
      if (ctx.playerSafe) return;
      sound(ctx, m, 'ember_bolt');
      // Out of the mouth, half a block in front of the kiln.
      const fx = -Math.sin(m.yaw);
      const fz = -Math.cos(m.yaw);
      const ox = m.x + fx * (halfWidth(m) + 0.2);
      const oz = m.z + fz * (halfWidth(m) + 0.2);
      const v = aimLob(ox, my, oz, p.x, pcy, p.z, spec.projectileSpeed ?? 12, EMBER_BOLT_GRAVITY, LAUNCH);
      ctx.fireBolt(m, spec, ox, my, oz, v[0], v[1], v[2]);
      return;
    }
    case 'dash': {
      sound(ctx, m, 'automaton_attack');
      const d = hd > 1e-3 ? hd : 1;
      h.mode = 'dash';
      h.dashX = hd > 1e-3 ? dx / d : -Math.sin(m.yaw);
      h.dashZ = hd > 1e-3 ? dz / d : -Math.cos(m.yaw);
      h.dashLeft = hd + HOSTILE_DASH_OVERRUN;
      h.dashHit = false;
    }
  }
}
const LAUNCH = [0, 0, 0];

/** A dash in progress touches the player: hits once, along the charge. */
export function dashContact(ctx: HostileCtx, m: Mob, spec: HostileSpec): void {
  const h = m.hostile!;
  if (h.dashHit || ctx.playerSafe) return;
  const p = ctx.player;
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  if (Math.hypot(dx, dz) > halfWidth(m) + PLAYER_HALF + 0.2 || !levelWith(m, p.y - m.y)) return;
  h.dashHit = true;
  ctx.hurtPlayer(m, spec, 1, h.dashX, h.dashZ, spec.knockback ?? DEFAULT_KNOCK, m.x, m.y + muzzleHeight(m), m.z);
}

function sound(ctx: HostileCtx, m: Mob, name: 'automaton_attack' | 'arc_zap' | 'ember_bolt'): void {
  ctx.bus.emit('sfx', { name, x: m.x, y: m.y + muzzleHeight(m), z: m.z, pitch: name === 'automaton_attack' ? voicePitch(m.spec) : 1 });
}

/** Knockback velocity for a landed hit of strength `knock` along (dx, dz) (normalised here). */
export function knockVector(dx: number, dz: number, knock: number, out: number[]): number[] {
  const d = Math.hypot(dx, dz) || 1;
  out[0] = (dx / d) * knock;
  out[1] = knock > 0 ? KNOCK_LIFT : 0;
  out[2] = (dz / d) * knock;
  return out;
}
