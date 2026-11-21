/**
 * The renderer's view of the weather (spec 15), as plain numbers per frame: what the sky does (cover, daylight,
 * the moon, haze, lightning), what falls around the camera, how wet the ground looks (it soaks in rain and dries
 * slowly after), and the lightning flash and bolt. DOM-free and three.js-free so it is unit tested.
 */
import { LIGHTNING_MAX_DIST, WEATHER_CLOUD_COVER, WEATHER_DAYLIGHT, WET_MIN_INTENSITY } from '../core/constants';
import { clamp } from '../core/math';
import type { Precipitation, WeatherState } from '../core/types';
import { moonIllumination, nightLight, weatherValue } from '../core/weather';
import { stormLevel } from '../game/weather';
import type { SkyWeather } from './skyModel';

/** Seconds for the ground to look fully soaked in a downpour, and to dry out completely afterwards. */
export const WET_IN_S = 12;
export const WET_OUT_S = 90;
/** A flash lasts this long (two strobes), and the bolt shows for the first BOLT_S of it. */
export const FLASH_S = 0.9;
export const BOLT_S = 0.32;

/** Brightness 0..1 of a lightning flash `age` seconds after it struck: a hard strike and a second, weaker strobe. */
export function flashEnvelope(age: number): number {
  if (age < 0 || age >= FLASH_S) return 0;
  const first = age < 0.03 ? age / 0.03 : Math.exp(-(age - 0.03) * 14);
  const second = age > 0.17 ? 0.65 * Math.exp(-(age - 0.17) * 8) * Math.min(1, (age - 0.17) / 0.03) : 0;
  return Math.min(1, first + second);
}

export class WeatherFx {
  readonly sky: SkyWeather = { cover: WEATHER_CLOUD_COVER.clear, daylight: 1, moon: 1, storm: 0, dust: 0, snow: 0, flash: 0 };
  /** Tonight's moon phase 0..7 and the night's sunlight level it gives. */
  moonPhase = 4;
  nightLevel = nightLight(4);
  /** What falls around the camera and how much (0..1). */
  precipitation: Precipitation = 'none';
  amount = 0;
  /** How soaked sky-exposed surfaces look, 0..1. */
  wet = 0;
  /** Direction the wind blows towards (radians in the x/z plane), wandering slowly. */
  windAngle = 0.7;
  /** Unit vector towards the last flash, and the bolt: bearing, alpha, seed, closeness 0..1. */
  readonly flashDir = new Float32Array([0, 0, -1]);
  readonly bolt = new Float32Array(4);
  private flashAge = Infinity;
  private flashPeak = 0;
  private bolts = 0;
  private time = 0;

  /** A storm flashed `distance` blocks away towards `bearing` (the 'weather:lightning' event). */
  lightning(distance: number, bearing: number): void {
    this.flashAge = 0;
    const near = 1 - clamp(distance / LIGHTNING_MAX_DIST, 0, 1);
    this.flashPeak = 0.35 + 0.65 * near;
    this.flashDir[0] = -Math.sin(bearing) * 0.9;
    this.flashDir[1] = 0.44;
    this.flashDir[2] = -Math.cos(bearing) * 0.9;
    const b = this.bolt;
    b[0] = bearing;
    b[2] = (this.bolts = (this.bolts + 1) % 997) * 0.731;
    b[3] = near;
  }

  update(dt: number, w: WeatherState | null): void {
    this.time += dt;
    const s = this.sky;
    if (!w) {
      s.cover = WEATHER_CLOUD_COVER.clear;
      s.daylight = 1;
      s.storm = s.dust = s.snow = 0;
      this.precipitation = 'none';
      this.amount = 0;
    } else {
      s.cover = w.cloudCover;
      s.daylight = weatherValue(WEATHER_DAYLIGHT, w);
      s.storm = stormLevel(w);
      this.moonPhase = w.moonPhase;
      this.nightLevel = nightLight(w.moonPhase);
      this.precipitation = w.precipitation;
      this.amount = w.intensity;
      s.dust = w.precipitation === 'dust' ? w.intensity : 0;
      s.snow = w.precipitation === 'snow' ? w.intensity : 0;
    }
    s.moon = moonIllumination(this.moonPhase);

    const soaking = this.precipitation === 'rain' && this.amount >= WET_MIN_INTENSITY ? 0.35 + 0.65 * this.amount : 0;
    this.wet = soaking > this.wet ? Math.min(soaking, this.wet + dt / WET_IN_S) : Math.max(soaking, this.wet - dt / WET_OUT_S);
    this.windAngle = 0.7 + 0.6 * Math.sin(this.time / 180);

    this.flashAge += dt;
    s.flash = flashEnvelope(this.flashAge) * this.flashPeak;
    this.bolt[1] = this.flashAge < BOLT_S ? (this.flashAge < 0.06 || (this.flashAge > 0.16 && this.flashAge < 0.24) ? 1 : 0.45) : 0;
  }
}
