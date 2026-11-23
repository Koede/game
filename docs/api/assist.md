# Play assist (src/game/assist.ts and friends)
Small helpers for phone play. State lives in `player.assist` (`PlayAssist`), saved in the player snapshot as `assist` (missing in
older saves = defaults).

## Recipe helper (src/game/recipeHelper.ts, src/ui/screens/inventory/recipeHelperPanel.ts)
- `player.assist.pinned`: a recipe id. `togglePin(id)` pins or unpins; unknown ids are ignored.
- `pinnedStatus(recipe, pack, chests)`: per ingredient `need / inPack / inChests / missing`, plus `ready` (pack + chests) and
  `readyFromPack`.
- `canMakeNow(sources, stations?)`: per station (hand, workbench, furnace) the number of distinct products whose ingredients are all
  at hand (heat, tier and power are not checked).
- UI: a strip above the recipe list in the inventory and workbench screens: a "Pin a recipe..." select, the pinned recipe's ingredients
  as chips (missing ones outlined, "need N more", "some in chest"), and "Can make now: Hand n · Bench n · Furnace n". Chests count at
  the workbench only.
