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
