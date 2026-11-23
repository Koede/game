/**
 * Linkage kinematics (docs/MECHANICS_PLAN.md 2.6). Pure. The render system's part-and-track animation reads these poses (crank turns, the rod
 * follows, the slider runs along its track); the workshop reads `strokeLoad` for the pulsed load a ram puts on a shaft.
 */

export interface SliderCrank { crank: number; rod: number }

/** Slider position along its track for crank angle `theta` (radians, 0 = slider furthest out). rod must be >= crank. */
export function sliderPos(g: SliderCrank, theta: number): number {
  const s = g.crank * Math.sin(theta);
  return g.crank * Math.cos(theta) + Math.sqrt(Math.max(0, g.rod * g.rod - s * s));
}

/** d position / d theta (blocks per radian). */
export function sliderRate(g: SliderCrank, theta: number): number {
  const s = Math.sin(theta);
  const root = Math.sqrt(Math.max(1e-9, g.rod * g.rod - g.crank * g.crank * s * s));
  return -g.crank * s - (g.crank * g.crank * s * Math.cos(theta)) / root;
}

/** Stroke length: position range over one turn. */
export const sliderStroke = (g: SliderCrank): number => sliderPos(g, 0) - sliderPos(g, Math.PI);

/** Slider position 0 (retracted) .. 1 (extended) at a phase in turns. */
export function sliderPhase(g: SliderCrank, phase: number): number {
  const lo = sliderPos(g, Math.PI);
  return (sliderPos(g, phase * Math.PI * 2) - lo) / (sliderPos(g, 0) - lo);
}

/** Pose of the three joints (crank pin, slider) for a render: crank pin at (r cos, r sin), slider on the x axis. */
export function sliderPose(g: SliderCrank, theta: number): { pin: [number, number]; slider: [number, number] } {
  return { pin: [g.crank * Math.cos(theta), g.crank * Math.sin(theta)], slider: [sliderPos(g, theta), 0] };
}

/**
 * Shaft torque a ram needs, as a multiple of its mean, over one turn at `phase` (turns, 0 = fully out). The ram resists only while pushing inward through
 * the last `workFraction` of the stroke (a press closing, a saw biting); torque = force x |d slider / d theta| (zero at the dead centres). Normalised so
 * the mean over a turn is 1, so `pulse = strokeLoad - 1` is the fractional pulse a network sees on average load 1.
 */
export function strokeLoad(g: SliderCrank, phase: number, workFraction = 0.35): number {
  const lo = sliderPos(g, Math.PI);
  const span = sliderPos(g, 0) - lo;
  const raw = (ph: number): number => {
    const th = ph * Math.PI * 2;
    // Inward on 0..0.5 (theta 0..pi: slider going from out to in): the work zone is its last `workFraction` of travel.
    if (ph >= 0.5) return 0;
    const travelled = 1 - (sliderPos(g, th) - lo) / span;
    return travelled >= 1 - workFraction ? Math.abs(sliderRate(g, th)) : 0;
  };
  let mean = 0;
  const N = 64;
  for (let i = 0; i < N; i++) mean += raw(i / N);
  mean /= N;
  return mean <= 0 ? 1 : raw(((phase % 1) + 1) % 1) / mean;
}

/** Rack and pinion: rack travel in blocks for a pinion turned by `theta` radians, pinion radius in blocks. */
export const rackTravel = (theta: number, pinionRadius: number): number => theta * pinionRadius;

/** Scissor lift: height of a stack of `n` crossed pairs of links of length `len` at link angle alpha (radians from horizontal). */
export const scissorHeight = (n: number, len: number, alpha: number): number => n * len * Math.sin(alpha);
/** Horizontal width the stack needs at that angle. */
export const scissorWidth = (len: number, alpha: number): number => 2 * len * Math.cos(alpha);
/** Link angle for a wanted height, or null when out of reach. */
export function scissorAngle(n: number, len: number, height: number): number | null {
  const s = height / (n * len);
  return s < 0 || s > 1 ? null : Math.asin(s);
}
/** Mechanical advantage of a scissor lift driven by a horizontal screw: force up / force in = 1 / tan(alpha) per pair. */
export const scissorAdvantage = (alpha: number): number => 1 / Math.max(1e-6, Math.tan(alpha));

/** Pantograph: output point scales the input motion about a fixed pivot by `ratio` (a copier or amplifier). */
export function pantograph(pivot: readonly [number, number], input: readonly [number, number], ratio: number): [number, number] {
  return [pivot[0] + (input[0] - pivot[0]) * ratio, pivot[1] + (input[1] - pivot[1]) * ratio];
}

/** Lever: output travel and force from the arm lengths (effort arm, load arm). Travel and force trade, power is kept. */
export function lever(effortArm: number, loadArm: number, effortTravel: number, effortForce: number): { travel: number; force: number } {
  return { travel: (effortTravel * loadArm) / effortArm, force: (effortForce * effortArm) / loadArm };
}

/** One axis of a gantry: a carriage on a rail that accelerates, cruises and brakes to a target (trapezoid profile). */
export interface Axis { pos: number; vel: number }
export function stepAxis(a: Axis, target: number, dt: number, vmax = 3, acc = 6): void {
  const dist = target - a.pos;
  const dir = Math.sign(dist);
  const brakeDist = (a.vel * a.vel) / (2 * acc);
  if (Math.abs(dist) < 0.001 && Math.abs(a.vel) < 0.05) {
    a.pos = target;
    a.vel = 0;
    return;
  }
  const want = Math.abs(dist) <= brakeDist + 1e-6 && Math.sign(a.vel) === dir ? 0 : dir * vmax;
  const dv = Math.max(-acc * dt, Math.min(acc * dt, want - a.vel));
  a.vel += dv;
  const np = a.pos + a.vel * dt;
  if ((target - a.pos) * (target - np) <= 0) {
    a.pos = target;
    a.vel = 0;
  } else a.pos = np;
}
