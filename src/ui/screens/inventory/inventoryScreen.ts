/** The inventory: the 36 slots (hotbar row marked) and the hand recipes. */
import { HAND_RECIPES } from '../../../game/crafting';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { createCraftingScreen } from './craftingScreen';

export function createInventoryScreen(_request: { type: 'inventory' }, ctx: ScreenContext): GameScreen {
  return createCraftingScreen(ctx, {
    title: 'Inventory',
    subtitle: 'Your pack, and what hands alone can make',
    listTitle: 'Make by hand',
    recipes: HAND_RECIPES,
    crates: () => [],
  });
}
