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

export type SaveResult = { ok: true; bytes: number } | { ok: false; reason: 'quota' | 'unavailable' };

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

  constructor(options: SaveStoreOptions<T>) {
    const real = options.storage === undefined ? browserStorage() : options.storage;
    this.persistent = real !== null;
    this.storage = real ?? this.fallback;
    this.key = options.key;
    this.version = options.version;
    this.migrate = options.migrate;
    this.validate = options.validate;
    this.now = options.now ?? Date.now;
  }

  private read(): Envelope | null {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      raw = null;
    }
    raw ??= this.fallback.getItem(this.key);
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

  /** The saved document, or null when there is none or it cannot be used. Never throws. */
  load(): T | null {
    const env = this.read();
    if (!env) return null;
    let data: unknown = env.d;
    if (env.v !== this.version) {
      if (!this.migrate) return null;
      try {
        data = this.migrate(env.d, env.v);
      } catch {
        return null;
      }
      if (data === null) return null;
    }
    if (this.validate) {
      try {
        if (!this.validate(data)) return null;
      } catch {
        return null;
      }
    }
    return data as T;
  }

  /** When the current save was written (ms since epoch), or null. */
  savedAt(): number | null {
    return this.read()?.t ?? null;
  }

  exists(): boolean {
    return this.load() !== null;
  }

  /**
   * Writes the document. If real storage refuses (quota, blocked), the save is kept in memory so the
   * session can still continue, and the failure reason is returned.
   */
  save(data: T): SaveResult {
    let text: string;
    try {
      text = JSON.stringify({ v: this.version, t: this.now(), d: data } satisfies Envelope);
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    try {
      this.storage.setItem(this.key, text);
      if (this.storage !== this.fallback) this.fallback.removeItem(this.key);
      return this.persistent ? { ok: true, bytes: text.length } : { ok: false, reason: 'unavailable' };
    } catch (err) {
      this.fallback.setItem(this.key, text);
      // A refused write must not leave an older, now misleading document behind.
      try {
        this.storage.removeItem(this.key);
      } catch {
        /* nothing more we can do */
      }
      const name = err instanceof Error ? err.name : '';
      return { ok: false, reason: /quota/i.test(name) || /quota/i.test(String(err)) ? 'quota' : 'unavailable' };
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
