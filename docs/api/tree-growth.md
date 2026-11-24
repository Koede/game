# Tree growth

Trees grow a day at a time. A tree that has stood since day `p` is drawn at its grown height on day `d`, where
its age is `d - 1 - p`. Trees that exist at world creation are planted on day 0, so they are 0 days old on day 1.
Trees first seen later are planted on the day they are first seen, and trees in a save from before growth are age 0
when first seen, so nothing jumps. Code: `src/world/treeGrowth.ts` (rules and `growChunk`), `src/world/world.ts`
(`growChunkAt`, `treeStanding`, the day change, the save key), `src/app/state.ts` (`setDayProvider`).
Tests: `src/world/treeGrowth.test.ts`. The generator itself is `src/world/flora.ts`, unchanged except `CANOPY` is exported.

## The table

| Kind | Generated trunk | Cap (blocks) | Days to cap |
| --- | --- | --- | --- |
| oak | 4-6 | 8 | 6 |
| oak bush | 1-2 | 3 | 4 |
| broad oak | 6-8 | 10 | 10 |
| pine | 5-7 | 12 | 10 |
| tall pine | 9-12 | 14 | 10 |
| willow | 4-6 | 8 | 8 |

Snags are dead wood and never grow. `grownTrunk(kind, trunk, age)` gives the trunk on a given age: the generated
trunk plus an even share of the gap to the cap, reached on the rule day. It never shrinks and never passes the cap.

## What grows

- The trunk grows up through air, and through the tree's own leaves where it passes its old crown. The crown is drawn
  again at the new top, with the same template as the generator. The old crown stays where it is.
- Crown radius does not grow: the crown shapes are fixed templates in `flora.ts`.
- Growth writes only voxels that are air, or a leaf that a trunk log replaces. Solid blocks, liquids and anything the
  player or the world changed (an edit in the log) are never touched.
- A tree stands while no voxel of its trunk, from the ground up to its grown top, was edited. A felled, chopped or
  decayed tree stops growing. Its grown voxels that were not edited go back to the generated state.

## How it stays consistent

Each loaded chunk keeps a record of the voxels growth wrote (flat `[index, from, to]` triples, dropped when the chunk
unloads). When the day changes, `World.update` puts those voxels back and grows the chunk again to the new day, so a
chunk always equals a fresh load on that day. A day-by-day walk and a single jump to the same day end in the same
voxels (`treeGrowth.test.ts`). Growth is not an edit: it is not in the edit log, and it is recomputed on every load.

## Save

Only the planting days are saved, under the module key `treeAges` in the world extras: a flat list `[x, z, day, ...]`
of every tree root seen standing. Voxels come back from the seed and the edit log. Old saves (no key) load with no
planting days, so the trees they hold are planted on the day they are first seen.

## Where it runs

- `World` gets the clock day from `setDayProvider` (set by `GameState` after it creates the clock). The default is day 1.
- A chunk that loads grows to the current day in its `chunk:loaded` handler.
- A day change regrows every loaded chunk in the next `World.update`, once per day.
