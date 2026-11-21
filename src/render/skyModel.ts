/**
 * Pure sky maths: where the sun is and what colour everything is at a given time of day.
 * No three.js, no DOM - the renderer copies the result into uniforms.
 */
import { SUNSET_AT } from '../core/constants';
import { clamp, mod, smoothstep } from '../core/math';
import { NIGHT_SUNLIGHT } from '../game/clock';

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
  /** Cloud cover 0..1 (applyWeather): dims the sun disc, hides moon and stars, thickens the cloud layer. */
  cover: number;
  /** Storm weight 0..1: darker cloud bellies. */
  storm: number;
  /** Lightning flash 0..1 this frame. */
  flash: number;
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
    cover: 0,
    storm: 0,
    flash: 0,
  };
}

/** The sun's path leans this far towards the south, so noon light is not straight overhead. */
const SUN_TILT = 0.42;
const COS_TILT = Math.cos(SUN_TILT);
const SIN_TILT = Math.sin(SUN_TILT);

/** Night sunlight factor of the game clock; anything at or below it is treated as full night. */
export { NIGHT_SUNLIGHT };

const DAY_ZENITH: Rgb = [0.25, 0.47, 0.78];
const DAY_HORIZON: Rgb = [0.71, 0.81, 0.88];
const DUSK_ZENITH: Rgb = [0.2, 0.2, 0.42];
const DUSK_HORIZON: Rgb = [0.8, 0.5, 0.36];
const NIGHT_ZENITH: Rgb = [0.016, 0.024, 0.06];
const NIGHT_HORIZON: Rgb = [0.055, 0.08, 0.14];
const DUSK_GLOW: Rgb = [0.5, 0.2, 0.02];
const SUN_LOW: Rgb = [1.0, 0.5, 0.2];
const SUN_HIGH: Rgb = [1.0, 0.95, 0.8];
const DAY_LIGHT: Rgb = [1.0, 0.97, 0.92];
const DUSK_LIGHT: Rgb = [1.0, 0.8, 0.64];
const MOON_LIGHT: Rgb = [0.23, 0.29, 0.45];
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
export function computeSky(timeOfDay: number, sunlight: number, out: SkyState, night = NIGHT_SUNLIGHT): SkyState {
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

  // The clock's light falls to night level right at sunset; ease it so dusk keeps its warm glow a while.
  const lit = 1 - Math.pow(1 - clamp((sunlight - night) / (1 - night), 0, 1), 2.5);
  mix3(out.skyLight, DAY_LIGHT, DUSK_LIGHT, dusk);
  mix3(out.skyLight, MOON_LIGHT, out.skyLight, lit);

  mix3(out.cloud, NIGHT_CLOUD, DAY_CLOUD, day);
  mix3(out.cloud, out.cloud, DUSK_CLOUD, dusk * day * 0.8);
  out.cover = 0;
  out.storm = 0;
  out.flash = 0;
  return out;
}

/** What the weather does to the sky this frame (src/render/weatherFx.ts derives it from the WeatherState). */
export interface SkyWeather {
  /** Cloud cover 0..1. */
  cover: number;
  /** WEATHER_DAYLIGHT eased: brightness of the daytime sky and sunlit ground. */
  daylight: number;
  /** Lit fraction of tonight's moon, 0 (new) .. 1 (full). */
  moon: number;
  /** Storm weight 0..1. */
  storm: number;
  /** Haze of what falls around the camera: blown dust (sand-coloured) and snow (pale), each 0..1. */
  dust: number;
  snow: number;
  /** Lightning flash 0..1. */
  flash: number;
}

const OVERCAST_DAY: Rgb = [0.56, 0.6, 0.65];
const OVERCAST_NIGHT: Rgb = [0.03, 0.035, 0.05];
const STORM_SKY: Rgb = [0.3, 0.33, 0.38];
const DUST_HAZE: Rgb = [0.74, 0.6, 0.42];
const SNOW_HAZE: Rgb = [0.78, 0.82, 0.88];
const FLASH: Rgb = [0.75, 0.8, 1.0];
const STORM_CLOUD: Rgb = [0.36, 0.38, 0.43];

function tint(out: Float32Array, k: number): void {
  out[0] *= k;
  out[1] *= k;
  out[2] *= k;
}

function add3(out: Float32Array, c: Rgb, k: number): void {
  out[0] += c[0] * k;
  out[1] += c[1] * k;
  out[2] += c[2] * k;
}

/** Scratch colour for applyWeather (keeps it allocation-free). */
const tmp = new Float32Array(3);
const set3 = (r: number, g: number, b: number): Float32Array => {
  tmp[0] = r;
  tmp[1] = g;
  tmp[2] = b;
  return tmp;
};

/** Greys one sky colour towards the overcast tone (keeping some of its own brightness) and dims it with the daylight. */
function overcastField(field: Float32Array, day: number, grey: number, overcast: number, dimDay: number): void {
  // Keep some of the clear sky's own brightness so dusk still reads as dusk under thin cloud.
  const keep = 0.35 + 0.65 * Math.min(1, luminance(field) / 0.7);
  mix3(field, field, set3(
    (OVERCAST_NIGHT[0] + (OVERCAST_DAY[0] - OVERCAST_NIGHT[0]) * day) * keep,
    (OVERCAST_NIGHT[1] + (OVERCAST_DAY[1] - OVERCAST_NIGHT[1]) * day) * keep,
    (OVERCAST_NIGHT[2] + (OVERCAST_DAY[2] - OVERCAST_NIGHT[2]) * day) * keep,
  ), grey);
  if (overcast > 0) mix3(field, field, set3(STORM_SKY[0] * day + 0.02, STORM_SKY[1] * day + 0.022, STORM_SKY[2] * day + 0.03), overcast * 0.5);
  tint(field, dimDay);
}

/**
 * Lays the weather and the moon over a computed sky (allocation-free): cloud cover greys and darkens the dome and
 * the daylight, hides stars and the dusk glow, the moon's phase sets how bright the night is, dust and snow haze
 * the horizon, and a lightning flash lights everything for an instant.
 */
export function applyWeather(out: SkyState, w: SkyWeather): SkyState {
  const cover = clamp(w.cover, 0, 1);
  const day = out.day;
  // Overcast: past half cover the dome turns to a flat grey, darker for a storm.
  const grey = smoothstep(0.25, 1, cover) * 0.92;
  const overcast = smoothstep(0.75, 1, w.storm);
  const dimDay = 1 + (w.daylight - 1) * day;
  overcastField(out.zenith, day, grey, overcast, dimDay);
  overcastField(out.horizon, day, grey, overcast, dimDay);
  tint(out.glow, 1 - 0.85 * cover);
  // Sunlit ground dims with the daylight; moonlit ground with the moon's phase and the clouds over it. The range
  // is narrower than the gameplay night light (0.04..0.12): a new-moon night must stay readable on a phone.
  const moonLight = 0.75 + 0.5 * clamp(w.moon, 0, 1);
  tint(out.skyLight, dimDay * (1 + (moonLight * (1 - 0.3 * cover) - 1) * (1 - day)));
  out.stars *= 1 - smoothstep(0.35, 0.85, cover);
  mix3(out.cloud, out.cloud, set3(STORM_CLOUD[0] * day + 0.03, STORM_CLOUD[1] * day + 0.035, STORM_CLOUD[2] * day + 0.05), smoothstep(0.55, 1, cover) * (0.35 + 0.5 * w.storm));
  tint(out.cloud, 0.6 + 0.4 * dimDay);

  const haze = clamp(w.dust, 0, 1) * 0.75;
  if (haze > 0) {
    const k = 0.35 + 0.65 * Math.max(day, 0.15);
    mix3(out.horizon, out.horizon, set3(DUST_HAZE[0] * k, DUST_HAZE[1] * k, DUST_HAZE[2] * k), haze);
    mix3(out.zenith, out.zenith, set3(DUST_HAZE[0] * k * 0.85, DUST_HAZE[1] * k * 0.85, DUST_HAZE[2] * k * 0.85), haze * 0.6);
  }
  const snow = clamp(w.snow, 0, 1) * 0.5;
  if (snow > 0) {
    const k = 0.15 + 0.85 * day;
    mix3(out.horizon, out.horizon, set3(SNOW_HAZE[0] * k, SNOW_HAZE[1] * k, SNOW_HAZE[2] * k), snow);
  }

  const flash = clamp(w.flash, 0, 1);
  if (flash > 0) {
    add3(out.zenith, FLASH, flash * 0.3);
    add3(out.horizon, FLASH, flash * 0.35);
    add3(out.skyLight, FLASH, flash * 0.9);
    add3(out.cloud, FLASH, flash * 0.8);
  }
  out.cover = cover;
  out.storm = clamp(w.storm, 0, 1);
  out.flash = flash;
  return out;
}

/** Perceived brightness of a colour, for tests and tuning. */
export const luminance = (c: ArrayLike<number>): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
