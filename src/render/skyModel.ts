/**
 * Pure sky maths: where the sun is and what colour everything is at a given time of day.
 * No three.js, no DOM - the renderer copies the result into uniforms.
 */
import { SUNSET_AT } from '../core/constants';
import { clamp, mod, smoothstep } from '../core/math';

export type Rgb = readonly [number, number, number];

export interface SkyState {
  /** Unit vector towards the sun (+X east, +Y up, +Z south). */
  sunDir: Float32Array;
  moonDir: Float32Array;
  zenith: Float32Array;
  /** Colour of the sky at the horizon; distance fog uses the same colour so terrain dissolves into it. */
  horizon: Float32Array;
  /** Extra colour added when looking towards the sun at dawn and dusk (sky and fog alike). */
  glow: Float32Array;
  sunColor: Float32Array;
  /** Tint of fully sky-lit surfaces: warm white by day, dim blue under the moon. */
  skyLight: Float32Array;
  cloud: Float32Array;
  /** 0 by day .. 1 in full night. */
  stars: number;
  /** 0 at night .. 1 in full daylight (colour blend, not gameplay light). */
  day: number;
}

export function createSkyState(): SkyState {
  return {
    sunDir: new Float32Array(3),
    moonDir: new Float32Array(3),
    zenith: new Float32Array(3),
    horizon: new Float32Array(3),
    glow: new Float32Array(3),
    sunColor: new Float32Array(3),
    skyLight: new Float32Array(3),
    cloud: new Float32Array(3),
    stars: 0,
    day: 1,
  };
}

/** The sun's path leans this far towards the south, so noon light is not straight overhead. */
const SUN_TILT = 0.42;
const COS_TILT = Math.cos(SUN_TILT);
const SIN_TILT = Math.sin(SUN_TILT);

/** Night sunlight factor of the game clock; anything at or below it is treated as full night. */
export const NIGHT_SUNLIGHT = 0.08;

const DAY_ZENITH: Rgb = [0.25, 0.47, 0.78];
const DAY_HORIZON: Rgb = [0.71, 0.81, 0.88];
const DUSK_ZENITH: Rgb = [0.2, 0.2, 0.42];
const DUSK_HORIZON: Rgb = [0.8, 0.5, 0.36];
const NIGHT_ZENITH: Rgb = [0.012, 0.018, 0.045];
const NIGHT_HORIZON: Rgb = [0.04, 0.058, 0.105];
const DUSK_GLOW: Rgb = [0.5, 0.2, 0.02];
const SUN_LOW: Rgb = [1.0, 0.5, 0.2];
const SUN_HIGH: Rgb = [1.0, 0.95, 0.8];
const DAY_LIGHT: Rgb = [1.0, 0.97, 0.92];
const DUSK_LIGHT: Rgb = [1.0, 0.8, 0.64];
const MOON_LIGHT: Rgb = [0.17, 0.22, 0.35];
const DAY_CLOUD: Rgb = [1.0, 0.99, 0.97];
const DUSK_CLOUD: Rgb = [1.0, 0.64, 0.5];
const NIGHT_CLOUD: Rgb = [0.075, 0.095, 0.155];

/**
 * Angle of the sun along its arc: 0 = rising in the east, PI/2 = noon, PI = setting in the west,
 * PI..2PI = below the world. Day and night take different shares of the clock, so the two halves run
 * at different speeds but meet seamlessly.
 */
export function sunAngle(timeOfDay: number): number {
  const t = mod(timeOfDay, 1);
  return t < SUNSET_AT ? (Math.PI * t) / SUNSET_AT : Math.PI * (1 + (t - SUNSET_AT) / (1 - SUNSET_AT));
}

/** Height of the sun: sine of its arc angle. Positive by day, negative at night, 0 at sunrise and sunset. */
export const sunHeight = (timeOfDay: number): number => Math.sin(sunAngle(timeOfDay));

function mix3(out: Float32Array, a: Rgb | Float32Array, b: Rgb | Float32Array, t: number): void {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

/**
 * Fills `out` for a time of day (0 = sunrise, SUNSET_AT = sunset) and the clock's sunlight factor
 * (1 by day, NIGHT_SUNLIGHT at night). Allocation-free.
 */
export function computeSky(timeOfDay: number, sunlight: number, out: SkyState): SkyState {
  const angle = sunAngle(timeOfDay);
  const h = Math.sin(angle);
  const c = Math.cos(angle);
  out.sunDir[0] = c;
  out.sunDir[1] = h * COS_TILT;
  out.sunDir[2] = h * SIN_TILT;
  out.moonDir[0] = -out.sunDir[0];
  out.moonDir[1] = -out.sunDir[1];
  out.moonDir[2] = -out.sunDir[2];

  const day = smoothstep(-0.14, 0.3, h);
  const dusk = 1 - smoothstep(0, 0.42, Math.abs(h));
  out.day = day;
  out.stars = 1 - smoothstep(-0.3, 0.02, h);

  mix3(out.zenith, NIGHT_ZENITH, DAY_ZENITH, day);
  mix3(out.zenith, out.zenith, DUSK_ZENITH, dusk * 0.55);
  mix3(out.horizon, NIGHT_HORIZON, DAY_HORIZON, day);
  mix3(out.horizon, out.horizon, DUSK_HORIZON, dusk * 0.7);
  out.glow[0] = DUSK_GLOW[0] * dusk;
  out.glow[1] = DUSK_GLOW[1] * dusk;
  out.glow[2] = DUSK_GLOW[2] * dusk;
  mix3(out.sunColor, SUN_LOW, SUN_HIGH, smoothstep(0, 0.45, h));

  const lit = smoothstep(0, 1, clamp((sunlight - NIGHT_SUNLIGHT) / (1 - NIGHT_SUNLIGHT), 0, 1));
  mix3(out.skyLight, DAY_LIGHT, DUSK_LIGHT, dusk);
  mix3(out.skyLight, MOON_LIGHT, out.skyLight, lit);

  mix3(out.cloud, NIGHT_CLOUD, DAY_CLOUD, day);
  mix3(out.cloud, out.cloud, DUSK_CLOUD, dusk * day * 0.8);
  return out;
}

/** Perceived brightness of a colour, for tests and tuning. */
export const luminance = (c: ArrayLike<number>): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
