/**
 * The research simulator: the game's real research engine (src/magic: aspects, board, entries, research) with a small
 * DOM front end. Built by scripts/research-sim/build.mjs into one HTML page.
 */
import { ASPECT_LIST, aspectInfo, linkable, type Aspect, type Aspects } from '../../src/magic/aspects';
import { cellCount, hexCoord, linkedFrom, neighbours, type BoardSpec } from '../../src/magic/board';
import { RESEARCH } from '../../src/magic/entries';
import {
  beginResearch, beginShortfall, combineAspects, entryStatus, freshResearch, hintFor, placeToken, removeToken,
  sanitizeResearch, scanObject, type ResearchState,
} from '../../src/magic/research';
import SHELF from './shelf.json';

const INK_FULL = 64;
const KEY = 'hw-research-sim-v1';
const SVG = 'http://www.w3.org/2000/svg';

interface Sim { research: ResearchState; ink: number; log: string[] }

function load(): Sim {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw) return { research: sanitizeResearch(raw.research), ink: Number(raw.ink) || 0, log: Array.isArray(raw.log) ? raw.log.slice(0, 30) : [] };
  } catch { /* fresh */ }
  return { research: freshResearch(), ink: INK_FULL, log: [] };
}
let sim = load();
const save = (): void => {
  try { localStorage.setItem(KEY, JSON.stringify(sim)); } catch { /* private window */ }
};

let entry: string | null = null;
let age: string | null = null;
let selected: number | null = null;
let message = '';

const $ = (sel: string): HTMLElement => document.querySelector(sel) as HTMLElement;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function btn(text: string, cls: string, on: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', on);
  return b;
}
const name = (a: Aspect): string => aspectInfo(a).name;
const say = (t: string): void => {
  message = t;
  if (t) sim.log.unshift(t);
  sim.log = sim.log.slice(0, 30);
  save();
  render();
};
const lore = (a: Aspect): number => sim.research.lore[a] ?? 0;

type Entry = (typeof RESEARCH)[number];
const status = (e: Entry) => entryStatus(sim.research, e);

// ---- shelf -----------------------------------------------------------------------------------------------------------

function renderShelf(): void {
  const box = $('#shelf');
  box.replaceChildren();
  for (const s of SHELF as { key: string; name: string; aspects: Aspects }[]) {
    const done = sim.research.scanned.includes(s.key);
    const b = btn('', 'spec', () => {
      const r = scanObject(sim.research, s.key, s.aspects);
      if (!r.first) return say(`${s.name} is already in your notes.`);
      const got = (Object.entries(r.gained) as [Aspect, number][]).map(([a, n]) => `${name(a)} +${n}`).join(', ');
      say(`Scanned ${s.name}: ${got}.${r.learned.length ? ` New: ${r.learned.map(name).join(', ')}.` : ''}`);
    });
    b.dataset.done = String(done);
    b.append(el('span', 'spec-name', s.name));
    const dots = el('span', 'spec-dots');
    for (const a of Object.keys(s.aspects) as Aspect[]) {
      const d = el('i');
      d.style.background = done || sim.research.known.includes(a) ? aspectInfo(a).color : '#3b3550';
      d.title = done ? name(a) : '?';
      dots.append(d);
    }
    b.append(dots);
    b.title = done ? 'Already scanned' : 'Scan it';
    box.append(b);
  }
}

// ---- lore pool -------------------------------------------------------------------------------------------------------

function renderPool(): void {
  const box = $('#pool');
  box.replaceChildren();
  for (const a of ASPECT_LIST) {
    const known = sim.research.known.includes(a);
    const row = el('div', 'pool-row');
    row.dataset.known = String(known);
    const dot = el('i', 'dot');
    dot.style.background = known ? aspectInfo(a).color : 'transparent';
    const info = aspectInfo(a);
    row.append(dot, el('span', 'pool-name', known ? info.name : '???'), el('span', 'pool-parts', known && info.parts ? `${name(info.parts[0])} + ${name(info.parts[1])}` : known ? 'primal' : ''), el('b', 'pool-n', known ? String(lore(a)) : ''));
    box.append(row);
  }
  $('#ink').textContent = String(sim.ink);
  ($('#inkbar') as HTMLElement).style.width = `${(sim.ink / INK_FULL) * 100}%`;
}

// ---- map -------------------------------------------------------------------------------------------------------------

function columns(): Map<string, number> {
  const col = new Map<string, number>();
  const byKey = new Map(RESEARCH.map((e) => [e.key, e]));
  const depth = (e: Entry): number => {
    const k = col.get(e.key);
    if (k !== undefined) return k;
    let d = 0;
    for (const r of e.requires) {
      const p = byKey.get(r);
      if (p && p.age === e.age) d = Math.max(d, depth(p) + 1);
    }
    col.set(e.key, d);
    return d;
  };
  RESEARCH.forEach(depth);
  return col;
}

function renderMap(): void {
  const ages = [...new Set(RESEARCH.map((e) => e.age))];
  if (!age) age = RESEARCH.find((e) => e.key === entry)?.age ?? ages[0];
  const tabs = $('#ages');
  tabs.replaceChildren(...ages.map((a) => {
    const b = btn(a[0].toUpperCase() + a.slice(1), 'age', () => { age = a; render(); });
    b.setAttribute('aria-pressed', String(a === age));
    return b;
  }));
  const here = RESEARCH.filter((e) => e.age === age);
  const col = columns();
  const rows = new Map<number, number>();
  const pos = new Map<string, [number, number]>();
  for (const e of here) {
    const c = col.get(e.key) ?? 0;
    const r = rows.get(c) ?? 0;
    rows.set(c, r + 1);
    pos.set(e.key, [60 + c * 116, 44 + r * 84]);
  }
  const w = Math.max(...[...pos.values()].map((p) => p[0])) + 60;
  const h = Math.max(...[...pos.values()].map((p) => p[1])) + 58;
  const map = $('#map');
  map.replaceChildren();
  map.style.width = `${w}px`;
  map.style.height = `${h}px`;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  const done = new Set(RESEARCH.filter((e) => status(e) === 'done').map((e) => e.key));
  for (const e of here) {
    const [x2, y2] = pos.get(e.key) as [number, number];
    for (const k of e.requires) {
      const from = pos.get(k);
      if (!from) continue;
      const p = document.createElementNS(SVG, 'path');
      const mx = (from[0] + x2) / 2;
      p.setAttribute('d', `M${from[0]},${from[1]} C${mx},${from[1]} ${mx},${y2} ${x2},${y2}`);
      if (done.has(k)) p.setAttribute('class', 'lit');
      svg.append(p);
    }
  }
  map.append(svg);
  for (const e of here) {
    const [x, y] = pos.get(e.key) as [number, number];
    const st = status(e);
    const hidden = st === 'locked' && !e.requires.some((k) => done.has(k));
    const node = btn('', 'node', () => { entry = e.key; selected = null; message = ''; render(); });
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.dataset.status = st;
    node.setAttribute('aria-pressed', String(e.key === entry));
    const cost = Object.keys(e.cost) as Aspect[];
    const orb = el('span', 'orb', hidden ? '?' : st === 'done' ? '✓' : '');
    orb.style.background = hidden ? '#2a2438' : cost.length
      ? `conic-gradient(${cost.map((a, i) => `${aspectInfo(a).color} ${(i * 100) / cost.length}% ${((i + 1) * 100) / cost.length}%`).join(',')})`
      : '#c9b27a';
    node.append(orb, el('span', 'label', hidden ? '???' : e.title));
    map.append(node);
  }
}

// ---- notes (the hex board) -------------------------------------------------------------------------------------------

function renderBoard(e: Entry, board: BoardSpec, writable: boolean): HTMLElement {
  const tokens = sim.research.entries[e.key]?.tokens ?? {};
  const R = board.radius;
  const avail = Math.min(440, (document.querySelector('#notes') as HTMLElement).clientWidth - 24);
  const D = Math.max(30, Math.min(56, Math.floor(avail / (2 * R + 1))));
  const linked = linkedFrom(board, tokens, board.anchors[0].cell);
  const at = (c: number): Aspect | undefined => board.anchors.find((a) => a.cell === c)?.aspect ?? tokens[c];
  const xy = (c: number): [number, number] => {
    const [q, r] = hexCoord(R, c);
    return [(q + r / 2 + R) * D + D / 2, (r + R) * D * 0.88 + D / 2];
  };
  const W = (2 * R + 1) * D;
  const H = 2 * R * D * 0.88 + D;
  const wrap = el('div', 'hex');
  wrap.style.width = `${W}px`;
  wrap.style.height = `${H}px`;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  for (let c = 0; c < cellCount(R); c++) {
    const a = at(c);
    if (!a) continue;
    for (const n of neighbours(board, c)) {
      const b = at(n);
      if (n < c || !b || !linkable(a, b)) continue;
      const [x1, y1] = xy(c);
      const [x2, y2] = xy(n);
      const l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1));
      l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
      if (linked.has(c) && linked.has(n)) l.setAttribute('class', 'lit');
      svg.append(l);
    }
  }
  wrap.append(svg);
  for (let c = 0; c < cellCount(R); c++) {
    const anchor = board.anchors.some((a) => a.cell === c);
    const blot = (board.blocked ?? []).includes(c);
    const a = at(c);
    const cell = btn('', 'cell', () => { selected = selected === c ? null : c; render(); });
    cell.disabled = !writable || anchor || blot;
    const [x, y] = xy(c);
    cell.style.left = `${x - D / 2 + 2}px`;
    cell.style.top = `${y - D / 2 + 2}px`;
    cell.style.width = cell.style.height = `${D - 4}px`;
    cell.dataset.kind = anchor ? 'anchor' : blot ? 'blot' : a ? 'token' : 'free';
    if (a) {
      cell.style.background = aspectInfo(a).color;
      cell.textContent = name(a).slice(0, D < 46 ? 3 : 7);
      cell.title = name(a);
      if (linked.has(c)) cell.dataset.linked = 'true';
    }
    if (selected === c) cell.dataset.sel = 'true';
    wrap.append(cell);
  }
  const outer = el('div', 'parchment');
  outer.append(wrap);
  return outer;
}

function renderNotes(): void {
  const box = $('#notes');
  box.replaceChildren();
  if (!entry) entry = (RESEARCH.find((e) => status(e) === 'begun') ?? RESEARCH.find((e) => status(e) === 'open') ?? RESEARCH[0]).key;
  const e = RESEARCH.find((x) => x.key === entry) as Entry;
  const st = status(e);
  const head = el('div', 'notes-head');
  head.append(el('h2', '', e.title), el('span', `pill ${st}`, st));
  box.append(head, el('p', 'lede', e.text));
  if (st === 'locked') {
    box.append(el('p', 'muted', `Needs first: ${e.requires.map((k) => RESEARCH.find((x) => x.key === k)?.title ?? k).join(', ')}.`));
    return;
  }
  if (!e.board) {
    box.append(el('p', 'muted', st === 'done' ? 'Learned.' : 'Scan anything on the shelf to finish this one.'));
    return;
  }
  if (st === 'open') {
    const need = el('div', 'chips');
    for (const [a, n] of Object.entries(e.cost) as [Aspect, number][]) {
      const known = sim.research.known.includes(a);
      const c = el('span', `need ${known && lore(a) >= n ? 'ok' : 'short'}`, `${known ? name(a) : '???'} ${n} · have ${lore(a)}`);
      need.append(c);
    }
    const short = beginShortfall(sim.research, e);
    const b = btn('Begin research', 'primary', () => {
      const r = beginResearch(sim.research, e.key);
      say(r.ok ? `Began ${e.title}.` : r.reason ?? '');
    });
    b.disabled = short.length > 0;
    box.append(el('p', 'muted', 'Starting the notes costs one lore of each fixed aspect:'), need, b);
    box.append(renderBoard(e, e.board, false));
    return;
  }
  const writable = st === 'begun';
  box.append(renderBoard(e, e.board, writable));
  if (!writable) {
    box.append(el('p', 'done-note', 'Research complete. What it teaches is yours.'));
    return;
  }
  const pal = el('div', 'chips');
  for (const a of sim.research.known) {
    const c = btn(`${name(a)} ${lore(a)}`, 'chip', () => {
      if (selected === null) return say('Pick an empty hex first.');
      if (sim.ink <= 0) return say('Your ink is dry. Refill the scribing tools.');
      const r = placeToken(sim.research, e.key, selected, a);
      if (r.ok) sim.ink -= 1;
      selected = null;
      say(r.ok ? (r.solved ? `${e.title}: research complete!` : `Wrote ${name(a)}.`) : r.reason ?? '');
    });
    c.style.background = aspectInfo(a).color;
    c.disabled = lore(a) < 1 || sim.ink < 1;
    pal.append(c);
  }
  const tools = el('div', 'row');
  const tokens = sim.research.entries[e.key]?.tokens ?? {};
  if (selected !== null && tokens[selected]) tools.append(btn('Erase', 'ghost', () => {
    removeToken(sim.research, e.key, selected as number);
    selected = null;
    say('Erased. The lore it took is gone.');
  }));
  tools.append(btn('Hint', 'ghost', () => {
    const hnt = hintFor(sim.research, e.key);
    if (!hnt) return say('No way through with the aspects you know. Scan more things or combine.');
    selected = hnt.cell;
    say(`Try ${name(hnt.aspect)} on the marked hex.`);
  }));
  box.append(el('p', 'muted', 'Tap a hex, then an aspect. Touching aspects link only when one is made from the other.'), pal, tools);
}

function renderCombine(): void {
  const box = $('#combine');
  box.replaceChildren();
  let any = false;
  for (const a of ASPECT_LIST) {
    const parts = aspectInfo(a).parts;
    if (!parts || !sim.research.known.includes(parts[0]) || !sim.research.known.includes(parts[1])) continue;
    any = true;
    const [p, q] = parts;
    const b = btn(`${name(p)} + ${name(q)} → ${sim.research.known.includes(a) ? name(a) : '???'}`, 'chip combo', () => {
      const r = combineAspects(sim.research, p, q);
      say(r.ok ? `Combined into 1 ${name(r.made as Aspect)}.` : r.reason ?? '');
    });
    b.style.background = `linear-gradient(90deg, ${aspectInfo(p).color}, ${aspectInfo(q).color})`;
    b.disabled = lore(p) < 1 || lore(q) < 1;
    box.append(b);
  }
  if (!any) box.append(el('p', 'muted', 'Know both parts of a compound to combine them.'));
}

function render(): void {
  renderShelf();
  renderPool();
  renderMap();
  renderNotes();
  renderCombine();
  $('#msg').textContent = message || 'Scan things on the shelf for lore, then begin a research on the map.';
  const log = $('#log');
  log.replaceChildren(...sim.log.slice(0, 8).map((t) => el('li', '', t)));
  save();
}

$('#refill').addEventListener('click', () => { sim.ink = INK_FULL; say('Fresh scribing tools: 64 ink.'); });
$('#gift').addEventListener('click', () => {
  for (const a of sim.research.known) sim.research.lore[a] = lore(a) + 5;
  say('Sandbox: +5 lore of every known aspect.');
});
$('#learnall').addEventListener('click', () => {
  for (const a of ASPECT_LIST) if (!sim.research.known.includes(a)) sim.research.known.push(a);
  say('Sandbox: every aspect is known.');
});
$('#unlock').addEventListener('click', () => {
  const e = RESEARCH.find((x) => x.key === entry);
  if (!e) return;
  const mark = (k: string): void => {
    const p = RESEARCH.find((x) => x.key === k);
    if (!p) return;
    p.requires.forEach(mark);
    if (k !== e.key) sim.research.entries[k] = { done: true, tokens: sim.research.entries[k]?.tokens ?? {} };
  };
  mark(e.key);
  say(`Sandbox: everything before ${e.title} is learned.`);
});
$('#reset').addEventListener('click', () => {
  sim = { research: freshResearch(), ink: INK_FULL, log: [] };
  entry = null; age = null; selected = null;
  say('');
});
window.addEventListener('resize', () => render());
render();
