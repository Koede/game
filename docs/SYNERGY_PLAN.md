# Synergy overhaul - plan

"Synergy" (owner's word) means: every system gives something to every other, nothing is a dead end, and one story runs through all
of it. Conventions stay those of `docs/CONGRUENCE.md` (keys, ages by name, registration checklist 4.5); gates are `docs/api/ages.md`.
Order of work: **structures and biome mobs first** (most player-visible), then magic/artificer reframe, then tool and block synergies.

## 1. The artificer spine, by age

The player is the **last apprentice of the Old Works**: the people who tamed fire before them were artificers, and they left their
craft in ruins, shrines and half-finished servants. Each age the player becomes a bigger kind of artificer.

| Age | Who the player is | Builds toward | What the world says |
|---|---|---|---|
| Ember | Scavenger-apprentice: learns the fire by hand | the Clay Furnace, a first pour, a roof and a hearth | camps and hunter's lodges: people who lived by the fire; a first lone shrine hints that fire can be *taught* |
| Bronze | Journeyman: makes the fire *move* | a yard of belts, shafts and steam; first clay servant; the first Infusion | shrines and kilns: the old artificers' infusion altars; glassblowers' ovens; feral servants wander |
| Forge | Master of metal: the blast, iron, steel | the Blast hearth, a workshop that runs itself; tools **attuned** to the hand that made them | foundries and derricks: the heavy age of the Old Works, guarded by their wardens |
| Current | Engineer-artificer: spark in copper | lamps, power, servants with Spark (electric golems) | observatories and relay cairns that still hum |
| Atomic | Warden: quiet control of a hot heart | the pile, wards, void-storage | buried vault-ruins; the colossus walks |
| Star | Hearthkeeper: makes a small sun | the Starhearth ignition | the first artificers' failed attempt, read in their notes |

Narrative devices (all existing UI, no new screens): (a) **structure loot carries the age ahead** (a teaser, never a skip: tables are
held to `lootMaxAge` by content tests); (b) **Old Works lore** is read through the Field Notebook (scanning a structure's block gives
a lore line); (c) the objective tracker's goal text names the structure type that holds the next hint.

## 2. Magic as the artificer's craft

Essentia and research are how an artificer *teaches matter*, not a second tech tree:
- **Infusion = tempering.** The Infusion Altar is the artificer's anvil: a tool plus an aspect makes an **attuned** tool. Table `INFUSIONS`
  in `src/magic` (one small effect each, charge cost, described in the notebook). Wooden/flint/bronze/iron tools get an attunement per
  aspect family (cinder: smelts what it breaks in small stacks; loam: faster digging; gale: speed; rune: more uses; ward: held in
  the hand it halves ember damage). One attunement per tool.
- **Servants/golems.** Clay Servant (built) is the first; each age adds a *material* servant from biome blocks (stone, ice, glass,
  basalt). They are the same crank-turning servants with a different feed aspect; later ones guard the yard (golem socket).
- **Workshop-magic ties.** A jar of `steam` essentia feeds a boiler without fuel (but the warm zone dims); a `drive`-infused crank adds
  capacity; a `cinder` kettle boils on half fuel. Machines stay possible without any of it (the solver never needs magic).
- **Structures are where the craft is learned.** Shrine and kiln structures hold the *lore* (notebook entries) and a few vials; the
  player reads them with the Scrying Lens and the matching research entry unlocks sooner.

## 3. Biome identity

Each biome gets **its own wild fauna, its own hostile "feral servants" (the old artificers' unfinished helpers), three structure
types built only from blocks found there, and loot tied to ages**. All creature drops reuse existing items.

| Biome | Material palette (blocks) | Fauna (passive) | Feral servant (hostile, night, biome-only) | Structures |
|---|---|---|---|---|
| Woodland | oak_log, plank, stone_brick, mossy_stone_brick, oak_leaves, fern, berry_bush, ember_poppy, torch, crate | **Stag** (`hide`, `raw_chop`) | **Barkwright** (wood servant, melee) | charcoal burner's camp, hollow-oak shrine, lumber mill |
| Dunes | sand, glass, clay, brick, limestone, cactus, dry_shrub, crystal_cluster | **Dune Hare** (`raw_fowl`, `hide`) | **Glass Scarab** (dash) | glassblower's kiln, caravan well, oil derrick |
| Frostfell | snow, ice, packed_ice, ice_spike, pine_log, pine_leaves, stone, frost_lily | **Snow Ox** (`raw_mutton`, `hide`) | **Rime Husk** (shielded, melee) | hunter's lodge, frost cairn, frozen foundry |
| Scar | basalt, basalt_column, steam_vent, rusted_shell, rubble, lava, coal_ore, corestone | **Slag Newt** (`coal`, `raw_fowl`) | **Magma Crawler** (bolt, burn) | basalt forge-pit, ember altar, slag depot |
| Marsh | peat, clay, reeds, mossy_stone_brick, oak_log, glowcap, plank, water | **Marsh Heron** (`raw_fowl`, `fiber`) | **Bog Lantern** (flying, zap, x2 in water) | peat-cutter's stilt hut, sunken alchemist tower, pump house |
| Any | stone_brick, torch, glass | | | **Waystone** |

Feral servants spawn on the surface at night in their own biome (new `SpawnPlace`s `wood_night`, `dunes_night`, `frost_night`,
`marsh_night`; Scar uses `scar_night`), weights low so the existing automatons stay the main threat. They never guard structures
more than the structure's own table says. Warm furnace zones and ward beacons keep them out (existing safe zones).

## 4. The 16 structure types

Pure functions of `(seed, grid square)` exactly like the Old Works (`src/world/structures.ts`), own grid and salt so existing ruin
layouts do not move; each one `{ key, name, biome, w, d, age, blocks, loot, guards, lore }`. Loot crate cell is left empty and filled
through the existing crate entity path (`ruinCrates.ts`), guards through `guards.ts` once per structure. Gate = the age the loot belongs
to (`lootMaxAge` +1 at most).

| # | Key | Biome | Age | Built from | Loot (tied to age) | Guardians |
|---|---|---|---|---|---|---|
| 1 | `charcoal_camp` | woodland | ember | oak_log, plank, dirt mound, torch | charcoal, flint tools, fiber, hide | none (wild boar nearby) |
| 2 | `hollow_oak_shrine` | woodland | ember | oak_log ring, glowcap, ember_poppy, mossy brick | glass_vial, vial_loam, notebook page | Barkwright x1 |
| 3 | `lumber_mill` | woodland | bronze | plank, oak_log, stone_brick, brick | bronze_ingot, cord, wooden axle bits | Barkwright x2 |
| 4 | `glassblower_kiln` | dunes | bronze | clay, brick, sand, glass | glass_beaker, silica, glass_vial | Glass Scarab x2 |
| 5 | `caravan_well` | dunes | ember | brick, clay, limestone, cactus | water_pail, wheat_seeds, bronze tools | none |
| 6 | `oil_derrick` | dunes | forge | rusted_shell, brick, asphalt | crude_canister, iron_ingot, steel bits | Forge Warden + Kiln Sentry |
| 7 | `hunters_lodge` | frostfell | ember | pine_log, plank, snow, torch | hide, raw_mutton, padded_coat | none |
| 8 | `frost_cairn` | frostfell | bronze | packed_ice, ice, stone_brick, ice_spike | vial_frost, glass_vial, bronze_rod | Rime Husk x2 |
| 9 | `frozen_foundry` | frostfell | forge | stone_brick, packed_ice, collapsed_furnace | iron_ingot, coke, firebrick | Forge Warden x2 |
| 10 | `basalt_forge_pit` | scar | forge | basalt, basalt_column, steam_vent, lava | iron_ore, coke, steel_plate | Bellows Hound x2 |
| 11 | `ember_altar` | scar | bronze | basalt_column ring, basalt, magic_light | vial_cinder, ember_core, focus_kindle | Magma Crawler x2 |
| 12 | `slag_depot` | scar | forge | rusted_shell, rubble, basalt, corestone | steel_plate, copper_coil, scrap_metal | Kiln Sentry + Cinder Mite x3 |
| 13 | `peat_stilt_hut` | marsh | ember | plank, oak_log, peat, reeds | peat, tea_cutting, coffee_cutting, wildberries | none |
| 14 | `sunken_alchemist_tower` | marsh | bronze | mossy_stone_brick, glowcap, clay, essentia_jar | vial_brook, vial_clarity, glass_vial | Bog Lantern x2 |
| 15 | `pump_house` | marsh | bronze | mossy_stone_brick, oak_log, plank, water | fluid pipe bits, bronze_ingot, lubricant | Forge Warden |
| 16 | `waystone` | any | bronze | stone_brick, torch, magic_light | vial of the local biome, notebook lore | none (a safe resting place: ward) |

## 5. Synergy uses for existing tools and blocks (later slices)
- Wooden/flint/bronze/iron tools: **attunement** by infusion (section 2); tools take a durability bonus from their attuned aspect.
- Mauls: stunning with an arc maul already works; bronze/iron mauls knock back feral servants harder.
- Peat, glowcap, reeds, ice, basalt column, steam vent gain uses: reeds -> cord (rope), glowcap -> lantern light recipe,
  ice + water pail -> chilled drinks (brewing buff), steam vent -> a free heat source for a still.
- Crates in structures are the same crates players build; loot never needs a machine the player does not own.

## 6. Slices (each tested, committed)
1. Structure framework + all 16 types + loot + guards + tests (`src/world/structures*.ts`, `src/content/loot.ts`).
2. Biome mobs: 5 fauna + 5 feral servants, 4 new spawn places, tests.
3. Artificer attunements (infusion table) + notebook lore.
4. Block and tool synergy recipes; codex/progression entries.
5. Docs: `docs/api/structures.md`, `docs/api/world-content.md` additions, hand-over note.
