# Fishing

A rod, four fish and the furnace dishes that cook them. Optional: the solver counts the fish as obtainable once a rod is
(source `fish`), and no objective needs one.

- Data: `src/content/fishing.ts` (`FISH` weights per water kind: pond, river, lake, marsh, frozen, cave; night and rain
  multipliers; `JUNK`). Content: `src/content/areas/world_fishing.ts` (hand recipe `fishing_rod` = 2 stick, 1 cord, 1 flint;
  raw perch / trout / eel / glowfin; furnace smelt recipes to fried perch, baked trout, smoked eel, roast glowfin).
- Rules: `src/sim/fishing.ts`: `waterKind(spot)`, `rollCatch(kind, {night, raining}, rng)`, `biteDelayS`, `missChance`,
  `junkChance`, `fishIn(kind)`. Randomness is injected.
- Wired: see docs/api/exploration.md.
  `WaterSpot` (depth, pool area, flow) from the world, and brewing: fish are cooking-only so far.
- Tests: `src/sim/fishing.test.ts`.
