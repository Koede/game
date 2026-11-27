/**
 * Glass and optics (docs/api/optics.md): looking through the spyglass and the telescope, spotting far landmarks, the sky
 * watch, and whether a lighthouse lamp stands on a shore. DOM-free: the app's `beforeUse` hook calls `use`, `update` runs
 * every frame, and the HUD listens for 'optics:view'. The lamp's burning is a machine behaviour (src/sim/machines.ts).
 *
 *  - Spyglass: Use it held to raise it (4x closer), Use again or put it away to lower it.
 *  - Telescope: Use it with anything but a block in hand to look through it (10x); step away or Use again to stop.
 *    Raised at night under open sky, it reads the weather coming (the next changes of the sky's timetable).
 *  - Spotting: while raised, a landmark (a generated structure) held near the middle of the view for SPOT_HOLD_S is
 *    spotted once: a toast with its name, distance and direction, and a line in the Hearth Log.
 */
import type { GameBus } from '../core/context';
import { blockOf, blockOfItem } from '../core/registry';
import { CHUNK_SIZE, WORLD_HEIGHT, type IWorld, type WeatherKind } from '../core/types';
import { STRUCTURE_GRID_CHUNKS, squareStructure } from '../world/structures';
export { COAST_SHARE, LIGHTHOUSE_MIN_HEIGHT, isLighthouse, waterShareAround } from '../world/coast';
import type { PlayerState } from './playerState';

export const SPYGLASS = 'spyglass';
export const TELESCOPE = 'telescope';
export const LIGHTHOUSE_LAMP = 'lighthouse_lamp';

export type OpticsMode = 'none' | 'spyglass' | 'telescope';

/** How much closer each instrument shows things (the camera's field of view is divided by it). */
export const ZOOM: Record<OpticsMode, number> = { none: 1, spyglass: 4, telescope: 10 };
/** How far each instrument can spot a landmark (blocks, horizontal). */
export const SPOT_RANGE: Record<OpticsMode, number> = { none: 0, spyglass: 280, telescope: 520 };
/** Half-angle (radians) of the middle of the view a landmark must sit in to be spotted. */
export const SPOT_CONE: Record<OpticsMode, number> = { none: 0, spyglass: (5 * Math.PI) / 180, telescope: (3 * Math.PI) / 180 };
/** How far above or below level (radians, beyond the cone) the view may tilt and still hold a landmark: towers rise, hills fall. */
export const HORIZON_SLACK = 0.12;
/** Seconds a landmark must stay in the middle of the view. */
export const SPOT_HOLD_S = 0.8;
/** Seconds between looks for the landmark in view. */
const LOOK_S = 0.2;
/** The telescope is left when the player walks this far from it (blocks). */
export const TELESCOPE_LEASH = 2.5;

export interface Landmark {
  key: string;
  name: string;
  x: number;
  z: number;
}

/** The view the HUD draws while an instrument is raised. `target` is the landmark in the middle of the view, if any. */
export interface OpticsView {
  mode: OpticsMode;
  zoom: number;
  target: { name: string; distance: number; direction: string; spotted: boolean } | null;
}

export interface OpticsSave {
  spotted: string[];
}

const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** Compass word for the direction from (px, pz) to (tx, tz): north is -Z, east +X. */
export function directionWord(px: number, pz: number, tx: number, tz: number): string {
  const heading = Math.atan2(tx - px, -(tz - pz));
  const i = Math.round(heading / (Math.PI / 4));
  return DIRECTIONS[((i % 8) + 8) % 8];
}

const wrap = (a: number): number => {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
};

/** Angle (radians, signed) between the view's heading at `yaw` and the direction to (tx, tz); same frame as the HUD compass. */
export function offAxis(px: number, pz: number, yaw: number, tx: number, tz: number): number {
  return wrap(Math.atan2(tx - px, -(tz - pz)) + yaw);
}

/** Every generated structure whose middle lies within `range` blocks of (x, z). */
export function landmarksNear(seed: number, x: number, z: number, range: number): Landmark[] {
  const square = STRUCTURE_GRID_CHUNKS * CHUNK_SIZE;
  const out: Landmark[] = [];
  const s0x = Math.floor((x - range) / square);
  const s1x = Math.floor((x + range) / square);
  const s0z = Math.floor((z - range) / square);
  const s1z = Math.floor((z + range) / square);
  for (let sz = s0z; sz <= s1z; sz++) {
    for (let sx = s0x; sx <= s1x; sx++) {
      const s = squareStructure(seed, sx, sz);
      if (!s) continue;
      const cx = s.x0 + s.def.w / 2;
      const cz = s.z0 + s.def.d / 2;
      if (Math.hypot(cx - x, cz - z) > range) continue;
      out.push({ key: `${s.def.key}@${s.x0},${s.z0}`, name: s.def.name, x: cx, z: cz });
    }
  }
  return out;
}

/** The landmark nearest the middle of the view within `cone` and `range` (never the one the player stands in), or null. */
export function landmarkInView(marks: readonly Landmark[], px: number, pz: number, yaw: number, cone: number, range: number, pitch = 0): Landmark | null {
  // Landmarks stand near the horizon: a view tilted well up (at the stars) or down sees none of them.
  if (Math.abs(pitch) > cone + HORIZON_SLACK) return null;
  let best: Landmark | null = null;
  let bestOff = cone;
  for (const m of marks) {
    const d = Math.hypot(m.x - px, m.z - pz);
    if (d < 12 || d > range) continue;
    const off = Math.abs(offAxis(px, pz, yaw, m.x, m.z));
    if (off <= bestOff) {
      bestOff = off;
      best = m;
    }
  }
  return best;
}

/** Nothing solid above (x, y, z): the sky is open to the stars. */
export function skyOpen(world: IWorld, x: number, y: number, z: number): boolean {
  for (let cy = Math.floor(y) + 1; cy < WORLD_HEIGHT; cy++) if (blockOf(world.getVoxel(x, cy, z)).opaque) return false;
  return true;
}

const SKY_WORDS: Record<WeatherKind, string> = { clear: 'clear skies', cloudy: 'cloud', rain: 'rain', storm: 'a storm' };

/** What the stars say: the sky now and the next change, with roughly when. */
export function skyReading(now: WeatherKind, next: WeatherKind, nextInS: number): string {
  const minutes = Math.max(1, Math.round(nextInS / 60));
  const when = minutes < 2 ? 'within the minute' : minutes < 60 ? `in about ${minutes} minutes` : `in about ${Math.round(minutes / 60)} hours`;
  if (next === now) return `The stars say ${SKY_WORDS[now]}, and more of it to come.`;
  return `The stars say ${SKY_WORDS[now]} now, and ${SKY_WORDS[next]} ${when}.`;
}

export interface OpticsHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  readonly seed: number;
  /** Narrows or restores the camera's view (1 = normal). */
  setZoom(zoom: number): void;
  isNight(): boolean;
  /** The weather now and its next change (WeatherState). */
  weather(): { kind: WeatherKind; next: WeatherKind; nextInS: number };
}

/** The instruments' state: which one is raised, the landmark being held in view, and every landmark spotted so far. */
export class Optics {
  private mode: OpticsMode = 'none';
  private scope: { x: number; y: number; z: number } | null = null;
  private readonly spotted = new Set<string>();
  private lookIn = 0;
  private holding: Landmark | null = null;
  private heldS = 0;
  private marks: Landmark[] = [];
  private marksAt = { x: Number.NaN, z: Number.NaN, range: 0 };
  private shownKey = '';

  constructor(private readonly host: OpticsHost) {}

  get raised(): OpticsMode {
    return this.mode;
  }

  hasSpotted(key: string): boolean {
    return this.spotted.has(key);
  }

  /** Use: raise or lower the spyglass in hand, or look through the telescope aimed at. Null when this Use is not ours. */
  use(hit: { x: number; y: number; z: number; block: { key: string } } | null, held: string | null): 'worked' | null {
    if (hit && hit.block.key === TELESCOPE && (held === null || blockOfItem(held) === null)) {
      if (this.mode === 'telescope') this.lower();
      else this.raise('telescope', { x: hit.x, y: hit.y, z: hit.z });
      return 'worked';
    }
    if (held === SPYGLASS) {
      if (this.mode === 'none') this.raise('spyglass', null);
      else this.lower();
      return 'worked';
    }
    return null;
  }

  /** Lowers whatever is raised (a screen opened, the player died). */
  lower(): void {
    if (this.mode === 'none') return;
    this.mode = 'none';
    this.scope = null;
    this.holding = null;
    this.heldS = 0;
    this.host.setZoom(1);
    this.emitView(null);
  }

  update(dt: number): void {
    if (this.mode === 'none') return;
    const p = this.host.player;
    if (p.dead) return this.lower();
    if (this.mode === 'spyglass' && p.heldStack()?.item !== SPYGLASS) return this.lower();
    if (this.mode === 'telescope') {
      const s = this.scope;
      const gone = !s || blockOf(this.host.world.getVoxel(s.x, s.y, s.z)).key !== TELESCOPE;
      if (gone || Math.hypot(p.position.x - (s.x + 0.5), p.position.z - (s.z + 0.5)) > TELESCOPE_LEASH) return this.lower();
    }
    this.lookIn -= dt;
    if (this.lookIn > 0) {
      if (this.holding) this.heldS += dt;
      return;
    }
    const step = LOOK_S - this.lookIn;
    this.lookIn = LOOK_S;
    const px = p.position.x;
    const pz = p.position.z;
    const range = SPOT_RANGE[this.mode];
    if (Math.hypot(px - this.marksAt.x, pz - this.marksAt.z) > 24 || this.marksAt.range !== range) {
      this.marks = landmarksNear(this.host.seed, px, pz, range);
      this.marksAt = { x: px, z: pz, range };
    }
    const seen = landmarkInView(this.marks, px, pz, p.yaw, SPOT_CONE[this.mode], range, p.pitch);
    if (seen && this.holding && seen.key === this.holding.key) this.heldS += step;
    else {
      this.holding = seen;
      this.heldS = 0;
    }
    if (seen && this.heldS >= SPOT_HOLD_S && !this.spotted.has(seen.key)) this.spot(seen, px, pz);
    this.emitView(seen);
  }

  /** Landmarks within `range` of the player (the telescope's reach by default), nearest first. */
  nearby(range = SPOT_RANGE.telescope): Array<Landmark & { distance: number }> {
    const p = this.host.player.position;
    return landmarksNear(this.host.seed, p.x, p.z, range)
      .map((m) => ({ ...m, distance: Math.round(Math.hypot(m.x - p.x, m.z - p.z)) }))
      .sort((a, b) => a.distance - b.distance);
  }

  toJSON(): OpticsSave {
    return { spotted: [...this.spotted] };
  }

  load(raw: unknown): void {
    this.spotted.clear();
    const list = (raw as { spotted?: unknown } | null)?.spotted;
    if (Array.isArray(list)) for (const k of list) if (typeof k === 'string') this.spotted.add(k);
  }

  // ---- internals ------------------------------------------------------------------------------------------------

  private raise(mode: Exclude<OpticsMode, 'none'>, scope: { x: number; y: number; z: number } | null): void {
    this.mode = mode;
    this.scope = scope;
    this.holding = null;
    this.heldS = 0;
    this.lookIn = 0;
    this.shownKey = '';
    this.host.setZoom(ZOOM[mode]);
    this.host.bus.emit('sfx', { name: 'ui_click' });
    if (mode === 'telescope' && scope) {
      const p = this.host.player.position;
      if (this.host.isNight() && skyOpen(this.host.world, Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z))) {
        const w = this.host.weather();
        this.host.bus.emit('toast', { text: skyReading(w.kind, w.next, w.nextInS), kind: 'info', item: TELESCOPE });
        this.host.bus.emit('flag', { flag: 'read_the_stars' });
      } else {
        this.host.bus.emit('toast', { text: 'Hold a far landmark in the middle to spot it. At night, look up to read the weather.', kind: 'info', item: TELESCOPE });
      }
    }
    this.emitView(null);
  }

  private spot(m: Landmark, px: number, pz: number): void {
    this.spotted.add(m.key);
    const distance = Math.round(Math.hypot(m.x - px, m.z - pz));
    const direction = directionWord(px, pz, m.x, m.z);
    this.host.bus.emit('toast', { text: `Spotted: ${m.name}, ${distance} m ${direction}`, kind: 'good', item: this.mode === 'telescope' ? TELESCOPE : SPYGLASS });
    this.host.bus.emit('town:note', { key: `spotted:${m.key}`, text: `Spotted ${m.name} through the glass, ${distance} m ${direction} of (${Math.round(px)}, ${Math.round(pz)}).` });
    this.host.bus.emit('flag', { flag: 'spotted_landmark' });
    this.host.bus.emit('sfx', { name: 'objective', volume: 0.6 });
  }

  private emitView(seen: Landmark | null): void {
    const p = this.host.player.position;
    const target = seen
      ? { name: seen.name, distance: Math.round(Math.hypot(seen.x - p.x, seen.z - p.z)), direction: directionWord(p.x, p.z, seen.x, seen.z), spotted: this.spotted.has(seen.key) }
      : null;
    const key = `${this.mode}|${target ? `${target.name}|${target.distance}|${target.spotted}` : ''}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    const view: OpticsView = { mode: this.mode, zoom: ZOOM[this.mode], target };
    this.host.bus.emit('optics:view', view);
  }
}
