/** The HUD chips of the six drink buffs (BREWING_PLAN 7, 11.1), DOM-free: which glyph, label and title each shows. */
import { DRINK_BUFFS, DRINK_BUFF_KEYS } from '../../core/brewing';
import type { DrinkBuff, DrinkFamily } from '../../core/types';
import type { GlyphName } from '../kit/icons';
import { clockTime } from '../screens/food';

/** One glyph per buff, none of them the flame (Well-Warmed) or the bowl (Well-Fed), so a phone chip reads by shape. */
export const DRINK_GLYPHS: Readonly<Record<DrinkBuff, GlyphName>> = {
  spring: 'up',
  hearthkept: 'home',
  mending: 'heart',
  swift: 'bolt',
  vigor: 'pick',
  lasting: 'hourglass',
};

export interface DrinkChip {
  buff: DrinkBuff;
  family: DrinkFamily;
  glyph: GlyphName;
  /** "Swift". */
  name: string;
  /** "2:41". */
  time: string;
  /** "Swift: Walk, sprint and swim 20% faster". */
  title: string;
}

/** What the HUD needs from the player's buffs (src/game's Buffs fits). */
export interface DrinkTimers {
  timeLeftS(buff: DrinkBuff): number;
}

/** The running drink buffs, teas before coffees, as chips. */
export function drinkChips(buffs: DrinkTimers): DrinkChip[] {
  const out: DrinkChip[] = [];
  for (const buff of DRINK_BUFF_KEYS) {
    const left = buffs.timeLeftS(buff);
    if (!(left > 0)) continue;
    const text = DRINK_BUFFS[buff];
    out.push({ buff, family: text.family, glyph: DRINK_GLYPHS[buff], name: text.name, time: clockTime(left), title: `${text.name}: ${text.effect}` });
  }
  return out;
}

/**
 * How the chip row is drawn for `shown` chips: full (glyph, name and time) alone, compact (glyph and time, the name
 * in the title) from two, and tight (the time only under the glyph's colour, smaller gaps) from four.
 */
export type ChipDensity = 'full' | 'compact' | 'tight';
export const chipDensity = (shown: number): ChipDensity => (shown >= 4 ? 'tight' : shown >= 2 ? 'compact' : 'full');
