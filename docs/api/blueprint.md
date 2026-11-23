# Blueprint mode

`src/game/blueprint.ts` - pure rules over `IWorld` and `Inventory`.

- `captureBlueprint(world, cornerA, cornerB, name)` saves the box (air, liquids and machines skipped, max 4096 cells; null when empty
  or too big). `materialsOf(bp)` lists one item per cell (block key = item key).
- `new BuildJob(bp, origin)`; `tick(dt, world, chest, builders)` places cells bottom-up, one block per builder per 0.6 s, taking one item
  from the chest per block. Cells already right or occupied are skipped. A dry chest sets `missing` and the job `waiting`; `resume()`
  after restocking. `state` is `building | waiting | done`, `progress` 0..1. `toJSON` / `BuildJob.fromJSON` save a job.
- Not wired: no tool to pick corners, no automaton/chest binding or screen yet. Intended hookup: a builder automaton next to a labelled
  chest calls `job.tick(dt, world, chestInventory, builderCount)`.
