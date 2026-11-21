/**
 * Tool icons: one handle, four head shapes (pickaxe, axe, shovel, hoe), four head materials. Flint heads are chipped and lashed on with
 * cord; metal heads are cast and wedged. The power drill is its own machine-like silhouette.
 */
import type { Canvas, Painter, PainterSet } from './canvas';
import * as P from './palette';
import { type Ramp, shade } from './palette';
import { icon } from './shapes';

type Kind = 'pickaxe' | 'axe' | 'shovel' | 'hoe';

const FLINT: Ramp = [P.rgb(0x2b2c37), P.rgb(0x40424f), P.rgb(0x5a5d70), P.rgb(0x7c8198), P.rgb(0xa9afc6)];
const HEADS: Record<string, Ramp> = { flint: FLINT, bronze: P.BRONZE, iron: P.IRON_METAL, steel: P.STEEL };

/** Axe head, hand-drawn: a crescent edge on the left, the neck wrapping the handle on the right. */
const AXE = [
  '................',
  '..45............',
  '.4553...........',
  '.45332..........',
  '.4533322222.....',
  '.45333322222....',
  '.4533332221.....',
  '.45332..........',
  '.4553...........',
  '..45............',
];

/** The wooden handle along the main diagonal, from (x0, y0) up to (x1, y1). */
function handle(c: Canvas, x0: number, y0: number, x1: number, y1: number): void {
  const w = P.WOOD;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    c.set(x, y, w[3]);
    c.set(x + 1, y, w[1]);
  }
  c.set(x0, y0, w[0]);
  c.set(x0 + 1, y0, w[0]);
}

/** Head pixels by shape: returns 0..1 lightness for pixels inside the head, -1 outside. */
function headShape(kind: Kind, x: number, y: number): number {
  if (kind === 'pickaxe') {
    // An arc around the bottom-left, tapering to points at both ends.
    const dx = x + 0.5 - 3.5;
    const dy = 12.5 - (y + 0.5);
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    if (a < 0.15 || a > 1.62) return -1;
    const mid = 0.88;
    const taper = 1 - Math.abs(a - mid) / 0.8;
    const half = 0.45 + taper * 0.9;
    if (Math.abs(r - 10.2) > half) return -1;
    return 0.5 + (r - 10.2) / (half * 2) + (a - mid) * 0.35;
  }
  if (kind === 'axe') {
    const d = AXE[y]?.[x];
    return d === undefined || d === '.' ? -1 : (Number(d) - 1) / 4;
  }
  if (kind === 'hoe') {
    // A thin flat blade set square to the handle at its top end, its sharpened edge at the far (lower right) end.
    const dx = x + 0.5 - 11;
    const dy = y + 0.5 - 4;
    const along = (dx + dy) / Math.SQRT2;
    const across = (dx - dy) / Math.SQRT2;
    if (along < -0.8 || along > 5.6 || Math.abs(across) > (along > 3.8 ? 1.2 : 0.8)) return -1;
    if (along > 4.3) return 0.98;
    return across < 0 ? 0.7 : 0.35;
  }
  // Shovel: a long spade blade below the handle, with a raised centre ridge and a rounded point.
  const dx = x + 0.5 - 4.5;
  const dy = y + 0.5 - 11.5;
  const along = (dx - dy) / Math.SQRT2;
  const across = (dx + dy) / Math.SQRT2;
  if (along < -3.6 || along > 3.4) return -1;
  const half = along < -1.2 ? 2.4 - (-1.2 - along) * 0.75 : 2.4;
  if (Math.abs(across) > half) return -1;
  if (Math.abs(across) < 0.5) return 0.95;
  return across < 0 ? 0.65 : 0.35;
}

function tool(c: Canvas, kind: Kind, material: string): void {
  const r = HEADS[material];
  if (kind === 'shovel') handle(c, 6, 8, 13, 1);
  else if (kind === 'hoe') handle(c, 1, 14, 10, 5);
  else if (kind === 'axe') handle(c, 2, 14, 13, 3);
  else handle(c, 1, 14, 10, 5);
  if (kind === 'shovel') {
    c.rect(12, 0, 4, 1, P.WOOD[3]);
    c.rect(12, 1, 1, 1, P.WOOD[1]);
    c.rect(15, 1, 1, 1, P.WOOD[1]);
  }
  c.each((x, y) => {
    const v = headShape(kind, x, y);
    if (v < 0) return null;
    // Flint is knapped: its outer rim is ragged.
    if (material === 'flint' && v > 0.82 && c.hash(x, y, 1) < 0.45) return null;
    return r[Math.max(0, Math.min(4, Math.floor(v * 4.99)))];
  });
  // Binding at the joint: cord lashing for flint, a bright wedge for cast metal.
  const [jx, jy] = kind === 'pickaxe' ? [9, 5] : kind === 'axe' ? [9, 7] : kind === 'hoe' ? [10, 4] : [6, 8];
  if (material === 'flint') {
    c.set(jx, jy, P.CLOTH[3]);
    c.set(jx + 1, jy + 1, P.CLOTH[1]);
    c.set(jx - 1, jy + 1, P.CLOTH[2]);
  } else c.set(jx, jy, shade(r[4], 0.4));
}

function powerDrill(c: Canvas): void {
  // Pistol-grip body in hazard yellow and soot, a battery foot with a cyan charge pip, a tungsten bit.
  const body = [P.rgb(0x6e5410), P.rgb(0xa07e18), P.HAZARD, P.rgb(0xf0cf4c), P.rgb(0xfff0a0)];
  c.rect(2, 3, 8, 5, body[2]);
  c.rect(2, 3, 8, 1, body[4]);
  c.rect(2, 7, 8, 1, body[0]);
  c.rect(2, 3, 1, 5, body[3]);
  c.rect(4, 8, 3, 4, P.GRAPHITE[2]);
  c.rect(4, 8, 1, 4, P.GRAPHITE[4]);
  c.rect(3, 12, 6, 3, P.GRAPHITE[1]);
  c.rect(3, 12, 6, 1, P.GRAPHITE[3]);
  c.rect(7, 13, 1, 1, P.CYAN);
  c.rect(10, 4, 2, 3, P.IRON_METAL[2]);
  c.rect(10, 4, 2, 1, P.IRON_METAL[4]);
  for (let x = 12; x <= 15; x++) c.set(x, 5, x % 2 === 0 ? P.TUNGSTEN[4] : P.TUNGSTEN[2]);
  c.set(5, 5, P.SOOT);
  c.set(6, 5, P.SOOT);
}

const tools: Record<string, Painter> = {};
for (const material of Object.keys(HEADS)) {
  for (const kind of ['pickaxe', 'axe', 'shovel'] as const) tools[`item_${material}_${kind}`] = icon((c) => tool(c, kind, material));
}
// Hoes (spec 12.4) come in flint, bronze and iron only.
for (const material of ['flint', 'bronze', 'iron']) tools[`item_${material}_hoe`] = icon((c) => tool(c, 'hoe', material));

export const TOOL_ICONS: PainterSet = { ...tools, item_power_drill: icon(powerDrill) };
