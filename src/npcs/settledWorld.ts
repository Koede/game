/**
 * Test fixture: a new world with the full tavern built and everyone living in it (`NpcManager.settle`, the same as the debug
 * helper `window.__hw.settle()`). Tests of the tavern's people and features start from here; a plain new world is a camp.
 */
import { GameState } from '../app/state';

export function settledWorld(seed: number, seedText: string | null = null): GameState {
  const state = GameState.create(seed, seedText);
  if (!state.settleNpcs()) throw new Error('settledWorld: the camp could not be settled');
  return state;
}
