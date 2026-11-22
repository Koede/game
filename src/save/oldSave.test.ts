import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { OBJECTIVES, blockOf } from '../core/registry';
import oldSave from '../../tests/fixtures/save-before-bronze.json';
import { MemoryStorage } from './storage';
import { SAVE_KEY, SAVE_VERSION, SaveSlot } from './document';

/**
 * A real save written by the build BEFORE the six-age refactor (envelope version 1): a formed Blast hearth, the whole
 * Ember age done, a little research and inventory. The migration must keep all of it.
 */
const OLD = JSON.stringify(oldSave);

function load() {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, `{"v":1,"t":0,"d":${OLD}}`);
  const slot = new SaveSlot(storage);
  const doc = slot.read();
  return { slot, doc };
}

describe('a save from before the Bronze Furnace', () => {
  it('loads without a problem', () => {
    const { slot, doc } = load();
    expect(slot.lastProblem).toBeNull();
    expect(doc.world).not.toBeNull();
  });

  it('keeps the formed Blast hearth formed and the inventory and research intact', () => {
    const { doc } = load();
    const state = GameState.restore(doc.world!);
    for (let i = 0; i < 200; i++) state.tick();
    const f = state.sim.furnaceAt(12, 36, 22)!;
    expect(f.hearth).not.toBeNull();
    expect(f.hearth!.inner).toEqual([1, 1, 1]);
    expect(f).toMatchObject({ tier: 3, effTier: 3, hearth: { tier: 3 } }); // the Blast Furnace is tier 3 of six now
    state.world.ensureLoadedAround(12, 22, 1);
    expect(blockOf(state.world.getVoxel(12, 36, 22)).key).toBe('furnace_blast'); // the block id did not move
    const have = (item: string) => state.player.toJSON().inventory.reduce((n, s) => n + (s?.item === item ? s.count : 0), 0);
    expect(have('bronze_ingot')).toBe(5);
    expect(have('plank')).toBe(7);
    const magic = (state.toSave().world.extras as { magic?: { research: { scanned: string[] } } }).magic;
    expect(magic?.research.scanned).toEqual(['oak_log', 'copper_ore']);
    state.dispose();
  });

  it('moves the objectives to the six ages without losing a place in the list', () => {
    const { doc } = load();
    const o = doc.world!.objectives;
    expect(o.age).toBe(2); // Forge: it had built the Blast Furnace, which was age 1 of five
    expect(o.peaks.tier).toBe(3);
    expect(o.completed).toContain('blast_furnace');
    expect(o.completed).toContain('bronze_furnace'); // the new goal before it
    const state = GameState.restore(doc.world!);
    expect(state.objectives.current?.id).toBe('pipe_ore'); // as before: the first Forge Age goal
    expect(state.objectives.age).toBe(2);
    state.dispose();
    // Every id it had completed is still an objective of this build.
    const ids = new Set(OBJECTIVES.map((x) => x.id));
    for (const id of o.completed) expect(ids.has(id), id).toBe(true);
  });

  it('writes the next save in the new format, and settings of the old format still load', () => {
    const { slot, doc } = load();
    expect(slot.write(doc).ok).toBe(true);
    const text = (slot as unknown as { storage: { getItem(k: string): string | null } }).storage.getItem(SAVE_KEY)!;
    expect(JSON.parse(text).v).toBe(SAVE_VERSION);
    expect(doc.settings.renderDistance).toBe(6);
  });

  it('only renumbers what it should: an Ember-age save keeps tier 1 and age 0', () => {
    const doc = JSON.parse(JSON.stringify(oldSave));
    const w = doc.world.world;
    const f = w.entities.find((e: { kind: string }) => e.kind === 'furnace');
    f.tier = 1; f.effTier = 1; f.hearth = null;
    doc.world.objectives = { completed: ['gather_logs'], flags: [], peaks: { tempC: 300, tier: 1, generationW: 0, storedJ: 0 }, age: 0, pendingRewards: [] };
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: 0, d: doc }));
    const read = new SaveSlot(storage).read().world!;
    const g = read.world.entities.find((e) => e.kind === 'furnace') as unknown as { tier: number; effTier: number };
    expect(g).toMatchObject({ tier: 1, effTier: 1 });
    expect(read.objectives).toMatchObject({ age: 0, completed: ['gather_logs'], peaks: { tier: 1 } });
  });
});
