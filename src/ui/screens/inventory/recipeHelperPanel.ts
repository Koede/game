/**
 * The recipe helper strip of a crafting screen (docs/api/assist.md): pick a recipe to pin, see each ingredient against the
 * pack and nearby chests with the missing ones marked, and how many recipes each station could make right now.
 */
import { itemOrNull, recipe as recipeById } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { Inventory } from '../../../game/inventory';
import { canMakeNow, pinnedStatus } from '../../../game/recipeHelper';
import type { PlayerState } from '../../../game/playerState';
import { Button } from '../../kit/controls';
import { clear, h, setText } from '../../kit/dom';
import { formatCount } from '../../kit/format';
import { ItemIcon } from '../../kit/icons';

const nameOf = (key: string): string => itemOrNull(key)?.name ?? key;
const STATION_LABEL: Record<string, string> = { hand: 'Hand', workbench: 'Bench', furnace: 'Furnace' };

export class RecipeHelperPanel {
  readonly el: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly pinnedEl: HTMLDivElement;
  private readonly readyEl: HTMLDivElement;
  private readonly unpin: Button;
  private shownKey = '';

  constructor(private readonly player: PlayerState, recipes: readonly RecipeDef[], private readonly onChange: () => void) {
    this.select = h('select', { class: 'hw-helper__select', attrs: { 'aria-label': 'Pin a recipe to track its ingredients' } });
    this.select.appendChild(h('option', { attrs: { value: '' }, text: 'Pin a recipe...' }));
    const seen = new Set<string>();
    const options = [...recipes];
    const pinned = player.assist.pinned ? recipeById(player.assist.pinned) : null;
    if (pinned && !options.some((r) => r.id === pinned.id)) options.unshift(pinned);
    for (const r of options) {
      if (seen.has(r.output.item)) continue;
      seen.add(r.output.item);
      this.select.appendChild(h('option', { attrs: { value: r.id }, text: nameOf(r.output.item) }));
    }
    this.select.addEventListener('change', () => {
      this.player.assist.pinned = this.select.value === '' ? null : this.select.value;
      this.onChange();
    });
    this.unpin = new Button({
      label: 'Unpin',
      kind: 'quiet',
      size: 'sm',
      onClick: () => {
        this.player.assist.pinned = null;
        this.onChange();
      },
    });
    this.pinnedEl = h('div', { class: 'hw-recipe__chips hw-helper__pinned' });
    this.readyEl = h('div', { class: 'hw-craft__note hw-helper__ready' });
    this.el = h('div', { class: 'hw-helper', attrs: { 'data-testid': 'recipe-helper' } }, h('div', { class: 'hw-helper__bar' }, this.select, this.unpin.el), this.pinnedEl, this.readyEl);
  }

  /** `crates`: chests lending ingredients here. */
  refresh(crates: readonly Inventory[]): void {
    const pack = this.player.inventory;
    const id = this.player.assist.pinned;
    const recipe = id ? recipeById(id) : null;
    if (this.select.value !== (recipe?.id ?? '')) this.select.value = recipe?.id ?? '';
    this.unpin.el.hidden = !recipe;
    this.pinnedEl.hidden = !recipe;
    if (recipe) {
      const st = pinnedStatus(recipe, pack, crates);
      const key = JSON.stringify([st.recipeId, st.ingredients]);
      if (key !== this.shownKey) {
        this.shownKey = key;
        clear(this.pinnedEl);
        for (const ing of st.ingredients) {
          const icon = new ItemIcon();
          icon.set(ing.item);
          const have = ing.inPack + ing.inChests;
          const chip = h('span', { class: 'hw-ingr', attrs: { 'data-short': ing.missing > 0 ? 'true' : null, 'data-pinned': 'true', title: `${nameOf(ing.item)}: pack ${ing.inPack}${crates.length ? `, chests ${ing.inChests}` : ''}, need ${ing.need}` } },
            icon.el,
            h('span', { class: 'hw-ingr__qty hw-num', text: `${formatCount(have)}/${formatCount(ing.need)}` }),
            h('span', { class: 'hw-ingr__name', text: ing.missing > 0 ? `${nameOf(ing.item)} (need ${ing.missing} more)` : ing.inPack >= ing.need ? nameOf(ing.item) : `${nameOf(ing.item)} (some in chest)` }),
          );
          this.pinnedEl.appendChild(chip);
        }
      }
    } else {
      this.shownKey = '';
    }
    const ready = canMakeNow([pack, ...crates]);
    setText(this.readyEl, `Can make now: ${ready.map((r) => `${STATION_LABEL[r.station] ?? r.station} ${r.count}`).join(' · ')}`);
  }

  dispose(): void {
    this.unpin.dispose();
  }
}
