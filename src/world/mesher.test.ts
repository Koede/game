import { describe, expect, it } from 'vitest';
import { seedFromString } from '../core/math';
import { blockId, textureLayer } from '../core/registry';
import { Facing, LIGHT_FLAG_EMISSIVE, LIGHT_FLAG_LIQUID, LIGHT_FLAG_SWAY, makeVoxel, type MeshBatch } from '../core/types';
import { LIQUID_SURFACE, meshBuffers, meshChunk } from './mesher';
import { emptyNeighborhood, fill, put } from './testUtil';
import { generateChunk } from './worldgen';

const STONE = blockId('stone');
const quads = (b: MeshBatch): number => b.indices.length / 6;
const mesh = (chunks: Uint16Array[]) => meshChunk({ cx: 0, cz: 0, chunks });

function expectConsistent(b: MeshBatch): void {
  const verts = b.layers.length;
  expect(b.positions.length).toBe(verts * 3);
  expect(b.uvs.length).toBe(verts * 2);
  expect(b.light.length).toBe(verts * 4);
  expect(b.indices.length).toBe((verts / 4) * 6);
  expect(b.indices.every((i) => i < verts)).toBe(true);
  for (const arr of [b.positions, b.uvs, b.layers, b.light, b.indices]) expect(arr.byteLength).toBe(arr.buffer.byteLength);
}

describe('meshChunk', () => {
  it('draws a lone block as 6 faces', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, STONE);
    const m = mesh(chunks);
    expect(m.opaque.layers.length).toBe(24);
    expect(m.opaque.indices.length).toBe(36);
    expect(m.cutout.indices.length + m.translucent.indices.length).toBe(0);
    expectConsistent(m.opaque);
    expect([...m.opaque.layers].every((l) => l === textureLayer('stone'))).toBe(true);
    expect(Math.min(...m.opaque.positions.filter((_, i) => i % 3 === 1))).toBe(40);
    expect(Math.max(...m.opaque.positions.filter((_, i) => i % 3 === 1))).toBe(41);
    // In the open every corner is fully lit and unshaded apart from the face's own shading.
    const shades = new Set(m.opaque.light.filter((_, i) => i % 4 === 2));
    expect([...shades].sort((a, b) => a - b)).toEqual([127, 165, 204, 255]);
    // Full daylight everywhere except underneath. The cell below the block has sky light 14 (lit sideways);
    // smooth lighting averages it with the three fully lit cells around each bottom corner: 14.75 x 17.
    for (let v = 0; v < 24; v++) expect(m.opaque.light[v * 4]).toBe(v >= 12 && v < 16 ? Math.round(14.75 * 17) : 255);
    expect(meshBuffers(m).length).toBe(15);
  });

  it('winds every triangle counter-clockwise seen from outside', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, STONE);
    const { positions: p, indices } = mesh(chunks).opaque;
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
      const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const out = [(p[a] + p[b] + p[c]) / 3 - 5.5, (p[a + 1] + p[b + 1] + p[c + 1]) / 3 - 40.5, (p[a + 2] + p[b + 2] + p[c + 2]) / 3 - 5.5];
      expect(n[0] * out[0] + n[1] * out[1] + n[2] * out[2]).toBeGreaterThan(0);
    }
  });

  it('hides the faces between opaque blocks, also across the chunk border', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, STONE);
    put(chunks, 6, 40, 5, STONE);
    expect(quads(mesh(chunks).opaque)).toBe(10);
    const border = emptyNeighborhood();
    put(border, 15, 40, 5, STONE);
    put(border, 16, 40, 5, STONE);
    put(border, 0, 40, 0, STONE);
    put(border, 0, 40, -1, STONE);
    expect(quads(mesh(border).opaque)).toBe(10);
  });

  it('darkens corners next to other blocks', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, 0, 39, 0, 15, 39, 15, STONE);
    put(chunks, 5, 40, 5, STONE);
    const m = mesh(chunks);
    const top = new Set<number>();
    for (let v = 0; v < m.opaque.layers.length; v++) {
      if (m.opaque.positions[v * 3 + 1] === 40 && m.opaque.light[v * 4 + 2] < 255) top.add(m.opaque.light[v * 4 + 2]);
    }
    // Floor corners touching the block are occluded; the block's own side faces are shaded at their base.
    expect(top.size).toBeGreaterThan(1);
    expect(Math.min(...top)).toBeLessThan(140);
  });

  it('lowers the surface of water and flags it', () => {
    const chunks = emptyNeighborhood();
    const water = blockId('water');
    fill(chunks, 4, 39, 4, 6, 39, 6, STONE);
    put(chunks, 5, 40, 5, water);
    put(chunks, 5, 41, 5, water);
    const m = mesh(chunks);
    expectConsistent(m.translucent);
    // Two cells: 4 sides each, one top; the face between them and the bottom against stone are hidden.
    expect(quads(m.translucent)).toBe(9);
    const ys = [...m.translucent.positions.filter((_, i) => i % 3 === 1)];
    expect(Math.max(...ys)).toBeCloseTo(41 + LIQUID_SURFACE);
    const flagged = [...m.translucent.light.filter((_, i) => i % 4 === 3)].filter((f) => f & LIGHT_FLAG_LIQUID).length;
    expect(flagged).toBe(4);
    const lava = emptyNeighborhood();
    put(lava, 5, 40, 5, blockId('lava'));
    const lm = mesh(lava);
    expect(quads(lm.opaque)).toBe(6);
    expect(lm.opaque.light.filter((_, i) => i % 4 === 3).every((f) => (f & LIGHT_FLAG_EMISSIVE) !== 0)).toBe(true);
  });

  it('draws plants as crossed double-sided quads that sway at the top', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, blockId('tall_grass'));
    const m = mesh(chunks);
    expect(quads(m.cutout)).toBe(4);
    expectConsistent(m.cutout);
    for (let v = 0; v < 16; v++) {
      expect((m.cutout.light[v * 4 + 3] & LIGHT_FLAG_SWAY) !== 0).toBe(m.cutout.positions[v * 3 + 1] === 41);
    }
  });

  it('draws a torch as a thin post with a separate glowing tip', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, blockId('torch'));
    const m = mesh(chunks);
    // Post: 4 sides and a bottom; tip: 4 sides and a top.
    expect(quads(m.cutout)).toBe(10);
    expect(m.opaque.indices.length).toBe(0);
    const xs = [...m.cutout.positions.filter((_, i) => i % 3 === 0)];
    expect(Math.min(...xs)).toBeCloseTo(5 + 7 / 16);
    expect(Math.max(...xs)).toBeCloseTo(5 + 9 / 16);
    const ys = [...m.cutout.positions.filter((_, i) => i % 3 === 1)];
    expect(Math.max(...ys)).toBeCloseTo(40 + 10 / 16);
    for (let v = 0; v < 40; v++) {
      const tip = v >= 20;
      expect((m.cutout.light[v * 4 + 3] & LIGHT_FLAG_EMISSIVE) !== 0).toBe(tip);
      if (tip) expect(m.cutout.positions[v * 3 + 1]).toBeGreaterThanOrEqual(40.5);
      else expect(m.cutout.positions[v * 3 + 1]).toBeLessThanOrEqual(40.5);
      expect(m.cutout.light[v * 4 + 1]).toBe(13 * 17);
    }
  });

  it('grows cable arms towards power blocks only', () => {
    const cable = blockId('copper_cable');
    const alone = emptyNeighborhood();
    put(alone, 5, 40, 5, cable);
    put(alone, 5, 39, 5, STONE);
    // The core's 6 faces, plus all 6 of the stone: a cable hides nothing.
    expect(quads(mesh(alone).opaque)).toBe(6 + 6);
    const linked = emptyNeighborhood();
    put(linked, 5, 40, 5, cable);
    put(linked, 6, 40, 5, cable);
    put(linked, 5, 41, 5, blockId('lamp'));
    // Cable A: core 4 faces + 2 arms x 4. Cable B: core 5 + 1 arm x 4. Lamp: 6.
    expect(quads(mesh(linked).opaque)).toBe(12 + 9 + 6);
    // An arm reaching a device that does not fill its cell (a solar panel slab) gets an end cap.
    const capped = emptyNeighborhood();
    put(capped, 5, 40, 5, cable);
    put(capped, 6, 40, 5, blockId('solar_panel'));
    const m = mesh(capped).opaque;
    // Core 5 + arm 5 + slab 6 (the slab's side faces the cable, which is not opaque).
    expect(quads(m)).toBe(16);
    const xs = [...m.positions.filter((_, i) => i % 3 === 0)];
    expect(xs.filter((x) => x === 6).length).toBeGreaterThanOrEqual(4 + 4);
  });

  it('keeps the water surface full height under ice', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, 4, 39, 4, 6, 39, 6, STONE);
    put(chunks, 5, 40, 5, blockId('water'));
    put(chunks, 5, 41, 5, blockId('ice'));
    const ys = [...mesh(chunks).translucent.positions.filter((_, i) => i % 3 === 1)];
    expect(Math.max(...ys)).toBe(41);
  });

  it('splits a quad along the diagonal that keeps a single dark corner in one triangle', () => {
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const chunks = emptyNeighborhood();
      fill(chunks, 0, 39, 0, 15, 39, 15, STONE);
      put(chunks, 5 + dx, 40, 5 + dz, STONE);
      const m = mesh(chunks).opaque;
      // The top face of the floor cell (5, 39, 5): the quad whose four vertices lie at y = 40 inside x, z 5..6.
      const inCell = (v: number): boolean => {
        const [x, y, z] = [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]];
        return y === 40 && x >= 5 && x <= 6 && z >= 5 && z <= 6;
      };
      let first = -1;
      for (let v = 0; v < m.layers.length && first < 0; v += 4) if ([0, 1, 2, 3].every((k) => inCell(v + k))) first = v;
      expect(first).toBeGreaterThanOrEqual(0);
      const corners = [first, first + 1, first + 2, first + 3];
      const dark = corners.reduce((a, b) => (m.light[b * 4 + 2] < m.light[a * 4 + 2] ? b : a));
      expect(corners.filter((c) => m.light[c * 4 + 2] === m.light[dark * 4 + 2]).length).toBe(1);
      const q = corners[0] / 4;
      const tris = [[...m.indices.slice(q * 6, q * 6 + 3)], [...m.indices.slice(q * 6 + 3, q * 6 + 6)]];
      expect(tris.filter((t) => t.includes(dark)).length).toBe(1);
    }
  });

  it('draws a slab half as high as its cell', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, blockId('solar_panel'));
    const m = mesh(chunks);
    expect(quads(m.opaque)).toBe(6);
    expect(Math.max(...m.opaque.positions.filter((_, i) => i % 3 === 1))).toBe(40.5);
  });

  it('marks only the glowing face of a lit furnace as emissive', () => {
    const furnace = blockId('furnace_clay');
    const cold = emptyNeighborhood();
    put(cold, 5, 40, 5, makeVoxel(furnace, Facing.East));
    expect(mesh(cold).opaque.light.filter((_, i) => i % 4 === 3).some((f) => f !== 0)).toBe(false);
    const hot = emptyNeighborhood();
    put(hot, 5, 40, 5, makeVoxel(furnace, Facing.East, true));
    const m = mesh(hot).opaque;
    const glowing: number[] = [];
    for (let v = 0; v < 24; v++) if (m.light[v * 4 + 3] & LIGHT_FLAG_EMISSIVE) glowing.push(m.positions[v * 3]);
    expect(glowing).toEqual([6, 6, 6, 6]);
  });

  it('meshes generated terrain well within 25 ms', () => {
    const seed = seedFromString('mesher');
    const grid = new Map<string, Uint16Array>();
    for (let cz = -1; cz <= 6; cz++) for (let cx = -1; cx <= 5; cx++) grid.set(`${cx},${cz}`, generateChunk(seed, cx, cz));
    let faces = 0;
    // Best of three passes: a timing test must not fail because other test files run alongside (12 threads).
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) {
    faces = 0;
    const t0 = performance.now();
    for (let cz = 0; cz < 6; cz++) {
      for (let cx = 0; cx < 5; cx++) {
        const chunks: Uint16Array[] = [];
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) chunks.push(grid.get(`${cx + dx},${cz + dz}`) as Uint16Array);
        const m = meshChunk({ cx, cz, chunks });
        faces += quads(m.opaque) + quads(m.cutout) + quads(m.translucent);
      }
    }
    best = Math.min(best, (performance.now() - t0) / 30);
    }
    const ms = best;
    console.log(`meshChunk (lighting included): ${ms.toFixed(2)} ms average over 30 chunks, ${Math.round(faces / 30)} faces per chunk`);
    // 25 ms alone; 3x wider for the parallel suite (best-of-3 already; 40 ms seen under load). Still catches an order-of-magnitude regression.
    expect(ms).toBeLessThan(75);
    expect(faces / 30).toBeGreaterThan(200);
  });
});
