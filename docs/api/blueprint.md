# Blueprints

Save a built layout, then rebuild it elsewhere from materials: either by hand from the pack, or by handing it to Gruk.

## Rules (src/game/blueprint.ts) - pure over `IWorld`
- `captureBlueprint(world, cornerA, cornerB, name)` saves the box: every block that has an item, **machines included** (they get fresh
  entities when placed; entity contents are not kept), skipping air and liquids. Null when empty, over `MAX_BLUEPRINT_CELLS` (4096) or a
  side over `MAX_BLUEPRINT_SIDE` (32). Each cell keeps `block`, `facing` and the `item` that places it.
- `materialsOf(bp)`: one item per cell, merged. `rotateBlueprint(bp, turns)`: quarter turns clockwise from above, facings turn too.
- `checkSite(world, bp, origin)`: per cell `free` / `right` (already that block) / `blocked` (something else is there).
- `new BuildJob(bp, origin)`; `tick(dt, world, source, builders, changeSource?)` places bottom-up, one block per builder per 0.6 s, one item
  per block from a `MaterialSource` (an `Inventory`, or `FREE_SOURCE`). A dry source sets `missing`; `resume()` retries. `toJSON` /
  `BuildJob.fromJSON` save a job.

## The book (src/game/blueprintBook.ts) - `player.blueprints`
- Saved in the player snapshot as `blueprints` (missing in older saves = empty). Holds up to `MAX_BLUEPRINTS` (24) entries
  `{ id, bp, origin: 'saved' | 'granted' }` and up to `MAX_JOBS` (3) Gruk jobs.
- **Granting API for other systems (ruins, daily goals):** `player.blueprints.grant(what, id?)` where `what` is a catalog id
  (`BLUEPRINT_CATALOG`: `stone_hut`, `plank_shed`, `storage_row`) or a finished `Blueprint` (then pass a stable `id` so a repeat grant is
  noticed). Returns `{ ok, added, text }`; show `text` as a toast. Add a catalog entry (a function returning a Blueprint) to hand out a new one.
- `commission(bp, origin)` starts a Gruk job; `cancelJob(id)`.
- `tickJobs(book, dt, world, stock, playerPos, free)`: called by the app each fixed tick (`AppState.tickBlueprints`). `JOB_BUILDERS` = 2 hands;
  a job pauses while the player is farther than `JOB_RANGE` (48) from its site; it draws from the pack (free in Dev Mode free placing), toasts
  once when it runs dry and once when finished.

## Player tools (src/game/blueprintTools.ts, src/ui/hud/blueprintPanel.ts, src/ui/hud/buildChip.ts)
- Build chip menu: "Save blueprint: corner 1 / corner 2" (key B), "Blueprints" (key K).
- The panel lists blueprints with size, materials against the pack (short ones outlined), Place / Rename / Delete (two taps), and Gruk's builds with
  progress or what he waits for.
- Place picks a blueprint: a bar under the chip shows the placement ghost at the aim (the existing `ghost:show`: blue where it goes, red hatching
  where something is in the way; at most 1024 cells) with **Gruk builds**, **Build here** (instant from the pack, skipping what it cannot pay for or
  what is blocked), **Turn** and **Cancel**. The block under the crosshair gives the low corner (the aimed face's cell).

## Feeding the book from other systems
- **Event:** `bus.emit('blueprint:grant', { id: 'stone_hut' })` (catalog id) or `{ id: 'my:stable-id', blueprint }`; the app grants it and toasts.
  Daily goals: add a `blueprint` Reward variant and emit this from `grant`; nothing else is needed.
- **Old plans (ruins):** `AppState.syncOldPlans` copies every plan `state.oldPlans` knows (`list()` / `blueprintOf(id)`) into the book as
  `plan:<id>` about once a second. It looks `oldPlans` up by name, so it does nothing until that module exists and works once it is merged.
- A cell without `item` (old plans) is given the item that places its block when it is loaded.
