import { describe, expect, it } from 'vitest';
import { chunkKey, keyChunkX, keyChunkZ } from './chunk';
import { EntityStore } from './entities';

describe('chunk keys', () => {
  const near = [-8192, -8191, -1, 0, 1, 8190, 8191];
  const far = [-32768, -20000, -8193, 8192, 20000, 32767];

  it('round-trip at the limits of the near range and beyond it', () => {
    for (const cx of [...near, ...far]) {
      for (const cz of [...near, ...far]) {
        const k = chunkKey(cx, cz);
        expect(keyChunkX(k)).toBe(cx);
        expect(keyChunkZ(k)).toBe(cz);
      }
    }
  });

  it('stay small integers (< 2^30) within |cx|, |cz| < 8192, and never collide', () => {
    let max = 0;
    for (const cx of near) for (const cz of near) max = Math.max(max, chunkKey(cx, cz));
    expect(max).toBeLessThan(2 ** 30);
    const keys = new Set<number>();
    const all = [...near, ...far];
    for (const cx of all) for (const cz of all) keys.add(chunkKey(cx, cz));
    expect(keys.size).toBe(all.length * all.length);
  });
});

describe('entity pins', () => {
  it('machines pin 3x3 chunks; crates and picked wild bushes pin nothing; planted crops pin', () => {
    const store = new EntityStore();
    expect(store.set({ kind: 'thermopile', x: 8, y: 40, z: 8 })).toBe(true);
    expect(store.pinnedChunks).toBe(9);
    expect(store.set({ kind: 'berry_bush', x: 1200, y: 40, z: 8, growS: 0 })).toBe(false);
    expect(store.set({ kind: 'crate', x: -900, y: 40, z: 8, slots: [] })).toBe(false);
    expect(store.pinnedChunks).toBe(9);
    expect(store.isPinned(chunkKey(75, 0))).toBe(false);
    expect(store.set({ kind: 'crop', x: 400, y: 40, z: 8, growS: 0 })).toBe(true);
    expect(store.pinnedChunks).toBe(18);
    expect(store.remove(1200, 40, 8).changed).toBe(false);
    expect(store.remove(400, 40, 8).changed).toBe(true);
    expect(store.pinnedChunks).toBe(9);
  });
});
