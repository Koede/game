/**
 * The notebook page of each legendary (docs/plans/legendary-weapons.md "Collecting"): the first time one is in the pack, a journal note
 * records its name, story, verb and utility. `legendaryPages` is the whole list as the notebook shows it: a found weapon in full, an
 * unfound one as a silhouette with the rumour about where such things are told of.
 */
import { LEGENDARIES, legendaryOf } from '../content/legendary';
import type { GameBus } from '../core/context';
import { itemOrNull } from '../core/registry';
import type { Slot } from '../core/types';
import type { Journal } from './journal';

export interface LegendaryPage {
  item: string;
  found: boolean;
  /** "Emberfang", or "???" for an unfound one. */
  title: string;
  /** The lines under the title: story, verb, utility when found; the rumour when not. */
  lines: string[];
}

export const legendaryNoteKey = (item: string): string => `legendary:${item}`;

/** Every legendary's page, in the order they are listed; `found(item)` says whether the player has found it. */
export function legendaryPages(found: (item: string) => boolean): LegendaryPage[] {
  return LEGENDARIES.map((l) => {
    const has = found(l.item);
    return has
      ? { item: l.item, found: true, title: itemOrNull(l.item)?.name ?? l.item, lines: [l.story, l.verb, l.utility] }
      : { item: l.item, found: false, title: '???', lines: [l.hint] };
  });
}

/** Writes the page of every legendary in `slots` that has none yet. Returns the names newly noted. */
export function noteLegendaries(slots: readonly Slot[], journal: Journal): string[] {
  const out: string[] = [];
  for (const s of slots) {
    const spec = legendaryOf(s?.item);
    if (!spec) continue;
    const name = itemOrNull(spec.item)?.name ?? spec.item;
    if (journal.add('note', `${name}. ${spec.story} ${spec.verb} ${spec.utility}`, legendaryNoteKey(spec.item))) out.push(name);
  }
  return out;
}

/** Keeps the notebook up to date while the pack changes (and once now, for a loaded world). Returns the stop function. */
export function watchLegendaries(bus: GameBus, slots: () => readonly Slot[], journal: Journal): () => void {
  const check = (): void => {
    for (const name of noteLegendaries(slots(), journal)) bus.emit('toast', { text: `Noted in your notebook: ${name}`, kind: 'good' });
  };
  check();
  return bus.on('inventory:changed', check);
}

/** "3 of 8 found". */
export const legendarySummary = (pages: readonly LegendaryPage[]): string => `${pages.filter((p) => p.found).length} of ${pages.length} found`;

/** Bars (1..3) a hum of `level` (0..1) shows on the HUD; 0 for no hum. */
export const humBars = (level: number): number => (level > 0 ? Math.min(3, 1 + Math.floor(level * 3)) : 0);
