# Exploration layer (waypoints, treasure maps, fishing)

`src/game/exploration.ts` - class `Exploration`, owned by `GameState.exploration` (headless, saved with
`World.persist('exploration')`, ticked from `GameState.tick`). The app's `beforeUse` hook (src/app/game.ts) calls
`exploration.use(hit, heldStack)` first; `exploration.teleport` is bound to the controller.

- **Waypoint stones**: registered on `block:placed`; broken ones are pruned on the next Use. Empty-hand Use shows the
  next destination and its charcoal price (cycles); Use holding charcoal travels (pays `travelCost`, lands one block above
  the target stone). Holding a block item (placing another stone) is never hijacked.
- **Treasure maps**: loot item (weight 2 near / 3 deep ruin crates). The stack's `durability` = `serial*8 + age`, set on the
  first read (age = player's current age). The serial fixes a search region (120-620 blocks from the origin); the
  landmark is picked among the ruins there (`spawnRuin` + `squareRuin`), so a map points at the same place wherever it
  is read. Reading toasts the clue plus a warm/cold hint. Within 24 blocks of the spot a crate with the loot is buried
  at the surface (once per serial, remembered in the save).
- **Fishing**: Use a rod aimed at water: cast (water measured: depth, pool area, flow, cave); after 4-12 s "Something
  bites!", Use within 1.8 s to land `rollCatch`; Use while waiting reels in empty; the cast is lost when you walk 8
  blocks away or put the rod down. Each landing wears the rod by one.
- **Brewing**: not linked. A seventh drink breaks the six-cups objective and the one-ingredient-per-drink contract, and a
  second furnace recipe per fish breaks the unique-input rule; a brewing use for fish needs those contracts relaxed first.

Tests: `src/game/exploration.test.ts`. Rules: waypoints.md, treasure.md, fishing.md.
