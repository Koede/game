/**
 * Text and colour formatting for every reading in the UI. DOM-free: safe in node tests.
 *
 * The heat ramp here is THE colour language for temperature (thermometer fill, requirement badges,
 * the furnace window's accent). styles.css mirrors the five named stops as --hw-temp-* tokens.
 */

export type Rgb = readonly [number, number, number];

export interface HeatStop {
  readonly tempC: number;
  readonly rgb: Rgb;
}

/** Cold iron -> dull red 500 -> orange 800 -> yellow 1100 -> white 1500 -> blue-white 1900+ (deepening towards a star). */
export const HEAT_STOPS: readonly HeatStop[] = [
  { tempC: 20, rgb: [74, 63, 55] },
  { tempC: 200, rgb: [98, 44, 28] },
  { tempC: 500, rgb: [154, 42, 20] },
  { tempC: 800, rgb: [242, 107, 29] },
  { tempC: 1100, rgb: [255, 197, 61] },
  { tempC: 1500, rgb: [255, 244, 221] },
  { tempC: 1900, rgb: [211, 229, 255] },
  { tempC: 3200, rgb: [169, 203, 255] },
  { tempC: 5000, rgb: [143, 184, 255] },
];

const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
export const rgbToHex = (rgb: Rgb): string => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The ramp colour for a temperature, as an RGB triple (0..255, not rounded). */
export function heatRgb(tempC: number): Rgb {
  const first = HEAT_STOPS[0];
  const last = HEAT_STOPS[HEAT_STOPS.length - 1];
  if (!(tempC > first.tempC)) return first.rgb;
  if (tempC >= last.tempC) return last.rgb;
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const hi = HEAT_STOPS[i];
    if (tempC <= hi.tempC) {
      const lo = HEAT_STOPS[i - 1];
      return mix(lo.rgb, hi.rgb, (tempC - lo.tempC) / (hi.tempC - lo.tempC));
    }
  }
  return last.rgb;
}

/** CSS colour (#rrggbb) on the heat ramp. Use for fills and swatches, not for text. */
export const heatColor = (tempC: number): string => rgbToHex(heatRgb(tempC));

/** WCAG relative luminance (0 black .. 1 white) of an sRGB triple. */
export function luminance(rgb: Rgb): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

const TEXT_LIFT: Rgb = [255, 214, 184];
/** Luminance that gives >= 4.5:1 against the darkest panels of the UI. */
const MIN_TEXT_LUMINANCE = 0.22;

/** The heat ramp colour lifted just enough to stay readable as text on the dark panels. */
export function heatTextColor(tempC: number): string {
  const base = heatRgb(tempC);
  let out = base;
  for (let t = 0.1; luminance(out) < MIN_TEXT_LUMINANCE && t <= 1.0001; t += 0.1) out = mix(base, TEXT_LIFT, t);
  return rgbToHex(out);
}

/** A CSS linear-gradient that paints the ramp between two temperatures (used by the thermometer tube). */
export function heatGradient(minC: number, maxC: number, direction = 'to top'): string {
  const span = maxC - minC;
  if (!(span > 0)) return heatColor(minC);
  const temps = [minC, ...HEAT_STOPS.map((s) => s.tempC).filter((t) => t > minC && t < maxC), maxC];
  const stops = temps.map((t) => `${heatColor(t)} ${(((t - minC) / span) * 100).toFixed(1)}%`);
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}

const trimZeros = (text: string): string => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);

export interface UnitFormatOptions {
  /** Keep trailing zeros (1.50 kW) so a live readout does not change width. Default false (1.5 kW). */
  fixed?: boolean;
}

function formatScaled(value: number, units: readonly string[], opts?: UnitFormatOptions): string {
  if (Number.isNaN(value)) return `-- ${units[0]}`;
  if (!Number.isFinite(value)) return `${value < 0 ? '-' : ''}∞ ${units[0]}`;
  const sign = value < 0 ? '-' : '';
  let scaled = Math.abs(value);
  let unit = 0;
  for (;;) {
    while (scaled >= 1000 && unit < units.length - 1) {
      scaled /= 1000;
      unit++;
    }
    const decimals = unit === 0 ? (scaled < 10 ? 1 : 0) : scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const text = scaled.toFixed(decimals);
    // Rounding can land on 1000 (999.6 W): promote to the next unit instead of printing "1000 W".
    if (Number(text) >= 1000 && unit < units.length - 1) {
      scaled = 1000;
      continue;
    }
    const body = opts?.fixed ? text : trimZeros(text);
    return `${Number(body) === 0 ? '' : sign}${body} ${units[unit]}`;
  }
}

const WATT_UNITS = ['W', 'kW', 'MW'] as const;
const JOULE_UNITS = ['J', 'kJ', 'MJ'] as const;

/** 850 W, 1.5 kW, 12.5 kW, 300 kW, 1 MW. Three significant digits above 1 kW. */
export const formatWatts = (watts: number, opts?: UnitFormatOptions): string => formatScaled(watts, WATT_UNITS, opts);
/** 400 J, 30 kJ, 1.2 MJ, 72 MJ. */
export const formatJoules = (joules: number, opts?: UnitFormatOptions): string => formatScaled(joules, JOULE_UNITS, opts);

/** Whole degrees: "1240 °C". */
export const formatTemp = (tempC: number): string => (Number.isFinite(tempC) ? `${Math.round(tempC)} °C` : '-- °C');

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "3.4 s", "45 s", "2 m 05 s", "1 h 02 m". Negative durations read as zero. */
export function formatDuration(seconds: number): string {
  if (Number.isNaN(seconds)) return '-- s';
  if (seconds === Infinity) return '∞';
  const s = Math.max(0, seconds);
  if (s < 10) return `${trimZeros(s.toFixed(1))} s`;
  const whole = Math.round(s);
  if (whole < 60) return `${whole} s`;
  if (whole < 3600) return `${Math.floor(whole / 60)} m ${pad2(whole % 60)} s`;
  return `${Math.floor(whole / 3600)} h ${pad2(Math.floor((whole % 3600) / 60))} m`;
}

/** Item counts: 0..999 as is, then 1.2k, 12k, 3.4M. Rounds down so it never overstates what the player has. */
export function formatCount(count: number): string {
  if (!Number.isFinite(count)) return '--';
  const n = Math.max(0, Math.floor(count));
  if (n < 1000) return String(n);
  if (n < 10_000) return `${trimZeros((Math.floor(n / 100) / 10).toFixed(1))}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  if (n < 10_000_000) return `${trimZeros((Math.floor(n / 100_000) / 10).toFixed(1))}M`;
  return `${Math.floor(n / 1_000_000)}M`;
}

/** 0..1 -> "64%". */
export const formatPercent = (fraction: number): string =>
  Number.isFinite(fraction) ? `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` : '--%';

/** Splits "12.5 kW" into ["12.5", "kW"] so a figure can style number and unit separately. */
export function splitUnit(text: string): [value: string, unit: string] {
  const at = text.lastIndexOf(' ');
  return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)];
}

/** "copper_ingot" -> "Copper Ingot". A readable fallback when a caller has no display name at hand. */
export const titleFromKey = (key: string): string =>
  key
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

/** Two letters for a placeholder icon: "copper_ingot" -> "CI", "glass" -> "GL". */
export function itemInitials(key: string): string {
  const words = key.split('_').filter(Boolean);
  if (words.length === 0) return '?';
  const text = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return text.toUpperCase();
}

/** Stable hue 0..359 from a key, to tint placeholder icons apart from each other. */
export function hueFromKey(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) % 360;
}
