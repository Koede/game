/**
 * How the year paints the landscape (docs/api/seasons.md): oak leaves and grass lean towards a seasonal colour that
 * eases from one season's middle to the next, so the turn of the year is a slow change and not a switch. Pure maths:
 * the renderer feeds the result to the chunk shader as two vec4s (target colour of unit luminance, amount 0..1);
 * summer is the unchanged baseline look. The same year drives how many leaves are loose in the air (`leafFall`).
 */
import { DAYS_PER_SEASON, SEASONS } from '../sim/seasons';

export interface Tint { r: number; g: number; b: number; a: number }
export interface SeasonTints { leaf: Tint; grass: Tint }

const KEY: ReadonlyArray<SeasonTints> = [
  // spring: fresh and bright
  { leaf: { r: 0.8, g: 1.2, b: 0.6, a: 0.3 }, grass: { r: 0.85, g: 1.2, b: 0.7, a: 0.25 } },
  // summer: the baseline texture
  { leaf: { r: 1, g: 1, b: 1, a: 0 }, grass: { r: 1, g: 1, b: 1, a: 0 } },
  // autumn: orange leaves, dry straw grass
  { leaf: { r: 1.7, g: 0.8, b: 0.25, a: 0.8 }, grass: { r: 1.3, g: 1, b: 0.5, a: 0.45 } },
  // winter: dull bare leaves, pale frosted grass
  { leaf: { r: 1.1, g: 0.95, b: 0.85, a: 0.7 }, grass: { r: 1, g: 1.1, b: 1.15, a: 0.5 } },
];

const mix = (a: Tint, b: Tint, t: number): Tint => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a + (b.a - a.a) * t });
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Position in the year, 0..4 (spring 0..1 ... winter 3..4), from a fractional 1-based clock day. */
export function yearPhase(day: number): number {
  const d = Math.max(1, day) - 1;
  return (d / DAYS_PER_SEASON) % SEASONS.length;
}

/** Tints for the (fractional) clock day. Season centres hold their own colours; between centres they ease across. */
export function seasonTints(day: number): SeasonTints {
  const p = yearPhase(day) - 0.5;
  const base = ((Math.floor(p) % 4) + 4) % 4;
  const t = smooth(p - Math.floor(p));
  const a = KEY[base];
  const b = KEY[(base + 1) % 4];
  return { leaf: mix(a.leaf, b.leaf, t), grass: mix(a.grass, b.grass, t) };
}

/** 0..1: how hard the leaves are coming down. All of autumn, tailing off over the first days of winter. */
export function leafFall(day: number): number {
  const p = yearPhase(day);
  if (p >= 2 && p < 3) return Math.min(1, (p - 2) * 3) * 1; // builds over the first third of autumn
  if (p >= 3 && p < 3.4) return 1 - (p - 3) / 0.4;
  return 0;
}
