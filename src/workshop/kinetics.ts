/**
 * The rotation solver of the Bronze workshop (docs/OVERHAUL_PLAN.md A.2, docs/api/workshop.md). Pure: it takes the
 * parts of one connected network and returns the signed rpm of every part, whether two sources fight each other
 * (a "jam"), and the stress the parts put on the sources.
 *
 * Speed flows outward from the sources. A part passes its speed on to every neighbour it did not receive it from,
 * after changing it: a reverse box flips the sign, a ratio dial multiplies, a governor caps, a clutch (off) and a
 * gearshift (between steps) pass nothing. Reaching a part by two routes with different speeds is a jam.
 */

export interface KPart {
  kind: string;
  /** per-part setting: ratio index, clutch engaged, gearshift program, governor notch */
  s: number;
  /** Punched-card steps as [seconds, factor]. Absent: the three preset programs. */
  card?: readonly (readonly [number, number])[] | null;
}

/** Ratio dial settings, and the only ratios a punched card may use (output speed = input x ratio). */
export const DIAL_RATIOS = [0.5, 1, 2, 3] as const;
/** Steps on a punched card. */
export const CARD_STEPS = 8;
/** How long one punched-card step may run, seconds. */
export const CARD_SECONDS_MIN = 1;
export const CARD_SECONDS_MAX = 30;

/** One step of a punched card: ratio from DIAL_RATIOS, direction -1/0/+1 (0 = disengaged), seconds 1–30. */
export interface CardStep {
  ratio: number;
  direction: -1 | 0 | 1;
  seconds: number;
}

/** Seconds snapped to an integer in 1–30. */
export function clampCardSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return CARD_SECONDS_MIN;
  return Math.max(CARD_SECONDS_MIN, Math.min(CARD_SECONDS_MAX, Math.round(seconds)));
}

/** The DIAL_RATIOS entry nearest `ratio` (ties keep the earlier one). */
export function snapRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DIAL_RATIOS[0];
  let best: number = DIAL_RATIOS[0];
  let bestDist = Infinity;
  for (const d of DIAL_RATIOS) {
    const dist = Math.abs(d - ratio);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

/** Direction snapped to -1, 0 or +1. Anything else stays forward. */
export function snapDirection(direction: number): -1 | 0 | 1 {
  if (direction === -1 || direction === 0 || direction === 1) return direction;
  return 1;
}

/** factor = 0 when disengaged, otherwise direction x ratio. */
export function stepFactor(step: CardStep): number {
  const direction = snapDirection(step.direction);
  return direction === 0 ? 0 : direction * snapRatio(step.ratio);
}

/** A new card: eight steps of ratio 1, forward, 1 second. */
export function freshCard(): CardStep[] {
  const steps: CardStep[] = [];
  for (let i = 0; i < CARD_STEPS; i++) steps.push({ ratio: 1, direction: 1, seconds: 1 });
  return steps;
}

/** Card steps as the [seconds, factor] rows the gearshift solver loops over. */
export function cardProgram(steps: readonly CardStep[]): (readonly [number, number])[] {
  return steps.map((s) => [clampCardSeconds(s.seconds), stepFactor(s)] as const);
}

/** Reads a saved card. A bad shape means no card, so an old save keeps the presets. */
export function readCard(raw: unknown): CardStep[] | null {
  if (!Array.isArray(raw) || raw.length !== CARD_STEPS) return null;
  const steps: CardStep[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 3) return null;
    const [ratio, direction, seconds] = row;
    if (typeof ratio !== 'number' || typeof direction !== 'number' || typeof seconds !== 'number') return null;
    steps.push({ ratio: snapRatio(ratio), direction: snapDirection(direction), seconds: clampCardSeconds(seconds) });
  }
  return steps;
}
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
  chain_sprocket: 0.5, belt_pulley: 1, differential: 1, flywheel: 0.5, shear_pin: 0, saw_arm: 5, vacuum_collector: 3, treadwheel: 0, steam_rotor: 0, air_compressor: 3, bearing: 6, piston: 6, cam_drum: 1.5, brake: 0.25
};

/** The factor the sequenced gearshift applies at `t` seconds. A punched card replaces the preset program. */
export function gearshiftFactor(program: number, t: number, card?: readonly (readonly [number, number])[] | null): number {
  const preset = GEARSHIFT_PROGRAMS[Math.max(0, Math.min(GEARSHIFT_PROGRAMS.length - 1, program))];
  const steps = card && card.length > 0 ? card : preset;
  const total = steps.reduce((s, st) => s + st[0], 0);
  if (total <= 0) return 0;
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
      const f = gearshiftFactor(part.s, t, part.card);
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
  /** Solve tree for the drive layer: the part each part got its speed from, keys parents-first, and the stress each part adds. */
  parent: Map<string, string | null>;
  order: string[];
  partStress: Map<string, number>;
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
  // A differential does not hand on at once: it collects what reaches it, then runs at the mean and hands that on.
  const diffIn = new Map<string, number[]>();
  const diffFrom = new Map<string, Set<string>>();
  let at = 0;
  for (let round = 0; round < 8; round++) {
    for (; at < queue.length; at++) {
      const a = queue[at];
      for (const b of input.neighbours(a)) {
        if (b === from.get(a) || diffFrom.get(a)?.has(b)) continue;
        const out = link(a, b);
        if (out === null) continue;
        if (input.part(b).kind === 'differential' && !input.sources.has(b)) {
          const ins = diffIn.get(b) ?? [];
          ins.push(out);
          diffIn.set(b, ins);
          const fs = diffFrom.get(b) ?? new Set<string>();
          fs.add(a);
          diffFrom.set(b, fs);
          continue;
        }
        const seen = rpm.get(b);
        if (seen === undefined) {
          rpm.set(b, out);
          from.set(b, a);
          queue.push(b);
        } else if (Math.abs(seen - out) > 0.01 && !(input.sources.has(b) && input.part(b).kind === 'hand_crank' && out === 0)) jam = true;
      }
    }
    let grew = false;
    for (const [d, ins] of diffIn) {
      if (rpm.has(d) && (diffFrom.get(d)?.size ?? 0) === 0) continue;
      const mean = ins.reduce((x, y) => x + y, 0) / ins.length;
      if (rpm.get(d) !== undefined && Math.abs((rpm.get(d) as number) - mean) < 0.01) continue;
      rpm.set(d, mean);
      if (!queue.includes(d)) queue.push(d);
      else at = Math.min(at, queue.indexOf(d));
      grew = true;
    }
    if (!grew) break;
  }
  capacity *= input.capacityFactor ?? 1;
  let stress = 0;
  const partStress = new Map<string, number>();
  for (const [k, r] of rpm) {
    const p = input.part(k);
    const base = BASE_STRESS[p.kind] ?? 0;
    if (base === 0 || r === 0) continue;
    const st = base * Math.max(0.25, Math.min(4, 16 / Math.abs(r)));
    partStress.set(k, st);
    stress += st;
  }
  return { rpm: jam ? new Map() : rpm, jam, stress, capacity, parent: from, order: queue, partStress };
}
