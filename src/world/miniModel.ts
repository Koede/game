/**
 * Miniblock models: a block drawn from a list of small boxes in 1/16-block units, like a Minecraft block model, instead
 * of a full cube or a flat sprite. Pure data, so the mesher (worker side), the target outline and the renderer's held /
 * icon drawing all read the same thing. The model of a block key is registered in MINI_MODELS; the block itself stays an
 * ordinary `cube` / `slab` in the content (collision, aiming and Use rules treat the whole cell; only the drawing and
 * the outline follow the model), so saves and gameplay do not change.
 *
 * Frame: the block's NORTH-facing frame, front towards -Z; a voxel facing East / South / West turns the whole model
 * about the cell centre. Face names are in that frame: n = -Z, s = +Z, e = +X, w = -X, u = up, d = down.
 *
 * A box:
 *   from, to   corners, sixteenths (may exceed 0..16 a little for overhangs; the mesh is not clipped)
 *   faces      per-face options: `uv` [u0, v0, u1, v1] in sixteenths of the tile (v up), `tex` another texture's name
 *              (it must be in the atlas), `texOn` the texture to show instead while the voxel is active (a lit window), `hide`
 *              (no face). By default a face samples the block's own tile at its position.
 *   rot        { axis, angle (degrees), origin? (sixteenths, default the box centre) }: a tilted spout, a leaning rack pole
 *   shade      brightness multiplier 0..1 (a darker inside, a lighter rim)
 *   emissive   the faces ignore light (a glowing core, a lit lamp pane); `emissiveOn`: only while the voxel is active (a jukebox's lamps)
 *   part       a named MOVING part (lid, handle, crank): not meshed into the chunk; the renderer draws it with the
 *              part-and-track system (src/render/parts) and reads it through `miniParts`
 */
import type { Facing } from '../core/types';
import { JUKEBOX_MODEL } from './jukeboxModel';

export type V3 = readonly [number, number, number];
export type FaceName = 'n' | 's' | 'e' | 'w' | 'u' | 'd';
export const FACE_NAMES: readonly FaceName[] = ['e', 'w', 'u', 'd', 's', 'n'];

export interface MiniFace {
  uv?: readonly [number, number, number, number];
  tex?: string;
  texOn?: string;
  hide?: boolean;
}

export interface MiniBox {
  from: V3;
  to: V3;
  faces?: Partial<Record<FaceName, MiniFace>>;
  rot?: { axis: 'x' | 'y' | 'z'; angle: number; origin?: V3 };
  shade?: number;
  emissive?: boolean;
  emissiveOn?: boolean;
  part?: string;
}

export interface MiniModel {
  boxes: readonly MiniBox[];
}

/** Shorthand for an axis-aligned box. */
export const mb = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, extra: Partial<MiniBox> = {}): MiniBox => ({
  from: [x0, y0, z0],
  to: [x1, y1, z1],
  ...extra,
});

/** A hollow vessel: floor, four walls round an open top (`h` tall, `wall` thick), from `min` to `max` on both horizontal axes. */
export function vessel(min: number, max: number, floor: number, h: number, wall: number, y0 = 0): MiniBox[] {
  return [
    mb(min, y0, min, max, y0 + floor, max),
    mb(min, y0 + floor, min, max, h, min + wall),
    mb(min, y0 + floor, max - wall, max, h, max),
    mb(min, y0 + floor, min + wall, min + wall, h, max - wall),
    mb(max - wall, y0 + floor, min + wall, max, h, max - wall),
  ];
}

export const MINI_MODELS: Record<string, MiniModel> = {
  // The tavern jukebox: a 1940s arched cabinet (jukeboxModel.ts).
  jukebox: JUKEBOX_MODEL,
  // The fired pot with a spout: foot, round belly, shoulder, a neck ring round the open top, a tilted spout and a loop handle.
  alloy_pot: {
    boxes: [
      mb(4.5, 0, 4.5, 11.5, 1, 11.5, { shade: 0.8 }),
      mb(3, 1, 3, 13, 6, 13),
      mb(2.5, 3, 2.5, 13.5, 5, 13.5, { shade: 1.06 }),
      mb(4, 6, 4, 12, 8, 12),
      ...vessel(5, 11, 1, 10.5, 1.2, 7.5).map((b, i) => (i === 0 ? { ...b, shade: 0.55 } : b)),
      // The spout: a short trough leaning out of the front (north), open at its top.
      mb(6.5, 7, 1.5, 9.5, 9, 5, { rot: { axis: 'x', angle: -28, origin: [8, 8, 5] } }),
      mb(7.2, 8.4, 1.5, 8.8, 9.2, 4.5, { rot: { axis: 'x', angle: -28, origin: [8, 8, 5] }, shade: 0.5 }),
      // A loop handle on the east side.
      mb(13, 4.5, 7, 15, 6, 9),
      mb(14, 3, 7, 15, 4.5, 9),
      mb(13, 2.5, 7, 15, 3.5, 9),
    ],
  },
};

const keys = Object.keys(MINI_MODELS);
export const isMiniModel = (key: string): boolean => key in MINI_MODELS;
/** Position + 1 of a key among the models (0 = none); the mesher's per-block table. */
export const miniIndexOf = (key: string): number => keys.indexOf(key) + 1;
export const miniByIndex = (index: number): MiniModel | null => (index > 0 ? MINI_MODELS[keys[index - 1]] ?? null : null);
export const miniKeys = (): readonly string[] => keys;

/** The moving parts of a model (boxes with a `part` name), grouped by name: what the renderer animates. */
export function miniParts(model: MiniModel): Map<string, MiniBox[]> {
  const out = new Map<string, MiniBox[]>();
  for (const b of model.boxes) if (b.part) (out.get(b.part) ?? out.set(b.part, []).get(b.part)!).push(b);
  return out;
}

/** Corners of a box after its own rotation, sixteenths (the 8 corners, bit 0 = +x, 1 = +y, 2 = +z). */
export function boxCorners(b: MiniBox, out: number[] = new Array(24)): number[] {
  const o = b.rot?.origin ?? [(b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2, (b.from[2] + b.to[2]) / 2];
  const a = b.rot ? (b.rot.angle * Math.PI) / 180 : 0;
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 8; i++) {
    let x = (i & 1 ? b.to[0] : b.from[0]) - o[0];
    let y = (i & 2 ? b.to[1] : b.from[1]) - o[1];
    let z = (i & 4 ? b.to[2] : b.from[2]) - o[2];
    if (b.rot) {
      if (b.rot.axis === 'x') [y, z] = [y * c - z * s, y * s + z * c];
      else if (b.rot.axis === 'y') [x, z] = [x * c + z * s, -x * s + z * c];
      else [x, y] = [x * c - y * s, x * s + y * c];
    }
    out[i * 3] = x + o[0];
    out[i * 3 + 1] = y + o[1];
    out[i * 3 + 2] = z + o[2];
  }
  return out;
}

/** The part of the cell a model fills (0..1): the target outline, hugging the model (moving parts included). */
export function miniBounds(model: MiniModel): [number, number, number, number, number, number] {
  const out = [16, 16, 16, 0, 0, 0];
  const c = new Array<number>(24);
  for (const b of model.boxes) {
    boxCorners(b, c);
    for (let i = 0; i < 8; i++) for (let a = 0; a < 3; a++) {
      out[a] = Math.min(out[a], c[i * 3 + a]);
      out[a + 3] = Math.max(out[a + 3], c[i * 3 + a]);
    }
  }
  return out.map((n) => Math.min(16, Math.max(0, n)) / 16) as [number, number, number, number, number, number];
}

/** Turns a point (sixteenths) about the cell centre to the facing: North is the identity, East sends -Z to +X. */
export function turnPoint(x: number, z: number, facing: Facing, out: number[]): void {
  let px = x, pz = z;
  for (let k = 0; k < facing; k++) [px, pz] = [16 - pz, px];
  out[0] = px;
  out[1] = pz;
}
