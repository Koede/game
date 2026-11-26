/**
 * The Journal: a short, automatic diary of what the player has done, plus an explored-ground map that fills in as they walk.
 * DOM-free. It listens to the bus (objectives, ages, firsts, deaths, weather) and is fed the player's position by the game
 * loop; nothing here needs the player to write anything down. Saved as an optional `journal` field of the world save.
 */
import type { GameBus } from '../core/context';
import { AGES, OBJECTIVES, itemOrNull } from '../core/registry';

/** Newest entries kept (the oldest drop off). */
export const MAX_ENTRIES = 160;
/** Blocks per map cell (a cell is a square this many blocks on a side). */
export const CELL = 4;
/** Cells per region side; one region is a bitset of REGION^2 bits. */
export const REGION = 64;
/** How far around the player the ground counts as seen, in blocks. */
export const SIGHT = 14;

export type JournalKind = 'age' | 'goal' | 'first' | 'death' | 'storm' | 'note';

export interface JournalEntry {
  /** In-game day the entry was made. */
  day: number;
  kind: JournalKind;
  text: string;
  /** Optional dedupe key: an entry with a key already present is never written twice ("first:furnace"). */
  key?: string;
}

export interface JournalSnapshot {
  entries: JournalEntry[];
  /** region "rx,rz" -> base64 bitset of visited cells. */
  seen: Record<string, string>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const KINDS: readonly string[] = ['age', 'goal', 'first', 'death', 'storm', 'note'];

export function isJournalSnapshot(v: unknown): v is JournalSnapshot {
  if (!isRecord(v) || !Array.isArray(v.entries) || !isRecord(v.seen)) return false;
  const entriesOk = v.entries.every(
    (e) => isRecord(e) && typeof e.day === 'number' && typeof e.text === 'string' && KINDS.includes(e.kind as string) && (e.key === undefined || typeof e.key === 'string'),
  );
  return entriesOk && Object.values(v.seen).every((s) => typeof s === 'string');
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** An item's display name in lower case ("raw perch"), or its key with spaces when unknown. */
const itemName = (key: string): string => (itemOrNull(key)?.name ?? key.replace(/_/g, ' ')).toLowerCase();

/** Things worth a "first time" line: the event, and how it reads in the diary. */
const FIRST_BLOCKS: Readonly<Record<string, string>> = {
  furnace_clay: 'Built my first clay furnace.',
  workbench: 'Set up a workbench.',
  campfire: 'Lit a campfire.',
};

export class Journal {
  readonly entries: JournalEntry[] = [];
  private readonly regions = new Map<string, Uint8Array>();
  private readonly keys = new Set<string>();
  private readonly offs: Array<() => void> = [];
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  private cells = 0;

  /** `day` reads the in-game day for the date stamp. Without a bus the journal is just a store (tests, tools). */
  constructor(private readonly day: () => number, bus?: GameBus) {
    if (bus) this.listen(bus);
  }

  private listen(bus: GameBus): void {
    this.offs.push(
      bus.on('objective:completed', ({ id }) => {
        const spec = OBJECTIVES.find((o) => o.id === id);
        if (spec) this.add('goal', `Done: ${spec.title}.`, `goal:${id}`);
      }),
      bus.on('age:advanced', ({ age }) => {
        const spec = AGES[age];
        if (spec) this.add('age', `A new age begins: ${spec.name}. ${spec.blurb}`, `age:${age}`);
      }),
      bus.on('player:death', ({ cause }) => this.add('death', `I died (${cause}).`)),
      bus.on('weather:changed', ({ kind }) => {
        if (kind === 'storm') this.add('storm', 'Caught out in a storm.', 'first:storm');
      }),
      bus.on('mob:died', ({ species }) => this.add('first', `Brought down my first ${species.replace(/_/g, ' ')}.`, `first:kill:${species}`)),
      bus.on('item:made', ({ item }) => this.noteFirstMade(item)),
      bus.on('fish:caught', ({ item }) => this.add('first', `Landed my first fish: ${itemName(item)}.`, 'first:fish')),
      bus.on('waypoint:travelled', ({ to }) => this.add('first', `Stepped through a waypoint stone to ${to}.`, 'first:waypoint')),
      bus.on('treasure:dug', () => this.add('first', 'Dug up a buried treasure crate.', 'first:treasure')),
      bus.on('enchant:applied', ({ item }) => this.add('first', `Enchanted my ${itemName(item)} at the altar.`, 'first:enchant')),
      bus.on('pet:tamed', ({ species }) => this.add('first', `A stray ${species.replace(/_/g, ' ')} decided I was worth following.`, 'first:pet')),
      bus.on('town:built', () => this.add('first', 'Gruk finished the first building of the town.', 'first:town_building')),
      bus.on('town:bounty', ({ item }) => this.add('first', `Filled my first build bounty for Gruk: ${itemName(item)}.`, 'first:bounty')),
    );
  }

  /** "First time I made X" lines, but only for a short list so the diary stays readable. */
  private noteFirstMade(item: string): void {
    const text = FIRST_BLOCKS[item];
    if (text) this.add('first', text, `first:made:${item}`);
  }

  /** True when an entry with this key was written. */
  has(key: string): boolean {
    return this.keys.has(key);
  }

  /** Writes an entry unless its key was already used. Returns true when written. */
  add(kind: JournalKind, text: string, key?: string): boolean {
    if (key !== undefined) {
      if (this.keys.has(key)) return false;
      this.keys.add(key);
    }
    this.entries.push({ day: this.day(), kind, text, ...(key !== undefined ? { key } : {}) });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    return true;
  }

  // ---- the map ----

  private mark(cx: number, cz: number): boolean {
    const rx = Math.floor(cx / REGION);
    const rz = Math.floor(cz / REGION);
    const rk = `${rx},${rz}`;
    let bits = this.regions.get(rk);
    if (!bits) {
      bits = new Uint8Array((REGION * REGION) >> 3);
      this.regions.set(rk, bits);
    }
    const i = (cz - rz * REGION) * REGION + (cx - rx * REGION);
    const mask = 1 << (i & 7);
    if (bits[i >> 3] & mask) return false;
    bits[i >> 3] |= mask;
    this.cells++;
    return true;
  }

  /** Marks the ground around a position as seen. Cheap when the player stays inside the same cell. */
  explore(x: number, z: number): void {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx;
    this.lastCz = cz;
    const r = Math.ceil(SIGHT / CELL);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) this.mark(cx + dx, cz + dz);
  }

  /** True when the cell holding the block position has been seen. */
  isSeen(x: number, z: number): boolean {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const rx = Math.floor(cx / REGION);
    const rz = Math.floor(cz / REGION);
    const bits = this.regions.get(`${rx},${rz}`);
    if (!bits) return false;
    const i = (cz - rz * REGION) * REGION + (cx - rx * REGION);
    return (bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** How many map cells have been seen (a rough "how much of the world I know" figure). */
  get seenCells(): number {
    return this.cells;
  }

  /** Square blocks of ground seen. */
  get seenBlocks(): number {
    return this.cells * CELL * CELL;
  }

  /** Bounding box of seen cells in block coordinates, or null when nothing was seen. */
  bounds(): { minX: number; minZ: number; maxX: number; maxZ: number } | null {
    if (this.cells === 0) return null;
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const [rk, bits] of this.regions) {
      const [rx, rz] = rk.split(',').map(Number);
      for (let i = 0; i < REGION * REGION; i++) {
        if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
        const cx = rx * REGION + (i % REGION);
        const cz = rz * REGION + Math.floor(i / REGION);
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cz < minZ) minZ = cz;
        if (cz > maxZ) maxZ = cz;
      }
    }
    return { minX: minX * CELL, minZ: minZ * CELL, maxX: (maxX + 1) * CELL, maxZ: (maxZ + 1) * CELL };
  }

  // ---- save ----

  toJSON(): JournalSnapshot {
    const seen: Record<string, string> = {};
    for (const [rk, bits] of this.regions) if (bits.some((b) => b !== 0)) seen[rk] = toBase64(bits);
    return { entries: this.entries.map((e) => ({ ...e })), seen };
  }

  load(snap: JournalSnapshot): void {
    this.entries.length = 0;
    this.keys.clear();
    this.regions.clear();
    this.cells = 0;
    for (const e of snap.entries.slice(-MAX_ENTRIES)) {
      this.entries.push({ ...e });
      if (e.key !== undefined) this.keys.add(e.key);
    }
    const size = (REGION * REGION) >> 3;
    for (const [rk, text] of Object.entries(snap.seen)) {
      if (!/^-?\d+,-?\d+$/.test(rk)) continue;
      let bits: Uint8Array;
      try {
        bits = fromBase64(text);
      } catch {
        continue;
      }
      if (bits.length !== size) continue;
      this.regions.set(rk, bits);
      for (const b of bits) {
        let v = b;
        while (v) {
          this.cells += v & 1;
          v >>= 1;
        }
      }
    }
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }
}

/** The welcome-back line when a saved world is picked up again: where you are in the story and the last thing done. */
export function resumeLine(day: number, goalTitle: string | null, last: JournalEntry | undefined): string {
  const parts = [`Welcome back - day ${day}.`];
  if (last) parts.push(`Last: ${last.text}`);
  if (goalTitle) parts.push(`Next: ${goalTitle}.`);
  return parts.join(' ');
}

/** A one-line summary for the pause menu or title: "Day 12 - 4 goals - 38,000 blocks explored". */
export function journalSummary(j: Journal): string {
  const goals = j.entries.filter((e) => e.kind === 'goal').length;
  return `${goals} goal${goals === 1 ? '' : 's'} done, ${j.seenBlocks.toLocaleString('en-US')} blocks of ground known`;
}
