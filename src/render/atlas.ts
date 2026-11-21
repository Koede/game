/**
 * The block/item texture atlas: one 16x16 layer per TEXTURE_NAMES entry, in registry order, so a mesh's
 * `layer` attribute indexes it directly.
 */
import * as THREE from 'three';
import { TEXTURE_NAMES } from '../core/registry';
import { paintTile, TILE_BYTES, TILE_SIZE } from './tiles';

/**
 * Packs one tile per name into a single RGBA buffer (layer i = names[i], rows top first, as painted).
 * Invisible texels get the tile's mean colour (alpha stays 0): mipmaps average neighbours, and black
 * under transparent pixels would darken the rim of every plant and icon at a distance.
 */
export function buildAtlasData(names: readonly string[], paint: (name: string) => Uint8ClampedArray): Uint8Array {
  const data = new Uint8Array(names.length * TILE_BYTES);
  for (let layer = 0; layer < names.length; layer++) {
    const tile = paint(names[layer]);
    if (tile.length !== TILE_BYTES) throw new Error(`texture "${names[layer]}" is ${tile.length} bytes, expected ${TILE_BYTES}`);
    const base = layer * TILE_BYTES;
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;
    for (let i = 0; i < TILE_BYTES; i += 4) {
      const a = tile[i + 3];
      r += tile[i] * a;
      g += tile[i + 1] * a;
      b += tile[i + 2] * a;
      weight += a;
    }
    if (weight > 0) {
      r /= weight;
      g /= weight;
      b /= weight;
    }
    for (let i = 0; i < TILE_BYTES; i += 4) {
      const visible = tile[i + 3] > 0;
      data[base + i] = visible ? tile[i] : r;
      data[base + i + 1] = visible ? tile[i + 1] : g;
      data[base + i + 2] = visible ? tile[i + 2] : b;
      data[base + i + 3] = tile[i + 3];
    }
  }
  return data;
}

export interface Atlas {
  texture: THREE.DataArrayTexture;
  /** The pixels behind the texture (layer i at i * TILE_BYTES). Read-only. */
  data: Uint8Array;
  layers: number;
}

/** Paints every registered texture and uploads it as a sampler2DArray: crisp up close, mip-mapped far away. */
export function createAtlas(): Atlas {
  const data = buildAtlasData(TEXTURE_NAMES, paintTile);
  const texture = new THREE.DataArrayTexture(data, TILE_SIZE, TILE_SIZE, TEXTURE_NAMES.length);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  // Painted colours go to the screen untouched: the whole pipeline works in display space.
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return { texture, data, layers: TEXTURE_NAMES.length };
}
