import { describe, expect, it } from 'vitest';
import { TEXTURE_NAMES } from '../core/registry';
import { ATLAS_GLSL, atlasDefines, atlasSplit, buildAtlasData, createAtlas, GUARANTEED_LAYERS } from './atlas';
import { paintTile, TILE_BYTES, TILE_SIZE } from './tiles';

describe('texture atlas', () => {
  it('has one 16x16 RGBA layer per texture name, in registry order', () => {
    const data = buildAtlasData(TEXTURE_NAMES, paintTile);
    expect(TILE_BYTES).toBe(16 * 16 * 4);
    expect(data.length).toBe(TEXTURE_NAMES.length * TILE_BYTES);
    for (const layer of [0, 1, Math.floor(TEXTURE_NAMES.length / 2), TEXTURE_NAMES.length - 1]) {
      const tile = paintTile(TEXTURE_NAMES[layer]);
      for (let i = 0; i < TILE_BYTES; i += 4) {
        expect(data[layer * TILE_BYTES + i + 3]).toBe(tile[i + 3]);
        if (tile[i + 3] > 0) {
          expect(data[layer * TILE_BYTES + i]).toBe(tile[i]);
          expect(data[layer * TILE_BYTES + i + 1]).toBe(tile[i + 1]);
          expect(data[layer * TILE_BYTES + i + 2]).toBe(tile[i + 2]);
        }
      }
    }
  });

  it('places each layer where its name sits in the list', () => {
    const names = ['a', 'b', 'c'];
    const paint = (name: string): Uint8ClampedArray => new Uint8ClampedArray(TILE_BYTES).fill(name.charCodeAt(0));
    const data = buildAtlasData(names, paint);
    expect(data[0]).toBe(97);
    expect(data[TILE_BYTES]).toBe(98);
    expect(data[2 * TILE_BYTES + TILE_BYTES - 1]).toBe(99);
  });

  it('bleeds the mean colour under invisible texels and keeps them invisible', () => {
    const paint = (): Uint8ClampedArray => {
      const t = new Uint8ClampedArray(TILE_BYTES);
      t.set([200, 100, 50, 255], 0);
      t.set([100, 100, 150, 255], 4);
      return t;
    };
    const data = buildAtlasData(['x'], paint);
    expect([data[8], data[9], data[10], data[11]]).toEqual([150, 100, 100, 0]);
    expect([data[0], data[1], data[2], data[3]]).toEqual([200, 100, 50, 255]);
  });

  it('rejects a painter that returns the wrong size', () => {
    expect(() => buildAtlasData(['x'], () => new Uint8ClampedArray(12))).toThrow(/expected 1024/);
  });

  it('builds an array texture matching the registry', () => {
    const atlas = createAtlas();
    expect(atlas.layers).toBe(TEXTURE_NAMES.length);
    expect(atlas.texture.image.width).toBe(TILE_SIZE);
    expect(atlas.texture.image.height).toBe(TILE_SIZE);
    expect(atlas.texture.image.depth).toBe(TEXTURE_NAMES.length);
    expect(atlas.texture.isDataArrayTexture).toBe(true);
  });

  it('holds every layer in one array texture when the device allows it', () => {
    const atlas = createAtlas(2048);
    expect(atlas.texture2).toBeNull();
    expect(atlas.split).toBe(TEXTURE_NAMES.length);
    expect(atlasDefines(atlas)).toEqual({});
  });

  it('splits into two array textures past the device limit, layer for layer', () => {
    expect(atlasSplit(252, 256)).toBe(252);
    expect(atlasSplit(300, 256)).toBe(256);
    expect(atlasSplit(512, 256)).toBe(256);
    expect(() => atlasSplit(513, 256)).toThrow(/needs 513 layers/);
    // The real atlas on a device that holds fewer layers than it has (and beyond WebGL2's guaranteed 256).
    const max = Math.floor(TEXTURE_NAMES.length / 2) + 3;
    const atlas = createAtlas(max);
    expect(atlas.split).toBe(max);
    expect(atlas.texture.image.depth).toBe(max);
    expect(atlas.texture2?.image.depth).toBe(TEXTURE_NAMES.length - max);
    expect(atlasDefines(atlas)).toEqual({ ATLAS_SPLIT: 1 });
    const page1 = atlas.texture.image.data as Uint8Array;
    const page2 = atlas.texture2?.image.data as Uint8Array;
    expect(page1.length).toBe(max * TILE_BYTES);
    expect(page2.length).toBe((TEXTURE_NAMES.length - max) * TILE_BYTES);
    for (const layer of [0, max - 1, max, TEXTURE_NAMES.length - 1]) {
      const page = layer < max ? page1 : page2;
      const at = (layer < max ? layer : layer - max) * TILE_BYTES;
      expect(Array.from(page.subarray(at, at + TILE_BYTES))).toEqual(Array.from(atlas.data.subarray(layer * TILE_BYTES, (layer + 1) * TILE_BYTES)));
    }
    // Room to grow: 456 tiles on a device with only WebGL2's guaranteed 256 layers per array.
    expect(atlasSplit(GUARANTEED_LAYERS + 200, GUARANTEED_LAYERS)).toBe(GUARANTEED_LAYERS);
  });

  it('samples the second page relative to the split, only when compiled split', () => {
    expect(ATLAS_GLSL).toContain('#ifdef ATLAS_SPLIT');
    expect(ATLAS_GLSL).toMatch(/layer - uAtlasSplit/);
    expect(ATLAS_GLSL).toMatch(/textureGrad\(uAtlas2/);
  });
});
