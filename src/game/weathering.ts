/**
 * Weather's player-facing effects beyond the crops (docs/api/seasons.md): the toast at the turn of a season and rain
 * filling the wooden bucket you hold. DOM-free; GameState ticks it with the shared clock and WeatherState.
 */
import type { GameBus } from '../core/context';
import type { IWorld, WeatherState } from '../core/types';
import { SEASON_BLURB, dayOfSeason, seasonOf, type Season } from '../sim/seasons';
import type { PlayerState } from './playerState';
import { openSkyAbove } from './weather';

/** Seconds of steady rain, held in the open, that fill one empty bucket. */
export const RAIN_FILL_S = 20;
/** Rain must be at least this strong (0..1). */
export const RAIN_FILL_MIN = 0.3;

export interface WeatheringHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  day(): number;
  weather(): WeatherState;
}

export class Weathering {
  private season: Season | null = null;
  private rainS = 0;

  constructor(private readonly host: WeatheringHost) {}

  get currentSeason(): Season { return seasonOf(this.host.day()); }

  tick(dt: number): void {
    const { host } = this;
    const season = seasonOf(host.day());
    if (this.season === null) this.season = season;
    else if (season !== this.season) {
      this.season = season;
      host.bus.emit('toast', { text: SEASON_BLURB[season], kind: 'info' });
    }
    const w = host.weather();
    const held = host.player.heldStack();
    const p = host.player.position;
    if (held?.item === 'pail' && w.precipitation === 'rain' && w.intensity >= RAIN_FILL_MIN && openSkyAbove(host.world, p.x, p.y + 1.8, p.z)) {
      this.rainS += dt;
      if (this.rainS >= RAIN_FILL_S) {
        this.rainS = 0;
        host.player.consumeHeld(1);
        host.player.give('water_pail', 1);
        host.bus.emit('toast', { text: 'The rain has filled your bucket.', kind: 'good' });
      }
    } else this.rainS = Math.max(0, this.rainS - dt * 2);
  }

  /** "Day 3 of Autumn" for the HUD. */
  label(): string {
    const d = this.host.day();
    const s = seasonOf(d);
    return `Day ${dayOfSeason(d)} of ${s[0].toUpperCase()}${s.slice(1)}`;
  }
}
