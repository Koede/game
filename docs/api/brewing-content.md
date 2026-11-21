# Brewing - data layer (contracts, content, textures, sounds, worldgen)

Written by the brewing data engineer. Design: `docs/BREWING_PLAN.md` (section 11 overrides 1-9). The simulation is
`docs/api/brewing.md` (src/sim/brewing.ts), the player/UI/render work builds on both. Everything here is DATA and
contracts: no behaviour. Every key below exists in the registry; `npm test` proves it.

## 1. Contracts (src/core)

```ts
// types.ts
type DrinkBuff = 'spring' | 'hearthkept' | 'mending' | 'swift' | 'vigor' | 'lasting';
type DrinkFamily = 'tea' | 'coffee';
interface DrinkSpec { buff: DrinkBuff; family: DrinkFamily; buffS: number; colour: number /* 0xRRGGBB liquid tint */; warmth?: number; hunger?: number }
interface ContainerSpec { holds: 'water'; boilsTo: string; emptyTo: string }
interface CoolsSpec { to: string; afterS: number }            // NEW vs the plan: data for "boiling pail cools to water"
ItemSpec gains: drink?: DrinkSpec; brews?: string /* the DRINK ITEM key an ingredient makes */; container?: ContainerSpec; cools?: CoolsSpec
BlockShape gains 'cup' | 'bucket'          MachineRole gains 'brew'
// gameEvents.ts
BuffName = 'well_warmed' | 'well_fed' | DrinkBuff
SfxName gains 'boil_bubble' | 'pour' | 'drip' | 'sip'
events: 'brew:started' {x,y,z,drink}  'brew:done' {x,y,z,drink}  'water:boiling' {x,y,z}  'player:drank' {item}   (drink = drink ITEM key)
// constants.ts
BOIL_TEMP_C 100, BOIL_SECONDS 12, BOIL_DRY_SECONDS 180, KETTLE_BOIL_C 120, BREW_SECONDS 4, BREW_STEAM_S 20, BOILING_KEEPS_S 90,
DRINK_BUFF_S 180, DRINK_COOLDOWN_S 1, SPRING_JUMP_MULT 1.35, HEARTHKEPT_DRAIN_MULT 0.5, HEARTHKEPT_DRINK_WARMTH 10,
MENDING_REGEN_MULT 2, SWIFT_SPEED_MULT 1.2, VIGOR_MINING_MULT 1.25, LASTING_DRAIN_MULT 0.5, TEA_REGROW_S 360
FLAG_BOILED_WATER 'boiled_water', FLAG_BREWED 'brewed', FLAG_SIX_CUPS 'six_cups'
```

`src/core/brewing.ts` (pure data, the single table sim / player / UI share):
`BREW_CUP_MACHINE 'brew_cup'`, `BOIL_BUCKET_MACHINE 'boil_bucket'`, `KETTLE_MACHINE 'kettle'`, `KETTLE_BLOCK 'kettle_pot'`,
`type CupStage = 'cup'|'cone'|'loaded'|'brewing'|'done'`, `CUP_STAGES`, `CUP_BLOCK: Record<CupStage, string>`
(`cup clay_cup`, `cone cup_cone`, `loaded cup_cone_loaded`, `brewing cup_brewing`, `done cup_full`),
`cupStageOfBlock(blockKey): CupStage | null`, `CUP_PARTS: Record<CupStage, string[]>` (items a setup is worth),
`CONE_ITEM 'drip_cone'`, `CUP_ITEM 'clay_cup'`, `CONTAINER_BLOCKS: Record<containerItemKey, { cold, boiling }>`
(`water_pail -> furnace_bucket / furnace_bucket_boiling`), `DRINK_BUFFS: Record<DrinkBuff, { name, family, effect }>`
(HUD words: "Spring", "Jump 35% higher" ...), `DRINK_BUFF_KEYS`.
`src/core/brewValidation.ts` is called by `validateContent()` (drinks, brews, containers, cools, the stage table, the
three brewing machines).
Registry lookups (appended to `src/core/registry.ts`): `DRINKS: ItemDef[]` (the six), `drinkBrewedFrom(ingredientKey): ItemDef | null`,
`isBrewIngredient(key)`, `containerBoilingTo(boilingKey)` (boiling_pail -> the water_pail def), `containerEmptiedTo(emptyKey)`
(pail -> the water_pail def: what the kettle fills).

Exhaustive tables already fixed: `ROLE_TEXT.brew = 'Brewing'` (machineScreen), `SHAPE_CODES.cup/bucket = SHAPE_CROSS` (blockTables:
STAND-IN, the render engineer replaces it with real small boxes), `SFX` (src/audio/sfxBrew.ts). HUD buff labels: there is no exhaustive table
today; use `DRINK_BUFFS[buff].name` and `.effect`.

## 2. Blocks (12, appended after every older block; `src/content/blocksBrew.ts`)

| Key | Shape | Notes |
|---|---|---|
| `tea_bush`, `tea_bush_bare` | cross | machine `tea_bush`, role bush; drops of the fruiting one: tea_leaves 2-3, tea_cutting 25%; `harvestLeaves: tea_bush_bare`; the bare one drops tea_cutting |
| `coffee_shrub`, `coffee_shrub_bare` | cross | the same with coffee_cherries and coffee_cutting; machine `coffee_shrub` |
| `clay_cup`, `cup_cone`, `cup_cone_loaded`, `cup_brewing`, `cup_full` | cup | machine `brew_cup`; not solid; only `clay_cup` has an item; the others `item: false`, drops = the parts (clay_cup + drip_cone); the sim adds the ingredient / drink |
| `furnace_bucket`, `furnace_bucket_boiling` | bucket | machine `boil_bucket`; `item: false`; `placeOn` the five furnaces and the four hearth wall blocks (brick, refractory_brick, plasma_casing, star_casing); drops `water_pail` / `boiling_pail` |
| `kettle_pot` | bucket | machine `kettle`; block item `kettle_pot`; `placeOn` the same; the voxel's ACTIVE bit = boiling (`kettle_pot_on` textures) |

Bushes: `placeOn` grass, dirt, peat, farmland. `tea_cutting` / `coffee_cutting` have `block: tea_bush_bare` / `coffee_shrub_bare`
(Use plants the bare bush, which fruits after TEA_REGROW_S). Regrowth is `CropField`'s existing role-'bush' logic (no code needed).

## 3. Machines (`src/content/machinesBrew.ts`, spread into `MACHINE_SPECS`)

| kind | role | blocks | params |
|---|---|---|---|
| `tea_bush` | bush | tea_bush, tea_bush_bare | regrowS 360 |
| `coffee_shrub` | bush | coffee_shrub, coffee_shrub_bare | regrowS 360 |
| `brew_cup` | brew | the five cup blocks | brewS 4, steamS 20, dripEveryS 0.5 |
| `boil_bucket` | brew | furnace_bucket, furnace_bucket_boiling | boilC 100, boilS 12, dryS 180, heatDrawW 600, boilingDrawW 300 |
| `kettle` | brew | kettle_pot | boilC 120, capacityL 4000, fillL 1000, drainL 1000, heatDrawW 600 |

Kettle (EMBER_PLAN "Kettle Pot", BREWING_PLAN 11.3): sits on a furnace, no steam power. Use a water container on it: +fillL of water (up to capacityL);
Use an empty container on it while the furnace is >= boilC and it holds water: -drainL, the container comes back as its `boilsTo`.

## 4. Items (22: 20 explicit + the block items clay_cup, kettle_pot)

Ingredients and intermediates: `drip_cone` `tea_cutting` `coffee_cutting` `tea_leaves` `dried_tea` `black_tea` `berry_tea_blend` `coffee_cherries`
`roasted_beans` `dark_beans` `ground_coffee` `ground_dark_coffee` `trail_blend`; `boiling_pail` (stack 1, `cools: { to: water_pail, afterS: 90 }`,
its stack `durability` = seconds left). `water_pail` gained `container: { holds: 'water', boilsTo: 'boiling_pail', emptyTo: 'pail' }`.

| ingredient (`brews`) | drink item | buff | family | tint |
|---|---|---|---|---|
| `dried_tea` | `green_tea` "Green Tea" | spring (jump x1.35) | tea | 0x9fae45 |
| `black_tea` | `black_tea_cup` "Black Tea" | hearthkept (warmth drain x0.5, +10 warmth on drinking) | tea | 0x7a3b1c |
| `berry_tea_blend` | `berry_tea` "Berry Tea" | mending (regen x2) | tea | 0xa8324a |
| `ground_coffee` | `light_roast` "Light Roast" | swift (speed x1.2) | coffee | 0x6b4423 |
| `ground_dark_coffee` | `dark_roast` "Dark Roast" | vigor (mining x1.25) | coffee | 0x2c1a10 |
| `trail_blend` | `trail_blend_cup` "Trail Blend" | lasting (food drain x0.5) | coffee | 0x4a2f1a |

All six: `drink { buffS: 180 }`, stack 1, category `food`, no `food` field. Drinking returns `clay_cup`.

## 5. Recipes (`src/content/recipesBrew.ts`, appended after every older recipe; ids)

Furnace FORGE (tier 1): `clay_cup` (2 clay_cup <- 1 clay @400), `drip_cone` (1 clay, 1 fiber @400), `kettle_pot` (3 copper_ingot @600).
Furnace SMELT (tier 1, unique inputs): `dried_tea` (tea_leaves @150 5s), `black_tea` (dried_tea @250 6s), `roasted_beans` (coffee_cherries @220 8s),
`dark_beans` (roasted_beans @400 8s).
Workbench: `ground_coffee` (1 <- 2 roasted_beans), `ground_dark_coffee` (1 <- 2 dark_beans), `berry_tea_blend` (1 <- 1 dried_tea, 2 wildberries),
`trail_blend` (2 <- 1 ground_coffee, 1 ground_dark_coffee). No machine (crusher) recipes yet.

## 6. Goals (`src/content/objectivesBrew.ts`, after `bake_bread`)
`boil_bucket` (flag boiled_water), `first_brew` (flag brewed; reward 2 clay_cup), `six_cups` (flag six_cups = all six drinks drunk; reward 4 coal).
The sim / game emits the flags (`flagOnce`); `six_cups` is the game's to emit once PlayerState has seen all six `player:drank` items.
NOTE the tracker is strictly sequential: `six_cups` holds the HUD goal line until all six are drunk.

## 7. Textures (all painted in `src/render/textures/brew.ts` and `iconsBrew.ts`)
Block sprites (cut-out, alpha 0 / 255; the object is drawn at its real size and place in the 16x16 tile so the cross stand-in reads right):
`tea_bush` `tea_bush_bare` `coffee_shrub` `coffee_shrub_bare` `clay_cup` `cup_cone` `cup_cone_loaded` `cup_brewing` `cup_full`
`furnace_bucket` `furnace_bucket_boiling` `kettle_pot` `kettle_pot_on`.
Geometry for the real boxes (pixels of the tile, x 0..15 left to right, y 0..15 top to bottom): cup body x 5..10, y 11..15 (6 wide, 5 tall);
cone x 4..11, y 6..10 above it; bucket / kettle body x 3..12, y 7..15.
Item icons: `item_drip_cone` `item_tea_cutting` `item_coffee_cutting` `item_tea_leaves` `item_dried_tea` `item_black_tea` `item_berry_tea_blend`
`item_coffee_cherries` `item_roasted_beans` `item_dark_beans` `item_ground_coffee` `item_ground_dark_coffee` `item_trail_blend` `item_boiling_pail`
`item_green_tea` `item_black_tea_cup` `item_berry_tea` `item_light_roast` `item_dark_roast` `item_trail_blend_cup`.
(`clay_cup` and `kettle_pot` icons come from their block sprites.)

## 8. Sounds (`src/audio/sfxBrew.ts`): `boil_bubble`, `pour`, `drip`, `sip` (all positioned except `sip`).

## 9. Worldgen
Tea bushes in woodland and marsh grass, coffee shrubs in woodland grass near the dunes (`src/world/plants.ts` patches, same flora pass as
the berry bush; deterministic and chunk-order independent). Both are in `NATURAL_BLOCKS`; tea is listed under the woodland and marsh
biome-only blocks and coffee under woodland (the tech tree to the Starhearth never needs them).
