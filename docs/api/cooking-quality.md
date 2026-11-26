# Cooking quality

`src/game/cookingQuality.ts`; `ItemStack.quality` (1 Tasty, 2 Exquisite) now also lives on foods.

- `dishScore` (0..100) = 30 + variety (12 per extra food family, max 24) + 10 x mean ingredient quality + 30 x heat score.
  `heatScore(heatC, dish)` is 1 at the dish's ideal temperature (`IDEAL_HEAT_C`, default 200 C) falling to 0 at 120 C off.
  An unheated station counts as 0.3. 55+ is Tasty, 80+ Exquisite.
- `craftByPlayer(player, recipe, { heatC })` stamps a single-craft food with its quality; `ingredientQuality` reads it from the pack.
- Quality stacks never merge with other qualities (`canMerge`, `Inventory.add`) and survive save/load and transfers.
- `eat()` scales hunger (x1.2 / x1.5) and buff seconds (x1.5 / x2) by `foodStrength`.
- Left for wiring: the sim's furnace forge outputs (stew, bread) should pass the pot temperature to `dishQuality` and give the stack its quality.

Wired: `sim/furnaceActions.forge` passes the furnace temperature (`heatC: e.tempC`) to `craftByPlayer`, so forged stew and bread get quality.

Shown (R2): `dishLabel(stack)` ('Tasty' / 'Exquisite', '' for ordinary and non-foods) and `dishEffect(q)` ("Tasty: 20% more
food, buffs last 1.5x") feed `stackName` ("Tasty Bread") and the item card's Quality row.
