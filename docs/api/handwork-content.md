# Ember handwork - data layer contract (docs/EMBER_PLAN.md sections 2 and 4)

What the DATA LAYER lays down, and exactly what the simulation (strokes), casting (pours) and front end build on
it. Nothing here moves power: no steam, no shafts, no machines. Authored in `src/content/{blocksHand,itemsHand,
recipesHand,mouldsHand,objectivesHand}.ts`; contracts appended to `src/core/*`.

## 1. Contracts (src/core, append-only)

| Name | Where | Meaning |
|---|---|---|
| `ToolKind` += `'hammer'` | types.ts | no block names it as its tool; counts as bare hands for mining (like hoe/maul); it only doubles strokes at the Stone Anvil |
| `BlockSpec.handStation?: { strokesPerS: number; tool?: ToolKind }` | types.ts | the block is worked by strokes. `strokesPerS` = how fast holding Use repeats (the player's use-repeat interval is `1 / strokesPerS`); `tool` doubles strokes while held. Also on `BlockDef.handStation` (null when absent) |
| `RecipeSpec.strokes?: number` | types.ts | stroke recipe: needs this many strokes of progress |
| `RecipeSpec.toolOutput?: ItemAmount` | types.ts | output instead of `output` when the finishing stroke was struck with the station's tool in hand (Chopping Block: 6 planks, not 4) |
| `RecipeSpec.bonus?: ItemAmount & { chance: number }` | types.ts | extra output rolled once per completed job (Mortar: 35% second crushed ore) |
| `MachineRole` += `'hand'` | types.ts | a hand station: no power, no screen; the world interaction is the interface. Has `slots` |
| `ItemSpec.mould?: { pours: number }` | types.ts | a fired mould (stack 1). The stack's `durability` is the pours left (absent on a fresh stack = `MOULD_POURS`). NOTE for the casting engineer: `src/game/inventory.ts` `fullDurability` reads `tool?.durability` only - extend it to `?? mould?.pours` |
| `MouldSpec { item; unfired; units; casts: Record<metal, itemKey> }` | types.ts | one mould: which metals pour into which cast item, and how many ingots one pour uses |
| `CastMetalSpec { key; ingot; bloom }` | types.ts | a metal that can be poured: its ingot item and the bloom it cools into |
| `MOULDS`, `CAST_METALS`, `mouldOf(itemKey)`, `castMetalOfIngot(itemKey)`, `castOf(mouldItem, ingotKey)` | registry.ts | lookups; `castOf` returns `{ item, units } | null` |
| `MOLTEN_WINDOW_S = 20`, `MOULD_POURS = 40`, `HAND_STROKE_FOOD = 0.01`, `HOT_WORK_WINDOW_S = 20`, `STROKE_TOOL_MULT = 2`, `STROKE_HOT_MULT = 2`, `CASTING_BENCH_RANGE = 4` | constants.ts | see below |
| Events `'hand:stroke'`, `'hand:done'`, `'cast:poured'` | gameEvents.ts | see section 5 |
| `SfxName` += `chop`, `grind`, `hammer`, `loom`, `scrape`, `pour` | gameEvents.ts | stroke sounds + the pour; synthesised in `src/audio/sfxHand.ts` |
| Flag `FLAG_FIRST_POUR = 'first_pour'` | constants.ts | emit `{ type:'flag', flag }` on the first `cast:poured` (objective `first_pour`) |

`validateContent()` now also checks: a `handStation` block has a `machine` of role `hand`; every recipe with
`strokes` has a station whose machine has a `handStation` block, `strokes` is a whole number >= 1, `toolOutput` /
`bonus` are known items and (bonus) 0 < chance <= 1; a timed recipe at a `hand` machine has `timeS > 0`; every
`MouldSpec` names a known item (with `mould`), an unfired item, known cast items and `units >= 1`; every
`CastMetalSpec` names known items. A recipe at a `hand` machine has exactly one of `strokes` / `timeS`.

## 2. Stations (block key = machine kind = recipe `station`)

All ten blocks are `machine` blocks of role `hand` (`power` unset, no screen, `oriented` where the front matters).

| Block / kind | Made by | `handStation` | `slots` | Mode |
|---|---|---|---|---|
| `chopping_block` | hand: 1 oak_log (`chopping_block`) or 1 pine_log (`chopping_block_pine`) | 4/s, tool `axe` | 2 (0 in, 1 out) | strokes |
| `hand_quern` | workbench: 2 stone_brick, 1 stick | 3/s | 2 | strokes |
| `stone_anvil` | workbench: 3 stone_brick | 2.5/s, tool `hammer` | 2 | strokes; hot work |
| `mortar` | furnace forge 400 C: 1 clay | 2/s | 2 | strokes |
| `clay_table` | workbench: 2 plank, 1 clay | 2/s | 2 | strokes |
| `loom` | workbench: 4 plank, 2 stick, 2 cord | 2/s | 2 | strokes |
| `casting_bench` | furnace forge 400 C: 2 stone_brick, 1 clay | - | 4 (moulds) | pours (section 4) |
| `alloy_pot` | fired from `unfired_alloy_pot` (furnace smelt 500 C) | - | 3 (0 copper side, 1 tin side, 2 out) | timed alloy, must touch a lit furnace |
| `drying_rack` | hand: 3 stick, 1 cord | - | 2 | timed, open sky by day, rain resets |
| `tanning_trough` | workbench: 4 plank, 1 water_pail (byproduct 1 pail) | - | 2 | timed |

Machine `params` (read by the sim): drying_rack `{ needsSky: 1, rainResets: 1, batch: 8 }`; tanning_trough
`{ batch: 8 }`; alloy_pot `{ needsFurnace: 1 }` (touching a furnace on any of 6 sides); stone_anvil
`{ hotWindowS: 20 }`.

## 3. Stroke semantics (strokes stations: chopping_block, hand_quern, stone_anvil, mortar, clay_table, loom)

Entity `{ kind, x, y, z, input: Slot, output: Slot, progress: number, recipe: string | null, hotS: number }`.
`stroke(x, y, z, heldKey: string | null) -> { ok: boolean; reason?: string; done?: boolean }`:

```
st = entity; spec = machine(kind); hs = block.handStation
1. if st.output and heldKey is not empty-hand: refuse "Take the <output name> first"
   (Use with an EMPTY hand while st.output is set: move st.output to the pack (or drop-pop if full); ok; no stroke)
2. if heldKey is a valid input of ANY recipe at this station:
      if st.input empty, or same item: move min(held count, stack limit - input.count) into st.input; ok; (no stroke)
      else refuse "Take the <input name> out first" is not needed: a different item is refused "Busy with <name>"
3. r = recipe at this station whose inputs[0].item == st.input.item (first match, authored order)
   if none: refuse "Nothing to work"
   if st.input.count < r.inputs[0].count: refuse "Needs <n> <name>"   (multi-input recipes: none exist at stroke stations)
4. gain = 1; if heldKey == hs.tool (STROKE_TOOL_MULT) or st.hotS > 0 (STROKE_HOT_MULT): gain = 2   (they do NOT stack)
   st.progress += gain; food -= HAND_STROKE_FOOD (never below 0, never refused for hunger);
   sfx(strokeSound(kind)) with pitch jitter; emit 'hand:stroke'
5. if st.progress >= r.strokes:
      consume r.inputs[0].count from st.input; out = (finishing stroke with tool and r.toolOutput) ? toolOutput : output;
      roll r.bonus once (random() < chance) and add it; st.output = out (stack onto equal output; refuse step 3 when it
      does not fit: "Take the <output> first"); st.progress = 0; emit 'hand:done'; flagOnce is the sim's business
```
Strokes are whole numbers (a tool stroke may overshoot; progress is clamped to `strokes` and carries nothing over).
Sounds by station: chopping_block `chop`, hand_quern `grind`, mortar `grind` at pitch 0.7, stone_anvil `hammer`,
clay_table `scrape`, loom `loom`. `item:made` is emitted (`station` = kind, `recipeId`) when the output reaches the
PACK, i.e. at the take (objective `make` conditions listen to it), not at 'hand:done'.

**Hot work (Stone Anvil only).** `entity.hotS` is set to `HOT_WORK_WINDOW_S` (20) when the player puts into `input` an
item taken from a crucible/alloy-pot output slot whose `moltenS > 0` (the casting engineer hands the stack over with a
`hot: true` marker; a plain ingot from the pack is cold). `hotS` counts down 1/s; a hot stroke counts double.

## 4. Casting (src/sim furnace + alloy pot + casting bench; data in `src/content/mouldsHand.ts`)

- `FurnaceEntity` gains `crucibleMoltenS: number[]` (parallel to `crucibleOut`). When a crucible smelt completes and the
  output item is a cast-metal ingot (`castMetalOfIngot(item) !== null`: copper_ingot, tin_ingot, bronze_ingot) set
  `crucibleMoltenS[i] = MOLTEN_WINDOW_S`; it counts down 1/s while > 0. The Alloy Pot has the same field on its entity
  (`moltenS`) for its output. The UI glows the slot while `moltenS > 0`.
- **Take with a mould** (Use on the output / the Take button, with a mould stack in hand or on the Casting Bench), while
  `moltenS > 0`: `cast = castOf(mould.item, ingotKey)`; if null refuse "This mould does not take <metal>".
  Pour `n = min(floor(out.count / cast.units), mould pours left)` casts (at least 1 or refuse "Needs <units>
  <ingot> molten"): out.count -= n * units; the player gets n x `cast.item`; each pour wears the mould by 1; at 0 pours
  the mould breaks ('tool:broke'). Emit `'cast:poured'` per take and sfx `pour`. The first pour emits the flag
  `first_pour`. `item:made` `{ item: cast.item, count: n, station: 'furnace', recipeId: 'cast:<mould item>' }`.
- **Take with no mould, or after the window (`moltenS == 0`)**: the stack cools into blooms: each ingot becomes its
  `bloom` item (`copper_ingot -> copper_bloom`, `tin_ingot -> tin_bloom`, `bronze_ingot -> bronze_bloom`), 1:1, no loss.
  A bloom is re-smelted in a crucible (`<metal>_ingot_bloom` smelt recipes, 6 s) and is molten again. Non-cast metals
  (iron and up) are untouched: they come out as ingots as today.
- **Casting Bench** (optional convenience, not a goal): up to 4 moulds set in it (Use with a mould in hand adds it; Use
  with empty hand takes the last out). Taking molten output of a furnace within `CASTING_BENCH_RANGE` (4) blocks while
  the bench holds moulds pours into each set mould in turn (one cast each, as above) instead of needing one in hand.
- **Alloy Pot** (a block touching a lit furnace): slot 0 takes copper_ingot, slot 1 tin_ingot, slot 2 is the output.
  Recipe `bronze_ingot_alloy` (station `alloy_pot`, `timeS` 8, `minTempC` 800 = the touching furnace's tempC) turns
  3 copper_ingot + 1 tin_ingot into 4 bronze_ingot, output molten (`moltenS = 20`); the pot then pours/cools exactly
  like a crucible output. The pot uses the multi-ingredient `inputs` list.
- **Moulds**: fired items `ingot_mould`, `pickaxe_mould`, `axe_mould`, `shovel_mould`, `hoe_mould`, `maul_mould`
  (stack 1, `mould: { pours: 40 }`). Cast table (`MOULDS`): ingot_mould (1 unit) copper/tin/bronze -> their ingot;
  pickaxe_mould (3 units) bronze -> bronze_pickaxe_head; axe_mould (3) -> bronze_axe_head; shovel_mould (1) ->
  bronze_shovel_head; hoe_mould (2) -> bronze_hoe_head; maul_mould (4) -> bronze_maul_head.

## 5. Events (append to GameEvents)

- `'hand:stroke': { x; y; z; station: string; recipe: string; progress: number; strokes: number; tool: boolean; hot: boolean }`
  after every counted stroke (render: bounce the station's moving part; audio uses the `sfx` event instead).
- `'hand:done': { x; y; z; station: string; recipe: string; item: string; count: number }` when a job's output appears
  in the station (timed stations too: rack, trough, alloy pot, with `recipe` = recipe id).
- `'cast:poured': { x; y; z; mould: string; metal: string; item: string; count: number; at: 'furnace' | 'alloy_pot' | 'bench' }`.

## 6. Recipes (ids; `strokes` or `timeS`)

Moved (id kept, station changed): `plank` `plank_pine` (oak/pine log -> 4 plank, toolOutput 6, 3 strokes, `chopping_block`),
`stick` (1 plank -> 4 stick, 2 strokes), `flour` (1 wheat -> 1 flour, 6 strokes, `hand_quern`; the workbench 2:1 recipe
is gone, the crusher's `flour_milled` stays), `copper_wire` (furnace forge removed; `stone_anvil`: 1 copper_ingot -> 3
copper_wire, 6 strokes), bronze alloy (the furnace forge `bronze_ingot` removed; `bronze_ingot_alloy` at `alloy_pot`),
tools (`bronze_pickaxe`, `bronze_axe`, `bronze_shovel`, `bronze_hoe`, `bronze_maul`: forge removed; workbench: head +
2 stick + 1 cord; hoe 2 stick as before), `padded_coat` (4 cloth, 2 cord) and `padded_coat_hide` (4 leather, 2 cord).

New, strokes: `copper_plate` / `bronze_plate` (2 ingot -> 1 plate, 8, `stone_anvil`), `crushed_copper_mortar` /
`crushed_tin_mortar` (1 ore -> 1 crushed + 35% 1 more, 8, `mortar`; the smelt routes `copper_ingot_crushed` and
`tin_ingot_crushed` become age 0), `cloth` (4 fiber -> 1 cloth, 10, `loom`), clay table (4 strokes each): `unfired_cup` (2
clay), `unfired_cone` (2 clay), `unfired_alloy_pot` (4 clay), `unfired_ingot_mould` (2 clay), `unfired_pickaxe_mould`,
`unfired_axe_mould`, `unfired_shovel_mould`, `unfired_hoe_mould`, `unfired_maul_mould` (3 clay each).
New, timed: `soaked_hide` (1 hide, 60 s, `tanning_trough`), `leather` (1 soaked_hide, 120 s, `drying_rack`), `fiber_dried`
(1 tall_grass -> 2 fiber, 30 s, `drying_rack`). Timed hand stations take `params.batch` input items at once and convert
them all after `timeS` (adding items mid-way is allowed; they share the clock). Rack with `needsSky`: the clock runs
only with open sky above and daylight (`sunlight >= 0.5`) and no rain/storm; rain or night does NOT reset a finished
job but PAUSES it, and rain `rainResets` zeroes the progress.
New, firing (furnace smelt, 500 C, 8 s, minTier 1, age 0): `ingot_mould`, `pickaxe_mould`, `axe_mould`, `shovel_mould`,
`hoe_mould`, `maul_mould`, `alloy_pot` (from `unfired_*`), plus `<metal>_ingot_bloom` smelts (`copper_ingot_bloom`,
`tin_ingot_bloom`; 700 / 250 C, 6 s; `bronze_ingot_bloom` 800 C). Furnace forge (instant): `mortar` (1 clay, 400 C),
`casting_bench` (2 stone_brick, 1 clay, 400 C). Hammers: `flint_hammer` (hand: 2 flint, 2 stick, 1 cord), `bronze_hammer`
(workbench: 2 bronze_ingot, 2 stick, 1 cord).
Station items: `chopping_block` `chopping_block_pine` (hand), `hand_quern` `stone_anvil` `clay_table` `loom`
`tanning_trough` (workbench), `drying_rack` (hand).
Brewing may add (station keys are ready): `hand_quern` (roasted beans -> ground coffee, dried tea + berries -> berry
blend), `drying_rack` (tea leaves -> dried tea, 60 s), `clay_table` already has the cup and cone; firing them to
`clay_cup` / `drip_cone` is added only if the brewing items exist.

## 7. Items

Tools: `flint_hammer`, `bronze_hammer` (kind `hammer`). Heads: `bronze_pickaxe_head`, `bronze_axe_head`,
`bronze_shovel_head`, `bronze_hoe_head`, `bronze_maul_head`. Metal: `copper_bloom`, `tin_bloom`, `bronze_bloom`,
`copper_plate`, `bronze_plate`. Hide goods: `soaked_hide`, `leather`, `cloth`. Unfired clay: `unfired_cup`,
`unfired_cone`, `unfired_alloy_pot`, `unfired_ingot_mould`, `unfired_pickaxe_mould`, `unfired_axe_mould`,
`unfired_shovel_mould`, `unfired_hoe_mould`, `unfired_maul_mould`. Fired moulds: `ingot_mould`, `pickaxe_mould`,
`axe_mould`, `shovel_mould`, `hoe_mould`, `maul_mould`. Block items: the ten stations of section 2 (`alloy_pot` is both).

## 8. Textures (names)

Blocks: `chopping_block_top|side`, `hand_quern_top|side`, `stone_anvil_top|side`, `mortar_top|side`,
`clay_table_top|side`, `casting_bench_top|side`, `alloy_pot_top|side`, `drying_rack_top|side`,
`tanning_trough_top|side`, `loom_top|side|front`. Item icons: `item_<key>` for every non-block item of section 7.

## 9. Objectives (ids; new ones marked *), in order

gather_logs, *place_chopping_block, make_planks, place_workbench, find_flint, make_pickaxe, collect_rubble,
collect_clay, place_furnace, light_furnace, make_charcoal, get_warm, cook_food, eat_food, *place_clay_table,
*fire_mould (make ingot_mould), smelt_copper, *first_pour (flag `first_pour`), *place_quern, till_soil, plant_seeds,
*grind_flour (make flour), bake_bread (moved up), *place_anvil, *hammer_plate (make copper_plate), reach_800,
make_bronze (now: alloy), *cast_pick_head (make bronze_pickaxe_head), bronze_pickaxe, forge_maul, salvage_automaton,
first_power, place_lamp, *place_drying_rack, *make_leather, *place_loom (make cloth), blast_furnace (the furnace
upgrade list is untouched until the refactor). The tracker is unchanged: still the first incomplete objective.
