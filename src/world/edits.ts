/**
 * Every voxel the game ever changed, as sparse per-chunk maps, so edits survive their chunk being unloaded
 * and are laid over freshly generated terrain when it comes back. Saved compactly: per chunk, the base64
 * of little-endian uint16 pairs (voxel index, voxel), sorted by index.
 */
import { CHUNK_VOLUME, type Voxel } from '../core/types';
import { chunkKey, keyChunkX, keyChunkZ } from './chunk';

/** Saved edits: "cx,cz" -> base64 of (index, voxel) uint16 pairs. */
export type EditsSnapshot = Record<string, string>;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DECODE = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET.charCodeAt(i)] = i;

export function encodeBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/** Decodes base64; throws on characters outside the alphabet or a length that is not a multiple of 4. */
export function decodeBase64(text: string): Uint8Array {
  if (text.length % 4 !== 0) throw new Error('base64: length is not a multiple of 4');
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const c = text.charCodeAt(i + k);
      const d = c === 61 && i + k >= text.length - pad ? 0 : c < 128 ? DECODE[c] : -1;
      if (d < 0) throw new Error(`base64: bad character at ${i + k}`);
      n = (n << 6) | d;
    }
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export class EditLog {
  private readonly chunks = new Map<number, Map<number, Voxel>>();
  private total = 0;

  /** Number of edited voxels. */
  get count(): number {
    return this.total;
  }

  /** Number of chunks with at least one edit. */
  get chunkCount(): number {
    return this.chunks.size;
  }

  record(cx: number, cz: number, index: number, voxel: Voxel): void {
    const key = chunkKey(cx, cz);
    let map = this.chunks.get(key);
    if (!map) {
      map = new Map();
      this.chunks.set(key, map);
    }
    if (!map.has(index)) this.total++;
    map.set(index, voxel);
  }

  /** True when the voxel at `index` of chunk (cx, cz) was ever changed. */
  has(cx: number, cz: number, index: number): boolean {
    return this.chunks.get(chunkKey(cx, cz))?.has(index) ?? false;
  }

  /** Writes the stored edits of a chunk over its voxels; returns how many there were. */
  apply(cx: number, cz: number, voxels: Uint16Array): number {
    const map = this.chunks.get(chunkKey(cx, cz));
    if (!map) return 0;
    for (const [index, voxel] of map) voxels[index] = voxel;
    return map.size;
  }

  clear(): void {
    this.chunks.clear();
    this.total = 0;
  }

  toJSON(): EditsSnapshot {
    const out: EditsSnapshot = {};
    for (const [key, map] of this.chunks) {
      const indices = [...map.keys()].sort((a, b) => a - b);
      const bytes = new Uint8Array(indices.length * 4);
      indices.forEach((index, n) => {
        const voxel = map.get(index) as Voxel;
        bytes[n * 4] = index & 255;
        bytes[n * 4 + 1] = index >> 8;
        bytes[n * 4 + 2] = voxel & 255;
        bytes[n * 4 + 3] = voxel >> 8;
      });
      out[`${keyChunkX(key)},${keyChunkZ(key)}`] = encodeBase64(bytes);
    }
    return out;
  }

  /** Replaces every edit with the snapshot's. Throws on malformed data (nothing is changed then). */
  load(snapshot: EditsSnapshot): void {
    const parsed: [number, number, Uint8Array][] = [];
    for (const [name, text] of Object.entries(snapshot)) {
      const m = /^(-?\d+),(-?\d+)$/.exec(name);
      if (!m || typeof text !== 'string') throw new Error(`world edits: bad chunk entry "${name}"`);
      const bytes = decodeBase64(text);
      if (bytes.length % 4 !== 0) throw new Error(`world edits: chunk ${name} has a truncated entry`);
      parsed.push([Number(m[1]), Number(m[2]), bytes]);
    }
    this.clear();
    for (const [cx, cz, bytes] of parsed) {
      for (let i = 0; i < bytes.length; i += 4) {
        const index = bytes[i] | (bytes[i + 1] << 8);
        if (index >= CHUNK_VOLUME) continue;
        this.record(cx, cz, index, bytes[i + 2] | (bytes[i + 3] << 8));
      }
    }
  }
}
