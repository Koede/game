/**
 * Icons of the artificer's attuned tools (docs/SYNERGY_PLAN.md section 2): the plain tool's own icon with a little sparkle
 * in the corner, violet for runes and pale cyan for gale, so a tempered tool is known at a glance in the pack.
 */
import type { Canvas, Painter, PainterSet } from '../canvas';
import { TOOL_ICONS } from '../iconsTools';
import { rgb, type RGB } from '../palette';

const SPARK: Record<string, [RGB, RGB]> = {
  rune: [rgb(0xb98cff), rgb(0xf0e0ff)],
  gale: [rgb(0x8fe6ff), rgb(0xf0fdff)],
};

function sparkle(c: Canvas, [glow, core]: [RGB, RGB]): void {
  for (const [x, y] of [[2, 1], [1, 2], [3, 2], [2, 3], [14, 13], [13, 14], [15, 14], [14, 15]] as const) c.set(x, y, glow);
  c.set(2, 2, core);
  c.set(14, 14, core);
}

const painters: Record<string, Painter> = {};
for (const material of ['bronze', 'iron']) {
  for (const kind of ['pickaxe', 'axe', 'shovel']) {
    for (const aspect of Object.keys(SPARK)) {
      const base = TOOL_ICONS[`item_${material}_${kind}`];
      painters[`item_${aspect}_${material}_${kind}`] = (c) => {
        base(c);
        sparkle(c, SPARK[aspect]);
      };
    }
  }
}

export default painters satisfies PainterSet;
