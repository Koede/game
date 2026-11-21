/** How to Play: the core loop in five lines, then the controls for keyboard + mouse and for touch. */
import { Segmented } from '../kit/controls';
import { h } from '../kit/dom';

export interface ControlLine {
  /** Key caps or gestures, shown as separate caps: ['W', 'A', 'S', 'D'] or ['Hold on a block']. */
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
  { keys: ['Right click'], action: 'Open a furnace or machine, use or place the held item' },
  { keys: ['1', '–', '9', 'Wheel'], action: 'Pick a hotbar slot' },
  { keys: ['E'], action: 'Inventory and hand recipes' },
  { keys: ['L'], action: 'Hearth Log: goals and ages' },
  { keys: ['Esc'], action: 'Close a window, pause' },
];

export const DEFAULT_TOUCH_CONTROLS: readonly ControlLine[] = [
  { keys: ['Left stick'], action: 'Move' },
  { keys: ['Drag the view'], action: 'Look around' },
  { keys: ['Jump button'], action: 'Jump, swim up' },
  { keys: ['Hold on a block', 'Mine'], action: 'Mine it' },
  { keys: ['Tap a block', 'Use'], action: 'Open a furnace or machine, use or place the held item' },
  { keys: ['Tap the hotbar'], action: 'Pick a slot' },
  { keys: ['Bag button'], action: 'Inventory and hand recipes' },
  { keys: ['Tap the goal'], action: 'Hearth Log: goals and ages' },
  { keys: ['Tap a slot', 'Tap another'], action: 'Move, merge or swap a stack' },
  { keys: ['Long-press a slot'], action: 'Take half a stack' },
];

/** The loop. Steps 1-3 are about heat, 4-5 about power: the numerals are coloured to match. */
const LOOP: readonly { tone: string; text: string }[] = [
  { tone: 'var(--hw-temp-800)', text: 'Gather wood, flint, rubble and clay. A workbench builds your first furnace - and little else.' },
  { tone: 'var(--hw-temp-1100)', text: 'The furnace is the heart. Feed the fire, pump the bellows: hotter fire, better recipes.' },
  { tone: 'var(--hw-temp-1500)', text: 'Its recipe list is your tech tree. A locked row tells you the heat or the tier it wants.' },
  { tone: 'var(--hw-power)', text: 'Heat first, then watts. Turn the fire into electricity, then build wind, sun, oil, lava and uranium.' },
  { tone: 'var(--hw-power-hi)', text: 'Upgrade the furnace in place, five times. Nights are cold - come home to it. The last tier is a star.' },
];

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
      h('section', { class: 'hw-howto__controls' }, h('div', { class: 'hw-howto__bar' }, h('h3', { class: 'hw-heading', text: 'Controls' }), picker.el), lists.keyboard, lists.touch),
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
          line.keys.map((key) => (key === '–' ? h('span', { class: 'hw-keys__sep', text: key }) : h('kbd', { class: 'hw-key', text: key }))),
        ),
        h('dd', { class: 'hw-keys__action', text: line.action }),
      ]),
    );
  }
}
