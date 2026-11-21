import { describe, expect, it } from 'vitest';
import { PIPE_CORE_MAX, PIPE_CORE_MIN } from '../core/constants';
import { BLOCKS, blockId, pipeJoins, textureLayer } from '../core/registry';
import { Facing, makeVoxel, type MeshBatch } from '../core/types';
import { PIPE_FAMILY, PIPE_JOINS } from './blockTables';
import { PIPE_COLLAR_DEPTH, PIPE_COLLAR_MAX, PIPE_COLLAR_MIN } from './meshPipe';
import { meshChunk } from './mesher';
import { emptyNeighborhood, put } from './testUtil';

const ITEM = blockId('item_pipe');
const FAST = blockId('fast_item_pipe');
const FLUID = blockId('fluid_pipe');
const HOT = blockId('hot_fluid_pipe');
const quads = (b: MeshBatch): number => b.indices.length / 6;
const mesh = (chunks: Uint16Array[]) => meshChunk({ cx: 0, cz: 0, chunks });
const coords = (b: MeshBatch, axis: number): number[] => [...b.positions.filter((_, i) => i % 3 === axis)];

describe('pipe shape', () => {
  it('joins exactly what registry.pipeJoins joins', () => {
    for (const pipe of BLOCKS.filter((b) => b.pipe)) {
      for (const other of BLOCKS) {
        expect((PIPE_JOINS[other.id] & PIPE_FAMILY[pipe.id]) !== 0, `${pipe.key} -> ${other.key}`).toBe(pipeJoins(pipe, other));
      }
    }
  });

  it('draws a lone pipe as the core: see-through item pipes in the blended batch, fluid pipes opaque', () => {
    for (const [id, batch] of [[ITEM, 'translucent'], [FAST, 'translucent'], [FLUID, 'opaque'], [HOT, 'opaque']] as const) {
      const chunks = emptyNeighborhood();
      put(chunks, 5, 40, 5, id);
      const m = mesh(chunks);
      expect(quads(m[batch])).toBe(6);
      expect(quads(m.opaque) + quads(m.cutout) + quads(m.translucent)).toBe(6);
      for (const axis of [0, 1, 2]) {
        const base = axis === 1 ? 40 : 5;
        expect(Math.min(...coords(m[batch], axis))).toBeCloseTo(base + PIPE_CORE_MIN);
        expect(Math.max(...coords(m[batch], axis))).toBeCloseTo(base + PIPE_CORE_MAX);
      }
      expect(m[batch].layers.every((l) => l === BLOCKS[id].layers[0])).toBe(true);
    }
  });

  it('joins pipes of one family only: item to item, fluid to fluid, never across', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, ITEM);
    put(chunks, 6, 40, 5, FAST);
    put(chunks, 4, 40, 5, FLUID);
    put(chunks, 4, 41, 5, HOT);
    const m = mesh(chunks);
    // Item pipes: each a core of 5 faces and one arm of 4 sides.
    expect(quads(m.translucent)).toBe(9 + 9);
    // Fluid pipes: each a core of 5 faces and one arm of 4 sides (up/down), no arm to the item pipe.
    expect(quads(m.opaque)).toBe(9 + 9);
    const ys = coords(m.opaque, 1);
    expect(Math.min(...ys)).toBeCloseTo(40 + PIPE_CORE_MIN);
    expect(Math.max(...ys)).toBeCloseTo(41 + PIPE_CORE_MAX);
    // The item run spans x 5 + 4/16 .. 6 + 12/16 without a gap; the fluid pipe never reaches into x 5.
    const xs = coords(m.translucent, 0);
    expect(Math.min(...xs)).toBeCloseTo(5 + PIPE_CORE_MIN);
    expect(Math.max(...xs)).toBeCloseTo(6 + PIPE_CORE_MAX);
    expect(Math.max(...coords(m.opaque, 0))).toBeCloseTo(4 + PIPE_CORE_MAX);
  });

  it('meets an endpoint of its family with an arm and a wider collar, and ignores the other family', () => {
    // A crate takes items; a tank holds fluids.
    const crate = blockId('crate');
    const tank = blockId('tank');
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, ITEM);
    put(chunks, 6, 40, 5, crate);
    put(chunks, 5, 40, 4, tank);
    const m = mesh(chunks).translucent;
    // Core 5 faces + arm 4 sides + collar 5 faces (the one against the crate is hidden). No arm to the tank.
    expect(quads(m)).toBe(14);
    const ys = coords(m, 1);
    expect(Math.min(...ys)).toBeCloseTo(40 + PIPE_COLLAR_MIN);
    expect(Math.max(...ys)).toBeCloseTo(40 + PIPE_COLLAR_MAX);
    expect(Math.max(...coords(m, 0))).toBeCloseTo(6);
    expect(Math.min(...coords(m, 2))).toBeCloseTo(5 + PIPE_COLLAR_MIN);
    // Collar vertices sit only in the last 2/16 before the crate.
    for (let v = 0; v < m.layers.length; v++) {
      const y = m.positions[v * 3 + 1] - 40;
      if (y < PIPE_CORE_MIN - 1e-6) expect(m.positions[v * 3]).toBeGreaterThanOrEqual(6 - PIPE_COLLAR_DEPTH - 1e-6);
    }

    const fluid = emptyNeighborhood();
    put(fluid, 5, 40, 5, FLUID);
    put(fluid, 6, 40, 5, crate);
    put(fluid, 5, 40, 4, tank);
    put(fluid, 5, 39, 5, makeVoxel(blockId('pump'), Facing.East));
    const f = mesh(fluid).opaque;
    // Core 4 + 2 arms x 4 + 2 collars x 5 = 22, plus the crate, tank and pump cubes (6 + 6 + 6, minus the faces
    // the pipe would hide - none: a pipe hides nothing).
    expect(quads(f)).toBe(22 + 18);
  });

  it('samples the arm band of the plus tile everywhere, collars included', () => {
    const chunks = emptyNeighborhood();
    put(chunks, 5, 40, 5, FLUID);
    put(chunks, 5, 41, 5, blockId('tank'));
    const m = mesh(chunks).opaque;
    const tile = textureLayer('pipe_fluid');
    for (let q = 0; q < m.layers.length; q += 4) {
      if (m.layers[q] !== tile) continue;
      // Every pipe quad's uv rectangle stays inside the plus: its u or its v range lies within the band.
      const us = [0, 1, 2, 3].map((k) => m.uvs[(q + k) * 2]);
      const vs = [0, 1, 2, 3].map((k) => m.uvs[(q + k) * 2 + 1]);
      const inBand = (r: number[]): boolean => Math.min(...r) >= PIPE_CORE_MIN - 1e-6 && Math.max(...r) <= PIPE_CORE_MAX + 1e-6;
      expect(inBand(us) || inBand(vs), `quad ${q / 4}`).toBe(true);
    }
  });
});
