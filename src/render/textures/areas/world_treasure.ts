/** Icon of the treasure map (src/content/areas/world_treasure.ts): a folded parchment with a red cross. */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { rgb } from '../palette';
import { icon } from '../shapes';

const PAPER = [rgb(0x8d7648), rgb(0xb59a62), rgb(0xd3bb82), rgb(0xe6d3a0), rgb(0xf3e6bd)];
const RED = rgb(0xb02a1e);
const INK = rgb(0x4a3822);

function map(c: Canvas): void {
  c.rect(2, 3, 12, 10, PAPER[2]);
  c.rect(2, 3, 12, 1, PAPER[4]);
  c.rect(2, 12, 12, 1, PAPER[0]);
  c.rect(2, 3, 1, 10, PAPER[3]);
  c.rect(13, 3, 1, 10, PAPER[1]);
  c.rect(7, 3, 1, 10, PAPER[1]);
  c.line(3, 10, 6, 6, INK);
  c.line(6, 6, 9, 9, INK);
  c.line(9, 9, 12, 5, INK);
  c.set(10, 5, RED); c.set(12, 7, RED); c.set(11, 6, RED); c.set(10, 7, RED); c.set(12, 5, RED);
  c.rect(4, 5, 2, 1, P.STONE[1]);
}

export default { item_treasure_map: icon(map) } satisfies PainterSet;
