/**
 * The building board (docs/plans/orrin-builds-a-town.md, sections 2 and phase 5): material bounties for what Gruk's current
 * building still needs, and the town's reputation. Pure: the caller passes the builder's `missing()` list and the current stage.
 *
 * - Bounties come only from `missing`, never more of an item than is still needed, and BOARD_SLOTS are up at a time.
 * - A bounty is a chunk of CHUNK_MIN to CHUNK_MAX of one item (or all that is left, when less). It can be filled in parts.
 * - Each part pays coin (scaled to the material's price, see economy.ts), town reputation and Gruk's trust. The shares add up
 *   exactly to the bounty's totals. A bounty may carry a rare reward, rolled once when it is drawn.
 * - The board is redrawn when a bounty is filled, and when the stage (or the building) moves on.
 * - Deterministic: every draw comes from the world seed and a counter, both kept in the save.
 */
import { Facing } from '../core/types';
import { hash32, mulberry32 } from '../core/math';
import { priceOf } from './economy';
import type { TownItem } from './townBuilder';
import { rotateCell, townTemplate, TOWN_STAGES } from './townTemplates';

/** Bounties up at a time. */
export const BOARD_SLOTS = 3;
/** The chunk a bounty asks for, in items. */
export const CHUNK_MIN = 8;
export const CHUNK_MAX = 32;
/** Chance a new bounty carries a rare reward, and the higher chance on the finishing stage. */
export const RARE_CHANCE = 0.05;
export const RARE_CHANCE_FINISH = 0.15;
/** Town reputation for each finished building. */
export const REP_PER_BUILDING = 6;
/** Where the town's reputation stands, as data: a step applies from `at` up. Later building types unlock by these steps. */
export const REPUTATION_STEPS: readonly { at: number; name: string }[] = [
  { at: 0, name: 'strangers' },
  { at: 10, name: 'neighbours' },
  { at: 30, name: 'village' },
  { at: 60, name: 'town' },
];
/**
 * The town standing a building needs before Gruk starts it (data). Buildings not listed need none. The storage bay, the well and
 * the lamp post come first; the workshop needs some standing, the cottage more.
 */
export const UNLOCK_REP: Readonly<Record<string, number>> = { storage_bay: 0, well_plaza: 0, lamp_post: 0, workshop: 10, cottage: 20, clock_tower: 30 };

/** Whether a template may be started at this town standing. */
export function unlockedAt(template: string, rep: number): boolean {
  return rep >= (UNLOCK_REP[template] ?? 0);
}

/** A line for the board when Gruk cannot start `template` yet: what standing it needs, and what the town has. Null when it is unlocked. */
export function lockNote(template: string, rep: number): string | null {
  if (unlockedAt(template, rep)) return null;
  const name = townTemplate(template)?.name ?? template;
  return `Gruk will not start the ${name} until the town stands at ${UNLOCK_REP[template]} (it stands at ${rep}).`;
}

/** The rare rewards a bounty may roll (real item keys, src/content). */
export const BOARD_REWARDS: readonly BoardReward[] = [
  { item: 'shears', count: 1 },
  { item: 'bell', count: 1 },
  { item: 'copper_coil', count: 2 },
  { item: 'silica', count: 3 },
];

const FINISH = TOWN_STAGES.indexOf('finish');
/** The board's place inside the storage bay, local to its footprint (on the floor row, by the open front). */
const BAY_ROOM = { x: 5, y: 0, z: 3 };
/** The bay's stock crate, local to its footprint (on the floor row): the player opens it and sees the stock. */
export const BAY_CRATE = { x: 3, y: 0, z: 1 };

export interface CellPos {
  x: number;
  y: number;
  z: number;
}

/** Where the storage bay stands: its origin, rotation and floor row (the base row the builder chose). */
export interface BayPlace {
  x: number;
  z: number;
  rot: number;
  base: number;
}

export interface BoardReward {
  item: string;
  count: number;
}

export interface Bounty {
  id: string;
  item: string;
  /** The building it is for, and the stage index (into TOWN_STAGES). */
  template: string;
  stage: number;
  /** The chunk asked for, and how much is still owed. */
  size: number;
  left: number;
  /** Totals for the whole chunk (paid out in shares as it is filled). */
  coin: number;
  rep: number;
  trust: number;
  reward: BoardReward | null;
}

/** What one hand-in pays. */
export interface Payment {
  take: number;
  coin: number;
  rep: number;
  trust: number;
  reward: BoardReward | null;
  done: boolean;
}

export interface BoardSpot {
  x: number;
  y: number;
  z: number;
  facing: number;
}

export interface BuildBoardSnapshot {
  v: 1;
  seq: number;
  rep: number;
  done: number;
  stageKey: string;
  bounties: Bounty[];
  spot: BoardSpot | null;
  /** The storage bay's place (optional, so older boards load). */
  bay?: BayPlace | null;
  placed: boolean;
}

/** The reputation step the town stands on. */
export function reputationStep(rep: number): { at: number; name: string } {
  let s = REPUTATION_STEPS[0];
  for (const r of REPUTATION_STEPS) if (rep >= r.at) s = r;
  return s;
}

/** Coin for `count` of `item` drawn for a stage: the material's price (economy.ts), a little more on later stages, at least 4. */
export function bountyCoin(item: string, count: number, stage: number): number {
  return Math.max(4, Math.round(priceOf(item) * count * (1 + 0.1 * Math.max(0, stage))));
}

/** The part of `total` between `from` and `to` (out of `size`): the shares of one bounty add up to `total` exactly. */
export function share(total: number, size: number, from: number, to: number): number {
  return Math.floor((total * to) / size) - Math.floor((total * from) / size);
}

/** A board line for the player, e.g. "24 oak log for the Cottage, frame (18 coin)". */
export function describeBounty(b: Bounty): string {
  const name = townTemplate(b.template)?.name ?? b.template;
  return `${b.left} ${b.item.replace(/_/g, ' ')} for the ${name}, ${TOWN_STAGES[b.stage] ?? 'next stage'} (${b.coin} coin)`;
}

/** The chunk a bounty asks for: a random size in [CHUNK_MIN, CHUNK_MAX], capped by what is `available`. */
export function chunkSize(available: number, rnd: () => number): number {
  if (available <= CHUNK_MIN) return available;
  const cap = Math.min(CHUNK_MAX, available);
  return CHUNK_MIN + Math.floor(rnd() * (cap - CHUNK_MIN + 1));
}

/** Where the board sits in the world, given the storage bay's origin, rotation and floor row. Null for an unknown template. */
export function bayBoardSpot(f: BayPlace): BoardSpot | null {
  const t = townTemplate('storage_bay');
  if (!t) return null;
  const r = rotateCell(BAY_ROOM.x, BAY_ROOM.z, t.w, t.d, f.rot, Facing.South);
  return { x: f.x + r.x, y: f.base + BAY_ROOM.y, z: f.z + r.z, facing: r.facing };
}

/** The open front of the bay, one step outside it on the standing row: where a player stands to see the board through it. */
export const BAY_FRONT = { x: 3, y: 1, z: 5 };

/** Where a player stands to use the board through the bay's open front. Null for an unknown template. */
export function bayFrontSpot(f: BayPlace): CellPos | null {
  const t = townTemplate('storage_bay');
  if (!t) return null;
  const r = rotateCell(BAY_FRONT.x, BAY_FRONT.z, t.w, t.d, f.rot, Facing.South);
  return { x: f.x + r.x, y: f.base + BAY_FRONT.y, z: f.z + r.z };
}

/** Where the bay's stock crate stands in the world. Null for an unknown template. */
export function bayCrateSpot(f: BayPlace): CellPos | null {
  const t = townTemplate('storage_bay');
  if (!t) return null;
  const r = rotateCell(BAY_CRATE.x, BAY_CRATE.z, t.w, t.d, f.rot, Facing.South);
  return { x: f.x + r.x, y: f.base + BAY_CRATE.y, z: f.z + r.z };
}

/** A seeded random source for the n-th draw. */
function drawRng(seed: number, n: number): () => number {
  return mulberry32(hash32(seed | 0, n, 0x5b0a7d));
}

function numOf(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.floor(v) : null;
}

export class BuildBoard {
  bounties: Bounty[] = [];
  /** Town reputation: raised by each part filled and each finished building. */
  rep = 0;
  /** Bounties filled over the whole game. */
  done = 0;
  /** Where the board sits (inside the storage bay), once the bay's floor row is known. */
  spot: BoardSpot | null = null;
  /** The storage bay's place, once Gruk has started it. The board and the stock crate are placed from it. */
  bay: BayPlace | null = null;
  /** True once the board block has been placed at `spot`. */
  placed = false;
  private seq = 0;
  private stageKey = '';

  /** Sets the storage bay's place (and so the board's spot). */
  setBay(f: BayPlace): void {
    this.bay = { x: f.x, z: f.z, rot: f.rot, base: f.base };
    this.spot = bayBoardSpot(this.bay);
  }

  /** Where a player stands to use the board through the bay's front, or null before the bay is placed. */
  front(): CellPos | null {
    return this.bay ? bayFrontSpot(this.bay) : null;
  }

  /** Where the bay's stock crate is, or null before the bay is placed. */
  crate(): CellPos | null {
    return this.bay ? bayCrateSpot(this.bay) : null;
  }

  /** Redraws the board for the current building and stage. `now` is null when nothing is being built. Returns true when it changed. */
  refresh(now: { template: string; stage: number } | null, missing: readonly TownItem[], seed: number): boolean {
    const before = JSON.stringify(this.bounties);
    const live = !!now && now.stage >= 0;
    const key = live ? `${now.template}:${now.stage}` : '';
    if (key !== this.stageKey) {
      this.bounties = [];
      this.stageKey = key;
    }
    // Never ask for more than is still needed: trim what the need has fallen below, and drop what is no longer wanted.
    const allow = new Map(missing.map((m) => [m.item, m.count] as const));
    this.bounties = this.bounties.filter((b) => {
      const a = allow.get(b.item) ?? 0;
      if (a <= 0) return false;
      if (b.left > a) b.left = a;
      allow.set(b.item, a - b.left);
      return b.left > 0;
    });
    if (live) {
      while (this.bounties.length < BOARD_SLOTS) {
        const open = missing.filter((m) => (allow.get(m.item) ?? 0) > 0);
        if (open.length === 0) break;
        const rnd = drawRng(seed, this.seq++);
        const pick = open[Math.min(open.length - 1, Math.floor(rnd() * open.length))];
        const avail = allow.get(pick.item) ?? 0;
        const size = chunkSize(avail, rnd);
        const rare = rnd() < (now.stage === FINISH ? RARE_CHANCE_FINISH : RARE_CHANCE);
        const pickReward = BOARD_REWARDS[Math.min(BOARD_REWARDS.length - 1, Math.floor(rnd() * BOARD_REWARDS.length))];
        allow.set(pick.item, avail - size);
        this.bounties.push({
          id: `b${this.seq}`,
          item: pick.item,
          template: now.template,
          stage: now.stage,
          size,
          left: size,
          coin: bountyCoin(pick.item, size, now.stage),
          rep: 1 + Math.floor(size / 8) + now.stage,
          trust: size >= 16 ? 3 : 2,
          reward: rare ? { ...pickReward } : null,
        });
      }
    }
    return JSON.stringify(this.bounties) !== before;
  }

  /** The open bounty a held item can be handed in to (the first one for that item), or null. */
  matching(item: string): Bounty | null {
    return this.bounties.find((b) => b.item === item) ?? null;
  }

  /** Hands in up to `take` of a bounty's item. Null when there is no such bounty. */
  deliver(id: string, take: number): Payment | null {
    const b = this.bounties.find((x) => x.id === id);
    if (!b || !(take > 0)) return null;
    const n = Math.min(Math.floor(take), b.left);
    const from = b.size - b.left;
    const to = from + n;
    const done = n === b.left;
    const pay: Payment = {
      take: n,
      coin: share(b.coin, b.size, from, to),
      rep: share(b.rep, b.size, from, to),
      trust: share(b.trust, b.size, from, to),
      reward: done ? b.reward : null,
      done,
    };
    b.left -= n;
    if (done) {
      this.bounties = this.bounties.filter((x) => x !== b);
      this.done++;
    }
    this.rep += pay.rep;
    return pay;
  }

  /** A building was finished: reputation rises. */
  finished(): void {
    this.rep += REP_PER_BUILDING;
  }

  /** The bounties on the board (copies). */
  list(): Bounty[] {
    return this.bounties.map((b) => ({ ...b }));
  }

  toJSON(): BuildBoardSnapshot {
    return {
      v: 1,
      seq: this.seq,
      rep: this.rep,
      done: this.done,
      stageKey: this.stageKey,
      bounties: this.list(),
      spot: this.spot ? { ...this.spot } : null,
      bay: this.bay ? { ...this.bay } : null,
      placed: this.placed,
    };
  }

  /** Restores a snapshot. Missing or malformed data starts an empty board (an old save has none). */
  load(raw: unknown): void {
    this.bounties = [];
    this.rep = 0;
    this.done = 0;
    this.spot = null;
    this.bay = null;
    this.placed = false;
    this.seq = 0;
    this.stageKey = '';
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<BuildBoardSnapshot>;
    this.seq = numOf(r.seq, 0, 1e9) ?? 0;
    this.rep = numOf(r.rep, 0, 1e9) ?? 0;
    this.done = numOf(r.done, 0, 1e9) ?? 0;
    this.stageKey = typeof r.stageKey === 'string' ? r.stageKey : '';
    this.placed = r.placed === true;
    const s = r.spot;
    if (s && typeof s === 'object' && [s.x, s.y, s.z, s.facing].every(Number.isFinite)) this.spot = { x: s.x, y: s.y, z: s.z, facing: s.facing };
    const bay = r.bay;
    if (bay && typeof bay === 'object' && [bay.x, bay.z, bay.rot, bay.base].every(Number.isFinite)) this.setBay(bay);
    for (const b of Array.isArray(r.bounties) ? r.bounties : []) {
      if (!b || typeof b !== 'object' || typeof b.id !== 'string' || typeof b.item !== 'string' || typeof b.template !== 'string') continue;
      const size = numOf(b.size, 1, CHUNK_MAX);
      const left = numOf(b.left, 1, CHUNK_MAX);
      const stage = numOf(b.stage, 0, TOWN_STAGES.length - 1);
      if (size === null || left === null || stage === null || left > size) continue;
      const rw = b.reward;
      const reward = rw && typeof rw.item === 'string' && numOf(rw.count, 1, 64) !== null ? { item: rw.item, count: Math.floor(rw.count) } : null;
      this.bounties.push({
        id: b.id,
        item: b.item,
        template: b.template,
        stage,
        size,
        left,
        coin: numOf(b.coin, 0, 1e7) ?? 0,
        rep: numOf(b.rep, 0, 1e6) ?? 0,
        trust: numOf(b.trust, 0, 100) ?? 0,
        reward,
      });
    }
    this.bounties = this.bounties.slice(0, BOARD_SLOTS);
  }
}
