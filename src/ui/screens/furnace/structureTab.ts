/**
 * The STRUCTURE tab (spec 17.4): the hearth's status, a checklist with ticks and counts, the problems in plain words
 * (tap one: its block pulses in the world), and the target picker - tier, inside size, the materials with have/need
 * and a "Show in world" switch for the ghost preview. At tier 1 it first explains what a hearth is.
 */
import type { GameBus } from '../../../core/context';
import { HEARTH_HIGHLIGHT_S } from '../../../core/constants';
import { itemOrNull } from '../../../core/registry';
import type { HearthProblem, StructureCheck, StructureView, TierChoice } from '../../../sim';
import { Toggle } from '../../kit/controls';
import { Segmented } from '../../kit/fields';
import { h, setAttr, setText } from '../../kit/dom';
import { Badge } from '../../kit/gauges';
import { glyph, ItemIcon } from '../../kit/icons';
import { Stepper } from '../stepper';
import type { HearthGhost, StructureSource } from './hearthGhost';
import {
  AXIS_LABEL, checkText, effectText, hearthIntro, innerBounds, materialTexts, sizeText, statusTone, tierRules, tierShort, type Axis,
} from './structureText';

interface ProblemRow {
  el: HTMLButtonElement;
  text: HTMLSpanElement;
  note: HTMLSpanElement;
  problem: HearthProblem;
}

interface MaterialEl {
  el: HTMLLIElement;
  icon: ItemIcon;
  name: HTMLSpanElement;
  placed: HTMLSpanElement;
  have: HTMLSpanElement;
}

const HINT_MS = 1800;

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
  private view: StructureView | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.problemHead = h('h4', { class: 'hw-heading' });
    this.none = h('p', { class: 'hw-st__none' });
    this.problemList = h('div', { class: 'hw-st__problems' }, this.none);
    this.tierHost = h('div', { class: 'hw-st__tiers' });
    this.steppers = ([0, 1, 2] as Axis[]).map(
      (axis) => new Stepper({ label: AXIS_LABEL[axis], min: 1, max: 1, value: 1, onChange: (v) => this.resize(axis, v) }),
    );
    this.rules = h('p', { class: 'hw-st__rules' });
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
      h('h4', { class: 'hw-heading', text: 'Checklist' }),
      this.checks,
      this.problemHead,
      this.problemList,
      h(
        'section',
        { class: 'hw-st__target hw-panel', attrs: { 'aria-label': 'Plan a hearth' } },
        h('h4', { class: 'hw-heading', text: 'Plan' }),
        this.tierHost,
        h('div', { class: 'hw-st__size' }, ...this.steppers.map((s) => s.el)),
        this.rules,
        h('h4', { class: 'hw-heading', text: 'Materials' }),
        this.materials,
        h('div', { class: 'hw-st__show' }, h('span', { class: 'hw-st__showlabel', text: 'Show in world' }), this.show.el),
        this.showNote,
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
    this.intro.hidden = view.controllerTier > 1;
    this.updateChecks(view.target.checklist);
    this.updateProblems(view.problems, view.formed && view.tier >= view.target.tier);
    this.updateTarget(view);
  }

  dispose(): void {
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
  }

  private updateChecks(list: readonly StructureCheck[]): void {
    const key = list.map((c) => `${c.key}${c.have}/${c.need}`).join(',');
    if (key === this.checksKey) return;
    this.checksKey = key;
    this.checks.replaceChildren(
      ...list.map((c) =>
        h('li', { class: 'hw-st__check', attrs: { 'data-ok': c.ok } }, glyph(c.ok ? 'check' : 'close', 12), h('span', { text: checkText(c) })),
      ),
    );
  }

  private updateProblems(list: readonly HearthProblem[], complete: boolean): void {
    setText(this.problemHead, list.length > 0 ? `Problems (${list.length})` : complete ? 'Complete' : 'Problems');
    while (this.problemRows.length > list.length) this.problemRows.pop()?.el.remove();
    list.forEach((p, i) => {
      let row = this.problemRows[i];
      if (!row) {
        const text = h('span', { class: 'hw-st__ptext' });
        const note = h('span', { class: 'hw-st__pnote', text: 'Shown in the world' });
        note.hidden = true;
        const el = h('button', { class: 'hw-st__problem', attrs: { type: 'button' } }, glyph('warn', 14), text, note, glyph('chevron', 12));
        const made: ProblemRow = { el, text, note, problem: p };
        el.addEventListener('click', () => this.highlight(made));
        row = made;
        this.problemRows.push(row);
        this.problemList.appendChild(el);
      }
      row.problem = p;
      setText(row.text, p.text);
      setAttr(row.el, 'aria-label', `${p.text} - show this block in the world`);
    });
    this.none.hidden = list.length > 0;
    setText(this.none, complete ? 'Every block of this hearth is in place.' : 'Nothing wrong with what stands. Place the blocks still missing below.');
  }

  private highlight(row: ProblemRow): void {
    const p = row.problem;
    this.bus.emit('highlight:block', { x: p.x, y: p.y, z: p.z, seconds: HEARTH_HIGHLIGHT_S });
    this.bus.emit('sfx', { name: 'ui_click' });
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

  private choose(target: { tier: number; inner?: [number, number, number] }): void {
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
      if (!this.ghost.show(x, y, z, { tier: t.tier, inner: [...t.inner] })) this.show.set(false);
    } else this.ghost.hide(x, y, z);
    this.update();
  }
}
