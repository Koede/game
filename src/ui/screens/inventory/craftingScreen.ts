/**
 * A bag + recipe list screen: the inventory (hand recipes) and the workbench are both this, with different
 * recipes and ingredient sources.
 */
import { recipe as recipeById } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { Inventory } from '../../../game/inventory';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { RecipeList } from '../../kit/recipe';
import { Window } from '../../kit/window';
import { InventoryPanel } from './inventoryPanel';
import { BATCH, makeRecipe, recipeRows } from './recipeRows';

export interface CraftingScreenOptions {
  title: string;
  subtitle: string;
  listTitle: string;
  recipes: readonly RecipeDef[];
  /** Crates lending ingredients (read on every refresh). */
  crates: () => readonly Inventory[];
  /** Optional line above the list ("2 crates nearby lend ingredients"). */
  note?: (crates: number) => string;
}

const coarsePointer = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const SLOT_HINT_TOUCH = 'Tap a stack, then tap where it goes. Long-press: half. Double-tap: quick move. Pick a stack to Drop it.';
export const SLOT_HINT_MOUSE = 'Click a stack, then click where it goes. Right-click: half. Shift-click: quick move. Q: drop.';
export const slotHint = (): string => (coarsePointer() ? SLOT_HINT_TOUCH : SLOT_HINT_MOUSE);

export function createCraftingScreen(ctx: ScreenContext, opts: CraftingScreenOptions): GameScreen {
  const player = ctx.player;
  const inventory = player.inventory;
  const bag = new InventoryPanel(ctx.slots, inventory);
  const list = new RecipeList({
    label: opts.listTitle,
    many: BATCH,
    emptyText: 'Nothing to make here.',
    onMake: (id, count) => {
      const recipe = recipeById(id);
      if (!recipe) return;
      const result = makeRecipe(player, recipe, count, opts.crates());
      if (!result.ok) {
        ctx.bus.emit('toast', { text: result.reason, kind: 'warn' });
        ctx.bus.emit('sfx', { name: 'error' });
      }
      ctx.invalidate();
    },
  });
  const note = h('p', { class: 'hw-craft__note' });
  note.hidden = true;
  const body = h(
    'div',
    { class: 'hw-craft' },
    h('section', { class: 'hw-craft__bag' }, bag.el),
    h('section', { class: 'hw-craft__make' }, h('h3', { class: 'hw-heading', text: opts.listTitle }), note, list.el),
  );
  const window = new Window({ title: opts.title, subtitle: opts.subtitle, size: 'lg', fit: 'tall', scroll: false, body, footer: slotHint() });
  return {
    window,
    refresh: () => {
      ctx.slots.refresh();
      const crates = opts.crates();
      list.setRows(recipeRows(opts.recipes, [inventory, ...crates], inventory));
      const text = opts.note ? opts.note(crates.length) : '';
      note.hidden = text === '';
      if (note.textContent !== text) note.textContent = text;
    },
    dispose: () => {
      bag.dispose();
      list.dispose();
    },
  };
}
