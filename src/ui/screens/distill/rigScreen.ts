/**
 * The rig screen (docs/DISTILLERY_PLAN.md §15.1): problems with tap-to-highlight, what the rig can do,
 * and a process picker whose card rig string is ghosted in the world.
 *
 * Opened later by S10 on `{ type: 'distill_rig', x, y, z }` (the type lives in `rigRequest.ts` until C7
 * adds it to `ScreenRequest`). A wrench on glassware is what asks for it; an empty hand stays the
 * crosshair toast. The ghost preview stays after the screen closes, so the player can build against it.
 * It is replaced when another card is picked, and cleared when that card's rig is complete.
 */
import { blockOrNull } from '../../../core/registry';
import { posKey } from '../../../sim/entities';
import { scanRig } from '../../../sim/distillScan';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h, setAttr, setText } from '../../kit/dom';
import { glyph } from '../../kit/icons';
import { Window } from '../../kit/window';
import { injectStationCss } from '../furnace/styles';
import rigCss from './rig.css';
import type { DistillRigRequest } from './rigRequest';
import {
  capabilityText,
  cardChoices,
  ghostCells,
  ghostEvents,
  ghostStep,
  ghostSummary,
  highlightPayload,
  problemGroups,
  type CardChoice,
  type GhostHold,
  type ProblemGroup,
} from './rigLogic';

const STYLE_ID = 'hw-rig-css';
const HINT_MS = 1800;

function injectRigCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = rigCss;
  document.head.appendChild(style);
}

interface ProblemRow {
  el: HTMLButtonElement;
  text: HTMLSpanElement;
  count: HTMLSpanElement;
  note: HTMLSpanElement;
  group: ProblemGroup;
  /** Which of the group's blocks the next tap shows. */
  next: number;
}

export function createRigScreen(request: DistillRigRequest, ctx: ScreenContext): GameScreen | null {
  const { x, y, z } = request;
  const first = scanRig(ctx.world, x, y, z);
  if (!first) return null;
  injectStationCss();
  injectRigCss();

  const here = first.modules.get(posKey(x, y, z));
  const title = (here && blockOrNull(here.kind)?.name) || 'Glassware';
  const choices = cardChoices(here?.kind ?? '');
  const { bus } = ctx;

  const caps = h('p', { class: 'hw-rig__caps' });
  const problemHead = h('h3', { class: 'hw-heading', text: 'Problems' });
  const problemList = h('div', { class: 'hw-st__problems' });
  const none = h('p', { class: 'hw-rig__empty', text: 'Nothing is wrong with this rig.' });
  const rows: ProblemRow[] = [];
  const pickerHead = h('h3', { class: 'hw-heading', text: 'Process' });
  const pickerNote = h('p', { class: 'hw-rig__note' });
  const cardList = h('div', { class: 'hw-rig__cards' });
  const noCards = h('p', {
    class: 'hw-rig__empty',
    text: 'No process card uses this block. Wrench the flask, the vessel or the still base.',
  });
  noCards.hidden = choices.length > 0;
  const buttons = new Map<string, HTMLButtonElement>();
  let selected: CardChoice | null = null;
  let held: GhostHold | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;

  for (const choice of choices) {
    const titleEl = h('span', { class: 'hw-rig__cardtitle', text: choice.title });
    const detailEl = h('span', { class: 'hw-rig__carddetail', text: choice.detail });
    const button = h(
      'button',
      { class: 'hw-rig__card', attrs: { type: 'button', 'aria-pressed': 'false' } },
      titleEl,
      detailEl,
    );
    button.addEventListener('click', () => {
      selected = choice;
      paintCards();
      publish();
      bus.emit('sfx', { name: 'ui_click' });
    });
    buttons.set(choice.id, button);
    cardList.appendChild(button);
  }

  const body = h('div', { class: 'hw-rig' }, caps, problemHead, problemList, none, pickerHead, pickerNote, cardList, noCards);
  const tap = ctx.touch ? 'Tap' : 'Click';
  const window = new Window({
    title,
    subtitle: 'Structure',
    size: 'sm',
    body,
    footer: `${tap} a problem to pulse that block. Pick a process to ghost the blocks still missing. The preview stays after you close this.`,
  });
  window.setAccent('var(--hw-power)');

  function paintCards(): void {
    for (const [id, button] of buttons) {
      const on = selected?.id === id;
      setAttr(button, 'data-on', on ? '' : null);
      setAttr(button, 'aria-pressed', on ? 'true' : 'false');
    }
  }

  function publish(): void {
    if (!selected) return;
    const cells = ghostCells(ctx.world, { x, y, z }, selected.rig);
    const step = ghostStep(held, { cardId: selected.id, cells });
    for (const event of ghostEvents(step)) {
      if (event.type === 'ghost:clear') bus.emit('ghost:clear', { key: event.key });
      else bus.emit('ghost:show', { key: event.key, cells: event.cells });
    }
    switch (step.op) {
      case 'stay':
        break;
      case 'clear':
        held = null;
        break;
      case 'show':
      case 'replace':
        held = { cardId: selected.id, cells: step.cells };
        break;
      default: {
        const exhaustive: never = step;
        return exhaustive;
      }
    }
    if (step.op !== 'stay' || cells.length === 0) setText(pickerNote, `${selected.title}: ${ghostSummary(cells)}`);
  }

  function highlight(row: ProblemRow): void {
    if (row.group.at.length === 0) return;
    const at = row.group.at[row.next % row.group.at.length];
    row.next = (row.next + 1) % row.group.at.length;
    bus.emit('highlight:block', highlightPayload(at));
    bus.emit('sfx', { name: 'ui_click' });
    const n = row.group.at.length;
    const shownIndex = ((row.next + n - 1) % n) + 1;
    setText(row.note, n > 1 ? `Shown in the world - ${shownIndex} of ${n}` : 'Shown in the world');
    for (const other of rows) other.note.hidden = other !== row;
    if (hintTimer !== null) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      row.note.hidden = true;
      hintTimer = null;
    }, HINT_MS);
  }

  function renderProblems(groups: ProblemGroup[]): void {
    setText(problemHead, groups.length > 0 ? `Problems (${groups.length})` : 'Problems');
    while (rows.length > groups.length) rows.pop()?.el.remove();
    groups.forEach((group, i) => {
      let row = rows[i];
      if (!row) {
        const text = h('span', { class: 'hw-st__ptext' });
        const count = h('span', { class: 'hw-st__pcount hw-num' });
        const note = h('span', { class: 'hw-st__pnote', text: 'Shown in the world' });
        note.hidden = true;
        const el = h(
          'button',
          { class: 'hw-st__problem', attrs: { type: 'button' } },
          glyph('warn', 14),
          h('span', { class: 'hw-st__pmain' }, text, count),
          note,
          glyph('chevron', 12),
        );
        const made: ProblemRow = { el, text, count, note, group, next: 0 };
        el.addEventListener('click', () => highlight(made));
        row = made;
        rows.push(row);
        problemList.appendChild(el);
      }
      if (row.group.text !== group.text) row.next = 0;
      row.group = group;
      setText(row.text, group.text);
      setText(row.count, group.at.length > 1 ? `×${group.at.length}` : '');
      row.count.hidden = group.at.length < 2;
      setAttr(row.el, 'aria-label', `${group.text}${group.at.length > 1 ? ` (${group.at.length} blocks)` : ''} - show it in the world`);
    });
    none.hidden = groups.length > 0;
  }

  function refresh(): void {
    const rig = scanRig(ctx.world, x, y, z);
    if (!rig) {
      ctx.close();
      return;
    }
    setText(caps, capabilityText(rig));
    renderProblems(problemGroups(rig.problems));
    publish();
  }

  return {
    window,
    refresh,
    dispose: () => {
      if (hintTimer !== null) clearTimeout(hintTimer);
      // ghostStep(held, null) is 'stay': closing does not emit ghost:clear.
      rows.length = 0;
      buttons.clear();
    },
  };
}
