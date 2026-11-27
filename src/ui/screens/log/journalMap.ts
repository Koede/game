/** Paints the explored-ground map into an RGBA pixel buffer (DOM-free, so it can be tested). One pixel is `blocksPerPx` blocks. */
import type { Journal } from '../../../game/journal';

export const MAP_PX = 144;
const UNSEEN: readonly number[] = [18, 16, 14];
const GROUND: readonly number[] = [92, 120, 66];

/** Height -> a brightness factor so hills read as relief. `h < 0` means the chunk is not loaded (remembered flat). */
export function shade(h: number): number {
  if (h < 0) return 0.85;
  return Math.max(0.6, Math.min(1.25, 0.8 + (h - 60) / 120));
}

/** Smallest blocks-per-pixel (power of two) that fits everything seen, and the player, into `size` pixels. */
export function mapScale(journal: Journal, px: number, pz: number, size: number): number {
  const b = journal.bounds();
  const span = Math.max(64, b ? Math.max(b.maxX - b.minX, b.maxZ - b.minZ) : 0, b ? 2 * Math.max(Math.abs(px - (b.minX + b.maxX) / 2), Math.abs(pz - (b.minZ + b.maxZ) / 2)) : 0);
  let s = 1;
  while (s * size < span * 1.1) s *= 2;
  return s;
}

/** A place the map circles: a waypoint stone (blue diamond) or the landmark a treasure map names (red cross). */
export interface MapMark { kind: 'waypoint' | 'treasure'; x: number; z: number }
const MARK_COLOUR: Record<MapMark['kind'], readonly number[]> = { waypoint: [90, 200, 255], treasure: [255, 90, 70] };
const MARK_SHAPE: Record<MapMark['kind'], ReadonlyArray<readonly [number, number]>> = {
  waypoint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]],
  treasure: [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 2], [-2, -2], [2, -2], [-2, 2]],
};

export function paintMap(journal: Journal, px: number, pz: number, size: number, heightAt: (x: number, z: number) => number, out: Uint8ClampedArray, marks: readonly MapMark[] = []): { blocksPerPx: number } {
  const b = journal.bounds();
  const cx = b ? (b.minX + b.maxX) / 2 : px;
  const cz = b ? (b.minZ + b.maxZ) / 2 : pz;
  const blocksPerPx = mapScale(journal, px, pz, size);
  const x0 = cx - (size / 2) * blocksPerPx;
  const z0 = cz - (size / 2) * blocksPerPx;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const wx = x0 + i * blocksPerPx;
      const wz = z0 + j * blocksPerPx;
      const o = (j * size + i) * 4;
      if (journal.isSeen(wx, wz)) {
        const f = shade(heightAt(Math.floor(wx), Math.floor(wz)));
        out[o] = GROUND[0] * f;
        out[o + 1] = GROUND[1] * f;
        out[o + 2] = GROUND[2] * f;
      } else {
        out[o] = UNSEEN[0];
        out[o + 1] = UNSEEN[1];
        out[o + 2] = UNSEEN[2];
      }
      out[o + 3] = 255;
    }
  }
  for (const m of marks) {
    const mx = Math.round((m.x - x0) / blocksPerPx);
    const mz = Math.round((m.z - z0) / blocksPerPx);
    const c = MARK_COLOUR[m.kind];
    for (const [dx, dz] of MARK_SHAPE[m.kind]) {
      const x = mx + dx;
      const z = mz + dz;
      if (x < 0 || z < 0 || x >= size || z >= size) continue;
      const o = (z * size + x) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
    }
  }
  // The player: a small bright cross.
  const ix = Math.round((px - x0) / blocksPerPx);
  const iz = Math.round((pz - z0) / blocksPerPx);
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = ix + dx;
    const z = iz + dz;
    if (x < 0 || z < 0 || x >= size || z >= size) continue;
    const o = (z * size + x) * 4;
    out[o] = 255;
    out[o + 1] = 214;
    out[o + 2] = 90;
  }
  return { blocksPerPx };
}
