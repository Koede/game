/**
 * Ratio algebra for gear trains (docs/MECHANICS_PLAN.md 2.2). Pure. Gearing trades speed for torque and never creates power:
 * `out.rpm x out.torque = in.rpm x in.torque x efficiency`.
 */
export interface Shaft { rpm: number; torque: number }

/** Efficiency of a plain gear mesh, and of the lossy parts. */
export const EFF = { gear: 0.97, belt: 0.94, worm: 0.55, cvt: 0.92, planetary: 0.96 } as const;

/** Output of one stage that multiplies speed by `ratio` (a negative ratio reverses). */
export function stage(input: Shaft, ratio: number, efficiency: number = EFF.gear): Shaft {
  if (ratio === 0) return { rpm: 0, torque: 0 };
  return { rpm: input.rpm * ratio, torque: (input.torque * efficiency) / ratio };
}

/** A train of stages. */
export function chain(input: Shaft, stages: readonly { ratio: number; efficiency?: number }[]): Shaft {
  let s = input;
  for (const st of stages) s = stage(s, st.ratio, st.efficiency);
  return s;
}

export const power = (s: Shaft): number => Math.abs(s.rpm * s.torque);

/**
 * Planetary set. Ports: sun, ring, carrier. `R` = ring teeth / sun teeth (> 1, typically 2-4). Kinematic law (speeds): `sun + R*ring = (1+R) carrier`.
 * Give the speeds of two ports and the third follows; `held` names a port that is locked (a brake on it) and counts as speed 0.
 */
export function planetary(R: number, ports: { sun?: number; ring?: number; carrier?: number }, held?: 'sun' | 'ring' | 'carrier'): { sun: number; ring: number; carrier: number } {
  let sun = held === 'sun' ? 0 : ports.sun;
  let ring = held === 'ring' ? 0 : ports.ring;
  let carrier = held === 'carrier' ? 0 : ports.carrier;
  const known = [sun, ring, carrier].filter((v) => v !== undefined).length;
  if (known < 2) throw new Error('planetary needs two ports');
  if (sun === undefined) sun = (1 + R) * (carrier as number) - R * (ring as number);
  else if (ring === undefined) ring = ((1 + R) * (carrier as number) - sun) / R;
  else if (carrier === undefined) carrier = (sun + R * ring) / (1 + R);
  return { sun, ring: ring as number, carrier: carrier as number };
}

/** Carrier speed over sun speed with the ring held: 1 / (1 + R). */
export const planetaryReduction = (R: number): number => 1 / (1 + R);

/** Differential: torque splits between the two sides (`bias` 0.5 = even); the carrier turns at the mean of the sides. */
export function differentialSplit(carrierTorque: number, bias = 0.5): [number, number] {
  return [carrierTorque * bias, carrierTorque * (1 - bias)];
}
export const differentialMean = (a: number, b: number): number => (a + b) / 2;

/** Continuously variable ratio from a 0-15 signal level: 0.4 at 0 to 2.5 at 15, geometric. */
export function cvtRatio(level: number): number {
  const t = Math.max(0, Math.min(15, level)) / 15;
  return 0.4 * Math.pow(2.5 / 0.4, t);
}

/** Belt or chain stage from pulley sizes (teeth): speed by sender over receiver. */
export const pulleyRatio = (sender: number, receiver: number): number => sender / receiver;

/** Rack and pinion: blocks of travel per second from rpm and the pinion circumference in blocks. */
export const rackSpeed = (rpm: number, circumferenceBlocks = 1): number => (rpm / 60) * circumferenceBlocks;
