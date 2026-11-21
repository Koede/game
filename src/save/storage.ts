/**
 * Versioned JSON persistence on top of a Storage-like object (localStorage in the browser).
 *
 * The game may run inside a sandboxed frame where storage is missing, throws, or is wiped between visits,
 * so nothing here ever throws: failures are reported as values and the store falls back to memory.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * `keptAt`: on a failed write, when the copy still in real storage was written (ms since epoch), or null when real
 * storage holds none. A failed write never removes that copy.
 */
export type SaveResult = { ok: true; bytes: number } | { ok: false; reason: 'quota' | 'unavailable'; keptAt: number | null };

/** Why a stored document could not be used: not JSON or not an envelope, a newer or unknown version, failed validation. */
export type LoadProblem = 'corrupt' | 'newer' | 'older' | 'invalid';

export interface LoadResult<T> {
  data: T | null;
  /** Set when stored text exists but cannot be used. */
  problem: LoadProblem | null;
  /** The stored text the data came from (or could not come from). */
  raw: string | null;
}

interface Envelope {
  /** Format version of `d`. */
  v: number;
  /** Wall-clock time of the save, ms since epoch. */
  t: number;
  d: unknown;
}

/** Returns window.localStorage if it exists and accepts writes, otherwise null. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = '__hw_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** In-memory stand-in used when real storage is unavailable; lasts until the page is closed. */
export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export interface SaveStoreOptions<T> {
  /** Storage key. */
  key: string;
  /** Current format version. Saves with another version go through `migrate` or are ignored. */
  version: number;
  /** Backing storage. Defaults to browserStorage(), or memory when that is unavailable. */
  storage?: StorageLike | null;
  /** Upgrades data written by an older version. Return null to discard it. */
  migrate?: (data: unknown, fromVersion: number) => T | null;
  /** Last line of defence against corrupt data: return false to reject a loaded document. */
  validate?: (data: unknown) => boolean;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Called once when storage is full: free what can go (e.g. old backups) and return true to retry the write. */
  onQuota?: () => boolean;
}

export class SaveStore<T> {
  /** False when saves only live in memory (storage missing or blocked). The UI should say so. */
  readonly persistent: boolean;
  private readonly storage: StorageLike;
  private readonly fallback = new MemoryStorage();
  private readonly key: string;
  private readonly version: number;
  private readonly migrate?: (data: unknown, fromVersion: number) => T | null;
  private readonly validate?: (data: unknown) => boolean;
  private readonly now: () => number;
  private readonly onQuota?: () => boolean;

  constructor(options: SaveStoreOptions<T>) {
    const real = options.storage === undefined ? browserStorage() : options.storage;
    this.persistent = real !== null;
    this.storage = real ?? this.fallback;
    this.key = options.key;
    this.version = options.version;
    this.migrate = options.migrate;
    this.validate = options.validate;
    this.now = options.now ?? Date.now;
    this.onQuota = options.onQuota;
  }

  /**
   * The newest readable envelope of real storage and the memory fallback (the fallback holds a save that real
   * storage refused, and wins while it is the newer one), with its raw text.
   */
  private read(): { env: Envelope | null; raw: string | null } {
    let stored: string | null = null;
    try {
      stored = this.storage.getItem(this.key);
    } catch {
      stored = null;
    }
    const memory = this.storage === this.fallback ? null : this.fallback.getItem(this.key);
    const a = parseEnvelope(stored);
    const b = parseEnvelope(memory);
    if (b && (!a || b.t > a.t)) return { env: b, raw: memory };
    return { env: a, raw: stored ?? memory };
  }

  /** The saved document, or null when there is none or it cannot be used. Never throws. */
  load(): T | null {
    return this.inspect().data;
  }

  /** Like load(), and says why stored text could not be used. Never throws. */
  inspect(): LoadResult<T> {
    const { env, raw } = this.read();
    if (!raw) return { data: null, problem: null, raw: null };
    if (!env) return { data: null, problem: 'corrupt', raw };
    let data: unknown = env.d;
    if (env.v !== this.version) {
      const problem: LoadProblem = env.v > this.version ? 'newer' : 'older';
      if (!this.migrate) return { data: null, problem, raw };
      try {
        data = this.migrate(env.d, env.v);
      } catch {
        return { data: null, problem, raw };
      }
      if (data === null) return { data: null, problem, raw };
    }
    if (this.validate) {
      try {
        if (!this.validate(data)) return { data: null, problem: 'invalid', raw };
      } catch {
        return { data: null, problem: 'invalid', raw };
      }
    }
    return { data: data as T, problem: null, raw };
  }

  /** When the current save was written (ms since epoch), or null. */
  savedAt(): number | null {
    return this.read().env?.t ?? null;
  }

  /** When the copy in real storage was written, or null (none, unreadable, or storage unavailable). */
  storedAt(): number | null {
    if (!this.persistent) return null;
    try {
      return parseEnvelope(this.storage.getItem(this.key))?.t ?? null;
    } catch {
      return null;
    }
  }

  exists(): boolean {
    return this.load() !== null;
  }

  /**
   * Writes the document. If real storage refuses (quota, blocked), the save is kept in memory so the session can
   * still continue, the copy already in real storage is left alone, and the failure reason is returned.
   */
  save(data: T): SaveResult {
    let text: string;
    try {
      text = JSON.stringify(data);
    } catch {
      return { ok: false, reason: 'unavailable', keptAt: this.storedAt() };
    }
    if (text === undefined) return { ok: false, reason: 'unavailable', keptAt: this.storedAt() };
    return this.saveText(text);
  }

  /** save() for a document already serialised to JSON text (the caller guarantees it is valid JSON). */
  saveText(dataJson: string): SaveResult {
    const text = `{"v":${this.version},"t":${this.now()},"d":${dataJson}}`;
    try {
      this.storage.setItem(this.key, text);
    } catch (err) {
      if (!isQuota(err) || !this.onQuota?.() || !this.retry(text)) {
        this.fallback.setItem(this.key, text);
        return { ok: false, reason: isQuota(err) ? 'quota' : 'unavailable', keptAt: this.storedAt() };
      }
    }
    if (this.storage !== this.fallback) this.fallback.removeItem(this.key);
    return this.persistent ? { ok: true, bytes: text.length } : { ok: false, reason: 'unavailable', keptAt: null };
  }

  private retry(text: string): boolean {
    try {
      this.storage.setItem(this.key, text);
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.fallback.removeItem(this.key);
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const env = parsed as Partial<Envelope>;
    if (typeof env.v !== 'number' || !('d' in env)) return null;
    return { v: env.v, t: typeof env.t === 'number' ? env.t : 0, d: env.d };
  } catch {
    return null;
  }
}

function isQuota(err: unknown): boolean {
  const name = err instanceof Error ? err.name : '';
  return /quota/i.test(name) || /quota/i.test(String(err));
}
