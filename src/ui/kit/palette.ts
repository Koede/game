/**
 * Colour-blind-safe palettes for anything drawn as a colour ramp: the heat and power grid overlays, status colours.
 * DOM-free. Settings.colorMode picks the set ('off' = the game's own colours); every overlay asks for its ramp here
 * instead of hard-coding one, so a new overlay is colour-blind-safe the moment it uses `rampFor` / `sampleRamp`.
 *
 *  - red-green (protanopia, deuteranopia): never relies on red versus green. Heat runs dark purple - orange - pale
 *    yellow (the perceptual inferno ramp), power dark blue - cyan - white. Status: blue / yellow / orange (Okabe-Ito).
 *  - blue-yellow (tritanopia): never relies on blue versus green or yellow versus violet. Heat runs near-black red -
 *    red - pink - white, power dark teal - mint - white. Status: teal / pink / red.
 *
 * Every ramp rises steadily in lightness, so it still reads in greyscale and for low-vision players: "more" is
 * always "brighter", whatever the hue.
 */
import type { ColorMode } from '../../core/context';
import type { Rgb } from './format';

export type RampKind = 'heat' | 'power';
/** A ramp: colour stops evenly spaced from 0 (cold, empty) to 1 (hot, full). */
export type Ramp = readonly Rgb[];

const hex = (c: string): Rgb => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const ramp = (...stops: string[]): Ramp => stops.map(hex);

export const RAMPS: Readonly<Record<ColorMode, Readonly<Record<RampKind, Ramp>>>> = {
  off: {
    heat: ramp('#2c1a14', '#9a2a14', '#f26b1d', '#ffc53d', '#fff4dd'),
    power: ramp('#0d262e', '#1d7f95', '#5fd0e8', '#a4eeff'),
  },
  'red-green': {
    heat: ramp('#1b0c3a', '#6a176e', '#c73e4c', '#f98e09', '#fcffa4'),
    power: ramp('#0a1f4d', '#0b5fa8', '#3fb8e0', '#e6fbff'),
  },
  'blue-yellow': {
    heat: ramp('#1a0507', '#8f1022', '#e8344f', '#ff9fb0', '#fff5f7'),
    power: ramp('#06201f', '#0e6b66', '#4fd0b6', '#eafff8'),
  },
};

/** The status colours (good / warning / bad) and the health and food bars per mode; styles.css carries the same values. */
export const STATUS_COLORS: Readonly<Record<Exclude<ColorMode, 'off'>, { good: string; warn: string; bad: string }>> = {
  'red-green': { good: '#56b4e9', warn: '#f0e442', bad: '#e8702a' },
  'blue-yellow': { good: '#4fd0b6', warn: '#ff9fb0', bad: '#e8344f' },
};

export const rampFor = (mode: ColorMode | undefined, kind: RampKind): Ramp => RAMPS[mode ?? 'off'][kind];

/** The colour at t (0..1, clamped) along a ramp, linearly mixed between its stops. */
export function sampleRamp(stops: Ramp, t: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  out[0] = Math.round(a[0] + (b[0] - a[0]) * f);
  out[1] = Math.round(a[1] + (b[1] - a[1]) * f);
  out[2] = Math.round(a[2] + (b[2] - a[2]) * f);
  return out;
}

/** The ramp as a CSS gradient (legends, bars). */
export const rampGradient = (stops: Ramp, direction = 'to right'): string =>
  `linear-gradient(${direction}, ${stops.map((c, i) => `rgb(${c[0]} ${c[1]} ${c[2]}) ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})`;
