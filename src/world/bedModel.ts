/**
 * The wool bedding as a miniblock model (miniModel.ts): a single-cell bed. Four round-ish posts (a square box and the same box
 * turned 45 degrees about its own axis, so the corners read as rounded), a plank frame with a low footboard, a tall headboard
 * leaning a little back into the room, a cream ticking mattress, a red blanket laid over the middle and folded at the foot so it
 * drapes over the footboard, and a plump pillow tilted against the headboard. Only rotated boxes are used (miniModel.ts `rot`):
 * no new mesher primitives. The block stays a slab in the content (collision: the player stands on it, as before); only the drawing
 * follows this model. Pure data, in the NORTH frame: the headboard is at +Z (south), the foot at -Z (north), sixteenths. A bed
 * whose headboard should face the west wall is placed with Facing.East. Textures: src/render/textures/areas/synergy_animals.ts.
 */
import type { FaceName, MiniBox, MiniFace, MiniModel } from './miniModel';

const FRAME = 'bed_frame';
const MATTRESS = 'bed_mattress';
const BLANKET = 'bed_blanket';
const PILLOW = 'bed_pillow';
const SIDES: readonly FaceName[] = ['n', 's', 'e', 'w', 'u', 'd'];

/** A box whose six faces all show `tex`. */
function part(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tex: string, extra: Partial<MiniBox> = {}): MiniBox {
  const faces: Partial<Record<FaceName, MiniFace>> = {};
  for (const f of SIDES) faces[f] = { tex };
  return { from: [x0, y0, z0], to: [x1, y1, z1], faces, ...extra };
}

/** A round-looking post: a square column and the same column turned 45 degrees about its axis, both of the same height. */
function post(cx: number, cz: number, y0: number, y1: number): MiniBox[] {
  const h = 1.1;
  const square = part(cx - h, y0, cz - h, cx + h, y1, cz + h, FRAME, { shade: 0.9 });
  const turned = part(cx - h, y0, cz - h, cx + h, y1, cz + h, FRAME, { shade: 1.04, rot: { axis: 'y', angle: 45, origin: [cx, (y0 + y1) / 2, cz] } });
  return [square, turned];
}

export const BED_MODEL: MiniModel = {
  boxes: [
    // Four posts: tall at the head, short at the foot.
    ...post(2, 2, 0, 9),
    ...post(14, 2, 0, 9),
    ...post(2, 14, 0, 12),
    ...post(14, 14, 0, 12),
    // The frame: a plank box between the posts, a low footboard at the foot.
    part(0, 2, 1, 16, 4, 15, FRAME),
    part(0, 2, 0, 16, 5.5, 1, FRAME),
    // The headboard: a tall board leaning a few degrees back into the room (its top moves towards -Z), with a lip on top.
    part(0, 2, 14.5, 16, 12, 15.5, FRAME, { rot: { axis: 'x', angle: -8, origin: [8, 2, 15.5] } }),
    part(0, 11.6, 14.1, 16, 12.6, 15.1, FRAME, { shade: 1.06, rot: { axis: 'x', angle: -8, origin: [8, 2, 15.5] } }),
    // The mattress, its top at 7/16.
    part(0.75, 4, 1.5, 15.25, 7, 14.5, MATTRESS),
    // The blanket laid over the middle of the bed.
    part(0.6, 7, 4, 15.4, 7.5, 10.5, BLANKET),
    // The folded blanket at the foot: a roll across the bed, its near edge hanging over the footboard at a slant.
    part(0.6, 7, 1.5, 15.4, 8.5, 4.2, BLANKET, { shade: 1.04 }),
    part(0.6, 5.5, -0.4, 15.4, 7.2, 0.9, BLANKET, { shade: 0.92, rot: { axis: 'x', angle: 18, origin: [8, 7, 1] } }),
    // The pillow against the headboard, plump (a taller box) and tilted back a little.
    part(2.5, 7, 11, 13.5, 8.7, 14.4, PILLOW, { rot: { axis: 'x', angle: -6, origin: [8, 7, 14.4] } }),
  ],
};
