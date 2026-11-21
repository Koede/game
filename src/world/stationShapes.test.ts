import { describe, expect, it } from 'vitest';
import { blockOrNull } from '../core/registry';
import { Facing, makeVoxel } from '../core/types';
import { meshChunk } from './mesher';
import { STATION_BOXES, stationBounds, stationIndex, turnBox } from './stationShapes';
import { emptyNeighborhood, put } from './testUtil';

describe('station shapes', () => {
  it('keeps every box inside the cell and non-empty', () => {
    for (const [key, boxes] of Object.entries(STATION_BOXES)) {
      for (const b of boxes) {
        for (let i = 0; i < 3; i++) {
          expect(b[i], key).toBeGreaterThanOrEqual(0);
          expect(b[i + 3], key).toBeLessThanOrEqual(16);
          expect(b[i + 3], key).toBeGreaterThan(b[i]);
        }
      }
    }
  });

  it('turns a box so that North is the identity and East sends the front (-Z) to +X', () => {
    const out = [0, 0, 0, 0, 0, 0];
    turnBox([2, 0, 0, 6, 8, 4], Facing.North, out);
    expect(out).toEqual([2, 0, 0, 6, 8, 4]);
    turnBox([2, 0, 0, 6, 8, 4], Facing.East, out);
    expect(out).toEqual([12, 0, 2, 16, 8, 6]);
    turnBox([2, 0, 0, 6, 8, 4], Facing.South, out);
    expect(out).toEqual([10, 0, 12, 14, 8, 16]);
    turnBox([2, 0, 0, 6, 8, 4], Facing.West, out);
    expect(out).toEqual([0, 0, 10, 4, 8, 14]);
  });

  it('reports the bounds of the shape for the target outline', () => {
    expect(stationBounds('stone_anvil')).toEqual([0, 0, 4 / 16, 1, 12 / 16, 12 / 16]);
    expect(stationBounds('stone')).toBeNull();
    expect(stationIndex('chopping_block')).toBeGreaterThan(0);
    expect(stationIndex('stone')).toBe(0);
  });

  const quern = blockOrNull('hand_quern');
  it.runIf(quern !== null && quern.shape === 'cube')('meshes a station as boxes and hides nothing behind it', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, makeVoxel(quern!.id));
    const m = meshChunk({ cx: 0, cz: 0, chunks });
    const quads = (m.opaque.indices.length + m.cutout.indices.length + m.translucent.indices.length) / 6;
    expect(quads).toBe(STATION_BOXES.hand_quern.length * 6);
    const ys = [...m.opaque.positions].filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(40 + 7 / 16);
  });
});
