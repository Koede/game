/**
 * The Field Notebook (docs/api/magic.md), Thaumcraft style. Research: a map per age, each node joined to what it needs;
 * an entry's notes are begun for lore, then worked at a Research Table on a hexagon (tap a hex, then an aspect; each costs
 * one lore and one ink). Aspects (what you know and your lore), Notes (scan what you carry), Goals.
 * Talks to the game only through NotebookApi (src/magic/magic.ts, type import).
 */
import { enchantDef } from '../../../core/enchant';
import { itemOrNull } from '../../../core/registry';
import { aspectIcon, aspectLabel, aspectsRow } from '../../kit/aspectIcon';
import { ASPECT_LIST, aspectInfo, aspectsText, linkable, type Aspect } from '../../../magic/aspects';
import { cellCount, hexCoord, linkedFrom, neighbours, type BoardSpec, type BoardTokens } from '../../../magic/board';
import { aspectsOf } from '../../../magic/fingerprint';
import type { NotebookApi } from '../../../magic/magic';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { SearchBox, matches } from '../../kit/search';
import { Window } from '../../kit/window';

const CSS = `
.hw-nb{display:flex;flex-direction:column;gap:10px;padding:4px 2px 12px}
.hw-nb__list{display:flex;flex-wrap:wrap;gap:6px}
.hw-nb__entry{min-height:44px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font:inherit;text-align:left}
.hw-nb__entry[data-status=done]{border-color:#5cc060;background:rgba(92,192,96,.16)}
.hw-nb__entry[data-status=locked]{opacity:.45}
.hw-nb__entry[aria-pressed=true]{outline:2px solid #ffd95a}
.hw-nb__text{margin:0;line-height:1.35;opacity:.9}
.hw-nb__mapwrap{display:flex;flex-direction:column;gap:6px}
.hw-nb__agebtn{min-height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:inherit;font:inherit}
.hw-nb__agebtn[aria-pressed=true]{background:rgba(255,217,90,.25);border-color:#ffd95a}
.hw-nb__mapscroll{overflow:auto;max-height:46vh;border-radius:10px;background:radial-gradient(circle at 30% 20%,rgba(120,90,160,.25),rgba(10,8,20,.6));border:1px solid rgba(255,255,255,.12)}
.hw-nb__map{position:relative;margin:0 auto}
.hw-nb__lines{position:absolute;left:0;top:0;pointer-events:none}
.hw-nb__lines path,.hw-nb__lines line{stroke:rgba(255,255,255,.22);stroke-width:2;fill:none}
.hw-nb__lines .is-lit{stroke:#e9c86a;stroke-width:3;filter:drop-shadow(0 0 3px rgba(255,210,90,.8))}
.hw-nb__node{position:absolute;transform:translate(-50%,-22px);width:88px;display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:0;padding:0;color:inherit;font:inherit}
.hw-nb__orb{width:44px;height:44px;border-radius:50%;border:3px solid rgba(20,14,30,.9);box-shadow:0 0 0 2px rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font:700 18px/1 sans-serif;color:#fff;text-shadow:0 1px 2px #000}
.hw-nb__node[data-status=done] .hw-nb__orb{box-shadow:0 0 0 2px #e9c86a,0 0 12px 3px rgba(255,210,90,.6)}
.hw-nb__node[data-status=begun] .hw-nb__orb{box-shadow:0 0 0 2px #b48cff,0 0 10px 2px rgba(180,140,255,.6)}
.hw-nb__node[data-status=locked]{opacity:.45}
.hw-nb__node[aria-pressed=true] .hw-nb__orb{outline:3px solid #ffd95a;outline-offset:2px}
.hw-nb__label{font-size:11px;line-height:1.1;text-align:center;text-shadow:0 1px 2px #000}
.hw-nb__title{margin:0;font-weight:700;font-size:16px}
.hw-nb__hexwrap{display:flex;justify-content:center;padding:6px 0;border-radius:10px;background:#e8dcbc;background-image:radial-gradient(rgba(120,90,40,.18) 1px,transparent 1px);background-size:6px 6px}
.hw-nb__hex{position:relative}
.hw-nb__hex .hw-nb__lines line{stroke:rgba(60,40,20,.35)}
.hw-nb__hex .hw-nb__lines .is-lit{stroke:#7a3fd0;filter:drop-shadow(0 0 3px rgba(150,90,255,.8))}
.hw-nb__cell{position:absolute;border-radius:50%;border:1px solid rgba(60,40,20,.35);background:rgba(60,40,20,.08);color:#111;font:600 10px/1 sans-serif;padding:0;overflow:hidden}
.hw-nb__cell[data-kind=anchor]{border:3px solid #3a2a50}
.hw-nb__cell[data-kind=blocked]{background:radial-gradient(circle,#1b1410 55%,rgba(27,20,16,.6) 70%,transparent 72%);border:0}
.hw-nb__ink{margin:0;text-align:center;font-size:13px}
.hw-nb__ink.is-dry{color:#ff9a6a}
.hw-nb__cell[data-sel=true]{outline:3px solid #ffd95a}
.hw-nb__cell[data-linked=true]{box-shadow:0 0 10px 2px rgba(255,217,90,.7)}
.hw-nb__palette{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.hw-nb__chip{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:44px;min-height:44px;border-radius:22px;border:1px solid rgba(0,0,0,.4);color:#111;font:600 12px/1.1 sans-serif;padding:4px 10px}
.hw-nb__chip:disabled{opacity:.35}
.hw-nb__row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.hw-nb__btn{min-height:44px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:inherit;font:inherit}
.hw-nb__aspect{display:flex;align-items:center;gap:8px;min-height:32px}
.hw-nb__dot{width:18px;height:18px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.5)}
.hw-nb__muted{opacity:.6}
.hw-nb__btn:disabled{opacity:.4}
.hw-nb__age{margin:6px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;width:100%}
.hw-nb__recipe{display:flex;gap:10px;align-items:center;padding:8px;border-radius:8px;background:rgba(255,255,255,.05)}
.hw-nb__recipe-body{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
.hw-nb__needs{display:flex;flex-wrap:wrap;gap:4px}
.hw-nb__need{font-size:12px;padding:2px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.25)}
.hw-nb__need.is-ok{background:rgba(92,192,96,.22)}
.hw-nb__need.is-short{background:rgba(232,98,42,.22)}
.hw-nb__ok{color:#8fe08f;font-size:12px}
.hw-nb__goal{display:flex;gap:8px;align-items:center;min-height:32px}
.hw-nb--inner{padding:0}
.hw-nb__find{display:flex;flex-direction:column;gap:8px}
.hw-nb__hit{display:flex;flex-direction:column;gap:2px;min-height:44px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font:inherit;text-align:left}
.hw-nb__hit[data-status=done]{border-color:#5cc060}
.hw-nb__hit[data-status=locked]{opacity:.5}
.hw-nb__hit small{opacity:.7}
.hw-nb__h{margin:6px 0 0;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
`;


/** The next hex to write on after `from`: an open neighbour first, else the next open hex in order, else none. */
function nextOpenHex(board: BoardSpec, tokens: BoardTokens, from: number): number | null {
  const open = (c: number): boolean => !board.anchors.some((a) => a.cell === c) && !(board.blocked ?? []).includes(c) && !tokens[c];
  const near = neighbours(board, from).find(open);
  if (near !== undefined) return near;
  for (let c = from + 1; c < cellCount(board.radius); c++) if (open(c)) return c;
  return null;
}

export function injectNotebookCss(): void {
  if (document.getElementById('hw-notebook-css')) return;
  const style = document.createElement('style');
  style.id = 'hw-notebook-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

type Tab = 'research' | 'lore' | 'goals';
type StatusFilter = 'all' | 'open' | 'begun' | 'done' | 'locked';
const STATUS_FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'open', label: 'Ready' }, { id: 'begun', label: 'Begun' }, { id: 'done', label: 'Done' }, { id: 'locked', label: 'Locked' },
];

type Entry = ReturnType<NotebookApi['entries']>[number];
const SVG = 'http://www.w3.org/2000/svg';
const MAP_X0 = 52;
const MAP_Y0 = 34;
const MAP_DX = 104;
const MAP_DY = 78;
const BOARD_PX = 330;

/** `table`: opened at a Research Table, where begun notes can be written on. */
export function createNotebookScreen(ctx: ScreenContext, api: NotebookApi, table = false): GameScreen {
  injectNotebookCss();
  let tab: Tab = 'research';
  let age: string | null = null;
  let entry: string | null = null;
  let selected: number | null = null;
  let message = '';
  let query = '';
  let status: StatusFilter = 'all';
  let signature = '';
  const content = h('div', { class: 'hw-nb hw-nb--inner' });
  const search = new SearchBox({
    label: 'Search the notebook',
    placeholder: 'Search this notebook',
    onInput: (q) => {
      query = q;
      render();
    },
  });
  const body = h('div', { class: 'hw-nb' }, search.el, content);
  const window = new Window({
    title: table ? 'Research Table' : 'Field Notebook', size: 'md', fit: 'tall', body,
    tabs: [{ id: 'research', label: 'Research' }, { id: 'lore', label: 'Lore' }, { id: 'goals', label: 'Goals' }],
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

  /** Map column of each entry within its age: one past its deepest same-age requirement. */
  function columns(entries: Entry[]): Map<string, number> {
    const col = new Map<string, number>();
    const byKey = new Map(entries.map((e) => [e.key, e]));
    const depth = (e: Entry): number => {
      const known = col.get(e.key);
      if (known !== undefined) return known;
      let d = 0;
      for (const k of e.requires) {
        const r = byKey.get(k);
        if (r && r.age === e.age) d = Math.max(d, depth(r) + 1);
      }
      col.set(e.key, d);
      return d;
    };
    entries.forEach(depth);
    return col;
  }

  function renderMap(entries: Entry[]): HTMLElement {
    const ages = [...new Set(entries.map((e) => e.age))];
    const current = entries.find((e) => e.key === entry);
    if (!age || !ages.includes(age)) age = current?.age ?? ages[0];
    const wrap = h('div', { class: 'hw-nb__mapwrap' });
    const tabs = h('div', { class: 'hw-nb__row', attrs: { role: 'group', 'aria-label': 'Ages' } });
    for (const a of ages) {
      const b = button(`${a[0].toUpperCase()}${a.slice(1)}`, () => {
        age = a;
        render();
      }, 'hw-nb__agebtn');
      b.dataset.age = a;
      b.setAttribute('aria-pressed', String(a === age));
      tabs.appendChild(b);
    }
    wrap.appendChild(tabs);
    const here = entries.filter((e) => e.age === age);
    const col = columns(entries);
    const rows = new Map<number, number>();
    const pos = new Map<string, [number, number]>();
    for (const e of here) {
      const c = col.get(e.key) ?? 0;
      const r = rows.get(c) ?? 0;
      rows.set(c, r + 1);
      pos.set(e.key, [MAP_X0 + c * MAP_DX, MAP_Y0 + r * MAP_DY]);
    }
    const w = Math.max(...[...pos.values()].map((p) => p[0])) + MAP_X0;
    const hgt = Math.max(...[...pos.values()].map((p) => p[1])) + MAP_Y0 + 14;
    const map = h('div', { class: 'hw-nb__map', attrs: { role: 'group', 'aria-label': 'Research map' } });
    map.style.width = `${w}px`;
    map.style.height = `${hgt}px`;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(hgt));
    svg.classList.add('hw-nb__lines');
    const done = new Set(entries.filter((e) => e.status === 'done').map((e) => e.key));
    for (const e of here) {
      const [x2, y2] = pos.get(e.key) as [number, number];
      for (const k of e.requires) {
        const from = pos.get(k);
        if (!from) continue;
        const line = document.createElementNS(SVG, 'path');
        const mx = (from[0] + x2) / 2;
        line.setAttribute('d', `M${from[0]},${from[1]} C${mx},${from[1]} ${mx},${y2} ${x2},${y2}`);
        if (done.has(k)) line.setAttribute('class', 'is-lit');
        svg.appendChild(line);
      }
    }
    map.appendChild(svg);
    for (const e of here) {
      const [x, y] = pos.get(e.key) as [number, number];
      const hidden = e.status === 'locked' && !e.requires.some((k) => done.has(k));
      const node = button('', () => {
        entry = e.key;
        selected = null;
        message = '';
        render();
      }, 'hw-nb__node');
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.dataset.status = e.status;
      node.dataset.entry = e.key;
      node.setAttribute('aria-pressed', String(e.key === entry));
      node.setAttribute('aria-label', hidden ? 'Unknown research' : `${e.title}, ${e.status}`);
      const cost = Object.keys(e.cost) as Aspect[];
      const ring = cost.length
        ? `conic-gradient(${cost.map((a, i) => `${aspectInfo(a).color} ${(i * 100) / cost.length}% ${((i + 1) * 100) / cost.length}%`).join(',')})`
        : '#c9b27a';
      const orb = h('span', { class: 'hw-nb__orb', text: hidden ? '?' : e.status === 'done' ? '✓' : '' });
      orb.style.background = hidden ? '#333' : ring;
      node.append(orb, h('span', { class: 'hw-nb__label', text: hidden ? '???' : e.title }));
      map.appendChild(node);
    }
    wrap.appendChild(h('div', { class: 'hw-nb__mapscroll' }, map));
    return wrap;
  }

  function renderBoard(e: Entry, board: BoardSpec, writable: boolean): HTMLElement {
    const research = api.research();
    const tokens = research.entries[e.key]?.tokens ?? {};
    const R = board.radius;
    const D = Math.min(50, Math.floor(BOARD_PX / (2 * R + 1)));
    const linked = linkedFrom(board, tokens, board.anchors[0].cell);
    const at = (c: number): Aspect | undefined => board.anchors.find((a) => a.cell === c)?.aspect ?? tokens[c];
    const xy = (c: number): [number, number] => {
      const [q, r] = hexCoord(R, c);
      return [(q + r / 2 + R) * D + D / 2, (r + R) * D * 0.88 + D / 2];
    };
    const width = (2 * R + 1) * D;
    const height = 2 * R * D * 0.88 + D;
    const wrap = h('div', { class: 'hw-nb__hex', attrs: { role: 'grid', 'aria-label': 'Research notes' } });
    wrap.style.width = `${width}px`;
    wrap.style.height = `${height}px`;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.classList.add('hw-nb__lines');
    for (let c = 0; c < cellCount(R); c++) {
      const a = at(c);
      if (!a) continue;
      for (const n of neighbours(board, c)) {
        const b = at(n);
        if (n < c || !b || !linkable(a, b)) continue;
        const [x1, y1] = xy(c);
        const [x2, y2] = xy(n);
        const line = document.createElementNS(SVG, 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        if (linked.has(c) && linked.has(n)) line.setAttribute('class', 'is-lit');
        svg.appendChild(line);
      }
    }
    wrap.appendChild(svg);
    for (let c = 0; c < cellCount(R); c++) {
      const anchor = board.anchors.some((a) => a.cell === c);
      const blocked = (board.blocked ?? []).includes(c);
      const aspect = at(c);
      const cell = h('button', { class: 'hw-nb__cell', attrs: { type: 'button', 'data-cell': String(c) } });
      const [x, y] = xy(c);
      cell.style.left = `${x - D / 2 + 2}px`;
      cell.style.top = `${y - D / 2 + 2}px`;
      cell.style.width = `${D - 4}px`;
      cell.style.height = `${D - 4}px`;
      cell.dataset.kind = anchor ? 'anchor' : blocked ? 'blocked' : aspect ? 'token' : 'free';
      if (aspect) {
        const info = aspectInfo(aspect);
        cell.style.background = 'radial-gradient(circle,#3a2f46 0%,#1f1826 100%)';
        cell.style.border = `3px solid ${info.color}`;
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.appendChild(aspectIcon(aspect, Math.max(16, Math.min(32, D - 12))));
        cell.setAttribute('aria-label', info.name);
        if (linked.has(c)) cell.dataset.linked = 'true';
      } else cell.setAttribute('aria-label', blocked ? 'Ink blot' : 'Empty');
      if (selected === c) cell.dataset.sel = 'true';
      if (writable && !anchor && !blocked) cell.addEventListener('click', () => {
        // Tapping the selected hex again clears what is written on it (no lore comes back).
        if (selected === c && tokens[c]) {
          api.remove(e.key, c);
          selected = null;
          say('Erased. The lore it took is gone.');
          return;
        }
        selected = selected === c ? null : c;
        render();
      });
      wrap.appendChild(cell);
    }
    return h('div', { class: 'hw-nb__hexwrap' }, wrap);
  }

  function renderCombine(): HTMLElement[] {
    const r = api.research();
    const rows: HTMLElement[] = [];
    for (const a of ASPECT_LIST) {
      const parts = aspectInfo(a).parts;
      if (!parts || !r.known.includes(parts[0]) || !r.known.includes(parts[1])) continue;
      const [p, q] = parts;
      const b = button(`${aspectInfo(p).name} + ${aspectInfo(q).name} → ${r.known.includes(a) ? aspectInfo(a).name : '?'}`, () => {
        const res = api.combine(p, q);
        say(res.ok ? `Made 1 ${aspectInfo(res.made as Aspect).name} lore.` : res.reason ?? '');
      }, 'hw-nb__chip');
      b.style.background = `linear-gradient(90deg, ${aspectInfo(p).color}, ${aspectInfo(q).color})`;
      b.prepend(aspectIcon(p, 16), aspectIcon(q, 16));
      b.dataset.combine = a;
      b.disabled = (r.lore[p] ?? 0) < 1 || (r.lore[q] ?? 0) < 1;
      rows.push(b);
    }
    if (!rows.length) return [];
    return [h('p', { class: 'hw-nb__age', text: 'Combine lore' }), h('div', { class: 'hw-nb__palette' }, ...rows)];
  }

  /** What an entry's search looks through: title, text, the age, its status and the names of the aspects it costs. */
  function entryText(e: Entry): string {
    const hidden = e.status === 'locked' && !api.entries().some((x) => e.requires.includes(x.key) && x.status === 'done');
    if (hidden) return '';
    return `${e.title} ${e.text} ${e.age} ${(Object.keys(e.cost) as Aspect[]).map((a) => aspectInfo(a).name).join(' ')}`;
  }

  function renderFilters(entries: Entry[]): HTMLElement {
    const row = h('div', { class: 'hw-nb__row', attrs: { role: 'group', 'aria-label': 'Show entries' } });
    for (const f of STATUS_FILTERS) {
      const n = f.id === 'all' ? entries.length : entries.filter((e) => e.status === f.id).length;
      if (f.id !== 'all' && f.id !== status && n === 0) continue;
      const b = button(`${f.label} ${n}`, () => {
        status = f.id;
        render();
      }, 'hw-nb__agebtn');
      b.dataset.filter = f.id;
      b.setAttribute('aria-pressed', String(f.id === status));
      row.appendChild(b);
    }
    return row;
  }

  /** The entries that fit the search and the status filter, as a list across every age; a tap opens one. */
  function renderHits(entries: Entry[]): HTMLElement {
    const hits = entries.filter((e) => (status === 'all' || e.status === status) && matches(query, entryText(e)));
    const list = h('div', { class: 'hw-nb__find', attrs: { role: 'list', 'aria-label': 'Matching research' } });
    if (!hits.length) list.appendChild(h('p', { class: 'hw-nb__muted', text: 'No research matches. Try another word, or pick All.' }));
    for (const e of hits) {
      const hidden = entryText(e) === '';
      const b = h('button', { class: 'hw-nb__hit', attrs: { type: 'button', role: 'listitem', 'data-hit': e.key } },
        h('strong', { text: hidden ? '???' : e.title }), h('small', { text: `${e.age[0].toUpperCase()}${e.age.slice(1)} - ${e.status === 'open' ? 'ready to begin' : e.status}` }));
      b.dataset.status = e.status;
      b.addEventListener('click', () => {
        entry = e.key;
        age = e.age;
        selected = null;
        message = '';
        query = '';
        status = 'all';
        search.set('');
        render();
      });
      list.appendChild(b);
    }
    return list;
  }

  function renderResearch(): HTMLElement[] {
    const out: HTMLElement[] = [];
    const entries = api.entries();
    if (!entry || !entries.some((e) => e.key === entry)) {
      entry = (entries.find((e) => e.status === 'begun') ?? entries.find((e) => e.status === 'open') ?? entries[0]).key;
    }
    const filtering = query.trim() !== '' || status !== 'all';
    out.push(renderFilters(entries));
    if (filtering) out.push(renderHits(entries));
    else out.push(renderMap(entries));
    const e = entries.find((x) => x.key === entry) as Entry;
    out.push(h('p', { class: 'hw-nb__title', text: e.title }), h('p', { class: 'hw-nb__text', text: e.text }));
    if (e.status === 'locked') {
      const names = e.requires.map((k) => entries.find((x) => x.key === k)?.title ?? k);
      out.push(h('p', { class: 'hw-nb__muted', text: `Needs first: ${names.join(', ')}.` }));
      return out;
    }
    if (e.learn) {
      // An enchant note (src/magic/entries.ts): the altar writes it on the first success, and only then names the aspect.
      if (e.learn.practice) {
        // An insight note (research by doing): written by use, so it shows the count instead of a board.
        const pr = e.learn.practice;
        const n = Math.min(pr.need, api.research().practice?.[pr.key] ?? 0);
        out.push(h('p', { class: 'hw-nb__muted', text: e.status === 'done' ? `Insight gained: ${pr.need} ${pr.what}.` : `Learned by doing: ${n} of ${pr.need} ${pr.what}.` }));
        return out;
      }
      const def = e.learn.enchant ? enchantDef(e.learn.enchant) : null;
      if (e.status === 'done' && def) out.push(h('p', { class: 'hw-nb__text', text: `${def.description} It wants ${aspectInfo(def.aspect).name} (${def.cost.perLevel} per level).` }));
      else out.push(h('p', { class: 'hw-nb__muted', text: 'Not written yet. Put a tool on the altar with no recipe and the essentia it wants near it.' }));
      return out;
    }
    if (!e.board) {
      out.push(h('p', { class: 'hw-nb__muted', text: e.status === 'done' ? 'Done.' : 'Scan anything with the notebook to begin.' }));
      return out;
    }
    const research = api.research();
    if (e.status === 'open') {
      const needs = h('div', { class: 'hw-nb__needs' });
      for (const [a, n] of Object.entries(e.cost) as [Aspect, number][]) {
        const known = research.known.includes(a);
        const ok = known && (research.lore[a] ?? 0) >= n;
        const need = h('span', { class: ['hw-nb__need', ok ? 'is-ok' : 'is-short'] });
        need.append(known ? aspectLabel(a, `${aspectInfo(a).name} ${n} (have ${research.lore[a] ?? 0})`) : `? ${n} (have ${research.lore[a] ?? 0})`);
        needs.appendChild(need);
      }
      out.push(h('p', { class: 'hw-nb__muted', text: 'Starting the notes costs lore:' }), needs);
      const begin = button('Begin research', () => {
        const r = api.begin(e.key);
        say(r.ok ? 'Notes started: work them at a Research Table.' : r.reason ?? '');
      });
      begin.dataset.begin = e.key;
      begin.disabled = e.short.length > 0;
      out.push(h('div', { class: 'hw-nb__row' }, begin));
      return out;
    }
    const writable = table && e.status === 'begun';
    out.push(renderBoard(e, e.board, writable));
    if (e.status === 'done') {
      out.push(h('p', { class: 'hw-nb__text', text: 'Done: what it teaches is yours.' }));
      return out;
    }
    if (!writable) {
      out.push(h('p', { class: 'hw-nb__muted', text: 'Work these notes at a Research Table, with scribing tools in your pack.' }));
      return out;
    }
    const ink = api.ink();
    out.push(h('p', { class: ['hw-nb__ink', ink > 0 ? '' : 'is-dry'], text: ink > 0 ? `Ink: ${ink}` : 'No ink: craft Scribing Tools (stick, charcoal, fiber).' }));
    const palette = h('div', { class: 'hw-nb__palette', attrs: { role: 'group', 'aria-label': 'Your aspects' } });
    for (const a of research.known) {
      const lore = research.lore[a] ?? 0;
      const chip = button(`${aspectInfo(a).name} ${lore}`, () => {
        if (selected === null) return say('Tap an empty hex on the notes first.');
        const at0 = selected;
        const r = api.place(e.key, at0, a);
        // Keep going: the selection walks to the next open hex (a free neighbour first, so a chain grows as you tap).
        selected = r.ok ? nextOpenHex(e.board!, tokens, at0 as number) : null;
        say(r.ok ? (r.solved ? 'Research complete!' : '') : r.reason ?? '');
      }, 'hw-nb__chip');
      chip.style.background = aspectInfo(a).color;
      chip.prepend(aspectIcon(a, 22));
      chip.dataset.aspect = a;
      chip.disabled = lore < 1 || ink < 1;
      palette.appendChild(chip);
    }
    out.push(palette);
    const tokens = research.entries[e.key]?.tokens ?? {};
    const row = h('div', { class: 'hw-nb__row' });
    if (selected !== null && tokens[selected]) row.appendChild(button('Erase', () => {
      api.remove(e.key, selected as number);
      selected = null;
      say('Erased. The lore it took is gone.');
    }));
    row.appendChild(button('Hint', () => {
      const hint = api.hint(e.key);
      if (!hint) return say('No way through with the aspects you know: scan more things.');
      selected = hint.cell;
      say(`Try ${aspectInfo(hint.aspect).name} on the marked hex.`);
    }));
    out.push(row);
    out.push(...renderCombine());
    out.push(h('p', {
      class: 'hw-nb__muted',
      text: 'Join every fixed aspect. Touching aspects link only when one is made from the other; an aspect never links to itself. Each written aspect spends one lore and one ink; erasing gives nothing back.',
    }));
    return out;
  }

  function renderAspects(): HTMLElement[] {
    const r = api.research();
    const out: HTMLElement[] = [h('p', { class: 'hw-nb__h', text: 'Aspects' })];
    let shown = 0;
    let unknown = 0;
    for (const a of ASPECT_LIST) {
      const info = aspectInfo(a);
      const known = r.known.includes(a);
      if (query.trim() && !(known && matches(query, info.name, info.meaning, info.parts?.map((p) => aspectInfo(p).name).join(' ')))) continue;
      if (!known) {
        unknown++;
        continue;
      }
      shown++;
      const parts = info.parts ? ` = ${aspectInfo(info.parts[0]).name} + ${aspectInfo(info.parts[1]).name}` : ' (primal)';
      const dot = known ? aspectIcon(a, 24) : h('span', { class: 'hw-nb__dot' });
      out.push(h('div', { class: ['hw-nb__aspect', known ? '' : 'hw-nb__muted'] }, dot,
        h('span', { text: known ? `${info.name}${parts}: ${info.meaning}. Lore ${r.lore[a] ?? 0}` : 'Unknown aspect' })));
    }
    if (!shown) out.push(h('p', { class: 'hw-nb__muted', text: query.trim() ? 'No known aspect matches.' : 'No aspects known yet: note things with the notebook.' }));
    else if (unknown) out.push(h('p', { class: 'hw-nb__muted', text: `${unknown} more aspect${unknown === 1 ? '' : 's'} still unknown.` }));
    return out;
  }

  function renderNotes(): HTMLElement[] {
    const r = api.research();
    const out: HTMLElement[] = [h('p', { class: 'hw-nb__h', text: 'Noted things' }), h('p', { class: 'hw-nb__text', text: `${r.scanned.length} things noted. Aim the notebook at a block and press Use to note it; things you carry are noted here.` })];
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
    const unease = api.unease();
    if (unease) out.push(h('p', { class: 'hw-nb__muted', text: unease }));
    const v = api.vis();
    if (v.capacity > 0) {
      const pools = h('div', { class: 'hw-nb__needs', attrs: { 'aria-label': 'Rod vis' } });
      for (const [p, n] of Object.entries(v.vis) as [Aspect, number][]) {
        const chip = h('span', { class: 'hw-nb__need' }, aspectLabel(p, `${aspectInfo(p).name} ${Math.floor(n)}/${v.capacity}`));
        chip.style.borderColor = aspectInfo(p).color;
        pools.appendChild(chip);
      }
      out.push(h('p', { class: 'hw-nb__muted', text: 'Rod vis, one pool per primal. Arcane work and foci spend it.' }), pools);
    }
    if (api.canStudy()) {
      const vials = [...carried].filter((k) => k.startsWith('vial_'));
      const study = h('div', { class: 'hw-nb__row' });
      for (const v of vials) {
        const b = button(`Study ${itemOrNull(v)?.name ?? v}`, () => say(api.study(v)));
        b.dataset.study = v;
        study.appendChild(b);
      }
      if (vials.length) out.push(h('p', { class: 'hw-nb__muted', text: 'Studying a vial turns its essentia into lore and gives the vial back.' }), study);
    }
    const noted = [...r.scanned].reverse().filter((k) => matches(query, itemOrNull(k)?.name ?? k, aspectsText(aspectsOf(k))));
    if (query.trim() && !noted.length) out.push(h('p', { class: 'hw-nb__muted', text: 'No noted thing matches.' }));
    for (const k of noted.slice(0, 60)) {
      out.push(h('div', { class: 'hw-nb__aspect' }, h('span', { text: `${itemOrNull(k)?.name ?? k}:` }), aspectsRow(aspectsOf(k))));
    }
    return out;
  }

  function renderGoals(): HTMLElement[] {
    const goals = api.goals().filter((g) => matches(query, g.title));
    return [
      h('p', { class: 'hw-nb__muted', text: query.trim() && !goals.length ? 'No goal matches.' : 'Side goals of the craft. None of them is needed to finish the game.' }),
      ...goals.map((g) => h('div', { class: ['hw-nb__goal', g.done ? '' : 'hw-nb__muted'] }, h('span', { text: g.done ? '✓' : '○' }), h('span', { text: g.title }))),
    ];
  }

  function render(): void {
    const parts = tab === 'research' ? renderResearch() : tab === 'lore' ? [...renderNotes(), ...renderAspects()] : renderGoals();
    if (message) parts.push(h('p', { class: 'hw-nb__text', text: message, attrs: { role: 'status' } }));
    content.replaceChildren(...parts);
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
