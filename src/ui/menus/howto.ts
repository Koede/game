/**
 * How to Play: the core loop in five lines, staying alive (food, farming, animals, cold), building big (hearths,
 * pipes), the Emberbound automatons, then the controls for keyboard + mouse and for touch.
 */
import { Segmented } from '../kit/controls';
import { h } from '../kit/dom';
import { glyph, type GlyphName } from '../kit/icons';

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
}

export const DEFAULT_KEYBOARD_CONTROLS: readonly ControlLine[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
  { keys: ['Mouse'], action: 'Look around' },
  { keys: ['Space'], action: 'Jump, swim up' },
  { keys: ['Shift'], action: 'Sprint' },
  { keys: ['Hold left click'], action: 'Mine the block you look at' },
  { keys: ['Right click'], action: 'Open a furnace or machine; use, place or eat the held item' },
  { keys: ['Shift', 'Right click'], action: 'Place the held block against a furnace or machine' },
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
  { keys: ['Tap a block', 'Use'], action: 'Open a furnace or machine; use, place or eat the held item' },
  { keys: ['Place', 'Use'], action: 'Place the held block against a furnace or machine' },
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

export class HowToPlay {
  readonly el: HTMLDivElement;

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
    this.el = h(
      'div',
      { class: 'hw-howto' },
      h(
        'section',
        { class: 'hw-howto__loop' },
        h('h3', { class: 'hw-heading', text: 'The loop' }),
        h(
          'ol',
          { class: 'hw-howto__steps' },
          LOOP.map((step, i) =>
            h('li', { class: 'hw-howto__step', style: { '--hw-step': step.tone } }, h('span', { class: 'hw-howto__num hw-num', text: String(i + 1) }), h('span', { text: step.text })),
          ),
        ),
      ),
      this.tips('Staying alive', 'var(--hw-food)', LIVING),
      this.tips('Building big', 'var(--hw-power)', BUILDING),
      this.tips('The Emberbound', '#ff7a2a', EMBERBOUND),
      h('section', { class: 'hw-howto__controls' }, h('div', { class: 'hw-howto__bar' }, h('h3', { class: 'hw-heading', text: 'Controls' }), picker.el), lists.keyboard, lists.touch),
    );
  }

  private tips(title: string, tone: string, tips: readonly Tip[]): HTMLElement {
    return h(
      'section',
      { class: 'hw-howto__loop' },
      h('h3', { class: 'hw-heading', text: title }),
      h(
        'ul',
        { class: 'hw-howto__steps' },
        tips.map((tip) => h('li', { class: 'hw-howto__step', style: { '--hw-step': tone } }, h('span', { class: 'hw-howto__num' }, glyph(tip.icon, 16)), h('span', { text: tip.text }))),
      ),
    );
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
