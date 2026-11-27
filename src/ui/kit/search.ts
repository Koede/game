/** Search for menus and notebook pages: a plain-text matcher and a search box with a clear button. DOM-free matcher at the top. */
import { h } from './dom';
import { TextField } from './fields';

/** Lower-cased words of a query (split on spaces and punctuation); empty when nothing was typed. */
export const queryWords = (query: string): string[] => query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** True when every word of `query` starts a word in, or is contained in, one of `texts`. An empty query matches everything. */
export function matches(query: string, ...texts: readonly (string | undefined)[]): boolean {
  const words = queryWords(query);
  if (!words.length) return true;
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

export interface SearchBoxOptions {
  label: string;
  placeholder?: string;
  value?: string;
  onInput: (query: string) => void;
}

/** A search field with a Clear button that shows only while something is typed. Typing never reaches the game's key bindings. */
export class SearchBox {
  readonly el: HTMLElement;
  private readonly field: TextField;
  private readonly clear: HTMLButtonElement;

  constructor(opts: SearchBoxOptions) {
    this.field = new TextField({
      label: opts.label,
      placeholder: opts.placeholder ?? 'Search',
      value: opts.value,
      onInput: (q) => {
        this.clear.hidden = q === '';
        opts.onInput(q);
      },
    });
    this.field.input.type = 'search';
    this.field.input.setAttribute('aria-label', opts.label);
    this.clear = h('button', { class: 'hw-search__clear', text: 'Clear', attrs: { type: 'button', 'aria-label': 'Clear search' } });
    this.clear.hidden = !opts.value;
    this.clear.addEventListener('click', () => {
      this.set('');
      opts.onInput('');
      this.field.input.focus();
    });
    this.el = h('div', { class: 'hw-search' }, this.field.el, this.clear);
  }

  get value(): string {
    return this.field.value;
  }

  set(query: string): void {
    this.field.set(query);
    this.clear.hidden = query === '';
  }
}
