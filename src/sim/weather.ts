/**
 * How the weather reaches the machines (spec 15): solar panels and wind turbines scale with the sky, a furnace
 * with open sky above loses heat faster while rain or snow soaks it, and rain waters crops under open sky.
 * Everything is derived once per tick from the shared WeatherState; biomes are cached per column (they never
 * change for a seed), so the per-crop and per-furnace checks are a map lookup and two comparisons.
 */
import { FURNACE_WET_LOSS_MULT, WEATHER_SOLAR, WEATHER_WIND } from '../core/constants';
import type { BiomeKey, WeatherKind, WeatherState } from '../core/types';
import { isWet, precipitationFor, weatherValue } from '../core/weather';
import { fallingKind, skyIntensity } from '../game/weather';
import { isFurnace, type SimNode } from './entities';

export type SimBiomeLookup = (x: number, z: number) => BiomeKey;

/** Columns whose biome is remembered at most (a busy base touches a few hundred). */
const BIOME_CACHE_MAX = 4096;

export class SimWeather {
  /** Multipliers of this tick: solar output and wind turbine output. */
  solar = 1;
  wind = 1;
  private weather: WeatherState | null = null;
  private biomeAt: SimBiomeLookup | null = null;
  private readonly biomes = new Map<number, BiomeKey>();
  /** What is falling this tick and whether it is strong enough to soak anything at all. */
  private kind: WeatherKind = 'clear';
  private intensity = 0;
  private soaking = false;

  /** The weather to follow (null = always fair) and where biomes come from (null = rain everywhere it falls). */
  use(weather: WeatherState | null, biomeAt: SimBiomeLookup | null): void {
    this.weather = weather;
    this.biomeAt = biomeAt;
    this.biomes.clear();
  }

  /** Once per tick, before any machine runs. */
  update(): void {
    const w = this.weather;
    if (!w) {
      this.solar = 1;
      this.wind = 1;
      this.soaking = false;
      return;
    }
    this.solar = weatherValue(WEATHER_SOLAR, w);
    this.wind = weatherValue(WEATHER_WIND, w);
    this.kind = fallingKind(w);
    this.intensity = skyIntensity(w);
    this.soaking = isWet(precipitationFor(this.kind, 'woodland', 0), this.intensity);
  }

  /** Rain or snow strong enough to soak falls somewhere this tick (it may still be dust or nothing in a given biome). */
  get soaks(): boolean {
    return this.soaking;
  }

  /** Rain or snow soaks an exposed block at x, y, z right now (callers check the open sky themselves). */
  wetAt(x: number, y: number, z: number): boolean {
    if (!this.soaking) return false;
    return isWet(precipitationFor(this.kind, this.biome(x, z), y), this.intensity);
  }

  /** Heat-loss multiplier of a furnace node this tick: FURNACE_WET_LOSS_MULT when rain or snow falls on it. */
  furnaceLoss(node: SimNode): number {
    return this.soaking && isFurnace(node.e) && node.openSky && this.wetAt(node.e.x, node.e.y, node.e.z) ? FURNACE_WET_LOSS_MULT : 1;
  }

  private biome(x: number, z: number): BiomeKey {
    const lookup = this.biomeAt;
    if (!lookup) return 'woodland';
    const key = x * 4194304 + z;
    let b = this.biomes.get(key);
    if (b === undefined) {
      if (this.biomes.size >= BIOME_CACHE_MAX) this.biomes.clear();
      b = lookup(x, z);
      this.biomes.set(key, b);
    }
    return b;
  }
}
