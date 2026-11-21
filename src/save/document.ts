/**
 * The save document: one versioned JSON object holding the player's settings and, when a world exists, everything
 * needed to continue it exactly (seed, world edits + block entities, player, clock, survival, objectives).
 *
 * DOM-free. Validation is structural: it guarantees that every snapshot has the shape its module's `load()`
 * expects, so a corrupt or hand-edited save is refused here instead of breaking the game half-way through loading.
 */
import { DEFAULT_SETTINGS, type Settings } from '../core/context';
import type { ClockSnapshot } from '../game/clock';
import type { ObjectivesSnapshot } from '../game/objectives';
import type { PlayerSnapshot } from '../game/playerState';
import type { SurvivalSnapshot } from '../game/survival';
import type { WeatherSnapshot } from '../game/weather';
import type { WorldSnapshot } from '../world/world';
import { SaveStore, type StorageLike } from './storage';

/** Bump when the document's shape changes; add a step to `migrateSave` at the same time. */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'hearthwatt.save';

/** A world in progress. */
export interface WorldSave {
  seed: number;
  /** What the player typed as the seed, or null for a random world. Shown on the title screen. */
  seedText: string | null;
  world: WorldSnapshot;
  player: PlayerSnapshot;
  clock: ClockSnapshot;
  survival: SurvivalSnapshot;
  objectives: ObjectivesSnapshot;
  /** Seconds of play (simulation time while not paused), across sessions. */
  playTimeS: number;
  /**
   * The weather (spec 15). Optional: saves from before the weather lack it, and a damaged one is ignored (the sky
   * follows from the seed and the time anyway), never a reason to drop the world.
   */
  weather?: WeatherSnapshot;
}

export interface SaveDocument {
  settings: Settings;
  /** null until a world was started (or after it was deleted). */
  world: WorldSave | null;
}

// ---- settings ---------------------------------------------------------------------------------------------------

/** Bounds every setting is clamped to when read from a save (the same as the settings panel's sliders). */
export const SETTINGS_BOUNDS = {
  renderDistance: [2, 12],
  fov: [55, 100],
  mouseSensitivity: [0.2, 3],
  touchSensitivity: [0.2, 3],
  volume: [0, 1],
} as const satisfies Partial<Record<keyof Settings, readonly [number, number]>>;

const TOUCH_MODES: readonly Settings['touchControls'][] = ['auto', 'on', 'off'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Any value -> a complete, in-range Settings object (unknown or broken fields fall back to the defaults). */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!isRecord(raw)) return out;
  for (const key of Object.keys(SETTINGS_BOUNDS) as (keyof typeof SETTINGS_BOUNDS)[]) {
    const v = raw[key];
    if (!isNum(v)) continue;
    const [lo, hi] = SETTINGS_BOUNDS[key];
    out[key] = Math.min(hi, Math.max(lo, v));
  }
  out.renderDistance = Math.round(out.renderDistance);
  out.fov = Math.round(out.fov);
  if (typeof raw.invertY === 'boolean') out.invertY = raw.invertY;
  if (typeof raw.showFps === 'boolean') out.showFps = raw.showFps;
  if (TOUCH_MODES.includes(raw.touchControls as Settings['touchControls'])) out.touchControls = raw.touchControls as Settings['touchControls'];
  return out;
}

// ---- validation -------------------------------------------------------------------------------------------------

const isVec3 = (v: unknown): boolean => isRecord(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const isSlotArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((s) => s === null || (isRecord(s) && typeof s.item === 'string' && isNum(s.count)));
const isCounterMap = (v: unknown): boolean => isRecord(v) && Object.values(v).every(isNum);
const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every((s) => typeof s === 'string');

function validPlayer(p: unknown): boolean {
  if (!isRecord(p)) return false;
  if (!isVec3(p.position) || !isVec3(p.velocity) || !isVec3(p.spawn)) return false;
  if (![p.yaw, p.pitch, p.health, p.warmth, p.air, p.selectedSlot, p.sinceDamageS].every(isNum)) return false;
  if (!isSlotArray(p.inventory)) return false;
  if (p.home !== null && !isVec3(p.home)) return false;
  if (!isRecord(p.buffs) || !isNum(p.buffs.wellWarmedS)) return false;
  const s = p.stats;
  if (!isRecord(s) || !isCounterMap(s.made) || !isCounterMap(s.placed) || !isCounterMap(s.broken) || !isNum(s.deaths)) return false;
  return typeof p.dead === 'boolean' && typeof p.onGround === 'boolean';
}

function validWorld(w: unknown): boolean {
  if (!isRecord(w) || !isNum(w.version) || !isNum(w.seed) || !isRecord(w.edits) || !Array.isArray(w.entities)) return false;
  if (!Object.values(w.edits).every((e) => typeof e === 'string')) return false;
  return w.entities.every((e) => isRecord(e) && typeof e.kind === 'string' && isNum(e.x) && isNum(e.y) && isNum(e.z));
}

function validObjectives(o: unknown): boolean {
  if (!isRecord(o) || !isStringArray(o.completed) || !isStringArray(o.flags) || !isNum(o.age)) return false;
  const pk = o.peaks;
  if (!isRecord(pk) || ![pk.tempC, pk.tier, pk.generationW, pk.storedJ].every(isNum)) return false;
  return Array.isArray(o.pendingRewards) && o.pendingRewards.every((r) => isRecord(r) && typeof r.item === 'string' && isNum(r.count));
}

function validSurvival(s: unknown): boolean {
  return isRecord(s) && [s.nearFurnaceS, s.coldS, s.drownAcc, s.contactAcc, s.radiationS, s.regenS].every(isNum);
}

/** True when `w` has the shape of a WorldSave every module can load. */
export function isWorldSave(w: unknown): w is WorldSave {
  if (!isRecord(w)) return false;
  if (!isNum(w.seed) || !(w.seedText === null || typeof w.seedText === 'string') || !isNum(w.playTimeS)) return false;
  if (!isRecord(w.clock) || !isNum(w.clock.timeOfDay) || !isNum(w.clock.day)) return false;
  return validWorld(w.world) && validPlayer(w.player) && validSurvival(w.survival) && validObjectives(w.objectives);
}

/**
 * Accepts any parsed document and returns a usable one: settings are always repaired; a world that does not
 * validate is dropped (reported through `onDropped`) rather than taking the settings down with it.
 */
export function normalizeDocument(raw: unknown, onDropped?: (reason: string) => void): SaveDocument | null {
  if (!isRecord(raw)) return null;
  const settings = sanitizeSettings(raw.settings);
  let world: WorldSave | null = null;
  if (raw.world !== null && raw.world !== undefined) {
    if (isWorldSave(raw.world)) world = raw.world;
    else onDropped?.('The saved world is damaged and could not be loaded.');
  }
  return { settings, world };
}

/** Upgrades older documents. Version 1 is the first; nothing older exists. */
export function migrateSave(_data: unknown, _fromVersion: number): SaveDocument | null {
  return null;
}

/**
 * The game's single save slot on top of SaveStore (versioned, never throws, memory fallback).
 * `storage` defaults to localStorage when it works.
 */
export class SaveSlot {
  readonly store: SaveStore<SaveDocument>;
  /** Why the last loaded world was discarded, if it was. */
  lastProblem: string | null = null;

  constructor(storage?: StorageLike | null) {
    this.store = new SaveStore<SaveDocument>({
      key: SAVE_KEY,
      version: SAVE_VERSION,
      storage,
      migrate: migrateSave,
      validate: (d) => isRecord(d),
    });
  }

  /** True when saves survive a page reload (false inside frames that block storage). */
  get persistent(): boolean {
    return this.store.persistent;
  }

  /** The document, repaired; defaults when there is none. Never throws. */
  read(): SaveDocument {
    this.lastProblem = null;
    const doc = normalizeDocument(this.store.load(), (reason) => (this.lastProblem = reason));
    return doc ?? { settings: { ...DEFAULT_SETTINGS }, world: null };
  }

  write(doc: SaveDocument): ReturnType<SaveStore<SaveDocument>['save']> {
    return this.store.save(doc);
  }
}
