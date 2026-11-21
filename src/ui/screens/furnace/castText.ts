/**
 * Casting on a crucible row of the SMELT tab, as plain data: the molten countdown, the "Pour into a mould" choices
 * and the sentence that explains what to do. DOM-free (docs/api/casting.md).
 */
import { MOLTEN_WINDOW_S } from '../../../core/constants';
import { itemOrNull } from '../../../core/registry';
import type { Slot } from '../../../core/types';
import { ALLOY_POT, POT_COPPER_MAX, POT_TIN_MAX, pourOptions, type CrucibleView } from '../../../sim';

export interface PourChoice {
  /** What `pourCrucible` is called with: a mould key, or the ingot that goes into the alloy pot. */
  key: string;
  label: string;
  sub: string;
  enabled: boolean;
}

export interface CastView {
  /** Metal is molten in this crucible (the row glows and counts down). */
  molten: boolean;
  /** The row shows the pour block at all (molten metal, or an alloy pot to fill). */
  show: boolean;
  meterLabel: string;
  meterText: string;
  /** Seconds left of the window and the window's length (for the draining bar). */
  left: number;
  window: number;
  choices: PourChoice[];
  /** One sentence under the buttons: what to do next. */
  hint: string;
}

const name = (key: string): string => itemOrNull(key)?.name ?? key;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A stable text of what the buttons are, so the row rebuilds them only when it changes. */
export const choicesKey = (choices: readonly PourChoice[]): string =>
  choices.map((c) => `${c.key}|${c.label}|${c.sub}|${c.enabled ? 1 : 0}`).join(';');

export function castView(c: CrucibleView, pack: readonly Slot[]): CastView {
  const idle: CastView = { molten: false, show: false, meterLabel: '', meterText: '', left: 0, window: MOLTEN_WINDOW_S, choices: [], hint: '' };
  if (c.locked) return idle;
  if (c.melt && c.moltenS > 0) {
    const metal = name(c.melt.item);
    const choices = pourOptions(c.melt, c.moltenS, pack).map((o): PourChoice => ({
      key: o.mould,
      label: `Pour into ${o.name}`,
      sub: o.casts > 0 ? `${o.casts} x ${name(o.makes)}` : `Needs ${o.units} molten - there is ${c.melt?.count ?? 0}`,
      enabled: o.casts > 0,
    }));
    return {
      molten: true, show: true, meterLabel: `Molten ${metal} x${c.melt.count}`, meterText: `${Math.ceil(c.moltenS)} s`, left: c.moltenS,
      window: MOLTEN_WINDOW_S, choices,
      hint: choices.length > 0
        ? 'Pour before it cools: unpoured metal turns into a bloom you must smelt again.'
        : 'No fired mould in your pack takes this. Fire one in a crucible, or it cools into a bloom.',
    };
  }
  if (c.mix) {
    const have = (item: string): number => pack.reduce((n, s) => (s && s.item === item ? n + s.count : n), 0);
    const [cu, sn] = c.mix;
    const add = (key: string, word: string, held: number, cap: number): PourChoice => ({
      key, label: `Add ${word}`, sub: held > 0 ? `${plural(held, 'ingot')} in your pack` : 'None in your pack', enabled: held > 0 && cap > 0,
    });
    return {
      ...idle, show: true, meterLabel: ALLOY_POT === c.input?.item ? 'Alloy pot' : '', meterText: `${cu}/3 copper, ${sn}/1 tin`,
      choices: [add('copper_ingot', 'copper', have('copper_ingot'), POT_COPPER_MAX - cu), add('tin_ingot', 'tin', have('tin_ingot'), POT_TIN_MAX - sn)],
      hint: 'Pour three copper and one tin ingot in: at 800 C they melt into four bronze.',
    };
  }
  return idle;
}
