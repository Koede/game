/**
 * How to Play: the core loop in five lines, staying alive (food, farming, animals, cold), building big (hearths,
 * pipes), working by hand, tea and coffee, the Emberbound automatons, then the controls for keyboard + mouse and for touch.
 */
import { Segmented } from '../kit/controls';
import { h } from '../kit/dom';
import { glyph, type GlyphName } from '../kit/icons';
import { SearchBox, matches } from '../kit/search';

export interface ControlLine {
  /** Key caps or gestures, shown as separate caps: ['W', 'A', 'S', 'D'] or ['Hold on a block']; '–' and '/' are separators. */
  keys: readonly string[];
  action: string;
}

export interface HowToPlayOptions {
  /** Replace the default control lists when the real bindings differ. */
  keyboard?: readonly ControlLine[];
  touch?: readonly ControlLine[];
  /** Which list to show first. Default: touch on a touch-first device, keyboard otherwise. */
  initial?: 'keyboard' | 'touch';
  /** Start with this search typed in (the pause menu's search sends you here with your words). */
  query?: string;
}

export const DEFAULT_KEYBOARD_CONTROLS: readonly ControlLine[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
  { keys: ['Mouse'], action: 'Look around' },
  { keys: ['Space'], action: 'Jump, swim up' },
  { keys: ['Shift'], action: 'Sprint' },
  { keys: ['Hold left click'], action: 'Mine the block you look at' },
  { keys: ['Right click'], action: 'Open a furnace or machine; use, place or eat the held item; one stroke at a hand station (hold to repeat)' },
  { keys: ['Shift', 'Right click'], action: 'Place the held block against a furnace or machine; with an empty hand at a hand station, take back what you loaded' },
  { keys: ['1', '–', '9', 'Wheel'], action: 'Pick a hotbar slot' },
  { keys: ['E'], action: 'Inventory and hand recipes' },
  { keys: ['L'], action: 'Hearth Log: goals and ages' },
  { keys: ['P', '/', 'B'], action: 'At the furnace: pump the bellows / show the backpack' },
  { keys: ['Shift-click'], action: 'Move a stack straight across' },
  { keys: ['Esc'], action: 'Close a window, pause' },
];

export const DEFAULT_TOUCH_CONTROLS: readonly ControlLine[] = [
  { keys: ['Left stick'], action: 'Move' },
  { keys: ['Stick to its edge'], action: 'Sprint' },
  { keys: ['Drag the view'], action: 'Look around' },
  { keys: ['Jump button'], action: 'Jump, swim up' },
  { keys: ['Hold on a block', 'Mine'], action: 'Mine it' },
  { keys: ['Tap a block', 'Use'], action: 'Open a furnace or machine; use, place or eat the held item; one stroke at a hand station (hold Use to repeat)' },
  { keys: ['Place', 'Use'], action: 'Place the held block against a furnace or machine; with an empty hand at a hand station, take back what you loaded' },
  { keys: ['Tap the hotbar'], action: 'Pick a slot' },
  { keys: ['Bag button'], action: 'Inventory and hand recipes' },
  { keys: ['Tap the goal'], action: 'Hearth Log: goals and ages' },
  { keys: ['Tap a slot', 'Tap another'], action: 'Move, merge or swap a stack' },
  { keys: ['Double-tap a slot'], action: 'Move a stack straight across' },
  { keys: ['Long-press a slot'], action: 'Take half a stack' },
  { keys: ['Pump', '/', 'Backpack'], action: 'At the furnace: pump the bellows / show the backpack' },
];

/** The loop. Steps 1-3 are about heat, 4-5 about power: the numerals are coloured to match. */
const LOOP: readonly { tone: string; text: string }[] = [
  { tone: 'var(--hw-temp-800)', text: 'Gather wood, flint, rubble and clay. A workbench builds your first furnace and anything you can make by hand - and little else.' },
  { tone: 'var(--hw-temp-1100)', text: 'The furnace is the heart. Feed the fire, pump the bellows: hotter fire, better recipes. It cooks your food too.' },
  { tone: 'var(--hw-temp-1500)', text: 'Its recipe list is your tech tree. A locked row tells you the heat or the tier it wants. The goal at the top of the screen says what to do next.' },
  { tone: 'var(--hw-power)', text: 'Heat first, then watts. Turn the fire into electricity, then build wind, sun, oil, lava and uranium.' },
  { tone: 'var(--hw-power-hi)', text: 'Upgrade the furnace four times, each inside a bigger hearth (Structure tab). The last tier is a star.' },
];

interface Tip {
  icon: GlyphName;
  text: string;
}

/** Food, farming, animals and the cold: what keeps you alive between furnace jobs. */
const LIVING: readonly Tip[] = [
  { icon: 'bowl', text: 'Food runs down as you work and faster when you sprint. Hold food and press Use to eat. Hungry, you cannot sprint; below 12 food you do not heal.' },
  { icon: 'flame', text: 'Cook at the furnace: raw meat, potatoes and dough go in a crucible (the Kitchen chip on the Smelt tab). Cooked food fills you far more.' },
  { icon: 'sun', text: 'Farm: a hoe turns grass into farmland. Plant wheat seeds, potatoes or carrots; crops need light and grow twice as fast with water within four blocks.' },
  { icon: 'heart', text: 'Animals never attack. Mine one to hunt it for meat and hide. Hold what it likes and it follows; feed two of a kind to raise young: hens take seeds, goats wheat, boars potatoes or carrots.' },
  { icon: 'bag', text: 'A bucket fills at still water. Two flour (four wheat, ground at the workbench) and a bucket of water make dough; dough bakes into bread at 220 C.' },
  { icon: 'moon', text: 'Nights, rain and frostfell snow drain warmth, and at 0 the cold hurts. Any roof keeps the rain off; a fire, a torch or your furnace warms you back up.' },
];

/** Hearths, pipes and the wrench: building the furnace big and feeding it. */
const BUILDING: readonly Tip[] = [
  { icon: 'home', text: 'Each furnace upgrade needs a hearth around it: brick, then refractory brick, plasma casing and star casing. The Structure tab shows the plan and can mark every missing block in the world.' },
  { icon: 'gear', text: 'Chutes carry items, pipes carry water, oil and steam. Use the wrench on a pipe end to cycle Push, Pull and Off; Use a pipe with an empty hand to see what it carries.' },
  { icon: 'bolt', text: 'Machines need watts: join them to generators with cable, and add batteries to cover the gaps.' },
];

/** The Ember Age stations (EMBER_PLAN 2): every one is worked by your own hands, a stroke at a time. */
export const HANDWORK: readonly Tip[] = [
  { icon: 'pick', text: 'Stations are worked by hand. Aim at one and tap Use: holding the item it takes loads it, every tap after that is one stroke, and the line under the crosshair counts them: "Hand Quern - wheat 3/6 strokes". Hold Use to keep striking.' },
  { icon: 'hourglass', text: 'When the work is done the result waits in the station: Use it with an empty hand to take it. With an empty hand, Shift + Use (or Place, then Use) takes back what you loaded.' },
  { icon: 'maul', text: 'The right tool counts double: an axe at the chopping block (a log gives six planks, not four), a hammer at the stone anvil. Metal fresh from the crucible is soft for 20 seconds and needs half the strokes.' },
  { icon: 'sun', text: 'The drying rack and the tanning trough work by themselves. The rack needs open sky and daylight, and rain sets it back.' },
  { icon: 'flame', text: 'When a smelt of copper, tin or bronze finishes the metal stays molten for 20 seconds. Hold a fired mould and Use the furnace to pour a cast; wait too long and it cools into a bloom to smelt again.' },
];

/** Tea and coffee (BREWING_PLAN): the steps from bush to cup, in the order a player does them. */
export const BREWING: readonly Tip[] = [
  { icon: 'sun', text: 'Tea grows wild in woodland and marsh, coffee near the dunes. Pick a bush for leaves or cherries, plant its cutting, and it fruits again every six minutes.' },
  { icon: 'flame', text: 'Dry tea leaves and roast coffee cherries in a crucible; grind roasted beans at the workbench. Hotter or blended makes another drink: black tea, berry tea, dark roast, trail blend.' },
  { icon: 'bag', text: 'Set a water bucket on top of a hot furnace: it boils in about 12 seconds. Use it to pick it up; boiling water cools in your pack after a minute and a half.' },
  { icon: 'cup', text: 'Place a clay cup, then Use a drip cone on it, tea or ground coffee on the cone, and the boiling bucket on the cup. It drips for 4 seconds.' },
  { icon: 'heart', text: 'Use the full cup to take it, then Use it again to drink: three minutes of Spring, Hearthkept, Mending, Swift, Vigor or Lasting. One tea and one coffee at a time; the cup and cone are reusable.' },
];

/** The Emberbound (spec 19): who they are and how to live with them. */
export const EMBERBOUND: readonly Tip[] = [
  { icon: 'automaton', text: 'Long ago this land burned bright with machines; the Old Works were their forges. Some still walk, fed by the last embers in their cores, and they wake in the dark.' },
  { icon: 'home', text: 'A hot furnace is safe ground: no automaton steps into its warmth or strikes you there. Torches and lamps keep them from appearing nearby, and at dawn those under open sky wind down.' },
  { icon: 'warn', text: 'Every attack is telegraphed: when the embers flare and the hiss rises, step out of reach. An ember arrow at the screen edge marks one winding up out of view.' },
  { icon: 'maul', text: 'Mine on an automaton to strike it. Mauls, forged from bronze, iron or steel, hit hardest. Broken apart, they drop scrap and ember cores - the hottest early fuel.' },
  { icon: 'shield', text: 'Armour works from the backpack like the padded coat: a plated coat takes a quarter off each blow, a steel cuirass two fifths.' },
  { icon: 'bolt', text: 'A powered ward beacon keeps them 32 blocks away all round your base. Rather build in peace? Choose Peaceful in Settings.' },
];

/** Entries of `keys` drawn as plain separators between caps, not as caps. */
const SEPARATORS = new Set(['–', '/']);

const touchFirst = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Every line of How to Play as plain text with the section it sits in: what the pause menu's search looks through. */
export function howToTopics(opts: HowToPlayOptions = {}): { section: string; text: string }[] {
  const out: { section: string; text: string }[] = [];
  const add = (section: string, lines: readonly string[]): void => lines.forEach((text) => out.push({ section, text }));
  add('The loop', LOOP.map((l) => l.text));
  add('Staying alive', LIVING.map((t) => t.text));
  add('Building big', BUILDING.map((t) => t.text));
  add('Working by hand', HANDWORK.map((t) => t.text));
  add('Tea and coffee', BREWING.map((t) => t.text));
  add('The Emberbound', EMBERBOUND.map((t) => t.text));
  const controls = [...(opts.keyboard ?? DEFAULT_KEYBOARD_CONTROLS), ...(opts.touch ?? DEFAULT_TOUCH_CONTROLS)];
  add('Controls', controls.map((c) => `${c.keys.join(' ')}: ${c.action}`));
  return out;
}

export class HowToPlay {
  readonly el: HTMLDivElement;
  /** Everything a search can hide: each line with its text, each section with its lines. */
  private readonly lines: { el: HTMLElement[]; text: string; section: HTMLElement }[] = [];
  private readonly sections: HTMLElement[] = [];
  private readonly empty: HTMLElement;

  constructor(opts: HowToPlayOptions = {}) {
    const lists = {
      keyboard: this.controlList(opts.keyboard ?? DEFAULT_KEYBOARD_CONTROLS),
      touch: this.controlList(opts.touch ?? DEFAULT_TOUCH_CONTROLS),
    };
    const show = (which: 'keyboard' | 'touch'): void => {
      lists.keyboard.hidden = which !== 'keyboard';
      lists.touch.hidden = which !== 'touch';
    };
    const initial = opts.initial ?? (touchFirst() ? 'touch' : 'keyboard');
    const picker = new Segmented<'keyboard' | 'touch'>({
      label: 'Control scheme',
      options: [
        { value: 'keyboard', label: 'Keyboard + mouse' },
        { value: 'touch', label: 'Touch' },
      ],
      value: initial,
      onChange: show,
    });
    show(initial);
    this.empty = h('p', { class: 'hw-howto__none', text: 'Nothing here matches. Try one word, like "water" or "furnace".' });
    this.empty.hidden = true;
    const search = new SearchBox({ label: 'Search How to Play', placeholder: 'Search the guide', value: opts.query, onInput: (q) => this.filter(q) });
    this.el = h(
      'div',
      { class: 'hw-howto' },
      search.el,
      this.empty,
      this.loop(),
      this.tips('Staying alive', 'var(--hw-food)', LIVING),
      this.tips('Building big', 'var(--hw-power)', BUILDING),
      this.tips('Working by hand', '#c98a4b', HANDWORK),
      this.tips('Tea and coffee', '#d39a62', BREWING),
      this.tips('The Emberbound', '#ff7a2a', EMBERBOUND),
      this.track(h('section', { class: 'hw-howto__controls' }, h('div', { class: 'hw-howto__bar' }, h('h3', { class: 'hw-heading', text: 'Controls' }), picker.el), lists.keyboard, lists.touch)),
    );
    for (const dl of [lists.keyboard, lists.touch]) {
      const section = dl.parentElement as HTMLElement;
      const kids = [...dl.children] as HTMLElement[];
      for (let i = 0; i + 1 < kids.length; i += 2) this.lines.push({ el: [kids[i], kids[i + 1]], text: `${kids[i].textContent} ${kids[i + 1].textContent}`, section });
    }
    if (opts.query) this.filter(opts.query);
    this.searchBox = search;
  }

  private searchBox: SearchBox | null = null;

  /** Puts a query in the search field and applies it. */
  search(query: string): void {
    this.searchBox?.set(query);
    this.filter(query);
  }

  private track(section: HTMLElement): HTMLElement {
    this.sections.push(section);
    return section;
  }

  /** Hides every line that does not match and every section left with no line; shows a note when nothing is left. */
  private filter(query: string): void {
    let any = false;
    for (const l of this.lines) {
      const show = matches(query, l.text);
      l.el.forEach((e) => (e.hidden = !show));
      any ||= show;
    }
    for (const sec of this.sections) sec.hidden = !this.lines.some((l) => l.section === sec && !l.el[0].hidden) && query.trim() !== '';
    this.empty.hidden = any || query.trim() === '';
  }

  private loop(): HTMLElement {
    const items = LOOP.map((step, i) =>
      h('li', { class: 'hw-howto__step', style: { '--hw-step': step.tone } }, h('span', { class: 'hw-howto__num hw-num', text: String(i + 1) }), h('span', { text: step.text })),
    );
    const section = this.track(h('section', { class: 'hw-howto__loop' }, h('h3', { class: 'hw-heading', text: 'The loop' }), h('ol', { class: 'hw-howto__steps' }, items)));
    items.forEach((li, i) => this.lines.push({ el: [li], text: `The loop ${LOOP[i].text}`, section }));
    return section;
  }

  private tips(title: string, tone: string, tips: readonly Tip[]): HTMLElement {
    const items = tips.map((tip) => h('li', { class: 'hw-howto__step', style: { '--hw-step': tone } }, h('span', { class: 'hw-howto__num' }, glyph(tip.icon, 16)), h('span', { text: tip.text })));
    const section = this.track(h('section', { class: 'hw-howto__loop' }, h('h3', { class: 'hw-heading', text: title }), h('ul', { class: 'hw-howto__steps' }, items)));
    items.forEach((li, i) => this.lines.push({ el: [li], text: `${title} ${tips[i].text}`, section }));
    return section;
  }

  private controlList(lines: readonly ControlLine[]): HTMLDListElement {
    return h(
      'dl',
      { class: 'hw-keys' },
      lines.map((line) => [
        h(
          'dt',
          { class: 'hw-keys__caps' },
          line.keys.map((key) => (SEPARATORS.has(key) ? h('span', { class: 'hw-keys__sep', text: key }) : h('kbd', { class: 'hw-key', text: key }))),
        ),
        h('dd', { class: 'hw-keys__action', text: line.action }),
      ]),
    );
  }
}
