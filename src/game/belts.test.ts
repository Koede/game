import { describe, expect, it } from 'vitest';
import { BeltGrid } from './belts';
import { Inventory } from './inventory';

const run = (g: BeltGrid, s: number): void => {
  for (let i = 0; i < s * 20; i++) g.tick(0.05);
};

describe('belt lanes', () => {
  it('carries items along a belt from a source into a sink, visibly in between', () => {
    const g = new BeltGrid();
    const from = new Inventory(4);
    from.add('coal', 3);
    const to = new Inventory(4);
    g.set(0, 0, 0, { kind: 'source', dir: 0, inv: from, everyS: 0.5 });
    for (let x = 1; x <= 4; x++) g.set(x, 0, 0, { kind: 'belt', dir: 0 });
    g.set(5, 0, 0, { kind: 'sink', inv: to });
    run(g, 1.2);
    expect(g.riding).toBeGreaterThan(0);
    const seen = g.items();
    expect(seen[0].item).toBe('coal');
    expect(seen[0].x).toBeGreaterThan(1);
    run(g, 8);
    expect(to.count('coal')).toBe(3);
    expect(from.count('coal')).toBe(0);
    expect(g.delivered.get('coal')).toBe(3);
    expect(g.riding).toBe(0);
  });

  it('a sorter sends its filter out of the side and the rest straight on', () => {
    const g = new BeltGrid();
    const src = new Inventory(4);
    src.add('coal', 2);
    src.add('flint', 2);
    const ahead = new Inventory(4);
    const side = new Inventory(4);
    g.set(0, 0, 0, { kind: 'source', dir: 0, inv: src, everyS: 0.3 });
    g.set(1, 0, 0, { kind: 'sorter', dir: 0, filter: ['flint'], side: 1 });
    g.set(2, 0, 0, { kind: 'belt', dir: 0 });
    g.set(3, 0, 0, { kind: 'sink', inv: ahead });
    g.set(1, 0, 1, { kind: 'belt', dir: 1 });
    g.set(1, 0, 2, { kind: 'sink', inv: side });
    run(g, 10);
    expect(side.count('flint')).toBe(2);
    expect(ahead.count('coal')).toBe(2);
    expect(side.count('coal') + ahead.count('flint')).toBe(0);
  });

  it('a tunnel jumps items under the cells between its ends, and a full sink backs the lane up', () => {
    const g = new BeltGrid();
    const src = new Inventory(2);
    src.add('stick', 5);
    const full = new Inventory(1);
    full.add('plank', 99);
    g.set(0, 0, 0, { kind: 'source', dir: 0, inv: src, everyS: 0.2 });
    g.set(1, 0, 0, { kind: 'tunnel_in', dir: 0 });
    g.set(5, 0, 0, { kind: 'tunnel_out', dir: 0 });
    g.set(6, 0, 0, { kind: 'belt', dir: 0 });
    const end = new Inventory(4);
    g.set(7, 0, 0, { kind: 'sink', inv: end });
    run(g, 6);
    expect(end.count('stick')).toBe(5);
    g.set(7, 0, 0, { kind: 'sink', inv: full });
    src.add('stick', 2);
    run(g, 8);
    expect(full.count('stick')).toBe(0);
    expect(g.riding + src.count('stick')).toBe(2);
  });
});
