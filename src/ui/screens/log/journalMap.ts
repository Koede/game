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

/** Where the map sits in the world: the block at its top-left pixel and the blocks per pixel. */
export interface MapFrame { x0: number; z0: number; blocksPerPx: number }

/** The frame `paintMap` uses: centred on everything seen, scaled by `mapScale`. */
export function mapFrame(journal: Journal, px: number, pz: number, size: number): MapFrame {
  const b = journal.bounds();
  const cx = b ? (b.minX + b.maxX) / 2 : px;
  const cz = b ? (b.minZ + b.maxZ) / 2 : pz;
  const blocksPerPx = mapScale(journal, px, pz, size);
  return { x0: cx - (size / 2) * blocksPerPx, z0: cz - (size / 2) * blocksPerPx, blocksPerPx };
}

/** A place pinned on the map: a waypoint stone, or the landmark a treasure map in the pack points at. */
export interface MapMarker { kind: 'waypoint' | 'treasure'; x: number; z: number; name?: string }

/** Where a marker lands, in pixels. `edge`: it lies off the map and was pulled in to the border, toward it. */
export interface PlacedMarker { kind: MapMarker['kind']; i: number; j: number; edge: boolean }

/** Pixel positions of the markers in this frame; off-map ones are clamped to the border (1 px in, so the glyph fits). */
export function placeMarkers(frame: MapFrame, size: number, markers: readonly MapMarker[]): PlacedMarker[] {
  return markers.map((m) => {
    const ri = Math.round((m.x - frame.x0) / frame.blocksPerPx);
    const rj = Math.round((m.z - frame.z0) / frame.blocksPerPx);
    const i = Math.max(1, Math.min(size - 2, ri));
    const j = Math.max(1, Math.min(size - 2, rj));
    return { kind: m.kind, i, j, edge: i !== ri || j !== rj };
  });
}

let markerSource: (() => readonly MapMarker[]) | null = null;
/** The app sets where the journal map's markers come from (Exploration.mapMarks); null clears it. */
export function setMapMarkerSource(source: (() => readonly MapMarker[]) | null): void { markerSource = source; }
/** The markers to draw now (none when no source is set, e.g. in tests). */
export function currentMapMarkers(): readonly MapMarker[] { return markerSource?.() ?? []; }

const WAYPOINT_RGB: readonly number[] = [120, 200, 255];
const TREASURE_RGB: readonly number[] = [235, 70, 50];
/** A waypoint is a small diamond, a treasure landmark an X. */
const MARK_SHAPES: Record<MapMarker['kind'], ReadonlyArray<readonly [number, number]>> = {
  waypoint: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  treasure: [[0, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]],
};

export function paintMap(
  journal: Journal, px: number, pz: number, size: number, heightAt: (x: number, z: number) => number, out: Uint8ClampedArray,
  markers: readonly MapMarker[] = [],
): { blocksPerPx: number } {
  const frame = mapFrame(journal, px, pz, size);
  const { x0, z0, blocksPerPx } = frame;
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
  for (const m of placeMarkers(frame, size, markers)) {
    const rgb = m.kind === 'waypoint' ? WAYPOINT_RGB : TREASURE_RGB;
    // An off-map marker is only its centre pixel on the border: a hint of the way, not a place.
    for (const [dx, dz] of m.edge ? [[0, 0] as const] : MARK_SHAPES[m.kind]) {
      const o = ((m.j + dz) * size + (m.i + dx)) * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
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
