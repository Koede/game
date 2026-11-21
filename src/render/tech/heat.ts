/**
 * The heat ramp - the game's colour language for temperature (src/ui/kit/format.ts owns it: the thermometer, the
 * furnace screen). The renderer cannot import the UI, so the stops are repeated here; heat.test.ts keeps the two equal.
 */

/** [tempC, r, g, b] stops (0..255): cold iron, dull red 500, orange 800, yellow 1100, white 1500, blue-white 1900+. */
export const HEAT_RAMP: readonly (readonly [number, number, number, number])[] = [
  [20, 74, 63, 55],
  [200, 98, 44, 28],
  [500, 154, 42, 20],
  [800, 242, 107, 29],
  [1100, 255, 197, 61],
  [1500, 255, 244, 221],
  [1900, 211, 229, 255],
  [3200, 169, 203, 255],
  [5000, 143, 184, 255],
];

/** The ramp colour of a temperature as 0..1 RGB, written into `out`. */
export function heatColor(tempC: number, out: Float32Array): Float32Array {
  const ramp = HEAT_RAMP;
  let lo = ramp[0];
  let hi = ramp[0];
  let t = 0;
  if (tempC >= ramp[ramp.length - 1][0]) lo = hi = ramp[ramp.length - 1];
  else if (tempC > ramp[0][0]) {
    for (let i = 1; i < ramp.length; i++) {
      if (tempC <= ramp[i][0]) {
        lo = ramp[i - 1];
        hi = ramp[i];
        t = (tempC - lo[0]) / (hi[0] - lo[0]);
        break;
      }
    }
  }
  for (let c = 0; c < 3; c++) out[c] = (lo[c + 1] + (hi[c + 1] - lo[c + 1]) * t) / 255;
  return out;
}

/** 0 below a dull glow, rising to 1 by a bright one: how strongly a hearth's molten pool and haze show. */
export function heatGlow(tempC: number): number {
  const t = Math.min(1, Math.max(0, (tempC - 150) / 650));
  return t * t * (3 - 2 * t);
}
