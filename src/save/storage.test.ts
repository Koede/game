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
    expect(store.save({ name: 'm', n: 2 })).toEqual({ ok: false, reason: 'unavailable', keptAt: null });
    expect(store.load()).toEqual({ name: 'm', n: 2 });
  });

  it('a write refused for quota keeps the last good save in storage and the new one in memory', () => {
    const backing = new MemoryStorage();
    backing.setItem('hw-test', JSON.stringify({ v: 2, t: 1000, d: { name: 'stale', n: 0 } }));
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
    expect(store.save({ name: 'new', n: 9 })).toEqual({ ok: false, reason: 'quota', keptAt: 1000 });
    // The session continues from the newer copy in memory...
    expect(store.load()).toEqual({ name: 'new', n: 9 });
    // ...and a reload still finds the last good save.
    expect(JSON.parse(backing.getItem('hw-test')!).d).toEqual({ name: 'stale', n: 0 });
    expect(make(backing).load()).toEqual({ name: 'stale', n: 0 });
    refuse = false;
    expect(store.save({ name: 'newer', n: 10 }).ok).toBe(true);
    expect(make(backing).load()).toEqual({ name: 'newer', n: 10 });
  });

  it('on quota, onQuota may free space and the write is retried once', () => {
    const backing = new MemoryStorage();
    backing.setItem('junk', 'x'.repeat(50));
    const storage: StorageLike = {
      getItem: (k) => backing.getItem(k),
      removeItem: (k) => backing.removeItem(k),
      setItem: (k, v) => {
        if (backing.getItem('junk') !== null) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        backing.setItem(k, v);
      },
    };
    const store = make(storage, { onQuota: () => (backing.removeItem('junk'), true) });
    expect(store.save({ name: 'fits', n: 1 }).ok).toBe(true);
    expect(make(backing).load()).toEqual({ name: 'fits', n: 1 });
  });

  it('a memory copy older than the stored save never hides it', () => {
    const backing = new MemoryStorage();
    let t = 5;
    let refuse = true;
    const storage: StorageLike = {
      getItem: (k) => backing.getItem(k),
      removeItem: (k) => backing.removeItem(k),
      setItem: (k, v) => {
        if (refuse) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
        backing.setItem(k, v);
      },
    };
    const store = make(storage, { now: () => t });
    store.save({ name: 'memory', n: 1 });
    // Another tab (or an earlier write) put a newer save in storage.
    backing.setItem('hw-test', JSON.stringify({ v: 2, t: 9, d: { name: 'stored', n: 2 } }));
    expect(store.load()).toEqual({ name: 'stored', n: 2 });
    refuse = false;
    t = 20;
    store.save({ name: 'latest', n: 3 });
    expect(store.load()).toEqual({ name: 'latest', n: 3 });
  });

  it('says why stored text cannot be used', () => {
    const storage = new MemoryStorage();
    expect(make(storage).inspect()).toEqual({ data: null, problem: null, raw: null });
    storage.setItem('hw-test', '{not json');
    expect(make(storage).inspect().problem).toBe('corrupt');
    storage.setItem('hw-test', JSON.stringify({ v: 3, t: 0, d: {} }));
    expect(make(storage).inspect()).toMatchObject({ problem: 'newer', raw: storage.getItem('hw-test') });
    storage.setItem('hw-test', JSON.stringify({ v: 1, t: 0, d: {} }));
    expect(make(storage).inspect().problem).toBe('older');
    storage.setItem('hw-test', JSON.stringify({ v: 2, t: 0, d: { n: -1 } }));
    expect(make(storage, { validate: (d) => (d as Doc).n >= 0 }).inspect().problem).toBe('invalid');
  });

  it('never throws when every storage call throws', () => {
    const hostile: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const store = make(hostile);
    expect(store.load()).toBeNull();
    expect(store.save({ name: 'h', n: 1 })).toEqual({ ok: false, reason: 'unavailable', keptAt: null });
    expect(store.load()).toEqual({ name: 'h', n: 1 });
    expect(() => store.clear()).not.toThrow();
  });

  it('reports unserialisable data as unavailable', () => {
    const store = make(new MemoryStorage());
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(store.save(loop as unknown as Doc)).toEqual({ ok: false, reason: 'unavailable', keptAt: null });
  });
});
