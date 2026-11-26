/** The insulated wall tile (src/content/areas/warmth.ts): vertical boards with a thick cream wool quilting between. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { shade } from '../palette';

const WOOL = [P.rgb(0xb4ab95), P.rgb(0xd3cab5), P.rgb(0xe8e1cf), P.rgb(0xf7f2e4)];

function insulatedWall(c: Canvas): void {
  c.each((x, y) => {
    const frame = x < 2 || x > 13 || y < 2 || y > 13;
    if (frame) return shade(P.WOOD[2], (c.hash(x, y, 91) - 0.5) * 0.12 + (x === 0 || y === 0 ? 0.08 : x === 15 || y === 15 ? -0.1 : 0));
    const puff = ((x + y) % 4 === 0 ? 1 : 0) + ((x * 3 + y) % 5 === 0 ? 1 : 0);
    return shade(WOOL[Math.min(3, 1 + puff)], (c.hash(x, y, 92) - 0.5) * 0.08);
  });
}

export default { insulated_wall: insulatedWall } satisfies PainterSet;
