/** Old saves and winter: a world saved before seasons' hard winter existed never turns into one (no sudden winter death). */
import { describe, expect, it } from 'vitest';
import { GameState } from '../src/app/state';
import { DAYS_PER_SEASON } from '../src/sim/seasons';
import { SAVE_KEY, SaveSlot } from '../src/save/document';
import { MemoryStorage } from '../src/save/storage';
import envelope from './fixtures/save-v-before-bronze.json';

const clockDay = (s: GameState, day: number): void => s.clock.load({ timeOfDay: 0.9, day });

describe('winter and saves', () => {
  it('loads an old save as a normal-winter world even on the Hard setting, and takes no extra cold', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    const world = new SaveSlot(storage).read().world;
    expect(world).not.toBeNull();
    if (world === null) return;
    const state = GameState.restore(world, { difficulty: 'hard' });
    try {
      expect(state.winter.hard).toBe(false);
      expect(state.sim.hardWinter).toBe(false);
      clockDay(state, DAYS_PER_SEASON * 3 + 4);
      expect(state.winter.coldDrain(true)).toBe(0);
      expect(state.winter.current()).toBeNull();
    } finally {
      state.dispose();
    }
  });

  it('a new Hard world is a hard-winter world, saved and restored as one; a Normal world is not', () => {
    const hard = GameState.create(12345, null, { difficulty: 'hard' });
    const normal = GameState.create(12345, null, { difficulty: 'normal' });
    try {
      expect(hard.winter.hard).toBe(true);
      expect(hard.sim.hardWinter).toBe(true);
      expect(normal.winter.hard).toBe(false);
      const back = GameState.restore(JSON.parse(hard.toSaveJson()), { difficulty: 'normal' });
      try {
        expect(back.winter.hard).toBe(true);
      } finally {
        back.dispose();
      }
    } finally {
      hard.dispose();
      normal.dispose();
    }
  });
});
