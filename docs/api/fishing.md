# Fishing

A rod, nine fish, the furnace dishes that cook them, and two pot dishes (fish chowder, winter broth). Optional: the solver counts the fish as obtainable once a rod is
(source `fish`), and no objective needs one.

- Data: `src/content/fishing.ts` (`FISH` weights per water kind: pond, river, lake, marsh, frozen, cave; night and rain
  multipliers; `JUNK`). Content: `src/content/areas/world_fishing.ts` (hand recipe `fishing_rod` = 2 stick, 1 cord, 1 flint;
  raw perch / trout / eel / glowfin; furnace smelt recipes to fried perch, baked trout, smoked eel, roast glowfin).
- Rules: `src/sim/fishing.ts`: `waterKind(spot)`, `rollCatch(kind, {night, raining}, rng)`, `biteDelayS`, `missChance`,
  `junkChance`, `fishIn(kind)`. Randomness is injected.
- Wired: see docs/api/exploration.md.
- Tests: `src/sim/fishing.test.ts`.

## Place, season and winter dishes
- `FishSpec.seasons` multiplies a fish's weight per season (absent = 1, 0 = gone): salmon run in autumn and vanish in winter,
  whitefish peak under winter ice, pike bite hardest in the cold, carp in summer, crayfish only in the warm months.
  `CastContext.season` is optional (no season = no effect); the Exploration host's optional `day()` supplies it
  (`seasonOf(day)`, state.ts passes the clock). `fishInSeason(kind, season)` lists what can bite; a test keeps every
  water kind stocked in every season.
- Pot dishes (Clay Furnace, `forge` kind, like the hearth stew; the pail comes back): `fish_chowder` = cooked fish + potato +
  water -> Well-Fed 300 s (hunger 10; the stew is 360 s / 12); `winter_broth` = cooked whitefish / trout / pike + carrot + water
  -> Well-Warmed 240 s (hunger 6; equal to a mug of ale). Both reuse existing buffs (no new multipliers), and cooking
  quality still lengthens them. `FoodSpec.buff` gained `'well_warmed'` (hunger.ts; the broth does not emit the `well_warmed`
  objective flag).
