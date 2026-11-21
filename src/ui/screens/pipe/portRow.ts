/**
 * One row of the pipe screen: a pipe end touching a block. The block's icon and name (tap: its block pulses in the
 * world), Push / Pull / Off, the status line, and a fold with distribution, the filter (up to 5 slots: tap one, then
 * pick an item from the pack or a fluid; allow / deny) and the priority.
 */
import { PIPE_FILTER_SLOTS, PIPE_PRIORITY_MAX, PIPE_PRIORITY_MIN } from '../../../core/constants';
import { fluidOrNull } from '../../../core/registry';
import type { Slot } from '../../../core/types';
import type { PortChange, PortView } from '../../../sim';
import { h, setAttr, setFlag, setText } from '../../kit/dom';
import { Segmented } from '../../kit/fields';
import { glyph, ItemIcon } from '../../kit/icons';
import { Stepper } from '../stepper';
import {
  distanceText, filterChoices, filterSummary, keyName, MODE_HELP, portTone, priorityNote, priorityText, setFilterSlot, type Family,
} from './pipeText';

export interface PortRowDeps {
  family: Family;
  /** The player's pack (for the filter picker). */
  pack: () => readonly Slot[];
  change: (port: PortView, change: PortChange) => void;
  /** Pulse the endpoint block in the world. */
  locate: (port: PortView) => void;
}

/** A filter key drawn as an item icon, or a fluid as a swatch of its colour. */
class KeyTile {
  readonly el: HTMLSpanElement;
  private readonly icon = new ItemIcon();
  private readonly swatch: HTMLSpanElement;
  private key: string | null = null;

  constructor(private readonly family: Family) {
    this.swatch = h('span', { class: 'hw-pipe__swatch' });
    this.el = h('span', { class: 'hw-pipe__tile' }, this.icon.el, this.swatch);
    this.set(null);
  }

  set(key: string | null): void {
    if (key === this.key && this.el.dataset.init) return;
    this.el.dataset.init = '1';
    this.key = key;
    const fluid = this.family === 'fluid' && key ? fluidOrNull(key) : null;
    this.icon.el.hidden = key === null || fluid !== null;
    this.swatch.hidden = fluid === null;
    if (fluid) {
      this.swatch.style.backgroundColor = `#${fluid.colour.toString(16).padStart(6, '0')}`;
      setFlag(this.swatch, 'glow', fluid.glow);
    } else if (key) this.icon.set(key);
  }
}

export class PortRow {
  readonly el: HTMLElement;
  private port: PortView;
  private readonly deps: PortRowDeps;
  private readonly icon = new ItemIcon();
  private readonly name: HTMLSpanElement;
  private readonly where: HTMLSpanElement;
  private readonly status: HTMLParagraphElement;
  private readonly located: HTMLSpanElement;
  private readonly mode: Segmented<PortView['mode']>;
  private readonly more: HTMLButtonElement;
  private readonly summary: HTMLSpanElement;
  private readonly fold: HTMLDivElement;
  private readonly dist: Segmented<PortView['distribution']> | null;
  private readonly slots: { el: HTMLButtonElement; tile: KeyTile }[] = [];
  private readonly filterMode: Segmented<PortView['filterMode']>;
  private readonly filterText: HTMLParagraphElement;
  private readonly picker: HTMLDivElement;
  private readonly pickerTitle: HTMLParagraphElement;
  private readonly pickerGrid: HTMLDivElement;
  private pickerKey = '';
  private readonly priority: Stepper;
  private readonly priorityHelp: HTMLParagraphElement;
  private picking: number | null = null;
  private locateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(port: PortView, deps: PortRowDeps, expanded: boolean, onExpand: (open: boolean) => void) {
    this.port = port;
    this.deps = deps;
    this.name = h('span', { class: 'hw-pipe__name' });
    this.where = h('span', { class: 'hw-pipe__where hw-num' });
    this.located = h('span', { class: 'hw-pipe__located', text: 'Shown in the world' });
    this.located.hidden = true;
    const who = h(
      'button',
      { class: 'hw-pipe__who', attrs: { type: 'button', title: 'Show this block in the world' } },
      this.icon.el,
      h('span', { class: 'hw-pipe__names' }, this.name, this.where, this.located),
    );
    who.addEventListener('click', () => this.locate());
    this.status = h('p', { class: 'hw-pipe__status', attrs: { role: 'status' } });
    this.mode = new Segmented({
      label: 'What this end does',
      options: [{ value: 'push', label: 'Push' }, { value: 'pull', label: 'Pull' }, { value: 'off', label: 'Off' }],
      value: port.mode,
      onChange: (mode) => deps.change(this.port, { mode }),
    });
    this.summary = h('span', { class: 'hw-pipe__summary' });
    this.more = h(
      'button',
      { class: 'hw-pipe__more', attrs: { type: 'button', 'aria-expanded': String(expanded) } },
      h('span', { class: 'hw-pipe__moretext', text: 'Settings' }),
      this.summary,
      glyph('chevron', 12),
    );
    this.fold = h('div', { class: 'hw-pipe__fold' });
    this.fold.hidden = !expanded;
    this.more.addEventListener('click', () => {
      const open = this.fold.hidden;
      this.fold.hidden = !open;
      setAttr(this.more, 'aria-expanded', String(open));
      if (!open) this.closePicker();
      onExpand(open);
    });

    this.dist = deps.family === 'item'
      ? new Segmented({
        label: 'Where pulled items go',
        options: [{ value: 'nearest', label: 'Nearest' }, { value: 'round', label: 'Round' }],
        value: port.distribution,
        onChange: (distribution) => deps.change(this.port, { distribution }),
      })
      : null;
    const slotRow = h('div', { class: 'hw-pipe__slots' });
    for (let i = 0; i < PIPE_FILTER_SLOTS; i++) {
      const tile = new KeyTile(deps.family);
      const el = h('button', { class: 'hw-pipe__fslot', attrs: { type: 'button' } }, tile.el, h('span', { class: 'hw-pipe__plus', text: '+' }));
      el.addEventListener('click', () => this.openPicker(i));
      this.slots.push({ el, tile });
      slotRow.appendChild(el);
    }
    this.filterMode = new Segmented({
      label: 'Filter mode',
      options: [{ value: 'allow', label: 'Allow' }, { value: 'deny', label: 'Deny' }],
      value: port.filterMode,
      onChange: (filterMode) => deps.change(this.port, { filterMode }),
    });
    this.filterText = h('p', { class: 'hw-pipe__ftext' });
    this.pickerTitle = h('p', { class: 'hw-pipe__ptitle' });
    this.pickerGrid = h('div', { class: 'hw-pipe__pgrid' });
    const clear = h('button', { class: 'hw-pipe__pbtn', text: 'Empty slot', attrs: { type: 'button' } });
    clear.addEventListener('click', () => this.pick(null));
    const cancel = h('button', { class: 'hw-pipe__pbtn', text: 'Cancel', attrs: { type: 'button' } });
    cancel.addEventListener('click', () => this.closePicker());
    this.picker = h('div', { class: 'hw-pipe__picker' }, this.pickerTitle, this.pickerGrid, h('div', { class: 'hw-pipe__pbtns' }, clear, cancel));
    this.picker.hidden = true;
    this.priority = new Stepper({
      label: 'Priority',
      min: PIPE_PRIORITY_MIN,
      max: PIPE_PRIORITY_MAX,
      value: port.priority,
      format: priorityText,
      onChange: (priority) => deps.change(this.port, { priority }),
    });
    this.priorityHelp = h('p', { class: 'hw-pipe__note' });
    this.fold.append(
      ...(this.dist ? [h('div', { class: 'hw-pipe__field' }, h('span', { class: 'hw-step__label', text: 'Distribution' }), this.dist.el)] : []),
      h(
        'div',
        { class: 'hw-pipe__field' },
        h('span', { class: 'hw-step__label', text: deps.family === 'fluid' ? 'Fluid filter' : 'Item filter' }),
        h('div', { class: 'hw-pipe__filter' }, slotRow, this.filterMode.el),
        this.filterText,
        this.picker,
      ),
      h('div', { class: 'hw-pipe__field hw-pipe__prio' }, this.priority.el, this.priorityHelp),
    );
    this.el = h(
      'article',
      { class: 'hw-pipe__port' },
      h('div', { class: 'hw-pipe__head' }, who, this.status),
      h('div', { class: 'hw-pipe__ctl' }, this.mode.el, this.more),
      this.fold,
    );
    this.update(port);
  }

  update(port: PortView): void {
    this.port = port;
    this.icon.set(port.icon);
    setText(this.name, port.name);
    setText(this.where, distanceText(port.distance));
    setText(this.status, port.status);
    setAttr(this.status, 'data-tone', portTone(port));
    setFlag(this.el, 'inert', port.inert);
    setAttr(this.el, 'data-mode', port.mode);
    this.mode.set(port.mode);
    setAttr(this.mode.el, 'title', MODE_HELP[port.mode]);
    this.dist?.set(port.distribution);
    const filter = filterSummary(this.deps.family, port);
    const dist = this.dist ? `${port.distribution === 'round' ? 'Round' : 'Nearest'} · ` : '';
    setText(this.summary, `${dist}${filter} · ${priorityText(port.priority)}`);
    this.slots.forEach((s, i) => {
      const key = port.filter[i] ?? null;
      s.tile.set(key);
      setFlag(s.el, 'empty', key === null);
      setFlag(s.el, 'picking', this.picking === i);
      setAttr(s.el, 'aria-label', key ? `Filter slot ${i + 1}: ${keyName(this.deps.family, key)} - change` : `Filter slot ${i + 1}: empty - add`);
      s.el.hidden = i > port.filter.length;
    });
    this.filterMode.set(port.filterMode);
    setText(this.filterText, port.filter.length === 0
      ? 'Lets everything through. Tap + to pick what to let through (Allow) or keep out (Deny).'
      : `Lets through ${filter.charAt(0).toLowerCase()}${filter.slice(1)}.`);
    this.priority.set(port.priority);
    setText(this.priorityHelp, priorityNote(port.priority));
    if (this.picking !== null) this.fillPicker();
  }

  dispose(): void {
    if (this.locateTimer !== null) clearTimeout(this.locateTimer);
  }

  private locate(): void {
    this.deps.locate(this.port);
    this.located.hidden = false;
    if (this.locateTimer !== null) clearTimeout(this.locateTimer);
    this.locateTimer = setTimeout(() => {
      this.located.hidden = true;
      this.locateTimer = null;
    }, 1800);
  }

  private openPicker(index: number): void {
    if (this.picking === index) {
      this.closePicker();
      return;
    }
    this.picking = index;
    this.picker.hidden = false;
    this.pickerKey = '';
    this.update(this.port);
  }

  private closePicker(): void {
    this.picking = null;
    this.picker.hidden = true;
    this.update(this.port);
  }

  private fillPicker(): void {
    const family = this.deps.family;
    const choices = filterChoices(family, this.deps.pack());
    const index = this.picking ?? 0;
    setText(this.pickerTitle, family === 'fluid'
      ? `Pick a fluid for slot ${index + 1}`
      : choices.length > 0 ? `Pick an item from your pack for slot ${index + 1}` : 'Your pack is empty - carry the item you want to filter.');
    const key = choices.join(',');
    if (key === this.pickerKey) return;
    this.pickerKey = key;
    this.pickerGrid.replaceChildren(
      ...choices.map((k) => {
        const tile = new KeyTile(family);
        tile.set(k);
        const name = keyName(family, k);
        const b = h(
          'button',
          { class: ['hw-pipe__choice', family === 'fluid' && 'hw-pipe__choice--named'], attrs: { type: 'button', title: name, 'aria-label': name } },
          tile.el,
          family === 'fluid' ? h('span', { text: name }) : null,
        );
        b.addEventListener('click', () => this.pick(k));
        return b;
      }),
    );
  }

  private pick(key: string | null): void {
    const index = this.picking;
    if (index === null) return;
    const filter = setFilterSlot(this.port.filter, index, key);
    this.picking = null;
    this.picker.hidden = true;
    this.deps.change(this.port, { filter });
  }
}
