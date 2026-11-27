/** Icon of the airship (src/content/areas/airship.ts): a cream gas envelope with fins over a small gondola and propeller. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { icon } from '../shapes';

const ENVELOPE = [P.rgb(0x7d6a4c), P.rgb(0xa8916a), P.rgb(0xcdb88e), P.rgb(0xe6d6b0), P.rgb(0xf7ecd2)];
const RED = P.rgb(0xa8402c);

function airship(c: Canvas): void {
  // The envelope: a long rounded body, lit from above, with a red band and tail fins.
  c.rect(2, 2, 11, 6, ENVELOPE[2]);
  c.rect(1, 3, 13, 4, ENVELOPE[2]);
  c.rect(3, 2, 9, 1, ENVELOPE[4]);
  c.rect(2, 3, 10, 1, ENVELOPE[3]);
  c.rect(2, 7, 11, 1, ENVELOPE[1]);
  c.rect(1, 6, 1, 1, ENVELOPE[1]);
  c.rect(7, 2, 1, 6, RED);
  c.rect(13, 1, 2, 3, ENVELOPE[1]);
  c.rect(13, 6, 2, 3, ENVELOPE[1]);
  c.set(14, 2, ENVELOPE[3]);
  // Rigging lines down to the gondola.
  c.set(5, 8, P.WOOD[1]);
  c.set(9, 8, P.WOOD[1]);
  c.set(5, 9, P.WOOD[1]);
  c.set(9, 9, P.WOOD[1]);
  // The gondola: polished wood with windows and a steel keel.
  c.rect(4, 10, 7, 3, P.WOOD[2]);
  c.rect(4, 10, 7, 1, P.WOOD[4]);
  c.set(6, 11, P.rgb(0xbfe0ea));
  c.set(8, 11, P.rgb(0xbfe0ea));
  c.rect(4, 13, 7, 1, P.STEEL[1]);
  // Propeller at the stern.
  c.rect(11, 11, 1, 1, P.GRAPHITE[3]);
  c.rect(12, 9, 1, 5, P.STEEL[3]);
}

export default { item_airship: icon(airship) } satisfies PainterSet;
