
## Housekeeping (src/game/inventoryTools.ts)
- `sortRange(inv, start, end)` merges stacks (tools with wear stay separate) and packs the range to the front in category, then item
  order; favourite slots stay where they are. The Sort button beside the Backpack heading sorts the backpack (not the hotbar).
- Favourites: `toggleFavourite`, `favouritesOf`, `setFavourites`; saved in the player snapshot (`favourites`), drawn as a star on the
  slot (`data-favourite`). Sort and move-all skip them.
- `moveAllOf(from, item, targets)`: every stack of one item to the quick-move destinations. Pick a stack and press "Move all like
  this" in the carry bar (only shown when another stack of it exists). The same bar has Favourite / Unfavourite.
- Check: `node scripts/e2e-inventory.mjs`.
