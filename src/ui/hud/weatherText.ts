/**
 * DOM-free words and shapes for the weather on the HUD and in the Hearth Log (spec 15): which glyph the day/night
 * dial shows, the moon's lit shape as an SVG path, and the hearth keeper's forecast line.
 */
import type { WeatherKind, WeatherState } from '../../core/types';

export type WeatherGlyph = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'dust';

/** What the dial shows: the sky's state (the one it is turning into, past half way), dressed by what falls here. */
export function weatherGlyph(w: WeatherState): WeatherGlyph {
  const kind = w.blend >= 0.5 ? w.kind : w.previous;
  if (w.precipitation === 'snow' && w.intensity > 0.05) return 'snow';
  if (w.precipitation === 'dust' && w.intensity > 0.05) return 'dust';
  return kind;
}

const GLYPH_WORDS: Record<WeatherGlyph, string> = {
  clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', snow: 'Snow', dust: 'Dust wind',
};

export const weatherWord = (g: WeatherGlyph): string => GLYPH_WORDS[g];

const MOON_NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

/** Name of a moon phase 0..7. */
export const moonName = (phase: number): string => MOON_NAMES[((Math.round(phase) % 8) + 8) % 8];

const f1 = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * SVG path of the lit part of the moon at phase 0..7 in a circle of radius r at (cx, cy): a crescent or gibbous
 * shape between one half of the rim and the terminator ellipse. Waxing moons are lit on the right. Empty at new moon.
 */
export function moonPath(phase: number, cx: number, cy: number, r: number): string {
  const p = ((Math.round(phase) % 8) + 8) % 8;
  if (p === 0) return '';
  const k = Math.cos((2 * Math.PI * p) / 8);
  const rx = Math.abs(k) * r;
  const waxing = p < 4;
  // Rim: top -> lit side -> bottom. Terminator: bottom -> top, bulging to the lit side for a crescent.
  const rim = waxing ? 1 : 0;
  const crescent = k > 0;
  const term = waxing === crescent ? 0 : 1;
  const top = `${f1(cx)} ${f1(cy - r)}`;
  const bottom = `${f1(cx)} ${f1(cy + r)}`;
  return `M${top}A${f1(r)} ${f1(r)} 0 0 ${rim} ${bottom}A${f1(rx)} ${f1(r)} 0 0 ${term} ${top}Z`;
}

const WET = (k: WeatherKind): boolean => k === 'rain' || k === 'storm';

/** Rough minutes for the forecast: "about 4 min", "a minute or so". */
function minutes(s: number): string {
  const m = Math.round(s / 60);
  return m <= 1 ? 'a minute or so' : `about ${m} min`;
}

/**
 * The hearth keeper reads the sky: one line about what comes next ("Rain within the hour" when the next state is
 * rain or a storm, spec 15) and a second, smaller one with roughly when.
 */
export function forecast(w: WeatherState): { line: string; when: string } {
  const now = w.blend >= 0.5 ? w.kind : w.previous;
  const next = w.next;
  const when = `Change in ${minutes(w.nextInS)}`;
  if (WET(next) && !WET(now)) return { line: next === 'storm' ? 'Rain within the hour - a storm is brewing' : 'Rain within the hour', when };
  if (next === 'storm') return { line: 'The rain will grow into a storm', when };
  if (WET(now) && next === 'rain') return { line: 'The storm will ease to steady rain', when };
  if (WET(now)) return { line: next === 'clear' ? 'Clearing within the hour' : 'The rain will stop within the hour', when };
  if (next === 'cloudy') return { line: 'Clouds gathering - but no rain yet', when };
  return { line: 'Clear skies ahead', when };
}
