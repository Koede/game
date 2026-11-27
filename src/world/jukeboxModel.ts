/**
 * The tavern jukebox as a miniblock model (miniModel.ts): a 1940s Wurlitzer-style cabinet in one cell. From the floor up: a plinth,
 * a chrome kick, a speaker grille of brass slats, the selector panel with its coin slot, a lit window of records under a stepped
 * chrome arch, and a stepped dome. Curved pilasters run up both sides with a bubble tube each; the tubes and the window glow
 * while it plays (`emissiveOn`, `texOn`). Pure data, in the NORTH frame (front towards -Z), sixteenths. Textures: src/render/textures/areas/tavern_fixtures.ts.
 */
import type { FaceName, MiniBox, MiniFace, MiniModel } from './miniModel';

const WOOD = 'jukebox_wood';
const CHROME = 'jukebox_chrome';
const BRASS = 'jukebox_brass';
const SIDES: readonly FaceName[] = ['n', 's', 'e', 'w', 'u', 'd'];

/** A box whose six faces all show `tex`, with optional per-face overrides (`front`: the north face, `uv` of it). */
function part(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tex: string, extra: Partial<MiniBox> = {}, front?: MiniFace): MiniBox {
  const faces: Partial<Record<FaceName, MiniFace>> = {};
  for (const f of SIDES) faces[f] = { tex };
  if (front) faces.n = front;
  return { from: [x0, y0, z0], to: [x1, y1, z1], faces, ...extra };
}

/** The same part on the other side of the cabinet. */
const mirror = (b: MiniBox): MiniBox => ({ ...b, from: [16 - b.to[0], b.from[1], b.from[2]], to: [16 - b.from[0], b.to[1], b.to[2]] });

const bubble: MiniFace = { tex: 'jukebox_bubble', texOn: 'jukebox_bubble_on', uv: [6, 0, 10, 16] };
const pilaster: MiniBox[] = [
  part(1, 2, 1, 3.25, 12, 13, WOOD),
  // The curved shoulder: the pilaster steps in as it climbs, with a brass ring where it meets the dome.
  part(1.5, 12, 1.5, 3.25, 13, 12.5, WOOD),
  part(2, 13, 1.75, 3.25, 13.5, 12.5, BRASS),
  // The bubble tube between two chrome rails.
  part(1.5, 3, 0.4, 2.75, 12, 1, WOOD, { emissiveOn: true }, bubble),
  part(1, 2.5, 0.4, 1.5, 12.5, 1, CHROME),
  part(2.75, 2.5, 0.4, 3.25, 12.5, 1, CHROME),
];

const slats: MiniBox[] = [0, 1, 2, 3, 4, 5].map((i) => part(4.5 + i * 1.3, 3, 0.6, 5 + i * 1.3, 5.75, 1, BRASS));

export const JUKEBOX_MODEL: MiniModel = {
  boxes: [
    // The carcass, plinth and chrome kick.
    part(2, 2, 2, 14, 12.75, 13, WOOD),
    part(1, 0, 1, 15, 2, 14, WOOD, { shade: 0.72 }),
    part(2.5, 2, 0.5, 13.5, 2.75, 1, CHROME),
    // The speaker: dark cloth, six brass slats and a chrome frame.
    part(4, 2.75, 1, 12, 6, 2, 'jukebox_grille', {}, { tex: 'jukebox_grille', uv: [0, 0, 16, 16] }),
    ...slats,
    part(3.25, 2.75, 0.75, 4, 6.75, 2, CHROME),
    part(12, 2.75, 0.75, 12.75, 6.75, 2, CHROME),
    part(3.25, 6, 0.75, 12.75, 6.75, 2, CHROME),
    // The selector panel with its coin slot, and a trim bar above it.
    part(3.5, 6.75, 0.9, 12.5, 8.5, 2, WOOD, {}, { tex: 'jukebox_panel', uv: [0, 6, 16, 10] }),
    part(10, 7, 0.5, 11.5, 8.2, 0.9, CHROME),
    part(3.25, 8.5, 0.75, 12.75, 9, 2, CHROME),
    // The window: glass with the records, lit while playing, under a stepped chrome arch.
    part(4, 9, 1, 12, 12.75, 2, WOOD, { emissiveOn: true }, { tex: 'jukebox_window', texOn: 'jukebox_window_on', uv: [0, 4, 16, 12] }),
    part(3.25, 9, 0.75, 4, 12.75, 2, CHROME),
    part(12, 9, 0.75, 12.75, 12.75, 2, CHROME),
    part(3.25, 12.75, 0.75, 12.75, 13.25, 2, CHROME),
    part(4.25, 13.25, 0.75, 11.75, 13.75, 2, CHROME),
    part(5.75, 13.75, 0.75, 10.25, 14.25, 2, CHROME),
    // The dome: stepped boxes narrowing to a crown, a chrome band at the shoulder.
    part(2, 12.75, 1.5, 14, 13.75, 13, WOOD),
    part(3, 13.75, 2, 13, 14.75, 12.5, WOOD),
    part(4.5, 14.75, 2.5, 11.5, 15.5, 12, WOOD),
    part(6.5, 15.5, 3.5, 9.5, 16, 11, WOOD),
    part(3.5, 13.75, 1.75, 12.5, 14, 2, CHROME),
    ...pilaster,
    ...pilaster.map(mirror),
  ],
};
