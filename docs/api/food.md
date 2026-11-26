# Food, farming and animals - foundation (spec section 12)

What exists after the foundation pass: every contract, every piece of content data, the sounds and the textures.
**No behaviour yet**: nothing eats, tills, grows, spawns or draws an animal. Those are the next five engineers'
jobs (game rules, simulation crops, worldgen wild plants, animals, and the textures already done here). Everything
below is green: `npm run typecheck`, `npm test` (715 tests) and `npm run build`.

## 1. Core contracts (all appended; nothing renamed)

### src/core/types.ts
```ts
type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'hoe';
type ItemCategory = ... | 'food';                                   // appended
interface FoodSpec { hunger: number; buff?: 'well_fed'; buffS?: number }
interface ItemSpec { ...; food?: FoodSpec }                         // ItemDef inherits it
type MachineRole = ... | 'crop';
type CreatureAnim = 'legFL' | 'legFR' | 'legBL' | 'legBR' | 'head' | 'none';
interface CreaturePart {
  name: string;                                   // unique in the model
  from: readonly [number, number, number];        // min corner, 1/16 block
  to: readonly [number, number, number];          // max corner, 1/16 block
  color: number;                                  // 0xRRGGBB
  anim: CreatureAnim;
  pivot?: readonly [number, number, number];      // required when anim !== 'none'
}
interface CreatureSpec {
  key: string; name: string; desc: string; biomes: BiomeKey[]; health: number;
  speed: number;                                  // blocks per second
  size: { w: number; h: number };                 // adult collision box, blocks (w x w footprint)
  drops: Drop[]; likes: string[]; group: readonly [number, number]; model: CreaturePart[];
}
```
**Model convention** (for src/render/mobs): units are 1/16 block, origin = centre of the feet, y = 0 is the ground.
Models are authored **facing north (-Z)**: the head is at negative z, +X is the animal's right. An animal with yaw
θ is the model rotated by θ about +Y, the camera convention (positive turns left). Every animated part has a pivot,
and all parts sharing an anim tag share one pivot and move as one group (a leg and its hoof; the head with its beak,
comb, horns, ears, eyes, beard). Legs swing about X in pairs FL+BR / FR+BL. **The hen is a biped**: it has only
`legFL` (its left leg) and `legFR` (its right) - swing them in opposition. Quadrupeds have all four.
Validation guarantees: positive boxes, colours in range, pivots present and consistent, legFL and legFR present,
back legs in pairs, a head group, something touching y = 0, top of the model within 75-120% of `size.h`.
Content tests also guarantee every model is exactly left-right symmetric and no wider than its box.

### src/core/registry.ts
```ts
const CREATURES: readonly CreatureSpec[];           // hen, goat, boar (authored order)
function creature(key: string): CreatureSpec;       // throws on unknown keys
const creatureOrNull: (key: string) => CreatureSpec | null;
function validateCreature(c: CreatureSpec): string[];   // validateContent() runs it on every species
```
`validateContent()` additionally checks food specs (hunger > 0, buff and buffS together, buffS > 0).
`item(key).food` is the FoodSpec (or undefined). Category 'food' is set on exactly the edible items.

### src/core/gameEvents.ts
```ts
type DamageCause = ... | 'hunger';                  // death screen has a line for it
type BuffName = 'well_warmed' | 'well_fed';
'buff:gained': { buff: BuffName; durationS: number }   // widened from 'well_warmed'
'player:ate':  { item: string; hunger: number }
'mob:spawned': { id: number; species: string }
'mob:hurt':    { id: number; species: string; health: number }
'mob:died':    { id: number; species: string }
'crop:grew':   { x: number; y: number; z: number; stage: number }   // 0-based, 3 = ripe
SfxName += 'eat' | 'till' | 'plant' | 'harvest' | 'hen' | 'goat' | 'boar' | 'mob_hurt'
```
Flags the code must emit: `'ate'` (any food eaten), `'tilled'` (a hoe turned soil). The solver knows both.

### src/core/constants.ts (appended; every number of 12.1 and 12.5)
Hunger: `MAX_FOOD 20`, `FOOD_DRAIN_PER_S 1/60`, `FOOD_DRAIN_SPRINT_MULT 2.5`, `FOOD_COST_PER_BLOCK_MINED 0.03`,
`FOOD_COST_PER_JUMP 0.03`, `HUNGRY_AT 6`, `STARVE_INTERVAL_S 6`, `REGEN_MIN_FOOD 12`, `REGEN_FOOD_COST 0.25`,
`EAT_COOLDOWN_S 0.6`, `WELL_FED_DURATION_S 360`, `WELL_FED_REGEN_MULT 2`, `WELL_FED_DRAIN_MULT 0.6`.
Animals: `MOB_LOADED_CAP 40`, `MOB_STORED_CAP 300`, `MOB_CHUNK_SPAWN_CHANCE 0.15`, `MOB_WANDER_RADIUS 8`,
`MOB_MAX_DROP 2`, `MOB_FLEE_SPEED_MULT 1.6`, `MOB_FLEE_S 5`, `MOB_FOLLOW_RANGE 10`, `MOB_FOLLOW_DISTANCE 2`,
`MOB_EAGER_S 30`, `MOB_BREED_RADIUS 8`, `MOB_BREED_S 3`, `MOB_BREED_COOLDOWN_S 300`, `MOB_BABY_SCALE 0.5`,
`MOB_GROW_UP_S 300`, `MOB_KEEPALIVE_MIN_ADULTS 6`, `MOB_KEEPALIVE_RADIUS 64`, `MOB_KEEPALIVE_AFTER_S 120`,
`MOB_KEEPALIVE_MIN_DISTANCE 24`, `MOB_SPAWN_GUARANTEE_RADIUS 40`, `MOB_HIT_COOLDOWN_S 0.4`, `MOB_DEATH_S 0.6`,
`MOB_CALL_MIN_S 8`, `MOB_CALL_MAX_S 20`. Hit damage (hand 1, axe tier+2, pickaxe/shovel tier+1, hoe 1) is a rule
for src/mobs, not a constant.

## 2. Content (src/content)

### Blocks (appended after `corium`, so every older block keeps its voxel id; 84 blocks now)
| key | shape | notes |
|---|---|---|
| `farmland` | cube | textures top `farmland_top`, sides/bottom `dirt`; shovel, hardness 0.8, drops dirt, **no item** (made only by tilling) |
| `wheat_0..3`, `potato_0..3`, `carrot_0..3` | cross | `machine: 'crop'`, hardness 0, **no item**, `placeOn: ['farmland']`, not solid/opaque/replaceable, textures `<crop>_stage<N>`; names "Wheat (sprouting)" .. "Wheat (ripe)", potatoes sprouting/growing/budding/ripe, carrots sprouting/growing/thickening/ripe (the HUD target name is the block name) |
| `wild_wheat`, `wild_potato`, `wild_carrot` | cross | hardness 0.2, **no item**, not replaceable, `placeOn: ['grass', 'dirt']`, texture = key |

Drops: stages 0-2 return their seed (1 wheat_seeds / potato / carrot). Ripe: wheat 1-2 wheat + 1-3 wheat_seeds;
potato 2-4 potato; carrot 2-4 carrot. wild_wheat 1-2 wheat_seeds + 50% 1 wheat; wild_potato 1-2 potato;
wild_carrot 1-2 carrot. `tall_grass` now also drops 15% 1 wheat_seeds.

### Items (19 new; 142 items in all)
Food (category 'food', `food.hunger`): raw_fowl 2, raw_mutton 3, raw_chop 3, cooked_fowl 6 ("Roast Fowl"),
cooked_mutton 7, cooked_chop 8, potato 1, baked_potato 5, carrot 3, bread 6, hearth_stew 12 + `buff 'well_fed', buffS 360`
(stack 16). Farm goods: wheat_seeds, wheat, hide (resource), flour, dough (material).
Hoes (category 'tool', `tool: { kind: 'hoe', tier, speed: 1, durability }`): flint_hoe 1/64, bronze_hoe 2/192, iron_hoe 3/384.
**Planting items**: `wheat_seeds.block = 'wheat_0'`, `potato.block = 'potato_0'`, `carrot.block = 'carrot_0'`, each
with an explicit `icon: 'item_<key>'` (so `blockOfItem('potato')` is the crop, but the icon is the potato). Note potato
and carrot are BOTH food and planting items: spec 12.1 says Use plants them when aimed at farmland, eats otherwise.

### Recipes (16 new; 110 in all; furnace share 68%)
- hand: `flint_hoe` <- 1 flint, 2 stick, 1 cord
- workbench (10 now): `padded_coat_hide` padded_coat <- 4 hide, 2 cord | `bellows_hide` bellows <- 4 plank, 2 hide |
  `flour` <- 2 wheat | `dough` <- 2 flour, 1 water_pail, **byproduct 1 pail**
- furnace smelt (T1, appended after fused_quartz): `cooked_fowl` <- raw_fowl 180 C 6 s | `cooked_mutton` <- raw_mutton 200/8 |
  `cooked_chop` <- raw_chop 200/8 | `baked_potato` <- potato 180/6 | `bread` <- dough 220/10
- furnace forge: `bronze_hoe` <- 2 bronze_ingot, 2 stick 600 C T1 | `hearth_stew` <- 1 cooked_chop, 1 potato, 1 carrot,
  1 water_pail 300 C T1, byproduct 1 pail | `hearth_stew_mutton`, `hearth_stew_fowl` (same with the other cooked meats) |
  `iron_hoe` <- 2 iron_ingot, 2 stick 1000 C T2
- crusher: `flour_milled` flour <- 1 wheat (4 s, 4 kJ, Forge Age). `recipesFor('flour')[0]` is the workbench route.

Kitchen recipes for the UI's "Kitchen" chip: furnace recipes whose output item has `food` (or category 'food').

### Machine `crop` (src/content/tech.ts)
`role 'crop'`, `blocks` = the 12 stage blocks in order (wheat_0..3, potato_0..3, carrot_0..3), no power, no slots,
`placementHint 'Plant on farmland.'`, params:
| param | value | meaning |
|---|---|---|
| stageS | 100 | seconds of growing time per stage at full rate; 3 stages to ripe |
| dryRate | 0.5 | growth rate without water in range |
| hydrationRadius | 4 | water with abs(dx), abs(dz) <= 4 at the crop's y or y-1 hydrates it |
| lampRadius | 5 | a powered (active) `lamp` within this Euclidean distance lights it at any time, underground too |
| minSunlight | 0.3 | daylight counts when clock sunlight >= this and no opaque block is anywhere above |
Growth: needs `farmland` directly below; advances only while lit; at each stage swap the voxel id in place
(`withId`, entity kept, like a furnace upgrade) and emit `crop:grew`. Ripe in 300 s hydrated, 600 s dry.

### Creatures (src/content/creatures.ts)
| key | biomes | hp | speed | size w x h | drops | likes | group |
|---|---|---|---|---|---|---|---|
| hen | woodland, dunes | 4 | 2.2 | 0.45 x 0.7 | raw_fowl 1 | wheat_seeds | 2-4 |
| goat | frostfell, woodland | 8 | 2.6 | 0.8 x 1.2 | raw_mutton 1-2, hide 50% | wheat | 2-3 |
| boar | woodland, scar | 10 | 2.8 | 0.9 x 0.9 | raw_chop 1-3, hide 1 | potato, carrot | 2-3 |
Looks: a russet-buff hen with a red comb and wattle, yellow legs and toes, darker wings and tail; a shaggy cream goat
with grey-brown legs, dark hooves, swept-back horns, a beard and ears; a dark umber boar with a black mane ridge,
pale tusks, a pink-brown snout and dark hooves. The species call sfx name equals the creature key.

### Objectives (42 now)
Inserted: after `get_warm`: `cook_food` "Cook a meal" (any of make cooked_fowl / cooked_mutton / cooked_chop / baked_potato),
`eat_food` "Eat" (flag ate). After `smelt_copper`: `till_soil` "Till the soil" (flag tilled, reward 4 wheat_seeds),
`plant_seeds` "Plant wheat" (place wheat_0). After `place_lamp` (moved from after `bronze_pickaxe`, review gc-5): `bake_bread`
"Bake bread" (make bread; the text names four ripe wheat, two flour and a bucket of water).
`place wheat_0` is counted from the `block:placed` voxel, so planting must emit `block:placed` with the crop voxel.

### Progression solver (src/content/progression.ts)
- `NATURAL_BLOCKS` adds wild_wheat, wild_potato, wild_carrot. New exports: `TILLABLE_BLOCKS = ['grass', 'dirt']`,
  `itemPlacing(blockKey): string | null` (the block item, or the item whose `block` is it - seeds etc.).
- Animal drops are obtainable from the start (`source` = `animal:<species>`); a crop's ripe drops once its seed item, a
  hoe and tillable soil are obtainable (`source` = `crop:<ripe block>`). Byproducts (pails) were already counted.
- Flags `ate` (any food obtainable) and `tilled` (hoe + tillable soil in the full world). `place` conditions use
  `itemPlacing`. src/content/food.test.ts proves: hunting and gathering need no furnace, the Clay Furnace cooks,
  bakes and makes stew, wheat is farmable from tall-grass seed alone, and potatoes/carrots exist only via wild plants.

## 3. Sounds (src/audio/sfxFarm.ts, merged into `SFX`; 45 patches)
eat (three crunches over a jaw thump), till (gritty falling scrape), plant (two soft pats), harvest (leaf rustle and a
dry snap), hen (two clucks and a higher third), goat (nasal wavering bleat), boar (two low tremolo grunts), mob_hurt
(short rising-then-falling squeal). All are world sounds (positionable, jittered). Measured in headless Chromium
(OfflineAudioContext): durations 0.21-0.55 s, RMS -29 to -34 dB, peaks 0.16-0.46 - level with dig/pickup/hurt.
Not heard by human ears.

## 4. Textures (35 new names; 199 in TEXTURE_NAMES, cap in the test 210, WebGL2 guarantees 256 layers)
- `src/render/textures/farm.ts`: `farmland_top` (dark ploughed furrows, seamless), `wheat_stage0..3` (sprouts ->
  green blades -> green ears -> golden ripe ears with awns), `potato_stage0..3` (seedlings -> leafy -> bushy in bud ->
  in flower with tubers at the soil), `carrot_stage0..3` (thin fronds -> feathery tops -> orange shoulders at the
  soil), `wild_wheat`, `wild_potato` (low leaves, white flowers), `wild_carrot` (white umbels on thin stems). Cutout
  tiles, alpha 0/255, growing up from the bottom edge.
- `src/render/textures/iconsFood.ts`: `item_` + raw_fowl, cooked_fowl, raw_mutton, cooked_mutton, raw_chop, cooked_chop,
  potato, baked_potato, carrot, wheat_seeds, wheat, flour (a sack), dough, bread (a crusty loaf), hearth_stew (a bowl),
  hide. Raw meats pink-red with cream fat, cooked browned with grill marks.
- `src/render/textures/iconsTools.ts`: `item_flint_hoe`, `item_bronze_hoe`, `item_iron_hoe` (thin blade square to the handle).

## 5. What the next engineers must know (traps found while laying this down)
- **Crops are machine blocks.** `src/player/interaction.ts` opens a `machine` screen for any block with `machine`
  and picks `dig_metal` as the dig sound for it: a crop must be excluded (no screen; dig sound dirt/plant, `harvest`
  when ripe). The simulation already tolerates crop entities (the scripted playthrough plants one): it creates a
  plain MachineEntity of kind `crop` and does nothing with it; the crop engineer adds the growth.
- **Tilling and planting**: Use with a hoe on the TOP face of grass/dirt with air above -> farmland (wear 1, flag
  `tilled`, sfx `till`). Planting is the existing "place the held block item" path (`placeOn` already restricts crops
  to farmland), plus sfx `plant`. Eating takes Use only when it would not plant (spec 12.1).
- **Breaking farmland under a crop**: decide whether the crop pops (it has nothing to stand on). Growth already
  requires farmland below.
- **Hoes are not mining tools**: no block has `tool: 'hoe'`, so src/game's mining rules already treat a held hoe as
  bare hands and never wear it while mining.
- **Worldgen**: wild plants are `item: false` and should go on grass (and dirt) in woodland and grassy frostfell
  edges; add `wild_wheat` within 48 blocks to the spawn guarantee.
- **Playthrough stand-ins**: src/sim/playthrough.test.ts emits the `ate` and `tilled` flags and sets the farmland /
  wheat_0 voxels itself (marked in a comment). Replace them with the real actions once they exist.
- The objective text for `cook_food`/`eat_food` says "press Use" to eat; keep the controls consistent with it.

## Deviations from spec 12
- Crop growth numbers: spec 12.4 says both "stageS 100, hydration doubles speed" and "ripe in 300 s hydrated, 600 s
  dry". With 3 stage advances both cannot hold if 100 s is the dry rate, so `stageS` is the full-rate (hydrated) time
  and `dryRate 0.5` halves it without water: 300 s / 600 s exactly as the spec's totals say.
- Goat drop "hide 0-1" is `{ hide, count 1, chance 0.5 }`. Group sizes (not in the spec): hen 2-4, goat 2-3, boar 2-3
  (min 2 so a spawned group can always breed).
- Farmland, crops and wild plants have no block item (`item: false`): nothing in the spec places them from an item.
- Appended beyond the brief, because the next engineers need them and parallel edits to core would collide:
  `ItemCategory 'food'`, `DamageCause 'hunger'`, `BuffName` (widening `buff:gained`), and the constants above.
- Spec 1's pillar "no creatures" is replaced by section 12; README/HowToPlay still say nothing about food.

## Known gaps
- No behaviour (by design of this pass). The e2e script is unaffected (it stops checking objectives at light_furnace).
- Sounds measured, not listened to. Textures reviewed on contact sheets at 8x only, not yet in the 3D world.
- `farmland_top` furrows run along the texture's x axis on every block; a field reads as stripes in one direction
  regardless of how it was tilled.
