import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import oldSave from '../../tests/fixtures/save-before-bronze.json';
import { MemoryStorage } from './storage';
import { SAVE_KEY, SaveSlot } from './document';

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
    expect(f.effTier).toBe(f.tier);
    const have = (item: string) => state.player.toJSON().inventory.reduce((n, s) => n + (s?.item === item ? s.count : 0), 0);
    expect(have('bronze_ingot')).toBe(5);
    expect(have('plank')).toBe(7);
    const magic = (state.toSave().world.extras as { magic?: { research: { scanned: string[] } } }).magic;
    expect(magic?.research.scanned).toEqual(['oak_log', 'copper_ore']);
    state.dispose();
  });
});
