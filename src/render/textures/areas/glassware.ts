/**
 * Glassware materials (src/content/areas/glassware.ts), drawn to read well on the small boxes of the glass models: clear glass is
 * a faint cool tint with a soft highlight streak and a darker refracting edge (no frame, no speckle), and brass is a warm
 * polished ramp with fine brushed lines (no rivets).
 */
import type { Canvas, PainterSet } from '../canvas';
import * as P from '../palette';
import { mix, shade } from '../palette';

const TINT = P.rgb(0xd8eef2);
const EDGE = P.rgb(0x7fb4c4);
const SHINE = P.rgb(0xffffff);
const SKY = P.rgb(0xe4f6ff);

function glass(c: Canvas): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Faint tint, a little stronger towards the edges, as thick glass looks at a glance.
      const edge = Math.min(x, 15 - x, y, 15 - y);
      const a = edge === 0 ? 120 : edge === 1 ? 70 : 34;
      const ripple = c.hash(x >> 1, y >> 2, 3) * 0.06;
      c.set(x, y, edge === 0 ? EDGE : mix(TINT, EDGE, (edge === 1 ? 0.3 : 0.06) + ripple), a);
    }
  }
  // A soft vertical highlight and a thinner second one.
  for (let y = 1; y < 15; y++) {
    c.set(3, y, SHINE, 150);
    c.set(4, y, SHINE, 90);
    c.set(11, y, SHINE, 60);
  }
  // The sky: a pale reflection that catches the light across the top of each piece, and one thin column down its middle
  // (the glass catches the environment rather than sitting flat).
  for (let x = 5; x <= 10; x++) for (let y = 1; y <= 3; y++) c.set(x, y, SKY, 70);
  for (let y = 1; y < 15; y++) c.set(8, y, SKY, 40);
}

function brass(c: Canvas): void {
  const ramp = [P.rgb(0x8a5f1c), P.rgb(0xb3812c), P.rgb(0xd6a23f), P.rgb(0xeec463), P.rgb(0xfbe3a0)];
  for (let y = 0; y < 16; y++) {
    // Polished: bright towards the top, a warm band, darker towards the bottom.
    const t = y / 15;
    const base = t < 0.2 ? ramp[3] : t < 0.55 ? ramp[2] : t < 0.85 ? ramp[1] : ramp[0];
    for (let x = 0; x < 16; x++) {
      const brushed = (c.hash(x >> 2, y, 5) - 0.5) * 0.08;
      c.set(x, y, shade(base, brushed), 255);
    }
  }
  for (let x = 0; x < 16; x++) {
    c.set(x, 0, ramp[4], 255);
    c.set(x, 15, ramp[0], 255);
  }
}

export default {
  glassware_glass: glass,
  glassware_brass: brass,
} satisfies PainterSet;
