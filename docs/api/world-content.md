# World content - data for spec sections 13, 14 and 15

Buckets and lava, a richer world (surface life, the marsh, the Old Works ruins, the underground) and the
weather/moon contract. This pass lays down **data, contracts, textures and sounds only**: nothing scoops lava,
regrows a bush, generates a marsh or makes it rain yet. Section 6 below says exactly what each next engineer
builds on it. Everything is green: `npm run typecheck`, `npm test` (882 tests at the time of writing) and
`npm run build`.

## 1. Core contracts (appended; nothing renamed or removed)

### src/core/types.ts
```ts
type BiomeKey = 'woodland' | 'dunes' | 'frostfell' | 'scar' | 'marsh';
const ALL_BIOMES: readonly BiomeKey[];           // ['woodland', 'dunes', 'frostfell', 'scar', 'marsh']
interface FuelSpec { ...; fuelReturns?: string } // item handed back after one has burned (lava_bucket -> bronze_bucket)
interface BlockSpec { ...; harvestLeaves?: string } // harvesting leaves this block (and the entity) instead of air
interface BlockDef  { ...; harvestLeaves: string | null }
type MachineRole = ... | 'bush';                 // a wild plant that fruits again (berry bush); no power, no screen

type LootTier = 'near' | 'deep';
interface LootEntry { item: string; count: number | [number, number]; weight: number }
interface LootTableSpec { tier: LootTier; rolls: [number, number]; entries: LootEntry[] }

type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
type Precipitation = 'rain' | 'snow' | 'dust' | 'none';
interface WeatherState {        // plain JSON, computed by src/game, read by everyone, saved as it is
  kind: WeatherKind;            // the state the sky is in, or changing to while blend < 1
  previous: WeatherKind;        // the state it changes from (= kind once settled)
  blend: number;                // 0..1 progress previous -> kind; every effect eases across it
  precipitation: Precipitation; // what falls where the PLAYER is (precipitationFor(kind, biome, y))
  intensity: number;            // 0..1 strength of that precipitation now (eased; 0 when nothing falls)
  cloudCover: number;           // 0..1, eased
  moonPhase: number;            // integer 0..7, 0 new, 4 full (tonight's moon)
  next: WeatherKind;            // the state after this one (Hearth Log forecast)
  nextInS: number;              // seconds until the change to `next` begins
}
```
`ALL_BIOMES` is named so to stay clear of src/world's own `BIOME_KEYS` (an index table of the generator).

### src/core/weather.ts (new, pure lookups; tests in weather.test.ts)
```ts
precipitationFor(kind: WeatherKind, biome: BiomeKey, y: number): Precipitation
  // 'none' unless rain/storm; then BIOME_PRECIPITATION[biome], with rain -> 'snow' at y >= SNOW_LINE_Y
isWet(p: Precipitation, intensity: number): boolean      // rain or snow at >= WET_MIN_INTENSITY (dust never soaks)
weatherValue(table: Record<WeatherKind, number>, w: {kind, previous, blend}): number
  // a WEATHER_* table eased across the change: table[previous] at blend <= 0, table[kind] at blend >= 1
moonPhase(day: number): number          // (floor(day) + MOON_FIRST_PHASE) mod 8; day 0 = the first day
moonIllumination(phase: number): number // lit fraction 0 (new) .. 1 (full), for drawing the phase
nightLight(phase: number): number       // darkest-night sunlight factor, 0.04 (new) .. 0.12 (full)
```

### src/core/constants.ts (appended)
| constant | value | meaning |
|---|---|---|
| `WEATHER_MIN_S`, `WEATHER_MAX_S` | 240, 720 | a state lasts 4-12 min (uniform) |
| `WEATHER_BLEND_MIN_S`, `WEATHER_BLEND_MAX_S` | 30, 60 | a change eases over 30-60 s (uniform) |
| `WEATHER_CHANCE` | clear .45, cloudy .25, rain .2, storm .1 | draw at each change; drawing the current state extends it |
| `WEATHER_CLOUD_COVER` | .15 / .7 / .9 / 1 | sky and cloud layer |
| `WEATHER_DAYLIGHT` | 1 / .82 / .68 / .52 | render-only dimming of sky and sunlit terrain; the clock's sunlight (crops, HUD) is never changed by weather |
| `WEATHER_INTENSITY` | 0 / 0 / .6 / 1 | precipitation strength when settled |
| `WEATHER_SOLAR` | 1 / .5 / .2 / .2 | solar output (rain, snow and dust alike) |
| `WEATHER_WIND` | 1 / 1 / 1 / 1.5 | wind turbine output (a storm may lift it past rated output) |
| `BIOME_PRECIPITATION` | woodland rain, dunes dust, frostfell snow, scar rain, marsh rain | what rain becomes |
| `SNOW_LINE_Y` | 72 | rain falls as snow at or above this height (not in the dunes) |
| `WET_MIN_INTENSITY` | 0.25 | below it rain/snow is drizzle: no chill, no furnace loss, no crop water |
| `WARMTH_DRAIN_WET` | 0.3 /s | extra warmth drain in rain or snow under open sky |
| `FURNACE_WET_LOSS_MULT` | 1.5 | heat-loss factor of a furnace with open sky above while it is wet there |
| `LIGHTNING_MIN_S`, `LIGHTNING_MAX_S` | 6, 22 | storms: seconds between flashes |
| `LIGHTNING_MIN_DIST`, `LIGHTNING_MAX_DIST` | 60, 900 | blocks away a flash happens |
| `SOUND_SPEED` | 343 | thunder delay = distance / SOUND_SPEED |
| `MOON_PHASES`, `MOON_FIRST_PHASE` | 8, 4 | 8-day cycle; the first night has a full moon |
| `NIGHT_LIGHT_NEW_MOON`, `NIGHT_LIGHT_FULL_MOON` | 0.04, 0.12 | night sunlight factor range |
| `STAR_TURNS_PER_DAY` | 1 | the star field turns once a day about the pole |
| `RUIN_GRID_CHUNKS` | 7 | at most one ruin per 7x7-chunk square |
| `RUIN_CHANCE` | 0.8 | chance a square holds one |
| `RUIN_SPAWN_RADIUS` | 96 | one ruin's crate always within 96 blocks of spawn |
| `RUIN_DEEP_DISTANCE`, `RUIN_DEEP_BELOW_SEA` | 400, 8 | crate farther than 400 from spawn, or at y <= SEA_LEVEL - 8: roll 'deep' |

### src/core/gameEvents.ts (appended)
- `SfxName += 'thunder' | 'steam_hiss' | 'scoop_lava'`
- `'weather:changed': { kind: WeatherKind; previous: WeatherKind }` - once per change, when its blend starts.
- `'weather:lightning': { distance: number; bearing: number }` - a storm flash, `bearing` in the camera's yaw
  convention (0 = north, positive turns left). Visual only; thunder follows after `distance / SOUND_SPEED` s.

### src/core/registry.ts
```ts
const LOOT_TABLES: readonly LootTableSpec[];
function lootTable(tier: LootTier): LootTableSpec;                     // throws when missing
function rollLoot(table: LootTableSpec, random: () => number): ItemStack[];
  // rolls draws (with replacement, by weight), each its count; merged into stacks <= the item's stack size in
  // draw order; tools come with full durability. Pass a stream seeded from (world seed, crate x, y, z).
```
`validateContent()` now also checks: `harvestLeaves` names a block; `fuelReturns` names an item and the fuel
stacks to 1; ore vein biome keys exist; loot tables (one per tier, rolls `[>=1, >=min]`, known items, weight > 0,
count >= 1). Creature biomes are checked against `ALL_BIOMES`.

## 2. Content (src/content)

### Blocks (src/content/blocksWorld.ts, appended after `wild_carrot`; 104 blocks now)
| key | name | shape | tool / tier / hardness | drops | item | notes |
|---|---|---|---|---|---|---|
| `ember_poppy` | Ember Poppy | cross | - / 0 / 0 | self | yes | placeOn grass, dirt. Woodland meadows, scar edges |
| `skybell` | Skybell | cross | - / 0 / 0 | self | yes | placeOn grass, dirt. Woodland, around marsh pools |
| `frost_lily` | Frost Lily | cross | - / 0 / 0 | self | yes | placeOn grass, dirt, snow. Frostfell |
| `fern` | Fern | cross | - / 0 / 0.1 | 60% 1 fiber | no | replaceable; placeOn grass, dirt. Woodland shade |
| `reeds` | Reeds | cross | - / 0 / 0.2 | 1-2 fiber | no | placeOn sand, dirt, clay, grass, peat. Shorelines next to water |
| `berry_bush` | Berry Bush | cross | - / 0 / 0.4 | 1-3 wildberries | no | machine `berry_bush`, **harvestLeaves `berry_bush_bare`**; placeOn grass, dirt, peat |
| `berry_bush_bare` | Berry Bush (picked) | cross | - / 0 / 0.4 | self | yes, named "Berry Bush" | machine `berry_bush`; planting the item starts a bush |
| `glowcap` | Glowcap | cross | - / 0 / 0 | self | yes | **light 6**; placeOn grass, dirt, stone, rubble, gravel, clay, basalt, peat. Dark forest floor, cave floors |
| `cactus` | Cactus | cube | - / 0 / 0.8 | self | yes | **contactDamage 1**; placeOn sand, cactus. Dunes |
| `packed_ice` | Packed Ice | cube | pickaxe / 1 / 3 | self | yes | the body of frost spires |
| `ice_spike` | Ice Spike | cross | pickaxe / 0 / 0.5 | 1 ice | no | the pointed crown of a spire (on packed_ice) |
| `basalt_column` | Basalt Column | cube | pickaxe / 2 / 6 | self | yes | distinct from basalt: six-sided pillars (own side and top). Scar |
| `steam_vent` | Steam Vent | cube | pickaxe / 2 / 6 | 1 basalt | no | **warmth 3**; top `steam_vent_top`, sides basalt. Scar |
| `peat` | Peat | cube | shovel / 0 / 0.9 | self | yes | **fuel 500 kJ, 50 s, 900 C**. Marsh ground |
| `cracked_stone_brick` | Cracked Stone Brick | cube | pickaxe / 0 / 3 | self | yes | Old Works walls |
| `mossy_stone_brick` | Mossy Stone Brick | cube | pickaxe / 0 / 4 | self | yes | Old Works walls |
| `collapsed_furnace` | Collapsed Furnace | cube, **oriented** | pickaxe / 0 / 3 | 2-4 firebrick, 50% 1 clay | no | decor; front `collapsed_furnace`, sides/top reuse the clay furnace's |
| `rusted_shell` | Rusted Shell | cube | pickaxe / 2 / 5 | 1 iron_ore, 50% 1-2 copper_wire | no | decor; salvage gated like iron ore |
| `crystal_cluster` | Crystal Cluster | cross | pickaxe / 3 / 1.5 | 1-2 silica | no | **light 4**; inside quartz_ore geodes |
| `oil` | Crude Oil | liquid (`liquid: 'oil'`) | unbreakable | none | no | replaceable, not translucent (opaque dark), static pools in dunes and scar |

**Why crystal clusters drop silica**: silica (wafers, circuits, solar panels, fused quartz) otherwise needs a crusher
and quartz ore. A geode is pure quartz, so it breaks straight into silica - exploration pays into the silicon chain.
It takes an iron pickaxe, the tool that mines quartz ore, so it never arrives before its age (the tests prove it).

### Items (82 non-block items; 156 items in all)
- `pail` is now named **Bucket** ("Use it on water to fill it: every pool is an endless spring, so take all you
  need."), `water_pail` **Water Bucket** ("... Dough and stew each take one and give the bucket back."). Keys unchanged.
- `bronze_bucket` "Bronze Bucket" (misc, stack 1, age 0) - scoops lava.
- `lava_bucket` "Lava Bucket" (category fuel, stack 1, age 0): `fuel { energyJ 2_000_000, burnS 100, flameTempC 1300, fuelReturns 'bronze_bucket' }`.
- `wildberries` "Wildberries" (food, `food: { hunger: 2 }`).
- `peat` (block item) carries `fuel { energyJ 500_000, burnS 50, flameTempC 900 }` - hotter than wood (650 C), so
  a Clay Furnace smelts copper (700 C) on peat before any charcoal; cooler than charcoal (1000 C).
- `berry_bush_bare` has an explicit item named "Berry Bush" (stack 16) whose icon is the bare bush tile.

### Recipe (111 in all)
`bronze_bucket` - furnace forge T1, 700 C: 3 bronze_ingot (listed after the hearth stews).

### Machines
- `berry_bush`: role `'bush'`, blocks `['berry_bush', 'berry_bush_bare']`, `params { regrowS: 300 }`, placementHint
  "Plant on grass, dirt or peat."
- `burner_generator.fuels`: every FuelSpec item **except those with `fuelReturns`** (its one fuel slot has nowhere to
  put the empty bucket), so peat yes, lava_bucket no. The furnace firebox takes every fuel.
- `solar_panel.params.minSunlight`: 0.1 -> **0.15**, above the brightest full-moon night (0.12), so moonlight never
  powers a panel once night brightness follows the moon.

### Biomes, ores, animals
- Ore veins: `coal_ore` and `iron_ore` get `{ marsh: 1.5 }` (coal from old peat, bog iron). Every other multiplier unchanged.
- Creatures: hen `['woodland', 'dunes', 'marsh']`, boar `['woodland', 'scar', 'marsh']` (descriptions mention it).

### Loot tables (src/content/loot.ts, read through the registry)
| tier | rolls | entries (count, weight) |
|---|---|---|
| near | 3-5 | rubble 4-8 (14), clay 2-4 (12), coal 2-5 (10), copper_ore 2-4 (10), tin_ore 1-3 (8), wheat_seeds 2-4 (8), flint 1-3 (6), charcoal 2-4 (6), torch 2-4 (6), potato 1-3 (5), pail 1 (3), flint_pickaxe 1 (2), flint_axe 1 (2), flint_shovel 1 (2) |
| deep | 3-6 | coal 4-8 (10), iron_ore 2-5 (10), copper_ingot 2-4 (8), iron_ingot 1-3 (6), tin_ingot 1-3 (6), copper_wire 3-6 (6), copper_cable 3-6 (6), firebrick 2-6 (6), bronze_ingot 1-3 (5), wheat_seeds 3-6 (4), lamp 1 (3), thermopile 1 (2), bronze_bucket 1 (2), bronze_pickaxe 1 (2) |
Near loot is all Ember Age; deep loot reaches the Forge Age at most (iron ingots) - ruins speed the climb, never skip it.

## 3. Progression solver (src/content/progression.ts)
- `NATURAL_BLOCKS` adds every natural block above (flowers, fern, reeds, berry_bush, glowcap, cactus, packed_ice,
  ice_spike, basalt_column, steam_vent, peat, cracked/mossy stone brick, crystal_cluster, oil).
- New exports: `RUIN_SALVAGE_BLOCKS = ['collapsed_furnace', 'rusted_shell']` (finite bonus finds, not in the assumed
  world); `BIOME_ONLY_BLOCKS: Record<BiomeKey, string[]>` (woodland fern; dunes cactus; frostfell snow, ice,
  packed_ice, ice_spike, frost_lily; scar basalt, basalt_column, steam_vent; marsh peat); `BUCKET_FILLS`
  (`[pail, water, water_pail]`, `[bronze_bucket, lava, lava_bucket]`).
- What harvesting leaves (`harvestLeaves`) counts as world too, so the picked bush's item is obtainable.
- Tests (src/content/worldContent.test.ts, 18): bucket names everywhere (items, blocks, objectives say no "pail"),
  bronze bucket recipe, lava bucket fuel and return, lava buckets from stage 1 and never without lava, peat by hand
  and hotter than wood but cooler than charcoal, berries and replantable bushes, ruin salvage ages and gating,
  crystals at quartz's tier, oil unobtainable, marsh in biomes/ores/animals, **the game can be finished from any one
  biome alone**, loot ages, deterministic rolls within bounds with full-durability tools, weights honoured,
  moonlight below the solar threshold. Spec fixture: src/content/specRosterWorld.ts (merged into specRoster.ts).

## 4. Sounds (src/audio)
- `src/audio/sfxWeather.ts` (merged into `SFX`; 48 patches): **thunder** (crack + 3.4 s brown-noise roll in uneven
  swells, priority 1), **steam_hiss** (1.4 s hissing swell over a low rush), **scoop_lava** (double glop + sizzle,
  0.6 s). All jittered world sounds. Asking for distant thunder: `volume = clamp(1.3 - distance / 700, 0.25, 1.2)`,
  `pitch = 1 - 0.3 * distance / LIGHTNING_MAX_DIST` (lower and softer far away), never positioned.
- `AmbienceState` gains `rain: number` (0..1: WeatherState.intensity while precipitation is 'rain', else 0 - snow
  is silent), `storm: number` (0..1: intensity in a storm, or of a dust wind in the dunes), `sheltered: boolean`
  (a roof overhead: rain becomes a dull drumming, gusts are heard from inside). New layers in
  `src/audio/ambienceWeather.ts`: rain (hiss + two patter beds + a downpour wash under one roof low-pass) and storm
  gusts (slow deep swells plus a howl). `createAmbienceState()` sets them silent, so src/app keeps working unchanged
  until it feeds them. Measured only by unit tests (targets, glides, node counts), not heard.

## 5. Textures (src/render/textures; 25 more names: 224 in TEXTURE_NAMES)
- `worldPlants.ts` (cutout): ember_poppy, skybell, frost_lily, fern, reeds, berry_bush, berry_bush_bare (same bush,
  sparser, green fruit setting), glowcap, crystal_cluster (pale aquamarine so it never reads as ice), ice_spike.
- `worldGround.ts` (opaque): cactus_side, cactus_top, packed_ice, basalt_column_side, basalt_column_top,
  steam_vent_top, peat, cracked_stone_brick (plain stone brick on its own random stream, split), mossy_stone_brick,
  collapsed_furnace (fired clay, a fallen arch half full of rubble), rusted_shell, oil (near-black, rainbow sheen).
  packed_ice, basalt_column_top, peat, oil, mossy_stone_brick and cactus_side are in the seamless-tiling test.
- `iconsWorld.ts`: item_bronze_bucket, item_lava_bucket, item_wildberries.
- building.ts now exports `masonry` and `stoneBrick` (reused by the ruins).
- Reviewed on focused contact sheets (8x, dark and sky, 3x3 tilings) and in the real World + Renderer by day and
  night in headless Chromium (a diorama of every new block, plus the icon provider's slots).

## 6. What the next engineers build on this
(The player items - buckets, berry picking - and the steam vents' steam and hiss are done: docs/api/integration.md,
"Integration and polish pass 2".)
- **Player (src/player/interaction.ts)**: bronze_bucket used on lava: swap to lava_bucket, **remove the lava block**
  (lava is finite), sfx `scoop_lava`; on water: refuse with a hint ("A bronze bucket is kept for lava - use a wooden
  bucket for water"); the wooden bucket on lava keeps its refusal. Proposed: lava_bucket used on a face pours a lava
  block and returns the bronze bucket (sfx scoop_lava). Any bucket on `oil`: refuse ("Too thick for a bucket - a pump
  draws oil"). Berry bushes are machine blocks: **must not open a machine screen** (like crops); Use on a fruiting
  `berry_bush` picks it: give its drops, `setVoxel(withId(v, harvestLeaves))` keeping the entity, sfx `harvest`;
  breaking it does the same (harvestLeaves is a block rule, not a Use rule). Breaking a bare bush removes it (its
  drop is the replantable item). `raycast` with a bronze bucket must see lava like it sees water with a pail.
- **Physics/survival**: cactus `contactDamage 1` applies when the player's box touches the block (it is solid).
  `WARMTH_DRAIN_WET` while `isWet` at the player and the sky above the player's head is open.
- **Game (weather)**: a weather system owning `WeatherState` (saved). Suggested deterministic schedule: segment i has
  kind drawn from `WEATHER_CHANCE` with `hashFloat(seed, i, 1)`, length `WEATHER_MIN_S + hashFloat(seed, i, 2) *
  (MAX - MIN)`, blend length likewise with salt 3; segment 0 is clear; elapsed time = total game seconds (resting
  through the night jumps it). Precipitation/intensity at the player via `precipitationFor` + `weatherValue
  (WEATHER_INTENSITY, w)`. Storms: a flash every LIGHTNING_MIN_S..MAX_S at LIGHTNING_MIN..MAX_DIST, emit
  `weather:lightning`, then `sfx thunder` after distance / SOUND_SPEED s. Moon: `moonPhase(day)`; the clock's night
  sunlight should become `nightLight(phase)` (now the fixed `NIGHT_SUNLIGHT 0.08` in src/game/clock.ts).
  Hearth Log forecast "Rain within the hour" when `next` is rain or storm; HUD dial glyph from kind + moonPhase.
- **Sim**: furnace `takeNextFuel` - when the item taken has `fuelReturns`, put that item into the slot it came from
  (always empty: the fuel stacks to 1); it is not a fuel, so it is skipped by later takes and the player collects it.
  Firebox insertion must accept lava_bucket. `berry_bush` entities: when the voxel is `berry_bush_bare`, count
  `params.regrowS` seconds (saved on the entity), then swap the id back to `berry_bush` (entity kept). Weather:
  solar x `weatherValue(WEATHER_SOLAR, w)`, wind x `weatherValue(WEATHER_WIND, w)`; a furnace with open sky above,
  where `isWet(precipitationFor(kind, biome, y), intensity)`, loses heat x `FURNACE_WET_LOSS_MULT`; rain counts as
  water in reach for crops under open sky. The sim needs a biome lookup (IWorld has none; World.biomeAt exists) -
  inject one like Survival's `BiomeLookup`.
- **World**: the marsh (flat wetland at sea level, shallow pools, reeds, willow-shaped oaks, clay-rich ground, peat);
  flora per spec 14 using the blocks above and their `placeOn`; ice spires (packed_ice topped by ice_spike), basalt
  columns and steam vents in the scar; crystal geodes (quartz_ore shell, crystal_cluster inside); static oil pools in
  dunes and scar. Ruins from `RUIN_*`: walls of stone_brick / cracked / mossy / brick, a collapsed_furnace (oriented),
  rusted_shells, and a crate entity `{ kind: 'crate', x, y, z, slots }` (CRATE_SIZE slots, null-padded) filled with
  `rollLoot(lootTable(tier), mulberry32(hash32(seed, x, y, z)))`; check that the simulation's resync completes
  an entity with only those fields (src/sim creates crates with `createMachine`).
- **Render**: glowcap and crystal_cluster should be drawn emissive and their light tinted soft cyan - today block light
  is one warm colour, so at night glowcaps look pinkish-white, not cyan (seen in the harness). Steam vents: steam
  particles above `steam_vent` tops and `sfx steam_hiss` positioned at the vent every few seconds while the player
  is within ~16 blocks. Weather visuals from `WeatherState` and `WEATHER_DAYLIGHT` / `WEATHER_CLOUD_COVER`; the moon
  drawn by `moonIllumination`; stars turning `STAR_TURNS_PER_DAY`; flash on `weather:lightning`.
- **Audio wiring (src/app/ambience.ts)**: feed `rain`, `storm`, `sheltered` (sky-light test at the camera).
- **UI**: recipe rows/tooltips "returns the bucket" for byproduct pails and for `fuelReturns`.

## Deviations from spec 13-15
- The bronze bucket scoops lava only; water stays the wooden bucket's job. A bronze bucket filled with water would
  need its own item (`water_pail` pours back a wooden `pail`), and every recipe that consumes a water bucket returns
  the wooden one.
- The burner generator does not take lava buckets (one fuel slot, nowhere for the bucket). Furnace only, as 13 says.
- Fern and reeds have no item (pulled up for fiber, like tall grass's role); flowers, glowcaps and cacti do (decor).
  The ruin salvage blocks and crystal clusters have no item. Ice spires are two blocks: `packed_ice` and the
  `ice_spike` tip. `basalt_column` is its own block (its look is the point).
- The berry bush's bare stage has the bush's item, named "Berry Bush" (the fruiting stage has none).
- Crystal clusters drop silica (see above) and need an iron pickaxe.
- `solar_panel.minSunlight` 0.15 (was 0.1) so full-moon nights stay dark for panels.
- Hen and boar also live in the marsh; coal and iron are 1.5x richer there.
- Steam vent warmth uses the block's static `warmth` (radius 3), always on.
- The weather contract carries a few fields beyond the brief (`previous`, `blend`, `cloudCover`, `next`, `nextInS`)
  so every reader can ease effects and the HUD can forecast without re-deriving the schedule.

## Known gaps
- No behaviour (by design): see section 6. Until the sim honours `fuelReturns`, a burned lava bucket would vanish
  with its bucket - but nothing can make a lava bucket before the player engineer adds the scoop.
- Textures: 224 of the 256 texture-array layers WebGL2 guarantees are used (cap in the content test 232). Sections
  16-17 will need more; the renderer may have to split the array or drop to fewer unique names.
- Sounds are unit-tested and patch-checked, never listened to.
- The loot tables and ruin constants are untuned design numbers; play will tell.

## Weather (spec 15)
The weather feature changed this module: see `docs/api/weather.md` for what was added and why.
