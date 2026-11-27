/**
 * "What is this for?" (docs/api/itemLookup.md): search any item by name and see the recipes that make it, the recipes that
 * use it and where it turns up without a recipe. With nothing typed it lists what the player carries. Tapping a result
 * opens its page; a recipe row's ingredients are links to their own pages, so a chain can be followed on a phone.
 */
import { ITEMS, itemOrNull } from '../../../core/registry';
import { lookupItem, type RecipeRow } from '../../../game/itemLookup';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { SearchBox, matches } from '../../kit/search';
import { Window } from '../../kit/window';

const MAX_RESULTS = 40;

export function createLookupScreen(ctx: ScreenContext, first?: string): GameScreen {
  const results = h('div', { class: 'hw-lookup__results' });
  const detail = h('div', { class: 'hw-lookup__detail' });
  let current: string | null = first && itemOrNull(first) ? first : null;
  let query = '';

  const itemButton = (key: string, label?: string): HTMLElement =>
    h('button', { class: 'hw-btn hw-lookup__item', text: label ?? itemOrNull(key)?.name ?? key, attrs: { type: 'button', 'data-item': key }, on: { click: () => { current = key; draw(); } } });

  const rows = (title: string, list: readonly RecipeRow[]): HTMLElement | null =>
    list.length === 0
      ? null
      : h('section', { class: 'hw-lookup__group' }, h('h4', { text: title }), h('ul', null, ...list.slice(0, 30).map((r) => h('li', null, h('b', { text: `${r.station}: ` }), r.text))));

  const draw = (): void => {
    const carried = new Set<string>();
    for (const s of ctx.player.inventory.slots) if (s) carried.add(s.item);
    const pool = query.trim() === ''
      ? ITEMS.filter((it) => carried.has(it.key))
      : ITEMS.filter((it) => matches(query, it.name, it.key.replace(/_/g, ' ')));
    results.replaceChildren(
      ...(pool.length === 0 ? [h('p', { class: 'hw-lookup__note', text: query.trim() === '' ? 'Your pack is empty. Search for any item by name.' : 'Nothing by that name.' })] : pool.slice(0, MAX_RESULTS).map((it) => itemButton(it.key))),
      ...(pool.length > MAX_RESULTS ? [h('p', { class: 'hw-lookup__note', text: `${pool.length - MAX_RESULTS} more: type more of the name.` })] : []),
    );
    if (!current) {
      detail.replaceChildren(h('p', { class: 'hw-lookup__note', text: 'Pick an item to see how it is made, what it is for and where to find it.' }));
      return;
    }
    const info = lookupItem(current);
    const def = itemOrNull(current);
    const nothing = info.madeAt.length === 0 && info.usedFor.length === 0 && info.foundAt.length === 0;
    detail.replaceChildren(
      h('h3', { text: info.name }),
      ...(def?.desc ? [h('p', { text: def.desc })] : []),
      ...[rows('How to make it', info.madeAt), rows('What it is used for', info.usedFor)].filter((x): x is HTMLElement => x !== null),
      ...(info.foundAt.length ? [h('section', { class: 'hw-lookup__group' }, h('h4', { text: 'Where to find it' }), h('ul', null, ...info.foundAt.map((f) => h('li', { text: f }))))] : []),
      ...(nothing ? [h('p', { class: 'hw-lookup__note', text: 'No recipe or drop lists this one: it is handed out by a person, a shop or a special event.' })] : []),
    );
  };

  const search = new SearchBox({ label: 'Search items', placeholder: 'Search items by name', onInput: (q) => { query = q; draw(); } });
  const body = h('div', { class: 'hw-lookup' }, search.el, results, detail);
  const window = new Window({ title: 'What is this for?', subtitle: 'How things are made, used and found', size: 'md', body });
  draw();
  return { window, refresh: () => undefined, dispose: () => undefined };
}
