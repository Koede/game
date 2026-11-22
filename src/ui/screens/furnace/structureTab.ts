/**
 * The STRUCTURE tab (spec 17.4): the hearth's status, a checklist with ticks and counts, the problems in plain words
 * (tap one: its block pulses in the world), and the target picker - tier, inside size, the materials with have/need
 * and a "Show in world" switch for the ghost preview. At tier 1 it first explains what a hearth is.
 *
 * Once a hearth stands and the plan has moved on to the next tier, the tab first shows the standing hearth's own
 * checklist (all ticked) and folds the next tier's under "Next: Arc hearth", in neutral "to build" colours: what is
 * still missing there is work ahead, not a fault in what was just built.
 */
import type { GameBus } from '../../../core/context';
import { FIRST_HEARTH_TIER, HEARTH_HIGHLIGHT_S } from '../../../core/constants';
import { itemOrNull } from '../../../core/registry';
import type { HearthProblem, StructureCheck, StructureTarget, StructureView, TierChoice } from '../../../sim';
import { Button, Toggle } from '../../kit/controls';
import { Segmented } from '../../kit/fields';
import { h, setAttr, setText } from '../../kit/dom';
import { Badge } from '../../kit/gauges';
import { glyph, ItemIcon } from '../../kit/icons';
import { Stepper } from '../stepper';
import type { HearthGhost, StructureSource } from './hearthGhost';
import {
  AXIS_LABEL, checkText, effectText, groupProblems, hearthIntro, innerBounds, materialTexts, sizeText, statusTone, tierRules, tierShort,
  type Axis, type ProblemGroup,
} from './structureText';

interface ProblemRow {
  el: HTMLButtonElement;
  text: HTMLSpanElement;
  count: HTMLSpanElement;
  note: HTMLSpanElement;
  group: ProblemGroup;
  /** Which of the group's blocks the next tap shows. */
  next: number;
}

interface MaterialEl {
  el: HTMLLIElement;
  icon: ItemIcon;
  name: HTMLSpanElement;
  placed: HTMLSpanElement;
  have: HTMLSpanElement;
}

const HINT_MS = 1800;

const checksKey = (list: readonly StructureCheck[]): string => list.map((c) => `${c.key}${c.have}/${c.need}`).join(',');

const checkItem = (c: StructureCheck): HTMLLIElement =>
  h('li', { class: 'hw-st__check', attrs: { 'data-ok': c.ok } }, glyph(c.ok ? 'check' : 'close', 12), h('span', { text: checkText(c) }));

export class StructureTab {
  readonly el: HTMLElement;
  private readonly sim: StructureSource;
  private readonly pos: { x: number; y: number; z: number };
  private readonly bus: GameBus;
  private readonly ghost: HearthGhost;
  private readonly status = new Badge({ text: '', tone: 'neutral' });
  private readonly effect: HTMLParagraphElement;
  private readonly intro: HTMLElement;
  private readonly checks: HTMLUListElement;
  private checksKey = '';
  private readonly problemHead: HTMLHeadingElement;
  private readonly problemList: HTMLDivElement;
  private readonly problemRows: ProblemRow[] = [];
  private readonly none: HTMLParagraphElement;
  private readonly tierHost: HTMLDivElement;
  private tierPicker: Segmented<string> | null = null;
  private tiersKey = '';
  private readonly steppers: Stepper[];
  private readonly rules: HTMLParagraphElement;
  private readonly materials: HTMLUListElement;
  private readonly materialEls: MaterialEl[] = [];
  private readonly show: Toggle;
  private readonly showNote: HTMLParagraphElement;
  private readonly shiftLeft: Button;
  private readonly shiftRight: Button;
  private readonly shiftText: HTMLSpanElement;
  private readonly shiftRow: HTMLDivElement;
  private readonly wayHead: HTMLHeadingElement;
  private readonly wayList: HTMLDivElement;
  private wayKey = '';
  private view: StructureView | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly formedPart: HTMLElement;
  private readonly formedHead: HTMLHeadingElement;
  private readonly formedChecks: HTMLUListElement;
  private formedKey = '';
  private readonly nextBtn: HTMLButtonElement;
  private readonly nextLabel: HTMLSpanElement;
  private readonly nextPart: HTMLElement;
  private nextOpen = false;

  constructor(opts: { sim: StructureSource; pos: { x: number; y: number; z: number }; bus: GameBus; ghost: HearthGhost; changed: () => void }) {
    this.sim = opts.sim;
    this.pos = opts.pos;
    this.bus = opts.bus;
    this.ghost = opts.ghost;
    this.effect = h('p', { class: 'hw-st__effect' });
    const intro = hearthIntro();
    this.intro = h(
      'section',
      { class: 'hw-st__intro hw-panel' },
      h('h3', { class: 'hw-st__introtitle' }, glyph('info', 14), intro.title),
      ...intro.lines.map((line) => h('p', { text: line })),
    );
    this.checks = h('ul', { class: 'hw-st__checks', attrs: { 'aria-label': 'Checklist' } });
    this.formedHead = h('h4', { class: 'hw-heading' });
    this.formedChecks = h('ul', { class: 'hw-st__checks', attrs: { 'aria-label': 'The standing hearth' } });
    this.formedPart = h('div', { class: 'hw-st__formed' }, this.formedHead, this.formedChecks);
    this.nextLabel = h('span', { class: 'hw-st__nextlabel' });
    this.nextBtn = h(
      'button',
      { class: 'hw-st__next', attrs: { type: 'button', 'aria-expanded': 'false' } },
      this.nextLabel,
      glyph('chevron', 12),
    );
    this.nextBtn.addEventListener('click', () => {
      this.nextOpen = !this.nextOpen;
      this.update();
    });
    this.problemHead = h('h4', { class: 'hw-heading' });
    this.none = h('p', { class: 'hw-st__none' });
    this.problemList = h('div', { class: 'hw-st__problems' }, this.none);
    this.nextPart = h('div', { class: 'hw-st__plan' }, h('h4', { class: 'hw-heading', text: 'Checklist' }), this.checks, this.problemHead, this.problemList);
    this.tierHost = h('div', { class: 'hw-st__tiers' });
    this.steppers = ([0, 1, 2] as Axis[]).map(
      (axis) => new Stepper({ label: AXIS_LABEL[axis], min: 1, max: 1, value: 1, onChange: (v) => this.resize(axis, v) }),
    );
    this.rules = h('p', { class: 'hw-st__rules' });
    this.shiftLeft = new Button({ label: 'Shift left', kind: 'quiet', size: 'sm', onClick: () => this.shift('shiftLeft') });
    this.shiftRight = new Button({ label: 'Shift right', kind: 'quiet', size: 'sm', onClick: () => this.shift('shiftRight') });
    this.shiftText = h('span', { class: 'hw-st__shifttext' });
    this.shiftRow = h('div', { class: 'hw-st__shift', attrs: { 'aria-label': 'Move the plan sideways' } }, this.shiftLeft.el, this.shiftText, this.shiftRight.el);
    this.wayHead = h('h4', { class: 'hw-heading' });
    this.wayList = h('div', { class: 'hw-st__way' });
    this.wayHead.hidden = true;
    this.wayList.hidden = true;
    this.materials = h('ul', { class: 'hw-st__mats', attrs: { 'aria-label': 'Materials' } });
    this.show = new Toggle({
      label: 'Show the planned hearth in the world',
      tone: 'power',
      onText: 'Shown',
      offText: 'Hidden',
      onChange: (on) => this.setGhost(on),
    });
    this.showNote = h('p', { class: 'hw-st__shownote' });
    this.el = h(
      'div',
      { class: 'hw-st' },
      h('div', { class: 'hw-st__status' }, this.status.el, this.effect),
      this.intro,
      this.formedPart,
      this.nextBtn,
      this.nextPart,
      h(
        'section',
        { class: 'hw-st__target hw-panel', attrs: { 'aria-label': 'Plan a hearth' } },
        h('h4', { class: 'hw-heading', text: 'Plan' }),
        this.tierHost,
        h('div', { class: 'hw-st__size' }, ...this.steppers.map((s) => s.el)),
        this.rules,
        this.shiftRow,
        this.wayHead,
        this.wayList,
        h('div', { class: 'hw-st__show' }, h('span', { class: 'hw-st__showlabel', text: 'Show in world' }), this.show.el),
        this.showNote,
        h('h4', { class: 'hw-heading', text: 'Materials' }),
        this.materials,
      ),
    );
  }

  update(): void {
    const { x, y, z } = this.pos;
    const view = this.sim.structureView(x, y, z, this.ghost.target(x, y, z));
    if (!view) return;
    this.view = view;
    this.status.update({ text: view.status, tone: statusTone(view) });
    setText(this.effect, effectText(view));
    this.intro.hidden = view.controllerTier >= FIRST_HEARTH_TIER;
    // The plan is ahead of the standing hearth: show that hearth first, the next tier's work folded below it.
    const ahead = view.formed && view.target.tier > view.tier;
    const chosen = this.ghost.target(x, y, z) !== undefined;
    const open = !ahead || this.nextOpen || chosen;
    this.formedPart.hidden = !ahead;
    this.nextBtn.hidden = !ahead;
    this.nextPart.hidden = !open;
    setAttr(this.el, 'data-ahead', ahead);
    setAttr(this.nextBtn, 'aria-expanded', String(open));
    if (ahead) {
      const own = this.sim.structureView(x, y, z, { tier: view.tier, inner: view.inner ?? undefined });
      setText(this.formedHead, `${view.name ?? 'Hearth'} - standing`);
      this.updateFormed(own?.target.checklist ?? []);
      const todo = view.target.checklist.filter((c) => !c.ok).length;
      setText(this.nextLabel, `Next: ${view.target.name}${todo > 0 ? ` - ${todo} to build` : ''}`);
    }
    this.updateChecks(view.target.checklist);
    this.updateProblems(view.problems, view.formed && view.tier >= view.target.tier, ahead, view.note);
    this.updateTarget(view);
  }

  dispose(): void {
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
  }

  private updateChecks(list: readonly StructureCheck[]): void {
    const key = checksKey(list);
    if (key === this.checksKey) return;
    this.checksKey = key;
    this.checks.replaceChildren(...list.map(checkItem));
  }

  private updateFormed(list: readonly StructureCheck[]): void {
    const key = checksKey(list);
    if (key === this.formedKey) return;
    this.formedKey = key;
    this.formedChecks.replaceChildren(...list.map(checkItem));
  }

  /** `todo`: the list is the next tier's work (headed "To build", neutral colours), not faults of a standing hearth. */
  private updateProblems(problems: readonly HearthProblem[], complete: boolean, todo: boolean, note: string | null): void {
    const list = groupProblems(problems);
    const word = todo ? 'To build' : 'Problems';
    setText(this.problemHead, problems.length > 0 ? `${word} (${problems.length})` : complete ? 'Complete' : word);
    while (this.problemRows.length > list.length) this.problemRows.pop()?.el.remove();
    list.forEach((g, i) => {
      let row = this.problemRows[i];
      if (!row) {
        const text = h('span', { class: 'hw-st__ptext' });
        const count = h('span', { class: 'hw-st__pcount hw-num' });
        const note = h('span', { class: 'hw-st__pnote', text: 'Shown in the world' });
        note.hidden = true;
        const el = h('button', { class: 'hw-st__problem', attrs: { type: 'button' } }, glyph('warn', 14), h('span', { class: 'hw-st__pmain' }, text, count), note, glyph('chevron', 12));
        const made: ProblemRow = { el, text, count, note, group: g, next: 0 };
        el.addEventListener('click', () => this.highlight(made));
        row = made;
        this.problemRows.push(row);
        this.problemList.appendChild(el);
      }
      if (row.group.text !== g.text) row.next = 0;
      row.group = g;
      setText(row.text, g.text);
      setText(row.count, g.at.length > 1 ? `×${g.at.length}` : '');
      row.count.hidden = g.at.length < 2;
      setAttr(row.el, 'aria-label', `${g.text}${g.at.length > 1 ? ` (${g.at.length} blocks)` : ''} - show it in the world`);
    });
    this.none.hidden = list.length > 0;
    setText(
      this.none,
      note ?? (complete ? 'Every block of this hearth is in place.' : 'Nothing wrong with what stands. Place the blocks still missing below.'),
    );
  }

  private highlight(row: ProblemRow): void {
    const at = row.group.at[row.next % row.group.at.length];
    row.next = (row.next + 1) % row.group.at.length;
    this.bus.emit('highlight:block', { x: at.x, y: at.y, z: at.z, seconds: HEARTH_HIGHLIGHT_S });
    this.bus.emit('sfx', { name: 'ui_click' });
    setText(row.note, row.group.at.length > 1 ? `Shown in the world - ${((row.next + row.group.at.length - 1) % row.group.at.length) + 1} of ${row.group.at.length}` : 'Shown in the world');
    for (const r of this.problemRows) r.note.hidden = r !== row;
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      row.note.hidden = true;
      this.hintTimer = null;
    }, HINT_MS);
  }

  private updateTarget(view: StructureView): void {
    const t = view.target;
    const tiersKey = view.tiers.map((c) => c.tier).join(',');
    if (tiersKey !== this.tiersKey || !this.tierPicker) {
      this.tiersKey = tiersKey;
      this.tierPicker = new Segmented<string>({
        label: 'Hearth to plan',
        options: view.tiers.map((c) => ({ value: String(c.tier), label: tierShort(c) })),
        value: String(t.tier),
        onChange: (v) => this.choose({ tier: Number(v) }),
      });
      this.tierHost.replaceChildren(this.tierPicker.el);
    }
    this.tierPicker.set(String(t.tier));
    const choice = view.tiers.find((c) => c.tier === t.tier) as TierChoice;
    this.steppers.forEach((s, axis) => {
      const [lo, hi] = innerBounds(choice, axis as Axis);
      s.set(t.inner[axis], lo, hi);
    });
    setText(this.rules, `${t.name} ${sizeText(t.inner)}: ${tierRules(choice)}.`);
    this.updateShift(t);
    this.updateMachines(t.machines);
    this.updateMaterials(view);
    const shown = this.ghost.isShown(this.pos.x, this.pos.y, this.pos.z);
    this.show.set(shown);
    this.show.setDisabled(t.ready && !shown);
    setText(
      this.showNote,
      t.ready
        ? 'Every block of this plan is in place.'
        : shown
          ? 'Blue cubes: place a block there. Red: the wrong block - break it. The preview stays after you close the furnace.'
          : 'Shows where each block goes, as see-through cubes in the world.',
    );
  }

  /** "Shift left / right": the plan one block sideways as seen from in front of the furnace; null = end of the range. */
  private updateShift(t: StructureView['target']): void {
    const none = t.offsets[0] === t.offsets[1];
    this.shiftRow.hidden = none;
    this.shiftLeft.setDisabled(t.shiftLeft === null, 'At the edge');
    this.shiftRight.setDisabled(t.shiftRight === null, 'At the edge');
    setText(this.shiftText, `Position ${t.offset - t.offsets[0] + 1} of ${t.offsets[1] - t.offsets[0] + 1}`);
  }

  private shift(which: 'shiftLeft' | 'shiftRight'): void {
    const t = this.view?.target;
    const offset = t?.[which];
    if (!t || offset === null || offset === undefined) return;
    this.choose({ tier: t.tier, inner: [...t.inner], offset });
  }

  /** Machines and pipes standing where the plan needs a wall or air: "Move the Crate first" (tap: shown in the world). */
  private updateMachines(list: StructureView['target']['machines']): void {
    const key = list.map((m) => `${m.x},${m.y},${m.z}`).join(';');
    this.wayHead.hidden = list.length === 0;
    this.wayList.hidden = list.length === 0;
    if (key === this.wayKey) return;
    this.wayKey = key;
    setText(this.wayHead, `In the way (${list.length})`);
    this.wayList.replaceChildren(
      ...list.map((m) => {
        const row = h(
          'button',
          { class: 'hw-st__problem hw-st__moveme', attrs: { type: 'button', 'aria-label': `Move the ${m.name} first - show it in the world` } },
          glyph('warn', 14),
          h('span', { class: 'hw-st__pmain' }, h('span', { class: 'hw-st__ptext', text: `Move the ${m.name} first` })),
          glyph('chevron', 12),
        );
        row.addEventListener('click', () => {
          this.bus.emit('highlight:block', { x: m.x, y: m.y, z: m.z, seconds: HEARTH_HIGHLIGHT_S });
          this.bus.emit('sfx', { name: 'ui_click' });
        });
        return row;
      }),
    );
  }

  private updateMaterials(view: StructureView): void {
    const rows = view.target.materials;
    while (this.materialEls.length > rows.length) this.materialEls.pop()?.el.remove();
    rows.forEach((row, i) => {
      let m = this.materialEls[i];
      if (!m) {
        const icon = new ItemIcon();
        const name = h('span', { class: 'hw-st__mname' });
        const placed = h('span', { class: 'hw-st__mplaced hw-num' });
        const have = h('span', { class: 'hw-st__mhave hw-num' });
        m = { el: h('li', { class: 'hw-st__mat' }, icon.el, name, placed, have), icon, name, placed, have };
        this.materialEls.push(m);
        this.materials.appendChild(m.el);
      }
      const texts = materialTexts(row);
      m.icon.set(row.item);
      setText(m.name, itemOrNull(row.item)?.name ?? row.item);
      setText(m.placed, texts.placed);
      setText(m.have, texts.have);
      setAttr(m.el, 'data-tone', row.missing === 0 ? 'good' : row.ok ? 'neutral' : 'warn');
    });
  }

  private choose(target: { tier: number; inner?: [number, number, number]; offset?: number }): void {
    const { x, y, z } = this.pos;
    this.ghost.choose(x, y, z, target);
    this.update();
  }

  private resize(axis: Axis, value: number): void {
    const t = this.view?.target;
    if (!t) return;
    const inner: [number, number, number] = [t.inner[0], t.inner[1], t.inner[2]];
    inner[axis] = value;
    this.choose({ tier: t.tier, inner });
  }

  private setGhost(on: boolean): void {
    const { x, y, z } = this.pos;
    const t = this.view?.target;
    if (on && t) {
      const offset = this.ghost.target(x, y, z)?.offset;
      const target: StructureTarget = { tier: t.tier, inner: [...t.inner] };
      if (offset !== undefined) target.offset = offset;
      if (!this.ghost.show(x, y, z, target)) this.show.set(false);
    } else this.ghost.hide(x, y, z);
    this.update();
  }
}
