# Blueprint mode

`src/game/blueprint.ts` - pure rules over `IWorld` and `Inventory`.

- `captureBlueprint(world, cornerA, cornerB, name)` saves the box (air, liquids and machines skipped, max 4096 cells; null when empty
  or too big). `materialsOf(bp)` lists one item per cell (block key = item key).
- `new BuildJob(bp, origin)`; `tick(dt, world, chest, builders)` places cells bottom-up, one block per builder per 0.6 s, taking one item
  from the chest per block. Cells already right or occupied are skipped. A dry chest sets `missing` and the job `waiting`; `resume()`
  after restocking. `state` is `building | waiting | done`, `progress` 0..1. `toJSON` / `BuildJob.fromJSON` save a job.
- `tick(dt, world, source, builders)` takes any `MaterialSource` (`remove` / `add`): a chest `Inventory` or a `NetworkSource`.

## In play (`src/game/blueprints.ts`, `Blueprints`, created in `GameState` as `state.blueprints`)

- The tool is the Builder's Square (`builders_square`, workbench: 2 stick, 1 plank, 1 charcoal; content
  `src/content/areas/build_blueprints.ts`, icon `src/render/textures/areas/build_blueprints.ts`). Held, Use (a tap on a phone, right
  click with a mouse) goes to `blueprints.use(hit, held)` first in the app's `beforeUse` hook.
- Capture mode: tap 1 sets corner 1, tap 2 corner 2 (each side at most `BLUEPRINT_MAX_SIDE` 24), a third tap starts a new box.
  `confirm(world)` (the chip's "Save blueprint") captures it as "Blueprint N" (at most 12 kept, oldest dropped).
- Place mode: tap a block, the site's low corner is the cell on the tapped face; `confirm` ("Raise it here") starts a `BuildJob`
  bound to the crate nearest the site (`Simulation.storageNetwork(site)[0]`, within 12). No crate there: refused. At most 4 builds.
- Supply: each step takes from a `NetworkSource` over `storageNetwork(boundChest)`: the bound chest first, then every crate within 12
  of it (so a network reaches past the site's own range). A removed chest rebinds to the nearest one. One builder automaton per
  site (`BUILDERS_PER_JOB`); a dry network makes the job wait, toasts "X waits for Stone ..." once per shortage, and retries every
  2 s by itself. A finished build toasts and leaves the list.
- HUD: `src/ui/hud/blueprintPanel.ts`, inside the build chip (shown while the square is held or a build runs): status, materials
  (`materialsOf`, `materialsText`), Save / Raise, Cancel, Next blueprint, the mode switch and each build's progress. The box is
  outlined with the ghost preview (`ghost:show` key `blueprint`: `edgeCells` while capturing, `siteGhost` while placing: blue to
  place, red where something stands in the way). The app binds it with `bindBlueprints(state.blueprints)`.
- Save: `extras.blueprints` = `{ saved, selected, sites: [{ job: BuildJob.toJSON(), chest }] }`; `load` drops malformed entries.
- Tests: `src/game/blueprints.test.ts` (taps, outline, materials, network pull, save round trip), `src/app/blueprintsSave.test.ts`.
- Not done: rotation, a golden save row for `extras.blueprints`, naming blueprints, blueprints as items in the bag.
