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

## Undo and copy-paste (src/game/buildTools.ts, src/ui/hud/buildChip.ts)
- `BuildTools(world, player, bus)` logs every `block:placed` whose block has an item (not liquids or crops), the last `UNDO_LIMIT` = 10.
  `undo()` takes the newest still-standing one out with `setVoxel(AIR, 'player')` (the sim spills machine contents as for a break) and
  returns the item (nothing in Dev Mode free placing). Blocks broken or replaced since are skipped.
- Copy: `markCorner(x, y, z)` twice; the box must be at most `CLIP_MAX` = 8 per side. Blocks without an item (water, crops) are not
  copied; entity contents are not copied; machines get fresh entities from the sim on paste. `paste(x, y, z)` puts the clip's low
  corner there, fills only replaceable cells (never into the player), costs one item per block from the pack (free in Dev Mode),
  skips what it cannot pay for and says so. A paste is not logged for undo and does not emit `block:placed` (no stats or goals).
- HUD chip (top-right cluster): "Undo xN", an arrow menu with Mark corner / Paste at aim / Cancel copy; shown while there is something
  to undo, a copy in progress, or a block in hand. Keys: Z undo, C mark corner, V paste, X repeat the last hand recipe (no screen open).
  Mark and Paste use the block under the crosshair (paste goes on the aimed face).
