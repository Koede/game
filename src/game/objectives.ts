/**
 * The objective tracker (spec 2.7): walks OBJECTIVES in order, the first incomplete one is "current".
 *
 * Everything a condition can ask about is recorded from the first moment of the game, not only while its
 * objective is current: made / placed / broken counters live on PlayerState.stats, flags are remembered here,
 * and the simulation's numbers (furnace temperature and tier, generation, stored energy) are kept as the
 * highest value ever sampled. An objective whose condition was met early completes the moment it comes up.
 */
import type { GameBus } from '../core/context';
import { AGES, FURNACE_TIERS, MAX_FURNACE_TIER, OBJECTIVES, blockOf, furnaceTier, furnaceTierOfBlock, itemOrNull } from '../core/registry';
import type { ItemAmount, ObjectiveCondition, ObjectiveSpec } from '../core/types';
import type { PlayerState } from './playerState';

/** What the tracker needs to know about the simulation. src/sim (or the integration layer) supplies it. */
export interface SimQuery {
  /** Hottest furnace right now, degrees C (0 without a furnace). */
  maxFurnaceTempC(): number;
  /** Highest furnace tier that exists, 1-based (0 without a furnace). */
  maxFurnaceTier(): number;
  /** Total electrical generation across all networks, watts. */
  generationW(): number;
  /** Total energy stored in batteries, joules. */
  storedJ(): number;
}

export const NO_SIM_QUERY: SimQuery = {
  maxFurnaceTempC: () => 0,
  maxFurnaceTier: () => 0,
  generationW: () => 0,
  storedJ: () => 0,
};

export interface ObjectiveProgress {
  current: number;
  target: number;
  /** current / target, clamped to 0..1. */
  fraction: number;
  /** Short text for the HUD, e.g. "3 / 8" or "450 / 800 C". Empty for one-off conditions. */
  text: string;
}

/** Highest values ever sampled from the simulation. */
export interface ObjectivePeaks {
  tempC: number;
  tier: number;
  generationW: number;
  storedJ: number;
}

export interface ObjectivesSnapshot {
  completed: string[];
  flags: string[];
  peaks: ObjectivePeaks;
  age: number;
  /** Rewards that did not fit into the inventory yet. */
  pendingRewards: ItemAmount[];
}

/** Seconds between condition checks. */
export const CHECK_INTERVAL_S = 0.25;

const trim = (n: number): string => (Math.round(n * 10) / 10).toString();

export function formatWatts(w: number): string {
  if (w >= 1_000_000) return `${trim(w / 1_000_000)} MW`;
  return w >= 1000 ? `${trim(w / 1000)} kW` : `${Math.round(w)} W`;
}

export function formatJoules(j: number): string {
  if (j >= 1_000_000) return `${trim(j / 1_000_000)} MJ`;
  return j >= 1000 ? `${trim(j / 1000)} kJ` : `${Math.round(j)} J`;
}

const measure = (current: number, target: number, text: string): ObjectiveProgress => ({
  current: Math.min(current, target),
  target,
  fraction: target > 0 ? Math.min(1, Math.max(0, current / target)) : 1,
  text,
});

const counted = (current: number, target: number): ObjectiveProgress =>
  measure(current, target, `${Math.min(current, target)} / ${target}`);

export class ObjectiveTracker {
  private readonly completedIds = new Set<string>();
  private readonly flags = new Set<string>();
  private readonly peaks: ObjectivePeaks = { tempC: 0, tier: 0, generationW: 0, storedJ: 0 };
  private pendingRewards: ItemAmount[] = [];
  private ageIndex = 0;
  /** Index of the first objective that is not complete (OBJECTIVES.length when all are). */
  private cursor = 0;
  private checkIn = 0;
  private readonly unsubscribe: Array<() => void>;

  constructor(
    private readonly bus: GameBus,
    private readonly player: PlayerState,
    private query: SimQuery = NO_SIM_QUERY,
  ) {
    const reachTier = (tier: number): void => {
      this.peaks.tier = Math.min(MAX_FURNACE_TIER, Math.max(this.peaks.tier, tier));
    };
    this.unsubscribe = [
      bus.on('flag', (e) => this.flags.add(e.flag)),
      bus.on('furnace:upgraded', (e) => reachTier(e.tier)),
      bus.on('block:placed', (e) => reachTier(furnaceTierOfBlock(blockOf(e.voxel).key)?.tier ?? 0)),
    ];
  }

  /** Stops listening to the bus. */
  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }

  /** Connects the simulation once it exists. */
  setQuery(query: SimQuery): void {
    this.query = query;
  }

  /** The first incomplete objective, or null when everything is done. */
  get current(): ObjectiveSpec | null {
    return OBJECTIVES[this.cursor] ?? null;
  }

  get allDone(): boolean {
    return this.cursor >= OBJECTIVES.length;
  }

  /** Completed objectives in the order of the list. */
  get completed(): ObjectiveSpec[] {
    return OBJECTIVES.filter((o) => this.completedIds.has(o.id));
  }

  /** Objectives after the current one, in order. */
  get upcoming(): ObjectiveSpec[] {
    return OBJECTIVES.filter((o, i) => i > this.cursor && !this.completedIds.has(o.id));
  }

  /** Current technology age (index into AGES): the age of the highest furnace tier ever reached. */
  get age(): number {
    return this.ageIndex;
  }

  isComplete(id: string): boolean {
    return this.completedIds.has(id);
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  /** Progress of the current objective, or null when everything is done. */
  progress(): ObjectiveProgress | null {
    const spec = this.current;
    return spec ? this.progressOf(spec.condition) : null;
  }

  /** Progress of any condition against what has been recorded so far. */
  progressOf(c: ObjectiveCondition): ObjectiveProgress {
    const stats = this.player.stats;
    switch (c.type) {
      case 'have':
        return counted(this.player.inventory.count(c.item), c.count ?? 1);
      case 'make':
        return counted(stats.made[c.item] ?? 0, c.count ?? 1);
      case 'place':
        return counted(stats.placed[c.block] ?? 0, c.count ?? 1);
      case 'break':
        return counted(stats.broken[c.block] ?? 0, c.count ?? 1);
      case 'furnaceTemp':
        return measure(this.peaks.tempC, c.tempC, `${Math.floor(Math.min(this.peaks.tempC, c.tempC))} / ${c.tempC} C`);
      case 'furnaceTier':
        return measure(this.peaks.tier, c.tier, `Tier ${Math.min(this.peaks.tier, c.tier)} / ${c.tier}`);
      case 'generate':
        return measure(this.peaks.generationW, c.watts, `${formatWatts(Math.min(this.peaks.generationW, c.watts))} / ${formatWatts(c.watts)}`);
      case 'stored':
        return measure(this.peaks.storedJ, c.joules, `${formatJoules(Math.min(this.peaks.storedJ, c.joules))} / ${formatJoules(c.joules)}`);
      case 'flag':
        return measure(this.flags.has(c.flag) ? 1 : 0, 1, '');
      case 'any': {
        let best: ObjectiveProgress | null = null;
        for (const sub of c.of) {
          const p = this.progressOf(sub);
          if (!best || p.fraction > best.fraction) best = p;
        }
        return best ?? measure(0, 1, '');
      }
    }
  }

  /** Call every simulation tick: conditions are evaluated every CHECK_INTERVAL_S. */
  tick(dt: number): void {
    this.checkIn -= dt;
    if (this.checkIn > 0) return;
    this.checkIn = CHECK_INTERVAL_S;
    this.check();
  }

  /** Evaluates now: samples the simulation, completes the current objective and any that follow it at once. */
  check(): void {
    this.sample();
    this.deliverPending();
    for (let spec = this.current; spec && this.progressOf(spec.condition).fraction >= 1; spec = this.current) {
      this.complete(spec);
    }
  }

  toJSON(): ObjectivesSnapshot {
    return {
      completed: [...this.completedIds],
      flags: [...this.flags],
      peaks: { ...this.peaks },
      age: this.ageIndex,
      pendingRewards: this.pendingRewards.map((r) => ({ ...r })),
    };
  }

  /** Restores a snapshot without announcing anything again. */
  load(s: ObjectivesSnapshot): void {
    this.completedIds.clear();
    for (const id of s.completed) this.completedIds.add(id);
    this.flags.clear();
    for (const flag of s.flags) this.flags.add(flag);
    Object.assign(this.peaks, s.peaks);
    this.ageIndex = Math.min(AGES.length - 1, Math.max(0, Math.floor(s.age)));
    this.pendingRewards = s.pendingRewards.filter((r) => itemOrNull(r.item) !== null).map((r) => ({ ...r }));
    this.cursor = 0;
    this.advanceCursor();
    this.checkIn = 0;
  }

  private advanceCursor(): void {
    while (this.cursor < OBJECTIVES.length && this.completedIds.has(OBJECTIVES[this.cursor].id)) this.cursor++;
  }

  private sample(): void {
    const peaks = this.peaks;
    const q = this.query;
    peaks.tempC = Math.max(peaks.tempC, q.maxFurnaceTempC());
    peaks.tier = Math.min(MAX_FURNACE_TIER, Math.max(peaks.tier, Math.floor(q.maxFurnaceTier())));
    peaks.generationW = Math.max(peaks.generationW, q.generationW());
    peaks.storedJ = Math.max(peaks.storedJ, q.storedJ());
    const reached = peaks.tier >= 1 ? furnaceTier(peaks.tier).age : 0;
    while (this.ageIndex < reached && this.ageIndex < AGES.length - 1) {
      this.ageIndex++;
      const age = AGES[this.ageIndex];
      this.bus.emit('age:advanced', { age: this.ageIndex });
      this.bus.emit('sfx', { name: 'age' });
      this.bus.emit('toast', { text: `${age.name}: ${age.blurb}`, kind: 'good', item: FURNACE_TIERS.find((t) => t.age === this.ageIndex)?.block });
    }
  }

  /** Hands over rewards that found no room earlier, quietly, as soon as there is space. */
  private deliverPending(): void {
    if (this.pendingRewards.length === 0) return;
    for (const reward of this.pendingRewards) {
      const left = this.player.inventory.add(reward.item, reward.count);
      if (left < reward.count) this.bus.emit('item:gained', { item: reward.item, count: reward.count - left });
      reward.count = left;
    }
    this.pendingRewards = this.pendingRewards.filter((r) => r.count > 0);
  }

  private complete(spec: ObjectiveSpec): void {
    this.completedIds.add(spec.id);
    this.advanceCursor();
    for (const reward of spec.reward ?? []) {
      const left = this.player.give(reward.item, reward.count);
      if (left > 0) this.pendingRewards.push({ item: reward.item, count: left });
    }
    this.bus.emit('objective:completed', { id: spec.id });
    this.bus.emit('toast', { text: `Done: ${spec.title}`, kind: 'good' });
    this.bus.emit('sfx', { name: 'objective' });
  }
}
