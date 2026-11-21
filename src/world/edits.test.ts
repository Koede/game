import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/math';
import { CHUNK_VOLUME } from '../core/types';
import { EditLog, decodeBase64, encodeBase64 } from './edits';

describe('base64', () => {
  it('round-trips any byte string and matches the standard encoding', () => {
    const rng = mulberry32(7);
    for (const length of [0, 1, 2, 3, 4, 5, 64, 1001]) {
      const bytes = Uint8Array.from({ length }, () => Math.floor(rng() * 256));
      const text = encodeBase64(bytes);
      expect(text).toBe(btoa(String.fromCharCode(...bytes)));
      expect([...decodeBase64(text)]).toEqual([...bytes]);
    }
  });

  it('rejects malformed text', () => {
    expect(() => decodeBase64('abc')).toThrow();
    expect(() => decodeBase64('ab!d')).toThrow();
  });
});

describe('EditLog', () => {
  it('keeps the last voxel per cell and lays edits over fresh voxels', () => {
    const log = new EditLog();
    log.record(0, 0, 5, 3);
    log.record(0, 0, 5, 4);
    log.record(-3, 7, CHUNK_VOLUME - 1, 0x1fff);
    expect(log.count).toBe(2);
    expect(log.chunkCount).toBe(2);
    const voxels = new Uint16Array(CHUNK_VOLUME);
    expect(log.apply(0, 0, voxels)).toBe(1);
    expect(voxels[5]).toBe(4);
    expect(log.apply(1, 1, voxels)).toBe(0);
  });

  it('saves to plain JSON and loads it back exactly', () => {
    const log = new EditLog();
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) log.record(Math.floor(rng() * 9) - 4, Math.floor(rng() * 9) - 4, Math.floor(rng() * CHUNK_VOLUME), Math.floor(rng() * 65536));
    const snapshot = JSON.parse(JSON.stringify(log.toJSON()));
    const copy = new EditLog();
    copy.load(snapshot);
    expect(copy.count).toBe(log.count);
    expect(copy.toJSON()).toEqual(log.toJSON());
    for (let cz = -4; cz <= 4; cz++) {
      for (let cx = -4; cx <= 4; cx++) {
        const a = new Uint16Array(CHUNK_VOLUME);
        const b = new Uint16Array(CHUNK_VOLUME);
        log.apply(cx, cz, a);
        copy.apply(cx, cz, b);
        expect(b.every((v, i) => v === a[i])).toBe(true);
      }
    }
    // Four bytes per edit: well under 6 characters each.
    expect(JSON.stringify(snapshot).length).toBeLessThan(log.count * 6 + 9 * 9 * 16);
  });

  it('refuses a malformed snapshot and keeps what it had', () => {
    const log = new EditLog();
    log.record(0, 0, 1, 2);
    expect(() => log.load({ 'x,1': 'AAAA' })).toThrow();
    expect(() => log.load({ '0,0': 'AAA' })).toThrow();
    expect(() => log.load({ '0,0': 'AAAA' })).toThrow();
    expect(log.count).toBe(1);
  });
});
