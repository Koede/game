/**
 * The rotation solver of the Bronze workshop (docs/OVERHAUL_PLAN.md A.2, docs/api/workshop.md). Pure: it takes the
 * parts of one connected network and returns the signed rpm of every part, whether two sources fight each other
 * (a "jam"), and the stress the parts put on the sources.
 *
 * Speed flows outward from the sources. A part passes its speed on to every neighbour it did not receive it from,
 * after changing it: a reverse box flips the sign, a ratio dial multiplies, a governor caps, a clutch (off) and a
 * gearshift (between steps) pass nothing. Reaching a part by two routes with different speeds is a jam.
 */

export interface KPart { kind: string; /** per-part setting: ratio index, clutch engaged, gearshift program, governor notch */ s: number }

/** Ratio dial settings (output speed = input x ratio). */
export const DIAL_RATIOS = [0.5, 1, 2, 3] as const;
/** Pulley sizes: speed goes by the size of the sending pulley over the size of the receiving one. */
export const PULLEY_SIZES = [1, 2, 3] as const;
/** Governor notches: the fastest it lets the network run, rpm. */
export const GOVERNOR_NOTCHES = [32, 64, 96] as const;
/** Gearshift programs: a loop of [seconds, factor] steps (factor 0 = disengaged, -1 = reversed). */
export const GEARSHIFT_PROGRAMS: readonly (readonly [number, number][])[] = [
  [[4, 1], [2, 0]],
  [[3, 1], [1, 0], [3, -1], [1, 0]],
  [[2, 1], [2, 2], [2, 0.5], [2, 0]],
];
/** Worm gear: slows by this, and only drives from the worm side. */
export const WORM_RATIO = 1 / 8;
/** Stress units each kind adds per rpm-neutral part. Shafts, gearboxes and links cost almost nothing. */
export const BASE_STRESS: Record<string, number> = {
  conveyor_belt: 0.25, mech_saw: 4, mech_millstone: 4, mech_mortar: 4, mech_loom: 2,
  mech_hammer: 8, mech_rack: 2, mech_press: 8, mixer: 6, deployer: 6, mech_arm: 3, mech_drill: 6, mech_pump: 4,
  reverse_box: 0.5, ratio_dial: 0.5, clutch: 0.25, split_box: 0.5, sequence_gearshift: 1, governor: 0.5, worm_gear: 1,
  chain_sprocket: 0.5, belt_pulley: 1, differential: 1,
};

/** The factor the sequenced gearshift of `program` applies at `t` seconds. */
export function gearshiftFactor(program: number, t: number): number {
  const steps = GEARSHIFT_PROGRAMS[Math.max(0, Math.min(GEARSHIFT_PROGRAMS.length - 1, program))];
  const total = steps.reduce((s, st) => s + st[0], 0);
  let at = ((t % total) + total) % total;
  for (const [len, f] of steps) {
    if (at < len) return f;
    at -= len;
  }
  return 0;
}

/** What a part hands on to its neighbours given the speed `rpm` it runs at, or null = hands on nothing. */
export function passOn(part: KPart, rpm: number, t: number): number | null {
  switch (part.kind) {
    case 'reverse_box': return -rpm;
    case 'ratio_dial': return rpm * DIAL_RATIOS[Math.max(0, Math.min(DIAL_RATIOS.length - 1, part.s))];
    case 'clutch': return part.s ? rpm : null;
    case 'sequence_gearshift': {
      const f = gearshiftFactor(part.s, t);
      return f === 0 ? null : rpm * f;
    }
    case 'governor': {
      const cap = GOVERNOR_NOTCHES[Math.max(0, Math.min(GOVERNOR_NOTCHES.length - 1, part.s))];
      return Math.sign(rpm) * Math.min(Math.abs(rpm), cap);
    }
    case 'worm_gear': return rpm * WORM_RATIO;
    default: return rpm;
  }
}

/** The speed on the far end of a chain or belt link between two sprockets / pulleys. */
export function linkRatio(a: KPart, b: KPart): number {
  if (a.kind === 'belt_pulley' && b.kind === 'belt_pulley') return PULLEY_SIZES[a.s % PULLEY_SIZES.length] / PULLEY_SIZES[b.s % PULLEY_SIZES.length];
  return 1;
}

export interface Source { rpm: number; capacity: number }
export interface Solved {
  /** Signed rpm per turning part key (absent = still). */
  rpm: Map<string, number>;
  jam: boolean;
  /** Stress units the turning parts put on the sources, and what the sources carry. */
  stress: number;
  capacity: number;
}

export interface SolveInput {
  members: readonly string[];
  part(key: string): KPart;
  /** Keys joined to `key`: the six touching cells plus any chain or belt link. */
  neighbours(key: string): readonly string[];
  /** Keys that are sources and what each gives. */
  sources: ReadonlyMap<string, Source>;
  /** Seconds the world has run (the gearshift loops on it). */
  t: number;
  /** Capacity multiplier (lubricant). */
  capacityFactor?: number;
}

export function solveNetwork(input: SolveInput): Solved {
  const rpm = new Map<string, number>();
  const from = new Map<string, string | null>();
  let jam = false;
  let capacity = 0;
  const queue: string[] = [];
  // Strongest source leads; the others must agree with it.
  const seeds = [...input.sources].filter(([k]) => input.members.includes(k)).sort((a, b) => b[1].capacity - a[1].capacity);
  for (const [k, s] of seeds) {
    capacity += s.capacity;
    const prev = rpm.get(k);
    if (prev !== undefined) {
      if (Math.abs(prev - s.rpm) > 0.01) jam = true;
      continue;
    }
    rpm.set(k, s.rpm);
    from.set(k, null);
    queue.push(k);
  }
  const link = (a: string, b: string): number | null => {
    const pa = input.part(a);
    const r = rpm.get(a) as number;
    const out = passOn(pa, r, input.t);
    if (out === null) return null;
    return out * linkRatio(pa, input.part(b));
  };
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    for (const b of input.neighbours(a)) {
      if (b === from.get(a)) continue;
      const out = link(a, b);
      if (out === null) continue;
      const seen = rpm.get(b);
      if (seen === undefined) {
        rpm.set(b, out);
        from.set(b, a);
        queue.push(b);
      } else if (Math.abs(seen - out) > 0.01 && !(input.sources.has(b) && input.part(b).kind === 'hand_crank' && out === 0)) jam = true;
    }
  }
  capacity *= input.capacityFactor ?? 1;
  let stress = 0;
  for (const [k, r] of rpm) {
    const p = input.part(k);
    const base = BASE_STRESS[p.kind] ?? 0;
    if (base === 0 || r === 0) continue;
    stress += base * Math.max(0.25, Math.min(4, 16 / Math.abs(r)));
  }
  return { rpm: jam ? new Map() : rpm, jam, stress, capacity };
}
