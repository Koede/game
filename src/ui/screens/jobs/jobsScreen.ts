/**
 * The Jobs screen (docs/api/jobs.md): every resident who can work, what they do (nothing, haul, run a station), what they carry and
 * the two stops. A stop is picked by aiming at a block and Use after tapping its button (the screen closes while you aim and opens
 * again when the stop is set), so a phone needs no coordinates. The rows are built once per change of shape and only their text
 * updates on refresh, so a tap is never lost to a rebuild.
 */
import { FILTER_NAMES, JOB_FILTERS, KIND_NAMES, JobBoard, type JobFilter, type JobKind, type Stop } from '../../../npcs/jobs';
import type { NpcManager } from '../../../npcs/manager';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const KINDS: readonly (JobKind | null)[] = [null, 'haul', 'feed', 'tend'];
const kindLabel = (k: JobKind | null): string => (k === null ? 'Off' : KIND_NAMES[k]);

const stopText = (npcs: NpcManager, s: Stop | null): string => {
  if (!s) return 'Not set';
  const block = npcs.stopBlock(s);
  const name = block === null ? 'not loaded' : block.replace(/_/g, ' ');
  return `${name} (${s.x}, ${s.y}, ${s.z})`;
};

export function createJobsScreen(ctx: ScreenContext, npcs: NpcManager, first?: string): GameScreen {
  const list = h('div', { class: 'hw-jobs' });
  const intro = h('p', { class: 'hw-jobs__intro', text: 'Give a resident a job and they carry things between two blocks while you do something else. They work by day.' });
  const window = new Window({ title: 'Jobs', subtitle: 'The settlement at work', size: 'md', fit: 'content', body: h('div', null, intro, list) });
  let shape = '';
  const live: Map<string, { status: HTMLElement; moved: HTMLElement; from: HTMLElement; to: HTMLElement }> = new Map();

  const build = (workers: ReturnType<NpcManager['workers']>): void => {
    live.clear();
    const ordered = [...workers].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0));
    if (ordered.length === 0) {
      list.replaceChildren(h('p', { text: 'Nobody lives here yet who could take on work.' }));
      return;
    }
    list.replaceChildren(
      ...ordered.map((w) => {
        const v = npcs.jobs.get(w.id);
        const kinds = h(
          'div',
          { class: 'hw-jobs__seg', attrs: { role: 'group', 'aria-label': `${w.name}'s work` } },
          ...KINDS.map((k) =>
            h('button', {
              class: ['hw-btn', 'hw-jobs__opt', (v?.job.kind ?? null) === k && 'is-on'],
              attrs: { type: 'button', 'data-job': `${w.id}:${k ?? 'off'}`, 'aria-pressed': String((v?.job.kind ?? null) === k) },
              text: kindLabel(k),
              on: { click: () => { npcs.setJob(w.id, k); ctx.invalidate(); } },
            }),
          ),
        );
        const card = h('section', { class: 'hw-jobs__card', attrs: { 'data-person': w.id } }, h('header', { class: 'hw-jobs__head' }, h('b', { text: w.name }), h('span', { text: w.note })), kinds);
        if (v) {
          const tend = v.job.kind === 'tend';
          const filters = h(
            'div',
            { class: 'hw-jobs__seg', attrs: { role: 'group', 'aria-label': 'What to carry' } },
            ...JOB_FILTERS.map((f: JobFilter) =>
              h('button', {
                class: ['hw-btn', 'hw-jobs__opt', v.job.filter === f && 'is-on'],
                attrs: { type: 'button', 'data-filter': `${w.id}:${f}`, 'aria-pressed': String(v.job.filter === f) },
                text: FILTER_NAMES[f],
                on: { click: () => { npcs.jobs.setFilter(w.id, f); ctx.invalidate(); } },
              }),
            ),
          );
          const from = h('span', { class: 'hw-jobs__stop' });
          const to = h('span', { class: 'hw-jobs__stop' });
          const pick = (which: 'from' | 'to', label: string, value: HTMLElement): HTMLElement =>
            h('button', {
              class: 'hw-btn hw-jobs__pick',
              attrs: { type: 'button', 'data-pick': `${w.id}:${which}` },
              on: { click: () => { if (npcs.startPick(w.id, which)) ctx.close(); } },
            }, h('small', { text: label }), value);
          const status = h('p', { class: 'hw-jobs__status', attrs: { 'aria-live': 'polite' } });
          const moved = h('span', { class: 'hw-jobs__moved' });
          card.append(...(tend ? [] : [h('p', { class: 'hw-jobs__label', text: v.job.kind === 'feed' ? 'Keep it supplied with' : 'Carry' }), filters]), pick('from', tend ? 'Look after the machines around' : 'Collect from', from), ...(tend ? [] : [pick('to', v.job.kind === 'feed' ? 'Feed this machine or crate' : 'Deliver to', to)]), h('div', { class: 'hw-jobs__foot' }, status, moved));
          live.set(w.id, { status, moved, from, to });
        }
        return card;
      }),
    );
  };

  return {
    window,
    refresh: () => {
      const workers = npcs.workers();
      const sig = workers.map((w) => { const v = npcs.jobs.get(w.id); return `${w.id}|${v ? `${v.job.kind}|${v.job.filter}` : '-'}`; }).join(';');
      if (sig !== shape) {
        shape = sig;
        build(workers);
      }
      for (const [id, el] of live) {
        const v = npcs.jobs.get(id);
        if (!v) continue;
        el.from.textContent = stopText(npcs, v.job.from);
        el.to.textContent = stopText(npcs, v.job.to);
        el.status.textContent = JobBoard.problem(v.job) ?? v.status;
        el.moved.textContent = v.moved > 0 ? (v.job.kind === 'tend' ? `Tended ${v.moved} so far` : `Carried ${v.moved} so far`) : '';
      }
    },
    dispose: () => undefined,
  };
}
