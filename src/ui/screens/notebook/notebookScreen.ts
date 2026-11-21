/**
 * The Field Notebook (docs/api/magic.md): Research (entries and their 5 x 5 boards), Aspects (what you know and your lore),
 * Notes (what you scanned; scan the things you carry). Phone first: 44 px cells and chips, tap a cell then an aspect.
 * Talks to the game only through NotebookApi (src/magic/magic.ts, type import).
 */
import { itemOrNull } from '../../../core/registry';
import { ASPECT_LIST, aspectInfo, aspectsText, type Aspect } from '../../../magic/aspects';
import { BOARD_CELLS, BOARD_W } from '../../../magic/board';
import { aspectsOf } from '../../../magic/fingerprint';
import type { NotebookApi } from '../../../magic/magic';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const CSS = `
.hw-nb{display:flex;flex-direction:column;gap:10px;padding:4px 2px 12px}
.hw-nb__list{display:flex;flex-wrap:wrap;gap:6px}
.hw-nb__entry{min-height:44px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font:inherit;text-align:left}
.hw-nb__entry[data-status=done]{border-color:#5cc060;background:rgba(92,192,96,.16)}
.hw-nb__entry[data-status=locked]{opacity:.45}
.hw-nb__entry[aria-pressed=true]{outline:2px solid #ffd95a}
.hw-nb__text{margin:0;line-height:1.35;opacity:.9}
.hw-nb__board{display:grid;grid-template-columns:repeat(${BOARD_W},44px);gap:4px;justify-content:center}
.hw-nb__cell{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:#111;font:600 10px/1 sans-serif;padding:0;overflow:hidden}
.hw-nb__cell[data-kind=anchor]{border:3px solid #fff}
.hw-nb__cell[data-kind=blocked]{visibility:hidden}
.hw-nb__cell[data-sel=true]{outline:3px solid #ffd95a}
.hw-nb__cell[data-linked=true]{box-shadow:0 0 10px 2px rgba(255,217,90,.7)}
.hw-nb__palette{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.hw-nb__chip{min-width:44px;min-height:44px;border-radius:22px;border:1px solid rgba(0,0,0,.4);color:#111;font:600 12px/1.1 sans-serif;padding:4px 10px}
.hw-nb__chip:disabled{opacity:.35}
.hw-nb__row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.hw-nb__btn{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:inherit;font:inherit}
.hw-nb__aspect{display:flex;align-items:center;gap:8px;min-height:32px}
.hw-nb__dot{width:18px;height:18px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.5)}
.hw-nb__muted{opacity:.6}
`;

function injectCss(): void {
  if (document.getElementById('hw-notebook-css')) return;
  const style = document.createElement('style');
  style.id = 'hw-notebook-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

type Tab = 'research' | 'aspects' | 'notes';

export function createNotebookScreen(ctx: ScreenContext, api: NotebookApi): GameScreen {
  injectCss();
  let tab: Tab = 'research';
  let entry: string | null = null;
  let selected: number | null = null;
  let message = '';
  let signature = '';
  const body = h('div', { class: 'hw-nb' });
  const window = new Window({
    title: 'Field Notebook', size: 'md', fit: 'tall', body,
    tabs: [{ id: 'research', label: 'Research' }, { id: 'aspects', label: 'Aspects' }, { id: 'notes', label: 'Notes' }],
    activeTab: 'research',
    onTab: (id) => {
      tab = id as Tab;
      render();
    },
  });

  const say = (text: string): void => {
    message = text;
    render();
  };

  function button(label: string, onClick: () => void, cls = 'hw-nb__btn'): HTMLButtonElement {
    const b = h('button', { class: cls, text: label, attrs: { type: 'button' } });
    b.addEventListener('click', onClick);
    return b;
  }

  function renderResearch(): HTMLElement[] {
    const out: HTMLElement[] = [];
    const entries = api.entries();
    if (!entry || !entries.some((e) => e.key === entry)) entry = (entries.find((e) => e.status === 'open') ?? entries[0]).key;
    const list = h('div', { class: 'hw-nb__list', attrs: { role: 'group', 'aria-label': 'Research entries' } });
    for (const e of entries) {
      const b = button(`${e.title}${e.status === 'done' ? ' ✓' : e.status === 'locked' ? ' (locked)' : ''}`, () => {
        entry = e.key;
        selected = null;
        message = '';
        render();
      }, 'hw-nb__entry');
      b.dataset.status = e.status;
      b.dataset.entry = e.key;
      b.setAttribute('aria-pressed', String(e.key === entry));
      list.appendChild(b);
    }
    out.push(list);
    const e = entries.find((x) => x.key === entry)!;
    out.push(h('p', { class: 'hw-nb__text', text: e.text }));
    if (e.status === 'locked') {
      out.push(h('p', { class: 'hw-nb__muted', text: 'Finish the research before it first.' }));
      return out;
    }
    if (!e.board) {
      out.push(h('p', { class: 'hw-nb__muted', text: e.status === 'done' ? 'Done.' : 'Scan anything with the notebook to begin.' }));
      return out;
    }
    const research = api.research();
    const tokens = research.entries[e.key]?.tokens ?? {};
    const board = h('div', { class: 'hw-nb__board', attrs: { role: 'grid', 'aria-label': 'Research board' } });
    for (let c = 0; c < BOARD_CELLS; c++) {
      const anchor = e.board.anchors.find((a) => a.cell === c);
      const blocked = (e.board.blocked ?? []).includes(c);
      const aspect: Aspect | undefined = anchor?.aspect ?? tokens[c];
      const cell = h('button', { class: 'hw-nb__cell', attrs: { type: 'button', 'data-cell': String(c) } });
      cell.dataset.kind = anchor ? 'anchor' : blocked ? 'blocked' : aspect ? 'token' : 'free';
      if (aspect) {
        cell.style.background = aspectInfo(aspect).color;
        cell.textContent = aspectInfo(aspect).name;
        cell.setAttribute('aria-label', aspectInfo(aspect).name);
      } else cell.setAttribute('aria-label', 'Empty');
      if (selected === c) cell.dataset.sel = 'true';
      if (!anchor && !blocked && e.status !== 'done') cell.addEventListener('click', () => {
        selected = selected === c ? null : c;
        render();
      });
      board.appendChild(cell);
    }
    out.push(board);
    if (e.status === 'done') {
      out.push(h('p', { class: 'hw-nb__text', text: 'Done: what it teaches is yours.' }));
      return out;
    }
    const palette = h('div', { class: 'hw-nb__palette', attrs: { role: 'group', 'aria-label': 'Your aspects' } });
    for (const a of research.known) {
      const lore = research.lore[a] ?? 0;
      const chip = button(`${aspectInfo(a).name} ${lore}`, () => {
        if (selected === null) return say('Tap an empty circle on the board first.');
        const r = api.place(e.key, selected, a);
        selected = null;
        say(r.ok ? (r.solved ? 'Solved!' : '') : r.reason ?? '');
      }, 'hw-nb__chip');
      chip.style.background = aspectInfo(a).color;
      chip.dataset.aspect = a;
      chip.disabled = lore < 1;
      palette.appendChild(chip);
    }
    out.push(palette);
    const row = h('div', { class: 'hw-nb__row' });
    if (selected !== null && tokens[selected]) row.appendChild(button('Take back', () => {
      api.remove(e.key, selected as number);
      selected = null;
      render();
    }));
    row.appendChild(button('Hint', () => {
      const hint = api.hint(e.key);
      if (!hint) return say('No way through with the aspects you know: scan more things.');
      selected = hint.cell;
      say(`Try ${aspectInfo(hint.aspect).name} on the marked circle.`);
    }));
    out.push(row);
    out.push(h('p', { class: 'hw-nb__muted', text: 'Join the fixed circles. Neighbours must be kin: the same aspect, or one made from the other.' }));
    return out;
  }

  function renderAspects(): HTMLElement[] {
    const r = api.research();
    const out: HTMLElement[] = [];
    for (const a of ASPECT_LIST) {
      const info = aspectInfo(a);
      const known = r.known.includes(a);
      const parts = info.parts ? ` = ${aspectInfo(info.parts[0]).name} + ${aspectInfo(info.parts[1]).name}` : ' (primal)';
      const dot = h('span', { class: 'hw-nb__dot' });
      dot.style.background = known ? info.color : 'transparent';
      out.push(h('div', { class: ['hw-nb__aspect', known ? '' : 'hw-nb__muted'] }, dot,
        h('span', { text: known ? `${info.name}${parts}: ${info.meaning}. Lore ${r.lore[a] ?? 0}` : 'Unknown aspect' })));
    }
    return out;
  }

  function renderNotes(): HTMLElement[] {
    const r = api.research();
    const out: HTMLElement[] = [h('p', { class: 'hw-nb__text', text: `${r.scanned.length} things noted. Aim the notebook at a block and press Use to note it; things you carry are noted here.` })];
    const carried = new Set<string>();
    for (const s of ctx.player.inventory.toJSON()) if (s) carried.add(s.item);
    const fresh = [...carried].filter((k) => !r.scanned.includes(k));
    const row = h('div', { class: 'hw-nb__row' });
    for (const k of fresh) {
      const b = button(`Note ${itemOrNull(k)?.name ?? k}`, () => say(api.scanItem(k)));
      b.dataset.scan = k;
      row.appendChild(b);
    }
    if (fresh.length) out.push(row);
    for (const k of [...r.scanned].reverse().slice(0, 60)) {
      out.push(h('div', { class: 'hw-nb__aspect' }, h('span', { text: `${itemOrNull(k)?.name ?? k}: ${aspectsText(aspectsOf(k))}` })));
    }
    return out;
  }

  function render(): void {
    const parts = tab === 'research' ? renderResearch() : tab === 'aspects' ? renderAspects() : renderNotes();
    if (message) parts.push(h('p', { class: 'hw-nb__text', text: message, attrs: { role: 'status' } }));
    body.replaceChildren(...parts);
    signature = JSON.stringify(api.research());
  }
  render();

  return {
    window,
    refresh: () => {
      if (JSON.stringify(api.research()) !== signature) render();
    },
    dispose: () => undefined,
  };
}
