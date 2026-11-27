/** The inventory: the 36 slots (hotbar row marked) and the hand recipes. */
import { HAND_RECIPES } from '../../../game/crafting';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { createCraftingScreen } from './craftingScreen';

/** Items whose screen opens from a chip in the Bag (Use at the sky no longer opens them). */
const CHIPS: readonly { item: string; label: string; screen: 'notebook' | 'workshop' }[] = [
  { item: 'field_notebook', label: 'Notebook', screen: 'notebook' },
  { item: 'engineer_goggles', label: 'Workshop Guide', screen: 'workshop' },
];

export function createInventoryScreen(_request: { type: 'inventory' }, ctx: ScreenContext): GameScreen {
  const row = document.createElement('div');
  row.className = 'hw-bag-chips';
  row.hidden = true;
  const buttons = CHIPS.map((c) => {
    const b = new Button({ label: c.label, kind: 'quiet', onClick: () => ctx.bus.emit('ui:open', { screen: { type: c.screen } }) });
    b.el.hidden = true;
    row.appendChild(b.el);
    return b;
  });
  return createCraftingScreen(ctx, {
    chips: {
      el: row,
      refresh: () => {
        let any = false;
        CHIPS.forEach((c, i) => {
          const has = ctx.player.inventory.has(c.item);
          buttons[i].el.hidden = !has;
          any ||= has;
        });
        row.hidden = !any;
      },
    },
    title: 'Inventory',
    subtitle: 'Your pack, and what hands alone can make',
    listTitle: 'Make by hand',
    recipes: HAND_RECIPES,
    crates: () => [],
  });
}
