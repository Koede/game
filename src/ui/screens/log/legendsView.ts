/** The Legends section of the Hearth Log: each legendary weapon found in full, each unfound one as a silhouette with the rumour about where such things are told of. */
import { legendaryNoteKey, legendaryPages, legendarySummary } from '../../../game/legendaryNotes';
import type { Journal } from '../../../game/journal';
import { h, setText } from '../../kit/dom';

export class LegendsView {
  readonly el: HTMLElement;
  private readonly summary: HTMLParagraphElement;
  private readonly list: HTMLUListElement;
  private shown = '';

  /** `found` defaults to the journal's note for the weapon (written the first time it is in the pack, saved with the world). */
  constructor(private readonly journal: Journal) {
    this.summary = h('p', { class: 'hw-legends__summary' });
    this.list = h('ul', { class: 'hw-legends__list' });
    this.el = h('section', { class: 'hw-legends' }, h('h3', { class: 'hw-legends__title', text: 'Legends' }), this.summary, this.list);
  }

  refresh(): void {
    const pages = legendaryPages((item) => this.journal.has(legendaryNoteKey(item)));
    const key = pages.map((p) => (p.found ? '1' : '0')).join('');
    if (key === this.shown) return;
    this.shown = key;
    setText(this.summary, legendarySummary(pages));
    this.list.replaceChildren(
      ...pages.map((p) =>
        h(
          'li',
          { class: `hw-legends__item${p.found ? '' : ' is-silhouette'}`, attrs: { 'data-item': p.item, 'data-found': p.found ? 'true' : 'false' } },
          h('span', { class: 'hw-legends__mark', text: p.found ? '\u25C6' : '\u25C7', attrs: { 'aria-hidden': 'true' } }),
          h('div', { class: 'hw-legends__body' }, h('strong', { class: 'hw-legends__name', text: p.title }), ...p.lines.map((l) => h('p', { class: 'hw-legends__line', text: l }))),
        ),
      ),
    );
  }
}
