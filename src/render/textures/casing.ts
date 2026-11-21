/**
 * The shared machine casing: dark riveted iron. Every machine front is drawn on the same plate with a cyan
 * power pip in the bottom-right corner that lights while the machine runs.
 */
import type { Canvas, PainterSet } from './canvas';
import { bevel, rivet, tone } from './brush';
import * as P from './palette';

/** Casing iron: a step lighter than raw IRON so machines still read as metal on a shaded side. */
export const CASE_IRON: P.Ramp = [P.rgb(0x24242c), P.rgb(0x33333c), P.rgb(0x42434d), P.rgb(0x565862), P.rgb(0x787a86)];
const I = CASE_IRON;

/** The bare plate of a machine face: soft tonal variation, a bevelled border and four corner rivets. */
export function plate(c: Canvas): void {
  const f = c.noise(4, 4, 1);
  c.each((x, y) => tone([I[1], I[2], I[2], I[3]], 0.2 + f(x, y) * 0.6));
  c.frame(0, 0, 16, 16, I[0]);
  bevel(c, 1, 1, 14, 14, I[4], I[1]);
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) rivet(c, x, y, I[4], I[0]);
}

/** A recessed rectangle: dark top/left lip, light bottom/right lip, filled with `fill`. */
export function well(c: Canvas, x: number, y: number, w: number, h: number, fill = P.SOOT): void {
  c.rect(x, y, w, h, fill);
  c.rect(x, y, w, 1, I[0]);
  c.rect(x, y, 1, h, I[0]);
  c.rect(x, y + h, w + 1, 1, I[4]);
  c.rect(x + w, y, 1, h + 1, I[4]);
}

/** The power pip in its housing: dark teal when idle, bright cyan while running. */
export function pip(c: Canvas, lit: boolean): void {
  c.rect(11, 12, 4, 3, I[0]);
  c.rect(12, 13, 2, 1, lit ? P.CYAN : P.CYAN_OFF);
  c.rect(12, 12, 2, 1, lit ? P.CYAN_GLOW : I[1]);
}

/** Registers `<name>_front` and `<name>_front_on` for a machine whose face is drawn by `draw`. */
export function front(name: string, draw: (c: Canvas, lit: boolean) => void, withPip = true): PainterSet {
  const paint = (c: Canvas, lit: boolean): void => {
    plate(c);
    draw(c, lit);
    if (withPip) pip(c, lit);
  };
  return { [`${name}_front`]: (c) => paint(c, false), [`${name}_front_on`]: (c) => paint(c, true) };
}

function machineSide(c: Canvas): void {
  plate(c);
  // A louvred vent: short slats, each a dark slot over a lit lip.
  for (let y = 4; y <= 10; y += 2) {
    c.rect(4, y, 8, 1, P.SOOT);
    c.rect(4, y + 1, 8, 1, I[3]);
  }
  c.rect(7, 13, 2, 1, I[1]);
}

function machineTop(c: Canvas): void {
  plate(c);
  // A bolted round hatch.
  c.each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 3.3) return tone([I[2], I[3]], (16 - x - y) / 16);
    if (d < 4.4) return y + x < 15 ? I[0] : I[4];
    return null;
  });
  for (const [x, y] of [[7, 2], [7, 13], [2, 7], [13, 7]]) c.set(x, y, I[4]);
  // Its lifting handle.
  c.rect(6, 7, 4, 1, P.IRON_METAL[2]);
  c.rect(6, 8, 4, 1, I[0]);
}

export const CASING: PainterSet = {
  machine_side: machineSide,
  machine_top: machineTop,
};
