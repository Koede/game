import { describe, expect, it } from 'vitest';
import LOCK from './blockIds.lock.json';
import { BLOCK_SPECS, orderByLock } from './blocks';

/** Block ids are saved in every voxel: they are permanent. The lock file is the contract (scripts/ids-sync.mjs). */
describe('block id lock', () => {
  const lock = LOCK as Record<string, number>;

  it('every locked key sits at its locked id in the block table', () => {
    for (const [key, id] of Object.entries(lock)) expect(BLOCK_SPECS[id]?.key, `${key} must stay id ${id}`).toBe(key);
  });

  it('is a gapless run of unique ids starting at air = 0', () => {
    const ids = Object.values(lock).sort((a, b) => a - b);
    expect(ids).toEqual(ids.map((_, i) => i));
    expect(lock.air).toBe(0);
  });

  it('knows every block (a new block needs `npm run ids:sync`, committed with it)', () => {
    const missing = BLOCK_SPECS.map((b) => b.key).filter((k) => lock[k] === undefined);
    expect(missing, 'unlocked blocks - run: npm run ids:sync').toEqual([]);
  });

  it('keeps a few ids the old saves depend on', () => {
    expect(lock).toMatchObject({ air: 0, corestone: 1, stone: 2, furnace_blast: 42, furnace_bronze: 219 });
  });

  it('refuses a block that vanished, and puts unknown blocks after the locked ones', () => {
    const a = { key: 'a' }, b = { key: 'b' }, c = { key: 'c' };
    expect(() => orderByLock([a] as never, { a: 0, b: 1 })).toThrow(/permanent/);
    expect(orderByLock([c, b, a] as never, { a: 0, b: 1 }).map((x) => x.key)).toEqual(['a', 'b', 'c']);
    expect(orderByLock([a, b, c] as never, { a: 0, b: 0, c: 1 }).map((x) => x.key)).toEqual(['a', 'c', 'b']); // a duplicated id: b moves
  });
});
