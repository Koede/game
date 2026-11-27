import { describe, expect, it } from 'vitest';
import { OBJECTIVES, recipesFor } from '../core/registry';
import { hearthMaterials } from './progression';

describe('hearth goals tell the player what the shell costs', () => {
  const text = (id: string): string => OBJECTIVES.find((o) => o.id === id)?.text ?? '';
  it('names the casing counts the upgrade really needs', () => {
    const plasma = hearthMaterials(5).find((m) => m.item === 'plasma_casing')!.count;
    const star = hearthMaterials(6).find((m) => m.item === 'star_casing')!.count;
    expect(text('plasma_furnace')).toContain(`${plasma} plasma casings`);
    expect(text('starhearth')).toContain(`${star} star casings`);
  });
  it('gets the batch sizes right', () => {
    expect(recipesFor('plasma_casing')[0].output.count).toBe(6);
    const batch = recipesFor('star_casing')[0];
    expect(batch.output.count).toBe(6);
    const star = hearthMaterials(6).find((m) => m.item === 'star_casing')!.count;
    const batches = Math.ceil(star / batch.output.count);
    expect(batches).toBe(16);
    expect(batches * batch.inputs.find((i) => i.item === 'superalloy')!.count).toBe(32);
  });
});
