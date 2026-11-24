/** Miniblock models: the data format and the mesher path that draws them. */
import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { CHUNK_SIZE, makeVoxel, voxelIndex, type ChunkMeshData, type Facing } from '../core/types';
import type { ChunkNeighborhood } from './chunk';
import { meshChunk } from './mesher';
import { boxCorners, mb, miniBounds, miniParts, MINI_MODELS, vessel, type MiniModel } from './miniModel';
import { isStationShape, stationBounds, stationIndex } from './stationShapes';

const near = (a: number[], b: number[]): void => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 4));

describe('miniblock format', () => {
  it('turns a rotated box about its origin and bounds the model with the turned corners', () => {
    const c = boxCorners(mb(0, 0, 0, 2, 2, 2, { rot: { axis: 'y', angle: 90, origin: [0, 0, 0] } }));
    near([c[3], c[4], c[5]], [0, 0, -2]); // corner +x -> -z for +90 about y
    const flat: MiniModel = { boxes: [mb(4, 0, 4, 12, 6, 12)] };
    near(miniBounds(flat), [0.25, 0, 0.25, 0.75, 6 / 16, 0.75]);
    const tilted: MiniModel = { boxes: [mb(6, 6, 2, 10, 8, 6, { rot: { axis: 'x', angle: -30, origin: [8, 8, 6] } })] };
    expect(miniBounds(tilted)[1]).toBeLessThan(6 / 16); // a leaning spout reaches outside its straight box
  });

  it('builds a vessel of five boxes and lists the moving parts by name', () => {
    expect(vessel(3, 13, 2, 8, 2)).toHaveLength(5);
    const m: MiniModel = { boxes: [mb(0, 0, 0, 4, 4, 4), mb(0, 4, 0, 4, 5, 4, { part: 'lid' }), mb(4, 4, 0, 5, 5, 4, { part: 'lid' }), mb(0, 0, 4, 1, 1, 5, { part: 'handle' })] };
    const parts = miniParts(m);
    expect([...parts.keys()]).toEqual(['lid', 'handle']);
    expect(parts.get('lid')).toHaveLength(2);
  });

  it('registers the clay pot as a station shape with its own outline', () => {
    expect(isStationShape('alloy_pot')).toBe(true);
    expect(stationIndex('alloy_pot')).toBeGreaterThan(stationIndex('mortar'));
    const b = stationBounds('alloy_pot')!;
    expect(b[1]).toBe(0);
    expect(b[4]).toBeGreaterThan(0.5);
    expect(Object.keys(MINI_MODELS)).toContain('alloy_pot');
  });
});

function meshAt(key: string, facing: Facing, neighbour?: string): { mesh: ChunkMeshData; quads: { v: number[][]; shade: number; layer: number }[] } {
  const centre = new Uint16Array(CHUNK_SIZE * 256 * CHUNK_SIZE);
  centre[voxelIndex(5, 40, 5)] = makeVoxel(blockId(key), facing);
  if (neighbour) centre[voxelIndex(4, 40, 5)] = makeVoxel(blockId(neighbour));
  const chunks: ChunkNeighborhood = [null, null, null, null, centre, null, null, null, null];
  const mesh = meshChunk({ cx: 0, cz: 0, chunks });
  const quads: { v: number[][]; shade: number; layer: number }[] = [];
  for (const batch of [mesh.opaque, mesh.cutout, mesh.translucent]) {
    for (let q = 0; q < batch.positions.length / 12; q++) {
      const v = [0, 1, 2, 3].map((k) => [batch.positions[(q * 4 + k) * 3] - 5, batch.positions[(q * 4 + k) * 3 + 1] - 40, batch.positions[(q * 4 + k) * 3 + 2] - 5]);
      quads.push({ v, shade: batch.light[q * 16 + 2], layer: batch.layers[q * 4] });
    }
  }
  return { mesh, quads };
}

describe('miniblock mesher path', () => {
  it('draws the clay pot from many small boxes, not one cube', () => {
    const { quads } = meshAt('alloy_pot', 0);
    expect(quads.length).toBeGreaterThan(40);
    let minY = 9, maxY = -9;
    for (const q of quads) for (const p of q.v) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    expect(minY).toBeCloseTo(0, 5);
    expect(maxY).toBeLessThan(0.8);
    expect(maxY).toBeGreaterThan(0.5);
  });

  it('shades each face by the way it points in the world (foot: top 1.0, bottom 0.5, west 0.65, shade 0.8 of the box)', () => {
    const { quads } = meshAt('alloy_pot', 0);
    const foot = (pred: (v: number[][]) => boolean): number | undefined => quads.find((q) => pred(q.v))?.shade;
    const all = (v: number[][], axis: number, val: number): boolean => v.every((p) => Math.abs(p[axis] - val) < 1e-4);
    const inFoot = (v: number[][]): boolean => v.every((p) => p[0] >= 4.5 / 16 - 1e-4 && p[0] <= 11.5 / 16 + 1e-4 && p[2] >= 4.5 / 16 - 1e-4 && p[2] <= 11.5 / 16 + 1e-4);
    expect(foot((v) => all(v, 1, 1 / 16) && inFoot(v))).toBe(Math.round(255 * 1 * 0.8) || 204);
    expect(foot((v) => all(v, 1, 0))).toBe(Math.floor(255 * 0.5 * 0.8));
    expect(foot((v) => all(v, 0, 4.5 / 16) && v.every((p) => p[1] <= 1 / 16 + 1e-4))).toBe(Math.floor(255 * 0.65 * 0.8));
    expect(foot((v) => all(v, 2, 4.5 / 16) && v.every((p) => p[1] <= 1 / 16 + 1e-4))).toBe(Math.floor(255 * 0.8 * 0.8));
  });

  it('turns the whole model with the facing and keeps it inside the cell', () => {
    const spout = (facing: Facing): { x: number; z: number } => {
      const { quads } = meshAt('alloy_pot', facing);
      let best = { x: 0.5, z: 0.5 };
      let d = 0;
      for (const q of quads) for (const p of q.v) {
        const r = Math.hypot(p[0] - 0.5, p[2] - 0.5);
        if (r > d && p[1] > 0.3) { d = r; best = { x: p[0], z: p[2] }; }
      }
      return best;
    };
    for (const f of [0, 1, 2, 3] as Facing[]) {
      const { quads } = meshAt('alloy_pot', f);
      for (const q of quads) for (const p of q.v) for (const a of p) { expect(a).toBeGreaterThan(-0.01); expect(a).toBeLessThan(1.01); }
    }
    const s0 = spout(0), s1 = spout(1), s2 = spout(2);
    // North: a spout or handle pokes out furthest along -Z or +X; each quarter turn moves it a quarter round.
    expect(s0.z < 0.2 || s0.x > 0.85).toBe(true);
    expect(Math.hypot(s0.x - s1.x, s0.z - s1.z)).toBeGreaterThan(0.2);
    expect(Math.hypot(s0.x - s2.x, s0.z - s2.z)).toBeGreaterThan(0.2);
  });

  it('is not a full cell: it hides none of the faces next to it', () => {
    const free = meshAt('alloy_pot', 0).quads.length;
    const walled = meshAt('alloy_pot', 0, 'stone').quads.length;
    expect(walled).toBe(free + 6); // the stone's six faces, all still visible
  });
});

describe('the jukebox model', () => {
  const model = MINI_MODELS.jukebox;
  const layersOf = (facing: Facing, active: boolean): { quads: { v: number[][] }[]; layers: Set<number> } => {
    const centre = new Uint16Array(CHUNK_SIZE * 256 * CHUNK_SIZE);
    centre[voxelIndex(5, 40, 5)] = makeVoxel(blockId('jukebox'), facing, active);
    const mesh = meshChunk({ cx: 0, cz: 0, chunks: [null, null, null, null, centre, null, null, null, null] });
    const quads: { v: number[][] }[] = [];
    const layers = new Set<number>();
    for (const batch of [mesh.opaque, mesh.cutout, mesh.translucent]) {
      for (let q = 0; q < batch.positions.length / 12; q++) {
        quads.push({ v: [0, 1, 2, 3].map((k) => [batch.positions[(q * 4 + k) * 3] - 5, batch.positions[(q * 4 + k) * 3 + 1] - 40, batch.positions[(q * 4 + k) * 3 + 2] - 5]) });
        layers.add(batch.layers[q * 4]);
      }
    }
    return { quads, layers };
  };

  it('is a many-box model whose every part lies inside the cell', () => {
    expect(model.boxes.length).toBeGreaterThan(30);
    for (const b of model.boxes) for (let a = 0; a < 3; a++) {
      expect(b.from[a]).toBeGreaterThanOrEqual(0);
      expect(b.to[a]).toBeLessThanOrEqual(16);
      expect(b.to[a]).toBeGreaterThan(b.from[a]);
    }
    expect(stationBounds('jukebox')![4]).toBe(1);
  });

  it('keeps its own meshed geometry inside the cell for every facing, and turns with it', () => {
    const front = (f: Facing): number => {
      let zmin = 9, xmax = -9, xmin = 9, zmax = -9;
      for (const q of layersOf(f, false).quads) for (const p of q.v) { zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]); xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]); expect(p[1]).toBeGreaterThanOrEqual(-1e-4); expect(p[1]).toBeLessThanOrEqual(1 + 1e-4); }
      expect(Math.min(zmin, xmin)).toBeGreaterThanOrEqual(-1e-4);
      expect(Math.max(zmax, xmax)).toBeLessThanOrEqual(1 + 1e-4);
      // The front proud of the cabinet (the chrome kick and the bubble tubes) reaches 0.4/16 from its edge: which edge says the facing.
      return zmin < 0.05 ? 0 : xmax > 0.95 ? 1 : zmax > 0.95 ? 2 : 3;
    };
    expect([0, 1, 2, 3].map((f) => front(f as Facing))).toEqual([0, 1, 2, 3]);
  });

  it('shows the lit window and bubble tubes only while active', () => {
    const off = layersOf(0, false), on = layersOf(0, true);
    expect(off.quads.length).toBe(on.quads.length);
    expect([...on.layers].sort().join()).not.toBe([...off.layers].sort().join());
    expect(on.layers.size).toBe(off.layers.size);
  });
});
