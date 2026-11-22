# Unit 4 - Casting and hot metal (build spec)

Status: design pass, 2026-11-22. Written against `docs/build/SYSTEMS.md` (binding). Builder: read this file top to bottom
once, then build in the order of section 8. Every id, string and number you need is here; where the code already has a
name it is quoted verbatim, and everything this unit adds is marked **NEW**.

**Threads:** T1 (heat ladder: the ladle and the bench carry the furnace's heat; nothing new makes heat), T4 (material web:
`clay_ladle`, `ladle_copper|tin|bronze`, `unfired_ladle`), T8 (bench crosshair line, SMELT-tab rows), T9 (pour/cool sounds
and sparks, amber/green/red), T10 (durability-as-seconds survives every inventory path; bench state in its world entity).
Also touches T7 (side goal `pour_bench`, Unit 0's mechanism) and reads nothing of T2/T3/T5/T6.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Today the only place molten metal exists is a crucible, and the only thing you can do with it is stand at the furnace with
a mould in your hand and pour. The Casting Bench you can already craft is a dead brick (`machine: 'casting_bench'`, no
behaviour), and the Stone Anvil's "hot work" only happens if the anvil is within 6 blocks of a furnace pour. A boiling
bucket loses its seconds the moment it passes through `Inventory.add` (picked up off the ground, quick-moved, loaded from a
save) and its heat bar never even draws.

After this unit:

1. **The Clay Ladle.** At the clay table you draw an unfired alloy pot out into a long-handled ladle and fire it (500 C,
   8 s). Use it on a furnace whose crucible holds molten metal (or press **Take with the ladle** in the SMELT tab): the
   ladle fills with exactly 4 units and becomes a **Ladle of Copper / Tin / Bronze**, glowing, its slot bar draining from
   the pool's seconds left (at most 20 s).
2. **The Casting Bench works.** Set up to four fired moulds in its sockets (Use with a mould in hand). Walk the ladle over
   and Use: the bench fills each empty mould that takes the metal, in socket order, one cast each. Anything left in the
   ladle cools at once into blooms in your pack - nothing is ever lost. The casts sit glowing in the moulds; Use with an
   empty hand lifts them all into your pack. Or stand the bench within 4 blocks of the furnace and press **Pour to bench**
   in the SMELT tab: the pool goes straight into the bench's moulds, no ladle needed.
3. **Hot work anywhere.** Use a full ladle on a Stone Anvil anywhere in the world: the 4 ingots land on the anvil soft and
   hot, and the anvil's hot window opens for as many seconds as the ladle had left. Strokes count double while it lasts.
4. **Too slow is not a disaster.** A ladle left too long cools in your pack into 4 blooms **and** hands the empty Clay
   Ladle back (`cools.returns`). Drop it on the ground and it cools there just the same. Smelt the blooms again.
5. **The boiling bucket keeps its seconds** through every path: pickup, spill, throw, quick-move, save and load. Its heat
   bar shows at last. Hot things refuse to go into crates and machines ("it would only cool in there" - and it stops the
   freeze-the-clock trick).

The fantasy is the blacksmith's walk: the glow of the crucible, the ladle lifted, six careful steps across the workshop,
the hiss as bronze runs into four moulds in a row - and the anvil by the bench ringing twice as fast because the metal
next to it is fresh. The furnace stays the heart (T1): every drop of hot metal still comes out of it.

Journey J3 (SYSTEMS 6b) is this unit's acceptance walk, step for step.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Provided (this unit defines; others may use)

| id / API | kind | where | notes |
|---|---|---|---|
| `clay_ladle` | item, stack 1, NEW | `src/content/itemsHand.ts` | the empty fired ladle; does not wear |
| `unfired_ladle` | item, stack 16, NEW | `src/content/itemsHand.ts` | clay table from 1 `unfired_alloy_pot` |
| `ladle_copper`, `ladle_tin`, `ladle_bronze` | items, stack 1, NEW | `src/content/itemsHand.ts` | 4 units molten; `durability` = seconds left; `cools: { to: '<metal>_bloom', afterS: MOLTEN_WINDOW_S, count: LADLE_UNITS, returns: 'clay_ladle' }` |
| `CoolsSpec.returns?: string` | type member (SYSTEMS 6.5) | `src/core/types.ts` | handed back into the pack (or dropped) when the item cools |
| `CoolsSpec.count?: number` | OPTIONAL type member, NEW (declared here per SYSTEMS 6.5 "add an OPTIONAL member and say so") | `src/core/types.ts` | how many `to` ONE cooled item becomes; default 1. A ladle cools into 4 blooms. |
| `LADLE_UNITS = 4` | constant, NEW | `src/core/constants.ts` | ingots of molten metal one ladle holds |
| `BENCH_MOULDS = 4` | constant, NEW | `src/core/constants.ts` | sockets of a Casting Bench (= machine `params.moulds`) |
| `CASTING_BENCH_RANGE = 4` | constant, EXISTS | `src/core/constants.ts:360` | furnace-to-bench reach of "Pour to bench" |
| `ladle:filled`, `ladle:poured`, `ladle:cooled`, `bench:filled` | events, NEW | `src/core/gameEvents.ts` | shapes in 7.3 |
| `cast:poured` with `at: 'bench'` | event, EXISTS (`gameEvents.ts:326`) | - | now actually emitted with `'bench'` |
| `FLAG_FILLED_BENCH = 'filled_bench'` | flag, NEW | `src/core/constants.ts` | first `bench:filled` |
| side goal `pour_bench` "Fill a casting bench" | side goal, NEW | `src/content/objectivesHand.ts` (`HAND_SIDE_GOALS`) | Unit 0's mechanism |
| `isHot(item)` | helper, NEW | `src/game/inventory.ts` | `itemOrNull(item)?.cools !== undefined` |
| `InventoryOptions.holdsHot?: boolean` | option, NEW | `src/game/inventory.ts` | only the player's pack sets it |
| `sim.fillLadle`, `sim.pourLadle`, `sim.pourToBench`, `sim.benchUse`, `sim.benchView` | sim API, NEW | `src/sim/simulation.ts` -> `src/sim/castingBench.ts` | signatures in 8 |

SYSTEMS 6.2 lists Unit 4 as the owner of "`clay_ladle`, `ladle_<metal>`, `ItemSpec.cools.returns?`, casting bench" with no
consumers in other units. Nothing above changes a shape another unit codes against; `CoolsSpec` only gains two optional
members.

### 2.2 Consumed (this unit reads; owners elsewhere)

| id / API | owner | how this unit uses it |
|---|---|---|
| Side-goal mechanism: `SIDE_OBJECTIVES` in `src/content/objectivesSide.ts`, `<FEATURE>_SIDE_GOALS` arrays | Unit 0 | adds `HAND_SIDE_GOALS = [pour_bench]`, concatenated by objectivesSide.ts. If Unit 0 has not merged when this unit builds, export the array anyway and leave a one-line `// Unit 0 concatenates` note; do NOT put it into `OBJECTIVES` (anti-pattern 6d). |
| `MOLTEN_WINDOW_S` 20, `MOULD_POURS` 40, `HOT_WORK_WINDOW_S` 20, `STROKE_HOT_MULT` 2, `FLAG_FIRST_POUR` | existing | unchanged numbers |
| `MOULDS`, `CAST_METALS`, `mouldOf`, `castOf`, `castMetalOfIngot` | `src/core/registry.ts` | the bench's cast table is the existing one |
| `HOT_WINDOW_RADIUS` 6 (`src/sim/handTypes.ts:98`) and the `cast:poured -> hand.openHotWindow` listener (`simulation.ts:166`) | existing | a bench pour emits `cast:poured` at the bench, so an anvil within 6 blocks of the BENCH gets the window too |
| `SfxName` `cast_pour`, `fire_out`, `scrape`, `hammer` | existing | no new sound names (sfx.test count unchanged) |

### 2.3 T4 rows (material web)

| item | made by | consumed by | age | stack |
|---|---|---|---|---|
| `unfired_ladle` | clay table: 1 `unfired_alloy_pot` -> 1, 4 strokes (recipe id `unfired_ladle`) | firing -> `clay_ladle` | ember | 16 |
| `clay_ladle` | furnace smelt 500 C, 8 s, from `unfired_ladle` (recipe id `clay_ladle`) | filled at a furnace pool -> `ladle_<metal>`; returned by every pour and by cooling | ember | 1 |
| `ladle_copper` / `ladle_tin` / `ladle_bronze` | `sim.fillLadle` from a molten pool of >= 4 | (a) Casting Bench moulds (b) Stone Anvil hot work (copper, bronze) (c) cools -> 4 `<metal>_bloom` + `clay_ladle` | ember | 1 |

The ladle is a tool-like container, not an intermediate; it still has two consumers (bench, anvil) and a safe fallback
(blooms), so the "no dead ends" rule holds. Tin has only the bench (ingot mould) and the fallback: there is no tin anvil
recipe; that is honest and the refusal says so (5.4).

**Deviation from SYSTEMS T4 (argued):** the table says `unfired_ladle (2 clay)`. The clay table picks its job by the COUNT
of clay loaded, and every piece must cost a distinct number of clay (`CLAY_PIECES` in `src/content/recipesHand.ts`:
maul 9 ... cone 2, cup 1; a test holds it). 2 clay is the drip cone. Taking a free number (10) would make the ladle the
dearest clay piece and 10 taps to load. Instead the ladle starts from a different INPUT, an `unfired_alloy_pot` (4 clay),
"drawn out into a long handle": distinct input, no collision, a fair price for a pot that carries four ingots, and it ties
the ladle to the alloy pot it pours from. Coordinator: update the T4 row to "clay table: 1 unfired_alloy_pot (4 clay)".

### 2.4 Numbers tied to SYSTEMS 5

| number | value | reason |
|---|---|---|
| ladle cooling | the pool's seconds left at the moment of filling, at most `MOLTEN_WINDOW_S` 20 (5.1 "ladle cooling 20 s") | metal does not get hotter by leaving the fire; a fresh pool gives the full 20 s of J3 |
| ladle capacity | `LADLE_UNITS` 4 | one alloy batch (`bronze_ingot_alloy` makes 4), the biggest mould (maul 4), two anvil plates (2 + 2). No per-stack metadata exists (SYSTEMS 2), so a ladle is always full: "a half-full ladle slops" |
| bench sockets | 4 (`params.moulds`, existing) | unchanged |
| pour-to-bench reach | `CASTING_BENCH_RANGE` 4 (existing; J3 step 5) | unchanged |
| anvil hot window from a ladle | `ceil(ladle seconds left)`, at most `HOT_WORK_WINDOW_S` 20 | the metal's own heat, the same 20 s scale as the furnace window |
| ladle wear | none | a ladle is a pot, not a shaping tool; moulds already wear (40 pours). T10 rule 4 keeps durability for seconds, so a ladle cannot also carry wear |
| ladle firing | 500 C, 8 s (SYSTEMS T4) | same as every fired mould (`FIRED` list) |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (read before building)

### 3.1 Casting at the furnace - `src/sim/casting.ts` (229 lines)

- Pool: `FurnaceEntity.crucibleMelt[i]` (`{ item: '<metal>_ingot', count }`) + `crucibleMoltenS[i]`; `addMelt` (l.52)
  restarts the window; `coolMolten` (l.67) turns an unpoured pool into blooms in `crucibleOut`, emits sfx `fire_out`
  pitch 1.4 and the toast `` `${name(melt.item)} went cold in the crucible: a bloom, smelt it again` ``.
- `pourCrucible(ctx, e, slot, heldKey, working)` (l.164): the only pour. Refusals quoted in `docs/api/casting.md`. It
  emits `cast:poured { ..., at: 'furnace' }`, `item:made`, **sfx `'pour'`** (l.200) and `flagOnce(FLAG_FIRST_POUR)`.
  BUG to fix here: `'pour'` is brewing's water sound; `src/audio/sfxHand.ts:59` defines `cast_pour` and
  `gameEvents.ts:147` documents it as "Molten metal poured into a mould ... (not the water 'pour' of brewing)". Both metal
  sounds switch to `cast_pour`: the mould pour (l.200) and `loadPot` (l.119, cold ingots dropped into a hot pot are metal too).
- `wornestMould(slots, key)` (l.145, private): the most worn stack of a mould first. The bench reuses the rule (export it).
- `pourOptions(melt, moltenS, pack)` (l.216) feeds the SMELT tab buttons.

### 3.2 Furnace actions - `src/sim/furnaceActions.ts`

`pour(host, e, node, slot, heldKey)` (l.65) -> `pourCrucible(host, e, slot, heldKey, statsOf(node).crucibles)`.
`Simulation.pourCrucible` (`simulation.ts:516`) wraps it with `withFurnace`. New furnace actions `fillLadle` and
`pourToBench` go next to `pour` with the same shape.

### 3.3 Hand stations - `src/sim/handWork.ts` (371 lines)

- `HandWork.stroke(x, y, z, heldKey)` (l.134): insert / take / stroke. `insert` (l.213) takes from the HELD stack only.
- `openHotWindow(x, y, z)` (l.175): sets `hotS = HOT_WORK_WINDOW_S` on every `def.hot` station within `HOT_WINDOW_RADIUS`
  (6). Called from the `cast:poured` listener (`simulation.ts:166`).
- `work` (l.244): `gain = withTool ? STROKE_TOOL_MULT : hot ? STROKE_HOT_MULT : 1` - hot and tool never stack.
- `tick` (l.286) counts `hotS` down for active stations; `sync` (l.350) keeps a station active while `hotS > 0`.
- The anvil's recipes (`src/content/recipesHand.ts:72-74`): `copper_plate` (2 copper_ingot, 8 strokes), `bronze_plate`
  (2 bronze_ingot, 8), `copper_wire` (1 copper_ingot -> 3, 6). No tin recipe.

### 3.4 Content - `src/content/blocksHand.ts` (72 lines)

- `casting_bench` block (l.45): desc "A bench of brick with sockets for moulds. Set moulds in it and take molten metal from
  a furnace nearby: every mould is filled in turn. Metal stays molten for 20 seconds." (rewritten in 4.2).
- Machine (l.62): `{ kind: 'casting_bench', name: 'Casting Bench', role: 'hand', blocks: ['casting_bench'], params:
  { moulds: 4, range: 4 }, desc: 'Set fired moulds in it, then take molten metal from a furnace within four blocks.' }`.
  It has **no `slots`**, so `createMachine('casting_bench', ...)` (`src/sim/entities.ts:139`) makes a `MachineEntity` with
  `slots: []`. Today a placed bench is an inert machine node: tracked, saved with the world, spilled (nothing) when broken
  (`removeMachine`, `simulation.ts:~382`, releases `(e as MachineEntity).slots`).
- Recipe `forge('casting_bench', '2 stone_brick, 1 clay', 400)` (`recipesHand.ts:61`). Roster: `specRosterHand.ts:12,32,38,65`.
- Shape: `STATION_BOXES.casting_bench` (`src/world/stationShapes.ts:53`) - a top slab on four posts. Textures
  `casting_bench_top|side` (`src/render/textures/hand.ts:372`).

### 3.5 Player Use - `src/player/handTools.ts` (126 lines)

`HandTools.use(hit, forceReturn)` (l.59): hand station -> `station`; a mould in hand on a furnace -> `pour` (first crucible
with `moltenS > 0`, else null so the screen opens); copper/tin on a furnace -> `loadPot`. `HandHands` (l.20) is the
structural interface the Simulation fits. A full ladle aimed at the anvil would today reach `station()` and stroke with a
bare hand - this unit intercepts it first.

### 3.6 Inventory and the boiling pail - `src/game/inventory.ts`, `src/game/drink.ts`

- `fullDurability(item)` (inventory.ts:30) = `tool?.durability ?? wear ?? mould?.pours`. **It ignores `cools`**, so:
  - `Inventory.add(item, n, durability)` (l.105) computes `dur = undefined` for a boiling pail and DROPS the seconds.
    Every path that goes through `add` loses them: `PlayerState.give` (playerState.ts:268), ground pickup
    (`groundItems.ts:186,285` call `player.give(e.item, fit, e.durability)`), `quickMove` (`transfer.ts:89` uses
    `to.add(..., src.durability, ...)`), `HandWork.take` (handWork.ts:234), `brewTools.give(r.give, r.giveDurability)`.
    The pail then has no durability and `coolStack` (drink.ts:74) restarts it at `afterS` 90: free extra boiling time.
  - `sanitize` (inventory.ts:45) on load drops the seconds the same way: a save resets every pail to 90 s.
  - `slotView` (`src/ui/screens/inventory/slotViews.ts:34`) shows a bar only when `fullDurability` is defined: the
    "heat bar" that `coolCarried` (drink.ts:89) carefully redraws once a second is **never drawn**.
- Paths that already keep it: `transfer` / `swapSlots` (`makeStack(src.item, n, src.durability)`), `removeAt`,
  `GroundItems.spawn` (`opts.durability`), ground snapshot (`groundItems.ts:437,460`), `canMerge` (never merges a stack with
  durability).
- `coolStack(stack, dt)` (drink.ts:74) returns `makeStack(cools.to, stack.count)` - count 1 for a pail; no `returns`.
- `coolCarried(player, dt)` (drink.ts:89) cools only the player's pack (Survival calls it, `survival.ts:217`). Ground items
  and crates never cool: dropping a boiling pail, or parking it in a crate, freezes its clock.
- Boiling items with `cools` today: `boiling_pail` (itemsBrew.ts:39), `boiling_beaker`, `boiling_vial` (itemsGlass.ts:28,37),
  all `afterS: BOILING_KEEPS_S` (90).

### 3.7 SMELT tab - `src/ui/screens/furnace/smeltTab.ts`, `castText.ts`

`castView(c: CrucibleView, pack): CastView` (castText.ts:40) builds the pour block: meter label `` `Molten ${metal}
x${count}` ``, buttons `` `Pour into ${o.name}` `` with sub `` `${o.casts} x ${name(o.makes)}` ``, hints "Pour before it
cools: unpoured metal turns into a bloom you must smelt again." / "No fired mould in your pack takes this. Fire one in a
crucible, or it cools into a bloom.". `smeltTab.updatePour` (l.158) rebuilds the buttons when `choicesKey` changes and calls
`this.pour(index, choice.key)`.

### 3.8 Render - `src/render/handwork/`

`HandParts` rescans `world.entities()` of kind `hand` twice a second within `HAND_RANGE` 64; `HandFx` makes sparks on anvil
strokes. "The casting bench and alloy pot have shapes but no animation" (handwork-front.md). Nothing is drawn on the bench.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Items (all `age: ageIndexOf('ember')`, all in `src/content/itemsHand.ts`)

Write `age: ageIndexOf('ember')` (import from `src/magic/ageMap.ts`) in the new rows even though the neighbouring rows say
`age: 0` (SYSTEMS 1.2, anti-pattern 6d).

| key | name | category | stack | fields | desc (tooltip, exact) |
|---|---|---|---|---|---|
| `unfired_ladle` NEW | Unfired Ladle | material | 16 | via the existing `unfired(key, name, desc)` helper | "An alloy pot drawn out into a long clay handle. Fire it in a crucible at 500 C to make a ladle." |
| `clay_ladle` NEW | Clay Ladle | tool-like misc (`category: 'misc'`) | 1 | none (no `tool`, no `wear`) | "A fired clay ladle. Use it on a furnace with molten metal: it takes 4 ingots' worth and keeps them molten for up to 20 s. Pour it at a Casting Bench or onto a Stone Anvil." |
| `ladle_copper` NEW | Ladle of Copper | misc | 1 | `cools: { to: 'copper_bloom', afterS: MOLTEN_WINDOW_S, count: LADLE_UNITS, returns: 'clay_ladle' }` | "A clay ladle of molten copper, 4 ingots' worth. Pour it into the moulds of a Casting Bench, or onto a Stone Anvil for hot work. In 20 s it sets into 4 Copper Bloom." |
| `ladle_tin` NEW | Ladle of Tin | misc | 1 | `cools: { to: 'tin_bloom', ... }` | "A clay ladle of molten tin, 4 ingots' worth. Pour it into the ingot moulds of a Casting Bench. In 20 s it sets into 4 Tin Bloom." |
| `ladle_bronze` NEW | Ladle of Bronze | misc | 1 | `cools: { to: 'bronze_bloom', ... }` | "A clay ladle of molten bronze, 4 ingots' worth: a maul head, or a pickaxe head and a shovel blade. Pour it at a Casting Bench or onto a Stone Anvil. In 20 s it sets into 4 Bronze Bloom." |

SYSTEMS 4 display names: "Clay Ladle", "Ladle of Bronze" - used verbatim. Keys derive from `CAST_METALS`: write a tiny
helper `ladleOf(metalKey) => \`ladle_${metalKey}\`` and `metalOfLadle(item): CastMetalSpec | null` in
`src/core/registry.ts` (NEW, next to `castMetalOfIngot`) so nothing lists the three keys by hand outside the item rows.
A content test asserts there is exactly one `ladle_<key>` item per `CAST_METALS` row.

Icons (`src/render/textures/iconsHand.ts` or wherever `item_<key>` hand icons live - follow the file that draws
`item_ingot_mould`): `item_unfired_ladle` (grey-brown wet clay, bowl + handle diagonal), `item_clay_ladle` (fired
terracotta, same silhouette), `item_ladle_copper|tin|bronze` (the fired ladle with a molten surface: copper `#ff8a3a`
centre to `#c2471c` rim, tin `#ffe6a8` to `#d9a441`, bronze `#ffb24a` to `#b8661e`, one white-yellow highlight pixel).
They must pass the existing texture readability test.

### 4.2 The Casting Bench (existing block, new behaviour)

Block desc (replace `blocksHand.ts:45`, exact): "A bench of brick with four sockets for fired moulds. Pour a full Clay
Ladle over it, or press Pour to bench at a furnace within 4 blocks: every empty mould that takes the metal is filled in
turn. Use with an empty hand to lift the casts out."

Machine row (replace `blocksHand.ts:62`): add `slots: 8` and keep `params: { moulds: 4, range: 4 }`; desc "Set up to four
fired moulds in it, then pour a ladle over it or pour to it from a furnace within four blocks." `specRosterHand.ts`
row 38 becomes `casting_bench: ['hand', { moulds: 4, range: 4 }]` unchanged plus whatever field the roster uses for
`slots` (update the roster test to expect 8).

**Entity layout** (the existing `MachineEntity`, no new kind, no new map; T10 rule 2 is satisfied because the state IS the
world entity at `"x,y,z"`):

```
slots[0..3]  moulds in sockets 1-4   (fired mould stacks, count 1, durability = pours left)
slots[4..7]  the cast sitting in socket i+1's mould (e.g. { item: 'bronze_pickaxe_head', count: 1 }), or null
```

A cast slot is only ever set while its mould slot is set. Constants: `BENCH_MOULDS = 4`; helper `castSlot(i) = BENCH_MOULDS + i`.

**Use on a bench** (`sim.benchUse(x, y, z, heldKey, forceReturn)`), decided in this order:

1. `heldKey` is a full ladle (`metalOfLadle(heldKey) !== null`) -> **pour the ladle** (4.4).
2. `heldKey === 'clay_ladle'` -> refuse "Fill the ladle at a furnace first - Use it on molten metal".
3. `heldKey` is a fired mould (`mouldOf(heldKey)`) and `forceReturn` is false -> **set the mould**: the first null of
   `slots[0..3]` gets the HELD stack (count 1, durability travels; `player.consumeHeld(1)` returns it with its durability -
   it is `inventory.removeAt(selectedSlot, count)`, playerState.ts:233). Sfx `scrape` pitch 1.3.
   No room: refuse "The bench holds 4 moulds - take one out first".
4. Any casts waiting (some `slots[4..7]` set) and `forceReturn` false -> **take the casts**: all of them into the pack, in
   socket order, as far as they fit (`inventory.space(item) >= 1` each). Each cast taken emits
   `item:made { item, count: 1, station: 'casting_bench', recipeId: 'cast:<mould>' }` (objectives `make` count it, the same
   way handwork emits `item:made` at the take). Nothing fit: refuse "Your pack is full". Some fit: ok; the rest stay.
5. `forceReturn` (Shift + Use, or the touch Place toggle then Use) with an empty hand or a mould in hand -> **take the last
   mould out**: the highest-index set mould slot whose cast slot is null goes to the pack with its durability. Its cast is
   waiting: refuse "Take the casts out first". No mould: refuse "There is no mould on the bench". Pack full: "Your pack is
   full".
6. Empty hand, no casts, not forceReturn -> refuse with the useful sentence: no moulds: "Set a fired mould on the bench
   first"; moulds: "Pour a full ladle over the bench, or pour to it from a furnace within 4 blocks".
7. Anything else in hand -> return `null` from the player layer (the item is placed / used as usual); the sim refuses
   "The Casting Bench takes fired moulds and ladles of molten metal" if called directly.

Why moulds go in with plain Use and come out with Shift: on a phone the common act (set a mould, take casts) must be one
tap; taking a mould back is rare and uses the same "take back what you loaded" gesture as every hand station
(handwork-front.md: "Shift + Use ... with an empty hand -> handReturn").

### 4.3 Filling a ladle at the furnace

`fillLadle(host, e, node, slot)` in `src/sim/castingBench.ts` (NEW), exposed as `sim.fillLadle(x, y, z, slot)`:

1. `slot` invalid (same check as `pourCrucible` l.165) -> "There is no such crucible".
2. No pool or `crucibleMoltenS[slot] <= 0` -> "It has gone cold - smelt the bloom again" when `crucibleOut[slot]` holds
   blooms, else "Nothing molten there" (the existing sentences).
3. No `clay_ladle` in the pack -> "You have no Clay Ladle".
4. `melt.count < LADLE_UNITS` -> `` `A ladle takes ${LADLE_UNITS} molten ${name(melt.item)} - there is ${melt.count}` ``
   (e.g. "A ladle takes 4 molten Copper Ingot - there is 3").
5. Take: `melt.count -= 4` (clear the pool when 0, as `pourCrucible` does). Replace ONE `clay_ladle` stack - the one in
   the selected hotbar slot when it is a clay ladle, else the first in the pack - IN PLACE with
   `makeStack(ladleOf(metal.key), 1, secs)` where `secs = Math.min(MOLTEN_WINDOW_S, e.crucibleMoltenS[slot])`. In place
   means `inventory.set(index, ...)`: no "pack full" case exists.
6. Emit `ladle:filled { x, y, z, metal: metal.key, units: 4, seconds: secs }`, sfx `cast_pour` pitch 0.8 at the furnace,
   `ctx.touch(e)`. No `item:made` (nothing is made yet), no `cast:poured` (nothing was cast; no hot window opens).

**World Use** (`HandTools.use`): `held === 'clay_ladle'` and `hit.block.machine === 'furnace'` -> the first crucible with
`moltenS > 0` -> `hands.fillLadle(...)`; none molten -> return `null` (the furnace screen opens as before, exactly like a
mould). `held` is a full ladle and the block is a furnace -> refuse (advise) "The ladle is full - pour it at a Casting Bench
or onto a Stone Anvil" and return `'refused'` (do not open the screen; the player is carrying a timer).

**SMELT tab:** the pour block of a molten crucible gains a "Take with the ladle" button (6.3).

### 4.4 Pouring a ladle

`pourLadle(x, y, z)` (sim) looks at the block at x, y, z:

**On a Casting Bench** (`benchFromLadle`):
1. `metal = metalOfLadle(held)`; `ingot = metal.ingot`; `units = LADLE_UNITS`.
2. Run `fillBench(e, ingot, units)` (shared with Pour to bench, 4.5): for `i = 0..3`: mould `m = slots[i]`, skip if null or
   `slots[4+i]` set; `cast = castOf(m.item, ingot)`; skip if null or `cast.units > left`; set `slots[4+i] = { item:
   cast.item, count: 1 }`, `left -= cast.units`, wear the mould by 1 (`durability = (m.durability ?? MOULD_POURS) - 1`;
   at 0 the mould breaks: `slots[i] = null` and, because a cast never sits in a socket without its mould, that cast goes
   straight to the pack (dropped at the bench with `player.drop(..., at)` when the pack is full); `tool:broke { item }`
   is emitted and the toast "The Hoe Mould cracked after its last pour" (warn) names it. It is still counted in `casts`). Returns `{ casts: Array<{ mould, item, units }>, used }`.
3. `casts.length === 0` -> refuse, ladle unchanged: no moulds -> "Set a fired mould on the bench first"; moulds but all
   holding casts -> "Take the casts out first"; moulds that do not take it -> `` `No mould on the bench takes ${name(ingot)}` ``
   ("No mould on the bench takes Tin Ingot").
4. Otherwise: the held ladle becomes `clay_ladle` in the same slot (`inventory.set(selected, makeStack('clay_ladle', 1))`).
   `rest = units - used`; if `rest > 0` the player gets `rest` x `metal.bloom` (`player.give`; what does not fit is dropped
   at the player's feet with `player.drop`), toast info `` `${rest} ${metalWord} left in the ladle set into ${rest === 1 ? 'a bloom' : 'blooms'}` ``
   ("1 Bronze left in the ladle set into a bloom"). `metalWord` = metal key capitalised ("Copper", "Tin", "Bronze").
5. Emit once per cast `cast:poured { x, y, z (bench), mould, metal, item, count: 1, at: 'bench' }` (this opens hot windows
   within 6 of the bench through the existing listener), once `bench:filled { x, y, z, casts: n, from: 'ladle' }`,
   `ladle:poured { x, y, z, metal, units: used, to: 'bench' }`, sfx `cast_pour` at the bench, `flagOnce(FLAG_FIRST_POUR)`
   (a bench pour counts as a first pour too: the objective `first_pour` must not be skipped by a player who only ever uses
   the bench), `flagOnce(FLAG_FILLED_BENCH)`.

**On a Stone Anvil** (any block whose `handStation.hot`): `HandWork.pourHot(x, y, z, ingot, units, hotS)` NEW:
1. Output waiting -> `` `Take the ${itemName(out)} first` `` (the existing sentence).
2. The anvil has no recipe whose first input is `ingot` -> `` `The ${def.name} cannot work ${itemName(ingot)}` ``
   ("The Stone Anvil cannot work Tin Ingot"). Tin ladles go to a bench.
3. Input loaded with another item -> `` `Busy with ${itemName(input)}` ``. Input of the same ingot with less than 4 room
   (`stackLimit - count < 4`) -> "The Stone Anvil is full".
4. Put the 4 ingots into `slots[0]` (add to an existing same-ingot stack), set `e.hotS = Math.max(e.hotS, hotS)`
   where `hotS = Math.min(HOT_WORK_WINDOW_S, Math.ceil(ladleSecondsLeft))`, `sync(node)`, and emit (no `hand:stroke`: nothing was struck)
   `ladle:poured { x, y, z, metal, units: 4, to: 'anvil' }` and sfx `cast_pour` pitch 1.2. The ladle becomes a
   `clay_ladle` in place. Return `{ ok: true, did: 'insert' }`.
5. The anvil then works as today: the loaded count picks the job (4 copper -> `copper_plate` first, twice; wire needs a
   single ingot loaded from the pack), every stroke inside the window counts double (`STROKE_HOT_MULT`), the label ends
   "(hot)". When the window closes the ingots are simply cold ingots: nothing is lost.

**Elsewhere** (any other block, air): the ladle is not poured. Use with a ladle on the ground does nothing special (no
"pour on the floor": it would only make the same blooms the timer makes).

### 4.5 Pour to bench (from the furnace, no ladle)

`pourToBench(host, e, node, slot)`, exposed as `sim.pourToBench(x, y, z, slot)`:
1. Slot / pool checks as 4.3 steps 1-2.
2. Benches: every tracked `casting_bench` node whose centre is within `CASTING_BENCH_RANGE` (Euclidean, block centres, the
   same measure as `openHotWindow`) of the furnace block; nearest first, ties by `posKey` order. Use `host.nodes` (the
   sim's node index) - add a small helper `benchesNear(x, y, z, range): MachineEntity[]` on Simulation passed into the
   action through `ActionHost` (NEW optional member `benchesNear?`).
3. None -> "No Casting Bench within 4 blocks of the furnace".
4. For each bench in order, `fillBench(bench, melt.item, melt.count)`, subtracting what it used from the pool; stop when
   the pool cannot pay for any further mould.
5. Nothing cast at all -> refuse with the first bench's reason (same sentences as 4.4 step 3).
6. Otherwise: pool reduced (cleared at 0; what is left stays molten with its window untouched), events per cast
   `cast:poured { at: 'bench', x/y/z of the BENCH }`, per bench `bench:filled { from: 'furnace' }`, sfx `cast_pour` at each
   bench, flags as 4.4. No ladle involved, no blooms (leftover simply stays in the crucible).

### 4.6 Cooling - the general rule (pail, beaker, vial, ladle)

`coolStack(stack, dt)` (drink.ts:74) becomes:

Keep its signature (`(stack, dt) => NonNullable<Slot> | null`; existing tests call it) and add one pure helper
`cooledReturn(item: string): string | null` (`itemOrNull(item)?.cools?.returns ?? null`). The replacement
stack is `makeStack(cools.to, stack.count * (cools.count ?? 1))` - for a ladle 4 blooms, for a pail 1 water pail
(unchanged).

`coolCarried` (drink.ts:89): after `inv.set(i, next)`, if `cooledReturn(stack.item)` is set, `player.give(returns, 1)`;
what does not fit is dropped at the player's feet (`player.drop`). The toast for a ladle is the ladle sentence below; for
everything else the existing `` `The ${from} cooled: it is a ${to} again` ``. Ladle toast (warn):
`` `The ${from} set: ${n} ${to} and the Clay Ladle back` `` -> "The Ladle of Bronze set: 4 Bronze Bloom and the Clay Ladle
back". Emit `ladle:cooled { metal, units }` and sfx `fire_out` pitch 1.4 at the player (the crucible's cooling sound).

**Ground items cool too** (NEW, `GroundItems.tick`): an entity whose item has `cools` counts `durability` down by `dt`
(missing = `afterS`); at 0 it becomes `cools.to` x `count * (cools.count ?? 1)` in place (same entity, `durability`
deleted, `version` bumped) and, when `cools.returns` is set, a second entity of the returned item is spawned at the same
spot (`spawn(returns, 1, e.x, e.y, e.z)`). No toast (the player is not holding it). This closes the "drop it to freeze
the clock" trick for pails and ladles alike. Cost: one `itemOrNull` lookup per ground entity per tick - cache a
`hot: boolean` on the entity at spawn (`GroundItem.hot?`, runtime only, not saved; recomputed in `load`).

**Containers refuse hot items** (NEW): `InventoryOptions.holdsHot?: boolean` (default false). `Inventory.accepts(item,
slot)` returns false for `isHot(item)` unless `holdsHot`. `PlayerState.inventory` is constructed with
`{ holdsHot: true }` (playerState.ts:109). Effect: crates, machine slots, vaults, workshop depots and arms (they all use
`Inventory.over(...)`, accept rules and `add`) cannot take a boiling pail or a full ladle; the UI simply will not move it
(transfer returns 0 as for any refused slot). Hot items exist only in the pack and on the ground, the two places that cool.
Verify during the build that the inventory screen's held "cursor" is not a separate `Inventory` (grep shows the only
`new Inventory(` outside inventory.ts is the pack); if it is, give it `holdsHot: true` too.

### 4.7 Every inventory path keeps the seconds (the general fix, SYSTEMS T10 rule 4)

`fullDurability` (inventory.ts:30) becomes:

```ts
export const fullDurability = (item: string): number | undefined => {
  const def = itemOrNull(item);
  return def?.tool?.durability ?? def?.wear ?? def?.mould?.pours ?? def?.cools?.afterS;
};
```

With that one line:
- `Inventory.add(item, n, durability)` keeps `durability` for cooling items (clamped to `[1, afterS]`) and gives a fresh
  hot item `afterS` - pickup from the furnace top, ground pickup, quick-move, `HandWork.take`, `brewTools.give`.
- `sanitize` on load keeps it (a save mid-boil comes back with the same seconds, floored at 1 s by the existing clamp).
- `slotView` shows the heat bar: `durability / afterS`.
- Creative menu (`creativeScreen.ts:142`) hands out a fresh hot item with full seconds (intended).
- `canMerge` and `space` already treat a stack with `durability` as unmergeable; cooling items are stack 1 anyway.

A ladle's seconds are at most 20 but `afterS` is 20, so a ladle filled from a pool with 14 s left shows a 70% bar: honest.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour, rules and edge cases

### 5.1 Conservation (the one rule a reviewer checks first)

Every unit of molten metal ends as exactly one of: a cast (counted in mould `units`), an ingot on an anvil, a bloom, or
metal still in the pool. Tests sum `units` before and after every action (9.2). A ladle is always 4 units or 0.

### 5.2 Save and load

- **Mid-carry:** a ladle in the pack is a stack `{ item: 'ladle_bronze', count: 1, durability: 13.4 }`; saved by the pack
  snapshot; loaded with the same seconds (4.7). No new player field.
- **On the ground:** `GroundItemSnapshot.durability` already exists (groundItems.ts:96); it keeps counting after load.
- **Bench:** its `MachineEntity.slots` (8) are saved with the world entity; moulds keep their pours, casts wait forever
  (they are cold metal shapes; nothing on the bench times out). Old saves: a bench saved before this unit has `slots: []`.
  `sanitizeEntity` pads machine slots to the spec length (`sanitize.ts:75-85`) but counts it as a repair and would toast.
  Add `upgradeBench(e)` (castingBench.ts) and call it in `Simulation.resync` and in `onBlockChanged`'s stored-entity path
  BEFORE `sanitizeEntity`, padding a `casting_bench` entity's `slots` to 8 silently. Test 9.4.
- **Mid-pour:** pours are instantaneous actions; there is no "half poured" state to save.
- **Pool:** unchanged (`crucibleMelt`, `crucibleMoltenS` already saved and sanitised).

### 5.3 World changes

- **Bench broken** (mined, or replaced): `removeMachine` releases `slots` (all 8) through `spills.release` - moulds with
  their pours, casts as items. Nothing extra to write; test it (9.3). Explosions (`destroying`) release nothing, as for
  every machine.
- **Furnace broken while a pool is molten:** unchanged (the pool is lost as today - the existing spill releases
  `crucibleIn/Out` only). Out of scope.
- **Chunk unload:** bench state is a world entity like a crate's: saved and restored with the chunk; no timers. A ladle in
  the pack is with the player. Ground ladles: `GroundItems` is a global list; they cool whether or not the chunk is drawn.
- **Moving structures** (pistons/bearings, Unit 13): a bench is a machine entity; whatever moves crates' entities moves
  the bench's. This unit adds no position-keyed map, so nothing needs `Workshop.relocate`. If a contraption carries a
  bench out of `CASTING_BENCH_RANGE`, Pour to bench simply stops listing it.
- **Pipes, arms, golems:** the bench's 8 slots must NOT become an item endpoint (a pipe pushing ingots into a mould socket
  would break the layout). `Simulation.itemEndpoint` returns null for `casting_bench` nodes, exactly as it does for
  `hearth_part` (`simulation.ts:637`); a test asserts it (9.2 #17). Automation of the bench is out of scope (13).
- **Two benches in range:** nearest first; the button pours into all of them in order (4.5).
- **Bench placed next to the furnace, anvil next to the bench:** a bench pour emits `cast:poured` at the bench, so the anvil
  within 6 blocks of the bench gets the 20 s window - the intended workshop layout ("pour, then hammer the ingots").

### 5.4 Refusals (complete list; every one is a full sentence that says the fix)

| when | sentence |
|---|---|
| clay ladle on a furnace, slot bad | "There is no such crucible" (existing) |
| clay ladle, pool gone cold | "It has gone cold - smelt the bloom again" (existing) |
| clay ladle, nothing molten (UI button only; world Use opens the screen) | "Nothing molten there" (existing) |
| no clay ladle in pack (UI) | "You have no Clay Ladle" |
| pool too small | "A ladle takes 4 molten Copper Ingot - there is 3" |
| full ladle on a furnace | "The ladle is full - pour it at a Casting Bench or onto a Stone Anvil" |
| clay ladle on a bench | "Fill the ladle at a furnace first - Use it on molten metal" |
| ladle on bench, no moulds | "Set a fired mould on the bench first" |
| ladle on bench, all moulds hold casts | "Take the casts out first" |
| ladle on bench, no mould takes the metal | "No mould on the bench takes Tin Ingot" |
| mould on a full bench | "The bench holds 4 moulds - take one out first" |
| empty hand, bench with moulds, nothing to take | "Pour a full ladle over the bench, or pour to it from a furnace within 4 blocks" |
| Shift-take mould under a cast | "Take the casts out first" |
| Shift-take, no mould | "There is no mould on the bench" |
| casts / mould to a full pack | "Your pack is full" (existing wording) |
| ladle on anvil, output waiting | "Take the Copper Plate first" (existing pattern) |
| tin ladle on anvil | "The Stone Anvil cannot work Tin Ingot" |
| ladle on anvil busy with another item | "Busy with Bronze Ingot" (existing pattern) |
| ladle on a full anvil | "The Stone Anvil is full" (existing pattern `${def.name} is full`) |
| Pour to bench, none in range | "No Casting Bench within 4 blocks of the furnace" |

All refusals go through `advise` (once per 8 s per sentence, handwork-front.md) in the world and through the SMELT tab's
toast in the screen.

### 5.5 Full inventory

- Filling a ladle never needs room (in-place swap).
- Pouring a ladle: the ladle becomes a clay ladle in place; leftover blooms go to the pack, the rest drop at the feet.
- Cooling a ladle: blooms replace the ladle in place (4 blooms stack 64, one slot); the clay ladle goes to the pack or drops.
- Taking casts: as many as fit; the rest stay on the bench (never dropped - the bench is a safe place).
- A mould that cracks on its last pour at the bench hands its cast to the pack, or drops it at the bench.

### 5.6 Death

Dying spills the pack as today (ground items keep durability); a spilled ladle cools on the ground into blooms + ladle
(4.6). Cooling in the pack already stops while dead (existing test "does not cool while the player is dead").

### 5.7 What does NOT change

`pourCrucible` with a mould in hand at the furnace works exactly as today (plus the `cast_pour` sound fix). The alloy pot
flow is untouched. Iron and up still smelt straight to ingots and never pool, so there is no `ladle_iron`.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair lines (T8 grammar: `<Name> - <fact>, <fact>`, <= ~60 chars, no degree sign)

Bench (from `benchView(e).label`, NEW, DOM-free in `src/sim/castingBench.ts`):

| state | line |
|---|---|
| no moulds | "Casting Bench - empty, set a fired mould in it" |
| moulds, none holding a cast | "Casting Bench - 3 moulds set, Pickaxe Mould ready to pour" (the first empty socket's mould; SYSTEMS T8 example verbatim) |
| some casts waiting, some moulds free | "Casting Bench - 2 casts to take, Ingot Mould ready to pour" |
| every mould holds a cast | "Casting Bench - 4 casts to take" |
| 1 mould | "Casting Bench - 1 mould set, Maul Mould ready to pour" (singular) |

`Simulation.handView(x, y, z)` returns `this.hand.view(...) ?? this.benchHandView(x, y, z)`; `benchHandView` builds a
`HandView` (`station: 'casting_bench'`, `name: 'Casting Bench'`, `label`, `state`: `'empty'` / `'loaded'` / `'ready'`
(casts waiting), `fraction` = sockets with a cast / 4, `timed: false`, `hot: false`, `strokesPerS: 0`, `tool: null`,
`input`/`output` null, `progress`/`needed` 0). The HUD already shows `label` and fills the crosshair ring with `fraction`
for hand stations (handwork-front.md "UI"); it must also refresh on `bench:filled` and on `hand:taken`-like bench takes -
emit `hand:taken { x, y, z, station: 'casting_bench', item, count }` for each cast taken so the existing refresh hook
fires with no HUD change.

Anvil while hot from a ladle: the existing label ("Stone Anvil - copper ingot 2/8 strokes (hot)") - no change.

Held ladle: the hotbar slot shows the heat bar draining (4.7). No HUD pill (a pill is for buffs, T5).

### 6.2 Toasts

| event | text | kind |
|---|---|---|
| ladle filled | "Ladle of Bronze - 4 molten, 20 s to pour" (seconds = `Math.ceil(secs)`) | good |
| ladle poured at bench | "Casting Bench - poured Pickaxe Mould, Shovel Mould" (names in socket order; > 3 names: "poured 4 moulds") | good |
| leftover blooms | "1 Bronze left in the ladle set into a bloom" / "2 Copper left in the ladle set into blooms" | info |
| ladle on anvil | "Hot metal on the anvil - strike within 14 s for double strokes" | good |
| pour to bench | "Poured into the Casting Bench - 3 casts" (two benches: "Poured into 2 benches - 5 casts") | good |
| ladle cooled | "The Ladle of Bronze set: 4 Bronze Bloom and the Clay Ladle back" | warn |
| mould cracked at the bench | "The Hoe Mould cracked after its last pour" | warn |
| side goal | "Side goal: Fill a casting bench" (Unit 0's mechanism) | good |

### 6.3 SMELT tab (furnace screen) - phone first

The molten crucible's pour block (`castView`, castText.ts) gets two more buttons BELOW the mould buttons, same `Button`
component, `size: 'md'`, `block: true` (full width, >= 44 px tall - the existing pour buttons already meet it):

| button | label | sub (second line) | enabled when |
|---|---|---|---|
| ladle | "Take with the ladle" | "Ladle of Copper - 4 of 6 molten" / "Needs 4 molten - there is 3" / "No Clay Ladle in your pack" | a `clay_ladle` in the pack and `melt.count >= 4` |
| bench | "Pour to bench" | "Casting Bench - 2 moulds take Bronze" / "2 benches - 5 moulds take Bronze" / "No mould on the bench takes Copper" / "Bench is full - take the casts" | a bench within 4 blocks has at least one free mould that takes the metal and the pool covers its units |

The bench button is only SHOWN when at least one bench is within range (a player with no bench never sees it). The ladle
button is shown whenever the crucible is molten (it teaches the ladle exists), disabled with the sub "No Clay Ladle in your
pack" when there is none.

Data plumbing (DOM-free): `castView(c, pack, benches?: BenchNear[])` - NEW optional third argument; `PourChoice.key`
gains two reserved values `'@ladle'` and `'@bench'` (a mould or ingot key never starts with `@`). `smeltTab` passes the
furnace view's `benchesNear` list; its `pour(index, key)` callback (the screen's controller) routes `'@ladle'` to
`sim.fillLadle(x, y, z, index)` and `'@bench'` to `sim.pourToBench(x, y, z, index)`, every other key to `pourCrucible` as
today. `FurnaceView` gains an optional `benches?: BenchNear[]` (7.4: free moulds per metal key and the smallest units
among them; the bench button is enabled when some bench has `freeFor[metal] > 0` and `minUnits[metal] <= melt.count`) filled by `Simulation.furnaceView` only when some crucible is molten (cheap: a scan of bench nodes
within 4).

Hint sentence under the buttons, when a bench is in range and the player has no mould for the metal: "Pour to bench fills
the moulds on the Casting Bench." Otherwise the existing hints.

At 390 px portrait the pour block is already one column; two more full-width buttons add ~100 px of scroll inside the
crucible row, acceptable (the row expands only while molten). At 844 x 390 landscape the SMELT tab scrolls as today.
No new screen (anti-pattern 6d): the bench itself has no screen; everything is Use and the crosshair line.

### 6.4 Phone controls

- Set a mould: hold the mould, tap Use on the bench. Take casts: empty hand, tap Use. Take a mould back: tap Place, then
  Use (the existing touch "Place toggle" = Shift). Pour a ladle: hold it, tap Use on the bench or anvil. Fill: hold the
  clay ladle, tap Use on the furnace - or open the furnace and press the button. No drag, no long-press (SYSTEMS 1.3).
- How to Play (`src/ui/menus/howto.ts`): replace the casting card's text (line 93) with: "When a smelt of copper, tin or
  bronze finishes the metal stays molten for 20 seconds. Hold a fired mould and Use the furnace to pour a cast, or fill a
  Clay Ladle (4 ingots' worth) and carry it to a Casting Bench or a Stone Anvil. Too slow and it sets into blooms to smelt
  again - the ladle comes back." Line 100 (boiling water) gains: "Hot things cannot go into chests or machines."

### 6.5 Sound (T9) - no new names

| moment | sfx | volume tier | pitch |
|---|---|---|---|
| ladle filled at furnace | `cast_pour` | normal 1 | 0.8 (deeper: the ladle dips) |
| ladle / furnace pours into bench moulds | `cast_pour` at the bench | normal 1 | 1.0 |
| ladle onto anvil | `cast_pour` at the anvil | normal 1 | 1.2 |
| mould set on bench | `scrape` | small 0.6 | 1.3 |
| casts lifted | `scrape` | small 0.6 | 0.9 |
| ladle cooled in pack | `fire_out` | small 0.6 | 1.4 (the crucible's cooling sound) |
| furnace mould pour (existing) | `cast_pour` (was `'pour'` - fix) | normal 1 | 1.0 |
| alloy pot ingots in (existing loadPot) | `cast_pour` pitch 1.5 (was `'pour'`) | small 0.6 | 1.5 |

The idle bench is silent (T9 rule 3).

### 6.6 Render and particles

- **Moulds and casts on the bench** (`src/render/handwork/handModels.ts`, `handParts.ts`): a new `HandAnim`/part set for
  `casting_bench`: four socket positions on the bench top (sixteenths, north frame, bench top at y 12): sockets centred at
  x 4 / 12, z 4 / 12, each a 6x1x6 mould slab (terracotta tint) visible when `slots[i]` is set, and a 4x1x4 cast plate at
  y +1 visible when `slots[4+i]` is set, tinted by the cast's metal (copper/tin/bronze colours of 4.1). `HandParts`'
  twice-a-second rescan includes entities of kind `casting_bench` (today only `hand`). Socket order on screen = slot order:
  1 north-west, 2 north-east, 3 south-west, 4 south-east, turned with the block facing (the bench is not oriented today;
  keep north frame).
- **Glow:** for 3 s after a `cast:poured { at: 'bench' }` at that bench the cast plates are drawn orange-bright (the
  part's instance colour lerps from `#ffb24a` x 1.6 to the metal colour over 3 s; the machine shader has no emissive, so
  this is a tint, as the anvil flash already is). Purely visual; nothing waits on it.
- **Sparks:** `HandFx` puffs 12 sparks (cap 24 per emitter, T9 rule 4) at the bench top on each bench pour and at the
  anvil face when a ladle is poured on it; 4 steam-grey puffs at the player's position when a ladle cools.
- The held ladle draws with the existing held-item path (its icon); no new first-person model.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types (`src/core/types.ts`)

```ts
/** An item that goes back to another one after a while in a pack (a carried boiling bucket cools to water). */
export interface CoolsSpec {
  to: string;
  /** Seconds it lasts. A stack's `durability` holds the seconds left; a fresh one starts at this. */
  afterS: number;
  /** Handed back too, into the pack (or dropped), when it cools: the Clay Ladle a ladle of bronze was in. (SYSTEMS 6.5) */
  returns?: string;
  /** How many `to` one cooled item becomes (a ladle sets into 4 blooms). Default 1. NEW, Unit 4. */
  count?: number;
}
```

Content validation (`validateContent`, wherever `brewValidation.ts` checks `cools`): `cools.to` and `cools.returns` are
known items, `count` is a whole number >= 1, `afterS > 0`.

### 7.2 Constants (`src/core/constants.ts`, next to `CASTING_BENCH_RANGE`)

```ts
/** Ingots of molten metal one Clay Ladle carries; a ladle is always full or empty (no per-stack metadata). */
export const LADLE_UNITS = 4;
/** Mould sockets of a Casting Bench (its machine `params.moulds`). */
export const BENCH_MOULDS = 4;
/** Flag: the first time molten metal was poured into a Casting Bench. */
export const FLAG_FILLED_BENCH = 'filled_bench';
```

### 7.3 Events (`src/core/gameEvents.ts`, append)

```ts
'ladle:filled': { x: number; y: number; z: number; metal: string; units: number; seconds: number };
'ladle:poured': { x: number; y: number; z: number; metal: string; units: number; to: 'bench' | 'anvil' };
'ladle:cooled': { metal: string; units: number };
'bench:filled': { x: number; y: number; z: number; casts: number; from: 'ladle' | 'furnace' };
```

### 7.4 Sim types (`src/sim/castingBench.ts`, NEW)

```ts
export interface BenchFill { casts: { socket: number; mould: string; item: string; units: number }[]; used: number; cracked: string[] }
export interface BenchView { x: number; y: number; z: number; moulds: (string | null)[]; casts: (string | null)[]; label: string }
/** freeFor: metal key -> free moulds (cast slot empty) that take it; minUnits: metal key -> the fewest units any of them needs. */
export interface BenchNear { x: number; y: number; z: number; freeFor: Record<string, number>; minUnits: Record<string, number> }
export type BenchResult = { ok: true; did: 'set' | 'take' | 'return' | 'pour' } | { ok: false; reason: string };
```

### 7.5 Saved state summary

| state | where | new? | sanitised by |
|---|---|---|---|
| ladle seconds | pack stack `durability` | no new field | `Inventory.sanitize` via `fullDurability` (4.7) |
| ground ladle seconds | `GroundItemSnapshot.durability` | exists | `finite(...)` (groundItems.ts:460) |
| bench moulds + casts | `MachineEntity.slots` (8) | length only | `upgradeBench` + `sanitizeEntity` slot cleaning |
| flag `filled_bench` | flags set | new flag string | flags are strings |

No `SAVE_VERSION` bump, no `PlayerSnapshot` field (T10 rule 3).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npx tsc --noEmit` and `npx vitest run` green)

1. **Durability for cooling items** - `src/game/inventory.ts`: `fullDurability` reads `cools?.afterS`; add
   `export const isHot = (item: string): boolean => itemOrNull(item)?.cools !== undefined;`; `InventoryOptions.holdsHot?`,
   field `holdsHot`, `accepts` refuses `isHot(item) && !this.holdsHot`; `clone()` copies `holdsHot`.
   `src/game/playerState.ts:109`: `new Inventory(INVENTORY_SIZE, { holdsHot: true })`. Run the whole suite: any test
   that puts a boiling pail into a bare `new Inventory(n)` must construct it with `{ holdsHot: true }` (that is the test
   being honest, not a regression). Tests 9.1.
2. **Cooling with returns and count** - `src/core/types.ts` `CoolsSpec` members; `src/game/drink.ts` `coolStack` uses
   `count`, new `cooledReturn(item)`, `coolCarried` gives the return and uses the ladle toast + `ladle:cooled` + sfx when
   the item is a ladle (`metalOfLadle`). `src/game/groundItems.ts`: `GroundItem.hot?` runtime flag set in `spawn` and
   `load`; in `tick`, for hot entities count down and convert (4.6). Tests 9.1.
3. **Content** - `src/core/constants.ts` (7.2); `src/core/registry.ts` `ladleOf`, `metalOfLadle`;
   `src/content/itemsHand.ts` the five items (4.1); `src/content/recipesHand.ts`: a clay-table strokes recipe
   `strokes('unfired_ladle', 'clay_table', 'unfired_ladle', '1 unfired_alloy_pot', CLAY_STROKES)` placed after the
   `CLAY_PIECES` rows, and `['clay_ladle', 'unfired_ladle', 'clay_ladle']` appended to `FIRED` (500 C, 8 s like the
   others); `src/content/blocksHand.ts` bench desc + machine `slots: 8`; `src/content/specRosterHand.ts` the five item
   keys and two recipe lines; icons. Run `content.test.ts` (progression still completes - the ladle is optional, nothing
   requires it; T7).
   - Check `HandWork.sharesInput`: `unfired_alloy_pot` is the only recipe input of that item at the clay table, so it loads
     the whole held stack (stack 16) and each finished job uses 1 - fine.
4. **Sound fix** - `src/sim/casting.ts` l.119 and l.200: `'pour'` -> `'cast_pour'` (l.119 with `pitch: 1.5`). Update any
   test that expected `'pour'` from a metal pour.
5. **Bench core** - `src/sim/castingBench.ts` NEW:
   ```ts
   export const castSlot = (i: number): number => BENCH_MOULDS + i;
   export function upgradeBench(e: MachineEntity): void;                       // pads slots to 8, silently
   export function fillBench(e: MachineEntity, ingot: string, units: number): BenchFill; // mutates e.slots; wears moulds
   export function benchUse(ctx: SimContext, e: MachineEntity, heldKey: string | null, forceReturn: boolean): BenchResult;
   export function benchView(e: MachineEntity): BenchView;
   export function benchLabel(moulds: readonly (string | null)[], casts: readonly (string | null)[]): string; // pure, tested
   export function freeFor(e: MachineEntity): Record<string, number>;           // metal key -> free moulds taking it
   ```
   Export `wornestMould` from casting.ts only if needed (the bench has one mould per socket; it does not need it).
6. **Furnace-side actions** - `src/sim/castingBench.ts` (or `furnaceActions.ts`, builder's choice; keep casting.ts under
   ~300 lines):
   ```ts
   export function fillLadle(host: ActionHost, e: FurnaceEntity, node: SimNode, slot: number): ActionResult;
   export function pourToBench(host: ActionHost, e: FurnaceEntity, node: SimNode, slot: number): ActionResult;
   ```
   `ActionHost` gains `benchesNear?(x: number, y: number, z: number, range: number): MachineEntity[]` (optional so
   existing test hosts compile).
7. **Simulation wiring** - `src/sim/simulation.ts`:
   ```ts
   fillLadle(x, y, z, slot): ActionResult            // withFurnace -> fillLadle
   pourToBench(x, y, z, slot): ActionResult          // withFurnace -> pourToBench
   pourLadle(x, y, z): ActionResult                  // bench node -> benchFromLadle; hot hand station -> hand.pourHot
   benchUse(x, y, z, heldKey, forceReturn): BenchResult
   benchView(x, y, z): BenchView | null
   benchesNear(x, y, z, range): MachineEntity[]      // scans this.nodes.byKey values of kind 'casting_bench'
   ```
   `handView` falls back to the bench (6.1). `itemEndpoint` returns null for `casting_bench` (5.3). `resync` and `onBlockChanged` call `upgradeBench` for `casting_bench`
   entities before `sanitizeEntity`. `furnaceView` fills `benches` when a crucible is molten. The `cast:poured` listener
   stays as is. The held ladle's seconds: `pourLadle` reads `player.heldStack()` (must be a full ladle, else refuse
   "Hold a full ladle to pour"), its `durability ?? MOLTEN_WINDOW_S`.
8. **HandWork** - `src/sim/handWork.ts`: `pourHot(x, y, z, ingot: string, units: number, hotS: number): StrokeResult`
   (4.4 "On a Stone Anvil"). Re-export through `src/sim/index.ts` whatever the UI needs (`BenchNear`, `LADLE_UNITS`).
9. **Player** - `src/player/handTools.ts`: `HandHands` gains `fillLadle(x, y, z, slot)`, `pourLadle(x, y, z)`,
   `benchUse(x, y, z, heldKey, forceReturn)`. `use()` order becomes:
   1. full ladle (`metalOfLadle(held)`) and (`hit.block.machine === 'casting_bench'` or `hit.block.handStation?.hot`) ->
      `pourLadle`; full ladle on a furnace -> advise the refusal, `'refused'`;
   2. `hit.block.machine === 'casting_bench'` -> `benchUse(hit, held, forceReturn)` for a mould, a clay ladle or an empty
      hand; any other held item -> `null` (normal Use/place);
   3. `hit.block.handStation` -> `station` (unchanged);
   4. `held === 'clay_ladle'` on a furnace with a molten crucible -> `fillLadle` (else `null`);
   5. mould / pot ingots on a furnace (unchanged).
   Outcomes: `'poured'` for fills and pours, `'worked'` for set/take, `'refused'` for refusals (advise + `stopMining`).
10. **UI** - `src/ui/screens/furnace/castText.ts` `castView(c, pack, benches?)` with the two choices (6.3), DOM-free;
    `smeltTab.ts` passes `benches` and routes `'@ladle'` / `'@bench'`; `src/ui/screens/furnace/furnaceScreen.ts:69` (where
    `pour` calls `sim.pourCrucible`) adds the two routes, and `src/ui/screens/furnace/simApi.ts:18` (the screen's sim
    interface) gains `fillLadle(x, y, z, slot): ActionResult` and `pourToBench(x, y, z, slot): ActionResult`. `src/ui/menus/howto.ts` texts.
11. **Events + side goal** - `gameEvents.ts` (7.3); `src/content/objectivesHand.ts` `export const HAND_SIDE_GOALS:
    ObjectiveSpec[] = [{ id: 'pour_bench', title: 'Fill a casting bench', text: 'Set fired moulds on a Casting Bench,
    then pour a full Clay Ladle over it - or press Pour to bench at a furnace within 4 blocks.', condition: flag
    'filled_bench', reward: [{ item: 'shovel_mould', count: 1 }] }]` (use the existing `ObjectiveSpec` condition shape for
    flags - copy how `first_pour` is written; `reward?: ItemAmount[]` exists at `types.ts:702`). Reward reasoning: a
    second cheap mould for the next bench load, not progress.
12. **Render** - `handModels.ts` / `handParts.ts` bench parts and glow; `HandFx` sparks (6.6).
13. **Docs** (section 11) and the e2e step (section 10).

Helpers to reuse, not rewrite: `castOf`, `mouldOf`, `castMetalOfIngot`, `makeStack`, `PlayerState.give/drop`,
`refuse`/`OK`, `posKey`, `stackMax`, `itemName`, `advise`, `ctx.flagOnce`, `ctx.touch`, `spills.release`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest; exact files, names, assertions)

Fixtures: the sim kit used by `src/sim/casting.test.ts` / `src/sim/handWork.test.ts` (copy how they build a furnace with a
molten pool: `e.crucibleMelt[0] = { item: 'bronze_ingot', count: 4 }; e.crucibleMoltenS[0] = 20`), `rig()` / `run()` from
`src/game/brewBuffs.test.ts` for the player + Survival loop, `fakeWorld.ts` for ground items.

### 9.1 `src/game/inventory.test.ts` (extend) and `src/game/brewBuffs.test.ts` (extend "the carried boiling pail")

- `it('keeps a boiling pail\'s seconds through add, quickMove and load')`: `inv.add('boiling_pail', 1, 37.5)` ->
  `inv.get(0)?.durability === 37.5`; `quickMove(inv, 0, other, 0)` (other built `{ holdsHot: true }`) -> 37.5;
  `Inventory.fromJSON([{ item: 'boiling_pail', count: 1, durability: 37.5 }], { holdsHot: true }).get(0)?.durability === 37.5`;
  `fullDurability('boiling_pail') === BOILING_KEEPS_S`; a fresh `inv.add('boiling_pail', 1)` gets `BOILING_KEEPS_S`.
- `it('refuses hot items in containers that do not hold heat')`: `new Inventory(4).add('boiling_pail', 1, 50) === 1`
  (nothing fit); `new Inventory(4).accepts('ladle_bronze', 0) === false`; `transfer(pack, i, crate, 0) === 0`; a cold
  `water_pail` is accepted.
- `it('shows a heat bar for a boiling pail')`: `slotView({ item: 'boiling_pail', count: 1, durability: 45 })!.durability`
  `toBeCloseTo(0.5)` (file `src/ui/screens/inventory/slotViews.test.ts` if it exists, else in inventory.test.ts importing
  `slotView`).
- `it('a picked-up pail keeps its seconds')`: player `give('boiling_pail', 1, 12)` -> pack stack durability 12; then
  `ground.spawn('boiling_pail', 1, x, y, z, { durability: 12 })`, walk the player onto it, tick -> pack durability within
  12 +- 0.5 (minus the ticks).
- Existing "the carried boiling pail" tests stay green unchanged.

### 9.2 `src/sim/castingBench.test.ts` (NEW)

1. `fills a clay ladle from a pool of 4 and leaves the pool empty`: pack has `clay_ladle`; pool 4 bronze, 17 s ->
   `sim.fillLadle(fx, fy, fz, 0).ok`; pack slot holds `{ item: 'ladle_bronze', count: 1, durability: 17 }`;
   `crucibleMelt[0] === null`; one `ladle:filled` event with `units: 4, seconds: 17`.
2. `a ladle takes exactly 4 and leaves the rest molten`: pool 6 -> pool 2 afterwards, `crucibleMoltenS[0]` unchanged.
3. `refuses a pool of 3 with the count in the sentence`: reason `'A ladle takes 4 molten Bronze Ingot - there is 3'`.
4. `refuses without a clay ladle`: `'You have no Clay Ladle'`; `refuses a cold pool`: blooms in out ->
   `'It has gone cold - smelt the bloom again'`.
5. `a mould set on the bench keeps its pours`: hold `pickaxe_mould` durability 7 -> `benchUse(..., 'pickaxe_mould',
   false)` -> `e.slots[0]` `{ item: 'pickaxe_mould', count: 1, durability: 7 }`, hand empty; fifth mould refused
   `'The bench holds 4 moulds - take one out first'`.
6. `a ladle of bronze fills moulds in socket order and returns the clay ladle`: sockets [pickaxe, ingot, maul, shovel];
   pour `ladle_bronze` -> casts: socket 1 `bronze_pickaxe_head` (3 units), socket 2 `bronze_ingot` (1), maul skipped
   (4 > 0 left), shovel skipped; held slot is `clay_ladle`; no blooms; pickaxe mould durability 39, ingot mould 39;
   3 + 1 = 4 units accounted; events: 2 `cast:poured` with `at: 'bench'`, 1 `bench:filled { casts: 2, from: 'ladle' }`,
   flags `first_pour` and `filled_bench`.
7. `leftover metal sets into blooms in the pack`: sockets [pickaxe] only -> 1 `bronze_bloom` in pack, toast text
   `'1 Bronze left in the ladle set into a bloom'`. Conservation: casts' units + blooms = 4.
8. `refuses a ladle no mould takes and keeps it`: sockets [pickaxe], `ladle_copper` -> `'No mould on the bench takes
   Copper Ingot'`; held is still `ladle_copper` with the same durability.
9. `takes every cast with an empty hand and emits item:made at the take`: after test 6, `benchUse(null, false)` -> pack
   has 1 `bronze_pickaxe_head` + 1 `bronze_ingot`; `slots[4..7]` all null; two `item:made` with
   `station: 'casting_bench'`, `recipeId: 'cast:pickaxe_mould'` / `'cast:ingot_mould'`.
10. `Shift takes the last mould back unless its cast waits`: refusal `'Take the casts out first'`, then after taking casts
    the shovel mould comes back with its durability.
11. `a mould on its last pour cracks and its cast still reaches the pack`: ingot mould durability 1 -> after the pour
    socket empty, pack +1 `bronze_ingot`, `tool:broke { item: 'ingot_mould' }`.
12. `pour to bench fills a bench within 4 blocks and leaves the rest in the pool`: bench at distance 3 with [hoe]; pool 5
    bronze -> hoe head cast, pool 3, window unchanged; bench at distance 5 is ignored; none in range ->
    `'No Casting Bench within 4 blocks of the furnace'`.
13. `pour to bench serves the nearest bench first`: benches at 2 and 3 each with [maul]; pool 4 -> only the nearer one
    has the cast.
14. `a bench pour opens the hot window on an anvil next to the bench`: anvil 2 blocks from the bench and 10 from the
    furnace; after a ladle pour `handView(anvil).hot === true`.
15. `benchLabel` (pure): `([null,null,null,null],[...]) -> 'Casting Bench - empty, set a fired mould in it'`;
    `(['pickaxe_mould','ingot_mould','axe_mould',null], all null) -> 'Casting Bench - 3 moulds set, Pickaxe Mould ready to pour'`;
    one mould -> `'1 mould set'`; casts in 2 of 3 -> `'Casting Bench - 2 casts to take, Axe Mould ready to pour'`;
    four casts -> `'Casting Bench - 4 casts to take'`. Every label `length <= 60`.
16. `a broken bench spills its moulds with their pours and its casts`: remove the block -> ground items include the moulds
    with `durability` and the casts.
17. `a casting bench is not an item endpoint`: `sim.itemEndpointAt?.(bx, by, bz)` (or whatever the existing endpoint test
    uses for `hearth_part`) is null.

### 9.3 `src/sim/handWork.test.ts` (extend)

- `a ladle poured on the anvil loads four hot ingots`: `pourHot(ax, ay, az, 'copper_ingot', 4, 14)` -> `ok`, `did:
  'insert'`, `slots[0]` 4 copper, `hotS === 14`; the next stroke with bare hands gains 2; a hammer stroke also gains 2
  (never 4).
- `refuses tin on the anvil`: `'The Stone Anvil cannot work Tin Ingot'`; `refuses while the output waits`.
- `the hot window never shortens`: `hotS` 18 from a furnace pour, then a ladle with 5 s -> still 18.

### 9.4 Save tests (`src/sim/castingBench.test.ts`)

- `round-trips a bench with moulds and casts`: serialise the world entity, `resync()`, same 8 slots, no repair toast.
- `an old bench with no slots loads with 8 empty slots and no repair toast` (T10 rule 1): stored entity `{ kind:
  'casting_bench', ..., slots: [] }` -> after `resync()` `slots.length === 8`, toasts contain no "repaired".
- `a ladle in the pack keeps its seconds through save and load` (in `src/save/` document round-trip test or inventory
  snapshot): `{ item: 'ladle_bronze', count: 1, durability: 9.5 }` -> 9.5.

### 9.5 Cooling (`src/game/brewBuffs.test.ts` -> new `describe('the carried ladle')`, or `src/game/ladle.test.ts` NEW)

- `a ladle cools into four blooms and hands the clay ladle back`: pack `{ ladle_bronze, durability: 2 }`, `run(3)` -> that
  slot `{ item: 'bronze_bloom', count: 4 }`, pack has 1 `clay_ladle`, toast `'The Ladle of Bronze set: 4 Bronze Bloom and
  the Clay Ladle back'`, one `ladle:cooled { metal: 'bronze', units: 4 }`.
- `with a full pack the clay ladle drops at the feet`: fill every other slot; after cooling a ground item `clay_ladle`
  exists.
- `a ladle on the ground cools too`: `ground.spawn('ladle_copper', 1, ..., { durability: 1 })`, tick 2 s -> ground has 4
  `copper_bloom` and 1 `clay_ladle`, no `ladle_copper`.
- `a boiling pail on the ground cools to a water pail` (closes the freeze trick): durability 1, tick 2 -> `water_pail`,
  no extra item (no `returns`).

### 9.6 Content / roster

- `src/content/specRosterHand.ts`: items += `unfired_ladle`, `clay_ladle`, `ladle_copper`, `ladle_tin`, `ladle_bronze`;
  recipes += `'unfired_ladle: 1 unfired_ladle <- 1 unfired_alloy_pot (clay_table, 4 strokes)'` and the firing line in the
  roster's existing format (copy the `ingot_mould` line's format exactly); machine `casting_bench` gains `slots: 8`.
- `src/content/handwork.test.ts`: the "clay pieces cost distinct clay" test stays green (the ladle is not a clay piece);
  NEW `it('has one ladle per cast metal that cools into its bloom and returns the clay ladle')`: for each `CAST_METALS`
  row, `item(\`ladle_${m.key}\`).cools` equals `{ to: m.bloom, afterS: MOLTEN_WINDOW_S, count: LADLE_UNITS, returns:
  'clay_ladle' }` and stack 1.
- Texture readability test covers the 5 new icons automatically (check it iterates every `item_` icon; if it uses a list,
  add them).
- `content.test.ts` progression completes; `gates.test.ts` unchanged.
- `src/ui/screens/furnace/castText.test.ts` (extend): with a pool of 4 and a clay ladle in the pack the choices end with
  `{ key: '@ladle', label: 'Take with the ladle', sub: 'Ladle of Bronze - 4 of 4 molten', enabled: true }`; pool 3 ->
  sub `'Needs 4 molten - there is 3'`, disabled; no ladle -> `'No Clay Ladle in your pack'`; `benches` undefined -> no
  `'@bench'` choice; one bench with `freeFor: { bronze: 2 }` -> `{ key: '@bench', label: 'Pour to bench', sub: 'Casting
  Bench - 2 moulds take Bronze', enabled: true }`.
- `src/player/handTools.test.ts` (if present; else the player tests that cover `HandTools`): a full ladle aimed at a
  bench calls `pourLadle`; at an anvil calls `pourLadle` (not `stroke`); at a furnace returns `'refused'` with the
  sentence; a clay ladle at a furnace with nothing molten returns `null`.
- `src/audio/sfx.test.ts`: count unchanged (no new names).

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E - `scripts/lib/e2eHandwork.mjs` (steps run by `scripts/e2e-handwork.mjs`)

Append three steps after "a fired mould held at a furnace with molten bronze pours a cast head without the screen"
(reuse its furnace cell `c` and the helpers `stand`, `tapUntil`, `takeOut`, `bareHand`, `label`, `ticks`, `d.shot`).
`window.__hw` only for setup and reading; every action is a real tap (`d.use()` via `tapUntil` / `tapStep`).

```js
await step('a clay ladle takes molten bronze at the furnace and fills two moulds on a casting bench', async () => {
  const bench = { x: c.x + 2, y: c.y, z: c.z };               // 2 blocks from the furnace
  await d.hw((a) => window.__hw.setVoxel(a.x, a.y, a.z, 'casting_bench', 2), bench);
  await d.settle(400);
  await d.hw((a) => { const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
    e.crucibleMelt[0] = { item: 'bronze_ingot', count: 4 }; e.crucibleMoltenS[0] = 20; }, c);
  await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('pickaxe_mould', 1); window.__hw.give('ingot_mould', 1);
    window.__hw.give('clay_ladle', 1); window.__hw.selectSlot(0); });
  await stand(bench);
  await tapUntil(d, async () => (await label(d)).includes('1 mould set'));          // pickaxe mould set
  await d.hw(() => window.__hw.selectSlot(1));                                       // the ingot mould (give fills slots 0,1,2 in order)
  await tapUntil(d, async () => (await label(d)).includes('2 moulds set'));
  assert((await label(d)) === 'Casting Bench - 2 moulds set, Pickaxe Mould ready to pour', `line: ${await label(d)}`);
  await d.shot('hand-09-bench-set');
  await d.hw(() => window.__hw.selectSlot(2));                                       // the clay ladle
  await stand(c);
  await tapUntil(d, async () => (await d.inventory()).ladle_bronze === 1);
  assert(!(await d.state()).ui.uiOpen, 'the furnace screen opened instead of filling the ladle');
  await stand(bench);
  await tapUntil(d, async () => (await d.inventory()).clay_ladle === 1);
  assert((await label(d)) === 'Casting Bench - 2 casts to take', `line after pour: ${await label(d)}`);
  await d.shot('hand-10-bench-poured');
  await takeOut();
  const inv = await d.inventory();
  assert(inv.bronze_pickaxe_head === 1 && inv.bronze_ingot === 1, `casts not taken: ${JSON.stringify(inv)}`);
});

await step('a ladle poured on a far stone anvil loads hot ingots: strokes count double', async () => {
  const anvil = cell(STATIONS.indexOf('stone_anvil'));          // the yard anvil, > 6 blocks from the furnace
  await d.hw((a) => { const e = window.__hw.app.game.state.sim.furnaceAt(a.x, a.y, a.z);
    e.crucibleMelt[0] = { item: 'copper_ingot', count: 4 }; e.crucibleMoltenS[0] = 20; }, c);
  await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('clay_ladle', 1); window.__hw.selectSlot(0); });
  await stand(c);
  await tapUntil(d, async () => (await d.inventory()).ladle_copper === 1);
  await stand(anvil);
  await tapUntil(d, async () => (await label(d)).endsWith('(hot)'));
  await d.shot('hand-11-anvil-hot');
  await bareHand();
  await tapStep(d);                                              // one bare-hand stroke
  assert((await label(d)).includes('2/8 strokes'), `hot stroke did not count double: ${await label(d)}`);
});

await step('a ladle left too long sets into blooms and the clay ladle comes back', async () => {
  await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('ladle_tin', 1); });
  await ticks(21 * 20);                                          // 21 s at the sim's 20 ticks/s (match __hw.tick's unit)
  const inv = await d.inventory();
  assert(inv.tin_bloom === 4 && inv.clay_ladle === 1 && !inv.ladle_tin, `ladle did not cool: ${JSON.stringify(inv)}`);
});
```

Notes for the builder: `window.__hw.give(key, n)` must hand a ladle with its full seconds (it calls `inventory.add`, which
now gives `afterS`). If `give` puts items into fixed slots, select by item instead of slot number (add a tiny
`selectItem(key)` to `__hw` if none exists - it is a test hook, allowed). The anvil cell: use whichever index the yard's
`STATIONS` array gives `stone_anvil`; if the yard anvil is within 6 blocks of `c`, move the bench/furnace step's cells,
not the anvil. Check the tick unit of `window.__hw.tick(n)` (the existing `ticks` helper) before using `21 * 20`.

Run: `node scripts/e2e-handwork.mjs --device=desktop` (no `HW_GPU`), then `--device=phonePortrait` (SYSTEMS 6c: UI
changed). Screenshots land in `test-results/e2e-handwork/<device>-hand-09-bench-set.png`, `-hand-10-bench-poured.png`,
`-hand-11-anvil-hot.png`. Take the `.run-lock` mutex before building (WHATS_LEFT 7).

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/casting.md`: rewrite "Not built" into "Ladle and Casting Bench" (fill, pour to bench, ladle pours, cooling with
  returns, refusals list of 5.4, events 7.3); sound is `cast_pour`.
- `docs/api/handwork.md`: "Hot work" paragraph gains `pourHot` and "a bench pour opens the window around the bench".
- `docs/api/handwork-content.md` section 10 ("As built"): Casting Bench built (slots layout 8), ladle items and recipes,
  `CoolsSpec.returns/count`, and strike "NOT BUILT" in section 4.
- `docs/api/handwork-front.md`: Use priority (ladle and bench lines), render (bench moulds and glow), remove the "not built"
  known gap.
- `docs/api/furnace-screens.md`: the SMELT tab's two new buttons.
- `docs/api/brewing.md` (or wherever the boiling pail is documented): seconds now survive every path; hot items refuse
  containers; ground cooling.
- Do NOT edit `docs/WHATS_LEFT.md` or `docs/build/SYSTEMS.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `npx tsc --noEmit` clean; `npx vitest run` all green, including every test named in section 9.
- [ ] `fullDurability('boiling_pail') === 90`; a boiling pail keeps its seconds through give, ground pickup, quick-move,
      save/load; its heat bar draws.
- [ ] Hot items (`cools`) refuse every non-pack inventory; they cool in the pack and on the ground.
- [ ] Clay table: 1 Unfired Alloy Pot -> Unfired Ladle in 4 strokes; fired at 500 C, 8 s -> Clay Ladle.
- [ ] Use a Clay Ladle on a furnace with >= 4 molten: `ladle_<metal>` in the same slot with the pool's seconds (<= 20).
- [ ] Casting Bench: Use sets moulds (max 4), a ladle fills free matching moulds in socket order, leftovers become blooms,
      empty-hand Use lifts casts, Shift/Place-Use takes the last mould back; the crosshair line follows 6.1 exactly.
- [ ] "Pour to bench" appears in the SMELT tab only with a bench within 4 blocks, and pours the pool into it.
- [ ] A ladle on a Stone Anvil anywhere loads 4 hot ingots with a window of the ladle's seconds; strokes count x2.
- [ ] A cooled ladle gives 4 blooms and the Clay Ladle back (dropped if the pack is full).
- [ ] Metal pours play `cast_pour`, never `pour`.
- [ ] Side goal "Fill a casting bench" completes on the first bench fill (not in `OBJECTIVES`).
- [ ] An old save with a bench loads with no repair toast; a bench broken spills moulds (with pours) and casts.
- [ ] `node scripts/e2e-handwork.mjs --device=desktop` and `--device=phonePortrait` pass with the three new steps and
      their screenshots.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Pouring a ladle back into a crucible; partly filled ladles; ladles for iron and up (they never pool).
- Burn damage from carrying molten metal (no new danger, SYSTEMS 1.1).
- Bench automation: arms/deployers/golems setting moulds or taking casts (T6 `offer/take` on the bench). The bench's
  slots could later be exposed through `itemEndpoint`; not now.
- The `alloy_pot` BLOCK touching a furnace (casting.md DEVIATION stays).
- A furnace broken with a molten pool (unchanged loss).
- A held-ladle first-person model or carried light; a "Casting Bench" screen.
- Six-age refactor: all items are `ageIndexOf('ember')`; nothing to move when W0 lands.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **SYSTEMS T4 row change (argued in 2.3):** `unfired_ladle` comes from 1 `unfired_alloy_pot` at the clay table, not
   "2 clay" (2 clay is the drip cone; the clay table picks its job by clay count). Please edit the T4 row.
2. **`CoolsSpec.count?` is a new optional member** (SYSTEMS 6.5 lists only `returns?`). Add it to the sketch.
3. **Ladle seconds = the pool's seconds left (<= 20)**, not a fresh 20 - J3's "20 s and falling" holds for a fresh pool.
4. **Ladle capacity is fixed at 4** (`LADLE_UNITS`) because stacks have no metadata (SYSTEMS 2, 6d). Pools under 4 cannot
   be ladled; Pour to bench and moulds in hand still take any amount.
5. **`Inventory.accepts` now refuses hot items except in the pack** (`holdsHot`). This touches every unit whose containers
   use `Inventory` (crates, vaults, depots); it only affects items with `cools` (boiling pail/beaker/vial, ladles). Units 14
   and 15 should know (a spout or vault never receives a boiling bucket).
6. **Ground items now cool** (`GroundItems.tick`); Unit 14's electromagnet pulls metal ground items - a ladle is not
   "metal" by its key rule (no `ingot/plate/...` in `ladle_bronze`), so no interaction.
7. **Side goal** `pour_bench` uses flag `filled_bench` and lives in `HAND_SIDE_GOALS` (`objectivesHand.ts`); Unit 0's
   `objectivesSide.ts` must concatenate it.
8. **Sound fix** in `casting.ts` (`pour` -> `cast_pour`) is a pre-existing bug this unit fixes because it owns casting.
