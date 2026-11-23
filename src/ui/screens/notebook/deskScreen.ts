/**
 * The Rune Desk (docs/api/magic.md): every arcane recipe with its ingredients and vis cost (green = you have it),
 * the reason it cannot be made yet, and a Make button. Talks to the game only through DeskApi (type import).
 */
import { itemOrNull } from '../../../core/registry';
import { aspectInfo } from '../../../magic/aspects';
import type { DeskApi } from '../../../magic/magic';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { ItemSlot } from '../../kit/slot';
import { Window } from '../../kit/window';
import { injectNotebookCss } from './notebookScreen';

const name = (item: string): string => itemOrNull(item)?.name ?? item;

export function createDeskScreen(ctx: ScreenContext, api: DeskApi, bench = false): GameScreen {
  injectNotebookCss();
  const body = h('div', { class: 'hw-nb' });
  const status = h('p', { class: 'hw-nb__text', attrs: { role: 'status' } });
  const window = new Window({ title: bench ? 'Arcane Workbench' : 'Rune Desk', subtitle: 'Arcane work, paid in vis', size: 'md', fit: 'tall', body });
  let signature = '';

  function render(): void {
    const rows = api.rows();
    signature = JSON.stringify(rows);
    const parts: HTMLElement[] = [h('p', { class: 'hw-nb__muted', text: 'Vis comes from the gathering rod you carry: Use the rod to draw it from the land.' })];
    for (const r of rows) {
      const slot = new ItemSlot({ size: 'md', label: name(r.output) });
      slot.set({ item: r.output, name: name(r.output), count: r.count });
      const inputs = r.inputs.map((i) => h('span', { class: ['hw-nb__need', i.have >= i.count ? 'is-ok' : 'is-short'], text: `${i.count} ${name(i.item)}` }));
      const cost = r.cost.map((c) => {
        const chip = h('span', { class: ['hw-nb__need', c.have >= c.n ? 'is-ok' : 'is-short'], text: `${aspectInfo(c.aspect).name} ${c.n}` });
        chip.style.borderColor = aspectInfo(c.aspect).color;
        return chip;
      });
      const make = h('button', { class: 'hw-nb__btn', text: 'Make', attrs: { type: 'button', 'data-make': r.id } });
      make.disabled = r.problem !== null;
      make.addEventListener('click', () => {
        status.textContent = api.make(r.id);
        ctx.invalidate();
        render();
      });
      parts.push(h('div', { class: 'hw-nb__recipe', attrs: { 'data-recipe': r.id } },
        slot.el,
        h('div', { class: 'hw-nb__recipe-body' },
          h('strong', { text: name(r.output) }),
          h('div', { class: 'hw-nb__needs' }, ...inputs),
          h('div', { class: 'hw-nb__needs' }, ...cost),
          r.problem ? h('span', { class: 'hw-nb__muted', text: r.problem }) : h('span', { class: 'hw-nb__ok', text: 'Ready' }),
        ),
        make,
      ));
    }
    parts.push(status);
    body.replaceChildren(...parts);
  }
  render();

  return {
    window,
    refresh: () => {
      if (JSON.stringify(api.rows()) !== signature) render();
    },
    dispose: () => undefined,
  };
}
