# Synergy: tools, blocks and items (tool-and-block half)

Existing tools, blocks and items gain new uses and cross-system links instead of new isolated content. Everything below is
implemented and unit-tested; "e2e" has not been run in a browser for this pass (unit tests drive the real `Interaction`).

**Where the code lives**
- `src/player/toolUses.ts` - one table (`TOOL_USES`) of Use rows: held tool kind or item x target block -> one visible change.
  Decided in `Interaction.use` after hand stations and pipes, before screens. Tests: `src/player/toolUses.test.ts` (one case per
  row, plus wear, fuel, cooldown and refusal cases).
- `src/content/areas/synergy_tools.ts` - 12 new blocks (appended last; ids in `blockIds.lock.json`) and their workbench recipes;
  tiles in `src/render/textures/areas/synergy_tools.ts`; roster pin `src/content/specRosterSynergyTools.ts`.
- `src/game/heldWarmth.ts` (+ test) and `src/sim/handWork.ts` (+ `handWork.test.ts`) for the two heat links.

**Conventions kept:** no key renamed, no voxel id moved, no new screens, no new saved state. A wrench still works pipes first, a
hammer still strikes an anvil first (hand stations and pipes run before the table).

## Use rows (30)

| id | Held x target | Result | System |
|---|---|---|---|
| `axe_strip_oak` | axe x oak log | Stripped Oak Log + 2 fibre | woodwork |
| `axe_strip_pine` | axe x pine log | Stripped Pine Log + fibre, 50% resin | woodwork |
| `axe_trim_leaves` | axe x leaves | sticks/fibre, leaf stays | woodwork |
| `axe_saw_slab` | axe x plank | Plank Slab + stick | woodwork |
| `saw_clear_leaves` | chainsaw x leaves | clears 3x3x3 of leaves, 1 fuel | felling |
| `saw_buck_plank` | chainsaw x plank/slab | 4 sticks, 1 fuel | felling |
| `saw_stripped_log` | chainsaw x stripped log | 6 planks, 1 fuel | felling |
| `hoe_reap_replant` | hoe x ripe crop | drops + crop back to stage 0 | farming |
| `shovel_flatten_farmland` | shovel x farmland top | dirt (nothing may grow on it) | farming |
| `hoe_scythe` | hoe x tall grass / fern / reeds / dry shrub | 2 fibre (+ stick from shrub) | farming |
| `shovel_cut_sod` | shovel x grass top | dirt + fibre | farming |
| `shovel_sift_gravel` | shovel x gravel | sand, 35% flint | masonry |
| `slop_feeds_crop` | Slop Canister x growing crop | +1 growth stage, empty canister back | distillery |
| `sugar_sweetens_bush` | sugar x picked bush | berry/tea/coffee bush fruits again | sugar |
| `pail_waters_bush` | water pail x picked bush | bush fruits again, empty pail | brewing |
| `pick_dress_brick` | pickaxe x cracked/mossy stone brick | stone brick | masonry |
| `pick_dress_limestone` | pickaxe x limestone | stone brick (2 uses) | masonry |
| `maul_cracks_brick` | maul x stone brick | cracked stone brick | masonry |
| `hammer_stone_to_rubble` | hammer x stone/limestone/basalt | rubble | masonry |
| `hammer_rubble_to_gravel` | hammer x rubble | gravel | masonry |
| `hammer_gravel_to_sand` | hammer x gravel | sand | masonry |
| `hammer_rivet_plate` | hammer x Bronze Plate Block | Riveted Plate Block | bronze |
| `stick_sweeps_flue` | stick x Brick Chimney (on a furnace) | soot swept off the furnace, stick used up (docs/api/disasters.md) | furnace |
| `pail_mosses_brick` | water pail x stone brick | mossy stone brick, empty pail | fluids |
| `pail_melts_snow` | empty pail x snow | water pail | fluids |
| `pail_chips_ice` | empty pail x ice | water pail | fluids |
| `lava_vitrifies_sand` | lava bucket x sand | glass, bronze bucket back | glass |
| `lava_fires_clay` | lava bucket x clay | brick, bronze bucket back | furnace |
| `torch_melts_snow` | torch x snow | snow gone, torch kept | survival |
| `wrench_turn_block` | wrench x side/top/back of a front-facing block | quarter turn (front still opens the screen) | machines |
| `vacuum_loose_piles` | hand vacuum x sand/gravel/rubble/snow | block into the pack for 4 s of suction | ground items |

## Hold and heat links (3)

| What | Where | Tests |
|---|---|---|
| A torch or a boiling pail / beaker / vial in the selected slot warms the player like a small fire | `src/game/heldWarmth.ts`, `Survival.tick` | `heldWarmth.test.ts` |
| A warm block (torch, lit furnace, lava...) within its warmth radius (max 3 blocks) dries the Drying Rack at night, indoors and out of the rain | `HandWork.warmNear` / `waitReason` | `handWork.test.ts` (torch case) |

## New blocks and recipe uses (12 blocks, 10 recipes)

Stripped Oak/Pine Log (axe), Plank/Stone/Brick/Stone Brick Slab, Stone/Brick Pillar, Brick Lintel (slab), Brick Chimney,
Bronze Plate Block (workbench, 4 bronze plate), Riveted Plate Block (hammer only). Existing items gain second uses: `rubble` ->
stone slab, `brick`/`stone_brick` -> slabs, pillars, lintels and chimneys, `bronze_plate` -> plate block, `slop_canister` ->
fertiliser (it was a dead end), `sugar` and `water_pail` -> bush regrowth, `lava_bucket` -> glass and brick, `hand_vacuum` ->
piles, `wrench` -> turning, `torch`/boiling vessels -> hand warmth. Tests: `content.test.ts` (roster, solver), `crafting.test.ts`.

## Goat milk and wool (owner addition)

Goats can be milked and sheared without dying. Hooks only: `src/mobs/yields.ts` (timers, refusal text), `MobManager.harvest`,
two `Mob` fields (`milkS`, `woolS`, seconds left; saved with the animal, absent in old saves = ready; they tick in `life.ts`),
and `AnimalHands.use` in `src/player/animals.ts`. Content: `src/content/areas/synergy_animals.ts`, icons and tile in
`src/render/textures/areas/synergy_animals.ts`, solver source `src/content/animalYields.ts`. Tests: `src/player/milking.test.ts`
(12 cases: pail and beaker, cooldown and refusal toasts, kid and non-goat pass-through, save/restore, old saves, shears, flint
and bronze axe blades, separate timers, and the recipe ties).

| Use | Result |
|---|---|
| empty pail on a goat | Bucket of Goat Milk (`milk_pail`), 300 s cooldown per goat |
| empty glass beaker on a goat | Beaker of Goat Milk (`milk_beaker`), same timer |
| shears, flint axe or bronze axe on a goat | 2 wool, 1 use of the tool, 600 s regrowth per goat |

| Chain | Recipe |
|---|---|
| brewing | Milk Tea / Milk Coffee (dried tea or ground coffee + milk beaker + clay cup, bench): a food mug, 5 food and 2 min Well Fed. Not a seventh brewed drink: the six drink buffs and `six_cups` stay fixed |
| baking | `dough_milk` (flour + milk beaker -> 2 dough), `bread_butter` (dough + butter -> 2 bread) |
| cooking | `hearth_stew_milk` (2 stews, bucket comes back) |
| sugar chain | `sugar_cake_milk` (2 cakes, bucket comes back) |
| hand stations | Cheese (2 milk beakers cured 180 s on the drying rack: heat dries it too), Butter (2 milk beakers, 8 mortar strokes) |
| wool | `cloth_wool` at the loom, `padded_coat_wool`, `bellows_wool`, Wool Bedding (block, warmth radius 1), Shears (bench: 2 bronze plate) |

Notes: the bronze bucket is not a milk container (it is kept for lava). Hand-station recipes eat their beakers. A shorn goat is
not drawn differently (the renderer is not touched). Wool Bedding does not set a spawn point. The Codex lists the new items by
itself from the registries; the solver counts milk and wool as animal sources.

## Not done (ideas left)

Lenses and windows for essentia jars, heat-carrying vents, chimney draught on furnaces, hand-station and crate secondary
functions, and a browser (e2e) pass. The `src/magic` and structure files belong to the Synergy overhaul session and were not touched.
