/**
 * Part-and-track animation (Oritech / Create style): a model is a tree of named rigid PARTS, each with a pivot and a
 * list of data-driven TRACKS (spin, oscillate, ramp, scale). `evalParts` turns the tree plus a MotionState into one
 * matrix per part; the renderer skins the model's vertices rigidly by part index (see shaders.ts PARTS_GLSL), so a whole
 * machine is still one draw call. Pure (no three.js): node-testable and reusable by any renderer that has a model.
 *
 * Track kinds (all about the part's pivot, in the model frame, parent-relative):
 *   spin   rotate about `axis` at `rate` rad/s x motion.speed (the angle is integrated, so spin-up and coast-down are smooth)
 *   osc    translate along `dir` by sin(2*pi*cycles) x `amp` x (floor + (1 - floor) x speed): pistons, pumping arms, bellows
 *   ramp   translate along `dir` by `amount` x ease(motion.level): lowering electrodes, extending arms, doors sliding
 *   swing  rotate about `axis` by `amount` rad x ease(motion.level): lids, doors, levers opening
 *   scale  scale along `axis` about the pivot by 1 + `amount` x ease(motion.level): stretching shafts, bellows
 * Tracks of a part stack in order; a child's matrix is composed on its parent's.
 */
export type V3 = readonly [number, number, number];
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'sine' | 'back';

export type Track =
  | { type: 'spin'; axis: V3; rate: number; phase?: number }
  | { type: 'osc'; dir: V3; amp: number; hz: number; phase?: number; floor?: number }
  | { type: 'ramp'; dir: V3; amount: number; ease?: Ease }
  | { type: 'swing'; axis: V3; amount: number; ease?: Ease }
  | { type: 'scale'; axis: V3; amount: number; ease?: Ease };

export interface PartDef {
  name: string;
  /** Index of the parent part, or -1 (rooted on the static model). Parents come before their children. */
  parent: number;
  pivot: V3;
  tracks: Track[];
}

/** The four states of a machine's motion. */
export const enum Phase {
  Idle = 0,
  Starting = 1,
  Running = 2,
  Stopping = 3,
}

/** What the tracks read. `speed` and `level` are 0..1; `angle` and `cycles` are integrated by MotionState. */
export interface Motion {
  speed: number;
  level: number;
  /** Radians per unit `rate` accumulated so far (spin tracks use angle x rate). */
  angle: number;
  /** Oscillation cycles accumulated so far (osc tracks use cycles x hz). */
  cycles: number;
  phase: Phase;
}

export const newMotion = (): Motion => ({ speed: 0, level: 0, angle: 0, cycles: 0, phase: Phase.Idle });

export const EASES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  // Overshoots a little and settles: a door or lever that clunks open.
  back: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};
const ease = (e: Ease | undefined, t: number): number => EASES[e ?? 'sine'](Math.min(1, Math.max(0, t)));

/** Time constants (seconds) of the motion envelope. */
export interface MotionTiming {
  /** Speed climbs towards the target with this time constant when starting. */
  spinUp: number;
  /** ... and falls with this one when stopping (a flywheel coasts: use a long one). */
  coast: number;
  /** `level` (doors, electrodes) follows the target with this one. */
  settle: number;
}
export const DEFAULT_TIMING: MotionTiming = { spinUp: 1.1, coast: 2.4, settle: 0.7 };

/**
 * Advances a motion towards `target` (0..1: the machine's real speed / load, e.g. rpm / max, temperature / working
 * temperature, 1 while crucibles work). Idle and Running are the rest states; Starting and Stopping while it changes.
 */
export function stepMotion(m: Motion, dt: number, target: number, timing: MotionTiming = DEFAULT_TIMING): void {
  const up = target > m.speed;
  const tc = up ? timing.spinUp : timing.coast;
  m.speed += (target - m.speed) * (1 - Math.exp(-dt / Math.max(1e-3, tc)));
  if (Math.abs(target - m.speed) < 0.002) m.speed = target;
  m.level += (target - m.level) * (1 - Math.exp(-dt / Math.max(1e-3, timing.settle)));
  if (Math.abs(target - m.level) < 0.002) m.level = target;
  m.angle += m.speed * dt;
  m.cycles += m.speed * dt;
  m.phase = target > 0 ? (m.speed >= target - 0.01 ? Phase.Running : Phase.Starting) : m.speed > 0 ? Phase.Stopping : Phase.Idle;
}

// ---- matrices (column-major mat4 in a Float32Array, like three.js) -------------------------------------------------

export const MAX_PARTS = 24;
const TAU = Math.PI * 2;

function identity(o: Float32Array, at: number): void {
  for (let i = 0; i < 16; i++) o[at + i] = i % 5 === 0 ? 1 : 0;
}

const tmp = new Float32Array(16);
function mul(out: Float32Array, oAt: number, a: Float32Array, aAt: number, b: Float32Array, bAt: number): void {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[aAt + k * 4 + r] * b[bAt + c * 4 + k];
      tmp[c * 4 + r] = s;
    }
  }
  for (let i = 0; i < 16; i++) out[oAt + i] = tmp[i];
}

/** Local matrix of one part: translations, rotations and scales of its tracks about its pivot. */
function localMatrix(def: PartDef, m: Motion, o: Float32Array): void {
  // Accumulate as: p' = T(pivot + offset) * R * S * T(-pivot) * p
  let ox = 0, oy = 0, oz = 0;
  // Rotation matrix (3x3, row-major) and per-axis scale, built by stacking tracks.
  let r = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let sx = 1, sy = 1, sz = 1;
  for (const t of def.tracks) {
    switch (t.type) {
      case 'spin':
        r = mul3(axisAngle(t.axis, (t.phase ?? 0) + m.angle * t.rate), r);
        break;
      case 'swing':
        r = mul3(axisAngle(t.axis, t.amount * ease(t.ease, m.level)), r);
        break;
      case 'osc': {
        const f = t.floor ?? 0;
        const k = Math.sin(TAU * (m.cycles * t.hz + (t.phase ?? 0))) * t.amp * (f + (1 - f) * m.speed);
        ox += t.dir[0] * k; oy += t.dir[1] * k; oz += t.dir[2] * k;
        break;
      }
      case 'ramp': {
        const k = t.amount * ease(t.ease, m.level);
        ox += t.dir[0] * k; oy += t.dir[1] * k; oz += t.dir[2] * k;
        break;
      }
      case 'scale': {
        const k = 1 + t.amount * ease(t.ease, m.level);
        if (t.axis[0] !== 0) sx *= k;
        if (t.axis[1] !== 0) sy *= k;
        if (t.axis[2] !== 0) sz *= k;
        break;
      }
    }
  }
  const [px, py, pz] = def.pivot;
  // M = [R*S | t], t = pivot + offset - R*S*pivot.
  const a00 = r[0] * sx, a01 = r[1] * sy, a02 = r[2] * sz;
  const a10 = r[3] * sx, a11 = r[4] * sy, a12 = r[5] * sz;
  const a20 = r[6] * sx, a21 = r[7] * sy, a22 = r[8] * sz;
  o[0] = a00; o[1] = a10; o[2] = a20; o[3] = 0;
  o[4] = a01; o[5] = a11; o[6] = a21; o[7] = 0;
  o[8] = a02; o[9] = a12; o[10] = a22; o[11] = 0;
  o[12] = px + ox - (a00 * px + a01 * py + a02 * pz);
  o[13] = py + oy - (a10 * px + a11 * py + a12 * pz);
  o[14] = pz + oz - (a20 * px + a21 * py + a22 * pz);
  o[15] = 1;
}

function mul3(a: number[], b: number[]): number[] {
  const o: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  return o;
}

function axisAngle(axis: V3, a: number): number[] {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const x = axis[0] / len, y = axis[1] / len, z = axis[2] / len;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}

/**
 * Writes one mat4 per part into `out` (16 floats each, `out.length >= 16 * (parts.length + 1)`). Slot 0 is the static
 * root (identity); part i uses slot i + 1. Motions are per part index, or one shared motion for every part.
 */
export function evalParts(parts: readonly PartDef[], motion: Motion | readonly Motion[], out: Float32Array): void {
  identity(out, 0);
  for (let i = 0; i < parts.length; i++) {
    const m = Array.isArray(motion) ? (motion as readonly Motion[])[i] ?? (motion as readonly Motion[])[0] : (motion as Motion);
    const at = (i + 1) * 16;
    localMatrix(parts[i], m, out.subarray(at, at + 16) as Float32Array);
    const p = parts[i].parent;
    if (p >= 0) mul(out, at, out, (p + 1) * 16, out, at);
  }
}

/** The vertex-shader chunk that skins by part: declare `uParts` and read `aPart` (0 = static, i + 1 = part i). */
export const PARTS_GLSL = /* glsl */ `
in float aPart;
uniform mat4 uParts[${MAX_PARTS + 1}];
mat4 partMatrix() { return uParts[int(aPart + 0.5)]; }
`;
