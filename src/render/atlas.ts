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

/** WebGL2 guarantees at least this many layers in one array texture (MAX_ARRAY_TEXTURE_LAYERS). */
export const GUARANTEED_LAYERS = 256;
/** At most this many array textures (pages) are bound for the atlas; ATLAS_GLSL samples two. */
export const MAX_ATLAS_PAGES = 2;

/**
 * How `layers` tiles are split over array textures of at most `maxLayers` layers each: the layer index where
 * the second page starts (= layers when one page holds everything). Throws when even two pages are too few.
 */
export function atlasSplit(layers: number, maxLayers: number): number {
  const max = Math.max(1, Math.floor(maxLayers));
  if (layers <= max) return layers;
  if (layers > max * MAX_ATLAS_PAGES) {
    throw new Error(`the texture atlas needs ${layers} layers but this device holds ${max} per array texture (${max * MAX_ATLAS_PAGES} in all)`);
  }
  return max;
}

export interface Atlas {
  /** The first page: layers 0 .. split-1. */
  texture: THREE.DataArrayTexture;
  /** The second page (layers split .. layers-1), or null when one array texture holds every layer. */
  texture2: THREE.DataArrayTexture | null;
  /** First layer of the second page (= layers when there is none). */
  split: number;
  /** The pixels behind the texture (layer i at i * TILE_BYTES). Read-only. */
  data: Uint8Array;
  layers: number;
}

function arrayTexture(data: Uint8Array, depth: number): THREE.DataArrayTexture {
  const texture = new THREE.DataArrayTexture(data, TILE_SIZE, TILE_SIZE, depth);
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
  return texture;
}

/**
 * Paints every registered texture and uploads it as a sampler2DArray: crisp up close, mip-mapped far away.
 * `maxLayers` is the device's MAX_ARRAY_TEXTURE_LAYERS: past it the tiles go into a second array texture,
 * which every atlas shader samples through ATLAS_GLSL (compiled with ATLAS_SPLIT, see atlasDefines).
 */
export function createAtlas(maxLayers = Infinity): Atlas {
  const layers = TEXTURE_NAMES.length;
  const data = buildAtlasData(TEXTURE_NAMES, paintTile);
  const split = atlasSplit(layers, maxLayers);
  const texture = arrayTexture(split < layers ? data.subarray(0, split * TILE_BYTES) : data, split);
  const texture2 = split < layers ? arrayTexture(data.subarray(split * TILE_BYTES), layers - split) : null;
  return { texture, texture2, split, data, layers };
}

/** Shader defines for a material that samples the atlas through ATLAS_GLSL. */
export const atlasDefines = (atlas: Pick<Atlas, 'texture2'>): Record<string, number> => (atlas.texture2 ? { ATLAS_SPLIT: 1 } : {});

/** Uniforms ATLAS_GLSL reads (share the objects between materials). */
export interface AtlasUniforms {
  [name: string]: THREE.IUniform;
  uAtlas: THREE.IUniform<THREE.Texture | null>;
  uAtlas2: THREE.IUniform<THREE.Texture | null>;
  uAtlasSplit: THREE.IUniform<number>;
}
export const atlasUniforms = (atlas: Atlas): AtlasUniforms => ({
  uAtlas: { value: atlas.texture },
  uAtlas2: { value: atlas.texture2 },
  uAtlasSplit: { value: atlas.split },
});

/**
 * GLSL ES 3.00: `atlasTexel(uv, layer)` samples the tile of a registry layer. With one page it is a plain
 * texture() call; split over two pages (ATLAS_SPLIT defined) it picks the page per primitive and samples with
 * gradients taken outside the branch, so mip selection stays well defined.
 */
export const ATLAS_GLSL = /* glsl */ `
precision mediump sampler2DArray;
uniform sampler2DArray uAtlas;
#ifdef ATLAS_SPLIT
uniform sampler2DArray uAtlas2;
uniform float uAtlasSplit;
vec4 atlasTexelGrad(vec2 uv, float layer, vec2 dx, vec2 dy) {
  if (layer < uAtlasSplit) return textureGrad(uAtlas, vec3(uv, layer), dx, dy);
  return textureGrad(uAtlas2, vec3(uv, layer - uAtlasSplit), dx, dy);
}
vec4 atlasTexel(vec2 uv, float layer) {
  return atlasTexelGrad(uv, layer, dFdx(uv), dFdy(uv));
}
#else
vec4 atlasTexel(vec2 uv, float layer) {
  return texture(uAtlas, vec3(uv, layer));
}
// For coordinates that jump (a tile turned per block): the mip level comes from the smooth coordinate's gradients.
vec4 atlasTexelGrad(vec2 uv, float layer, vec2 dx, vec2 dy) {
  return textureGrad(uAtlas, vec3(uv, layer), dx, dy);
}
#endif
`;
