/**
 * Research entries (docs/OVERHAUL_PLAN.md B.6, docs/api/magic.md). Each entry opens when every `requires` entry is done; it
 * is finished by solving its board. `unlocks.recipes` names recipe ids of every kind (workbench, forge, the rune desk's
 * arcane rows, the altar's infusions; see gates.ts); `unlocks.flags` switch on behaviours in magic.ts. Ages by NAME.
 *
 * The tree: Ember teaches scanning, glass, the rod, jars and Cinder for the hearth; Bronze brings the land's aura, the
 * wellsprings, the rune desk, tubes, the altar and the first foci; Forge the iron rod, warding and blinking, the clay
 * servant, the void jar, alchemical steel and drawing compound aspects. The tech spine never needs any of it.
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

/** Two anchors across the middle row, optional blocked cells. */
const pair = (a: Aspect, b: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 2), aspect: a }, { cell: cellAt(4, 2), aspect: b }],
  blocked,
});
/** Two anchors in opposite corners. */
const corners = (a: Aspect, b: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 0), aspect: a }, { cell: cellAt(4, 4), aspect: b }],
  blocked,
});
const triple = (a: Aspect, b: Aspect, c: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 0), aspect: a }, { cell: cellAt(4, 0), aspect: b }, { cell: cellAt(2, 4), aspect: c }],
  blocked,
});
const quad = (a: Aspect, b: Aspect, c: Aspect, d: Aspect, blocked: number[] = []): BoardSpec => ({
  anchors: [{ cell: cellAt(0, 0), aspect: a }, { cell: cellAt(4, 0), aspect: b }, { cell: cellAt(0, 4), aspect: c }, { cell: cellAt(4, 4), aspect: d }],
  blocked,
});
/** A wall down the middle column with one gap at row `gap`. */
const wall = (gap: number): number[] => [0, 1, 2, 3, 4].filter((y) => y !== gap).map((y) => cellAt(2, y));

export const RESEARCH: readonly ResearchEntry[] = [
  // ---- Ember -------------------------------------------------------------------------------------------------------
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
    key: 'distilled_lore', title: 'Distilled Lore', age: 'ember', requires: ['glassware'], board: corners('clarity', 'mind'),
    unlocks: { flags: ['vial_study'] },
    text: 'Essentia read slowly teaches as much as the thing it came from. In the notebook, study a filled vial: it gives lore of its aspect and the vial back.',
  },
  {
    key: 'warm_hearth', title: 'Cinder for the Hearth', age: 'ember', requires: ['gathering_rod'], board: pair('cinder', 'craft', [cellAt(1, 2), cellAt(3, 2)]),
    unlocks: { flags: ['hearth_cinder'] },
    text: 'A vial of Cinder tipped into a furnace fire makes the fuel last longer. Link Cinder to Craft around the stones.',
  },
  {
    key: 'still_trace', title: 'Essence in the Still', age: 'ember', requires: ['gathering_rod'], board: triple('steam', 'mind', 'clarity'),
    unlocks: { flags: ['still_clarity'] },
    text: 'A vial poured into a still bends the brew. Clarity draws the water out of what sits in a flask. Link Steam, Mind and Clarity.',
  },
  // ---- Bronze ------------------------------------------------------------------------------------------------------
  {
    key: 'aura_reading', title: 'Reading the Air', age: 'bronze', requires: ['gathering_rod'], board: pair('gale', 'loam'),
    unlocks: { flags: ['aura_reading'] },
    text: 'Gale and Loam share nothing; something between them must. Find it, and a held rod will tell you how rich the land is here.',
  },
  {
    key: 'rune_desk', title: 'The Rune Desk', age: 'bronze', requires: ['essence_jar'], board: corners('rune', 'craft', [cellAt(1, 1), cellAt(3, 3)]),
    unlocks: { recipes: ['rune_desk'] },
    text: 'A desk scored with signs pays for its work in essentia from the jars around it and the vials you carry. Link Rune to Craft.',
  },
  {
    key: 'bronze_rod', title: 'A Bronze Rod', age: 'bronze', requires: ['rune_desk'], board: pair('vein', 'gale', wall(1)),
    unlocks: { recipes: ['bronze_rod'] },
    text: 'Bronze holds more and drinks faster. Made at the Rune Desk from the wooden rod. Link Vein to Gale past the wall.',
  },
  {
    key: 'wellsprings', title: 'Wellsprings', age: 'bronze', requires: ['aura_reading'], board: triple('brook', 'loam', 'spring', [cellAt(2, 1)]),
    unlocks: { flags: ['node_tap'] },
    text: 'Here and there the land wells up as a floating crystal. A rod held near one draws its aspect twice as fast, and it fills again.',
  },
  {
    key: 'essentia_tubes', title: 'Glass Tubes', age: 'bronze', requires: ['essence_jar', 'rune_desk'], board: pair('clarity', 'brook', wall(3)),
    unlocks: { recipes: ['essentia_tube'] },
    text: 'Tubes join jars to the desk, the altar and the furnace: anything that needs essentia draws it through them from any jar on the line.',
  },
  {
    key: 'hearth_siphon', title: 'The Hearth Siphon', age: 'bronze', requires: ['warm_hearth', 'essentia_tubes'], board: corners('cinder', 'brook', wall(2)),
    unlocks: { flags: ['hearth_siphon'] },
    text: 'A jar of Cinder touching a burning furnace, or tubed to it, feeds the fire by itself whenever it runs low.',
  },
  {
    key: 'infusion', title: 'Infusion', age: 'bronze', requires: ['rune_desk', 'essentia_tubes'], board: quad('rune', 'craft', 'clarity', 'mind'),
    unlocks: { recipes: ['infusion_altar', 'arcane_pedestal'] },
    text: 'An altar ringed by pedestals draws essentia into the thing at its heart and what lies around it, and makes them one.',
  },
  {
    key: 'focus_kindle', title: 'Kindling Focus', age: 'bronze', requires: ['bronze_rod'], board: pair('cinder', 'mind', [cellAt(1, 1), cellAt(1, 3), cellAt(3, 1), cellAt(3, 3)]),
    unlocks: { recipes: ['focus_kindle'] },
    text: 'A focus shapes the rod\'s charge. Kindling lights a furnace from a distance and sets fires going.',
  },
  {
    key: 'focus_light', title: 'Light Focus', age: 'bronze', requires: ['focus_kindle'], board: corners('glow', 'mind'),
    unlocks: { recipes: ['focus_light'] },
    text: 'Gale and Cinder together make a light that stays where you point. Each costs the rod a little charge.',
  },
  {
    key: 'scrying_lens', title: 'The Scrying Lens', age: 'bronze', requires: ['infusion'], board: triple('vein', 'mind', 'clarity', wall(4)),
    unlocks: { recipes: ['vein_lens'] },
    text: 'A lens infused with Vein and Mind: carried, every new thing you note teaches half again as much lore.',
  },
  // ---- Forge -------------------------------------------------------------------------------------------------------
  {
    key: 'iron_rod', title: 'An Iron Rod', age: 'forge', requires: ['bronze_rod'], board: corners('vein', 'ward', wall(0)),
    unlocks: { recipes: ['iron_rod'] },
    text: 'Iron is patient: the iron rod holds twice the bronze one and draws three units at a time.',
  },
  {
    key: 'focus_ward', title: 'Warding Focus', age: 'forge', requires: ['focus_kindle'], board: pair('ward', 'rune', wall(2).concat([cellAt(1, 0)])),
    unlocks: { recipes: ['focus_ward'] },
    text: 'Loam and Rift held in balance: for a short while every blow you take is softened.',
  },
  {
    key: 'focus_blink', title: 'Blinking Focus', age: 'forge', requires: ['focus_ward', 'iron_rod'], board: quad('gale', 'mind', 'drive', 'rift', [cellAt(2, 2)]),
    unlocks: { recipes: ['focus_blink'] },
    text: 'Drive the body through the air in an eye-blink: a short step to where you look.',
  },
  {
    key: 'clay_servant', title: 'The Clay Servant', age: 'forge', requires: ['infusion', 'wellsprings'], board: triple('spring', 'mind', 'craft', wall(2)),
    unlocks: { recipes: ['clay_servant'] },
    text: 'A clay figure given Spring and Mind turns a crank beside it for as long as a jar it touches feeds it.',
  },
  {
    key: 'void_jar', title: 'The Void Jar', age: 'forge', requires: ['essentia_tubes', 'infusion'], board: corners('wane', 'ward', [cellAt(1, 1), cellAt(2, 2), cellAt(3, 3)]),
    unlocks: { recipes: ['void_jar'] },
    text: 'Wane and Ward fold a jar inside itself: it holds four times as much.',
  },
  {
    key: 'alchemical_steel', title: 'Alchemical Steel', age: 'forge', requires: ['infusion'], board: triple('vein', 'cinder', 'rune'),
    unlocks: { recipes: ['steel_infusion'] },
    text: 'Iron and coal on the altar, fed Cinder and Vein, come out as steel without a blast furnace. Slow and costly, but it works.',
  },
  {
    key: 'compound_draw', title: 'Drawing the Compounds', age: 'forge', requires: ['wellsprings', 'iron_rod'], board: quad('steam', 'vein', 'glow', 'spring'),
    unlocks: { flags: ['compound_draw'] },
    text: 'A practised hand draws Vein, Glow or Steam straight from the land, not only the six primal aspects.',
  },
];

const BY_KEY = new Map(RESEARCH.map((e) => [e.key, e]));
export const researchEntry = (key: string): ResearchEntry | null => BY_KEY.get(key) ?? null;
