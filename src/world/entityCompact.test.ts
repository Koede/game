import { describe, expect, it } from 'vitest';
import { createFurnace, createMachine } from '../sim/entities';
import { MACHINE_DEFAULTS, compactEntity, expandEntity } from './entityCompact';

const sorted = (o: object): string => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1))));

describe('compact entities', () => {
  it('MACHINE_DEFAULTS matches what createMachine starts every field at', () => {
    const m = createMachine('crate', 4, 9, 5) as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(MACHINE_DEFAULTS)) expect(m[k], k).toEqual(v);
    expect(m.depthY).toBe(9);
    expect(Object.keys(m).sort()).toEqual(['kind', 'x', 'y', 'z', 'slots', 'depthY', ...Object.keys(MACHINE_DEFAULTS)].sort());
  });

  it('a machine round-trips exactly and gets much smaller', () => {
    const crate = createMachine('crate', 4, 9, 5);
    crate.slots[0] = { item: 'coal', count: 5 };
    crate.slots[3] = { item: 'torch', count: 1 };
    crate.progress = 1.5;
    crate.on = false;
    const packed = compactEntity(crate);
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(crate).length / 2);
    expect(packed.slots).toHaveLength(4);
    expect(sorted(expandEntity(JSON.parse(JSON.stringify(packed))))).toBe(sorted(crate));
  });

  it('keeps a depth that differs from y and an unusual extra field', () => {
    const m = createMachine('bore_rig', 1, 30, 1) as ReturnType<typeof createMachine> & { wear?: number };
    m.depthY = 12;
    m.wear = 0.25;
    expect(sorted(expandEntity(JSON.parse(JSON.stringify(compactEntity(m)))))).toBe(sorted(m));
  });

  it('leaves furnaces and entities saved in full alone', () => {
    const f = createFurnace(0, 5, 0, 2);
    expect(compactEntity(f)).toBe(f);
    const full = createMachine('crate', 0, 5, 0);
    expect(expandEntity(full)).toBe(full);
    expect(sorted(expandEntity(JSON.parse(JSON.stringify(full))))).toBe(sorted(full));
  });

  it('does not touch the live entity', () => {
    const crate = createMachine('crate', 4, 9, 5);
    const before = sorted(crate);
    compactEntity(crate);
    expect(sorted(crate)).toBe(before);
    expect(crate.slots).toHaveLength(27);
  });
});
