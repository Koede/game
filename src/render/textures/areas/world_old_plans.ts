/** Icons of the old plans (src/content/oldPlans.ts): a rolled drawing sheet with a tinted ribbon and a ruled floor plan. */
import type { Canvas, PainterSet } from '../canvas';
import { rgb } from '../palette';
import { icon } from '../shapes';
import { OLD_PLANS } from '../../../content/oldPlans';

const PAPER = [rgb(0x8d7648), rgb(0xb59a62), rgb(0xd3bb82), rgb(0xe6d3a0), rgb(0xf3e6bd)];
const INK = rgb(0x4a3822);

const plan = (tint: number) => (c: Canvas): void => {
  const band = rgb(tint);
  c.rect(2, 3, 12, 10, PAPER[2]);
  c.rect(2, 3, 12, 1, PAPER[4]);
  c.rect(2, 12, 12, 1, PAPER[0]);
  c.rect(2, 3, 1, 10, PAPER[3]);
  c.rect(13, 3, 1, 10, PAPER[1]);
  c.rect(4, 5, 8, 6, INK);
  c.rect(5, 6, 6, 4, PAPER[3]);
  c.rect(7, 6, 1, 2, INK);
  c.rect(2, 7, 12, 2, band);
};

export default Object.fromEntries(OLD_PLANS.map((p) => [`item_${p.item}`, icon(plan(p.tint))])) satisfies PainterSet;
