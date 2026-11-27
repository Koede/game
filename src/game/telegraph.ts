/**
 * The telegraph and radio network (docs/api/telegraph.md). Telegraph poles carry a copper line to every pole, office or
 * mast within `TELEGRAPH_SPAN` blocks; a radio mast fed `RADIO_MIN_W` talks to every other powered mast within
 * `RADIO_RANGE`, with no poles between. Each joined set is one network. A network that reaches the town (within
 * `TOWN_REACH` of the settlement's origin) hears its news and can order from the caravan by wire.
 *
 * An office on a network hears a storm coming `STORM_WIRE_S` ahead (`RADIO_STORM_S` when a powered mast is on it) and
 * works the workshop's signal layer in one of three modes: a storm bell (lit while a storm is due or overhead), a sender
 * (reads any lit signal touching it) and a receiver (lit while any sender on its network is). DOM-free; `GameState` ticks
 * it and saves it under the world extra `telegraph`.
 */
import type { GameBus } from '../core/context';
import { CHUNK_SIZE, voxelActive, withActive, type IWorld, type WeatherState } from '../core/types';
import { stormLevel } from './weather';
import type { WeatherSchedule } from './weatherSchedule';

export type TelegraphKind = 'pole' | 'office' | 'mast';
export const TELEGRAPH_BLOCKS: Readonly<Record<string, TelegraphKind>> = { telegraph_pole: 'pole', telegraph_office: 'office', radio_mast: 'mast' };
/** A copper line reaches this far (blocks, straight line) from a pole, office or mast. */
export const TELEGRAPH_SPAN = 12;
/** Two powered radio masts talk up to this far apart. */
export const RADIO_RANGE = 160;
/** Watts a mast needs on the cable or device beside it to be on air. */
export const RADIO_MIN_W = 100;
/** How far ahead (world seconds) a wire hears a storm, and a network with a powered mast. */
export const STORM_WIRE_S = 600;
export const RADIO_STORM_S = 1200;
/** A network with a member this close (blocks, level distance) to the settlement's origin reaches the town. */
export const TOWN_REACH = 24;
/** Telegrams kept for the office screen. */
export const LOG_SIZE = 8;

/** The office's signal modes, in the order Use on the screen cycles them. */
export const OFFICE_MODES = [
  { key: 'storm', name: 'Storm bell', text: 'Lights the signal while a storm is due or overhead.' },
  { key: 'send', name: 'Sender', text: 'Reads a lit signal touching the office and sends it down the line.' },
  { key: 'receive', name: 'Receiver', text: 'Lights the signal while any sender on this network is lit.' },
] as const;
export type OfficeMode = (typeof OFFICE_MODES)[number]['key'];

export interface TelegraphNode {
  kind: TelegraphKind;
  x: number;
  y: number;
  z: number;
  /** Offices only: index into OFFICE_MODES. */
  mode: number;
}

export interface Telegram {
  day: number;
  text: string;
}

/** The weather as the telegraph reads it: the live state, the timetable and any debug override. */
export interface TelegraphSky {
  readonly state: WeatherState;
  readonly schedule: WeatherSchedule;
  readonly override: { readonly kind: string } | null;
}

export interface TelegraphHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  sky(): TelegraphSky;
  /** World time (GameClock.worldTimeS) and the 1-based day. */
  now(): number;
  day(): number;
  /** The settlement's origin, or null in a world without one. */
  town(): readonly [number, number, number] | null;
  /** Watts a mast at (x, y, z) can draw from what touches it (generation + discharge of that grid). */
  powerW(x: number, y: number, z: number): number;
  /** The workshop's signal layer: a lit cell touches (x, y, z); light (x, y, z) as a source. */
  signalIn(x: number, y: number, z: number): boolean;
  signalOut(x: number, y: number, z: number, on: boolean): void;
  /** The caravan is in town on this day (src/game/caravan.ts). */
  caravanDay(day: number): boolean;
}

/** One joined set of nodes, as the office screen shows it. */
export interface NetworkView {
  offices: number;
  poles: number;
  masts: number;
  /** Masts on air. */
  onAir: number;
  town: boolean;
  /** Seconds ahead this network hears a storm. */
  horizonS: number;
  /** The other offices and masts, nearest first. */
  stations: { kind: TelegraphKind; x: number; y: number; z: number; dist: number }[];
}

export interface TelegraphSnapshot {
  v: 1;
  nodes: [number, number, number, number, number][];
  log: Telegram[];
  /** Index of the weather segment last warned about (-1 none); `heard` = a forced storm already announced. */
  warned: number;
  caravanDay: number;
  /** Masts on air when saved, so a mast in a chunk not loaded yet keeps its radio link after a reload. */
  powered?: [number, number, number][];
}

const KINDS: readonly TelegraphKind[] = ['pole', 'office', 'mast'];
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const TICK_S = 0.5;
/** Mast power is looked at this often. */
const POWER_S = 1;

/** Seconds until a storm is overhead (0 while one is), looking at most `horizonS` ahead; null when none is due. */
export function stormDueIn(sky: TelegraphSky, timeS: number, horizonS: number): number | null {
  const s = sky.state;
  if (stormLevel(s) >= 0.5 || s.kind === 'storm') return 0;
  if (sky.override) return s.next === 'storm' && s.nextInS <= horizonS ? s.nextInS : null;
  const here = sky.schedule.at(timeS);
  for (let i = here.index + 1; i < here.index + 64; i++) {
    const seg = sky.schedule.segment(i);
    const inS = seg.startS - timeS;
    if (inS > horizonS) return null;
    if (seg.kind === 'storm') return Math.max(0, inS);
  }
  return null;
}

/** The weather segment index of the storm `stormDueIn` found (for warning once per storm). */
function stormIndex(sky: TelegraphSky, timeS: number, horizonS: number): number {
  const here = sky.schedule.at(timeS);
  if (here.kind === 'storm' || sky.override) return here.index;
  for (let i = here.index + 1; i < here.index + 64; i++) {
    const seg = sky.schedule.segment(i);
    if (seg.startS - timeS > horizonS) break;
    if (seg.kind === 'storm') return i;
  }
  return here.index;
}

const minutes = (s: number): string => {
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min`;
};

export class Telegraph {
  private readonly nodes = new Map<string, TelegraphNode>();
  /** Network id per node key (union-find roots, rebuilt when dirty). */
  private netOf = new Map<string, number>();
  private wires: [TelegraphNode, TelegraphNode][] = [];
  private dirty = true;
  private powered = new Set<string>();
  private powerIn = 0;
  private tickIn = 0;
  /** Offices driving their signal now, and senders lit now. */
  private driving = new Set<string>();
  private sending = new Set<string>();
  private log: Telegram[] = [];
  private warned = -1;
  private caravanSeen = 0;
  /** Grows whenever the wiring changes (the wire renderer redraws). */
  version = 0;
  private readonly offs: (() => void)[] = [];

  constructor(private readonly host: TelegraphHost) {
    this.offs.push(host.bus.on('block:changed', (e) => this.note(e.x, e.y, e.z)));
    this.offs.push(host.bus.on('chunk:loaded', (e) => this.verifyChunk(e.cx, e.cz)));
  }

  dispose(): void {
    for (const off of this.offs.splice(0)) off();
  }

  /** A block changed at (x, y, z): adds, keeps or drops the node there. */
  note(x: number, y: number, z: number): void {
    const key = k3(x, y, z);
    const kind = TELEGRAPH_BLOCKS[this.host.world.getBlock(x, y, z).key];
    const had = this.nodes.get(key);
    if (kind && had?.kind === kind) return;
    if (had) {
      this.nodes.delete(key);
      if (this.driving.delete(key)) this.host.signalOut(x, y, z, false);
      this.sending.delete(key);
    }
    if (kind) this.nodes.set(key, { kind, x, y, z, mode: 0 });
    if (kind || had) this.touch();
  }

  private touch(): void {
    this.dirty = true;
    this.version++;
  }

  /** A chunk came in: nodes saved there that are no longer telegraph blocks are dropped. */
  private verifyChunk(cx: number, cz: number): void {
    let gone = false;
    for (const [key, n] of this.nodes) {
      if (Math.floor(n.x / CHUNK_SIZE) !== cx || Math.floor(n.z / CHUNK_SIZE) !== cz) continue;
      if (TELEGRAPH_BLOCKS[this.host.world.getBlock(n.x, n.y, n.z).key] === n.kind) continue;
      this.nodes.delete(key);
      gone = true;
    }
    if (gone) this.touch();
  }

  node(x: number, y: number, z: number): TelegraphNode | null {
    return this.nodes.get(k3(x, y, z)) ?? null;
  }

  get size(): number {
    return this.nodes.size;
  }

  /** Copper lines between nodes, for the renderer (a spanning tree: every node joined, no tangle of crossing lines). */
  lines(): readonly [TelegraphNode, TelegraphNode][] {
    this.rebuild();
    return this.wires;
  }

  /** The mast at (x, y, z) is on air. */
  onAir(x: number, y: number, z: number): boolean {
    return this.powered.has(k3(x, y, z));
  }

  /** Rebuilds the networks: wired spanning tree (shortest lines first), then radio links between powered masts. */
  private rebuild(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const list = [...this.nodes.values()];
    const keys = list.map((n) => k3(n.x, n.y, n.z));
    const parent = list.map((_, i) => i);
    const find = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    // Bucket by span-sized cells so only neighbours are compared.
    const cell = (v: number): number => Math.floor(v / TELEGRAPH_SPAN);
    const buckets = new Map<string, number[]>();
    list.forEach((n, i) => {
      const b = `${cell(n.x)},${cell(n.y)},${cell(n.z)}`;
      (buckets.get(b) ?? buckets.set(b, []).get(b) as number[]).push(i);
    });
    // A pole or mast with another one stacked on it is part of a taller post: it joins the one above, and only the top
    // of the post carries lines.
    const index = new Map(keys.map((k, i) => [k, i]));
    const under = list.map((n) => {
      if (n.kind === 'office') return -1;
      const up = index.get(k3(n.x, n.y + 1, n.z));
      return up !== undefined && list[up].kind !== 'office' ? up : -1;
    });
    under.forEach((up, i) => {
      if (up >= 0) parent[find(i)] = find(up);
    });
    const pairs: [number, number, number][] = [];
    list.forEach((n, i) => {
      if (under[i] >= 0) return;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const j of buckets.get(`${cell(n.x) + dx},${cell(n.y) + dy},${cell(n.z) + dz}`) ?? []) {
          if (j <= i || under[j] >= 0) continue;
          const m = list[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y, n.z - m.z);
          if (d <= TELEGRAPH_SPAN) pairs.push([d, i, j]);
        }
      }
    });
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    this.wires = [];
    for (const [, i, j] of pairs) {
      const a = find(i), b = find(j);
      if (a === b) continue;
      parent[a] = b;
      this.wires.push([list[i], list[j]]);
    }
    const masts = list.map((n, i) => i).filter((i) => this.powered.has(keys[i]));
    for (let a = 0; a < masts.length; a++) for (let b = a + 1; b < masts.length; b++) {
      const m = list[masts[a]], n = list[masts[b]];
      if (Math.hypot(m.x - n.x, m.y - n.y, m.z - n.z) <= RADIO_RANGE) parent[find(masts[a])] = find(masts[b]);
    }
    this.netOf = new Map(keys.map((k, i) => [k, find(i)]));
  }

  private netKey(x: number, y: number, z: number): number | null {
    this.rebuild();
    return this.netOf.get(k3(x, y, z)) ?? null;
  }

  private members(net: number): TelegraphNode[] {
    const out: TelegraphNode[] = [];
    for (const [k, id] of this.netOf) if (id === net) out.push(this.nodes.get(k) as TelegraphNode);
    return out;
  }

  private reachesTown(members: readonly TelegraphNode[]): boolean {
    const t = this.host.town();
    if (!t) return false;
    return members.some((n) => Math.hypot(n.x - t[0], n.z - t[2]) <= TOWN_REACH);
  }

  private horizonOf(members: readonly TelegraphNode[]): number {
    return members.some((n) => n.kind === 'mast' && this.powered.has(k3(n.x, n.y, n.z))) ? RADIO_STORM_S : STORM_WIRE_S;
  }

  /** What the office (or mast) at (x, y, z) is joined to; null when nothing telegraph stands there. */
  view(x: number, y: number, z: number): NetworkView | null {
    const net = this.netKey(x, y, z);
    if (net === null) return null;
    const members = this.members(net);
    const count = (k: TelegraphKind): number => members.filter((n) => n.kind === k).length;
    return {
      offices: count('office'),
      poles: count('pole'),
      masts: count('mast'),
      onAir: members.filter((n) => n.kind === 'mast' && this.powered.has(k3(n.x, n.y, n.z))).length,
      town: this.reachesTown(members),
      horizonS: this.horizonOf(members),
      stations: members
        .filter((n) => n.kind !== 'pole' && (n.x !== x || n.y !== y || n.z !== z) && !(n.kind === 'mast' && this.nodes.get(k3(n.x, n.y + 1, n.z))?.kind === 'mast'))
        .map((n) => ({ kind: n.kind, x: n.x, y: n.y, z: n.z, dist: Math.round(Math.hypot(n.x - x, n.y - y, n.z - z)) }))
        .sort((a, b) => a.dist - b.dist),
    };
  }

  /** The storm the office at (x, y, z) hears: seconds until it is overhead (0 = now), or null. */
  stormFor(x: number, y: number, z: number): number | null {
    const net = this.netKey(x, y, z);
    if (net === null) return null;
    return stormDueIn(this.host.sky(), this.host.now(), this.horizonOf(this.members(net)));
  }

  mode(x: number, y: number, z: number): OfficeMode | null {
    const n = this.nodes.get(k3(x, y, z));
    return n?.kind === 'office' ? OFFICE_MODES[n.mode].key : null;
  }

  /** Sets an office's signal mode. Returns false when no office stands there. */
  setMode(x: number, y: number, z: number, mode: OfficeMode): boolean {
    const n = this.nodes.get(k3(x, y, z));
    const i = OFFICE_MODES.findIndex((m) => m.key === mode);
    if (n?.kind !== 'office' || i < 0) return false;
    n.mode = i;
    this.tickIn = 0;
    return true;
  }

  /** Whether the office at (x, y, z) is lighting its signal (storm bell, receiver) or sending now. */
  busy(x: number, y: number, z: number): boolean {
    const key = k3(x, y, z);
    return this.driving.has(key) || this.sending.has(key);
  }

  telegrams(): readonly Telegram[] {
    return this.log;
  }

  private telegram(text: string, kind: 'info' | 'warn' = 'info', at?: TelegraphNode): void {
    this.log.unshift({ day: this.host.day(), text });
    this.log.length = Math.min(this.log.length, LOG_SIZE);
    this.host.bus.emit('toast', { text: `Telegram: ${text}`, kind });
    if (at) this.host.bus.emit('sfx', { name: 'dig_metal', x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5, pitch: 2.2, volume: 0.4 });
  }

  tick(dt: number): void {
    if (this.nodes.size === 0) return;
    this.powerIn -= dt;
    if (this.powerIn <= 0) {
      this.powerIn = POWER_S;
      this.checkPower();
    }
    this.tickIn -= dt;
    if (this.tickIn > 0) return;
    this.tickIn = TICK_S;
    this.rebuild();
    const sky = this.host.sky();
    const now = this.host.now();
    // Group by network once.
    const nets = new Map<number, TelegraphNode[]>();
    for (const [k, id] of this.netOf) (nets.get(id) ?? nets.set(id, []).get(id) as TelegraphNode[]).push(this.nodes.get(k) as TelegraphNode);
    let warnIn: number | null = null;
    let warnHorizon = STORM_WIRE_S;
    let warnAt: TelegraphNode | undefined;
    const sending = new Set<string>();
    for (const members of nets.values()) for (const n of members) {
      if (n.kind === 'office' && OFFICE_MODES[n.mode].key === 'send' && this.host.signalIn(n.x, n.y, n.z)) sending.add(k3(n.x, n.y, n.z));
    }
    const driving = new Set<string>();
    for (const members of nets.values()) {
      const offices = members.filter((n) => n.kind === 'office');
      if (offices.length === 0) continue;
      const horizon = this.horizonOf(members);
      const storm = stormDueIn(sky, now, horizon);
      if (storm !== null && (warnIn === null || horizon > warnHorizon)) {
        warnIn = storm;
        warnHorizon = horizon;
        warnAt = offices[0];
      }
      const anySender = offices.some((o) => sending.has(k3(o.x, o.y, o.z)));
      for (const o of offices) {
        const mode = OFFICE_MODES[o.mode].key;
        if ((mode === 'storm' && storm !== null) || (mode === 'receive' && anySender)) driving.add(k3(o.x, o.y, o.z));
      }
      if (this.reachesTown(members)) this.townNews(offices[0]);
    }
    if (warnIn !== null) {
      const idx = stormIndex(sky, now, warnHorizon);
      if (idx !== this.warned) {
        this.warned = idx;
        this.telegram(warnIn <= 0 ? 'A storm is on us. Cover your wiring and stand clear of the boilers.' : `Storm due in about ${minutes(warnIn)}. Cover exposed wiring and raise a lightning rod.`, 'warn', warnAt);
      }
    }
    for (const key of this.driving) if (!driving.has(key)) {
      const n = this.nodes.get(key);
      if (n) this.host.signalOut(n.x, n.y, n.z, false);
    }
    for (const key of driving) {
      const n = this.nodes.get(key) as TelegraphNode;
      this.host.signalOut(n.x, n.y, n.z, true);
    }
    this.driving = driving;
    this.sending = sending;
    for (const n of this.nodes.values()) if (n.kind === 'office') this.showActive(n, this.busy(n.x, n.y, n.z));
  }

  /** News from town over a wire that reaches it: the caravan coming in. Once per caravan day. */
  private townNews(at: TelegraphNode): void {
    const day = this.host.day();
    if (this.caravanSeen === day || !this.host.caravanDay(day)) return;
    this.caravanSeen = day;
    this.telegram('The caravan is in town today. Order from its carts at any office on this line.', 'info', at);
  }

  private checkPower(): void {
    const powered = new Set<string>();
    for (const [key, n] of this.nodes) {
      if (n.kind !== 'mast') continue;
      if (this.host.world.isLoaded(n.x, n.z) ? this.host.powerW(n.x, n.y, n.z) >= RADIO_MIN_W : this.powered.has(key)) powered.add(key);
    }
    const changed = powered.size !== this.powered.size || [...powered].some((k) => !this.powered.has(k));
    this.powered = powered;
    if (changed) this.dirty = true;
    for (const n of this.nodes.values()) if (n.kind === 'mast') this.showActive(n, powered.has(k3(n.x, n.y, n.z)));
  }

  private showActive(n: TelegraphNode, on: boolean): void {
    const w = this.host.world;
    if (!w.isLoaded(n.x, n.z)) return;
    const v = w.getVoxel(n.x, n.y, n.z);
    if (voxelActive(v) !== on) w.setVoxel(n.x, n.y, n.z, withActive(v, on), 'sim');
  }

  toJSON(): TelegraphSnapshot {
    return {
      v: 1,
      nodes: [...this.nodes.values()].map((n) => [n.x, n.y, n.z, KINDS.indexOf(n.kind), n.mode]),
      log: this.log.map((t) => ({ ...t })),
      warned: this.warned,
      caravanDay: this.caravanSeen,
      powered: [...this.powered].map((k) => k.split(',').map(Number) as [number, number, number]),
    };
  }

  load(raw: unknown): void {
    if (!isTelegraphSnapshot(raw)) return;
    this.nodes.clear();
    for (const [x, y, z, kind, mode] of raw.nodes) {
      const k = KINDS[kind];
      if (!k) continue;
      this.nodes.set(k3(x, y, z), { kind: k, x, y, z, mode: k === 'office' && mode >= 0 && mode < OFFICE_MODES.length ? mode : 0 });
    }
    this.log = raw.log.filter((t) => typeof t?.text === 'string' && Number.isFinite(t?.day)).slice(0, LOG_SIZE);
    this.warned = raw.warned;
    this.caravanSeen = raw.caravanDay;
    this.powered = new Set(
      (Array.isArray(raw.powered) ? raw.powered : [])
        .filter((p) => Array.isArray(p) && p.length === 3 && this.nodes.get(k3(p[0], p[1], p[2]))?.kind === 'mast')
        .map((p) => k3(p[0], p[1], p[2])),
    );
    this.touch();
  }
}

export function isTelegraphSnapshot(v: unknown): v is TelegraphSnapshot {
  const s = v as TelegraphSnapshot | null;
  return !!s && s.v === 1 && Array.isArray(s.nodes) && Array.isArray(s.log) && Number.isFinite(s.warned) && Number.isFinite(s.caravanDay)
    && s.nodes.every((n) => Array.isArray(n) && n.length === 5 && n.every((c) => Number.isInteger(c)));
}
