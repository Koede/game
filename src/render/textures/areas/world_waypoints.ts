/** Tiles of the waypoint stone (src/content/areas/world_waypoints.ts): carved grey stone with a pale rune glow. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb } from '../palette';

const GLOW = rgb(0x9fe3d4);

function side(c: Canvas): void {
  c.fill(P.STONE[2]);
  c.each((x, y) => (c.hash(x, y) < 0.22 ? P.STONE[1] : c.hash(x, y, 1) > 0.88 ? P.STONE[3] : null));
  c.frame(0, 0, 16, 16, P.STONE[0]);
  for (let i = 0; i < 4; i++) {
    c.set(8 + i, 4 + i, GLOW); c.set(7 - i, 4 + i, GLOW);
    c.set(8 + i, 11 - i, GLOW); c.set(7 - i, 11 - i, GLOW);
  }
  c.rect(7, 7, 2, 2, GLOW);
}

function top(c: Canvas): void {
  c.fill(P.STONE[3]);
  c.each((x, y) => (c.hash(x, y, 2) < 0.2 ? P.STONE[2] : c.hash(x, y, 3) > 0.9 ? P.STONE[4] : c.hash(x, y, 4) < 0.1 ? P.STONE[0] : null));
  c.frame(0, 0, 16, 16, P.STONE[1]);
  c.ring(7.5, 7.5, 4, GLOW);
  c.rect(7, 7, 2, 2, GLOW);
}

export default { waypoint_stone_side: side, waypoint_stone_top: top } satisfies PainterSet;
