/** The Town page (docs/plans/feature-plan-2026-11-26.md, 1.3): what Gruk is building, the town's standing, who lives where, the rooms, and the camp goals. */
import type { TownPage } from '../../../npcs/townPage';
import { itemOrNull } from '../../../core/registry';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const nameOf = (k: string): string => itemOrNull(k)?.name ?? k.replace(/_/g, ' ');

function section(title: string, ...body: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'hw-town__sec' }, h('h3', { class: 'hw-heading', text: title }), ...body);
}

function bar(percent: number): HTMLElement {
  return h('div', { class: 'hw-town__bar', attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent } }, h('div', { class: 'hw-town__fill', style: { width: `${percent}%` } }));
}

/** The page's body for one reading of the town. Exported for tests and tools. */
export type MoveResident = (id: string, room: string) => { ok: boolean; reason?: string };

export function renderTown(p: TownPage, move?: MoveResident, done?: () => void): HTMLElement {
  const out = h('div', { class: 'hw-town' });
  if (!p.active) {
    out.append(h('p', { class: 'hw-town__line', text: 'There is no town to look at yet. Gruk builds one only in a new world.' }));
    return out;
  }
  if (p.goal) out.append(section('Camp goal', h('p', { class: 'hw-town__goal', text: p.goal.title }), h('p', { class: 'hw-town__line', text: p.goal.text })));

  const b = p.building;
  if (b) {
    const head = b.stage !== null && b.stages !== null ? `${b.name} (stage ${b.stage} of ${b.stages})` : b.name;
    const need = b.missing.length > 0 ? `Missing: ${b.missing.slice(0, 5).map((m) => `${m.count} ${nameOf(m.item)}`).join(', ')}${b.missing.length > 5 ? ', ...' : ''}. Hand them in at the board.` : null;
    const when = b.daysLeft !== null ? `About ${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} of work left.` : b.missing.length > 0 ? 'Gruk waits for materials.' : null;
    out.append(section('Gruk is building', h('p', { class: 'hw-town__goal', text: head }), bar(b.percent), h('p', { class: 'hw-town__line', text: `${b.percent}% laid. ${when ?? ''}` }), need ? h('p', { class: 'hw-town__line hw-town__warn', text: need }) : null, b.waiting ? h('p', { class: 'hw-town__line hw-town__warn', text: b.waiting }) : null));
  } else {
    out.append(section('Gruk is building', h('p', { class: 'hw-town__line', text: p.planned > 0 ? 'Every planned building stands.' : 'Gruk is looking for a site.' })));
  }

  const next = p.standing.next ? `Next step: ${p.standing.next.name} at ${p.standing.next.at}.` : 'The highest step.';
  out.append(section('Standing', h('p', { class: 'hw-town__line', text: `${p.standing.name} (${p.standing.value}). ${next}` }), p.nextUnlock ? h('p', { class: 'hw-town__line', text: `Next unlock: ${p.nextUnlock}.` }) : null, h('p', { class: 'hw-town__line', text: `${p.finished} of ${p.planned} buildings done. The town feels ${p.moodLabel}.` })));

  const mover = (r: TownPage['residents'][number]): HTMLElement | null => {
    if (!move || r.moves.length < 2) return null;
    const sel = h('select', { class: 'hw-town__move', attrs: { 'aria-label': `Move ${r.name} to another room` } }, ...r.moves.map((m) => h('option', { text: m.label, attrs: { value: m.id, selected: m.id === r.room } })));
    sel.addEventListener('change', () => {
      move(r.id, sel.value);
      done?.();
    });
    return sel;
  };
  if (p.festival) out.append(section(p.festival.tonight ? `Festival: ${p.festival.name}` : 'Festivals', h('p', { class: ['hw-town__line', p.festival.tonight && 'hw-town__goal'], text: p.festival.line }), h('p', { class: 'hw-town__line', text: p.festival.medals })));
  out.append(section('Who lives here', ...p.residents.map((r) => h('div', { class: 'hw-town__row' }, h('span', { class: 'hw-town__name', text: r.name }), h('span', { class: 'hw-town__sub', text: `${r.home}, ${r.tone === 'warm' ? 'content' : r.tone === 'grumpy' ? 'restless' : 'settled'}` }), mover(r)))));
  const bits = p.residents.filter((r) => r.reasons.length > 0).map((r) => `${r.name} ${r.reasons[0]}`);
  if (bits.length > 0) out.append(h('p', { class: 'hw-town__line hw-town__sub', text: bits.slice(0, 4).join('. ') + '.' }));

  const rooms = p.rooms.map((r) => h('div', { class: ['hw-town__row', `is-${r.state}`] }, h('span', { class: 'hw-town__name', text: r.label }), h('span', { class: 'hw-town__sub', text: r.state === 'taken' ? `${r.occupant ?? ''}` : r.state === 'free' ? 'free' : `not a room: ${r.reasons.join(', ')}` })));
  out.append(section('Rooms', ...(rooms.length > 0 ? rooms : [h('p', { class: 'hw-town__line', text: 'No bedroom yet. The lodge has the first.' })]), p.nextInLine ? h('p', { class: 'hw-town__line', text: p.nextInLine.text }) : h('p', { class: 'hw-town__line', text: 'Everyone has come.' })));

  if (p.goals.length > 0) out.append(section('Camp goals', ...p.goals.map((g) => h('div', { class: ['hw-town__row', g.done && 'is-done'] }, h('span', { class: 'hw-town__name', text: `${g.done ? 'Done: ' : ''}${g.title}` })))));
  return out;
}

export function createTownScreen(_request: { type: 'town' }, ctx: ScreenContext, page: () => TownPage, move?: MoveResident): GameScreen {
  const body = h('div', { class: 'hw-town-wrap' });
  const window = new Window({ title: 'Town', subtitle: `Day ${ctx.clock.day}`, size: 'md', fit: 'tall', body });
  return {
    window,
    refresh: () => {
      const p = page();
      window.setSubtitle(`Day ${p.day}`);
      body.replaceChildren(renderTown(p, move, () => ctx.invalidate()));
    },
    dispose: () => undefined,
  };
}
