/**
 * The experiment row (docs/api/discovery.md): up to three ingredient pickers from the pack, a "Try it" button, the
 * result line and the recipe book. Used by the workbench and the furnace's forge tab.
 */
import { itemOrNull } from '../../core/registry';
import type { GameBus } from '../../core/context';
import type { PlayerState } from '../../game';
import { h } from '../kit/dom';

const ROWS = 3;

export class ExperimentPanel {
  readonly el: HTMLDetailsElement;
  private readonly selects: HTMLSelectElement[] = [];
  private readonly counts: HTMLInputElement[] = [];
  private readonly result = h('p', { class: 'hw-exp__result', text: 'Mix unknown things to find hidden recipes.' });
  private readonly book = h('ul', { class: 'hw-exp__book' });
  private sig = '';

  constructor(private readonly opts: { player: PlayerState; bus: GameBus; station: string; changed: () => void }) {
    const rows: HTMLElement[] = [];
    for (let i = 0; i < ROWS; i++) {
      const select = h('select', { class: 'hw-exp__item', attrs: { 'aria-label': `Ingredient ${i + 1}` } });
      const count = h('input', { class: 'hw-exp__count', attrs: { type: 'number', min: 1, max: 9, value: 1, 'aria-label': `Amount ${i + 1}` } });
      this.selects.push(select);
      this.counts.push(count);
      rows.push(h('div', { class: 'hw-exp__row' }, select, count));
    }
    const go = h('button', { class: 'hw-btn', text: 'Try it', attrs: { type: 'button' }, on: { click: () => this.try() } });
    this.el = h(
      'details',
      { class: 'hw-exp' },
      h('summary', { text: 'Experiment' }),
      h('div', { class: 'hw-exp__body' }, rows, go, this.result, h('h4', { class: 'hw-heading', text: 'Recipe book' }), this.book),
    );
    this.refresh();
  }

  private try(): void {
    const { player, bus, station, changed } = this.opts;
    const attempt = this.selects
      .map((s, i) => ({ item: s.value, count: Math.max(1, Math.min(9, Math.floor(Number(this.counts[i].value) || 1))) }))
      .filter((a) => a.item !== '');
    const r = player.book.experiment(station, attempt, player.inventory);
    this.result.textContent = r.message + (r.kind === 'close' ? ` - ${r.hint}` : '');
    if (r.kind === 'discovered') {
      bus.emit('toast', { text: r.message, kind: 'good' });
      bus.emit('sfx', { name: 'craft' });
    } else if (r.kind === 'known') bus.emit('sfx', { name: 'craft' });
    else bus.emit('sfx', { name: 'error' });
    this.sig = '';
    changed();
  }

  /** Rebuilds the pickers from the pack (only when its contents changed) and the book list. */
  refresh(): void {
    const items = [...new Set(this.opts.player.inventory.slots.filter((s) => s).map((s) => s!.item))].sort();
    const sig = items.join(',') + `|${this.opts.player.book.count}|${this.opts.player.book.tries}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.selects.forEach((sel) => {
      const keep = sel.value;
      sel.replaceChildren(h('option', { text: '-', attrs: { value: '' } }));
      for (const k of items) sel.append(h('option', { text: itemOrNull(k)?.name ?? k, attrs: { value: k } }));
      sel.value = items.includes(keep) ? keep : '';
    });
    this.book.replaceChildren(
      ...this.opts.player.book.entries().map((e) => h('li', { class: e.found ? 'is-found' : '', text: `${e.title}: ${e.text}` })),
    );
  }
}
