# Unit 11 - Column modifiers and the refinery

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding), `docs/build/UNIT-00-foundations.md`
(reaction engine, `BP_MULT`, stack walk, vessel slots), `docs/build/UNIT-08-vacuum-lubricant.md` (`bpFactor`, cap-on-the-head
rule, `pf` in chem physics) and `docs/build/UNIT-06-rig-screen.md` (generic rig screen, `;` depth separator in rig strings).
Wave 2: builds after Units 0, 6 and 8 have merged. Names marked **NEW** do not exist in code today; everything else was
grepped in the tree on 2026-11-22.

**Threads:** T1 (heat ladder: `STEEL_MAX_C` 600, setpoints 480/560, the tower draws `BOIL_J_PER_L` from its furnace),
T3 (litres conserved; tower draws and boiler are named-fluid boundaries; `gasLoss` is the one declared loss), T4 (new
intermediates `catalyst_pellets`, `steel_flask`; consumes `lubricant_canister`, `alumina`, `silica`, `steel_plate`), T8 (crosshair
lines, problems that say the fix, tower formed look), plus light touches of T7 (side goal `crack_oil`, gating by furnace tier),
T9 (one new sound `cap_hiss`, the tower reuses `hearth_formed`) and T10 (four optional entity fields, tower state derived).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The glass column you built in the Forge age has done what glass can do: it splits crude into four cuts at 350 C and turns
low wines into spirit. Unit 11 is the moment it grows up into a refinery.

Three modifiers slot into the column stack you already know how to build, each one a single block whose position says what it
does (DISTILLERY_PLAN idea 2, "geometry is the wiring"):

1. **Reflux Head** (Forge). Sits on top of a column, under the head condenser. Tap it with the wrench to send 0, 50 or 75% of
   what condenses back down the column. Every litre that falls back is distilled again, so the cut gets sharper; but only the
   rest leaves, so the run is slower and the furnace works just as hard. "Purity for flow." Low wines become Fuel Ethanol in one
   pass through a single segment.
2. **Steel Flask** (Forge). The flask's steel twin. Glass cracks at 450 C; steel holds to 600 C. With a Steel Flask on it, a
   Still Base offers two new settings, 480 C and 560 C.
3. **Catalyst Bed + Pressure Cap** (Current). Fill a Catalyst Bed with Catalyst Pellets (alumina and silica fired in the Arc
   Furnace), stand it right on the Steel Flask, build the column on it, cap the head condenser with a Pressure Cap and set
   480 C. The heavy diesel vapour cracks in the hot bed and comes over as gasoline - the best chainsaw fuel - from a feed that
   used to be the tractor's. At 560 C the bed cracks lube base out of heavy residue into diesel and gasoline.

Then the **Refinery Tower** (Current): the hearth's industrial cousin. A 3 x 3 steel tower, 5 to 10 blocks tall, built of
Refinery Casing around a hollow core, with a Refinery Boiler (16 000 L, a whole tank) in the bottom of its front face standing
on a furnace, and up to one Draw Tray per layer in its wall faces. It is validated hearth-style - a gap reads "Wall has a gap"
at the gap, the seams glow when it forms - and it boils crude at 80 L/s, four times a glass column, piping each cut out of its
Draw Trays into tanks. It needs its valves oiled with Lubricant, so the oil chain of Unit 8 feeds the tower that feeds it.

The fantasy: you walk out to the pumpjack at night and a lit steel tower is humming beside it, gold, blue and amber flowing
through pipes into three tanks, the chainsaw's gasoline coming out of yesterday's diesel. Nothing in it is a menu; every piece
is a block you placed and can read by looking at it.

All of it is optional (SYSTEMS rule 6, T7): no spine recipe needs a reflux head, a cracked litre or a tower.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Threads

| thread | what this unit reads | what this unit defines |
|---|---|---|
| T1 heat | `GLASS_MAX_C` 450, `BOIL_J_PER_L` 400, `BOIL_LPS` 20, `furnace.extractW`, `Distillery.baseTemp`, `DistillHost.furnaceUnder` | **NEW** `STEEL_MAX_C` 600, setpoints 480 and 560 (steel only), `shellMaxC(kind)`, `TOWER_BOIL_LPS` 80 (32 kW draw) |
| T3 fluids | `GRADES`, `nameOf`, `expand`, `pour/take/add`, `FluidEndpoint`, `tankFluids()` (7), `CHEM_CONTAINERS` | Tower boiler = inlet endpoint, Draw Trays = outlet endpoints; reaction `gasLoss` (declared vapour loss) |
| T4 web | `alumina`, `silica`, `steel_plate`, `glass`, `copper_ingot`, `iron_plate`, `circuit`, `lubricant_canister` (0/8) | `catalyst_pellets`, `steel_flask` (rows already in SYSTEMS T4), plus blocks `reflux_head`, `catalyst_bed`, `pressure_cap`, `refinery_casing`, `refinery_boiler`, `refinery_draw` |
| T7 gating | `ageIndexOf`, `forge()` `minTier`, side-goal mechanism (0) | side goal `crack_oil` "Crack heavy oil" (flag `cracked_oil`) |
| T8 reading | `chemView`, `Rig.problems`, T8 grammar | lines for 7 new blocks, 15 new problem codes, tower formed look |
| T9 sound | `sfxDistill.ts` (12), `hearth_formed` | **NEW** `cap_hiss` (normal 1.0) appended to Unit 12's set |
| T10 save | Unit 0's `items?` slots on `ChemEntity` | optional `reflux?`, `wearL?`, `oilS?` on `ChemEntity`; towers derived, never saved |

### 2.2 Contracts with other units

| with | contract |
|---|---|
| **Unit 0** | Uses as given: `CHEM.reflux`, `CHEM.catalyst`, `CHEM.pressureCap`, `CHEM.steelFlask` keys and their `CHEM_CAPACITY_L` rows (0, 0, 0, 4000); `STATEFUL` already lists `catalyst_bed` and `steel_flask`; `BP_MULT = { vacuum: 0.7, pressure: 1.3 }`; `Rig.stacks` (flask/vessel -> `{ cells, catalysts, cap }`) from the stack walk (segments, catalyst beds, reflux heads, condensers, then the first cap); `capabilitiesOf` (`pressure` when the stack cap is a `pressure_cap`, `catalyst:<item>` when a bed in the stack holds `<item>`); `ReactionSpec`, `REACTIONS`, `pickReaction(list, mix, ctx, running)`, `RxContext`; `ChemEntity.items?`; `host.release` on break. **Adds one OPTIONAL member** to `ReactionSpec`: `site?: 'vessel' \| 'bed'` (default `'vessel'`), and the one-line filter in the vessel step that skips `site === 'bed'` rows (section 8 step 4). **Narrows** `pressure`: only a stack whose bottom module is a `steel_flask` (glass cannot hold pressure, section 5.3). |
| **Unit 8** | Calls Unit 8's `bpFactor(caps)` and adds its `pressure` branch (`BP_MULT.pressure`); uses the optional `pf` parameter Unit 8 adds to `pressureAt`, `bubblePoint`, `vapourShares` in `src/core/chem.ts`; calls Unit 8's `capTarget(rig, cap)` for the pressure cap (cap on top of the head condenser, or directly on a vessel). Vacuum and pressure are exclusive by geometry (one cell on top of the head); a stack that somehow reports both gets `cap_conflict` and neither applies. Uses `lubricant_canister` as the tower's valve oil. Rig legend letters `U`, `X`, `M` are Unit 8's. |
| **Unit 6** | Tower problems land in `Rig.problems` (the tower is reachable from `scanRig`, section 4.6); `Rig.tower?` is set so Unit 6 may add the title `Refinery tower` as its first rule; the tower card uses the `;` depth separator; new legend letters `S K H Q W O D` (never `P`, which is `chem_port`). Wrench on a `reflux_head` is handled by Unit 11's `chemUse` (cycle, no screen) as Unit 6 table row "wrench / reflux_head" expects. Unit 6's derived `over_glass` problem fires when a base is set above 450 with no steel flask on it - Unit 11 relies on it and does not add a second one. |
| **Unit 7** | Tower draws pipe into tanks that accept `tankFluids()`; the boiler accepts any `isChemFluid` from a pipe. |
| **Unit 12** | Unit 11 appends `cap_hiss` to `sfxDistill.ts` and the `SfxName` union; emits the same `distill:step` event for its new stateful modules through the shared state-change path (it does not add a second event). Codex branch for refinery items: Unit 12's `progression.json` section, Unit 11 adds rows under a heading "Unit 11" only. |
| **Unit 14** | Continuous spouts can fill canisters from a tank fed by Draw Trays; nothing to code here. |

### 2.3 T4 material web rows (this unit)

| item / block | made by | consumed by | age | stack |
|---|---|---|---|---|
| `catalyst_pellets` | forge T3 1200 C: 2 alumina + 1 silica -> 2 | Catalyst Bed (8 batches of 500 L = 4000 L per pellet); `refinery` card byproduct? no - consumers are the bed's two reactions `rx_crack_diesel` and `rx_crack_lube` (two systems: fuels for the saw/tractor and the lube chain) | current | 16 |
| `steel_flask` (+`_done`) | forge T2 1300 C: 4 steel_plate + 2 glass | cracker stills; hot heavy runs 450-600 C; ingredient of `refinery_boiler` (second consumer) | forge | 16 |
| `refinery_casing` | forge T3 1400 C: 4 steel_plate + 1 alumina -> 4 | Refinery Tower shell (building block, end product) | current | 64 |
| `refinery_boiler`, `refinery_draw`, `reflux_head`, `catalyst_bed`, `pressure_cap` | forge, section 4.2 | placed modules (end products) | see 4.2 | 16 |
| consumed from others | `lubricant_canister` (8): tower valve oil, 1800 s of running, empty canister back | - | - | - |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (2026-11-22, before Waves 0-1)

- `src/core/distill.ts`: `CHEM` has ten kinds (`still_base` ... `chem_port`); `STATEFUL = [flask, vessel, receiver]`;
  `STILL_SETPOINTS = [78, 92, 97, 130, 200, 260, 350, 420]`, `STILL_DEFAULT_C = 97`, `GLASS_MAX_C = 450`, `BOIL_LPS = 20`,
  `BOIL_J_PER_L = 400`, `CONDENSE_LPS = 10`, `JACKET_MULT = 3`, `HEAD_C = 60`, `HEAD_JACKET_C = 30`, `MAX_SEGMENTS = 8`,
  `MAX_MODULES = 64`. No steel limit, no reflux, no pressure.
- `src/core/chem.ts`: `pressureAt(c, tempC)`, `bubblePoint(m)`, `vapourShares(m, n, out)` (no pressure factor yet - Unit 8 adds
  `pf`), `trayTemps(sourceC, headC, height)`, `drawIndex(bp, drawTrayC)`, `leakShare(segments)` = 0.25/segments,
  `stagesOf(segments)` = 1 + segments. `GRADES` best first: fuel_ethanol (ethanol >= 0.88), spirit 0.58, low_wines 0.25,
  gasoline (gasoline >= 0.8), kerosene 0.7, diesel 0.8, syrup, residue (bitumen >= 0.45), sugar_wash, sap, crude_oil, water.
- `src/sim/distillScan.ts`: `scanRig` flood-fills chem blocks (6-neighbour, cap 64); a still is a flask on a base with
  `column_segment`s straight up (`for (let up = at(m, 1); up && up.kind === CHEM.segment; ...)`), side draws are condensers
  beside a segment, the head is a condenser on top. `RigProblemCode = 'no_base' | 'no_condenser' | 'drips_nowhere' |
  'too_tall' | 'loose_segment' | 'shared_condenser' | 'too_many'`; `MAX_PROBLEMS = 8`. Only `CHEM.flask` makes a still.
- `src/sim/distill.ts`: `Distillery.baseTemp(base)` = `min(setC, furnace, GLASS_MAX_C)`; `stepStill` computes the bubble point,
  trays, routes each component with `drawIndex` and `leakShare`, takes litres only as targets accept them, sets segment
  `band`s and adds `(moved / dt) * BOIL_J_PER_L` to `f.extractW`. `stagesOf(height)` is the enrichment exponent. `show()` sets
  states, `announce()` toasts "Distilling run finished", `look()` swaps `_done` blocks.
- `src/sim/distillActions.ts`: `chemUse` (empty hand on a base cycles `STILL_SETPOINTS`; containers pour/take by the
  `POURS_INTO` / `TAKES_FROM` sets), `chemView` (lines such as `"Boiling Flask - 1.4 buckets Low Wines, 96 C, boiling"`),
  `chemPortEndpoint`.
- `src/content/recipesDistill.ts`: `forge(minTier, output, inputs, minTempC, ...)` (age = minTier - 1), `card(...)`,
  `PROCESS_CARDS` (7), `RIG_LEGEND = { B, F, V, '|', C, R, T, J, A, P: 'chem_port' }`, `rigBlocks`.
- `src/content/blocksDistill.ts`: `LOOKS: Record<ChemKind, Look>` and `module(kind)` build a glass-case `BlockSpec` per kind
  (+ `_done` twin when `STATEFUL`); textures `chem_<kind>`, `_on`, `_done`, `_blocked`, painted from `EMBLEMS` in
  `src/render/textures/distill.ts`.
- `src/content/machinesDistill.ts`: one `MachineSpec` per `CHEM_KINDS` entry, role `'chem'`, `DESC` record.
- `src/sim/hearthScan.ts`: the model for the tower scan - problems `{ code, x, y, z, text }` capped at `HEARTH_MAX_PROBLEMS`
  (8), `NO_HEARTH_YET` note, "Wall has a gap", "Dirt cannot be part of the wall", "Glass cannot sit on an edge",
  "Interior must be empty"; `reachLoaded(world, x, z)` waits for chunks; formed shells set active bits.
- `src/sim/distillKit.ts`: `buildRig(rig, y0, kit)` (layers by `/`, cells along +x, furnace under every `B`), `feed`,
  `runUntil`, `litresOf`. Tests: `src/sim/distill.test.ts`, `src/sim/distillProcess.test.ts`, `src/core/chem.test.ts`.
- Nothing about reflux, catalyst, pressure, steel or towers exists. DISTILLERY_PLAN 15 lists them as left item 7.

After Waves 0-1 (assumed by this spec): Unit 0's six `CHEM` keys, `BP_MULT`, `Rig.stacks`, `capabilitiesOf`, `REACTIONS`,
`pickReaction`, vessel `items` slots; Unit 8's `vacuum_cap`, `bpFactor`, `pf` parameters, `capTarget`, `lubricant_canister`;
Unit 6's rig screen and `rigCells` with `;`; Unit 12's `sfxDistill.ts` and `distill:step`.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Numbers (all NEW constants in `src/core/distill.ts` unless noted)

| constant | value | why (SYSTEMS 5) |
|---|---|---|
| `STEEL_MAX_C` | 600 | 5.1 steel shell limit, above the cracker (480) with margin |
| `STILL_SETPOINTS` | `[78, 92, 97, 130, 200, 260, 350, 420, 480, 560]` (append two) | T1: 480 and 560 offered only while a steel flask stands on the base |
| `STEEL_SETPOINTS_FROM` | 450 (setpoints above this are steel-only) | equals `GLASS_MAX_C`; keep it as a reference to it, not a literal |
| `REFLUX_STEPS` | `[0, 0.5, 0.75]` | DISTILLERY_PLAN 2 "wrench cycles return 0 / 50 / 75 %" |
| `CATALYST_L_PER_PELLET` | 4000 | T4: "8 batches each" x `batchL` 500 = one full steel flask per pellet |
| `BED_PELLETS_MAX` | 4 | four flasks between refills; one Use puts in what fits |
| `CRACK_MIN_C` / `CRACK_MAX_C` | 460 / 520 | 5.1 cracker row; read by `rx_crack_diesel.tempC` |
| `OVERPRESSURE_S` | 5 | seconds a pressurised stack may stay blocked before its cap vents (toast + hiss, no loss) |
| `TOWER_BOIL_LPS` | 80 | J6: "4x the column rate" (`4 * BOIL_LPS`) - write it as `4 * BOIL_LPS` |
| `TOWER_DRAW_LPS` | 40 | each Draw Tray condenses at most this (four condenser coils' worth) |
| `TOWER_MIN_TRAYS` / `TOWER_MAX_TRAYS` | 3 / 8 | 3 cuts minimum (crude needs them), 8 = `MAX_SEGMENTS` |
| `TOWER_OIL_S` | 1800 | one lubricant canister = 30 min of boiling (144 000 L of crude at 80 L/s = 9 boilers) |
| `TOWER_OIL_MAX_S` | 3600 | at most two canisters banked |
| `TOWER_HEAD_C` | `HEAD_C` (60) | the tower's top tray; no jacket option (out of scope) |
| `CHEM_CAPACITY_L` rows | `refinery_boiler: 16000`, `refinery_draw: 1000` | boiler = one tank (`16 000 L`, T3); draw = one canister |

Reflux maths: enrichment stages `n = stagesOf(segments) * (1 + 2 * r)`; litres leaving per second `= gross * (1 - r)`; heat
drawn = gross (the furnace works as hard). Checked with the real `chem.ts` on 4000 L of low wines at 92 C, head only:

| rig | n | head collects | grade |
|---|---|---|---|
| pot still (0 segments, no head) | 1 | 872 L at 60.5% | spirit (exists: `distil_spirit`) |
| 0 segments + reflux 75% | 2.5 | 482 L at 86.7% | spirit, cleaner |
| 1 segment, reflux 0% | 2 | 526 L at 82.4% | spirit |
| 1 segment + reflux 50% | 4 | 452 L at 90.6% | **fuel ethanol** |
| 1 segment + reflux 75% | 5 | ~450 L at 90.9% | **fuel ethanol** in one pass (J6 step 1) |

So the existing two-pass route (`distil_low_wines` -> `distil_spirit` -> `rectify_spirit` through 2 segments) stays, and the
Reflux Head offers one segment and a slower run instead of two segments or a second pass. The yields are real choices.

### 4.2 Blocks, items and recipes

All modules are brass-framed glass cases built by `module(kind)` in `src/content/blocksDistill.ts` (one `LOOKS` row each),
`category: 'machine'`, `stack: 16`, `hardness: 0.6`, `tool: 'pickaxe'`, translucent. Steel modules keep the glass-case look
(the emblem says steel); only `refinery_casing` is an opaque solid block.

| key | display name | age (`ageIndexOf`) | shape | stateful (`_done`) | glow | recipe (`forge(...)` in `DISTILL_FORGE`) |
|---|---|---|---|---|---|---|
| `reflux_head` | Reflux Head | `'forge'` | cube | no | 0 | `forge(2, 'reflux_head', '2 glass, 1 copper_ingot, 1 iron_plate', 1000)` |
| `steel_flask` | Steel Flask | `'forge'` | cube | yes (Unit 0 lists it) | 3 | `forge(2, 'steel_flask', '4 steel_plate, 2 glass', 1300)` |
| `catalyst_bed` | Catalyst Bed | `'current'` | cube | yes (Unit 0 lists it) | 4 | `forge(3, 'catalyst_bed', '2 glass, 2 steel_plate', 1200)` |
| `pressure_cap` | Pressure Cap | `'current'` | slab (like `airlock_cap`) | no | 2 | `forge(3, 'pressure_cap', '2 steel_plate, 1 copper_ingot', 1200)` |
| `refinery_boiler` | Refinery Boiler | `'current'` | cube | yes (NEW in `STATEFUL`) | 8 | `forge(3, 'refinery_boiler', '1 steel_flask, 4 steel_plate, 1 circuit', 1400)` |
| `refinery_draw` | Draw Tray | `'current'` | cube | yes (NEW in `STATEFUL`) | 3 | `forge(3, 'refinery_draw', '2 steel_plate, 1 glass, 1 copper_ingot', 1400)` |
| `refinery_casing` | Refinery Casing | `'current'` | cube, opaque, NOT a chem kind (`machine: null`) | no; active bit = formed seams | 0 (formed: 3) | `forge(3, '4 refinery_casing', '4 steel_plate, 1 alumina', 1400)` |

Item (in `src/content/itemsDistill.ts`, `DISTILL_ITEMS`):

| key | name | category | age | stack | recipe |
|---|---|---|---|---|---|
| `catalyst_pellets` | Catalyst Pellets | `'material'` | `ageIndexOf('current')` | 16 | `forge(3, '2 catalyst_pellets', '2 alumina, 1 silica', 1200)` |

Recipe reasoning (SYSTEMS 5.3): Forge parts cost 2-4 plates and 1-2 glass (reflux head, steel flask); Current parts add alumina
or a circuit (casing, boiler, pellets). The Arc Furnace (tier 3, 2100 C) reaches every `minTempC`; the steel flask's 1300 C is
inside the Blast Furnace's 1500 C. The boiler eats a steel flask so the flask has a second consumer (T4). A 5-high tower needs
38 casings = 10 crafts = 40 steel plates + 10 alumina: a real project, as big as a Plasma hearth.

Descriptions (item and block `desc`, the game's voice, the number in it):

- Reflux Head: `"Sits on top of a column, under the head condenser. Tap it with the wrench to send 0, 50 or 75% of the
  condensate back down: a sharper cut, a slower run."`
- Steel Flask: `"A boiling flask in a steel shell. Glass cracks at 450 C; steel holds to 600 C, so a Still Base under it can be
  set to 480 C or 560 C. It holds 4000 L."`
- Catalyst Bed: `"Stands right on a Steel Flask, under the column. Put Catalyst Pellets in: above 460 C, under a Pressure Cap,
  heavy vapour cracks into gasoline as it rises through it."`
- Pressure Cap: `"A steel cap with a relief valve. On the head condenser of a column on a Steel Flask it holds 5 bar: boiling
  points rise by 1.3, and a Catalyst Bed below can crack oil."`
- Refinery Boiler: `"The heart of a Refinery Tower: a steel kettle for 16 000 L. Set it in the bottom of the tower's front face,
  on a furnace. Tap it to choose its temperature; oil its valves with Lubricant."`
- Draw Tray: `"A steel tray in a Refinery Tower's wall. It draws the cut that condenses at its height; pipe it away or fill a
  canister from it. One per layer."`
- Refinery Casing: `"Riveted steel plate for a Refinery Tower: a 3 by 3 shell, 5 to 10 blocks tall, hollow in the middle."`
- Catalyst Pellets: `"Fired alumina and silica beads. A Catalyst Bed takes up to 4; each cracks 4000 L of vapour before it is
  spent."`

`machinesDistill.ts` `DESC` rows (MachineSpec, shorter): reflux_head `"Returns part of the condensate down the column: purity for
flow."`; steel_flask `"Boils its charge on a Still Base up to 600 C."`; catalyst_bed `"Cracks heavy vapour rising through it
when hot and under pressure."`; pressure_cap `"Pressurises the stack below it: boiling points x1.3."`; refinery_boiler `"Boils a
Refinery Tower's charge at 80 L/s."`; refinery_draw `"Draws one cut of a Refinery Tower."`. `refinery_boiler` gets
`fluids: { accepts: PORT_ACCEPTS, gives: [], capacityL: 16000 }`; `refinery_draw` gets `fluids: { accepts: [], gives:
distillFluids, capacityL: 1000 }` (pipes connect to both, section 4.7).

### 4.3 The stack, widened (scan)

A still's stack, bottom to top, is now (rule `stackOf` in `distillScan.ts`, replacing the segment-only walk at
`distillScan.ts:148`):

```
  [cap]           pressure_cap | vacuum_cap (Unit 8)      <- on top of the head condenser (Unit 8 cap rule, capTarget)
  [head]          condenser_coil                          <- on top of the top stack cell (or beside a reflux head: no)
  [reflux]        reflux_head            0..1, must be the top stack cell
  segments        column_segment         0..8 (MAX_SEGMENTS), side draws beside them as today
  [bed]           catalyst_bed           0..1, must be directly on the flask
  flask           boiling_flask | steel_flask
  base            still_base             on a furnace top
```

Rules (each failure is a `RigProblem` pushed by `scanRig`, cells = the offending block):

| code (NEW) | when | text |
|---|---|---|
| `bed_misplaced` | a `catalyst_bed` in a stack that is not directly on the flask (a segment or another bed under it) | `"A Catalyst Bed must sit right on the flask"` |
| `bed_glass` | a `catalyst_bed` directly on a glass `boiling_flask` | `"A Catalyst Bed needs a Steel Flask under it - glass stops at 450 C"` |
| `reflux_misplaced` | a `reflux_head` with a segment or bed above it | `"The Reflux Head goes on top of the column, under the condenser"` |
| `reflux_no_head` | a `reflux_head` with no condenser on top | `"The Reflux Head needs a Condenser Coil on top"` |
| `glass_pressure` | a `pressure_cap` whose `capTarget` is a glass flask's stack or a `reaction_vessel` | `"Glass cannot hold pressure - use a Steel Flask under a Pressure Cap"` |
| `cap_conflict` | a stack with both a `vacuum_cap` and a `pressure_cap` (only possible through odd geometry) | `"One cap per column - a Vacuum Cap or a Pressure Cap, not both"` |
| `loose_module` | a `catalyst_bed` or `reflux_head` on no stack at all | `"A Catalyst Bed or Reflux Head must stand in a column on a flask"` (text uses the block's own name) |

Side draws: a condenser beside a `catalyst_bed` or `reflux_head` is not a side draw (draws only beside segments, as today); it
reports `drips_nowhere`'s cousin only if it drips nowhere, otherwise it simply never receives vapour ("no vapour reaches it" -
the existing condenser line). A stack may be 1 bed + 8 segments + 1 reflux head = 10 cells under the head; the `too_tall`
rule still counts segments only.

`Still` gains (all optional, NEW): `bed?: string` (catalyst bed key), `reflux?: string` (reflux head key), `steel: boolean`
(flask kind is `steel_flask`), `pressure?: string` (pressure cap key when it applies: steel flask, no conflict).

`stills` are found for both flask kinds: replace `m.kind !== CHEM.flask` with `!isFlaskKind(m.kind)` where **NEW**
`isFlaskKind(k) = k === CHEM.flask || k === CHEM.steelFlask` lives in `src/core/distill.ts`. Every other place that tests
`CHEM.flask` for "a still flask" uses it too (`takes()` in the scan, `POURS_INTO` / `TAKES_FROM` in `distillActions.ts`,
`chemPortEndpoint` inlet, `show()`'s `case CHEM.flask`, `announce()`, the `no_base` text uses the module's own name).

### 4.4 Steel and the base

`Distillery.baseTemp(base)` becomes `min(setC, furnace, shellMaxC(above))`, where `above` is the module entity at
`base.y + 1` and **NEW** `shellMaxC(kind)` returns `STEEL_MAX_C` for `steel_flask`, else `GLASS_MAX_C` (a reaction vessel is
glass). No module above: `GLASS_MAX_C` (unchanged behaviour).

Setpoint cycling (`chemUse`, empty hand on a base): the list is `setpointsFor(steel)` (**NEW**, pure, `src/core/distill.ts`) =
`STILL_SETPOINTS` filtered to `<= GLASS_MAX_C` unless the module above the base is a `steel_flask`. Cycling wraps within that
list. If the base is already set to 480 or 560 and the steel flask is swapped for glass, `setC` is kept (it is sanitised
against the full `STILL_SETPOINTS`), `baseTemp` caps at 450, Unit 6's derived `over_glass` problem shows, and the next tap
moves it to 78 (first of the glass list). `track()` sanitises `setC` against the full list (so 480/560 load).

### 4.5 Reflux (behaviour in `stepStill`)

- Entity field **NEW** `reflux?: number` on the `reflux_head` entity, one of `REFLUX_STEPS`; missing = 0.
- Wrench Use on a `reflux_head` (`chemUse` with `heldKey === 'wrench'`) cycles 0 -> 0.5 -> 0.75 -> 0 and toasts
  `"Reflux Head set to return 75%"` / `"... 50%"` / `"Reflux Head set to return nothing"`. Empty hand toasts its line (as every
  module). No other held item does anything on it (returns null so the tap carries on).
- In `stepStill`: `r = still.reflux ? refluxOf(mod(still.reflux)) : 0`; `n = stagesOf(height) * (1 + 2 * r)`; the
  `want` litres (`BOIL_LPS * min(1, (ts - tb) / 2) * dt`) is the GROSS boil; the litres that leave the flask are
  `want * (1 - r)` (the rest is the returned reflux, which never leaves the flask in the model); the furnace heat drawn is
  `gross / dt * BOIL_J_PER_L` = `(moved / (1 - r)) / dt * BOIL_J_PER_L`. Condenser capacity limits the leaving litres, as now.
- The reflux head is not a plate and not a draw; with r = 0 it changes nothing (a passive pipe).

### 4.6 Pressure, the bed and cracking

**Pressure.** `capabilitiesOf` reports `pressure` for a steel flask whose `Still.pressure` is set. `stepStill` reads
`pf = bpFactor(caps)` (Unit 8's function, Unit 11 adds `if (caps.includes('pressure')) return BP_MULT.pressure;`) and passes
it to `bubblePoint(flask.mix, pf)`, `vapourShares(flask.mix, n, y, pf)`, and to routing: `drawIndex(bp * pf, drawTrays)`.
Tray temperatures do not change (they come from the base and the head).

**The bed's temperature** is the base's held temperature `ts` (the bed sits in the flask's neck, heated by the same flue). The
crosshair shows it. A bed not on a firing still is at ambient.

**Bed reactions** are rows in `src/content/reactionsDistill.ts` (`REACTIONS`, Unit 0) with the NEW optional `site: 'bed'`:

```ts
// src/content/reactionsDistill.ts (appended by Unit 11)
{ key: 'rx_crack_diesel', name: 'Cracking diesel', site: 'bed',
  in: { diesel: 1 }, out: { gasoline: 0.7, kerosene: 0.2 }, gasLoss: 0.1,
  needs: ['heated', 'pressure', 'catalyst:catalyst_pellets'],
  tempC: [CRACK_MIN_C, CRACK_MAX_C],          // 460..520
  batchL: 500, seconds: 25, age: ageIndexOf('current') },
{ key: 'rx_crack_lube', name: 'Cracking lube base', site: 'bed',
  in: { lube_base: 1 }, out: { diesel: 0.6, gasoline: 0.3 }, gasLoss: 0.1,
  needs: ['heated', 'pressure', 'catalyst:catalyst_pellets'],
  tempC: [540, 590],                           // the 560 C setting
  batchL: 500, seconds: 25, age: ageIndexOf('current') },
```

Why these numbers: `batchL / seconds` = 20 L/s = `BOIL_LPS`, so a bed keeps up with a full boil; 8 batches per pellet (T4).
`gasLoss` 0.1 is the light gas the relief valve lets go (T3 rule 1: the only declared loss; shown as a puff above the cap).
The 560 C window is outside SYSTEMS 5.1's 460-520 cracker row on purpose: it is a SECOND reaction for a heavier feed (lube base
boils at 370 x 1.3 = 481 C under pressure, so it only reaches the bed at 560); `rx_crack_diesel` itself keeps 460-520. The
coordinator adds a row "cracker (lube base) 540-590" to SYSTEMS 5.1.

**How a bed acts (vapour phase, in `stepStill`, NEW helper `crackVapour`)**: after the litres `got` of each component leave the
flask and BEFORE they are routed to draws, if the still has a bed:

```
bedCtx = { caps: capabilitiesOf(flask), tempC: ts, items: bed.items ?? [] }
rx = pickReaction(REACTIONS.filter(r => r.site === 'bed'), vapourMix, bedCtx, bed.rx?.key ?? null)
if rx is a running pick:
   cap = rx.batchL / rx.seconds * dt                         // litres of input this step
   L   = min(cap, sum over rx.in of vapourMix[c] / rx.in[c]) // limited by what is in the vapour
   for c in rx.in:  take(vapourMix, c, L * rx.in[c])
   for c in rx.out: add(vapourMix, c, L * rx.out[c])         // gasLoss share simply not added
   bed.wearL += L; while bed.wearL >= CATALYST_L_PER_PELLET and pellets: pellets -= 1; wearL -= CATALYST_L_PER_PELLET
   if L > 0: host.flagOnce('cracked_oil'); bed.flow = L / dt; bed working
```

`vapourMix` is the per-step `Mix` of litres that left the flask (built from the existing `got` loop, which today adds directly
to targets; the refactor collects into `vapourMix` first, then routes it - same litres, conservation unchanged except the
declared `gasLoss`). The routing then works on the cracked vapour: with `pf` 1.3 and 3 segments at 480 C (trays 340 / 200 /
60 C), diesel (364) condenses at draw 1, kerosene (247) at draw 2, gasoline (117) at the head.

Worked example (the `crack_diesel` card, checked by the process test): 3000 L of diesel grade (`diesel .85, kerosene .10,
lube_base .05`) in a steel flask at 480 C under pressure, bed with 1 pellet: about 1780 L of gasoline reach the head receiver
at >= 90% (grade `gasoline` needs 0.8), ~810 L of kerosene go to draw 2, ~150 L lube base to draw 1, ~255 L vent as gas;
wear 2550 L (the pellet survives, 1450 L left).

**Wrong catalyst / no catalyst.** The bed's slot takes only `catalyst_pellets` (section 5.4). A bed with no pellets: no
`catalyst:*` capability, vapour passes through unchanged (the column still distils), bed state `blocked` once pellets run out
mid-run (red lamp), `idle` if it never had any.

### 4.7 The Refinery Tower

#### Shape (ASCII, layers bottom to top; `x` along the front, `z` going back; front face is z = 0)

```
Layer 0 (floor, y0)          Layers 1..n (trays, n = 3..8)      Layer n+1 (ceiling)
  z=2   W W W                  z=2   W w W                        z=2   W W W
  z=1   W W W                  z=1   w . w      . = core (air)    z=1   W W W
  z=0   W O W   <- front       z=0   W d W      d = Draw Tray     z=0   W W W
        x0 x1 x2                     corners are edges: W only
  under O (y0-1): a furnace    w (face middle): W or a Draw Tray (at most one Draw Tray per layer, on any of the 4 faces)

W refinery_casing   O refinery_boiler (front middle of the floor, on a furnace)   d/D refinery_draw
```

Total height n + 2 = 5..10 blocks. The core (x1, z1) from y0+1 to y0+n must be air. The floor centre (x1, y0, z1) is casing.
The furnace under the boiler is not part of the box; it may itself be a hearth's controller (a hearth beside the tower is fine
as long as the two boxes do not share cells; a casing is never a hearth wall block).

Smallest tower (n = 3, three cuts, the `refine_crude_tower` card), front view and side cut:

```
front (z=0)     middle (z=1)    back (z=2)
  W W W           W W W           W W W     y0+4 ceiling
  W D W  head     W . W           W W W     y0+3 tray 3: gasoline
  W D W           W . W           W W W     y0+2 tray 2: kerosene
  W D W           W . W           W W W     y0+1 tray 1: diesel
  W O W           W W W           W W W     y0   floor; residue stays in O
  . F .                                     y0-1 furnace under the boiler
```

#### Scan (NEW `src/sim/refineryScan.ts`, pure, hearthScan-style)

```ts
export type TowerProblemCode = 'no_tower' | 'tower_gap' | 'tower_block' | 'tower_core' | 'tower_short' | 'tower_tall'
  | 'draw_edge' | 'draw_twice' | 'no_draw' | 'no_furnace' | 'two_boilers';
export interface TowerScan {
  boiler: Cell;                      // the controller
  formed: boolean;                   // no problem at all
  /** Unit vectors: front-to-back (vx, vz) and along the front (ux, uz); core column x/z. */
  frame: { ux: number; uz: number; vx: number; vz: number; coreX: number; coreZ: number } | null;
  trays: number;                     // n (interior layers), 0 when no frame
  draws: Array<{ h: number; key: string }>;   // 1-based tray, bottom to top
  shell: string[];                   // posKeys of every casing cell (for the formed active bit)
  problems: RigProblem[];            // distillScan's shape: { code, text, cells }, at most 8
  note: string | null;               // NO_TOWER_YET when nothing is built
}
export const NO_TOWER_YET = 'No tower built on this boiler yet';
export function scanTower(world: IWorld, x: number, y: number, z: number): TowerScan;
export function findTowerBoiler(world: IWorld, x: number, y: number, z: number): Cell | null; // from a draw
```

Algorithm (keep each rule in its own small function: `findFrame`, `measureCore`, `checkShell`, `checkDraws`, `checkFurnace`):

1. `findFrame`: for d in N, E, S, W order: the cell behind the boiler (boiler + d) is `refinery_casing` AND the cell above it
   is air -> v = d (into the tower), u = d turned right. None: `note = NO_TOWER_YET`, no problems if no casing touches the
   boiler at all; if casing touches it but no frame fits, problem `no_tower` `"Set the Refinery Boiler in the middle of the
   tower's bottom front row"`.
2. `measureCore`: walk up from (core, y0+1) while air, at most `TOWER_MAX_TRAYS + 1`: n = air cells. The cell that stops
   it must be casing (the ceiling centre), else `tower_core` `"The tower's core must be empty"` at that cell. n < 3:
   `tower_short` `"Too short - a tower needs at least 3 trays (5 blocks tall)"`; n > 8 (air above 8): `tower_tall`
   `"Too tall - a tower holds at most 8 trays (10 blocks)"`.
3. `checkShell`: every cell of the 3 x 3 x (n + 2) box except the core cells and the boiler: corners and floor/ceiling must be
   `refinery_casing`; face middles of tray layers may be casing or `refinery_draw`. Air: `tower_gap` `"Wall has a gap"`
   (`"Floor has a gap"`, `"Ceiling has a gap"` by layer). Any other block: `tower_block` `"<Name> cannot be part of the tower"`
   (block's registry name: `"Glass cannot be part of the tower"`). A Draw Tray on a corner, the floor or the ceiling:
   `draw_edge` `"A Draw Tray only works in the middle of a wall"`. A second `refinery_boiler` in the shell: `two_boilers`
   `"One Refinery Boiler per tower"`.
4. `checkDraws`: two draws on one layer: `draw_twice` `"Two Draw Trays on one tray - move one up or down"` (cells: the second).
   No draw at all: `no_draw` `"The vapour has nowhere to go - set a Draw Tray in the wall"` (cells: the core top).
5. `checkFurnace`: the block under the boiler is not a furnace (any tier, `FURNACE_TOPS`-style check the still base uses via
   `host.furnaceUnder`): `no_furnace` `"The Refinery Boiler needs a furnace under it"`.
6. Problems capped at 8 (the module-private `MAX_PROBLEMS` of distillScan, reused by export of a shared constant
   `RIG_MAX_SCAN_PROBLEMS = 8` NEW in `distillScan.ts`). `formed = problems.length === 0 && n in range && draws >= 1`.

Reads: at most 3 x 3 x 11 = 99 cells; never walks into unloaded chunks (`world.isLoaded`); if any cell of the would-be box is
unloaded, the scan returns the previous result unchanged (Distillery keeps it) - the tower never unforms because a chunk is
missing (hearth rule).

#### How the tower reaches `scanRig` (Unit 6 contract)

`refinery_boiler` and `refinery_draw` are chem kinds (they have entities and buffers), `refinery_casing` is not. In `scanRig`:

- `moduleAt` returns tower kinds as modules, but the flood fill does not continue THROUGH a tower module (tower kinds are
  leaves: they join no glass rig; a receiver set against a Draw Tray is not connected to it).
- If the start module is a `refinery_draw`, `findTowerBoiler` walks: the draw's horizontal neighbour that is air is the core;
  down the core to the first non-air (floor centre); the boiler is a horizontal neighbour of the floor centre that is a
  `refinery_boiler`. Then the scan proceeds as if started from the boiler.
- From a boiler, `scanRig` calls `scanTower`, puts the boiler and every listed draw into `rig.modules`, sets
  **NEW** `rig.tower?: TowerScan`, and appends `tower.problems` to `rig.problems` (same `RigProblem` shape, codes added to
  `RigProblemCode`). A rig with a tower has no stills and no edges. So the rig screen, `rigAt`, the crosshair problem lookup
  and Unit 6's ghosts work for the tower with no special code in Unit 6 beyond its optional title rule.
- `Distillery.rescan()` already maps every module key to its rig, so every draw and the boiler share one `Rig`.

#### Running (NEW `Distillery.stepTower(rig, dt)`, called from `stepRig` when `rig.tower`)

```
tower = rig.tower; boiler = mod(tower.boiler)
if !tower.formed: boiler.state = total ? 'blocked' : 'idle'; return
ts = towerTemp(boiler)              // min(setC, furnace under, STEEL_MAX_C), null when cold
if boiler.oilS <= 0 and total(boiler.mix) > 0 and ts != null and bubblePoint < ts: state 'blocked' (dry valves); return
same physics as a still (shared helper boilColumn, section 8 step 3):
  stages = stagesOf(tower.trays)    // 1 + n
  trays  = trayTemps(ts, TOWER_HEAD_C, n); drawTrays = tower.draws.map(d => trays[d.h - 1]); last draw = head
  want   = TOWER_BOIL_LPS * min(1, (ts - tb) / 2) * dt
  per-draw rate cap TOWER_DRAW_LPS * dt and room in the draw (1000 L)
  leak   = leakShare(n)
moved litres -> draws; furnace.extractW += moved / dt * BOIL_J_PER_L (32 kW at full boil)
boiler.oilS -= dt while working
```

Throughput: a 3-tray tower turns a 16 000 L boiler of crude into 3520 L gasoline-cut, 2080 L kerosene, 4800 L diesel and
leaves 5600 L residue in about 200 s of boiling at full heat - if the draws are emptied (pipes to tanks; each draw holds only
1000 L, so by hand the player bottles as it runs).

The furnace: 32 kW is a lot; a lone Clay Furnace cannot hold 350 C under it and the tower simply boils slower as its furnace
cools (`want` shrinks with `ts - tb`; the furnace sim handles `extractW`). A formed Blast or Arc hearth can. The crosshair
says `holding 312 C` honestly; no special rule.

Draw Trays as endpoints: `refineryDrawEndpoint` (NEW, in `distillActions.ts`, beside `chemPortEndpoint`): `offer()` returns
`{ fluid: nameOf(draw.mix), litres }`, `drain(fluid, L)` pours out when the name matches, `room()` 0, `fill()` 0. Boiler:
`refineryBoilerEndpoint`: `room(fluid)` = free litres unless steam/lava or not `isChemFluid`, `fill` expands and pours,
`offer()` only when the boiler state is `done` (what is left cannot boil at the setting: the residue), `drain` likewise. So a
pump can feed crude, a second pipe can pull residue out between runs, and draws pipe cuts into tanks: continuous refining with
no hand. `Simulation.fluidEndpoint(x, y, z, face)` dispatches to them by kind, as it does to `chemPortEndpoint` today.

Formed look: every `refinery_casing` in `tower.shell` gets the active bit (texture `refinery_casing_on`, glowing seams, light 3)
while formed; cleared when it comes apart (only where it differs; same as hearth shells). The boiler shows the four states
(idle dark, working amber, done green, blocked red); Draw Trays show working while liquid arrived within `RECEIVE_HOLD_S`, done
when full or the run finished, like receivers.

Events: on first forming (and on re-forming with a different tray count) toast `"Refinery tower formed - 3 trays, 3 draws"`,
`sfx hearth_formed` at the boiler with `pitch: 0.8`, flag `tower_formed`. On coming apart: warning toast
`"The refinery tower came apart - <first problem text, lower-cased first letter>"` (e.g. "... - wall has a gap"),
`sfx pipe_clunk` (or Unit 12's `distill_clunk` if it has replaced it). Nothing per tick.

### 4.8 Process cards and rig legend

`RIG_LEGEND` gains (letters free today and not taken by Unit 8's `U X M`; `P` stays `chem_port`):

| letter | block |
|---|---|
| `S` | `steel_flask` |
| `K` | `catalyst_bed` |
| `H` | `reflux_head` |
| `Q` | `pressure_cap` |
| `W` | `refinery_casing` |
| `O` | `refinery_boiler` (a furnace goes under every `O`, like `B`) |
| `D` | `refinery_draw` |

`ProcessCard.rig` doc comment lists them. Cards (appended to `PROCESS_CARDS`; `card(id, station, inputs, output, byproducts,
setC, timeS, age, rig)`, age = `ageIndexOf(...)`):

| id | station | inputs -> output (+ byproducts) | set C | time s | age | rig |
|---|---|---|---|---|---|---|
| `reflux_fuel_ethanol` | `reflux_head` | 16 low_wines_beaker -> 1 fuel_ethanol_beaker (+ 15 glass_beaker) | 92 | 420 | `ageIndexOf('forge')` | `'CR/H./\|./F./B.'` (reflux at 75%) |
| `crack_diesel` | `catalyst_bed` | 3 diesel_canister, 1 catalyst_pellets -> 1 gasoline_canister (+ 2 empty_canister) | 480 | 180 | `ageIndexOf('current')` | CRACK_RIG (below) |
| `crack_residue` | `catalyst_bed` | 4 residue_canister, 1 catalyst_pellets -> 1 diesel_canister (+ 2 residue_canister, 1 empty_canister) | 560 | 260 | `ageIndexOf('current')` | CRACK_RIG |
| `refine_crude_tower` | `refinery_boiler` | 16 crude_canister, 1 lubricant_canister -> 4 diesel_canister (+ 3 gasoline_canister, 2 kerosene_canister, 5 residue_canister, 3 empty_canister) | 350 | 220 | `ageIndexOf('current')` | TOWER_RIG (below) |

Canisters balance (16 + 1 in, 14 filled + 3 empty out), as `refine_crude` does. Litres check for the tower card: crude is
`gasoline .22, kerosene .13, diesel .30, lube_base .12, bitumen .23` -> 3520 / 2080 / 4800 L of cuts and 5600 L residue.

**CRACK_RIG** (one slice, 8 layers, top first, x = 0..4; the stack stands at x = 2): base (y0), steel flask, catalyst bed,
segment 1 with a side draw to +x, segment 2 with a side draw to -x, segment 3, head condenser + receiver, pressure cap on the
head condenser.

```
y0+7  ..Q..     Q pressure cap (on the head condenser: Unit 8's cap rule)
y0+6  ..CR.     head condenser, receiver  -> gasoline (117 C under pressure, tray 3 = 60 C)
y0+5  ..|..     segment 3
y0+4  RC|..     segment 2, side draw left -> kerosene (247 C >= tray 2 = 200 C)
y0+3  ..|CR     segment 1, side draw right -> diesel / lube base (364 C >= tray 1 = 340 C)
y0+2  ..K..     catalyst bed, right on the flask
y0+1  ..S..     steel flask
y0    ..B..     still base (furnace under it)
```

String: `'..Q../..CR./..|../RC|../..|CR/..K../..S../..B..'` (same layout idea as `refine_crude`'s
`'..CR/..|./RC|./..|CR/..F/..B'`). At 560 C (`crack_residue`) the trays are 393 / 227 / 60 C: uncracked lube base (481) at
draw 1, diesel (364) at draw 2, gasoline at the head; bitumen never boils and stays as residue in the flask.

**TOWER_RIG** (three depth slices, front first, separated by `;`, each slice top layer first):
`'WWW/WDW/WDW/WDW/WOW;WWW/W.W/W.W/W.W/WWW;WWW/WWW/WWW/WWW/WWW'` - 38 casings, 3 draws stacked on the front face, the boiler
in the front middle of the floor, the core air. `buildRig` puts a furnace under every `O`.

The reflux card cannot carry a dial setting: `distillProcess.test.ts` sets the reflux head's `reflux = 0.75` before running it,
and the Codex text of that card says "Reflux Head at 75%".

Card display names come from the output recipe row; the Codex lists `reflux_fuel_ethanol` under the Reflux Head station,
`crack_*` under the Catalyst Bed, `refine_crude_tower` under the Refinery Boiler.
---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, including edge cases

### 5.1 Use table (all in `chemUse`, `src/sim/distillActions.ts`; result shape `ChemResult`)

| held | target | result | toast / refusal |
|---|---|---|---|
| wrench | `reflux_head` | cycles `REFLUX_STEPS` | `"Reflux Head set to return 50%"` / `"75%"` / `"Reflux Head set to return nothing"` |
| wrench | any other chem module | not handled here (null) -> Unit 6 opens the rig screen | - |
| empty hand | `still_base` | cycles `setpointsFor(steelAbove)` | `"Still Base set to 480 C"` (existing format) |
| empty hand | `refinery_boiler` | cycles `setpointsFor(true)` (the boiler is steel) | `"Refinery Boiler set to 350 C"` |
| empty hand | any new module | toasts its crosshair line (existing behaviour) | - |
| `catalyst_pellets` | `catalyst_bed` | adds `min(held, BED_PELLETS_MAX - have)` to slot 0 (`consumeCount` from Unit 0's `BrewResult`) | `"3 Catalyst Pellets in the bed (3 of 4)"`; full: `"The Catalyst Bed is full - it takes 4 pellets"` |
| `charcoal`, `sand`, `clay_ball`, any filter medium of Unit 8 | `catalyst_bed` | refused | `"A Catalyst Bed takes Catalyst Pellets - charcoal, sand and clay go in a Filter Bed"` |
| any other item | `catalyst_bed` | null (carry on) | - |
| `lubricant_canister` | `refinery_boiler` | `oilS = min(oilS + TOWER_OIL_S, TOWER_OIL_MAX_S)`, gives `empty_canister` | `"Valves oiled - 30 min of running"` (`"... - 60 min of running"` when banked); full: `"The valves are oiled for 60 min already"` |
| `residue_canister` / `lube_base_canister` | `refinery_boiler` with dry valves... | treated as a fluid container: pours in (it IS a chem container) | normal pour toast - the valves need Lubricant, and the dry-valves line says so |
| full chem container | `steel_flask`, `refinery_boiler` | pours (both in `POURS_INTO`), boiler room 16 000 L | existing pour toast |
| empty container | `steel_flask`, `refinery_boiler`, `refinery_draw` | takes (in `TAKES_FROM`) | existing take toast and refusals ("Only 640 L of Gasoline here - an Empty Canister takes 1000 L") |
| full container | `refinery_draw` | refused | `"Draw Trays only give - pour into the Refinery Boiler"` |
| any | `pressure_cap`, `refinery_casing` | null / no chem action (casing has no entity) | - |

Taking pellets back out: there is no take; breaking the bed releases its pellets through Unit 0's `host.release` (pack first,
then a spill crate). A partly worn pellet comes back whole (wear is lost) - documented in the bed's tooltip line? No: the
crosshair says `"... 1 pellet 60% worn"`; breaking accepts the small exploit (it costs a bed swap and 4000 L of wear at most).

### 5.2 Reflux edge cases

- Reflux head with no segments (directly on the flask): allowed; n = 1 x (1 + 2r) (2.5 at 75%). It is a valid "reflux pot".
- Reflux head on a vessel: vessels have no stills; the head is `loose_module` (no flask under its stack).
- Reflux with side draws: all cuts get sharper and all slow by (1 - r). Side draws still work.
- Reflux on a pressurised cracker: allowed and multiplies stages; the bed acts on the vapour before routing, unaffected.
- r is read every step; changing it mid-run takes effect the next step (no state to reset).

### 5.3 Pressure and overpressure

- Pressure applies only to a `steel_flask` stack (the cap's `capTarget` resolves to it and there is no `cap_conflict`). On a
  glass flask or a reaction vessel the cap does nothing and the scan says `glass_pressure`.
- Overpressure: a pressurised still that is boiling-capable (`ts > tb`) but whose targets cannot take (the existing
  `scale <= 1e-9` blocked path: receivers full, condenser missing) counts `overS += dt` on the flask entity (transient, NOT
  saved; reset to 0 whenever it boils or stops being blocked). At `OVERPRESSURE_S` (5 s) the cap vents ONCE per blocked spell:
  `sfx cap_hiss` at the cap (volume 1.0), a 1 s steam puff (16 particles, white), warning toast
  `"The Pressure Cap is venting - empty the receivers"`. No litres are lost, no block breaks (danger stays environmental and
  gentle, SYSTEMS 1.1). The flask shows red (blocked) as today. When boiling resumes, `overS` resets and the next blocked spell
  may vent again.
- The cap's look: active bit (amber lamp, glow 2) while its stack boils under pressure; off otherwise.

### 5.4 Catalyst wear and wrong catalyst

- Slot 0 of the bed's `items` (Unit 0's field; Unit 11 adds `catalyst_bed` to `ITEM_SLOT_KINDS` with ONE slot - the bed uses
  only index 0; Unit 0's Use rules are bypassed for the bed by Unit 11's own branch above so a bed never accepts other items).
- `wearL` (NEW optional entity field) counts litres cracked on the top pellet; at `CATALYST_L_PER_PELLET` one pellet is removed.
- Pellets run out mid-run: the bed goes `blocked` (`catalyst_bed_done` + active bit = red lamp), `sfx pipe_clunk` via the
  existing blocked announce, toast once `"The Catalyst Bed is spent - add Catalyst Pellets"`. The column keeps distilling
  uncracked vapour (the player sees diesel arriving at draw 1 and the gasoline receiver stop). Adding pellets clears it.
- Bed full of pellets but too cool (glass flask or base below 460): `idle`, line says why (6.1). Too hot for diesel (560): the
  lube window applies; with no lube base in the vapour, nothing cracks: line `"nothing to crack at 560 C"`.
- A bed with pellets in a stack WITHOUT a pressure cap: `pickReaction` reports the missing capability; line
  `"needs a Pressure Cap on the head"` (Unit 0's capability words `needs a Pressure Cap`).

### 5.5 Tower edge cases

- **Broken mid-run** (a casing mined, a draw removed): next rescan `formed = false`; the boiler stops (blocked if it holds
  liquid), casing seams go dark, the came-apart toast fires once. Liquids stay in the boiler and in every remaining draw (their
  entities are untouched). Rebuilding re-forms it and the run continues.
- **Boiler broken**: its 16 000 L are lost with it (the distillery's rule: a module's contents go with the glass, `remove()`).
  The boiler's line warns while it holds more than 1000 L: nothing extra - the rule is the same as every flask. (Coordinator
  note: consider a spill to slop later; out of scope.)
- **Draw broken**: its up-to-1000 L is lost; the tower re-scans (fewer draws: cuts merge, still valid if >= 1 draw).
- **Draw full**: that cut's share cannot leave; the boil scales down to what the fullest target accepts (exactly the still
  rule) - a tower with one full draw stalls; line on the boiler `"stalled - empty the Draw Trays"` (blocked after 1 s).
- **Dry valves**: `oilS <= 0` while it could boil -> blocked, problem appended live (see 5.6), line
  `"Refinery Boiler - valves dry, Use a Lubricant Canister"`.
- **Cold furnace / no furnace**: idle (not blocked) with no liquid; blocked with liquid and `no_furnace`; cold furnace = the
  line `"no hot furnace under it"` (same words as the base).
- **Chunk unload**: `Distillery.rescan` already skips unloaded entities; `scanTower` returns the previous `TowerScan` when any
  box cell is unloaded, and `stepTower` does not run for a tower whose boiler chunk is unloaded (the rig is not in `rigs`).
  Nothing unforms, nothing is lost.
- **Save / load**: towers are derived (never saved, like hearth formed state and rigs); the boiler's `mix`, `setC`, `oilS`,
  `state`, the draws' `mix` and `recvS` are entity JSON. On load `track()` sanitises them and the first `rescan` re-forms the
  tower; no toast on a load re-form (the `formedOnce` memory is transient; a tower formed at load is "already formed").
- **Two towers sharing a wall**: each casing may belong to one shell only; a scan that finds a casing already in another formed
  tower's `shell` treats it as fine (shared walls are allowed, like hearths) but the active bit is cleared only when no formed
  tower lists it.
- **Contraptions** (Unit 13 moving blocks): chem modules are not movable by pistons today; nothing to do.

### 5.6 Live-state problems (added after the scan by `Distillery`, not by the pure scan)

Unit 6 allows live problems in `Rig.problems` via the Distillery. `Distillery.rescan()` does not know oil levels, so Unit 11
adds them where `chemView` builds problems: `towerLiveProblems(rig, boiler): RigProblem[]` (NEW, pure, `distillActions.ts`)
returns `dry_valves` `"The tower's valves are dry - Use a Lubricant Canister on the Refinery Boiler"` (cells: boiler) when
`oilS <= 0`, and `bed_spent` `"The Catalyst Bed is spent - add Catalyst Pellets"` for any still with a bed whose pellets are 0
after it ran. Unit 6's screen shows them through `ChemView.problems?`.

### 5.7 Failure messages (complete list, for the T8 review)

Scan: `bed_misplaced`, `bed_glass`, `reflux_misplaced`, `reflux_no_head`, `glass_pressure`, `cap_conflict`, `loose_module`,
`no_tower`, `tower_gap`, `tower_block`, `tower_core`, `tower_short`, `tower_tall`, `draw_edge`, `draw_twice`, `no_draw`,
`no_furnace`, `two_boilers` (texts in 4.3 and 4.7). Live: `dry_valves`, `bed_spent`. Use refusals: section 5.1. Toasts:
cap venting, bed spent, tower formed, tower came apart, valves oiled.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair lines (`chemView`, T8 grammar, <= ~60 chars)

| module | line (examples) |
|---|---|
| Reflux Head | `"Reflux Head - return 75%, sharper x2.5, flow x0.25"`; r = 0: `"Reflux Head - return nothing (wrench to set)"` |
| Steel Flask | existing flask format: `"Steel Flask - 2.9 buckets Diesel, 364 C, boiling"`; under pressure add `", 5 bar"`: `"Steel Flask - 2.9 buckets Diesel, 364 C, boiling, 5 bar"` |
| Catalyst Bed | working: `"Catalyst Bed - cracking Diesel, 480 C, 3 pellets"`; `"Catalyst Bed - 1 pellet 60% worn, 480 C"`; idle reasons: `"Catalyst Bed - too cool (450 of 460 C), 4 pellets"`, `"Catalyst Bed - needs a Pressure Cap on the head"`, `"Catalyst Bed - nothing to crack at 560 C"`, `"Catalyst Bed - empty, add Catalyst Pellets"`; spent: `"Catalyst Bed - spent, add Catalyst Pellets"` |
| Pressure Cap | `"Pressure Cap - holding 5 bar on the Steel Flask"`; on glass: the problem line; nothing under: `"Pressure Cap - nothing to hold"` |
| Still Base | existing; with a steel flask above 450: `"Still Base - set 480 C, holding 480 C"`; set 480 under glass: Unit 6's `over_glass` problem line wins |
| Refinery Boiler | `"Refinery Boiler - 12.4 buckets Crude Oil, 350 C, boiling"`, `"... run done"`, `"Refinery Boiler - valves dry, Use a Lubricant Canister"`, `"Refinery Boiler - set 350 C, no hot furnace under it"`; not formed: first tower problem `"Refinery Boiler - Wall has a gap"`; nothing built: `"Refinery Boiler - No tower built on this boiler yet"` |
| Draw Tray | `"Draw Tray - tray 3 of 3, 640 L Gasoline, filling"`; `"Draw Tray - tray 1 of 3, full - empty it or pipe it away"` |
| Refinery Casing | no entity -> no chem line (a plain block name `"Refinery Casing"`; formed casing shows its glow) |

Second goggles line (inspector) for the boiler: `"Oil 24 min left, draws 3, trays 3, 80 L/s"` (only with goggles; keeps the
first line short).

### 6.2 Rig screen (Unit 6, generic)

Nothing to build in Unit 6's screen. Unit 11 guarantees: new modules appear in its glassware list via `CHEM_KINDS`; `Rig.problems`
carries every scan problem with cells (tap highlights the gap casing, which is a non-chem cell: Unit 6 highlights by cell
coordinates, so it works); capabilities print `pressure`, `catalyst:catalyst_pellets` (Unit 0 words: "pressure",
"catalyst (Catalyst Pellets)"); the tower card's three slices draw side by side ("Slices front to back."). Unit 6 may add the
title rule `rig.tower ? 'Refinery tower'` first (its section 14 note 3).

Phone: everything is Use / wrench / an existing screen. No new screen. Lines fit 60 chars (the longest above, the bed's
too-cool line, is 49).

### 6.3 Textures (`src/render/textures/distill.ts`)

- `EMBLEMS` gains a painter per new chem kind (it is `Record<ChemKind, ...>`, so TypeScript forces them): `reflux_head` (a
  funnel with a return arrow), `steel_flask` (the flask outline over a darker steel-grey pane `IRON` tones, rivets), `catalyst_bed`
  (rows of round pellets, dark when the bed is empty - drawn by the renderer from the slot count is out of scope; the emblem is
  static), `pressure_cap` (a dial gauge on the slab), `refinery_boiler` (a kettle with a flame mark, steel frame instead of brass),
  `refinery_draw` (a tray with a spout).
- `refinery_casing` and `refinery_casing_on`: NEW plain tiles (not the glass case): riveted steel plate 16x16, the `_on` twin
  has warm orange seams like the hearth wall `_on` tiles. Icon from the side tile.
- Icon `catalyst_pellets`: a small heap of off-white beads with a grey rim.
- Raise the texture layer cap in the content test if it trips (DISTILLERY_PLAN 2.1 already warned).

### 6.4 Render (`src/render/distill/distillFx.ts`)

- Steel flask: same liquid body and bubbles as the boiling flask (it is a flask kind - the render switch uses `isFlaskKind`).
- Catalyst bed: no liquid; while working, its `flow` drives the existing bubble/drip instance path as a slow rising shimmer
  (reuse the column band slab in the colour of the cracked product, gasoline gold).
- Pressure cap vent: the 1 s puff uses the existing particle emitter with at most 16 particles (T9 cap 24).
- Tower: the boiler draws its liquid body like a flask (scaled to 16 000 L); draws draw like receivers. The core is hidden
  inside casing; no interior render.

### 6.5 Sounds (T9)

- NEW `cap_hiss` in Unit 12's `sfxDistill.ts`: a 0.8 s filtered noise burst falling in pitch, volume 1.0 (normal), only on a
  venting event (never looped). Add to `SfxName` in `src/core/gameEvents.ts` and to the distill set count in `sfx.test.ts`.
- Tower forming: existing `hearth_formed`, `pitch: 0.8`. Came apart: existing blocked clunk.
- Boiling: the tower's boiler counts as one boiling flask for Unit 12's boil ambience layer (it reads boiling flasks near the
  listener; Unit 11 makes `isFlaskKind`-or-boiler states visible to it by exporting `isBoilingVessel(e)` NEW in `distill.ts`).
- Wrench cycle on the reflux head: the existing UI click of `chemUse` toasts (no new sound).

### 6.6 Side goal

NEW `src/content/objectivesRefinery.ts`:

```ts
export const REFINERY_SIDE_GOALS: ObjectiveSpec[] = [{
  id: 'crack_oil', title: 'Crack heavy oil',
  text: 'Catalyst Pellets in a Catalyst Bed on a Steel Flask, a Pressure Cap on the head condenser, the base at 480 C: diesel comes over as gasoline.',
  condition: { type: 'flag', flag: 'cracked_oil' }, age: ageIndexOf('current'), reward: [{ item: 'catalyst_pellets', count: 2 }],
}];
```

`objectivesSide.ts` appends `...REFINERY_SIDE_GOALS` (one line, unit order). Flags set: `cracked_oil` (first litre cracked),
`tower_formed` (first forming), `refluxed` (first run with r > 0 that finishes) - plain `flagOnce`, no objectives for the last two.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 TypeScript sketches

```ts
// src/core/distill.ts (NEW members)
export const STEEL_MAX_C = 600;
export const STILL_SETPOINTS: readonly number[] = [78, 92, 97, 130, 200, 260, 350, 420, 480, 560];
export const REFLUX_STEPS: readonly number[] = [0, 0.5, 0.75];
export const CATALYST_L_PER_PELLET = 4000;
export const BED_PELLETS_MAX = 4;
export const CRACK_MIN_C = 460;
export const CRACK_MAX_C = 520;
export const OVERPRESSURE_S = 5;
export const TOWER_BOIL_LPS = 4 * BOIL_LPS;
export const TOWER_DRAW_LPS = 40;
export const TOWER_MIN_TRAYS = 3;
export const TOWER_MAX_TRAYS = MAX_SEGMENTS;
export const TOWER_OIL_S = 1800;
export const TOWER_OIL_MAX_S = 3600;
export const TOWER_HEAD_C = HEAD_C;
export const CATALYST_ITEM = 'catalyst_pellets';
export const TOWER_OIL_ITEM = 'lubricant_canister';
export const TOWER_CASING = 'refinery_casing';
// CHEM gains (Unit 11): boiler: 'refinery_boiler', draw: 'refinery_draw'
// CHEM_CAPACITY_L gains: refinery_boiler: 16000, refinery_draw: 1000
// STATEFUL gains: CHEM.boiler, CHEM.draw
export const isFlaskKind = (k: string): boolean => k === CHEM.flask || k === CHEM.steelFlask;
export const isTowerKind = (k: string): boolean => k === CHEM.boiler || k === CHEM.draw;
export const shellMaxC = (k: string | null): number => (k === CHEM.steelFlask || k === CHEM.boiler ? STEEL_MAX_C : GLASS_MAX_C);
export function setpointsFor(steel: boolean): readonly number[];
export function nextReflux(r: number): number;            // 0 -> 0.5 -> 0.75 -> 0; unknown -> 0.5
// bpFactor (Unit 8) gains: caps.includes('pressure') ? BP_MULT.pressure
```

```ts
// src/sim/distill.ts - ChemEntity gains (all OPTIONAL, all sanitised in track())
reflux?: number;     // reflux_head: one of REFLUX_STEPS, else 0
wearL?: number;      // catalyst_bed: litres cracked on the top pellet, clamp [0, CATALYST_L_PER_PELLET)
oilS?: number;       // refinery_boiler: seconds of oiled running left, clamp [0, TOWER_OIL_MAX_S]
// transient (never written to the entity JSON; kept in private Maps on Distillery):
//   overS (pressure spell seconds), vented (bool per spell), formed memory per boiler key
```

```ts
// src/sim/distillScan.ts
export type RigProblemCode = /* existing */ | 'bed_misplaced' | 'bed_glass' | 'reflux_misplaced' | 'reflux_no_head'
  | 'glass_pressure' | 'cap_conflict' | 'loose_module' | TowerProblemCode | 'dry_valves' | 'bed_spent';
export interface Still { /* existing */ bed?: string; reflux?: string; steel: boolean; pressure?: string }
export interface Rig { /* existing + Unit 0/8 fields */ tower?: TowerScan }
export const RIG_MAX_SCAN_PROBLEMS = 8;   // exported rename of the private MAX_PROBLEMS (value unchanged)
```

```ts
// src/core/reactions.ts (Unit 0's ReactionSpec): ONE optional member added by Unit 11
site?: 'vessel' | 'bed';   // default 'vessel'; 'bed' rows act on vapour rising through a catalyst bed
```

### 7.2 Sanitising (in `Distillery.track`)

```ts
if (e.kind === CHEM.reflux) e.reflux = REFLUX_STEPS.includes(finite(e.reflux, 0)) ? e.reflux : 0;
if (e.kind === CHEM.catalyst) e.wearL = clamp(finite(e.wearL, 0), 0, CATALYST_L_PER_PELLET - 1e-6);
if (e.kind === CHEM.boiler) { e.oilS = clamp(finite(e.oilS, 0), 0, TOWER_OIL_MAX_S); e.setC = sanitised like a base }
// catalyst bed slot: Unit 0 sanitises items; Unit 11 additionally drops anything that is not catalyst_pellets and caps count at 4
```

### 7.3 Old-save compatibility

- Every field is optional; a save from before Unit 11 has no such entities, so nothing changes.
- A save made with Unit 11 and loaded by an older build: unknown block ids are a block-table concern (append-only, SYSTEMS 2);
  not supported backwards, as everywhere.
- `setC` 480/560 on a base loads (full list sanitiser).
- Block ids: all new blocks are APPENDED at the end of `DISTILL_BLOCKS` (the `CHEM` object order decides `module()` order:
  Unit 11's two new keys go after Unit 0's six; `refinery_casing` is pushed after the module blocks). Never insert.
- No `SAVE_VERSION` bump (T10 rule 3).
