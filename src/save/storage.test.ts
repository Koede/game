import { describe, expect, it } from 'vitest';
import { MemoryStorage, SaveStore, type StorageLike } from './storage';

interface Doc {
  name: string;
  n: number;
}

const make = (storage: StorageLike | null, extra: Partial<ConstructorParameters<typeof SaveStore<Doc>>[0]> = {}) =>
  new SaveStore<Doc>({ key: 'hw-test', version: 2, storage, now: () => 1234, ...extra });

describe('SaveStore', () => {
  it('round-trips a document and reports its size', () => {
    const store = make(new MemoryStorage());
    expect(store.load()).toBeNull();
    expect(store.exists()).toBe(false);
    const result = store.save({ name: 'base', n: 7 });
    expect(result.ok).toBe(true);
    expect(store.load()).toEqual({ name: 'base', n: 7 });
    expect(store.savedAt()).toBe(1234);
    expect(store.exists()).toBe(true);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('survives a second store instance on the same storage', () => {
    const storage = new MemoryStorage();
    make(storage).save({ name: 'a', n: 1 });
    expect(make(storage).load()).toEqual({ name: 'a', n: 1 });
  });

  it('ignores corrupt documents instead of throwing', () => {
    const storage = new MemoryStorage();
    for (const junk of ['{not json', 'null', '42', '"text"', '{"v":"x","d":1}', '{"t":1}']) {
      storage.setItem('hw-test', junk);
      expect(make(storage).load()).toBeNull();
    }
  });

  it('discards other versions unless a migration is supplied', () => {
    const storage = new MemoryStorage();
    storage.setItem('hw-test', JSON.stringify({ v: 1, t: 0, d: { title: 'old', n: 3 } }));
    expect(make(storage).load()).toBeNull();
    const migrated = make(storage, {
      migrate: (data, from) => (from === 1 ? { name: (data as { title: string }).title, n: (data as Doc).n } : null),
    });
    expect(migrated.load()).toEqual({ name: 'old', n: 3 });
    expect(make(storage, { migrate: () => null }).load()).toBeNull();
    expect(make(storage, { migrate: () => { throw new Error('boom'); } }).load()).toBeNull();
  });

  it('rejects documents that fail validation', () => {
    const storage = new MemoryStorage();
    make(storage).save({ name: 'x', n: -1 });
    expect(make(storage, { validate: (d) => (d as Doc).n >= 0 }).load()).toBeNull();
    expect(make(storage, { validate: () => { throw new Error('bad'); } }).load()).toBeNull();
  });

  it('falls back to memory when storage is unavailable and says so', () => {
    const store = make(null);
    expect(store.persistent).toBe(false);
    expect(store.save({ name: 'm', n: 2 })).toEqual({ ok: false, reason: 'unavailable' });
    expect(store.load()).toEqual({ name: 'm', n: 2 });
  });

  it('keeps the session alive when a write is refused for quota', () => {
    const backing = new MemoryStorage();
    backing.setItem('hw-test', JSON.stringify({ v: 2, t: 0, d: { name: 'stale', n: 0 } }));
    let refuse = true;
    const storage: StorageLike = {
      getItem: (k) => backing.getItem(k),
      removeItem: (k) => backing.removeItem(k),
      setItem: (k, v) => {
        if (refuse) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        backing.setItem(k, v);
      },
    };
    const store = make(storage);
    expect(store.save({ name: 'new', n: 9 })).toEqual({ ok: false, reason: 'quota' });
    expect(store.load()).toEqual({ name: 'new', n: 9 });
    expect(backing.getItem('hw-test')).toBeNull();
    refuse = false;
    expect(store.save({ name: 'newer', n: 10 }).ok).toBe(true);
    expect(make(backing).load()).toEqual({ name: 'newer', n: 10 });
  });

  it('never throws when every storage call throws', () => {
    const hostile: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const store = make(hostile);
    expect(store.load()).toBeNull();
    expect(store.save({ name: 'h', n: 1 })).toEqual({ ok: false, reason: 'unavailable' });
    expect(store.load()).toEqual({ name: 'h', n: 1 });
    expect(() => store.clear()).not.toThrow();
  });

  it('reports unserialisable data as unavailable', () => {
    const store = make(new MemoryStorage());
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(store.save(loop as unknown as Doc)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
