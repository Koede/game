import { describe, expect, it } from 'vitest';
import { OBJECTIVES } from '../core/registry';
import { SAVE_REV, heavyIndustry, migrateWorld } from './migrations';

const world = (completed: string[]): Record<string, unknown> => ({ rev: 2, objectives: { completed, flags: [], age: 2, peaks: { tempC: 0, tier: 3, generationW: 0, storedJ: 0 } } });
const done = (w: Record<string, unknown>): string[] => (w.objectives as { completed: string[] }).completed;

describe('rev 2 -> 3: Forge heavy industry', () => {
  it('marks the new goals done for a save that had already built the crusher, and keeps its place', () => {
    const w = world(['blast_furnace', 'smelt_iron', 'make_steel', 'first_power', 'place_lamp', 'place_crusher']);
    expect(migrateWorld(w)).toBe('ok');
    expect(w.rev).toBe(SAVE_REV);
    for (const id of ['make_iron_axle', 'place_rolling_mill', 'place_drop_forge', 'place_dynamo']) expect(done(w)).toContain(id);
    expect(done(w).filter((id) => id === 'first_power')).toHaveLength(1);
  });

  it('leaves a save that is still on the way to the crusher alone: it meets the new goals in order', () => {
    const w = world(['blast_furnace', 'smelt_iron', 'first_power', 'place_lamp']);
    migrateWorld(w);
    // The steam migration (rev 2 -> 3) hands a save past the Blast Furnace its goals; this one's step must add none of the Forge ones.
    expect(done(w)).toEqual(expect.arrayContaining(['blast_furnace', 'smelt_iron', 'first_power', 'place_lamp']));
    for (const id of ['make_iron_axle', 'place_rolling_mill', 'place_drop_forge', 'place_dynamo']) expect(done(w)).not.toContain(id);
  });

  it('survives a world without objectives', () => {
    expect(() => heavyIndustry({ rev: 2 })).not.toThrow();
  });

  it('only names goals that exist in this build, and the moved ones are Forge Age goals', () => {
    const ids = new Map(OBJECTIVES.map((o) => [o.id, o]));
    for (const id of ['make_iron_axle', 'place_rolling_mill', 'place_drop_forge', 'place_dynamo', 'first_power', 'place_lamp']) {
      expect(ids.get(id)?.age, id).toBe(2);
    }
    const order = OBJECTIVES.map((o) => o.id);
    expect(order.indexOf('place_dynamo')).toBeLessThan(order.indexOf('first_power'));
    expect(order.indexOf('first_power')).toBeLessThan(order.indexOf('place_crusher'));
  });
});
