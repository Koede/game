/**
 * The falling tree as a rigid body (docs/plans/tree-felling.md, phase 1). Pure: the only world access is the `Terrain`
 * the caller passes in, so it is tested without a world.
 *
 * The trunk and canopy are one rod in the vertical plane along the fall direction d, hinged at the stump top. Its
 * mass is spread over segments (`rodProfile`: one per trunk block, the canopy heavier above). Phases:
 *  - pivot: the stump holds the rod; it turns under gravity alone (theta'' = g M1 sin(theta) / I) from the small tip
 *    the last blow kicked, until its centre of mass drops below the pivot (theta reaches pi/2);
 *  - free: the stump lets go; the centre of mass falls ballistically and the spin stays constant;
 *  - contact: a rod point inside a solid cell is ground when the cell above is air (it is pushed up and gets an
 *    impulse with restitution RESTITUTION and Coulomb friction FRICTION), and a wall otherwise (the step is undone
 *    and the horizontal motion stopped, so the tree leans on the wall and slides down its face);
 *  - rest: once it has been nearly still on a contact for REST_HOLD_S it stays put.
 * Integration is fixed-step (STEP_S, 60 Hz, semi-implicit Euler).
 *
 * Plane coordinates: s runs along d from the pivot; h is height above the pivot (positive up). A segment at radius r
 * along the rod is at s = s_COM + (r - rc) sin(theta), h = h_COM + (r - rc) cos(theta). World: x = px + dx s,
 * z = pz + dz s, y = py + h.
 */
import { GRAVITY } from './groundItems';

/** Fixed integration step, seconds (60 Hz). */
export const STEP_S = 1 / 60;
export const RESTITUTION = 0.2;
export const FRICTION = 0.6;
/** Radius of the trunk, blocks: the rod touches the ground with its underside. */
export const ROD_RADIUS = 0.5;
/** Below this normal speed a contact does not bounce (it would jitter). */
export const BOUNCE_MIN_SPEED = 0.8;
/** A body nearly still on a contact this long (seconds) is at rest. */
export const REST_HOLD_S = 0.25;
/** Safety cap: a fall still moving after this long is put to rest where it is. */
export const MAX_FALL_S = 12;
const EPS = 1e-4;

export interface RodSegment {
  /** Distance from the pivot along the rod, blocks. */
  r: number;
  /** Mass of the segment. */
  m: number;
}

/** Trunk: one unit-mass segment per trunk block. Canopy: two heavier segments above it. */
export function rodProfile(trunk: number, canopy: number): RodSegment[] {
  const out: RodSegment[] = [];
  for (let i = 0; i < trunk; i++) out.push({ r: i + 0.5, m: 1 });
  for (let j = 0; j < canopy; j++) out.push({ r: trunk + j + 0.5, m: 2 });
  return out;
}

export interface RodInertia {
  mass: number;
  /** Distance of the centre of mass from the pivot. */
  rc: number;
  /** Moment of inertia about the pivot. */
  iPivot: number;
  /** Moment of inertia about the centre of mass (parallel axis theorem). */
  iCom: number;
  /** Sum of m r: the gravity torque factor. */
  m1: number;
}

export function rodInertia(segs: readonly RodSegment[]): RodInertia {
  let mass = 0;
  let m1 = 0;
  let iPivot = 0;
  for (const s of segs) {
    mass += s.m;
    m1 += s.m * s.r;
    iPivot += s.m * s.r * s.r;
  }
  if (mass <= 0) return { mass: 1, rc: 0, iPivot: 1, iCom: 1, m1: 0 };
  const rc = m1 / mass;
  return { mass, rc, iPivot, iCom: Math.max(EPS, iPivot - mass * rc * rc), m1 };
}

/** The world the rod falls through. */
export interface Terrain {
  /** True when the world cell holding (x, y, z) is solid (ground, wall, anything but air). */
  solidAt(x: number, y: number, z: number): boolean;
}

/** The stump pivot and the fall line. */
export interface Pivot {
  /** World x, z and height (top of the stump) of the pivot. */
  px: number;
  pz: number;
  py: number;
  /** Horizontal unit fall direction. */
  dx: number;
  dz: number;
}

export interface BodyState {
  /** Centre of mass, plane coordinates (used while free; while pivoted the COM follows from theta). */
  s: number;
  h: number;
  vs: number;
  vh: number;
  /** Angle of the rod from vertical, towards d (0 upright, pi/2 flat along d). */
  theta: number;
  /** Spin, radians per second. */
  omega: number;
  /** True while the stump holds the rod. */
  pivoted: boolean;
  /** Seconds since the body began to move. */
  t: number;
  /** Seconds it has been nearly still on a contact. */
  settleS: number;
  /** Something touches the ground or a wall right now. */
  touching: boolean;
  /** At rest: no further integration changes it. */
  rest: boolean;
  /** Speed of the fastest point at the first contact, blocks per second (0 before any contact). */
  impactSpeed: number;
  /** Body time of the first contact, seconds; -1 before it. */
  landedAt: number;
}

/** The rod at its start: upright with a tiny lean, the tip kicked by the last blow (omega, rad/s). */
export function initialBody(lean = 0.02, tipOmega = 0.3): BodyState {
  return {
    s: 0, h: 0, vs: 0, vh: 0, theta: lean, omega: tipOmega,
    pivoted: true, t: 0, settleS: 0, touching: false, rest: false, impactSpeed: 0, landedAt: -1,
  };
}

/** Centre of mass in plane coordinates. */
export function comOf(b: BodyState, inertia: RodInertia): { s: number; h: number } {
  return b.pivoted ? { s: inertia.rc * Math.sin(b.theta), h: inertia.rc * Math.cos(b.theta) } : { s: b.s, h: b.h };
}

/** Plane position and velocity of the rod point at radius r. */
export function pointOf(b: BodyState, inertia: RodInertia, r: number): { s: number; h: number; vs: number; vh: number } {
  const c = comOf(b, inertia);
  const cv = b.pivoted
    ? { vs: inertia.rc * b.omega * Math.cos(b.theta), vh: -inertia.rc * b.omega * Math.sin(b.theta) }
    : { vs: b.vs, vh: b.vh };
  const k = r - inertia.rc;
  const sn = Math.sin(b.theta);
  const cs = Math.cos(b.theta);
  return { s: c.s + k * sn, h: c.h + k * cs, vs: cv.vs + k * b.omega * cs, vh: cv.vh - k * b.omega * sn };
}

/** World position of a plane point. */
export function toWorld(p: Pivot, s: number, h: number): { x: number; y: number; z: number } {
  return { x: p.px + p.dx * s, y: p.py + h, z: p.pz + p.dz * s };
}

/** World position of the pivot-relative rod point at radius r, for drawing and damage. */
export function worldPointOf(b: BodyState, inertia: RodInertia, pivot: Pivot, r: number): { x: number; y: number; z: number; speed: number } {
  const p = pointOf(b, inertia, r);
  const w = toWorld(pivot, p.s, p.h);
  return { ...w, speed: Math.hypot(p.vs, p.vh) };
}

/** Advances the body one fixed step (pure: returns the new state; a rested body is returned as it is). */
export function stepBody(b0: BodyState, segs: readonly RodSegment[], inertia: RodInertia, pivot: Pivot, terrain: Terrain, dt: number = STEP_S): BodyState {
  if (b0.rest) return b0;
  const b: BodyState = { ...b0, t: b0.t + dt };
  if (b.pivoted) {
    // Pivot phase: gravity turns the rod about the stump.
    const acc = (GRAVITY * inertia.m1 * Math.sin(b.theta)) / inertia.iPivot;
    b.omega += acc * dt;
    b.theta += b.omega * dt;
    if (Math.cos(b.theta) <= 0) {
      // The centre of mass has gone below the stump: the rod comes off it with the velocity it has.
      b.s = inertia.rc * Math.sin(b.theta);
      b.h = inertia.rc * Math.cos(b.theta);
      b.vs = inertia.rc * b.omega * Math.cos(b.theta);
      b.vh = -inertia.rc * b.omega * Math.sin(b.theta);
      b.pivoted = false;
    }
  } else {
    // Free phase: ballistic centre of mass, constant spin.
    b.vh -= GRAVITY * dt;
    b.s += b.vs * dt;
    b.h += b.vh * dt;
    b.theta += b.omega * dt;
  }
  return resolve(b, segs, inertia, pivot, terrain, dt);
}

/** Contacts with the terrain: pushes out, impulses, friction; then the rest check. */
function resolve(b: BodyState, segs: readonly RodSegment[], inertia: RodInertia, pivot: Pivot, terrain: Terrain, dt: number): BodyState {
  let touching = false;
  let fastest = 0;
  for (let pass = 0; pass < 4; pass++) {
    let contact: { r: number; pen: number; wall: boolean } | null = null;
    for (const seg of segs) {
      const p = pointOf(b, inertia, seg.r);
      const w = toWorld(pivot, p.s, p.h);
      // The rod has a radius: the probe is its underside, so a trunk lying flat sits ROD_RADIUS above the ground.
      const probeY = w.y - ROD_RADIUS;
      const fx = Math.floor(w.x);
      const fy = Math.floor(probeY);
      const fz = Math.floor(w.z);
      if (!terrain.solidAt(fx, fy, fz)) continue;
      // Inside a solid cell: a wall if the cell above is solid too, else the top of the ground (push up to its top).
      const wall = terrain.solidAt(fx, fy + 1, fz);
      const pen = wall ? 0 : fy + 1 - probeY;
      if (!contact || (wall && !contact.wall) || (wall === contact.wall && pen > contact.pen)) contact = { r: seg.r, pen, wall };
    }
    if (!contact) break;
    touching = true;
    if (b.pivoted) {
      // The stump holds it against the contact: the tree leans on it and stays.
      b.rest = true;
      break;
    }
    if (contact.wall) {
      // Undo the step, stop the horizontal motion and the spin into the wall: the tree slides down the face.
      b.s -= b.vs * dt;
      b.theta -= b.omega * dt;
      b.vs = 0;
      b.omega *= -0.2;
      continue;
    }
    // Ground: impulse at the contact point along the vertical, then Coulomb friction along s.
    const com = comOf(b, inertia);
    const p = pointOf(b, inertia, contact.r);
    const aS = p.s - com.s;
    const aH = p.h - com.h;
    fastest = Math.max(fastest, Math.hypot(p.vs, p.vh));
    b.h += contact.pen;
    const vn = p.vh;
    let jn = 0;
    if (vn < 0) {
      const e = -vn > BOUNCE_MIN_SPEED ? RESTITUTION : 0;
      jn = (-(1 + e) * vn) / (1 / inertia.mass + (aS * aS) / inertia.iCom);
      b.vh += jn / inertia.mass;
      b.omega += (-aS * jn) / inertia.iCom;
    }
    const after = pointOf(b, inertia, contact.r);
    const jtNeeded = -after.vs / (1 / inertia.mass + (aH * aH) / inertia.iCom);
    const jMax = FRICTION * jn;
    const jt = Math.max(-jMax, Math.min(jMax, jtNeeded));
    b.vs += jt / inertia.mass;
    b.omega += (aH * jt) / inertia.iCom;
  }
  b.touching = touching;
  if (touching && b.landedAt < 0) {
    b.landedAt = b.t;
    b.impactSpeed = fastest;
  }
  if (touching && !b.pivoted) {
    // One step of gravity alone adds about g/60 to the fall speed, so 'still' allows for that jitter on a contact.
    const still = Math.hypot(b.vs, b.vh) < 0.6 && Math.abs(b.omega) < 0.5;
    b.settleS = still ? b.settleS + dt : 0;
    if (b.settleS >= REST_HOLD_S || b.t >= MAX_FALL_S) {
      b.rest = true;
      b.vs = 0;
      b.vh = 0;
      b.omega = 0;
    }
  }
  return b;
}

/**
 * Runs the fall with fixed steps until it rests (or `maxS` passes). `onStep` sees every state, for the sweep damage.
 * Returns the final state.
 */
export function runFall(b0: BodyState, segs: readonly RodSegment[], pivot: Pivot, terrain: Terrain, onStep?: (b: BodyState) => void, maxS = MAX_FALL_S + 1): BodyState {
  const inertia = rodInertia(segs);
  let b = b0;
  const steps = Math.ceil(maxS / STEP_S);
  for (let n = 0; n < steps && !b.rest; n++) {
    b = stepBody(b, segs, inertia, pivot, terrain, STEP_S);
    onStep?.(b);
  }
  return b;
}

/** The rod's pivot (world position) and angle: what the renderer needs to draw the body at this state. */
export function poseOf(b: BodyState, inertia: RodInertia, pivot: Pivot): { ox: number; oy: number; oz: number; theta: number } {
  const c = comOf(b, inertia);
  const os = c.s - inertia.rc * Math.sin(b.theta);
  const oh = c.h - inertia.rc * Math.cos(b.theta);
  return { ox: pivot.px + pivot.dx * os, oy: pivot.py + oh, oz: pivot.pz + pivot.dz * os, theta: b.theta };
}
