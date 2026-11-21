/**
 * How an automaton holds itself this frame (spec 19.5), from its render view and a little remembered state: arms
 * raised through a wind-up and swung on the release (a warden's hammer, a colossus's two fists), a hound's crouch
 * before its dash, a mite rearing to bite, a sentry's kiln turning on its fixed tripod and kicking as it fires, a drone
 * bobbing with its coil spinning up, a dormant one slumped. Pure (no THREE, no DOM), allocation-free.
 */
import type { CreatureSpec, HostileAttack } from '../../core/types';

/** The six ways an automaton moves, worked out from its HostileSpec and model. */
export type PoseStyle = 'hammer' | 'bite' | 'dash' | 'turret' | 'hover' | 'slam';

export function poseStyle(spec: CreatureSpec): PoseStyle {
  const h = spec.hostile;
  if (!h) return 'bite';
  if (h.stationary) return 'turret';
  if (h.flying) return 'hover';
  if (h.attack === 'slam') return 'slam';
  if (h.attack === 'dash') return 'dash';
  return spec.model.some((p) => p.anim === 'armR') ? 'hammer' : 'bite';
}

/** What a pose reads from the automaton's view (src/mobs' MobView fits). */
export interface PoseView {
  id: number;
  yaw: number;
  stride: number;
  glow: number;
  flare: number;
  attack: HostileAttack | null;
  dormant: boolean;
}

/** Remembered per automaton between frames (owned by the caller, one per id). */
export interface PoseMemory {
  /** Seconds since the last attack release ('hostile:attack'); Infinity before any. */
  sinceAttack: number;
  /** Yaw the sentry's tripod stands at (its first seen yaw); NaN until seen. */
  baseYaw: number;
  /** Arm angles as drawn (eased towards the target). */
  armL: number;
  armR: number;
  /** Accumulated spin of a drone's coil, radians. */
  spin: number;
}

export interface Pose {
  /** Body yaw, nose pitch (positive lifts the nose), vertical squash (1 = none), lift in blocks. */
  yaw: number;
  pitch: number;
  squash: number;
  lift: number;
  /** Head pitch (positive raises the front) and head turn about the vertical (relative to the body). */
  headPitch: number;
  headTurn: number;
  /** Arm angles about the shoulder (positive swings the hand forward and up; ~2.6 is overhead). */
  armL: number;
  armR: number;
  /** Ember glow 0 (dark) .. 1, and the flare 0..1 on top of it. */
  ember: number;
  flare: number;
}

export const newPoseMemory = (): PoseMemory => ({ sinceAttack: Infinity, baseYaw: NaN, armL: 0, armR: 0, spin: 0 });
export const newPose = (): Pose => ({ yaw: 0, pitch: 0, squash: 1, lift: 0, headPitch: 0, headTurn: 0, armL: 0, armR: 0, ember: 0, flare: 0 });

/** Hammer overhead at the end of a wind-up, and where the blow ends. */
export const HAMMER_RAISE = 2.55;
const HAMMER_STRIKE = 1.0;
/** Both fists overhead before a slam, and down at the ground after it. */
export const SLAM_RAISE = 2.85;
const SLAM_DOWN = 0.25;
/** Seconds: the blow comes down, holds, and the arm settles back. */
const STRIKE_S = 0.1;
const HOLD_S = 0.18;
const SETTLE_S = 0.5;
/** How long the flash of a release lasts (ember parts burst brighter as the blow lands or the bolt leaves). */
const RELEASE_FLASH_S = 0.3;
/** Arms follow their target with this rate (1/s): quick enough for a blow, never a snap. */
const ARM_RATE = 22;
/** Walking arm swing as a share of the leg swing. */
const ARM_WALK = 0.45;

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Signed shortest turn from a to b, radians. */
export function turnBetween(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Angle of a swung arm `t` seconds after the release, from `raised` down to `down` and back to rest. */
export function swingAngle(t: number, raised: number, down: number): number {
  if (t < STRIKE_S) return raised + (down - raised) * smooth(t / STRIKE_S);
  if (t < STRIKE_S + HOLD_S) return down;
  return down * (1 - smooth((t - STRIKE_S - HOLD_S) / SETTLE_S));
}

/** Seconds a swing takes from release to rest. */
export const SWING_S = STRIKE_S + HOLD_S + SETTLE_S;

/**
 * Fills `out` with the automaton's pose. `legSwing` is the leg angle the walk gives (arms counter-swing it), `time`
 * a running clock (seconds), `dt` this frame's step (0 while paused: nothing eases).
 */
export function automatonPose(style: PoseStyle, v: PoseView, mem: PoseMemory, legSwing: number, time: number, dt: number, out: Pose): Pose {
  const flare = v.flare;
  const since = mem.sinceAttack;
  const released = since < RELEASE_FLASH_S ? 1 - since / RELEASE_FLASH_S : 0;
  out.yaw = v.yaw;
  out.pitch = 0;
  out.squash = 1;
  out.lift = 0;
  out.headPitch = 0;
  out.headTurn = 0;
  out.ember = v.glow;
  out.flare = Math.max(flare, released);
  // Slumped when dormant: the head sinks as the glow dies.
  const slump = v.dormant ? 1 - v.glow : 0;
  let armL = legSwing * ARM_WALK;
  let armR = -legSwing * ARM_WALK;
  const swinging = since < SWING_S;

  switch (style) {
    case 'hammer':
      if (v.attack === 'melee') {
        armR = HAMMER_RAISE * smooth(flare);
        armL = 0.45 * flare;
      } else if (swinging) {
        armR = swingAngle(since, HAMMER_RAISE, HAMMER_STRIKE);
        armL = 0.45;
        out.pitch = -0.06 * (since < STRIKE_S + HOLD_S ? 1 : 0);
      }
      out.headPitch = -0.3 * slump;
      break;
    case 'slam':
      if (v.attack === 'slam') {
        armL = armR = SLAM_RAISE * smooth(flare);
        out.pitch = 0.07 * flare;
      } else if (swinging) {
        armL = armR = swingAngle(since, SLAM_RAISE, SLAM_DOWN);
        const impact = since > STRIKE_S * 0.8 && since < STRIKE_S + HOLD_S + 0.1 ? 1 : 0;
        out.squash = 1 - 0.07 * impact;
        out.pitch = -0.08 * impact;
      }
      out.headPitch = -0.3 * slump;
      break;
    case 'bite':
      if (v.attack === 'melee') {
        out.headPitch = 0.42 * smooth(flare);
        out.pitch = 0.1 * flare;
      } else if (since < 0.25) out.headPitch = -0.35 * (1 - since / 0.25);
      else out.headPitch = -0.25 * slump;
      break;
    case 'dash': {
      // Crouched while it draws breath (standing still); stretched low while the charge runs.
      const running = Math.min(1, v.stride * 2);
      if (v.attack === 'dash') {
        const crouch = flare * (1 - running);
        out.squash = 1 - 0.22 * crouch;
        out.pitch = -0.1 * crouch - 0.08 * running;
        out.headPitch = -0.22 * crouch;
        // Bellows: the ribs breathe in as it crouches.
        out.flare = Math.max(released, flare * (0.8 + 0.2 * Math.sin(time * 15)));
      } else out.headPitch = -0.3 * slump;
      break;
    }
    case 'turret': {
      if (Number.isNaN(mem.baseYaw)) mem.baseYaw = v.yaw;
      out.yaw = mem.baseYaw;
      out.headTurn = turnBetween(mem.baseYaw, v.yaw);
      const recoil = since < 0.35 ? 1 - since / 0.35 : 0;
      out.headPitch = 0.16 * smooth(flare) + 0.24 * recoil - 0.12 * slump;
      out.squash = 1 - 0.05 * recoil;
      break;
    }
    case 'hover': {
      out.lift = v.dormant ? 0 : Math.sin(time * 2.3 + v.id * 1.7) * 0.07 * (1 - slump);
      out.pitch = -0.14 * v.stride;
      out.yaw = v.yaw + Math.sin(time * 31 + v.id) * 0.05 * flare;
      mem.spin = (mem.spin + dt * (0.8 + 22 * flare) * (1 - slump)) % (Math.PI * 2);
      out.headTurn = mem.spin;
      break;
    }
  }
  const k = Math.min(1, dt * ARM_RATE);
  mem.armL += (armL - mem.armL) * k;
  mem.armR += (armR - mem.armR) * k;
  out.armL = mem.armL;
  out.armR = mem.armR;
  if (dt > 0 && since !== Infinity) mem.sinceAttack = since + dt;
  return out;
}
