/**
 * The save document: one versioned JSON object holding the player's settings and, when a world exists, everything
 * needed to continue it exactly (seed, world edits + block entities, player, clock, survival, objectives).
 *
 * DOM-free. Validation is structural: it guarantees that every snapshot has the shape its module's `load()`
 * expects, so a corrupt or hand-edited save is refused here instead of breaking the game half-way through loading.
 */
import type { GameMode } from '../core/gameMode';
import { DEFAULT_SETTINGS, DIFFICULTIES, PHONE_MAX_RENDER_DISTANCE, isTouchFirst, type Difficulty, type Settings } from '../core/context';
import type { AchievementsSnapshot } from '../game/achievements';
import type { ClockSnapshot } from '../game/clock';
import type { JournalSnapshot } from '../game/journal';
import { isLootFilter } from '../game/lootFilter';
import type { ObjectivesSnapshot } from '../game/objectives';
import type { PlayerSnapshot } from '../game/playerState';
import type { SurvivalSnapshot } from '../game/survival';
import type { WeatherSnapshot } from '../game/weather';
import type { MobsSnapshot } from '../mobs';
import type { WorldSnapshot } from '../world/world';
import { migrateWorld } from './migrations';
import { SaveStore, browserStorage, type LoadProblem, type SaveResult, type StorageLike } from './storage';

/**
 * The ENVELOPE version. Do not bump it for content or format changes: bump `SAVE_REV` (save/migrations.ts) and add a
 * migration instead; an envelope bump makes every older save unusable. 1: five ages. 2: the six ages (BRONZE_PLAN W0).
 */
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'hearthwatt.save';
/** A copy of a stored save this build could not use, kept before anything could replace it. */
export const BACKUP_KEY = 'hearthwatt.save.bak';
/**
 * The previous good save: before an autosave replaces the stored text, that text is copied here when it is at least
 * PREV_MIN_AGE_MS older than the new write. Every future migration bug stays recoverable. Dropped first on quota.
 */
export const PREV_KEY = 'hearthwatt.save.prev';
export const PREV_MIN_AGE_MS = 10 * 60 * 1000;
/** The settings alone, written while the save key holds a world this build cannot read (so it is never replaced). */
export const SETTINGS_KEY = 'hearthwatt.settings';

/** A world in progress. */
export interface WorldSave {
  /** Content/format revision (save/migrations.ts). Absent = a build before `rev` existed (treated as the revision it wrote). */
  rev?: number;
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
  /**
   * The animals (spec 12.5). Optional: saves from before the animals lack it (they start fresh), and one that
   * MobManager.load refuses is ignored the same way, never a reason to drop the world.
   */
  mobs?: MobsSnapshot;
  /** The journal and the explored map (docs/api/journal.md). Optional: older saves start an empty one; a damaged one is ignored. */
  journal?: JournalSnapshot;
  /** Achievements earned (src/game/achievements.ts). Optional, ignored when damaged. */
  achievements?: AchievementsSnapshot;
  /**
   * 'dev' for a Dev Mode world (docs/api/dev-mode.md). Optional: absent means survival, and survival saves never write it,
   * so they stay exactly as before.
   */
  mode?: GameMode;
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
const GRAPHICS: readonly NonNullable<Settings['graphics']>[] = ['low', 'normal', 'high'];
const HANDEDNESS: readonly Settings['oneHanded'][] = ['off', 'left', 'right'];
const UI_SCALES: readonly Settings['uiScale'][] = ['normal', 'large'];
const ITEM_MAGNETS: readonly Settings['itemMagnet'][] = ['off', 'small', 'large'];

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
  if (isTouchFirst()) out.renderDistance = Math.min(out.renderDistance, PHONE_MAX_RENDER_DISTANCE);
  out.fov = Math.round(out.fov);
  if (typeof raw.invertY === 'boolean') out.invertY = raw.invertY;
  if (typeof raw.showFps === 'boolean') out.showFps = raw.showFps;
  if (TOUCH_MODES.includes(raw.touchControls as Settings['touchControls'])) out.touchControls = raw.touchControls as Settings['touchControls'];
  // Settings saved before spec 19 have neither: they keep the defaults (Normal, normal size).
  if (DIFFICULTIES.includes(raw.difficulty as Difficulty)) out.difficulty = raw.difficulty as Difficulty;
  if (HANDEDNESS.includes(raw.oneHanded as Settings['oneHanded'])) out.oneHanded = raw.oneHanded as Settings['oneHanded'];
  if (UI_SCALES.includes(raw.uiScale as Settings['uiScale'])) out.uiScale = raw.uiScale as Settings['uiScale'];
  if (typeof raw.haptics === 'boolean') out.haptics = raw.haptics;
  if (typeof raw.autoBuck === 'boolean') out.autoBuck = raw.autoBuck;
  if (typeof raw.reduceMotion === 'boolean') out.reduceMotion = raw.reduceMotion;
  if (typeof raw.colorSafe === 'boolean') out.colorSafe = raw.colorSafe;
  if (typeof raw.autoStep === 'boolean') out.autoStep = raw.autoStep;
  if (typeof raw.moveAssist === 'boolean') out.moveAssist = raw.moveAssist;
  if (GRAPHICS.includes(raw.graphics as NonNullable<Settings['graphics']>)) out.graphics = raw.graphics as Settings['graphics'];
  if (ITEM_MAGNETS.includes(raw.itemMagnet as Settings['itemMagnet'])) out.itemMagnet = raw.itemMagnet as Settings['itemMagnet'];
  if (isLootFilter(raw.lootFilter)) out.lootFilter = raw.lootFilter;
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
    let migrated: 'ok' | 'newer' | 'failed' = 'failed';
    if (isRecord(raw.world)) {
      try {
        migrated = migrateWorld(raw.world);
      } catch {
        migrated = 'failed';
      }
    }
    if (migrated === 'newer') onDropped?.('This world was saved by a newer version of the game.');
    else if (migrated === 'ok' && isWorldSave(raw.world)) {
      world = raw.world;
      if (world.mode !== undefined && world.mode !== 'dev') delete world.mode;
    }
    else onDropped?.('The saved world is damaged and could not be loaded.');
  }
  return { settings, world };
}

/**
 * Envelope upgrade (only for envelope versions below SAVE_VERSION): stamps the world with `rev` 1, the revision of
 * every envelope-v1 save, so `migrateWorld` (run by normalizeDocument for every read) walks the whole chain.
 * Never throws on a bad shape: null.
 */
export function migrateSave(data: unknown, fromVersion: number): SaveDocument | null {
  if (!isRecord(data) || !isNum(fromVersion) || fromVersion < 1 || fromVersion > SAVE_VERSION) return null;
  if (fromVersion < 2 && isRecord(data.world) && data.world.rev === undefined) data.world.rev = 1;
  return data as unknown as SaveDocument;
}

const PROBLEM_TEXT: Readonly<Record<LoadProblem | 'world', string>> = {
  corrupt: 'The saved game could not be read. A copy was kept; starting a New World replaces it.',
  newer: 'This save is from a newer version of the game and cannot be opened here. It is kept as it was; starting a New World replaces it.',
  older: 'This save is from an old version of the game that cannot be opened. A copy was kept.',
  invalid: 'The saved game could not be read. A copy was kept; starting a New World replaces it.',
  world: 'The saved world is damaged and could not be loaded. A copy was kept; starting a New World replaces it.',
};

/**
 * The game's single save slot on top of SaveStore (versioned, never throws, memory fallback).
 * `storage` defaults to localStorage when it works.
 *
 * A stored save this build cannot use (not JSON, a newer version, a damaged world) is never thrown away: it is copied
 * to BACKUP_KEY, `lastProblem` says why, and the slot is `held` - settings-only writes then go to SETTINGS_KEY and the
 * save key keeps the old text until a world is written (the player started a New World on purpose).
 */
export class SaveSlot {
  readonly store: SaveStore<SaveDocument>;
  private readonly settingsStore: SaveStore<Settings>;
  private readonly storage: StorageLike | null;
  /** Why the stored world could not be used, if it could not. */
  lastProblem: string | null = null;
  private heldRaw = false;

  private readonly now: () => number;

  constructor(storage?: StorageLike | null, now: () => number = Date.now) {
    this.now = now;
    this.storage = storage === undefined ? browserStorage() : storage;
    this.store = new SaveStore<SaveDocument>({
      key: SAVE_KEY,
      version: SAVE_VERSION,
      storage: this.storage,
      migrate: migrateSave,
      validate: (d) => isRecord(d),
      // A full storage may first give up the backup of an unreadable save (never while the save key still holds it).
      now,
      onQuota: () => (!this.heldRaw && this.removeBackup()) || this.removeKey(PREV_KEY),
    });
    this.settingsStore = new SaveStore<Settings>({ key: SETTINGS_KEY, version: SAVE_VERSION, storage: this.storage, migrate: (d) => (isRecord(d) ? (d as unknown as Settings) : null), validate: isRecord });
  }

  /** True when saves survive a page reload (false inside frames that block storage). */
  get persistent(): boolean {
    return this.store.persistent;
  }

  /** The save key holds a world this build could not read; it is kept until a world is written over it. */
  get held(): boolean {
    return this.heldRaw;
  }

  /** The document, repaired; defaults when there is none. Never throws. */
  read(): SaveDocument {
    this.lastProblem = null;
    this.heldRaw = false;
    const found = this.store.inspect();
    let worldDropped = false;
    const doc = normalizeDocument(found.data, () => (worldDropped = true));
    const problem = found.problem ?? (worldDropped ? 'world' : null);
    if (problem && found.raw) {
      this.lastProblem = PROBLEM_TEXT[problem];
      this.heldRaw = true;
      this.backUp(found.raw);
    }
    const settings = this.heldRaw ? (this.settingsStore.load() ?? doc?.settings ?? settingsOf(found.raw)) : doc?.settings;
    return { settings: sanitizeSettings(settings), world: doc?.world ?? null };
  }

  write(doc: SaveDocument): SaveResult {
    if (doc.world === null && this.heldRaw) return this.settingsStore.save(doc.settings);
    this.rollPrev();
    const result = this.store.save(doc);
    if (result.ok) this.heldRaw = false;
    return result;
  }

  /**
   * write() for a world already serialised to JSON (`worldJson`, or null for none): the world text is used as it is,
   * so a settings change never serialises the world again and never mixes live state into the last snapshot.
   */
  writeText(settings: Settings, worldJson: string | null): SaveResult {
    if (worldJson === null && this.heldRaw) return this.settingsStore.save(settings);
    this.rollPrev();
    const result = this.store.saveText(`{"settings":${JSON.stringify(settings)},"world":${worldJson ?? 'null'}}`);
    if (result.ok) this.heldRaw = false;
    return result;
  }

  /** The previous good save (PREV_KEY) exists. */
  get hasPrev(): boolean {
    return this.getItem(PREV_KEY) !== null;
  }

  /** The raw text of the previous good save, or null. */
  readPrev(): string | null {
    return this.getItem(PREV_KEY);
  }

  /** Copies the stored save to PREV_KEY when it is old enough and readable; never while the slot holds an unreadable save. */
  private rollPrev(): void {
    if (this.heldRaw || !this.storage) return;
    const cur = this.getItem(SAVE_KEY);
    const at = this.store.storedAt();
    if (cur === null || at === null || this.now() - at < PREV_MIN_AGE_MS) return;
    if (this.getItem(PREV_KEY) === cur) return;
    try {
      this.storage.setItem(PREV_KEY, cur);
    } catch {
      // Full: the new save matters more than its predecessor.
    }
  }

  private removeKey(key: string): boolean {
    if (this.getItem(key) === null) return false;
    try {
      this.storage?.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /** A copy of an unreadable save exists in BACKUP_KEY. */
  get hasBackup(): boolean {
    return this.getItem(BACKUP_KEY) !== null;
  }

  private backUp(raw: string): void {
    if (this.getItem(BACKUP_KEY) === raw) return;
    try {
      this.storage?.setItem(BACKUP_KEY, raw);
    } catch {
      // Full or blocked: the save key itself still holds the text (held), so nothing is lost.
    }
  }

  private removeBackup(): boolean {
    if (this.getItem(BACKUP_KEY) === null) return false;
    try {
      this.storage?.removeItem(BACKUP_KEY);
      return true;
    } catch {
      return false;
    }
  }

  private getItem(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
}

/** The settings of a stored envelope whose world cannot be used (best effort; anything broken gives defaults). */
function settingsOf(raw: string | null): unknown {
  try {
    const env: unknown = raw ? JSON.parse(raw) : null;
    return isRecord(env) && isRecord(env.d) ? env.d.settings : null;
  } catch {
    return null;
  }
}
