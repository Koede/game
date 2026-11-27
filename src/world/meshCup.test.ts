import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { makeVoxel, type MeshBatch } from '../core/types';
import { BUCKET_BOILING, BUCKET_COLD, BUCKET_KETTLE, BUCKET_KIND, CUP_STAGE, SHAPE, SHAPE_BUCKET, SHAPE_CUP } from './blockTables';
import { CUP_CONE_TOP, CUP_FLOOR_Y, CUP_MAX, CUP_MIN, CUP_RIM_Y, CUP_SPOUT_Y } from './meshCup';
import { meshChunk } from './mesher';
import { emptyNeighborhood, put } from './testUtil';

const quads = (b: MeshBatch): number => b.indices.length / 6;
const coords = (b: MeshBatch, axis: number): number[] => [...b.positions.filter((_, i) => i % 3 === axis)];

function one(key: string, active = false) {
  const chunks = emptyNeighborhood();
  put(chunks, 5, 40, 5, makeVoxel(blockId(key), 0, active));
  const m = meshChunk({ cx: 0, cz: 0, chunks });
  expect(quads(m.opaque) + quads(m.translucent)).toBe(0);
  return m.cutout;
}
const extent = (b: MeshBatch, axis: number, base: number): [number, number] => [Math.min(...coords(b, axis)) - base, Math.max(...coords(b, axis)) - base];

describe('cup shape', () => {
  it('is registered as the cup and bucket shapes', () => {
    expect(SHAPE[blockId('clay_cup')]).toBe(SHAPE_CUP);
    expect(SHAPE[blockId('cup_full')]).toBe(SHAPE_CUP);
    expect(SHAPE[blockId('furnace_bucket')]).toBe(SHAPE_BUCKET);
    expect(SHAPE[blockId('kettle_pot')]).toBe(SHAPE_BUCKET);
    expect(CUP_STAGE[blockId('clay_cup')]).toBe(1);
    expect(CUP_STAGE[blockId('cup_full')]).toBe(5);
  });

  it('a bare cup is a small hollow cup: 6/16 wide, 5/16 tall, a floor and four walls, resting on the floor of its cell', () => {
    const m = one('clay_cup');
    expect(quads(m)).toBe(5 + 4 * 6);
    // The inside floor is open to the sky: a top face at 1/16 inside the walls.
    const inner = coords(m, 1).filter((y) => Math.abs(y - 40 - CUP_FLOOR_Y) < 1e-4);
    expect(inner.length).toBeGreaterThan(0);
    expect(extent(m, 0, 5)).toEqual([CUP_MIN, CUP_MAX].map((v) => expect.closeTo(v, 5)));
    expect(extent(m, 2, 5)).toEqual([CUP_MIN, CUP_MAX].map((v) => expect.closeTo(v, 5)));
    const [lo, hi] = extent(m, 1, 40);
    expect(lo).toBeCloseTo(0);
    expect(hi).toBeCloseTo(CUP_RIM_Y);
  });

  it('every cone state adds a stepped inverted cone that wraps up to 10/16, wider at the top', () => {
    for (const key of ['cup_cone', 'cup_cone_loaded', 'cup_brewing', 'cup_full']) {
      const m = one(key);
      expect(quads(m), key).toBeGreaterThan(5);
      expect(extent(m, 1, 40)[1], key).toBeCloseTo(CUP_CONE_TOP);
      const rim = coords(m, 1).map((y, i) => [y, coords(m, 0)[i]]).filter(([y]) => Math.abs(y - 40 - CUP_CONE_TOP) < 1e-4).map(([, x]) => x - 5);
      expect(Math.min(...rim), key).toBeCloseTo(4 / 16);
      expect(Math.max(...rim), key).toBeCloseTo(12 / 16);
    }
    expect(quads(one('cup_cone'))).toBe(quads(one('cup_brewing')));
    // The spout stops a pixel above the rim, so the drip falling into the cup shows.
    const ys = coords(one('cup_brewing'), 1).map((y) => y - 40);
    expect(ys.some((y) => Math.abs(y - CUP_SPOUT_Y) < 1e-4)).toBe(true);
    expect(CUP_SPOUT_Y).toBeGreaterThan(CUP_RIM_Y);
  });

  it('keeps the whole thing inside its cell', () => {
    for (const key of ['clay_cup', 'cup_full', 'furnace_bucket', 'furnace_bucket_boiling', 'kettle_pot']) {
      const m = one(key);
      for (const axis of [0, 1, 2]) {
        const [lo, hi] = extent(m, axis, axis === 1 ? 40 : 5);
        expect(lo, key).toBeGreaterThanOrEqual(0);
        expect(hi, key).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('bucket shape', () => {
  it('knows which block is cold, boiling and the kettle', () => {
    expect(BUCKET_KIND[blockId('furnace_bucket')]).toBe(BUCKET_COLD);
    expect(BUCKET_KIND[blockId('furnace_bucket_boiling')]).toBe(BUCKET_BOILING);
    expect(BUCKET_KIND[blockId('kettle_pot')]).toBe(BUCKET_KETTLE);
  });

  it('is a 10/16 wide, 8/16 tall box with a rim and a water top', () => {
    const m = one('furnace_bucket');
    const [x0, x1] = extent(m, 0, 5);
    expect(x0).toBeCloseTo(3 / 16);
    expect(x1).toBeCloseTo(13 / 16);
    expect(extent(m, 1, 40)[1]).toBeCloseTo(8 / 16);
    // body (4 sides) + four rim walls of 5 faces + the water quad
    expect(quads(m)).toBeGreaterThan(20);
  });

  it('only a boiling bucket shimmers: its water top carries the liquid flag', () => {
    const shimmering = (b: MeshBatch): number => b.light.filter((_, i) => i % 4 === 3 && (b.light[i] & 4) !== 0).length;
    expect(shimmering(one('furnace_bucket'))).toBe(0);
    expect(shimmering(one('furnace_bucket_boiling'))).toBe(4);
  });

  it('the kettle is a lidded pot whose knob shimmers and whose lid sits pushed aside only while it boils', () => {
    const cold = one('kettle_pot');
    const hot = one('kettle_pot', true);
    expect(quads(cold)).toBe(quads(hot));
    const lidX = (b: MeshBatch): number => Math.max(...coords(b, 0).filter((_, i) => coords(b, 1)[i] - 40 > 8.5 / 16)) - 5;
    expect(lidX(cold)).toBeCloseTo(11 / 16);
    expect(lidX(hot)).toBeCloseTo(13 / 16);
    expect(extent(cold, 1, 40)[1]).toBeCloseTo(10 / 16);
    const flagged = (b: MeshBatch): number => b.light.filter((_, i) => i % 4 === 3 && (b.light[i] & 4) !== 0).length;
    expect(flagged(cold)).toBe(0);
    expect(flagged(hot)).toBeGreaterThan(0);
  });
});
