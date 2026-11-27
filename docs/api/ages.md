# The six ages and six furnace tiers (BRONZE_PLAN W0, built)

One table decides every gate. Furnace tier = age index + 1; the furnace's own `FurnaceTierSpec.age` says which age
reaching it begins (`src/content/tech.ts`, `AGES` there). Names are lower case in code (`AgeName`, `src/magic/ageMap.ts`).

| Age (index) | Name | Furnace (tier) | Max C | Needs | Notes |
|---|---|---|---|---|---|
| 0 | `ember` | Clay Furnace (1) | 800 | built from 12 rubble + 6 clay at the workbench | single block, 1 crucible |
| 1 | `bronze` | Bronze Furnace (2) | 1100 | upgrade the Clay Furnace in place: 8 bronze_ingot, 4 firebrick, 1 bellows, fire at 700 C | **single block, no hearth**, 2 crucibles, 2 fuel slots, speed 1.1, warmth 7 |
| 2 | `forge` | Blast Furnace (3) | 1500 | upgrade: 4 bronze_ingot, 1 bellows at 700 C, **and a formed Blast hearth** | first hearth (the boiler of BRONZE_PLAN is the first multiblock, the hearth the second) |
| 3 | `current` | Arc Furnace (4) | 2100 | 2 copper_coil, 2 steel_plate at 1200 C, Arc hearth | electric heat from here |
| 4 | `atomic` | Plasma Furnace (5) | 3200 | 2 circuit, 2 tungsten_rod at 1900 C, Plasma hearth | |
| 5 | `star` | Starhearth (6) | 3200, then ignited | 1 star_core, 4 deuterium_cell at 3000 C, Star hearth | ignition 300 kW for 90 s |

Constants (`src/core/constants.ts`): `BRONZE_TIER` 2, `FIRST_HEARTH_TIER` 3, `LONE_MAX_TIER` 2 (a furnace without a formed
hearth runs as the Bronze Furnace at most: `effTier = min(tier, max(2, hearth tier))`), `FIRST_ELECTRIC_TIER` 4, `STAR_TIER` 6.
Never write a bare 2/3/5 for these.

## What gates what now
- **Recipes** (`RecipeSpec.minTier`, furnace tier, 1-based) and **items/blocks** (`age`) use these numbers. `forge(N, ...)` in the
  recipe files: N is the tier; `age` of a furnace recipe is `N - 1`. `content.test.ts` proves every declared age against the
  progression solver (`src/content/progression.ts`), so a wrong number fails there.
- **Bronze Age items are forged at the Bronze Furnace** (`forge(2, ...)`, age 1): all workshop pieces (`recipesWorkshop.ts`; the six
  that were workbench recipes are furnace recipes now), the Rune Desk, Essentia Tube and Arcane Pedestal (`recipesMagic.ts`), and the
  Hand Vacuum Pump (`recipes.ts`, `itemsGround.ts`). Gathering rods, foci and the Scrying Lens have no furnace recipe of their own and
  stand on those items.
- **Forge** (tier 3, age 2): iron, steel, coke, crusher, fluid pipes, steel conveyor, hatches, refractory brick, electrode.
  **Current** (tier 4, age 3): chainsaw, tractor, still, engines, circuits. **Atomic** (5, age 4), **Star** (6, age 5).
- **Objectives**: `OBJECTIVES[i].age` is the age index; Ember ends with `bronze_furnace` (furnaceTier 2), then the Bronze goals
  (the eleven workshop goals), then `blast_furnace` (furnaceTier 3, age 1) which opens the Forge Age. Goals of later ages moved up by one.
- **Old magic ages** (`ageMap.ts`): `AGE_INDEX = { ember 0, bronze 1, forge 2, current 3, atomic 4, star 5 }`.
- **Loot**: `lootMaxAge` near 0, deep 2 (iron may appear deep).

## Blocks: ids did not move
Voxels store the numeric block id, which is the index in `BLOCK_SPECS`. `furnace_bronze` is appended after every older block, so
a saved world keeps every block. New blocks must keep being appended.

## Save version 2 (`src/save/document.ts`, `migrateSixAges`)
Envelope version 1 -> 2: furnace entities `tier`, `effTier` and `hearth.tier` of 2 or more get +1 (a formed Blast hearth stays
formed: its furnace block is still `furnace_blast`, now tier 3); `objectives.age` of 1 or more gets +1; `objectives.peaks.tier` of
2 or more gets +1; a save that had built the Blast Furnace gets `bronze_furnace` added to `completed`, so its place in the list is
unchanged. Settings of the old version load unchanged. The fixture `tests/fixtures/save-before-bronze.json` (written by the
five-tier build, with a formed Blast hearth, a pack, research and the whole Ember age done) is loaded by `src/save/oldSave.test.ts`.

## For the streams that follow
- A new gate is `minTier`/`age` of the new tier numbers above; `forge(2, ...)` for Bronze content.
- `tierLock` (src/sim/furnaceActions.ts) says "Needs the Bronze Furnace" / "Needs a formed Blast hearth".
- Tier-1 furnaces upgrade to Bronze without a hearth; `upgradeStructure` only asks for a hearth from tier 3.
- The Structure tab explains the hearth to Clay and Bronze furnaces (`FIRST_HEARTH_TIER`).
