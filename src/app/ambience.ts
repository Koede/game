/**
 * Feeds the audio engine's continuous soundscape: what is near the listener (the closest furnace and how hot
 * it is, running machines), how exposed they are (altitude, open sky), night, water, cold and the Starhearth
 * ignition. DOM-free. Entities are scanned a few times per second; the cheap per-frame values every frame.
 */
import { createAmbienceState, type AmbienceState } from '../audio/ambienceState';
import { FIRST_ELECTRIC_TIER, IGNITION_SECONDS } from '../core/constants';
import { voxelActive, type IWorld, type WeatherState } from '../core/types';
import type { GameClock } from '../game/clock';
import type { PlayerState } from '../game/playerState';
import { openSkyAbove, stormLevel } from '../game/weather';
import { isFurnace, type MachineEntity } from '../sim';

/** Seconds between entity scans. */
export const AMBIENCE_SCAN_S = 0.25;
/** Furnaces farther than this are not heard at all (the engine fades the fire out by ~21.5 blocks). */
export const FURNACE_HEARING = 24;
/** Running machines within this many blocks hum; each adds up to MACHINE_WEIGHT. */
export const MACHINE_HEARING = 14;
const MACHINE_WEIGHT = 0.35;
/** Temperature at which the fire sound is at full heat (a Plasma Furnace near its top). */
const HOTTEST_C = 3000;
/** Altitude band for the wind: calm at WIND_LOW_Y, full at WIND_HIGH_Y. */
const WIND_LOW_Y = 36;
const WIND_HIGH_Y = 80;
/** Warmth below which the wind starts to whistle. */
const COLD_FROM = 50;

const unit = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/** Loudness-ish heat of a furnace for the fire layers: 0 when cold and out, up to 1 at the hottest. */
export function furnaceHeatLevel(tempC: number, lit: boolean, ignited: boolean): number {
  if (ignited) return 1;
  const heat = Math.sqrt(unit((tempC - 20) / (HOTTEST_C - 20)));
  return lit ? Math.max(0.08, heat) : tempC >= 120 ? heat : 0;
}

export class AmbienceProbe {
  readonly state: AmbienceState = createAmbienceState();
  private scanIn = 0;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly clock: GameClock,
    /** The world's weather (rain bed, storm gusts, roof); null = always fair. */
    private readonly weather: WeatherState | null = null,
  ) {}

  /** Call every frame; returns the (reused) state to hand to AudioEngine.setAmbience. */
  update(dt: number): AmbienceState {
    const s = this.state;
    const p = this.player;
    this.scanIn -= dt;
    if (this.scanIn <= 0) {
      this.scanIn = AMBIENCE_SCAN_S;
      this.scan();
    }
    s.night = this.clock.isNight;
    s.underwater = p.headInWater;
    s.cold = p.dead ? 0 : unit((COLD_FROM - p.warmth) / COLD_FROM);
    const w = this.weather;
    if (w) {
      // Snow falls silently; a dust wind and a storm are heard as gusts.
      s.rain = w.precipitation === 'rain' ? w.intensity : 0;
      s.storm = w.precipitation === 'dust' ? w.intensity : unit(stormLevel(w));
    }
    return s;
  }

  /** Forces a scan on the next update (after teleports and loads). */
  invalidate(): void {
    this.scanIn = 0;
  }

  private scan(): void {
    const s = this.state;
    const p = this.player.position;
    const ex = p.x;
    const ey = this.player.eyeY;
    const ez = p.z;
    let best = Infinity;
    let heat = 0;
    let electric = false;
    let ignition = 0;
    let hum = 0;
    for (const e of this.world.entities()) {
      const dx = e.x + 0.5 - ex;
      const dy = e.y + 0.5 - ey;
      const dz = e.z + 0.5 - ez;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (isFurnace(e)) {
        if (d > FURNACE_HEARING) continue;
        const level = furnaceHeatLevel(e.tempC, e.lit, e.ignited);
        // The nearest furnace that makes any sound wins; a silent one closer by does not mask a roaring one.
        if (level > 0 && d < best) {
          best = d;
          heat = level;
          electric = e.tier >= FIRST_ELECTRIC_TIER && e.electric && e.deliveredW > 0;
          ignition = e.ignition === 'running' ? unit(e.ignitionProgressS / IGNITION_SECONDS) : 0;
        }
      } else if (e.kind !== 'crate' && d < MACHINE_HEARING) {
        const m = e as MachineEntity;
        if (m.on === false) continue;
        if (!voxelActive(this.world.getVoxel(e.x, e.y, e.z))) continue;
        hum += MACHINE_WEIGHT * (1 - d / MACHINE_HEARING);
      }
    }
    s.furnaceHeat = heat;
    s.furnaceDistance = best === Infinity ? FURNACE_HEARING : best;
    s.furnaceElectric = electric;
    s.ignition = ignition;
    s.machineHum = unit(hum);
    const altitude = unit((ey - WIND_LOW_Y) / (WIND_HIGH_Y - WIND_LOW_Y));
    const surface = this.world.surfaceY(Math.floor(ex), Math.floor(ez));
    // Under a roof or in a cave the wind is a distant murmur.
    const open = surface < 0 || ey >= surface + 1 ? 1 : 0.2;
    s.wind = unit((0.15 + 0.85 * altitude) * open);
    s.sheltered = !openSkyAbove(this.world, ex, ey, ez);
  }
}
