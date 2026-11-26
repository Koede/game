/**
 * The blueprint panel (docs/api/blueprint.md): a card listing the blueprints the player owns (size, materials against the pack,
 * Place / Rename / Delete) and the builds Gruk has under way (progress, what he waits for, Cancel). Tapping Place closes the
 * card and hands over to the placement bar in the build chip. Big tap targets; scrolls inside its own height on a phone.
 */
import { itemOrNull } from '../../core/registry';
import type { BlueprintBook } from '../../game/blueprintBook';
import type { BlueprintTools } from '../../game/blueprintTools';
import { clear, h } from '../kit/dom';

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

export class BlueprintPanel {
  readonly el: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private renaming: string | null = null;
  private deleting: string | null = null;
  /** What the card last drew: it is rebuilt only when this changes, so a tap never lands on a button that was just replaced. */
  private drawn = '';

  constructor(
    private readonly tools: BlueprintTools,
    private readonly onPlace: () => void,
  ) {
    this.body = h('div', { class: 'hw-bp__body' });
    const close = h('button', { class: 'hw-bp__btn', attrs: { type: 'button', 'data-action': 'bp-close' }, text: 'Close' });
    close.addEventListener('click', () => this.hide());
    this.el = h(
      'div',
      { class: 'hw-bp hw-hud-plate', attrs: { 'data-testid': 'blueprint-panel', role: 'dialog', 'aria-label': 'Blueprints' } },
      h('div', { class: 'hw-bp__head' }, h('strong', { text: 'Blueprints' }), close),
      this.body,
    );
    this.el.hidden = true;
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    if (this.open) this.hide();
    else {
      this.drawn = '';
      this.el.hidden = false;
      this.render();
    }
  }

  hide(): void {
    this.el.hidden = true;
    this.renaming = null;
    this.deleting = null;
    this.drawn = '';
  }

  private get book(): BlueprintBook {
    return this.tools.book;
  }

  /** Redraws the card (cheap: a handful of rows). Called when something changes and a few times a second while open. */
  render(): void {
    if (!this.open) return;
    if (this.renaming && this.body.querySelector('input:focus')) return;
    const key = JSON.stringify([
      this.book.entries.map((e) => [e.id, e.bp.name, e.origin, this.tools.needs(e.bp).map((n) => [n.item, n.need, Math.min(n.have, n.need)])]),
      this.book.jobs.map((j) => [j.id, j.name, j.job.missing, Math.round(j.job.progress * 100)]),
      this.renaming,
      this.deleting,
    ]);
    if (key === this.drawn) return;
    this.drawn = key;
    clear(this.body);
    const rows: HTMLElement[] = [];
    for (const j of this.book.jobs) {
      const note = j.job.missing ? `waiting for ${nameOf(j.job.missing)}` : `${Math.round(j.job.progress * 100)}%`;
      const cancel = h('button', { class: 'hw-bp__btn', attrs: { type: 'button', 'data-action': 'bp-cancel-job' }, text: 'Cancel' });
      cancel.addEventListener('click', () => {
        this.book.cancelJob(j.id);
        this.render();
      });
      rows.push(h('div', { class: 'hw-bp__row hw-bp__job' }, h('div', { class: 'hw-bp__main' }, h('strong', { text: `Gruk: ${j.name}` }), h('span', { class: 'hw-bp__sub', text: note })), cancel));
    }
    if (this.book.entries.length === 0) {
      rows.push(h('p', { class: 'hw-bp__empty', text: 'No blueprints yet. Mark two corners round something you built to save it. Ruins and daily goals can hand them out too.' }));
    }
    for (const e of this.book.entries) rows.push(this.entryRow(e.id));
    this.body.append(...rows);
  }

  private entryRow(id: string): HTMLElement {
    const e = this.book.get(id)!;
    const needs = this.tools.needs(e.bp);
    const mats = h(
      'div',
      { class: 'hw-bp__mats' },
      needs.map((n) => h('span', { class: ['hw-bp__mat', n.have < n.need && 'hw-bp__mat--short'], text: `${nameOf(n.item)} ${Math.min(n.have, n.need)}/${n.need}` })),
    );
    const title =
      this.renaming === id
        ? (() => {
            const input = h('input', { class: 'hw-bp__input', attrs: { type: 'text', maxlength: 32, value: e.bp.name, 'aria-label': 'Blueprint name' } });
            const save = (): void => {
              this.book.rename(id, input.value);
              this.renaming = null;
              this.render();
            };
            input.addEventListener('keydown', (ev) => {
              ev.stopPropagation();
              if (ev.key === 'Enter') save();
              else if (ev.key === 'Escape') {
                this.renaming = null;
                this.render();
              }
            });
            input.addEventListener('blur', save);
            queueMicrotask(() => input.focus());
            return input;
          })()
        : h('strong', { text: e.bp.name });
    const btn = (label: string, action: string, fn: () => void): HTMLButtonElement => {
      const b = h('button', { class: 'hw-bp__btn', attrs: { type: 'button', 'data-action': action }, text: label });
      b.addEventListener('click', fn);
      return b;
    };
    const place = btn('Place', 'bp-place', () => {
      this.tools.select(id);
      this.hide();
      this.onPlace();
    });
    const rename = btn('Rename', 'bp-rename', () => {
      this.renaming = id;
      this.render();
    });
    const del = btn(this.deleting === id ? 'Really delete?' : 'Delete', 'bp-delete', () => {
      if (this.deleting === id) {
        this.book.remove(id);
        this.deleting = null;
      } else this.deleting = id;
      this.render();
    });
    const sub = `${e.bp.cells.length} blocks · ${e.bp.size.join('×')}${e.origin === 'granted' ? ' · found' : ''}`;
    return h('div', { class: 'hw-bp__row', attrs: { 'data-blueprint': id } }, h('div', { class: 'hw-bp__main' }, title, h('span', { class: 'hw-bp__sub', text: sub }), mats), h('div', { class: 'hw-bp__acts' }, place, rename, del));
  }
}

/** The one-line status the placement bar shows. */
export function placementLine(name: string, blocked: number, free: number, short: number): string {
  const parts = [name, `${free} to build`];
  if (blocked > 0) parts.push(`${blocked} blocked`);
  if (short > 0) parts.push(`short ${short} item${short === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

