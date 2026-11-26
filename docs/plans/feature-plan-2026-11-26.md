# Hearthwatt: what is built, and the feature plan (2026-11-26)

One page that answers two questions: what is in the game today, system by system and age by age, and what to build next, in
waves. It is a summary. The evidence lives in `docs/plans/lookback-2026-11-26.md` (whole project, plan versus code),
`docs/plans/renormalize-2026-11-25.md` (cheap wins, loose ends, unwired code, briefs R1 to R7), the age plans
(`docs/PROGRESSION.md`, `EMBER_PLAN.md`, `STEAM_PLAN.md`, `BRONZE_PLAN.md`, `DISTILLERY_PLAN.md`, `BREWING_PLAN.md`,
`MECHANICS_PLAN.md`, `SYNERGY_PLAN.md`, `OVERHAUL_PLAN.md`), `docs/WHATS_LEFT.md`, the upgrade plans in `docs/plans/` and the advisor
notes in `docs/advice/`. No game code changed for this document.

Branches referred to: the working branch `ccr-3c8b169f-e78nk2` (PR #16 into `main`), the lodge branch `claude/project-thread-vcjxhh`
(pushed, no PR yet), and the balance PRs #17 and #18 (drafts into `main`).

Legend: **Built** = in the game and reachable in play. **Partial** = some of it is in, or it is built but not wired. **Planned** =
designed in a plan, not built. **Idea** = only in the look-back or advice notes.

---

## Part 1. What is built

### 1.1 The age spine

The game has six ages, each opened at the furnace's upgrade list (`src/content/tech.ts`, save version 2 with `migrateSixAges`).

| # | Age | Furnace | State | What a player can do today | What is missing |
| --- | --- | --- | --- | --- | --- |
| 0 | Ember | Clay Furnace, 800 C | **Built** | fire, flint and bronze tools, copper and tin, pouring into moulds, the hand stations (chopping block, quern, stone anvil, mortar, clay table, drying rack, tanning trough, loom, kettle pot), leather and cloth, food and farming, tea and coffee brewing, the sugar chain | thermopile and lamp still sit in Ember (plan moves them to Forge); the Casting Bench block is inert, pouring happens at the furnace |
| 1 | Bronze | Bronze Furnace, 1100 C | **Partial** | the furnace upgrade, the Create-style workshop (cranks, shafts, belts, gearboxes, mixer, press, basins, contraptions, skiff, punched cards), Hand Vacuum Pump, the Essentia magic pieces | **all of steam** (STEAM_PLAN: copper kettle, steam rotor, wooden axles, speed and stress, millstone, saw bench, trip hammer) and **all of BRONZE_PLAN B1 to B4** (heat rods, boiler multiblock, pressure, air, vacuum chute, blast nozzle) |
| 2 | Forge | Blast hearth, 1500 C | **Partial** | the brick hearth multiblock (1x1x1 to 3x3x3), iron and steel, coal, coke, lava bucket, iron and steel pipes, pump, tanks, cable, lamp, battery, iron and steel armour | the Blast Nozzle and air requirement for the hearth; heavy industry (iron and steel axles, rolling mill, drop forge, crusher, iron thermocouples, steel boilers); the dynamo exists only as a texture |
| 3 | Current | Arc hearth, 2100 C | **Built** | electric heating, grid, steam turbine, wind, solar, combustion and geothermal generators, still, bore rig, fast item pipes, heavy cable, circuits, Ward Beacon, arc maul; storms and Arc Drones | the electromagnet (ground items) |
| 4 | Atomic | Plasma hearth, 3200 C | **Built** | superalloy, fused quartz, power drill, shield suit, centrifuge, fuel rods, fission pile, electrolyser and deuterium, lithium bank, superconducting lines, the Slag Colossus | the 93-casing Star gate is still an open owner decision |
| 5 | Star | Starhearth | **Built** | ignition (300 kW for 90 s), then 1 MW forever | nothing structural |

The shape is wide at both ends and thin in the middle. A player goes from hand work straight into the Bronze workshop and then into
electricity, and electricity already starts in Ember through the thermopile. That middle is the biggest gap in the game.

### 1.2 Systems

| System | State | Notes |
| --- | --- | --- |
| Engine, world, chunks, biomes, structures, ruins, landmarks | **Built** | generated houses and lodges have doorways but no doors yet |
| Water, fluids, pipes, tanks | **Built** | tanks take the distill fluids |
| Weather and seasons, festival, hot springs, night creatures | **Built** | seasons reach crops but not fishing; "weather that matters" plan not started |
| Food, farming, cooking quality, hunger and buffs | **Built** | dish and tool quality are saved but no UI shows the names (R2 in progress) |
| Brewing (tea and coffee) | **Built** | Bronze hot plate missing (waits on heat rods) |
| Handwork and casting | **Built** | Casting Bench inert; hand-taking molten metal not built |
| Distillery and glassware | **Mostly built** | rig screen, reflux head, filter bed, lubricant done; refinery tower, cracker, spirit drinks, antiseptic bandage, bitumen roads missing; kerosene has no use; `distill:step` has no listener |
| Workshop (Create-style) and mechanics | **Built, slices 1 to 5** | slip clutch, planetary set, CVT cone, hydraulics not wired; Mech bench only in Dev Mode |
| Essentia magic (research, wands, golems, mirrors, aura, taint, void) | **Built** | spark, soul and void not drawable; golems do not haul to the town's storage; mirrors ignore labelled chests |
| Synergy structures and biome mobs | **Partial** | 16 structures in; attunement 2 of 5; no ice, glass or basalt golems |
| Emberbound automatons and combat | **Built** | rarity, named finds, enchantments 1 to 4 in; no bosses, affixes or monster-part crafting |
| Loot and containers | **Built, phases 1 to 3** | mob and fishing tables, locked crates, loot log (phases 4 to 5) not started |
| Tree felling and growth | **Built** | no sapling item, stumps never sprout; day change runs all chunk growth in one frame (R3 in progress) |
| Ground items, inventory moves, pockets, bag moves | **Built** | |
| Exploration: waypoints, treasure maps, journal map, fishing | **Built** | waypoints have only a toast, no picker; markers absent from the map |
| Build tools, blueprints, belts, storage network | **Partial** | blueprint capture and `BeltGrid` have no callers outside tests |
| Vehicles: tractor, chainsaw, skiff | **Built** | |
| Tavern and its people (Rosa, Veyra, Bram, jukebox, gossip, sparring, trader, caravan) | **Built, but unreachable in a new world** | a new world starts at the camp and nobody moves in, so these never start (see Wave 1) |
| Camp start, Gruk, building board, town | **Built, phases 1, 2 and 5** | town phases 3 to 4 (Gruk on site, more templates) not started; town status is only on `window.__hw.town()` |
| The lodge (Hearth and Anvil) | **Built on the lodge branch** | phases 3 to 4 committed on `claude/project-thread-vcjxhh`; PR not open |
| Housing, contentment, move-in | **Unwired** | pure code with tests and no importer |
| Journal, achievements, objectives, story beats | **Built, stale** | 16 generic achievements; story beats cover ages only; pause menu has no Journal or Achievements entry |
| Phone UX: touch, radial menu, haptics, UI scale, settings | **Built** | no context action button or hint engine; HUD says "Goal N of 75"; title lists five ages |
| Dev Mode, Codex, e2e scripts | **Built** | the full GPU e2e chain has not run since 11-21; nothing new has been played on a phone |
| Balance | **Not applied** | time model and T1/T8 tests are in drafts #17 and #18; `DRINK_BUFF_S` 180, Well-Fed x Lasting = 0.25 |

---

## Part 2. Feature plan

Five waves. Each wave lists its tasks in order, with the files it owns so builders can run side by side, and what "done" looks like.
Size is S (under a day), M (a day or two), L (several days). Every task ends with `tsc`, the full vitest run and, where content
changed, the golden update. A wave ends with the e2e scripts it touched, on desktop and phone.

### Wave 0. Land what is in flight (now)

| # | Task | Owner files | Size | Done when |
| --- | --- | --- | --- | --- |
| 0.1 | Open the lodge PR from `claude/project-thread-vcjxhh` into the working branch; fix `hasTavern` so it follows the lodge, not the camp | lodge files, `src/npcs/manager.ts` | S | PR open, suite green, tavern flag test |
| 0.2 | R2: quality names (Fine, Masterwork, Tasty, Exquisite) and enchant level and effect on tooltips; long-press tooltip on touch | `src/ui/screens/slots.ts`, tooltip code | M | builders running; label tests and a UI check |
| 0.3 | R3: spread the day-change tree growth over frames | `src/world/world.ts`, `treeGrowth.ts` | S | builders running; queued growth equals growth at once |
| 0.4 | R5: doors in generated houses and lodges; fishing reads the season | `src/world/structureDefs.ts`, `ruins.ts`, `src/sim/fishing.ts` | S | structure test sees a door; per-season fishing tests |
| 0.5 | R1: town polish (crate pays like the board, Gruk names his building, "What next?" points at the board, bedrolls sleep to dawn, hiring pauses building, no festival rest at the camp, "town is finished" line) | `src/npcs/manager.ts`, `townBuilder.ts`, `buildBoard.ts`, `scripts/orc.ts`, `src/game/nextStep.ts` | M | after 0.1; a test per item |
| 0.6 | R4: integration pass (`distill:step` listener, Journal and Achievements in the pause menu, How to Play for Photo, Emote and What next, achievements and journal lines for town, bounty, fish, waypoint, treasure, enchant, pet, festival; sounds for fishing, waypoints, pets, festival, gossip, sparring) | `src/game/achievements.ts`, `journal.ts`, objectives, `src/ui/menus/*`, audio cues | M | after 0.5 for town events; a test per entry |
| 0.7 | R6: stale docs sweep, plus `docs/plans/README.md` ("nothing here is built yet"), and fix "Goal N of 75" and the five-age title text | docs, `src/ui/hud/goal.ts`, `src/ui/menus/title.ts` | S | each claim checked against code |
| 0.8 | Balance numbers: merge the time model and T1/T8 tests (#17 and #18 overlap, keep one), then apply the balance-economy values: `DRINK_BUFF_S` 300, the Lasting plus Well-Fed food-drain floor (product at least 0.4), speed and mining caps, coke and fuel values | `src/core/constants.ts`, `src/game/buffs.ts`, balance tests | M | T8 asserts the floor and caps; T1 time-to-age within the target band |

### Wave 1. Make the settlement the main loop

The camp, Gruk and the lodge are the newest and most personal part of the game, and today a new world never gets past Gruk. This
wave turns the tavern, trader, festival and Bram back on and gives every other system a customer.

| # | Task | Size | Done when |
| --- | --- | --- | --- |
| 1.1 | Newcomers and the housing view (just-you-and-orrin phases 5 to 6): call the move-in roll, wire `housing.ts`, `housingView.ts`, `moveIn.ts` | L | in a fresh world a second person moves in after the lodge; e2e step |
| 1.2 | Contentment wiring (phase 7): Bram's prices follow mood, not a random roll; town standing feeds favours, trader and Rosa | M | price and favour tests read contentment |
| 1.3 | A town page: current building, stage and percent, what is missing, days left, standing, next unlock | M | reachable from the HUD and pause menu on a phone |
| 1.4 | First-hour goals built around the camp: light the fire, sleep a night, fill the first bounty, open the lodge, first newcomer; story beats for each | M | objectives and story beat tests; first-hour playthrough reads as one story |
| 1.5 | Town phases 3 to 4: Gruk walks to the site and hammers; bakery, smithy, market, gardens, town hall templates; build board and tavern board share demand | L | Gruk visible on site; five new templates pass the template tests |
| 1.6 | Something defends the camp at night (mobs notice the camp; Gruk or a ward responds) | M | night test with mobs near the camp |
| 1.7 | Newcomers 5 to 8 from the plan | M | after 1.1 |

### Wave 2. Fill the middle of the age spine

This is the order the coordinator noted: the small steam loop first, then the B1 and B2 air blocks and network, which unblock the
blast nozzle gate, the rolling mill and the dynamo.

| # | Task | Size | Done when |
| --- | --- | --- | --- |
| 2.1 | The small steam loop (STEAM_PLAN phase 1): copper kettle, steam rotor, wooden axle and cog, speed and stress solve, and one automated hand station (millstone over the quern). Move the thermopile and lamp out of Ember | L | content test "no electricity before Forge"; a scripted player turns a millstone with steam |
| 2.2 | The rest of STEAM_PLAN: water wheel, windmill, saw bench, trip hammer, shaft bellows, mechanical pump and drill, clutch, flywheel, gauges. Reuse the workshop shaft code where it fits; do not build a second shaft graph | L | STEAM_PLAN section 11 acceptance checks |
| 2.3 | BRONZE B1: contracts, content, art and sound for heat rods, boiler plate and ports, steam pipes, safety valve, gauges, compressor, air tube, air tank, pneumatic press and drill, air hammer, Bronze Chute, Vacuum Pump, Blast Nozzle | M | content tests incl. completable and Peaceful completable |
| 2.4 | BRONZE B2: `netGraph.ts` and the structure scan first, then heat plus boiler, steam (engine as shaft source), and air plus tubes in parallel | L | section 8 B2 tests, perf under 0.3 ms per tick |
| 2.5 | Blast hearth gate: `requiredParts: { blast_nozzle: 1 }` and air at 2 bar | S | old-save fixture still loads with its hearth formed |
| 2.6 | BRONZE B3 and B4: render, boiler screen, HUD lines, audio, `scripts/e2e-bronze.mjs` | L | e2e-bronze green on desktop and phone portrait |
| 2.7 | Forge heavy industry, planned in the same detail first: iron then steel axles, rolling mill, drop forge, crusher, iron thermocouples, steel boilers; the dynamo ends the age | L | a new FORGE_PLAN with acceptance checks, then the build |

### Wave 3. Verify and tune

| # | Task | Size | Done when |
| --- | --- | --- | --- |
| 3.1 | Run the full e2e chain on the GPU (`HW_GPU=1 HW_DIAG=1 npm run e2e`) and fix what is red, including the two known mining and save flakes | M | whole chain green, diag summary clean |
| 3.2 | Play the first hour on a phone and on desktop, by hand: camp, lodge, Ember, the Bronze upgrade, the steam loop | M | a written list of feel, readability and balance problems, each turned into a task |
| 3.3 | A runnable pacing check: Dev Mode "time to each age" readout or a scripted first-hour bot, using the time model from 0.8 | M | readout matches the balance-economy targets within the agreed band |
| 3.4 | Risks: gate `window.__hw` behind dev builds or an e2e flag; move the mech perf test to `test:perf`; an old-save fixture without the new magic keys | S | tests for each |
| 3.5 | Republish the game artifact and the Codex | S | both show six ages |

### Wave 4. Connect the systems that should talk

Each is M unless noted. Pick by value; none blocks another.

- Waypoint picker screen, and treasure and waypoint markers on the journal map.
- Sapling item, replanting and stump sprouting; felling yields saplings.
- Veyra buys and grades the player's brews; Rosa serves spirit drinks from the distillery.
- Dead-end items get a use: kerosene as lamp or tractor fuel; remove the free logs from `tendFire`; the three unused gear designs. (S each.)
- Blueprint capture tool that works on a phone, pulling materials from the storage network; then auto-build assist.
- Enchantments read tool quality; logic gates and cam drums open doors; dyes on doors, beds and wool.
- Golems haul to the town's storage bay; mirrors see labelled chests; contentment gets an aura and taint tag.
- Casting Bench pours for real; hand-taking molten metal for anvil hot work.
- Cooking quality on furnace dishes (stew, bread). (S.)
- Distillery: refinery tower, cracker, catalyst bed, bitumen and asphalt roads, antiseptic bandage.

### Wave 5. New content (the upgrade plans not yet started)

In the suggested order of `docs/plans/README.md` and `QUEUE.md`, after Waves 1 to 3:

1. Modular tools (head, handle, binding; repair by part).
2. Caves and depths, then one boss at the end of the caves that ties loot, enchantments and caves together; enemy camp grows.
3. Legendary weapons (after modular tools' unique-part hook).
4. Loot phases 4 to 5 (mob and fishing tables, locked crates, loot log).
5. Weather that matters, with noise and light (shared audio and light code).
6. Animals with routines; decor that does something; message bottles.
7. Synergy remainder: attunement 3 to 5, ice, glass and basalt golems; OVERHAUL trinkets (weather cock, spyglass, horn, padlock chest, lantern chain).
8. Phone UX advice: a context action button and a hint engine.

---

## Part 3. Decisions the owner still holds

1. Star hearth: keep 93 casings or reduce.
2. Steam: build the small steam loop (this plan's recommendation, Wave 2.1) or cut steam and move the thermopile to Forge.
3. Make `six_cups` an optional side goal; delete the cup and cone forge recipes in favour of the Clay Table.
4. Whether to merge PR #16 into `main` (pages deploys on pushes to `main`).
5. Which of PR #17 and #18 to keep for the time model.

## Part 4. Recommended order in one line

Wave 0 now (lodge PR, R1 to R6, balance numbers), then Wave 1.1 to 1.4 (newcomers, contentment, town page, camp goals), then the
small steam loop and B1/B2 (Wave 2.1 to 2.5), then the full e2e run and a phone play-through (Wave 3), then Waves 4 and 5 by value.
