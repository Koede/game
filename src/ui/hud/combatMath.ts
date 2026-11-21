/**
 * DOM-free numbers behind the HUD's Emberbound cues (spec 19.5): the creature under the crosshair, whether a world
 * point is on screen, which way an edge arrow points and where on the screen edge it sits, the wind-ups still
 * worth warning about, and the fading directional damage pulses.
 */
import { AUTOMATONS } from '../../core/registry';
import type { HostileAttack } from '../../core/types';
import { relativeBearing } from './hudMath';

/** A creature under the crosshair as the HUD shows it: "Forge Warden" and its health bar. */
export interface TargetInfo {
  name: string;
  health: number;
  max: number;
  /** An automaton (red plate and bar), not an animal. */
  hostile: boolean;
}

const AUTOMATON_NAMES = new Set(AUTOMATONS.map((s) => s.name));
const DESCRIBED = /^(.*\S)\s+-\s+(\d+)\/(\d+)$/;

/**
 * Reads the mob manager's `describe` text ("Forge Warden - 9/16", "Young Boar - 3/10"), which is what the app
 * hands to `GameUI.setTargetName`. Null for anything else (a plain name is shown as it is, without a bar).
 */
export function parseTargetName(text: string | null): TargetInfo | null {
  if (text === null) return null;
  const m = DESCRIBED.exec(text.trim());
  if (!m) return null;
  const max = Number(m[3]);
  if (!(max > 0)) return null;
  const name = m[1];
  return { name, health: Math.min(max, Number(m[2])), max, hostile: AUTOMATON_NAMES.has(name.replace(/^Young /, '')) };
}

/** Where the camera is and how it looks: eye position, yaw / pitch (game convention), vertical FOV, width / height. */
export interface ViewPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  fovDeg: number;
  aspect: number;
}

/** A point in camera space: `right` and `up` across the view, `forward` along it (blocks). */
export interface ViewPoint {
  right: number;
  up: number;
  forward: number;
}

/** Camera-space coordinates of a world point. Yaw 0 looks north (-Z), positive turns left; pitch positive looks up. */
export function toView(p: ViewPose, tx: number, ty: number, tz: number, out: ViewPoint = { right: 0, up: 0, forward: 0 }): ViewPoint {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dz = tz - p.z;
  const sy = Math.sin(p.yaw);
  const cy = Math.cos(p.yaw);
  const sp = Math.sin(p.pitch);
  const cp = Math.cos(p.pitch);
  // forward = (-sin yaw cos pitch, sin pitch, -cos yaw cos pitch); right = (cos yaw, 0, -sin yaw); up = right x forward.
  out.forward = -sy * cp * dx + sp * dy - cy * cp * dz;
  out.right = cy * dx - sy * dz;
  out.up = sy * sp * dx + cp * dy + cy * sp * dz;
  return out;
}

const scratch: ViewPoint = { right: 0, up: 0, forward: 0 };

/**
 * The point is inside the view, `margin` of the way out to the screen edges (0.85 = the inner 85%): an arrow is only
 * needed for what the player could miss.
 */
export function inView(p: ViewPose, tx: number, ty: number, tz: number, margin = 0.85): boolean {
  const v = toView(p, tx, ty, tz, scratch);
  if (v.forward <= 0.05) return false;
  const tanV = Math.tan((p.fovDeg * Math.PI) / 360);
  const tanH = tanV * p.aspect;
  return Math.abs(v.right / v.forward) <= tanH * margin && Math.abs(v.up / v.forward) <= tanV * margin;
}

/**
 * Which way on the screen an arrow towards the point should face, in radians clockwise from straight up (0 up,
 * PI/2 right, PI down). In front of the player it follows the projection (a drone overhead points up); behind
 * them it follows the bearing on the ground, so something right behind points down.
 */
export function screenAngle(p: ViewPose, tx: number, ty: number, tz: number): number {
  const v = toView(p, tx, ty, tz, scratch);
  if (v.forward > 0.05) {
    const tanV = Math.tan((p.fovDeg * Math.PI) / 360);
    const nx = v.right / (v.forward * tanV * p.aspect);
    const ny = v.up / (v.forward * tanV);
    return Math.atan2(nx, ny);
  }
  return Math.atan2(v.right, v.forward);
}

/** The free part of the screen an edge arrow may use (px, viewport coordinates). */
export interface EdgeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where a ray from the rectangle's centre at `angle` (clockwise from up) leaves it. */
export function edgePoint(angle: number, r: EdgeRect, out: { x: number; y: number } = { x: 0, y: 0 }): { x: number; y: number } {
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const hw = Math.max(0, (r.right - r.left) / 2);
  const hh = Math.max(0, (r.bottom - r.top) / 2);
  const tx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  out.x = cx + dx * t;
  out.y = cy + dy * t;
  return out;
}

/** A wind-up the HUD may warn about. */
export interface Danger {
  id: number;
  species: string;
  attack: HostileAttack;
  x: number;
  y: number;
  z: number;
  /** Clock (s) after which it is no longer worth showing. */
  until: number;
  /** The attack was released: the warning fades out. */
  released: boolean;
}

/** A warning lingers this long after the release (the blow lands or the bolt flies). */
export const DANGER_AFTER_S = 0.45;
/** At most this many warnings at once (the nearest-in-time win). */
export const MAX_DANGERS = 4;

/**
 * The wind-ups in progress ('hostile:windup' -> 'hostile:attack'), each until DANGER_AFTER_S after its release or
 * its wind-up time plus that if no release is heard. Times are the caller's clock in seconds.
 */
export class Dangers {
  readonly list: Danger[] = [];

  windup(id: number, species: string, attack: HostileAttack, x: number, y: number, z: number, durationS: number, now: number): void {
    let d = this.list.find((e) => e.id === id);
    if (!d) {
      if (this.list.length >= MAX_DANGERS) {
        // Drop the one that ends first: a new telegraph matters more than one about to land.
        let first = 0;
        for (let i = 1; i < this.list.length; i++) if (this.list[i].until < this.list[first].until) first = i;
        this.list.splice(first, 1);
      }
      d = { id, species, attack, x, y, z, until: 0, released: false };
      this.list.push(d);
    }
    d.species = species;
    d.attack = attack;
    d.x = x;
    d.y = y;
    d.z = z;
    d.released = false;
    d.until = now + durationS + DANGER_AFTER_S;
  }

  /** The attack was released: keep the warning a moment longer, then let it go. */
  release(id: number, now: number): void {
    const d = this.list.find((e) => e.id === id);
    if (!d) return;
    d.released = true;
    d.until = Math.min(d.until, now + DANGER_AFTER_S);
  }

  /** The automaton is gone (broken apart, despawned). */
  remove(id: number): void {
    const i = this.list.findIndex((e) => e.id === id);
    if (i >= 0) this.list.splice(i, 1);
  }

  /** Drops what has run out. */
  prune(now: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].until <= now) this.list.splice(i, 1);
  }

  clear(): void {
    this.list.length = 0;
  }
}

/** A directional damage pulse: where the blow came from and how hard. */
export interface HitPulse {
  x: number;
  z: number;
  /** Clock (s) when it landed. */
  at: number;
  /** 0..1 peak opacity. */
  strength: number;
}

export const HIT_PULSE_S = 1.1;
export const MAX_HIT_PULSES = 3;

/** Peak opacity of the pulse for a hit of `amount` (after difficulty): a light bite reads, a slam reads loud. */
export const hitStrength = (amount: number): number => Math.min(1, 0.5 + amount * 0.09);

/** Opacity of a pulse `age` seconds after it landed: a quick swell, then a slow fade (0 once over). */
export function pulseOpacity(strength: number, age: number): number {
  if (age < 0 || age >= HIT_PULSE_S) return 0;
  const rise = 0.08;
  if (age < rise) return strength * (age / rise);
  const t = (age - rise) / (HIT_PULSE_S - rise);
  return strength * (1 - t) * (1 - t);
}

/** Rotation (degrees, clockwise from up) of the pulse towards an attacker at x,z for a player at px,pz looking `yaw`. */
export const pulseDegrees = (px: number, pz: number, yaw: number, x: number, z: number): number =>
  (relativeBearing(px, pz, yaw, x, z) * 180) / Math.PI;
