/**
 * The settlement's people and rooms (docs/plans/just-you-and-orrin.md, phases 5 to 7). State and rules for who moves in, where they
 * live and how content they are. Pure over its inputs: the manager passes the world's facts (room checks, block samples) and a seeded
 * rng, and applies what comes back. Everything here is optional in a save, so an old world starts it fresh.
 *
 * The lodge's own bedrooms count as valid housing by default (their walls are Gruk's, and the upper floor's open doorways fail the
 * flood-fill room check as the layout stands). Rooms the player builds are found by their beds and must pass `checkRoom`.
 */
import { ARRIVALS, rollNight, type Arrival, type Newcomer } from './moveIn';
import { CAMP, assignRoom, evictBroken, nextInLine, roomViews, type Eviction, type NextInLine, type Occupancy, type RoomInput, type RoomView } from './housingView';
import { NAMES, PEOPLE, contentment, type Contentment, type PersonId, type Tag } from './contentment';

/** A room that exists in the lodge once its stage stands. */
export interface RoomDef {
  id: string;
  label: string;
  /** The lodge level (1..5, lodge.ts LODGE_PATH) from which the room exists. */
  level: number;
  /** The bed, tavern-local. */
  at: readonly [number, number, number];
}

export const LODGE_ROOMS: readonly RoomDef[] = [
  { id: 'lodge_1', label: 'Lodge bedroom', level: 1, at: [1, 1, 1] },
  { id: 'lodge_2', label: 'Second bedroom', level: 2, at: [10, 1, 1] },
  { id: 'lodge_3', label: 'Third bedroom', level: 3, at: [1, 1, 6] },
  { id: 'guest_1', label: 'West guest room', level: 4, at: [1.5, 6.5, 6.5] },
  { id: 'guest_2', label: 'East guest room', level: 4, at: [11.5, 6.5, 6.5] },
];

/** Where each resident stands in the lodge's common room by day, and where they sleep (tavern-local, walkable cells, nav.ts). */
export const LODGE_COMMON: Readonly<Record<string, readonly [number, number, number]>> = { rosa: [5, 1, 3], orrin: [5, 1, 2], mara: [6, 1, 2], bram: [5, 1, 4], veyra: [6, 1, 1] };
export const LODGE_SLEEP: Readonly<Record<string, readonly [number, number, number]>> = { lodge_1: [2, 1, 2], lodge_2: [9, 1, 2], lodge_3: [2, 1, 6] };

/** Prefix of the ids of rooms found by their bed in the world ("bed:x,y,z"). */
export const BED_ROOM = 'bed:';
/** Prefix of the ids of the houses Gruk builds for residents ("house:x,y,z", the floor cell by the door). */
export const HOUSE_ROOM = 'house:';
/** A resident has lived in the lodge at least this many days (a moon) before they get a house. */
export const HOUSE_AFTER_DAYS = 8;

/** Nights rolled in one go at most (a long time away: the chance is capped, so more nights change little). */
export const MAX_NIGHTS = 40;
/** Residents this near (blocks, level ground) are neighbours. */
export const NEAR = 16;

/** The lodge rooms standing at `level`, as always-valid room inputs. */
export function lodgeRooms(level: number): RoomInput[] {
  return LODGE_ROOMS.filter((r) => r.level <= level).map((r) => ({ id: r.id, check: { ok: true, reasons: [], cells: 0 } }));
}

export const isPersonId = (id: string): id is PersonId => (PEOPLE as readonly string[]).includes(id);

export interface SettlementSnapshot {
  /** The day of the last night rolled. */
  last: number;
  /** The day each room was first seen standing. */
  since: Record<string, number>;
  /** Person id to room id. */
  occ: Record<string, string>;
  /** Arrivals, newest last: person id, room id, day. */
  log: [string, string, number][];
  /** Houses Gruk has built (room ids), and the day each person was knocked down (they are back the next morning). */
  houses?: string[];
  away?: Record<string, number>;
}

export interface HousingRow extends RoomView {
  label: string;
  /** True for a room found by its bed (the player built it). */
  built: boolean;
}

export class Settlement {
  /** The day of the last night rolled (0 until the first tick has seen a day). */
  last = 0;
  private since: Record<string, number> = {};
  private occ: Record<string, string> = {};
  private log: [string, string, number][] = [];
  private houses: string[] = [];
  private away: Record<string, number> = {};
  /** Cached contentment per person, recomputed each night. */
  private scores: Record<string, Contentment> = {};

  get occupancy(): Occupancy {
    return { ...this.occ };
  }

  /** The room a person lives in, or CAMP when they have none. */
  roomOf(id: string): string {
    return this.occ[id] ?? CAMP;
  }

  arrivals(): readonly [string, string, number][] {
    return this.log;
  }

  /** Puts a person in a room without a roll (a dev settle, an assignment). */
  place(id: string, room: string): void {
    this.occ[id] = room;
  }

  // ---- houses and moving out ----

  addHouse(id: string): void {
    if (!this.houses.includes(id)) this.houses.push(id);
  }

  /** The houses built, as always-valid rooms (Gruk's own walls, like the lodge's bedrooms). */
  houseRooms(): RoomInput[] {
    return this.houses.map((id) => ({ id, check: { ok: true, reasons: [], cells: 0 } }));
  }

  /**
   * Residents who move out to a free house: in the order they arrived, once they have lived in a room of the lodge for a moon. One
   * per free house. Returns the moves, already applied.
   */
  moveOuts(day: number, rooms: readonly RoomInput[]): { personId: string; from: string; to: string }[] {
    const out: { personId: string; from: string; to: string }[] = [];
    for (const [personId, from, since] of this.log) {
      if (this.occ[personId] !== from || from.startsWith(HOUSE_ROOM) || day - since < HOUSE_AFTER_DAYS) continue;
      const taken = new Set(Object.values(this.occ));
      const house = this.houses.find((h) => !taken.has(h) && rooms.some((r) => r.id === h && r.check.ok));
      if (!house) break;
      this.occ[personId] = house;
      out.push({ personId, from, to: house });
    }
    return out;
  }

  /** Moves a person to a room by hand (the Town page). Refuses rooms that are missing, broken or lived in. */
  assign(personId: string, roomId: string, rooms: readonly RoomInput[]): { ok: true } | { ok: false; reason: string } {
    const r = assignRoom(this.occ, personId, roomId, rooms);
    if (!r.ok) return r;
    this.occ = { ...r.occupancy };
    if (roomId === CAMP) delete this.occ[personId];
    return { ok: true };
  }

  // ---- knock-down and return (contentment.ts) ----

  /** Someone is knocked down on `day`: away until the next morning, their room kept. */
  knockDown(id: string, day: number): void {
    this.away[id] = day;
  }

  isAway(id: string, day: number): boolean {
    const d = this.away[id];
    return d !== undefined && day <= d;
  }

  /** True on the morning someone comes back: their lines are grumpy that day. */
  isGrumpy(id: string, day: number): boolean {
    const d = this.away[id];
    return d !== undefined && day === d + 1;
  }

  /** Forgets knock-downs older than yesterday. Returns who came back this morning. */
  comeBack(day: number): string[] {
    const back: string[] = [];
    for (const [id, d] of Object.entries(this.away)) {
      if (day === d + 1) back.push(id);
      else if (day > d + 1) delete this.away[id];
    }
    return back;
  }

  /** Records the day each room was first seen and forgets rooms that are gone. */
  track(day: number, rooms: readonly RoomInput[]): void {
    const ids = new Set(rooms.map((r) => r.id));
    for (const id of ids) if (this.since[id] === undefined) this.since[id] = day;
    for (const id of Object.keys(this.since)) if (!ids.has(id)) delete this.since[id];
  }

  /** The free valid rooms for the night that turns to `day`: a room first seen on day S has 0 empty nights on the turn to S + 1. */
  freeRooms(day: number, rooms: readonly RoomInput[]): { id: string; emptyNights: number }[] {
    const taken = new Set(Object.values(this.occ));
    return rooms
      .filter((r) => r.check.ok && !taken.has(r.id))
      .map((r) => ({ id: r.id, emptyNights: Math.max(0, day - 1 - (this.since[r.id] ?? day)) }));
  }

  /**
   * The nights between the last roll and `day`, rolled one by one (sleeping and time away count each night). `line` is read before
   * each night, so an arrival changes who is next; `arrive` applies it. Returns the arrivals in order.
   */
  advance(day: number, rooms: () => readonly RoomInput[], line: () => readonly Newcomer[], rng: () => number, arrive: (a: Arrival, day: number) => void): Arrival[] {
    if (this.last === 0 || day < this.last) {
      this.last = day;
      return [];
    }
    const n = Math.min(MAX_NIGHTS, day - this.last);
    this.last = day;
    const out: Arrival[] = [];
    for (let k = 1; k <= n; k++) {
      const nightDay = day - n + k;
      const r = rollNight({ arrived: [] }, this.freeRooms(nightDay, rooms()), line(), rng);
      if (!r.arrival) continue;
      this.occ[r.arrival.personId] = r.arrival.roomId;
      this.log.push([r.arrival.personId, r.arrival.roomId, nightDay]);
      if (this.log.length > 12) this.log.shift();
      out.push(r.arrival);
      arrive(r.arrival, nightDay);
    }
    return out;
  }

  /** Residents whose room stopped being valid (or vanished) move to a free valid room, or to the camp. */
  evict(rooms: readonly RoomInput[]): Eviction[] {
    const { occupancy, moved } = evictBroken(this.occ, rooms);
    this.occ = { ...occupancy };
    return moved;
  }

  /** Moves a person to the camp's place when they are nobody's: used when a resident's room is gone. */
  vacate(id: string): void {
    delete this.occ[id];
  }

  /** Each room as the housing view shows it, with its label. */
  housing(rooms: readonly RoomInput[], labels: Readonly<Record<string, string>>): HousingRow[] {
    return roomViews(rooms, this.occ).map((v) => ({ ...v, label: labels[v.id] ?? (v.id.startsWith(HOUSE_ROOM) ? 'House' : v.id.startsWith(BED_ROOM) ? 'Your room' : v.id), built: v.id.startsWith(BED_ROOM) }));
  }

  /** The person next in the line and what holds them back, or null when everyone has come. */
  next(line: readonly Newcomer[], rooms: readonly RoomInput[]): NextInLine | null {
    const free = this.freeRooms(Infinity, rooms).length > 0;
    return nextInLine(line, free);
  }

  // ---- contentment ----

  setScores(scores: Record<string, Contentment>): void {
    this.scores = scores;
  }

  /** In [-1, 1]; 0 for someone not yet scored. */
  scoreOf(id: string): number {
    return this.scores[id]?.score ?? 0;
  }

  reasonsOf(id: string): readonly string[] {
    return this.scores[id]?.reasons ?? [];
  }

  /** The mean of the residents' scores (0 with none): the town's mood. */
  mood(): number {
    const v = Object.values(this.scores);
    return v.length === 0 ? 0 : v.reduce((s, c) => s + c.score, 0) / v.length;
  }

  // ---- save ----

  toJSON(): SettlementSnapshot {
    return { last: this.last, since: { ...this.since }, occ: { ...this.occ }, log: this.log.map((l) => [...l] as [string, string, number]), houses: [...this.houses], away: { ...this.away } };
  }

  load(raw: unknown): void {
    this.last = 0;
    this.since = {};
    this.occ = {};
    this.log = [];
    this.houses = [];
    this.away = {};
    this.scores = {};
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<SettlementSnapshot>;
    if (typeof r.last === 'number' && Number.isFinite(r.last) && r.last >= 0) this.last = Math.floor(r.last);
    if (r.since && typeof r.since === 'object') for (const [k, v] of Object.entries(r.since)) if (typeof v === 'number' && Number.isFinite(v)) this.since[k] = v;
    if (r.occ && typeof r.occ === 'object') for (const [k, v] of Object.entries(r.occ)) if (typeof v === 'string') this.occ[k] = v;
    for (const l of Array.isArray(r.log) ? r.log : []) if (Array.isArray(l) && typeof l[0] === 'string' && typeof l[1] === 'string' && Number.isFinite(l[2])) this.log.push([l[0], l[1], l[2]]);
    this.log = this.log.slice(-12);
    for (const h of Array.isArray(r.houses) ? r.houses : []) if (typeof h === 'string' && h.startsWith(HOUSE_ROOM)) this.houses.push(h);
    if (r.away && typeof r.away === 'object') for (const [k, v] of Object.entries(r.away)) if (typeof v === 'number' && Number.isFinite(v)) this.away[k] = v;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Where people stand, and what is around them
// ---------------------------------------------------------------------------------------------------------------

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/**
 * The contentment of each resident. `spotOf` is where they live (a room's bed, or the common room for someone with no room of their
 * own); `housed` says whether they have a room of their own. Neighbours are residents within NEAR; crowding counts only residents
 * who are housed (the common room's regulars are not a crowd), so an old tavern is never "crowded".
 */
export function townContentment(
  residents: readonly string[],
  spotOf: (id: string) => Spot | null,
  housed: (id: string) => boolean,
  tagsAt: (id: string, spot: Spot) => ReadonlySet<Tag>,
  warmthAt?: (id: string, spot: Spot) => number,
): Record<string, Contentment> {
  const people = residents.filter(isPersonId);
  const out: Record<string, Contentment> = {};
  for (const id of people) {
    const spot = spotOf(id);
    if (!spot) continue;
    const neighbours: PersonId[] = [];
    let residentsNearby = 0;
    for (const other of people) {
      if (other === id) continue;
      const o = spotOf(other);
      if (!o || Math.hypot(o.x - spot.x, o.z - spot.z) > NEAR || Math.abs(o.y - spot.y) > 12) continue;
      neighbours.push(other);
      if (housed(other)) residentsNearby++;
    }
    const tags = new Set(tagsAt(id, spot));
    // Quiet: no forge or fumes about, and few housed neighbours.
    if (!tags.has('forge') && !tags.has('fumes') && !tags.has('noise') && residentsNearby <= 2) tags.add('quiet');
    out[id] = contentment(id, { neighbours, tags, residentsNearby, warmth: warmthAt?.(id, spot) });
  }
  return out;
}

const BLOCK_TAGS: ReadonlyArray<readonly [Tag, (key: string) => boolean]> = [
  ['water', (k) => k === 'water'],
  ['trees', (k) => k.endsWith('_leaves')],
  ['forge', (k) => k.includes('anvil') || k.includes('blast') || k.startsWith('arc_') || k.startsWith('plasma_')],
  ['fumes', (k) => k.includes('still') || k.includes('distill') || k === 'boiling_flask'],
  ['hearth', (k) => k.startsWith('furnace') || k === 'campfire'],
  // Power and light (docs/api/contentment.md): a lit lamp pleases some, a running engine annoys others.
  ['lights', (k) => k === 'lamp' || k === 'kerosene_lamp'],
  ['noise', (k) => k === 'steam_engine' || k === 'combustion_engine' || k === 'burner_generator' || k === 'dynamo'],
];
const ACTIVE_TAGS: ReadonlySet<Tag> = new Set<Tag>(['lights', 'noise']);
/** How many matching blocks make a surrounding count (a single leaf is not a wood). */
const TAG_MIN: Readonly<Partial<Record<Tag, number>>> = { trees: 6, water: 3, noise: 2 };

/** The surrounding tags at a spot, from samples of the blocks around it (radius 9, every third column, y -2..5). */
export function sampleTags(blockAt: (x: number, y: number, z: number) => string | null, at: Spot, activeAt?: (x: number, y: number, z: number) => boolean): Set<Tag> {
  const counts: Partial<Record<Tag, number>> = {};
  const bx = Math.floor(at.x);
  const by = Math.floor(at.y);
  const bz = Math.floor(at.z);
  for (let dx = -9; dx <= 9; dx += 3) {
    for (let dz = -9; dz <= 9; dz += 3) {
      for (let dy = -2; dy <= 5; dy++) {
        const key = blockAt(bx + dx, by + dy, bz + dz);
        if (!key || key === 'air') continue;
        for (const [tag, test] of BLOCK_TAGS) {
          if (!test(key)) continue;
          // A lamp only lights and an engine only clatters while it is on (when the caller can tell).
          if (activeAt && ACTIVE_TAGS.has(tag) && !activeAt(bx + dx, by + dy, bz + dz)) continue;
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }
    }
  }
  const out = new Set<Tag>();
  for (const [tag, n] of Object.entries(counts) as [Tag, number][]) if (n >= (TAG_MIN[tag] ?? 1)) out.add(tag);
  return out;
}

/** What each arrival says as they step in (by person). */
export const ARRIVAL_LINES: Readonly<Record<string, string>> = {
  rosa: 'A woman with an apron and a ladle in her belt: "A hearth and a roof and nobody to feed? Not for long. I am Rosa."',
  orrin: 'A thin man with a roll of drawings: "Bronze! I heard the hammering from the road. Orrin, artificer. Where do you keep your gears?"',
  mara: 'A quiet woman with a basket of cuttings: "Something here hums. I am Mara. I will look at your trees first."',
  bram: 'An old man with a stick and no hurry: "Enough chimneys that I could smell supper from the ridge. Bram. Do not talk to me before noon."',
  veyra: 'A tall woman, her sleeves stained green: "Glass and spirit, I hear. I am Veyra, and I would like a table by the water."',
};

export const nameOfPerson = (id: string): string => (isPersonId(id) ? NAMES[id] : id);

export const ARRIVAL_IDS: readonly string[] = ARRIVALS.map((a) => a.id);
