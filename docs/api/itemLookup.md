# "What is this for?" lookup

- `src/game/itemLookup.ts` (pure): `madeBy(item)`, `usedIn(item)`, `foundIn(item)`, `lookupItem(item)` and `cardRows(item)`. It reads the registry recipes
  plus the ones that live outside it (modular tool builds, Rune Desk and Arcane Workbench, Infusion Altar, alchemy), block and creature drops,
  animal yields, fishing, loot tables, structure crates and goal rewards. Items that code hands out (shops, family builders) answer nothing:
  the page says so.
- Screen `{ type: 'lookup', item? }` (`src/ui/screens/lookup/lookupScreen.ts`): search box (`ui/kit/search.ts`), results (the pack when nothing is typed),
  and the page of the picked item. Listed in the pause menu's page hub as "What is this for?".
- Item cards (`itemCard`) end with "Made at" (or "Found") and "Used in N recipes" rows from `cardRows`. On touch, tapping a slot to pick a stack shows
  the card for 2.6 s (`slots.ts cardOnTouch`), since slots attach tooltips with `touch: 'none'`.
- Not done: a button on the item card that opens the page for that item (`ui:open { screen: { type: 'lookup', item } }` already works), a "can I make it now?" mark.
