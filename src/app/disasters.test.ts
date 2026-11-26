import { describe, expect, it } from 'vitest';
import modulesAll from '../../tests/fixtures/saves/modules-all.json';
import type { WorldSave } from '../save/document';
import { GameState } from './state';

const fixture = (): WorldSave => JSON.parse(JSON.stringify(modulesAll.world));

describe('disasters in the headless GameState', () => {
  it('an old save without the field loads calm, ticks, and saves the new field', () => {
    const save = fixture();
    delete (save as { disasters?: unknown }).disasters;
    const s = GameState.restore(save, { difficulty: 'hard' });
    for (let i = 0; i < 100; i++) s.tick();
    const out = s.toSave();
    expect(out.disasters).toMatchObject({ v: 1 });
    expect(s.disasters.alerts()).toEqual([]);
    const again = GameState.restore(JSON.parse(JSON.stringify(out)), { difficulty: 'normal' });
    again.tick();
    again.dispose();
    s.dispose();
  });

  it('a damaged disasters block is ignored, never a reason to drop the world', () => {
    const save = fixture();
    (save as { disasters?: unknown }).disasters = { v: 'nope' };
    const s = GameState.restore(save);
    s.tick();
    expect(s.disasters.alerts()).toEqual([]);
    s.dispose();
  });
});
