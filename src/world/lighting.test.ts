import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { AIR, makeVoxel } from '../core/types';
import { LIGHT_VOLUME, blockLightOf, computeLight, lightIndex, skyLightOf } from './lighting';
import { emptyNeighborhood, fill, put } from './testUtil';

const STONE = blockId('stone');
const TORCH = blockId('torch');
const WATER = blockId('water');

describe('computeLight', () => {
  it('gives full sky light under the open sky and none below ground', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 10, 31, STONE);
    const light = computeLight(chunks);
    expect(light.length).toBe(LIGHT_VOLUME);
    expect(skyLightOf(light[lightIndex(8, 11, 8)])).toBe(15);
    expect(skyLightOf(light[lightIndex(-1, 95, 16)])).toBe(15);
    expect(skyLightOf(light[lightIndex(8, 96, 8)])).toBe(15);
    expect(light[lightIndex(8, 10, 8)]).toBe(0);
    expect(light[lightIndex(8, -1, 8)]).toBe(0);
  });

  it('keeps a sealed cave dark and lets daylight fade into an open one', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 40, 31, STONE);
    fill(chunks, 2, 20, 8, 12, 20, 8, AIR);
    expect(computeLight(chunks)[lightIndex(8, 20, 8)]).toBe(0);
    // A shaft down to the west end of the tunnel.
    fill(chunks, 2, 21, 8, 2, 40, 8, AIR);
    const light = computeLight(chunks);
    expect(skyLightOf(light[lightIndex(2, 20, 8)])).toBe(15);
    expect(skyLightOf(light[lightIndex(3, 20, 8)])).toBe(14);
    expect(skyLightOf(light[lightIndex(12, 20, 8)])).toBe(5);
  });

  it('spreads sky light sideways under an overhang', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 10, 31, STONE);
    fill(chunks, 0, 14, 0, 15, 14, 15, STONE);
    const light = computeLight(chunks);
    expect(skyLightOf(light[lightIndex(0, 12, 8)])).toBe(14);
    expect(skyLightOf(light[lightIndex(7, 12, 8)])).toBe(7);
    expect(skyLightOf(light[lightIndex(8, 12, 8)])).toBe(7);
  });

  it('dims daylight by 3 per block of water', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 10, 31, STONE);
    fill(chunks, -16, 11, -16, 31, 14, 31, WATER);
    const light = computeLight(chunks);
    expect([14, 13, 12, 11].map((y) => skyLightOf(light[lightIndex(8, y, 8)]))).toEqual([12, 9, 6, 3]);
  });

  it('lets torch light fall off by one per block, also across a chunk border', () => {
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 40, 31, STONE);
    fill(chunks, 4, 20, 8, 20, 20, 8, AIR);
    put(chunks, 17, 20, 8, TORCH);
    const light = computeLight(chunks);
    expect(blockLightOf(light[lightIndex(16, 20, 8)])).toBe(12);
    expect(blockLightOf(light[lightIndex(15, 20, 8)])).toBe(11);
    expect(blockLightOf(light[lightIndex(5, 20, 8)])).toBe(1);
    expect(blockLightOf(light[lightIndex(4, 20, 8)])).toBe(0);
    expect(skyLightOf(light[lightIndex(15, 20, 8)])).toBe(0);
  });

  it('uses the active light of a voxel', () => {
    const furnace = blockId('furnace_clay');
    const chunks = emptyNeighborhood();
    fill(chunks, -16, 0, -16, 31, 40, 31, STONE);
    fill(chunks, 4, 20, 8, 9, 20, 8, AIR);
    put(chunks, 10, 20, 8, makeVoxel(furnace));
    expect(blockLightOf(computeLight(chunks)[lightIndex(9, 20, 8)])).toBe(0);
    put(chunks, 10, 20, 8, makeVoxel(furnace, 0, true));
    expect(blockLightOf(computeLight(chunks)[lightIndex(9, 20, 8)])).toBe(10);
  });

  it('treats missing neighbours as open air', () => {
    const chunks: (Uint16Array | null)[] = emptyNeighborhood();
    fill(chunks as Uint16Array[], 0, 0, 0, 15, 30, 15, STONE);
    for (const n of [0, 1, 2, 3, 5, 6, 7, 8]) chunks[n] = null;
    const light = computeLight(chunks);
    expect(skyLightOf(light[lightIndex(16, 5, 8)])).toBe(15);
    expect(skyLightOf(light[lightIndex(8, 5, 8)])).toBe(0);
  });
});
