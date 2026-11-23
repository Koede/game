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

## Quick-craft (src/game/quickCraft.ts, src/ui/hud/quickCraft.ts)
- `player.assist.lastHand`: the last hand recipe made by any route (set in `craftByPlayer`).
- `quickCraft(player, id, times?)`: a hand recipe from the pack alone; `repeatLastHand(player)`: once more (null if none yet);
  `quickList(player, limit?)`: hand recipes the pack can make now, last made first, one per product.
- HUD: a chip in the top-right cluster, hidden until something can be made. The name button repeats the last recipe; the arrow opens
  the list. A refused craft toasts the reason. No screen opens.

## Item magnet (src/game/magnet.ts)
- Setting `Settings.itemMagnet`: `'off' | 'small' | 'large'` (default off; older saved settings read as off), in Settings > Game.
  Small pulls dropped items within 3 blocks, large within 6 (speed 8 / 10 blocks/s). Off is the normal 1.4 block pickup.
- The app copies the setting to `player.assist.magnet` (runtime only); `Survival.tick` adds `magnetCollector(mode)` to the collectors
  `GroundItems.tick` already takes, so it follows the same rules (pickup delay, full pack = no pull).
