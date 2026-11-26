import { describe, expect, it } from 'vitest';
import modulesAll from '../../tests/fixtures/saves/modules-all.json';
import type { WorldSave } from '../save/document';
import { GameState } from './state';

const fixture = (): WorldSave => JSON.parse(JSON.stringify(modulesAll.world));

describe('blueprints in the saved world (extras.blueprints)', () => {
  it('a saved blueprint survives save and restore', () => {
    const s = GameState.restore(fixture());
    const b = s.blueprints;
    b.saved.push({ name: 'Wall', size: [2, 1, 1], cells: [{ dx: 0, dy: 0, dz: 0, block: 'plank', facing: 0 }, { dx: 1, dy: 0, dz: 0, block: 'stone', facing: 0 }] });
    const save = s.toSave();
    s.dispose();
    expect((save.world.extras as Record<string, unknown>).blueprints).toBeDefined();
    const again = GameState.restore(JSON.parse(JSON.stringify(save)));
    expect(again.blueprints.saved.map((x) => x.name)).toEqual(['Wall']);
    expect(again.blueprints.saved[0].cells).toHaveLength(2);
    again.dispose();
  });
});
