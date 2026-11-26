# Caves and depths

## Goal

Underground that rewards going down: bigger caves with distinct rooms, a reason to carry light and a pickaxe, and loot at the bottom.

## What is fun

Exploring with a torch, finding a glowing grotto or a flooded hall, a small risk (a drop, gas, a nest) and a clear prize.

## What exists

World generation in `src/world` (terrain, ore veins, structures, springs, treasure), ruin crates and structure loot, fluids and lighting.
Check how caves are carved today before choosing a technique (noise worms versus rooms and tunnels).

## Design

1. **Cave types.** Winding tunnels, a few large chambers, a grotto with glowing growth, a flooded hall, a collapsed mine shaft.
2. **Rooms with a purpose.** Some chambers hold a feature: an old camp with a crate, a spring of essentia, a vein cluster, a nest.
3. **Hazards that teach.** Foul air pockets (pair with torches going out), loose ceilings you can hear, deep water, a drop you can see.
4. **Depth bands.** Richer ore and better loot lower down; the Old Works ruins (deep tier) sometimes open into cave rooms.
5. **Navigation.** Waystones and chalk marks as placeable breadcrumbs; the map shows places you have been, not what you have not.

## Phases

1. Larger chambers and tunnel network by depth band.
2. Room features and crates on the loot tables.
3. Hazards and lighting rules.
4. Breadcrumb items and map notes.

## Tests

Generation determinism per seed; every cave connects to the surface or to another cave; no features embedded in solid rock; ore and loot
respect depth bands; performance of chunk generation (budget per chunk).

## Risks

Chunk generation cost on a phone; caves cutting through structures and the tavern; getting lost with no way back (waystones early).

## Status (built)

Phases 1 to 3 are in; phase 4 (waystones, chalk marks, map notes) is not.

- **Depth bands** (`CAVE_BANDS` in `src/world/caveRooms.ts`): deep y 0-19, middle 20-35, shallow 36 and up. Below y 36 the tunnel network widens and chambers
  grow (`src/world/caves.ts`, `WIDEN_*`), up to about twice the tunnel area near the bottom.
- **Cave rooms**, one per chunk at most (about 30% of chunks try, about 22% build), stamped into the chunk's own cave air so they are reached by the
  caves that exist: `camp` (crate, lit torch, fallen log), `lode` (a cluster of the band's rarer ore on a wall; only ore the depth allows), `sinkhole`
  (a 3-wide shaft, 5-7 deep, glowcap rim, ore at the bottom; never nearer than 2 blocks to the lava) and `gas` (a pocket of the new `foul_air`
  block, which hurts to stand in, guarding a lode).
- **Foul air** (`foul_air`, id 281, cross-shaped wisps, `contactDamage: 1`, death cause `gas`). Torches going out in it is not built.
- **Camp loot**: named tables `cave_camp_shallow`, `cave_camp_middle`, `cave_camp_deep` in `src/content/loot.ts`. The camp's crate is a generated voxel;
  the World gives it its entity and loot on first load (`findCaveCamp` in `world.ts`).
- **Hooks** (all exported from `src/world`): `caveBandAt(y)`, `caveCampTable(band)`, `caveRoomPlan(seed, cx, cz)` (what a chunk will try, and the columns),
  `caveRoomOf(seed, cx, cz)` (the room actually built), `findCaveCamp(...)`, `lodeOre(y, roll)`. To put a fixed or enchanted item in a camp, add a
  `NAMED_FINDS` entry whose `table` is `cave_camp_<band>`. A boss arena can be a new `CaveRoomKind` in the same file: add it to `KIND_WEIGHTS` and `RANGE`.
- Cost: chunk generation 1.26 to 1.30 ms average (about 3%), bundle +11 KB (0.14%).
