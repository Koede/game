import { describe, expect, it } from 'vitest';
import { SAVE_REV, blastNozzle, migrateWorld } from './migrations';

const furnace = (tier: number): Record<string, unknown> => ({ kind: 'furnace', x: 0, y: 1, z: 0, tier });

describe('rev 2 -> 3: the Blast Nozzle', () => {
  it('flags every furnace that owns tier 3 or more, and nothing else', () => {
    const world = { world: { entities: [furnace(1), furnace(2), furnace(3), furnace(5), { kind: 'crate', tier: 3 }] } };
    blastNozzle(world);
    const flags = (world.world.entities as Array<Record<string, unknown>>).map((e) => e.legacyHearth);
    expect(flags).toEqual([undefined, undefined, true, true, undefined]);
  });

  it('survives a world without entities', () => {
    expect(() => blastNozzle({})).not.toThrow();
    expect(() => blastNozzle({ world: { entities: null } })).not.toThrow();
  });

  it('runs after the six-age renumbering for a rev 1 save: an old Blast furnace (tier 2) ends up flagged at tier 3', () => {
    const world: Record<string, unknown> = { rev: 1, world: { entities: [furnace(2), furnace(1)] } };
    expect(migrateWorld(world)).toBe('ok');
    expect(world.rev).toBe(SAVE_REV);
    expect((world.world as { entities: Array<Record<string, unknown>> }).entities.map((e) => [e.tier, e.legacyHearth])).toEqual([[3, true], [1, undefined]]);
  });
});
