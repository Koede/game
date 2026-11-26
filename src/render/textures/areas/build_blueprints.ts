/** Icon of the Builder's Square (src/content/areas/build_blueprints.ts): a wooden carpenter's square with charcoal ticks. */
import type { Canvas, PainterSet } from '../canvas';
import { rgb } from '../palette';
import { icon } from '../shapes';

const WOOD = [rgb(0x5e3f22), rgb(0x8a6236), rgb(0xb08350), rgb(0xd2a873)];
const INK = rgb(0x2a2420);

function square(c: Canvas): void {
  // The long arm down the left, the short arm along the bottom.
  c.rect(3, 2, 3, 12, WOOD[1]);
  c.rect(3, 11, 11, 3, WOOD[1]);
  c.rect(3, 2, 1, 12, WOOD[3]);
  c.rect(3, 11, 11, 1, WOOD[2]);
  c.rect(5, 2, 1, 9, WOOD[0]);
  c.rect(3, 13, 11, 1, WOOD[0]);
  for (let y = 3; y <= 9; y += 2) c.set(4, y, INK);
  for (let x = 6; x <= 12; x += 2) c.set(x, 12, INK);
}

export default { item_builders_square: icon(square) } satisfies PainterSet;
