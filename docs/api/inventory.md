
## Housekeeping (src/game/inventoryTools.ts)
- `sortRange(inv, start, end)` merges stacks (tools with wear stay separate) and packs the range to the front in category, then item
  order; favourite slots stay where they are. The Sort button beside the Backpack heading sorts the backpack (not the hotbar).
- Favourites: `toggleFavourite`, `favouritesOf`, `setFavourites`; saved in the player snapshot (`favourites`), drawn as a star on the
  slot (`data-favourite`). Sort and move-all skip them.
- `moveAllOf(from, item, targets)`: every stack of one item to the quick-move destinations. Pick a stack and press "Move all like
  this" in the carry bar (only shown when another stack of it exists). The same bar has Favourite / Unfavourite.
- Check: `node scripts/e2e-inventory.mjs`.

## Moves (src/game/inventoryMoves.ts, pockets.ts)
- **Drop one.** A right-click (or long-press) on a slot while a stack is held places one item and keeps the rest held. A plain
  tap still places the whole stack, as before.
- **Drag to spread.** Press the held slot and drag over empty or matching slots; on release the stack is split evenly over them
  (`distributeStack`: even shares, a share a slot cannot hold passes on). Released anywhere else nothing moves: the stack stays in
  its origin slot. Half stacks do not drag.
- **Bulk section move.** Shift-click (desktop) or a two-finger tap (phone) sends the whole stack round the bag's sections: the
  hotbar, then each pocket, wrapping round (`sectionMove`). With no pockets this is the old hotbar <-> backpack move.
- **Undo.** `MoveHistory` keeps the snapshot from before the last move (moves only, not sorts). Ctrl+Z, or the Undo button in the
  bag's heading row while there is a step to take back. Cleared when the bag closes. Never saved.
- **Locks.** `inv.locked` holds the locked slots, saved as `locks` (sorted indices; missing means none). A locked slot takes nothing
  in (`accepts` says no), its stack cannot be moved, dropped or sorted, and move-all and gather skip it. Crafting and eating still
  use what is there. Set from the carry bar (Lock / Unlock). The badge is a small box on the slot.
- **Sort.** `sortRange(inv, start, end, mode)`. `'kind'` (the default): category (tools, worn gear, food, fuel, materials, components, resources, blocks, machines, odds), then tool tier (best first), then name. `'recent'`
  (Order: newest): the most recently picked up stack first. Every stack that lands in a slot takes the next pickup tick
  (`inv.ticks`, moves carry it, sorts keep the newest of merged stacks); saved as `picked` (per slot, missing means none). The order
  is a display choice and is not saved. The Sort button sorts each pocket on its own.
- **Gather matching.** The carry bar's "Gather matching" pulls every stack that can merge into the held slot, from its section,
  up to the stack limit (`gatherMatching`). Worn tools, enchanted and quality stacks, favourites and locked slots never move.
- **Pockets.** The backpack is split into named sections: `{ name, start, end }`, saved as `pockets` (missing means one pocket,
  "Backpack"). A Belt Pouch (workbench: 2 leather, 2 cord) is sewn in from the carry bar ("Sew in pocket"): it cuts the largest
  pocket in two, the names come from Tools, Food, Building, Misc, and there are at most four. Items do not move. Labels show
  inside the pack grid when there is more than one. The hotbar is not split. Not done: labelled crate blocks.
- **Return on cancel.** See Drag to spread: a drag released outside the bag changes nothing.
- Check: `npx vitest run src/game/inventoryMoves.test.ts src/game/pockets.test.ts src/game/inventoryTools.test.ts`.
