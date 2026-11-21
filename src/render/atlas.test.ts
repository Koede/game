import { describe, expect, it } from 'vitest';
import { TEXTURE_NAMES } from '../core/registry';
import { buildAtlasData, createAtlas } from './atlas';
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
});
