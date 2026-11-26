/**
 * Settlement jobs (docs/api/jobs.md): a resident carries items between two stops you pick, all day, while you do something else.
 * `haul` moves a kind of item from a pickup (a crate, depot or vault) to a drop-off; `feed` is the same walk with a machine at
 * the drop-off (a furnace, a hearth, a quern...), so a person "runs a station" by keeping it supplied. Pure: the board keeps the
 * assignments and the walk's clock; everything about the world goes through a narrow `JobsPort`, so tests drive it without one.
 */
import { fuelOf } from '../core/registry';

export type JobKind = 'haul' | 'feed' | 'tend';
export type JobFilter = 'ore' | 'fuel' | 'any';

export interface Stop {
  x: number;
  y: number;
  z: number;
}

export interface Job {
  kind: JobKind;
  filter: JobFilter;
  from: Stop | null;
  to: Stop | null;
}

export const JOB_KINDS: readonly JobKind[] = ['haul', 'feed', 'tend'];
export const JOB_FILTERS: readonly JobFilter[] = ['ore', 'fuel', 'any'];
export const KIND_NAMES: Readonly<Record<JobKind, string>> = { haul: 'Haul', feed: 'Run a station', tend: 'Tend machines' };
export const FILTER_NAMES: Readonly<Record<JobFilter, string>> = { ore: 'Ore', fuel: 'Fuel', any: 'Anything' };

/** Blocks a second a person walks on a job, and the seconds spent loading or unloading at each end. */
export const JOB_SPEED = 1.6;
export const LOAD_S = 0.8;
/** Seconds between looks at the pickup when there was nothing to carry. */
export const POLL_S = 3;
/** How far (blocks) from its centre stop a tending person looks for worn machines. */
export const TEND_RADIUS = 24;
/** The farthest apart (blocks) the two stops may be: the walk is straight, so this keeps a run in loaded ground. */
export const JOB_SPAN = 48;

/** What a person carries in a trip and how brisk they are. Gruk is the strong one; the rest are good for a basket. */
export interface Aptitude {
  carry: number;
  pace: number;
  note: string;
}
export const APTITUDES: Readonly<Record<string, Aptitude>> = {
  gruk: { carry: 16, pace: 1.15, note: 'Strong. Carries 16 at a time.' },
  orrin: { carry: 6, pace: 0.9, note: 'Careful. Carries 6 at a time.' },
};
export const DEFAULT_APTITUDE: Aptitude = { carry: 8, pace: 1, note: 'Steady. Carries 8 at a time.' };
export const aptitudeOf = (id: string): Aptitude => APTITUDES[id] ?? DEFAULT_APTITUDE;

/** True when `item` is the kind the job carries. */
export function matches(item: string, filter: JobFilter): boolean {
  if (filter === 'any') return true;
  if (filter === 'ore') return item.endsWith('_ore') || item.startsWith('crushed_');
  return fuelOf(item) !== null;
}

/** What a job needs from the world, in world coordinates. */
export interface JobsPort {
  /** What the stop holds that can be pulled out (nothing for a stop that is not a container). */
  peek(s: Stop): { item: string; count: number }[];
  take(s: Stop, item: string, max: number): { item: string; count: number } | null;
  /** How many of `item` the stop would take right now (nothing moves). */
  canOffer(s: Stop, item: string, count: number): number;
  /** Hands items over; returns how many were taken. */
  offer(s: Stop, item: string, count: number): number;
  /** False when the stop's chunk is not loaded. */
  loaded(s: Stop): boolean;
  /** Sets items down at a stop (what would not go back where it came from). */
  spill(s: Stop, item: string, count: number): void;
  /** Daytime: people work by day only. */
  working(): boolean;
  /** Busy with something else (hired, away). */
  busy(id: string): boolean;
  /** Worn machines within `near`, worst first (machine wear, docs/api/machine-wear.md). Absent when the game has no machine wear. */
  worn?(near: { x: number; z: number; radius: number }): { x: number; y: number; z: number; kind: string; wear: number }[];
  /** Takes some wear off the machine for free; returns the wear removed. */
  tend?(x: number, y: number, z: number): number;
  /** A multiplier on walking pace (contentment nudges it; 1 when unknown). */
  pace?(id: string): number;
}

/** The world half of the port: what the game's host provides (the manager adds the clock and who is busy). */
export type JobsWorld = Omit<JobsPort, 'working' | 'busy' | 'pace'> & {
  /** The block key at a stop, or null when its chunk is not loaded. */
  blockAt(s: Stop): string | null;
};

type Phase = 'idle' | 'out' | 'back';

interface State {
  job: Job;
  phase: Phase;
  /** Seconds into the current phase, and how long it lasts. */
  t: number;
  len: number;
  carry: { item: string; count: number } | null;
  /** Where a tending trip is going (a machine), instead of the job's drop-off. */
  dest: Stop | null;
  /** Totals, saved. */
  moved: number;
  trips: number;
  status: string;
}

export interface JobView {
  id: string;
  job: Job;
  status: string;
  moved: number;
  trips: number;
  carrying: { item: string; count: number } | null;
}

const dist = (a: Stop, b: Stop): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sameStop = (a: Stop | null, b: Stop | null): boolean => !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
const validStop = (v: unknown): Stop | null => {
  if (!v || typeof v !== 'object') return null;
  const s = v as Stop;
  return [s.x, s.y, s.z].every((n) => Number.isInteger(n) && Math.abs(n) < 1e7) ? { x: s.x, y: s.y, z: s.z } : null;
};

export class JobBoard {
  private readonly states = new Map<string, State>();

  /** Gives `id` a job (keeping the stops of the one they had), or a new kind and filter. */
  assign(id: string, kind: JobKind, filter?: JobFilter): void {
    const old = this.states.get(id);
    const f = filter ?? old?.job.filter ?? (kind === 'feed' ? 'fuel' : 'ore');
    this.states.set(id, this.fresh({ kind, filter: f, from: old?.job.from ?? null, to: old?.job.to ?? null }, old));
  }

  setStop(id: string, which: 'from' | 'to', stop: Stop): boolean {
    const s = this.states.get(id);
    if (!s) return false;
    this.giveBack(s);
    s.job[which] = { x: stop.x, y: stop.y, z: stop.z };
    s.phase = 'idle';
    s.t = 0;
    s.len = 0;
    s.status = 'Ready';
    return true;
  }

  setFilter(id: string, filter: JobFilter): void {
    const s = this.states.get(id);
    if (s) this.states.set(id, this.fresh({ ...s.job, filter }, s));
  }

  clear(id: string): void {
    this.states.delete(id);
  }

  has(id: string): boolean {
    return this.states.has(id);
  }

  get size(): number {
    return this.states.size;
  }

  get(id: string): JobView | null {
    const s = this.states.get(id);
    return s ? { id, job: { ...s.job }, status: s.status, moved: s.moved, trips: s.trips, carrying: s.carry ? { ...s.carry } : null } : null;
  }

  all(): JobView[] {
    return [...this.states.keys()].map((id) => this.get(id)!);
  }

  /** Why a job cannot run yet, or null when both stops are set and close enough. */
  static problem(job: Job): string | null {
    if (job.kind === 'tend') return job.from ? null : 'Pick the workshop to look after';
    if (!job.from) return 'Pick where to collect from';
    if (!job.to) return 'Pick where to deliver';
    if (sameStop(job.from, job.to)) return 'The two stops are the same block';
    if (dist(job.from, job.to) > JOB_SPAN) return `The stops are more than ${JOB_SPAN} blocks apart`;
    return null;
  }

  private fresh(job: Job, old?: State): State {
    const s: State = { job, phase: 'idle', t: 0, len: 0, carry: null, dest: null, moved: old?.moved ?? 0, trips: old?.trips ?? 0, status: JobBoard.problem(job) ?? 'Ready' };
    if (old) this.giveBack(old);
    return s;
  }

  /** What a worker was carrying when the job changed is dropped at the pickup next tick: it is kept on the old state. */
  private readonly strays: { stop: Stop; item: string; count: number }[] = [];
  private giveBack(s: State): void {
    if (s.carry && s.job.from) this.strays.push({ stop: s.job.from, ...s.carry });
    s.carry = null;
  }

  tick(dt: number, port: JobsPort): void {
    for (const x of this.strays.splice(0)) {
      const n = port.loaded(x.stop) ? port.offer(x.stop, x.item, x.count) : 0;
      if (n < x.count && port.loaded(x.stop)) port.spill(x.stop, x.item, x.count - n);
    }
    for (const [id, s] of this.states) this.step(id, s, dt, port);
  }

  private step(id: string, s: State, dt: number, port: JobsPort): void {
    const { from } = s.job;
    const to = s.job.kind === 'tend' ? s.job.from : s.job.to;
    const problem = JobBoard.problem(s.job);
    if (problem || !from || !to) {
      s.status = problem ?? 'Ready';
      return;
    }
    if (port.busy(id)) {
      s.status = 'Busy with something else';
      return;
    }
    if (s.phase === 'idle') {
      if (!port.working()) {
        s.status = 'Resting for the night';
        return;
      }
      s.t -= dt;
      if (s.t > 0) return;
      if (s.job.kind === 'tend') this.departTend(id, s, port, from);
      else this.depart(id, s, port, from, to);
      return;
    }
    s.t += dt;
    if (s.t < s.len) return;
    if (s.phase === 'out') {
      if (s.job.kind === 'tend') this.arriveTend(id, s, port, from);
      else this.arrive(id, s, port, from, to);
    } else {
      s.phase = 'idle';
      s.t = 0;
      s.dest = null;
      s.status = s.job.kind === 'tend' ? 'Looking for a machine to tend' : 'Looking for the next load';
    }
  }

  private depart(id: string, s: State, port: JobsPort, from: Stop, to: Stop): void {
    s.t = 0;
    if (!port.loaded(from) || !port.loaded(to)) {
      s.status = 'Out of reach (not loaded)';
      s.t = -POLL_S;
      return;
    }
    const apt = aptitudeOf(id);
    const here = port.peek(from).filter((e) => e.count > 0 && matches(e.item, s.job.filter));
    if (here.length === 0) {
      s.status = `Waiting for ${FILTER_NAMES[s.job.filter].toLowerCase()} at the pickup`;
      s.t = -POLL_S;
      return;
    }
    let pick: { item: string; n: number } | null = null;
    for (const e of here) {
      const n = Math.min(apt.carry, e.count, port.canOffer(to, e.item, Math.min(apt.carry, e.count)));
      if (n > 0) {
        pick = { item: e.item, n };
        break;
      }
    }
    if (!pick) {
      s.status = s.job.kind === 'feed' ? 'The machine is full or does not take it' : 'The drop-off is full';
      s.t = -POLL_S;
      return;
    }
    const got = port.take(from, pick.item, pick.n);
    if (!got || got.count <= 0) {
      s.status = 'Could not lift anything';
      s.t = -POLL_S;
      return;
    }
    s.carry = got;
    s.phase = 'out';
    s.t = 0;
    s.len = LOAD_S + dist(from, to) / (JOB_SPEED * apt.pace * (port.pace?.(id) ?? 1));
    s.status = `Carrying ${got.count} ${got.item.replace(/_/g, ' ')}`;
  }

  private departTend(id: string, s: State, port: JobsPort, centre: Stop): void {
    s.t = 0;
    if (!port.worn || !port.tend) {
      s.status = 'No machine wear in this game';
      s.t = -POLL_S;
      return;
    }
    if (!port.loaded(centre)) {
      s.status = 'Out of reach (not loaded)';
      s.t = -POLL_S;
      return;
    }
    const w = port.worn({ x: centre.x, z: centre.z, radius: TEND_RADIUS })[0];
    if (!w) {
      s.status = 'Every machine is in good order';
      s.t = -POLL_S;
      return;
    }
    s.dest = { x: w.x, y: w.y, z: w.z };
    s.phase = 'out';
    s.len = LOAD_S + dist(centre, s.dest) / (JOB_SPEED * aptitudeOf(id).pace * (port.pace?.(id) ?? 1));
    s.status = `On the way to the ${w.kind.replace(/_/g, ' ')}`;
  }

  private arriveTend(id: string, s: State, port: JobsPort, centre: Stop): void {
    const d = s.dest;
    if (d && port.loaded(d) && (port.tend?.(d.x, d.y, d.z) ?? 0) > 0) {
      s.moved++;
      s.trips++;
    }
    s.phase = 'back';
    s.t = 0;
    s.len = LOAD_S + (d ? dist(centre, d) : 0) / (JOB_SPEED * aptitudeOf(id).pace * (port.pace?.(id) ?? 1));
    s.status = 'Walking back';
  }

  private arrive(id: string, s: State, port: JobsPort, from: Stop, to: Stop): void {
    const c = s.carry;
    s.carry = null;
    if (c) {
      const n = port.loaded(to) ? port.offer(to, c.item, c.count) : 0;
      s.moved += n;
      if (n > 0) s.trips++;
      const left = c.count - n;
      if (left > 0) {
        // The drop-off filled up on the way: the rest goes back to the pickup (or onto the ground there).
        const back = port.loaded(from) ? port.offer(from, c.item, left) : 0;
        if (back < left) port.spill(from, c.item, left - back);
      }
    }
    s.phase = 'back';
    s.t = 0;
    s.len = LOAD_S + dist(from, to) / (JOB_SPEED * aptitudeOf(id).pace * (port.pace?.(id) ?? 1));
    s.status = 'Walking back';
  }

  /** World position of a worker on the road, or null when they are not out (idle at the pickup, or no job). */
  pose(id: string): { x: number; y: number; z: number } | null {
    const s = this.states.get(id);
    const far = s?.job.kind === 'tend' ? s.dest ?? s.job.from : s?.job.to;
    if (!s || !s.job.from || !far || s.phase === 'idle') return null;
    const a = s.phase === 'out' ? s.job.from : far;
    const b = s.phase === 'out' ? far : s.job.from;
    // They walk the straight line between the stops, starting and ending a block short of the containers.
    const d = Math.max(0.001, dist(a, b));
    const f = Math.max(0, Math.min(1, (s.t - LOAD_S / 2) / Math.max(0.001, s.len - LOAD_S)));
    const inset = Math.min(1, d / 2) / d;
    const t = inset + (1 - 2 * inset) * f;
    return { x: a.x + 0.5 + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + 0.5 + (b.z - a.z) * t };
  }

  toJSON(): Record<string, { kind: JobKind; filter: JobFilter; from: Stop | null; to: Stop | null; moved: number; trips: number }> {
    const out: Record<string, { kind: JobKind; filter: JobFilter; from: Stop | null; to: Stop | null; moved: number; trips: number }> = {};
    for (const [id, s] of this.states) out[id] = { kind: s.job.kind, filter: s.job.filter, from: s.job.from, to: s.job.to, moved: s.moved, trips: s.trips };
    return out;
  }

  /** Old saves have none. What a worker carried when the save was made was in their hands, and is not restored. */
  load(raw: unknown, known: (id: string) => boolean): void {
    this.states.clear();
    this.strays.length = 0;
    if (!raw || typeof raw !== 'object') return;
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!known(id) || !v || typeof v !== 'object') continue;
      const r = v as Partial<Job> & { moved?: number; trips?: number };
      if (!JOB_KINDS.includes(r.kind as JobKind) || !JOB_FILTERS.includes(r.filter as JobFilter)) continue;
      const job: Job = { kind: r.kind as JobKind, filter: r.filter as JobFilter, from: validStop(r.from), to: validStop(r.to) };
      const s = this.fresh(job);
      s.moved = Number.isFinite(r.moved) ? Math.max(0, Math.floor(r.moved as number)) : 0;
      s.trips = Number.isFinite(r.trips) ? Math.max(0, Math.floor(r.trips as number)) : 0;
      this.states.set(id, s);
    }
  }
}
