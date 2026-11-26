/**
 * The save captured by scripts/make-save-fixture.mjs from the build before the six-age refactor.
 * Expected values are literals on purpose: the W0 migration (furnace tier >= 2 becomes +1, so this
 * Blast furnace and its hearth tier become 3) has to update them. Updated for the merged build: tiers 3, objectives age 2,
 * peaks.tier 3 (gather_logs still at index 0).
 */
import { describe, expect, it } from 'vitest';
import { GameState } from '../src/app/state';
import { OBJECTIVES } from '../src/content/objectives';
import { blockOf } from '../src/core/registry';
import { SAVE_KEY, SaveSlot } from '../src/save/document';
import { MemoryStorage } from '../src/save/storage';
import { isFurnace } from '../src/sim';
import envelope from './fixtures/save-v-before-bronze.json';

describe('pre-bronze save', () => {
  it('loads the captured Blast hearth through SaveSlot and GameState.restore', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    const slot = new SaveSlot(storage);
    const doc = slot.read();

    expect(slot.held).toBe(false);
    expect(slot.lastProblem).toBeNull();
    const world = doc.world;
    expect(world).not.toBeNull();
    if (world === null) return;

    // Survival worlds omit mode.
    expect(world.mode).toBeUndefined();
    expect(world.seed).toBe(3237258699);
    expect(world.seedText).toBe('bronze-w0');

    const state = GameState.restore(world);
    try {
      state.prepareAroundPlayer(1);

      expect(state.mode).toBe('survival');
      expect(state.world.seed).toBe(3237258699);
      expect(state.seedText).toBe('bronze-w0');
      expect(state.player.position).toEqual({ x: -15.5, y: 45, z: -19.5 });

      const stacks = state.player.inventory.toJSON().flatMap((s) => (s ? [s] : []));
      expect(stacks).toHaveLength(3);
      expect(stacks).toEqual([
        { item: 'brick', count: 15 },
        { item: 'furnace_blast', count: 1 },
        { item: 'item_hatch', count: 1 },
      ]);

      const goal = state.objectives.current;
      expect(goal?.id).toBe('gather_logs');
      expect(goal).not.toBeNull();
      if (goal === null) return;
      expect(OBJECTIVES.indexOf(goal)).toBe(0);
      expect(state.objectives.age).toBe(2); // six-age migration: Ember(0) Bronze(1) ... old age 1 -> 2
      expect(state.objectives.toJSON().peaks.tier).toBe(3); // migrated with the furnace tiers (Blast was 2, now 3)

      expect(blockOf(state.world.getVoxel(-16, 44, -18)).key).toBe('furnace_blast');
      const furnaces = [...state.world.entities()].filter(isFurnace);
      expect(furnaces).toHaveLength(1);
      const furnace = furnaces[0];
      if (!furnace) return;
      expect(furnace.tier).toBe(3); // Bronze Furnace took tier 2
      expect(furnace.effTier).toBe(3);
      expect(furnace.hearth).toEqual({
        tier: 3,
        inner: [1, 1, 1],
        closed: false,
        windows: 0,
        min: [-17, 43, -20],
        max: [-15, 44, -18],
      });
      // BRONZE_PLAN 4.5: the hearth was built before the Blast Nozzle was required; the migration flags it and a rescan keeps it.
      expect(furnace.legacyHearth).toBe(true);
      state.sim.validateHearths();
      state.sim.tick(0.05);
      expect(furnace.hearth).toMatchObject({ tier: 3, inner: [1, 1, 1] });
      expect(state.sim.structureView(-16, 44, -18, { tier: 3 })!.problems).toEqual([]);
    } finally {
      state.dispose();
    }
  });
});
