import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { LIGHT_FLAG_EMISSIVE, type MeshBatch } from '../core/types';
import { computeLight, LIGHT_VOLUME, lightIndex } from './lighting';
import { LIGHT_COOL_MAX, LIGHT_COOL_SHIFT, LIGHT_FLAG_VIOLET, meshChunk } from './mesher';
import { emptyNeighborhood, fill, put } from './testUtil';

const STONE = blockId('stone');

/** A sealed 9x5x9 stone cave (interior x, z 2..10, y 40..44): no sky light at all. */
function cave(): Uint16Array[] {
  const chunks = emptyNeighborhood();
  fill(chunks, 1, 39, 1, 11, 45, 11, STONE);
  fill(chunks, 2, 40, 2, 10, 44, 10, 0);
  return chunks;
}

/** Cool share (0..15) and violet bit of the floor-top vertices at x, z (the face of the stone at y 39). */
function floorFlags(b: MeshBatch, x: number, z: number): number[] {
  const out: number[] = [];
  for (let v = 0; v < b.layers.length; v++) {
    if (b.positions[v * 3] === x && b.positions[v * 3 + 1] === 40 && b.positions[v * 3 + 2] === z) out.push(b.light[v * 4 + 3]);
  }
  return out;
}
const share = (flags: number): number => flags >> LIGHT_COOL_SHIFT;

describe('cool light', () => {
  it('carries the colour of the emitter that lights each cell most', () => {
    const chunks = cave();
    put(chunks, 3, 40, 3, blockId('glowcap'));
    put(chunks, 10, 40, 10, blockId('torch'));
    const hue = new Uint8Array(LIGHT_VOLUME);
    const light = computeLight(chunks, hue);
    expect(hue[lightIndex(3, 40, 3)]).toBe(1);
    expect(hue[lightIndex(5, 41, 4)]).toBe(1);
    expect(hue[lightIndex(10, 40, 10)]).toBe(0);
    expect(light[lightIndex(10, 40, 10)] & 15).toBe(13);
    // Where the torch is brighter than the glowcap, the light is warm again.
    expect(light[lightIndex(8, 41, 8)] & 15).toBeGreaterThan(0);
    expect(hue[lightIndex(8, 41, 8)]).toBe(0);
  });

  it('tints the floor around a glowcap cyan and around a crystal cluster violet, never around a torch', () => {
    for (const [key, violet] of [['glowcap', false], ['crystal_cluster', true]] as const) {
      const chunks = cave();
      put(chunks, 4, 40, 4, blockId(key));
      const m = meshChunk({ cx: 0, cz: 0, chunks });
      const near = floorFlags(m.opaque, 5, 5);
      expect(near.length).toBeGreaterThan(0);
      for (const f of near) {
        expect(share(f), key).toBe(LIGHT_COOL_MAX);
        expect((f & LIGHT_FLAG_VIOLET) !== 0, key).toBe(violet);
      }
      // The plant itself glows full-bright.
      expect(m.cutout.light.filter((_, i) => i % 4 === 3).every((f) => (f & LIGHT_FLAG_EMISSIVE) !== 0)).toBe(true);
    }
    const torch = cave();
    put(torch, 4, 40, 4, blockId('torch'));
    const flags = floorFlags(meshChunk({ cx: 0, cz: 0, chunks: torch }).opaque, 5, 5);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((f) => share(f) === 0)).toBe(true);
  });

  it('blends where warm and cool light meet', () => {
    const chunks = cave();
    put(chunks, 2, 40, 2, blockId('glowcap'));
    put(chunks, 10, 40, 10, blockId('torch'));
    const m = meshChunk({ cx: 0, cz: 0, chunks });
    const shares = new Set<number>();
    for (let x = 2; x <= 11; x++) for (const f of floorFlags(m.opaque, x, x)) shares.add(share(f));
    expect(shares.has(0)).toBe(true);
    expect(shares.has(LIGHT_COOL_MAX)).toBe(true);
    expect([...shares].some((s) => s > 0 && s < LIGHT_COOL_MAX)).toBe(true);
  });

  it('treats light passed without its colour as firelight', () => {
    const chunks = cave();
    put(chunks, 4, 40, 4, blockId('glowcap'));
    const m = meshChunk({ cx: 0, cz: 0, chunks, light: computeLight(chunks) });
    expect(floorFlags(m.opaque, 5, 5).every((f) => share(f) === 0)).toBe(true);
  });
});
