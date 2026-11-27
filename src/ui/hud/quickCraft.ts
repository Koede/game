/**
 * The quick-craft chip (docs/api/assist.md): one tap repeats the last hand recipe from the pack, the arrow opens a short list of
 * hand recipes the pack can make right now. No screen opens. Hidden until the pack can make something or a recipe was made before.
 */
import type { GameBus } from '../../core/context';
import { itemOrNull } from '../../core/registry';
import { handRecipe, quickCraft, quickList, repeatLastHand } from '../../game/quickCraft';
import type { PlayerState } from '../../game/playerState';
import { clear, h, setAttr, setFlag, setText } from '../kit/dom';
import { ItemIcon, glyph } from '../kit/icons';

const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;

export class QuickCraft {
  readonly el: HTMLDivElement;
  private readonly main: HTMLButtonElement;
  private readonly mainIcon = new ItemIcon();
  private readonly mainText: HTMLSpanElement;
  private readonly more: HTMLButtonElement;
  private readonly list: HTMLDivElement;
  private shownKey = '';

  constructor(private readonly player: PlayerState, private readonly bus: GameBus) {
    this.mainText = h('span', { class: 'hw-quick__text' });
    this.main = h('button', { class: 'hw-quick__main', attrs: { type: 'button' } }, this.mainIcon.el, this.mainText);
    this.more = h('button', { class: 'hw-quick__more', attrs: { type: 'button', 'aria-label': 'Quick craft list', 'aria-expanded': 'false' } }, glyph('chevron', 12));
    this.list = h('div', { class: 'hw-quick__list', attrs: { role: 'menu' } });
    this.list.hidden = true;
    this.el = h('div', { class: 'hw-quick hw-hud-plate', attrs: { 'data-testid': 'quick-craft' } }, h('div', { class: 'hw-quick__bar' }, this.main, this.more), this.list);
    this.el.hidden = true;
    this.main.addEventListener('click', () => {
      const result = repeatLastHand(this.player);
      if (result === null) this.toggleList(true);
      else this.report(result);
    });
    this.more.addEventListener('click', () => this.toggleList(this.list.hidden));
    this.update();
  }

  /** The X key: repeat the last hand recipe. */
  repeat(): void {
    const result = repeatLastHand(this.player);
    if (result) this.report(result);
  }

  private report(result: { ok: boolean; reason?: string }): void {
    if (!result.ok) {
      this.bus.emit('toast', { text: result.reason ?? 'Cannot make that', kind: 'warn' });
      this.bus.emit('sfx', { name: 'error' });
    }
    this.shownKey = '';
    this.update();
  }

  private toggleList(open: boolean): void {
    this.list.hidden = !open;
    setAttr(this.more, 'aria-expanded', String(open));
    this.shownKey = '';
    this.update();
  }

  /** A few times per second. */
  update(): void {
    const last = handRecipe(this.player.assist.lastHand);
    const entries = quickList(this.player);
    const lastReady = last ? entries.some((e) => e.recipe.id === last.id) : false;
    this.el.hidden = !last && entries.length === 0;
    if (this.el.hidden) return;
    if (last) {
      this.mainIcon.set(last.output.item);
      setText(this.mainText, `${nameOf(last.output.item)}${last.output.count > 1 ? ` ×${last.output.count}` : ''}`);
    } else {
      this.mainIcon.set(entries[0].recipe.output.item);
      setText(this.mainText, 'Quick craft');
    }
    setFlag(this.main, 'short', !!last && !lastReady);
    setAttr(this.main, 'aria-label', last ? `Make ${nameOf(last.output.item)} again` : 'Quick craft: show what the pack can make');
    if (this.list.hidden) return;
    const key = entries.map((e) => `${e.recipe.id}:${e.available}`).join(',');
    if (key === this.shownKey) return;
    this.shownKey = key;
    clear(this.list);
    for (const e of entries) {
      const icon = new ItemIcon();
      icon.set(e.recipe.output.item);
      const btn = h(
        'button',
        { class: 'hw-quick__item', attrs: { type: 'button', role: 'menuitem', 'data-id': e.recipe.id } },
        icon.el,
        h('span', { text: `${nameOf(e.recipe.output.item)}${e.recipe.output.count > 1 ? ` ×${e.recipe.output.count}` : ''}` }),
        h('span', { class: 'hw-num hw-quick__n', text: e.available > 1 ? `can make ${e.available}` : '' }),
      );
      btn.addEventListener('click', () => this.report(quickCraft(this.player, e.recipe.id, 1)));
      this.list.appendChild(btn);
    }
    if (entries.length === 0) this.list.appendChild(h('p', { class: 'hw-quick__empty', text: 'Nothing the pack can make by hand right now.' }));
  }
}
