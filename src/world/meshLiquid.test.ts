import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { LIGHT_FLAG_LIQUID, LIGHT_FLAG_SWAY, type MeshBatch } from '../core/types';
import { FALL_STRETCH, LIQUID_SURFACE, meshChunk } from './mesher';
import { emptyNeighborhood, fill, put } from './testUtil';
import { WATER_FALLING, WATER_SOURCE, flowingWater } from './water';

const STONE = blockId('stone');
const mesh = (chunks: Uint16Array[]) => meshChunk({ cx: 0, cz: 0, chunks });

interface Vert {
  x: number;
  y: number;
  z: number;
  u: number;
  v: number;
  flags: number;
}

function verts(b: MeshBatch): Vert[] {
  const out: Vert[] = [];
  for (let i = 0; i < b.layers.length; i++) {
    out.push({ x: b.positions[i * 3], y: b.positions[i * 3 + 1], z: b.positions[i * 3 + 2], u: b.uvs[i * 2], v: b.uvs[i * 2 + 1], flags: b.light[i * 4 + 3] });
  }
  return out;
}

/** The four vertices of the top face of the water cell at (x, y, z) (the quad whose corners all lie on that cell). */
function topFace(b: MeshBatch, x: number, y: number, z: number): Vert[] {
  const vs = verts(b);
  for (let q = 0; q < vs.length; q += 4) {
    const quad = vs.slice(q, q + 4);
    const onCell = quad.every((p) => p.x >= x && p.x <= x + 1 && p.z >= z && p.z <= z + 1 && p.y > y && p.y <= y + 1);
    const flat = new Set(quad.map((p) => `${p.x},${p.z}`)).size === 4 && quad.every((p) => p.x === x || p.x === x + 1) && quad.every((p) => p.z === z || p.z === z + 1);
    if (onCell && flat && quad.every((p) => (p.flags & LIGHT_FLAG_LIQUID) !== 0)) return quad;
  }
  throw new Error(`no top face at ${x},${y},${z}`);
}

const cornerAt = (quad: Vert[], x: number, z: number): Vert => quad.find((p) => p.x === x && p.z === z) as Vert;

describe('meshing flowing water (spec 18.4)', () => {
  it('draws flowing water lower by level, with corners averaged so the surface slopes', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, 0, 39, 0, 10, 39, 10, STONE);
    // A source and a stream running east: levels 1, 2, 3.
    put(chunks, 4, 40, 5, WATER_SOURCE);
    put(chunks, 5, 40, 5, flowingWater(1));
    put(chunks, 6, 40, 5, flowingWater(2));
    put(chunks, 7, 40, 5, flowingWater(3));
    const m = mesh(chunks);
    const h = (l: number): number => (8 - l) / 9;
    const stream = topFace(m.translucent, 6, 40, 5);
    // West corners average levels 1 and 2, east corners levels 2 and 3 (each corner has two water cells around it).
    expect(cornerAt(stream, 6, 5).y).toBeCloseTo(40 + (h(1) + h(2)) / 2);
    expect(cornerAt(stream, 7, 6).y).toBeCloseTo(40 + (h(2) + h(3)) / 2);
    const source = topFace(m.translucent, 4, 40, 5);
    expect(cornerAt(source, 4, 5).y).toBeCloseTo(40 + LIQUID_SURFACE);
    expect(cornerAt(source, 5, 5).y).toBeCloseTo(40 + (LIQUID_SURFACE + h(1)) / 2);
    // The tip of the stream stands at its own level.
    expect(cornerAt(topFace(m.translucent, 7, 40, 5), 8, 6).y).toBeCloseTo(40 + (h(3) + h(3)) / 2);
  });

  it('marks moving surfaces and points their texture along the flow', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, 0, 39, 0, 10, 39, 10, STONE);
    put(chunks, 4, 40, 5, WATER_SOURCE);
    put(chunks, 5, 40, 5, flowingWater(1));
    put(chunks, 6, 40, 5, flowingWater(2));
    const m = mesh(chunks);
    const stream = topFace(m.translucent, 5, 40, 5);
    expect(stream.every((p) => (p.flags & LIGHT_FLAG_SWAY) !== 0)).toBe(true);
    // v grows along the flow (east, +x), u across it.
    expect(cornerAt(stream, 6, 5).v - cornerAt(stream, 5, 5).v).toBeCloseTo(1);
    expect(cornerAt(stream, 5, 6).v - cornerAt(stream, 5, 5).v).toBeCloseTo(0);
    expect(Math.abs(cornerAt(stream, 5, 6).u - cornerAt(stream, 5, 5).u)).toBeCloseTo(1);
    // A lake of sources is still: no flowing flag.
    const lake = emptyNeighborhood();
    fill(lake, 0, 39, 0, 10, 39, 10, STONE);
    fill(lake, 2, 40, 2, 6, 40, 6, WATER_SOURCE);
    const lm = mesh(lake);
    expect(verts(lm.translucent).every((p) => (p.flags & LIGHT_FLAG_SWAY) === 0)).toBe(true);
  });

  it('draws a falling column at full height with its sides running down', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, 0, 39, 0, 10, 39, 10, STONE);
    put(chunks, 5, 45, 5, WATER_SOURCE);
    for (let y = 40; y < 45; y++) put(chunks, 5, y, 5, WATER_FALLING);
    put(chunks, 6, 40, 5, flowingWater(1));
    const m = mesh(chunks);
    const vs = verts(m.translucent);
    // The column's sides reach the top of each cell below the source, flagged as moving, v pointing down.
    const side = vs.filter((p) => p.x === 5 && p.y > 41 && p.y <= 45 && (p.flags & LIGHT_FLAG_SWAY) !== 0);
    expect(side.length).toBeGreaterThan(0);
    const vs2 = new Set(side.map((p) => Math.round(p.v * 1000) / 1000));
    expect([...vs2].sort()).toEqual([-FALL_STRETCH, 0].sort());
    // Where the column meets the pool at its foot the pool's corner rises to the full height of the column.
    const foot = topFace(m.translucent, 6, 40, 5);
    expect(cornerAt(foot, 6, 5).y).toBeCloseTo(41);
    expect(cornerAt(foot, 7, 5).y).toBeCloseTo(40 + 7 / 9);
  });
});
