/**
 * Research entries (docs/OVERHAUL_PLAN.md B.6). Each entry opens when every `requires` entry is done; it is finished by
 * solving its board. `unlocks` names recipe ids (see gates.ts) and plain flags. Ages by NAME (ageMap.ts).
 */
import type { Aspect } from './aspects';
import { cellAt, type BoardSpec } from './board';
import type { AgeName } from './ageMap';

export interface ResearchEntry {
  key: string;
  title: string;
  text: string;
  age: AgeName;
  requires: readonly string[];
  /** null = done on the first scan (the opening note). */
  board: BoardSpec | null;
  unlocks: { recipes?: readonly string[]; flags?: readonly string[] };
}

const pair = (a: Aspect, b: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 2), aspect: a }, { cell: cellAt(4, 2), aspect: b }],
  blocked,
});
const triple = (a: Aspect, b: Aspect, c: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 0), aspect: a }, { cell: cellAt(4, 0), aspect: b }, { cell: cellAt(2, 4), aspect: c }],
  blocked,
});

export const RESEARCH: readonly ResearchEntry[] = [
  {
    key: 'field_notes', title: 'Field Notes', age: 'ember', requires: [], board: null, unlocks: {},
    text: 'Everything has a nature. Aim the notebook at a thing and press Use to note what it is made of. Each new thing teaches you a little lore.',
  },
  {
    key: 'glassware', title: 'Vessels of Essence', age: 'ember', requires: ['field_notes'], board: pair('clarity', 'craft'),
    unlocks: { recipes: ['glass_vial'] },
    text: 'Clear glass holds what it is shown. Link Clarity to Craft and you will know how to blow a vial that keeps essentia.',
  },
  {
    key: 'gathering_rod', title: 'The Gathering Rod', age: 'ember', requires: ['glassware'], board: pair('mind', 'spring', [cellAt(2, 2)]),
    unlocks: { recipes: ['vis_rod'] },
    text: 'The land breathes out its nature. A rod with a vial at its tip, held still, drinks it in. Link Mind to Spring.',
  },
  {
    key: 'essence_jar', title: 'A Jar to Keep It', age: 'ember', requires: ['glassware'], board: pair('clarity', 'ward'),
    unlocks: { recipes: ['essentia_jar'] },
    text: 'A sealed jar holds eight vials of one aspect and shows how full it is. Link Clarity to Ward.',
  },
  {
    key: 'still_trace', title: 'Essence in the Still', age: 'ember', requires: ['gathering_rod'], board: triple('steam', 'mind', 'clarity'),
    unlocks: { flags: ['still_trace'] },
    text: 'A vial poured into a still bends the brew. Clarity draws the water out; other aspects colour what rises. Link Steam, Mind and Clarity.',
  },
  {
    key: 'warm_hearth', title: 'Cinder for the Hearth', age: 'ember', requires: ['gathering_rod'], board: pair('cinder', 'craft', [cellAt(1, 2), cellAt(3, 2)]),
    unlocks: { flags: ['hearth_cinder'] },
    text: 'A vial of Cinder tipped into a furnace fire makes the fuel last longer. Link Cinder to Craft around the stones.',
  },
  {
    key: 'aura_reading', title: 'Reading the Air', age: 'bronze', requires: ['gathering_rod'], board: pair('gale', 'loam'),
    unlocks: { flags: ['aura_reading'] },
    text: 'Gale and Loam share nothing; something between them must. Find it, and the rod will tell you how rich the land is here.',
  },
];

const BY_KEY = new Map(RESEARCH.map((e) => [e.key, e]));
export const researchEntry = (key: string): ResearchEntry | null => BY_KEY.get(key) ?? null;
