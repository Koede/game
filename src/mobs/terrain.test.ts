import { describe, expect, it } from 'vitest';
import { findShore, spawnCell, standCell, walkable } from './terrain';
import { FlatWorld } from './testKit';

// Flat grass at y = 10: an animal on it has its feet in cell 11.
describe('standCell', () => {
  it('walks on flat ground', () => {
    const w = new FlatWorld();
    expect(standCell(w, 3, 3, 11, 1)).toBe(11);
  });

  it('hops up one block but not two', () => {
    const w = new FlatWorld();
    w.put(3, 11, 3, 'dirt');
    expect(standCell(w, 3, 3, 11, 1)).toBe(12);
    w.put(3, 12, 3, 'dirt');
    expect(standCell(w, 3, 3, 11, 1)).toBeNaN();
  });

  it('needs headroom for its body over a step', () => {
    const w = new FlatWorld();
    w.put(3, 11, 3, 'dirt');
    w.put(3, 13, 3, 'dirt');
    expect(standCell(w, 3, 3, 11, 1)).toBe(12);
    expect(standCell(w, 3, 3, 11, 2)).toBeNaN();
  });

  it('steps down at most MOB_MAX_DROP blocks', () => {
    const w = new FlatWorld();
    w.fill(3, 9, 3, 3, 10, 3, 'air'); // a 2-deep hole
    expect(standCell(w, 3, 3, 11, 1)).toBe(9);
    w.put(3, 8, 3, 'air'); // 3 deep
    expect(standCell(w, 3, 3, 11, 1)).toBeNaN();
  });

  it('refuses liquid at foot level or in a hole', () => {
    const w = new FlatWorld();
    w.put(3, 10, 3, 'water');
    expect(standCell(w, 3, 3, 11, 1)).toBeNaN();
    w.put(4, 11, 4, 'lava');
    expect(standCell(w, 4, 4, 11, 1)).toBeNaN();
  });

  it('treats unloaded columns and negative coordinates correctly', () => {
    const w = new FlatWorld();
    expect(standCell(w, -5, -20, 11, 1)).toBe(11);
    w.setLoaded(-1, -2, false);
    expect(standCell(w, -5, -20, 11, 1)).toBeNaN();
    expect(standCell(w, 5, -20, 11, 1)).toBe(11);
  });

  it('walks through plants', () => {
    const w = new FlatWorld();
    w.put(3, 11, 3, 'tall_grass');
    expect(standCell(w, 3, 3, 11, 1)).toBe(11);
  });
});

describe('walkable', () => {
  it('accepts a straight walk over gentle steps and refuses one crossing water', () => {
    const w = new FlatWorld();
    w.put(4, 11, 0, 'dirt');
    expect(walkable(w, 0.5, 0.5, 11, 6.5, 0.5, 1)).toBe(11);
    w.put(8, 10, 0, 'water');
    expect(walkable(w, 0.5, 0.5, 11, 10.5, 0.5, 1)).toBeNaN();
  });

  it('crosses chunk borders at negative coordinates', () => {
    const w = new FlatWorld();
    expect(walkable(w, 3.5, -14.5, 11, -3.5, -18.5, 1)).toBe(11);
  });

  it('cannot squeeze diagonally between two walls', () => {
    const w = new FlatWorld();
    w.fill(1, 11, 0, 1, 12, 0, 'stone');
    w.fill(0, 11, 1, 0, 12, 1, 'stone');
    expect(walkable(w, 0.5, 0.5, 11, 1.5, 1.5, 1)).toBeNaN();
  });
});

describe('spawnCell', () => {
  it('accepts open natural ground and refuses the rest', () => {
    const w = new FlatWorld();
    expect(spawnCell(w, 2, 2, 1)).toBe(11);
    w.put(2, 11, 2, 'tall_grass');
    expect(spawnCell(w, 2, 2, 1)).toBe(11);
    w.put(3, 10, 3, 'stone_brick');
    expect(spawnCell(w, 3, 3, 1)).toBe(-1);
    w.put(4, 14, 4, 'oak_leaves'); // under a canopy: not open to the sky
    expect(spawnCell(w, 4, 4, 1)).toBe(-1);
    w.put(5, 11, 5, 'water');
    expect(spawnCell(w, 5, 5, 1)).toBe(-1);
    w.put(6, 12, 6, 'plank'); // a roof right above: no headroom
    expect(spawnCell(w, 6, 6, 1)).toBe(-1);
  });
});

describe('findShore', () => {
  it('finds the nearest dry bank around a pond', () => {
    const w = new FlatWorld();
    w.fill(-3, 8, -3, 3, 10, 3, 'water');
    const out = [0, 0];
    expect(findShore(w, 0.5, 0.5, 10, 10, 1, out)).toBe(true);
    expect(Math.max(Math.abs(out[0] - 0.5), Math.abs(out[1] - 0.5))).toBe(4);
  });

  it('gives up when there is no land within the radius', () => {
    const w = new FlatWorld();
    w.fill(-12, 8, -12, 12, 10, 12, 'water');
    expect(findShore(w, 0.5, 0.5, 10, 5, 1, [0, 0])).toBe(false);
  });
});
