# src/content - public API (from its engineer)

## src/content/index.ts (imported only by src/core/registry.ts)
Exports exactly: `AGES: AgeSpec[]`, `BLOCK_SPECS: BlockSpec[]` (index 0 = air), `FURNACE_TIERS: FurnaceTierSpec[]`, `ITEM_SPECS: ItemSpec[]`, `MACHINE_SPECS: MachineSpec[]`, `OBJECTIVES: ObjectiveSpec[]`, `ORE_VEINS: OreVeinSpec[]`, `RECIPE_SPECS: RecipeSpec[]`. Everyone else reads them through the registry (`block()`, `item()`, `recipesAt()`, `machine()`, `furnaceTier()`, `fuelOf()` ...).

## Keys
All keys are exactly those of spec section 2. Things worth knowing:
- **No item exists for** `air`, `corestone`, `water`, `lava`, `corium` (`itemKey === null`; `item('water')` throws).
- **Items that exist but can never be picked up** (their block drops something else): `stone`, `grass`, `oak_leaves`, `pine_leaves`, `tall_grass`, `dry_shrub`, `coal_ore`, `sulfur_ore`.
- **Fuels** (`fuelOf(key)` non-null): `stick`, `plank`, `oak_log`, `pine_log`, `charcoal`, `coal`, `coke`. `fuel_canister` and `fuel_rod` deliberately have NO FuelSpec (a firebox must not accept them); their energy is in machine params.
- **Recipe ids**: output key, except `plank_pine`, `torch_coal`, `charcoal_pine`, `tin_ingot_crushed`, `copper_ingot_crushed`, `iron_ingot_crushed`. `recipesFor(item)[0]` is always the plain route. Furnace list order: 14 smelt recipes, then forge recipes tier by tier.
- **Machine recipes** have station `crusher` | `still` | `centrifuge` | `electrolyzer`, one input, `timeS`, `energyJ = drawW * timeS`. Note `'furnace'` is also a machine kind, so `MACHINES.has(recipe.station)` is true for furnace recipes: test for a machine recipe with station not in hand/workbench/furnace.
- **Categories**: `block`, `resource` (ores, clay, limestone, stick, fiber, flint, sulfur), `material` (ingots, crushed, powders, cord), `component`, `tool`, `machine` (machines, furnaces, cables, workbench, crate, lamp), `fuel` (coal, charcoal, coke only), `misc` (pail, water_pail, padded_coat, shield_suit). Category is for grouping only; use `fuelOf()` to know what burns.
- **Stack sizes**: 99 default; tools, furnaces, pail, water_pail, padded_coat, shield_suit, star_core 1; machines, workbench, crate, bellows, fuel_rod, empty_cell, deuterium_cell, fuel_canister 16; lamp 64.
- **Objective ids in order**: gather_logs, make_planks, place_workbench, find_flint, make_pickaxe, collect_rubble, collect_clay, place_furnace, light_furnace, make_charcoal, get_warm, smelt_copper, make_bronze, bronze_pickaxe, reach_800, first_power, place_lamp, blast_furnace, smelt_iron, make_steel, place_crusher, machine_job, generate_2kw, store_energy, arc_furnace, reach_1900, make_circuits, generate_10kw, make_tungsten, plasma_furnace, make_superalloy, place_fission_pile, generate_60kw, make_deuterium, make_star_core, starhearth, ignite. Flags used: `furnace_lit`, `well_warmed`, `machine_job`, `ignited` (`bellows_pumped` and `rested` are not used by any objective).
- **Rewards**: place_furnace 4 torch; first_power 6 copper_cable; blast_furnace 8 coal; machine_job 1 crate; arc_furnace 12 copper_cable; plasma_furnace 12 heavy_cable; place_fission_pile 2 water_pail (stack 1, so two slots).
- **Age keys**: ember, forge, current, atomic, star.

## Machine numbers: `machine(kind)` fields and `params` (each documented above its spec in src/content/tech.ts)
| kind | role | fields | params |
|---|---|---|---|
| furnace | furnace | blocks = 5 furnace blocks, outputW 1_000_000 (ignited Starhearth) | ignitionTempC 3000, ignitionPowerW 300000, ignitionSeconds 90, ignitionMinSatisfaction 0.95, ignitionGraceS 2, ignitedTempC 5000 |
| crate | crate | slots 27 | |
| thermopile | generator | outputW 300 | wattsPerC 0.25, minTempC 100, capW 300, heatPerWatt 4 |
| steam_engine | generator | outputW 2000 | wattsPerC 4, minTempC 250, capW 2000, heatPerWatt 3, minWater 1 (of its 4 sides) |
| burner_generator | generator | outputW 3000, fuels = every FuelSpec item, efficiency 0.3, slots 1 | |
| water_wheel | generator | outputW 400 | minWater 2, shareRadius 3 |
| wind_turbine | generator | outputW 1500 | windMin 0.25, windMax 1, altitudeBaseY 40, altitudeSpanY 40, altitudeMin 0.25, altitudeMax 1 |
| solar_panel | generator | outputW 300 | minSunlight 0.1 (at or below: 0 W) |
| combustion_engine | generator | outputW 12000, fuels ['fuel_canister'], efficiency 0.4, slots 1 | fuelEnergyJ 6_000_000 (heat; x efficiency = 2.4 MJ electric) |
| geothermal_tap | generator | outputW 6000 | wattsPerLava 2000, capW 6000 |
| fission_pile | generator | outputW 60000, fuels ['fuel_rod'], efficiency 1, slots 1 | rodEnergyJ 72_000_000 (already electric), minWater 2, runTempC 600, warnTempC 900, meltdownTempC 1200, meltdownSeconds 10, heatRateC 8, coolRateC 20, blastRadius 3, warnRadiation 4, warnRadius 6, alarmIntervalS 2 |
| battery (name "Acid Battery") | storage | capacityJ 2_000_000, rateW 3000 | chargeEfficiency 0.9 |
| lithium_bank | storage | capacityJ 40_000_000, rateW 150000 | chargeEfficiency 0.9 |
| lamp | consumer | drawW 10 | |
| blower | consumer | drawW 150 | draftFloor 0.8 |
| space_heater | consumer | drawW 300 | warmRadius 6 (= block warmthActive) |
| crusher / still / centrifuge / electrolyzer | consumer | drawW 1000 / 2000 / 8000 / 20000, slots 2 (slot 0 input, slot 1 output) | electrolyzer: minWater 1 |
| bore_rig | consumer | drawW 4000, slots 9 | secondsPerBlock 2, toolTier 4 |

`placementHint` is set on thermopile, steam_engine, water_wheel, wind_turbine, solar_panel, geothermal_tap, fission_pile, blower, electrolyzer. Cable ratings are on the blocks (`cableRatingW` 10_000 / 120_000 / 2_000_000). A melted pile becomes block `corium`.

## Texture names (164 in `TEXTURE_NAMES`, all snake_case)
- World and built, one each: corestone stone rubble dirt sand gravel clay snow ice basalt limestone water lava oak_leaves pine_leaves tall_grass dry_shrub coal_ore copper_ore tin_ore iron_ore sulfur_ore quartz_ore bauxite wolframite spodumene pitchblende oil_shale plank stone_brick brick glass concrete torch crate corium copper_cable heavy_cable super_cable
- Multi-face: grass_top, grass_side (bottom = dirt); oak_log_side, pine_log_side, shared log_top; workbench_top, workbench_side (bottom = plank); lamp, lamp_on (sides; top and bottom = machine_top)
- Furnaces: `furnace_<clay|blast|arc|plasma|star>_<side|top|front|front_on>` (20)
- Machines: shared `machine_side`, `machine_top`; `<key>_front` and `<key>_front_on` for thermopile, steam_engine, burner_generator, water_wheel, wind_turbine, combustion_engine, geothermal_tap, fission_pile, blower, space_heater, crusher, still, bore_rig, centrifuge, electrolyzer; `battery_front`, `lithium_bank_front` (no _on); `solar_panel_top`
- Item icons: `item_<key>` for each of the 60 non-block items. Torch, cables, tall_grass and dry_shrub items use their block texture as a flat icon; all other block items are cubes.

## Block conventions
- Machines and furnaces: tool pickaxe, minTier 0, hardness 2 (furnaces 3), drop themselves, `oriented` except lamp, solar_panel (slab) and crate; all `power: 'device'` except crate. Cables are non-solid (walk-through), hardness 0.4.
- Leaves are opaque cubes; glass is `opaque: false, translucent: true`; water and lava have hardness -1 and are `replaceable`.
- `placeOn`: tall_grass [grass, dirt]; dry_shrub [sand, dirt, grass, gravel, snow, stone, basalt].
- `age` on items, blocks and recipes = age in which it first becomes obtainable/usable (proven by test).

## src/content/progression.ts (design/test tool; not imported by the game)
- `solve(maxTier: number, missing?: readonly string[]): Progress` - everything obtainable and doable with a furnace of at most `maxTier` (0 = none); `missing` removes world blocks from the assumed world.
- `interface Progress { tier; items: ReadonlySet<string>; recipes: ReadonlySet<string>; source: ReadonlyMap<string,string>; tempC: readonly number[]; hottestC; generationW; storageJ; storageRateW; cableRatingW }`
- `conditionMet(c: ObjectiveCondition, p: Progress): boolean` - whether an objective condition is satisfiable in that state.
- `rawCost(p: Progress, wanted: readonly ItemAmount[], visit?: (key: string) => void): Map<string, number>` - fractional raw-resource cost along the route each item was first obtained by.
- `isMachineRecipe(r: RecipeDef): boolean`, `NATURAL_BLOCKS: readonly string[]`, `KNOWN_FLAGS: readonly string[]`, `GRID_UNITS = 8`.

## src/content/amounts.ts
- `amounts(text: string): ItemAmount[]` - parses "3 copper_ingot, 1 tin_ingot" (bare key = 1); `amount(text): ItemAmount` - exactly one.

## Deviations
- corium: the spec says both 'hardness -1' and 'breakable only with tier 5', and spec 3.6 makes hardness -1 unminable. I used hardness 120, tool pickaxe, minTier 5, drops none: 12 s with the power drill, 60 s with a steel pickaxe, 6 minutes by hand, nothing dropped either way.
- Texture names total 164, above the '~150' aim. The explicit naming rules (own side/top/front/front_on per furnace tier, own front/front_on per machine) need 54 names and item icons 60. I saved where it cost little: shared log_top, single-texture crate, no _on for the two batteries, solar panel and lamp reuse machine_side/machine_top. The test caps the total at 170.
- Params that are not numbers from the spec: solar_panel minSunlight 0.1 (reconciles '0 at night' with the clock's ~0.08 night sunlight factor), bore_rig toolTier 4 (see next item), fission_pile efficiency 1 (so a generic energy x efficiency formula works with rodEnergyJ, which is already electric), steam_engine and electrolyzer minWater 1 (the spec's 'touch water' as a number).
- bore_rig toolTier 4 is a design decision the spec leaves open: I suggest the rig stops at a block needing a higher tier (pitchblende, corium) the way it stops at corestone. Otherwise a Current Age bore rig would yield pitchblende without the power drill, and the declared ages and the 'generate 60 kW' objective text would be off. The solver assumes only the player's tools mine.
- Lamp: BlockTextures has no bottomActive, so a lit lamp seen from below would show an unlit face. I made the lamp a lantern: lit texture on the four sides only, machine_top caps on top and bottom.
- Additions the spec does not mention: pitchblende emits light 4 (a faint glow to help find and avoid it); lightActive on burner_generator 7, space_heater 6, geothermal_tap 5, fission_pile 5.
- The expected key lists are hard-coded in src/content/specRoster.ts, a fixture imported only by content.test.ts, rather than inline in the test file, and the solver lives in src/content/progression.ts. This keeps each file under 350 lines. All five required test groups are in content.test.ts.
- The fixture goes further than key lists: it re-types every recipe line, furnace tier row, machine number, ore vein and objective condition from the spec, so a deliberate balance change must be made in the content file and in specRoster.ts.
- Extra helper file src/content/amounts.ts: ingredient lists are authored as strings like '3 copper_ingot, 1 tin_ingot' and parsed at load.
- The solver is stricter than the task described: draft bonus only once a bellows is obtainable, a temperature only counts if the tier's heat balance can hold it, electric heat is capped by the best obtainable cable rating and by non-furnace-driven generation, water must be carried in a pail, machine recipes need generation at least equal to the machine's draw, and ignition needs cable and supply for 300 kW plus holding 3000 C.

## Known gaps
- Objective 'gather_logs' is any-of(break 4 oak_log, break 4 pine_log) as the spec says; ObjectiveCondition has no sum, so 2 oak + 2 pine does not complete it. The text says 'four oak logs or four pine logs'.
- Objective 'reach_800' follows 'make_bronze' in the spec's order, and bronze already needs 800 C, so it will usually complete the moment it becomes current. Order kept as specified.
- Objective and item texts assume things other modules decide and that I could not check (src/world, src/sim, src/game did not exist yet): the bellows can be pumped from the furnace screen without holding the bellows item; clay is 'most often found where land meets water'; a lamp touching a thermopile or furnace is powered without cable.
- dry_shrub placeOn is a guess at where worldgen puts shrubs (sand, dirt, grass, gravel, snow, stone, basalt). If the world places them on anything else and enforces placeOn, the list needs extending.
- Player-facing descriptions repeat numbers (temperatures, watts, seconds) that also live in data. No test ties the prose to the data, so a balance change needs the text checked by hand.
- The 'generate' and 'stored' conditions are judged against an assumed grid of 8 units of the best working generator or battery kind (heat-driven generators count once). That is a plausibility bound, not a simulation.
- The solver proves obtainability and ordering, not pacing: fuel consumption, mining time, ore rarity and inventory space are not modelled. The printed raw budget covers upgrade costs only, not the machines and fuel needed along the way.
- Reward '2 water_pail' takes two inventory slots (stack 1); what does not fit is lost under the spec's inventory rule.
- No core bug found. Two observations, not edited: BlockTextures lacks a bottomActive face; validateContent only checks unreachable minTempC for top-tier recipes (my structural test checks every furnace recipe and every upgrade temperature against its tier).
