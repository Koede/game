/** Pure geometry helpers for widgets (label de-cluttering, tooltip placement, scale ticks). DOM-free. */

/**
 * Pushes 1-D label positions apart so neighbours are at least `minGap` apart while staying inside [lo, hi]
 * where that is possible. Returns the adjusted positions in the input's order.
 */
export function declutter(positions: readonly number[], minGap: number, lo: number, hi: number): number[] {
  const order = positions.map((_, i) => i).sort((a, b) => positions[a] - positions[b]);
  const out = order.map((i) => Math.min(hi, Math.max(lo, positions[i])));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + minGap);
  const last = out.length - 1;
  if (last >= 0 && out[last] > hi) {
    out[last] = hi;
    for (let i = last - 1; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - minGap);
  }
  const result = new Array<number>(positions.length);
  order.forEach((index, rank) => {
    result[index] = out[rank];
  });
  return result;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  side: 'top' | 'bottom';
}

/**
 * Where to put a tooltip of size `tip` for an anchor box: centred above it, flipped below when there is no
 * room, and always clamped so it never leaves the viewport.
 */
export function placeTooltip(anchor: Box, tip: Size, viewport: Size, margin = 8, gap = 8): Placement {
  const fitsAbove = anchor.top - gap - tip.height >= margin;
  const fitsBelow = anchor.top + anchor.height + gap + tip.height <= viewport.height - margin;
  const side: Placement['side'] = fitsAbove || !fitsBelow ? 'top' : 'bottom';
  const rawTop = side === 'top' ? anchor.top - gap - tip.height : anchor.top + anchor.height + gap;
  const rawLeft = anchor.left + anchor.width / 2 - tip.width / 2;
  const maxLeft = Math.max(margin, viewport.width - margin - tip.width);
  const maxTop = Math.max(margin, viewport.height - margin - tip.height);
  return {
    left: Math.round(Math.min(maxLeft, Math.max(margin, rawLeft))),
    top: Math.round(Math.min(maxTop, Math.max(margin, rawTop))),
    side,
  };
}

/** A round step (1, 2 or 5 times a power of ten) that divides `range` into at most `maxTicks` intervals. */
export function niceStep(range: number, maxTicks: number): number {
  if (!(range > 0) || maxTicks < 1) return 1;
  const rough = range / maxTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= rough) return m * pow;
  }
  return 10 * pow;
}

/** Every multiple of `step` inside [min, max], inclusive. */
export function ticksBetween(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  if (!(step > 0)) return out;
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
