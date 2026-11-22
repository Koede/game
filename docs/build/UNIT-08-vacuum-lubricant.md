# Unit 8 - Vacuum line and lubricant (build spec)

Status: design spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Builder: read SYSTEMS.md sections 3 (T1-T4,
T8-T10), 5, 6.1, 6.2, 6.5, 6b J1/J2, 6c, 6d first; this file says exactly what Unit 8 adds on top of them.

**Threads:** T1 (heat: the vacuum lowers boiling points to `bp x0.7`, so the 350 C notch that a Blast Furnace or a kerosene
ground burner gives is enough for the heavy end; no device gets hotter than its source), T2 (the `vacuum_pump` is a workshop
consumer, `BASE_STRESS` 4, 16 rpm; `LUBE` becomes the one oil ladder with `lubricant` x1.5 / 900 s at the top), T3 (two
fluids `lube_base` and `lubricant` registered by Unit 0 get producers, grades used at boundaries, containers as table rows,
litres conserved and the filter's catch is a declared, counted loss), T4 (lube base and lubricant each have a producer and two
or more consumers), T8 (crosshair lines for the cap, the pump, the filter bed and the oiled network), T9 (two sounds, the
amber/green/red lamp vocabulary on the filter bed), T10 (optional saved fields: filter medium, oil kind per workshop part,
`PlayerSnapshot.barOilLogs`). It also lands T7's side goal `oil_the_works`.

Shared ids this unit DEFINES (SYSTEMS 6.2 row "8"): `vacuum_cap` block, `vacuum_pump` part, `Workshop.vacuumAt(x, y, z)`,
`filter_bed` (+ `filter_bed_done`), `LUBE.lubricant`, chainsaw bar oil (`BAR_OIL_LOGS`, `PlayerSnapshot.barOilLogs?`).
Shared ids it CONSUMES from Unit 0: `CHEM.vacuumCap`, `CHEM.filter`, `CHEM_CAPACITY_L` rows, `Capability 'vacuum'`,
`Distillery.vacuumAt`, `Distillery.capabilitiesOf`, `Distillery.offerItem`, fluids `lube_base` / `lubricant` with their grades
and canisters, `SIDE_OBJECTIVES`.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The crude column has always left something behind: a black, tarry **Heavy Residue** in the flask. Today the only use of it is
to slop a canister of it on a shaft for a 25% stronger network. This unit turns that leftover into the best oil in the game and
gives the Bronze workshop its first job *for the distillery*: pulling a vacuum.

The fantasy, in the order the player meets it:

1. *"The cap and the pump."* A brass **Vacuum Cap** sits on top of a still's condenser like a lid. Beside it, a **Vacuum Pump**
   (a bellows box on the shaft) is driven by the same hand crank, water wheel or clockwork motor that already runs the mill. Turn
   the crank and the cap's lamp goes amber with a soft hiss: everything in the flask now boils at seven tenths of its usual heat.
2. *"The heavy end comes over."* Residue poured into that flask at the 350 C notch gives up a thin diesel tail, then the brown
   **Lube Base** (259 C under vacuum instead of 370 C), while the bitumen (364 C under vacuum, more than the base gives) stays
   in the flask for the asphalt of Unit 9. Stop cranking and the run stops with a red lamp and a clear sentence; crank again and
   it resumes. Nothing is ruined.
3. *"Polish it."* The vacuum flask foams, so the lube base carries droplets of tar. A **Filter Bed** packed with plain **Clay**
   under the receiver catches most of what is not oil; what drips out below is clear amber **Lubricant**. The clay band in the
   glass darkens as it fills; when it is spent the bed's lamp goes red and asks for fresh clay.
4. *"A quiet, strong workshop."* A Lubricant canister used on any shaft part: the whole network carries 50% more for 15
   minutes, the goggles line ends in `, oiled`, the empty canister comes back, side goal "Oil the works".
5. *"Bar oil."* The same canister used while a chainsaw is in the pack oils its chain: the next 240 logs cost 5.25 fuel each
   instead of 7.

It is the J1 journey (SYSTEMS 6b) steps 3 to 6, and the "vacuum pump hookup" of WHATS_LEFT section 2: the workshop pump makes
chemistry's vacuum. The same cap and pump are the vacuum Unit 10's essences need (J2 step 2), so this unit builds the vacuum
for vessels too.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 What Unit 8 provides (exact shapes)

| id / API | file | shape | consumers |
|---|---|---|---|
| `vacuum_cap` block (chem module) | `src/content/blocksDistill.ts` (LOOKS row), recipe in `recipesDistill.ts` | chem kind `CHEM.vacuumCap` (key from Unit 0), no buffer, no `_done` twin | 10 (essences need `vacuum`), 11 (shares the "cap on the top" slot with `pressure_cap`) |
| cap placement rule | `src/sim/distillScan.ts` | `Rig.vacuum: Map<string, string>` NEW: flask-or-vessel key -> cap key; problem code `loose_cap` NEW | 0's `capabilitiesOf`, 6 (rig screen lists problems generically), 10, 11 |
| `vacuum_pump` workshop part | `src/content/itemsWorkshopParts.ts` `PART_DEFS` row, `kinetics.ts BASE_STRESS.vacuum_pump = 4` | kinetic part (not in `NON_KINETIC`), anim front | 12 (pump on shared networks with the stirrer) |
| `Workshop.vacuumAt(x, y, z): boolean` | `src/workshop/workshop.ts` | true when a `vacuum_pump` touching cell (x, y, z) turns at `abs(rpm) >= VACUUM_MIN_RPM` (16) | Game wires `sim.distill.vacuumAt = (x, y, z) => workshop.vacuumAt(x, y, z)` |
| `VACUUM_MIN_RPM = 16` | `src/workshop/workshop.ts` | const | 12 may mirror the pattern for `STIR_MIN_RPM` |
| `VACUUM_BP_FACTOR = 0.7`, `bpFactor(caps)` | `src/core/distill.ts` | `bpFactor(caps: readonly Capability[]): number` (0.7 with `vacuum`, else 1) | 11 adds the `pressure` branch (1.3) in the same function |
| boiling-point factor in chem physics | `src/core/chem.ts` | optional last param `pf = 1` on `pressureAt`, `bubblePoint`, `vapourShares` | 10, 11 (all stills read it) |
| `VACUUM_ENTRAIN = 0.12` | `src/core/distill.ts` | share of the boiled litres carried over as droplets of the flask's own liquid in a vacuum still | 11 (cracker is pressure, unaffected) |
| `filter_bed` + `filter_bed_done` | `blocksDistill.ts`, `STATEFUL` in `core/distill.ts` | stateful module, 500 L (`CHEM_CAPACITY_L.filter_bed`, Unit 0 row) | 10 (tinctures through charcoal) |
| `FilterMedium`, `FILTER_MEDIA` | `src/core/distill.ts` | table, one row `clay` here; Unit 10 appends `charcoal` | 10 |
| `FILTER_LPS = 10` | `src/core/distill.ts` | litres per second at most leaving a bed | - |
| `ChemEntity.medium?`, `catchL?`, `caughtL?` | `src/sim/distill.ts` | optional saved fields | 6 (screen), 10 |
| `LUBE` oil ladder, `OilKey`, `OilSpec`, `oilOf(item)` | `src/workshop/workshop.ts` | see 7.2 | 11 (refinery start-up reads `LUBE.lubricant`), 12, 17 |
| bar oil: `BAR_OIL_ITEM`, `BAR_OIL_LOGS` 240, `BAR_OIL_MAX` 480, `BAR_OIL_MULT` 0.75, `oilChainsaw(player)`, `sawStatusText(player)` | `src/game/felling.ts` | see 7.4 | - |
| `PlayerState.barOilLogs`, `PlayerSnapshot.barOilLogs?` | `src/game/playerState.ts` | optional number | - |
| process cards `vacuum_residue`, `polish_lubricant`; rig legend `U` (vacuum_cap), `X` (filter_bed), `M` (vacuum_pump) | `src/content/recipesDistill.ts` | `ProcessCard` rows, `RIG_LEGEND` rows | 6 (ghosts), 10 (`U`, `X` in its cards), 12 (Codex branch) |
| side goal `oil_the_works`, flags `oiled_works`, `pulled_vacuum`, `made_lubricant` | `src/content/objectivesVacuum.ts` NEW (`VACUUM_SIDE_GOALS`) | `ObjectiveSpec[]` | 0's `objectivesSide.ts` concatenation |
| sounds `vacuum_hiss`, `oil_glug` | `src/audio/sfxWorkshop.ts` (create if no other unit has; else append) | `SfxName` members | - |

### 2.2 What Unit 8 consumes (must exist after Unit 0)

- `CHEM.vacuumCap = 'vacuum_cap'`, `CHEM.filter = 'filter_bed'` and their `CHEM_CAPACITY_L` rows (`vacuum_cap: 0`,
  `filter_bed: 500`). If Unit 0 shipped a different capacity for `filter_bed`, Unit 8 sets it to 500 (DISTILLERY_PLAN 2 row
  "500 L + 1 slot") and says so in the PR.
- `Capability` union with `'vacuum'` (`src/core/reactions.ts`), `Distillery.vacuumAt: ((x, y, z) => boolean) | null`,
  `Distillery.capabilitiesOf(x, y, z): Capability[]`, `Distillery.offerItem(...)`.
- Fluids `lube_base` ("Lube Base") and `lubricant` ("Lubricant") in `FluidKey`, `DISTILL_FLUIDS`, `GRADES` (both before
  `residue`, `lubricant` first), `CHEM_CONTAINERS` rows `lube_base_canister`, `lubricant_canister` (`canister(...)`, 1000 L,
  empty `empty_canister`), and the two canister items. **The grade mixes Unit 8 relies on** (Unit 0 writes them; if they differ
  the coordinator aligns them to these, because the yields below are computed from them):

  ```ts
  { fluid: 'lubricant', need: { lube_base: 0.9 },  mix: { lube_base: 0.92, diesel: 0.06, bitumen: 0.02 } },
  { fluid: 'lube_base', need: { lube_base: 0.6 },  mix: { lube_base: 0.65, diesel: 0.2, bitumen: 0.15 } },
  // ... then the existing { fluid: 'residue', need: { bitumen: 0.45 }, ... }
  ```
- `SIDE_OBJECTIVES` concatenation in `src/content/objectivesSide.ts`.
- Unit 7's `tankFluids()` (so lubricant flows into tanks); nothing in Unit 8 depends on it, J1 step 4 does.

### 2.3 Contracts with the other units (read these, they are where merges go wrong)

- **Unit 0 (`capabilitiesOf`).** Unit 0 computes capabilities; Unit 8 supplies the *geometry* (where a cap counts) through
  `Rig.vacuum` and the hook value. `capabilitiesOf` returns `'vacuum'` for a flask or vessel iff `rig.vacuum.get(key)` is a cap
  key and `this.vacuumAt?.(cap.x, cap.y, cap.z) === true`. If Unit 0 already scans caps generically (a `rig.caps` map), Unit 8
  uses that map instead of adding `Rig.vacuum` and adds only the placement rule and the `loose_cap` problem. Either way the
  hook is called with the **cap's** cell.
- **Unit 10 (essences).** A `vacuum_cap` directly on a `reaction_vessel` gives that vessel `vacuum`. Reactions that list
  `needs: ['vacuum']` run only while the pump turns; Unit 0's engine pauses them otherwise. Entrainment (`VACUUM_ENTRAIN`) is a
  still-only rule (`stepStill`), it never touches vessels. Unit 10 appends `FILTER_MEDIA.charcoal` and any optional behaviour
  field it needs (for example `clears?`); Unit 8's bed code must iterate the table, never test `=== 'clay'`.
- **Unit 11 (pressure cap, steel flask).** Vacuum and pressure are exclusive by geometry: both caps occupy the one cell on top
  of a still's head condenser or of a vessel. Unit 11 adds `pressure` to `bpFactor` and its own `Rig.pressure` (or the
  generic caps map); the scan rule "a cap counts only on a head condenser or a vessel" is shared and lives in one helper,
  `capTarget(rig, cap)` (see 8, step 3), which Unit 11 calls for `pressure_cap`.
- **Unit 12 (stirrer).** The stirrer and the pump are both workshop consumers on workshop networks; one oiling covers both
  (T2 rule 1). Unit 12 owns `sfxDistill.ts`; Unit 8's two sounds are workshop sounds (`sfxWorkshop.ts`).
- **Unit 9 (asphalt).** The vacuum flask's leftover is ~99% bitumen and is bottled today as `residue` (it meets
  `residue`'s `bitumen >= 0.45`). Unit 9 may add a `bitumen` grade before `residue`; Unit 8's tests assert only that the
  leftover is *not* `lube_base` / `lubricant`, so either naming passes.
- **Unit 6 (rig screen).** Reads `loose_cap`, the bed's medium facts and the cap's pulling state generically from
  `chemView` (`problems[]`, `capabilities`); Unit 8 must put the cap/bed facts into `chemView` and the problem into
  `rig.problems`, nothing in Unit 6's screen.

### 2.4 T4 material web (rows this unit fills)

| item / fluid | producer | consumers |
|---|---|---|
| `lube_base` / `lube_base_canister` (forge, stack 8) | vacuum still on residue at 350 C (`vacuum_residue`) | filter bed -> lubricant (8); workshop oil at the residue rung x1.25 / 600 s (8, `LUBE.lube_base`) |
| `lubricant` / `lubricant_canister` (forge, stack 8) | filter bed of clay on lube base (`polish_lubricant`) | workshop oil x1.5 / 900 s (8, T2); chainsaw bar oil (8); stirrer and pump networks via oil (12, 8); refinery tower start-up (11) |
| `clay` (existing block item) | dug | (new consumer) filter medium, 100 L of catch per clay |
| `vacuum_cap`, `vacuum_pump`, `filter_bed` | furnace forge recipes | modules / parts (end products of the build tree; the cap and bed also serve Unit 10) |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (what exists, quoted)

- **No vacuum anywhere.** `CHEM` in `src/core/distill.ts` has ten kinds (`base ... port`); there is no cap but
  `airlock_cap`. `distillScan.ts` derives `sealed` with the one-line airlock pattern this unit copies:
  `if (m.kind === CHEM.vessel && at(m, 1)?.kind === CHEM.airlock) sealed.add(m.key);`.
- **Boiling points are fixed.** `chem.ts` `pressureAt(c, tempC)`, `bubblePoint(m)` and `vapourShares(m, n, out)` read
  `COMPONENTS[c].bp` directly (lube_base 370, bitumen 520, diesel 280). `Distillery.stepStill` routes cuts with
  `drawIndex(COMPONENTS[c].bp ?? 0, drawTrays)` and colours bands with `bp >= trays[h - 1] && bp < ts + 40`.
- **Setpoints.** `STILL_SETPOINTS = [78, 92, 97, 130, 200, 260, 350, 420]`, `GLASS_MAX_C = 450`. A residue flask at 350 C
  without vacuum boils off only its diesel share; lube base (370) and bitumen (520) stay.
- **Filter bed:** not built (DISTILLERY_PLAN 15 "Left" item 3). `STATEFUL = [CHEM.flask, CHEM.vessel, CHEM.receiver]`.
- **Liquid edges:** `pours(kind, d)` lists condenser, receiver, tube, vessel; `takes(kind, d, from)` lists receiver, tube,
  vessel, flask. `Distillery.flow` moves `min(litres, FLOW_LPS / sqrt(viscosityOf(from.mix)) * dt, roomOf(to))` with `pour`.
- **Oil.** `src/workshop/workshop.ts`:
  `export const LUBE = { residue: { factor: 1.25, s: 600 }, pine_resin: { factor: 1.1, s: 300 } } as const;`. In
  `Workshop.use`, a held `residue_canister` or `pine_resin` on any kinetic part except a crank sets `lube` / `lubeFactor` on every
  `netMembers(key)`, calls `takeHeld(1)` and toasts `` `Oiled: this network carries ${...}% more for ${...} min` ``. Three bugs
  against T2 this unit fixes: (a) the residue canister is eaten, no `empty_canister` comes back; (b) a weaker oil overwrites a
  stronger running one; (c) oil is not saved - `WorkshopSnapshot.lube?` is declared but `toJSON()` never writes it, so a
  reload drops every oiling. `solve()` already takes `lube = Math.max(lube, this.lubeFactor.get(key) ?? 1)` over members and
  passes `capacityFactor: lube` to `solveNetwork`; `describe()` already appends `', oiled'`.
- **Stress.** `BASE_STRESS` in `src/workshop/kinetics.ts` (`mech_pump: 4`, `vacuum_collector: 3`, `mixer: 6` ...), cost
  `BASE_STRESS[kind] x clamp(16/|rpm|, .25, 4)`. `KINETIC` in workshop.ts includes every `PART_DEFS` key not in `NON_KINETIC`.
  `speed` holds signed rpm only for parts on a turning, non-overstressed, non-jammed network.
- **Chainsaw.** `src/game/felling.ts`: `fellTree` computes `affordable = Math.max(1, Math.floor(sawFuel(held) / fuelPerLog))`
  and burns `Math.min(sawFuel(held), logs * fuelPerLog)`; `refuelChainsaw(player)` reads `fuelGrade(held.item)`.
  `Interaction.use` (src/player/interaction.ts) calls it in the "held item, no target action" tail:
  `if (isSawFuel(held.item) && refuelChainsaw(this.player) === 'refuelled')`. Chainsaw tool: `fell: { maxLogs: 48,
  fuelPerLog: 7, canisterFuel: 420 }`, tank 840.
- **Game wiring.** `src/app/game.ts` sets workshop hooks (`this.workshop.generatorWatts = ...`, `this.workshop.standingOn =
  ...`) around line 162; the `vacuumAt` wiring goes there.
- **Recipes.** `recipesDistill.ts` `forge(minTier, output, inputs, minTempC, byproducts?, id?)`, `card(id, station, inputs,
  output, byproducts, setC, timeS, age, rig)`, `RIG_LEGEND` (B F V | C R T J A P). `recipesWorkshop.ts` `forge(output, inputs,
  minTempC)`, for example `forge('vacuum_collector', '2 bronze_plate, 1 bronze_cog, 1 drive_shaft, 1 leather', 600)`.
- **Tests/fixtures.** `src/sim/distillKit.ts` `buildRig(rig, y0?, kit?)`, `feed(card, into)`, `runUntil(r, tempC, done,
  maxS)`, `litresOf(e)`; `src/sim/distillProcess.test.ts` builds every card; `src/workshop/parts.test.ts` `setup()`.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 New blocks, parts and items

| key | display name | kind | age (`ageIndexOf`) | stack | recipe (station, temp) | notes |
|---|---|---|---|---|---|---|
| `vacuum_cap` | Vacuum Cap | chem module block, translucent case like every module | `'bronze'` | 16 | `forge(1, 'vacuum_cap', '1 glass, 1 bronze_ingot, 1 leather', 650)` in `DISTILL_FORGE` `// W0: 2` | active bit = pulling (amber lamp); no `_done` twin |
| `filter_bed` | Filter Bed | stateful chem module (+ `filter_bed_done`, `item: false`, drops `filter_bed`) | `'bronze'` | 16 | `forge(1, 'filter_bed', '2 glass, 1 cloth, 1 copper_ingot', 700)` `// W0: 2` | 500 L; medium slot; four lamp states |
| `vacuum_pump` | Vacuum Pump | workshop part (`PART_DEFS`, `anim: true`) | `'bronze'` (PART_BLOCKS sets `BRONZE`) | 16 | recipesWorkshop `forge('vacuum_pump', '2 bronze_ingot, 2 bronze_cog, 1 drive_shaft, 1 leather', 600)` | `BASE_STRESS.vacuum_pump = 4`; faces `ws_vacuum_pump_front` / `ws_vacuum_pump_front_on` |
| `lube_base_canister` | Lube Base Canister | item (Unit 0 registers; Unit 8 writes the desc) | `'forge'` | 8 | none (filled from a rig) | `CHEM_CONTAINERS` row by Unit 0 |
| `lubricant_canister` | Lubricant Canister | item (Unit 0 registers; Unit 8 writes the desc) | `'forge'` | 8 | none | same |

Why these ages: SYSTEMS T7 gating table puts the vacuum pump (and with it every essence, J2) at Bronze, so the cap that the pump
pulls on and the bed that clears Unit 10's tinctures are Bronze too; the oils are Forge because their feed, residue, comes only
from the Forge crude column. A Bronze player can build the whole vacuum line and use it on potions long before having any
residue. Costs follow SYSTEMS 5.3: Bronze parts 1-4 bronze ingots or cogs plus a belt or leather; glassware 1-3 glass.

Descriptions (ItemSpec / BlockSpec `desc`, game voice, number in it):

- **Vacuum Cap:** "A brass cap with a leather gasket. Set it on a still's top condenser or on a Reaction Vessel and turn a
  Vacuum Pump beside it: everything under it boils at seven tenths of its usual heat."
- **Vacuum Pump:** "A bellows box on the shaft. At 16 rpm or more it pulls the air out of every Vacuum Cap it touches. It
  carries a load of 4 stress units."
- **Filter Bed:** "A glass bed packed with Clay. Liquid dripping in from above leaves below with most of what is not oil
  caught in the clay, so Lube Base comes out as Lubricant. Each Clay catches 100 L; Use Clay on it to load up to 8."
- **Lube Base Canister:** "1000 L of brown Lube Base from a vacuum still. Use it on a shaft part to oil the network like Heavy
  Residue (25% more for 10 min), or run it through a Filter Bed of Clay for Lubricant."
- **Lubricant Canister:** "1000 L of clear Lubricant. Use it on a shaft part: the whole network carries 50% more for 15 min.
  Use it while carrying a Chainsaw: the next 240 logs cost a quarter less fuel."

Textures: the cap and bed get emblem tiles in `src/render/textures/distill.ts` (the module tile function: frame + emblem +
state lamp + rim), drawn in the existing pixel style: the cap a brass dome with a leather ring and a small gauge needle; the bed
a glass case with a tan clay band and a perforated plate. The pump front (`iconsWorkshopParts.ts`) is a bronze box with a
pleated leather bellows and a gauge; the `_on` twin shows the bellows compressed and the needle in the green. The two canister
icons are canister rows in the existing container icon painter: lube base brown `0x7a5a1e`, lubricant clear amber `0xd9a441`
(the `lube_base` component colour is `0x7a5a1e`; the lubricant liquid colour in rigs comes from `colourOf` anyway).

### 4.2 Where the cap counts (the placement rule)

A `vacuum_cap` applies to exactly one *target*:

1. **On a still's head condenser.** The block directly below the cap (face D) is the `head` condenser of some `Still`
   (`still.head === below.key`). Target = that still's flask; the whole stack (flask, segments, side draws, head) is under
   vacuum. This is the legend letter `U` sitting on a `C` at the top of a stack.
2. **On a reaction vessel.** The block directly below is a `reaction_vessel`. Target = that vessel (Unit 10's essences).

Anywhere else (on a flask with no condenser, on a column segment, beside something, on a receiver, floating) the cap does
nothing and the scan adds the problem
`{ code: 'loose_cap', text: 'A Vacuum Cap must sit on the top condenser of a still or on a Reaction Vessel', cells: [cap] }`.

Why the head and not the flask: the vapour path must end in a condenser (problem `no_condenser` otherwise), and a cap on the
very top seals the stack the way the airlock seals a vessel - the one rule players already know ("caps go on top"). A cap on
the flask itself would leave the vapour nowhere to go. Side-draw condensers are inside the sealed stack and keep working.
Only one block fits on top, so a stack can never carry two caps (vacuum and Unit 11's pressure cap are exclusive by
geometry; no extra rule).

### 4.3 The pump and `Workshop.vacuumAt`

- `vacuum_pump` is an ordinary kinetic part: joins networks on all six faces, costs `4 x clamp(16/|rpm|, .25, 4)` su, its
  front animates while turning (the existing ACTIVE-bit mirror, `showActive`).
- It **pulls** while `abs(rpm) >= VACUUM_MIN_RPM` (16). Direction does not matter (a bellows pumps both ways).
- It pulls on every `vacuum_cap` in its six neighbour cells (normally one; two stills side by side may share one pump; the load
  does not change - a cap is a sealed volume, the work is the same).
- `Workshop.vacuumAt(x, y, z)`: the asking cell is the cap. Returns true iff some neighbour cell of (x, y, z) is a part of kind
  `vacuum_pump` whose `speed` entry has `abs >= VACUUM_MIN_RPM`. (`speed` only holds parts of turning, unjammed,
  non-overstressed networks, so overstress and jams drop the vacuum by themselves.)
- No vacuum hose block: SYSTEMS T2's "or tubes to" is dropped here on purpose. A drive shaft run brings rotation anywhere, so
  the pump can always stand beside the cap; a second line type would be a new system for no new play (see 14).

Driving it (all existing sources, numbers from SYSTEMS T2):

| source | rpm at the pump | capacity | pump load | fits? |
|---|---|---|---|---|
| hand crank (Use, `CRANK_S` 2.5 s per press) | 16 | 8 su | 4 su | yes, with 4 su to spare for shafts |
| clockwork motor | 24 | 48 | 4 x 0.667 = 2.67 | yes, 120 s per full wind |
| water wheel 12 rpm + Ratio Dial x2 | 24 | watts / 50 | 2.67 + 0.5 | yes for any working wheel; without the dial: "too slow (12 of 16 rpm)" |
| wind turbine | 16 | watts / 50 | 4 | yes |
| treadwheel (player, or Unit 17 animal) | 12 | 24 | - | too slow without a dial |
| tractor PTO | 24 | 30 | 2.67 | yes |

A run of residue takes ~2.5 min (4.6), which is 60 hand-crank presses - deliberately the point where a player builds a water
wheel or winds a clockwork motor (one wind = 2 min of vacuum). That is the workshop paying for itself.

### 4.4 Vacuum physics in the still

- `bpFactor(caps)`: `caps.includes('vacuum') ? VACUUM_BP_FACTOR : 1` (0.7, SYSTEMS 5.1). Unit 11 adds `pressure`.
- `chem.ts` gains an optional last parameter `pf = 1` on `pressureAt(c, tempC, pf)`, `bubblePoint(m, pf)`,
  `vapourShares(m, n, out, pf)`; inside, `bp` becomes `bp * pf`. Every existing call keeps `pf = 1` (no behaviour change; the
  existing chem tests prove it).
- `Distillery.stepStill` computes `pf = bpFactor(this.capabilitiesOf(flask.x, flask.y, flask.z))` once per step and uses it
  in `bubblePoint`, `vapourShares`, the `route()` call (`drawIndex((COMPONENTS[c].bp ?? 0) * pf, drawTrays)`) and the band
  colour test (`bp * pf`).
- **Sealed and not pulling = no boil.** A still whose head carries a vacuum cap (`rig.vacuum.has(flask)`) but has no `vacuum`
  capability does not boil at all: `flask.state = total > 0 && ts !== null ? 'blocked' : <usual>`. A sealed stack with no
  pump would build pressure; the game shows it as "waiting for the pump" instead of silently running at 1 bar. This is also
  what makes "pump stops mid-run" safe: the run pauses red and resumes when the pump turns, and never toasts a false
  "Distilling run finished".
- **Entrainment.** Under vacuum the flask foams: after the step's vapour moves (`moved` litres), the step also pours
  `min(moved * VACUUM_ENTRAIN, roomOf(headTarget))` litres of the flask's own liquid (`pour(flask.mix, headTarget.mix, l)`,
  all components in proportion) into the target that takes the lightest cut (`targets[last]`). Litres are conserved (it is a
  `pour`). This is the realistic reason a vacuum distillate is never clean enough to be Lubricant, and the reason the Filter
  Bed exists (see the yield table). Entrainment applies only in `stepStill` with `vacuum`.

Worked numbers (pot still, 350 C, vacuum; residue expands to `bitumen 0.6, lube_base 0.3, diesel 0.1`; boiling points under
vacuum diesel 196, lube base 259, bitumen 364). Checked by hand with the doubling rule:

| phase | flask bubble point | what comes over | builder's test tolerance |
|---|---|---|---|
| start | ~229 C | ~96% diesel vapour | first 20 L at the head: diesel share > 0.6 |
| middle | 240-300 C | lube base, the share rising past 0.9 of the vapour | - |
| end | reaches 350 C when ~0.1% lube base is left | stops: flask green "Distilling run finished" | flask lube_base share < 0.02 at the end |

Per 1000 L of residue: ~100 L diesel + ~297 L lube base + ~2 L bitumen as vapour, plus entrained droplets (~12% of ~400 L =
~48 L, mostly bitumen late in the run). The head receiver therefore holds ~445 L at ~68% lube base, ~23% diesel, ~9% bitumen:
named `lube_base` (>= 0.6), not `lubricant` (< 0.9). The flask keeps ~555 L at ~99% bitumen (bottled as `residue` today, see
2.3 Unit 9). A careful player can strip the diesel first at the 260 C notch (under vacuum diesel boils, lube base barely does:
~93 L diesel-grade cut), then switch the receiver and go to 350 C: that cut is ~87% lube base - better, still not Lubricant
because of the foam. Skill pays (a cleaner cut uses less clay), the filter stays the only road to Lubricant (SYSTEMS T3).

### 4.5 The Filter Bed

**Geometry.** Liquid in from **above** only (face U): `takes(filter_bed, d, from)` is true for `d === 1` and `from` any kind
that `pours` (condenser, receiver, tube, vessel). Liquid out **below** only: `pours(filter_bed, d)` is `d === 0`. So the
polishing line is a vertical sandwich: receiver (or the head condenser itself, or a tube) / filter bed / receiver. A bed
never shares levels (it is never both ends of an edge).

**Medium.** One medium kind at a time, as litres of catch:

```ts
export interface FilterMedium {
  item: string;            // the item Used on the bed
  name: string;            // shown in lines: 'Clay'
  keeps: readonly Component[];   // components that pass untouched
  catchShare: number;      // share of every OTHER component caught per pass
  catchLPerItem: number;   // litres of catch one item adds
  maxItems: number;        // most items a bed holds
}
export const FILTER_MEDIA: Readonly<Record<string, FilterMedium>> = {
  clay: { item: 'clay', name: 'Clay', keeps: ['lube_base'], catchShare: 0.85, catchLPerItem: 100, maxItems: 8 },
  // Unit 10 appends charcoal (keeps ethanol, water, ...).
};
export const FILTER_LPS = 10;
```

Entity fields: `medium?: string` (a `FILTER_MEDIA` key, present while loaded or spent), `catchL?: number` (catch left, L),
`caughtL?: number` (litres the medium has soaked up since placed; the conservation ledger).

**Passing.** In `Distillery.flow`, an edge whose `from` is a filter bed goes through `filterPour(bed, to, dt)` instead of
`send`:

1. If `!bed.medium || !(bed.catchL > 0)`: nothing passes (the bed holds its liquid).
2. `rate = min(FILTER_LPS, FLOW_LPS / sqrt(viscosityOf(bed.mix))) * dt`; `l = min(total(bed.mix), rate)`.
3. Take `l` litres proportionally into a scratch `Mix` (`pour(bed.mix, tmp, l)`).
4. `want = sum over c not in keeps of tmp[c] * catchShare`; `k = want > bed.catchL ? bed.catchL / want : 1`; for each such
   c: `caught = take(tmp, c, tmp[c] * catchShare * k)`; `bed.catchL -= caught; bed.caughtL += caught`.
5. If `total(tmp) > roomOf(to)`: pour the excess back into the bed (`pour(tmp, bed.mix, total(tmp) - roomOf(to))`) - this
   can only happen when the receiver below is nearly full; the bed then simply backs up (and the receiver shows "done").
6. `pour(tmp, to.mix, total(tmp))`; mark `arrived` for `to`; `bed.flow`, `bed.ran = true`.

Invariant (tested): `distillery.litres() + sum(bed.caughtL)` is constant. The catch is the one declared loss in the unit, like
a reaction's `gasLoss` in SYSTEMS 6.5: the clay soaks the tar up and is thrown away with it.

**Loading.** Use with a medium item on a bed (via `chemUse`, and `Distillery.offerItem` for arms/golems):
- `room = medium.maxItems * medium.catchLPerItem - catchL`; `n = min(held.count, floor(room / medium.catchLPerItem))`.
- A bed holding a *different* medium with catch left refuses (sentence below). A spent bed (catchL <= 0) accepts any medium:
  the spent one is thrown out.
- `catchL += n * catchLPerItem`, `medium = key`, take `n` items.

**States** (plan 2.1 four-state look, `STATEFUL` gains `CHEM.filter`):

| state | when | lamp |
|---|---|---|
| `idle` | no liquid in it (loaded or not) and it has not run since last empty, or it is waiting on a full receiver below | dark |
| `working` | liquid passed through it this step | amber |
| `done` | it ran, it is now empty of liquid, and catch is left | green |
| `blocked` | more than 1 L of liquid waits in it and there is no medium or the medium is spent | red |

**Throughput and clay use (balance).** 10 L/s means the ~445 L of one residue run passes in ~45 s, faster than the still
makes it (the still is condenser-limited at 10 L/s, `CONDENSE_LPS`), so a bed directly under the head receiver never backs up
the still. Clay per Lubricant canister, from the one-pass distillate: ~1000 L of lubricant needs ~3.1 residue runs and catches
~380 L, so **4 Clay per canister**; from bottled Lube Base canisters (which expand to the poorer grade mix 0.65) it is 6 Clay
and 2 canisters per Lubricant canister. Building the line directly under the still is the efficient way; bottling lube base
first is the flexible way. Both are honest choices.

Result purity: one-pass distillate 68% -> 93-94% (Lubricant); stripped 87% cut -> 97.5%; bottled lube base 65% -> 92.5%.
All >= 0.9, all < 0.6 impossible to mis-name.

### 4.6 The oil ladder (`LUBE`)

| oil key | item Used | display name | factor | seconds | empty returned |
|---|---|---|---|---|---|
| `pine_resin` | `pine_resin` | Pine Resin | 1.10 | 300 | none (eaten) |
| `residue` | `residue_canister` | Heavy Residue | 1.25 | 600 | `empty_canister` |
| `lube_base` | `lube_base_canister` | Lube Base | 1.25 | 600 | `empty_canister` |
| `lubricant` | `lubricant_canister` | Lubricant | 1.50 | 900 | `empty_canister` |

Rules (T2 rule 2, made exact):
- The network's oil is the member entry with the highest factor; ties go to the most seconds left.
- Using oil **O** on a network running oil **R** with `t` seconds left:
  - no R, or `O.factor > R.factor`: every member gets `{ oil: O, s: O.s }`; item used; empty returned; toast "Oiled with ...".
  - `O.factor === R.factor`: members get `{ oil: O, s: max(t, O.s) }`; if `t >= O.s` nothing changes and the item is NOT used
    (refusal "Already oiled as well (Lubricant, 15 min left)"); else used, toast "Oiled with ...".
  - `O.factor < R.factor`: refused, item kept: `` `Already oiled better (${R.name}, ${time(t)} left)` `` - T2's example
    "Already oiled better (Heavy Residue, 6.7 min left)".
- Parts added to an oiled network later share its oil (the solver already takes the max over members). A network cut in two
  keeps the oil on both halves (each member carries its own entry) - a fair, readable rule.
- When the last oiled entry of a turning network runs out, one toast: "The oil has worn off - the network carries its plain
  load again". If that pushes it over capacity, the existing seize toast follows (no new mechanic).
- Oil ticks down whether or not the network turns (oil ages on the gears); simple and matches today's code.
- Oiling on a hand crank stays refused by the existing `part.kind !== 'hand_crank'` rule (the crank is the handle you hold);
  the crank is still oiled as a member when you oil any other part of its network.

Why x1.5 / 900 s is right (SYSTEMS 5, T2 table): one canister of lubricant costs ~3 residue canisters plus 4 clay and a
vacuum run; it lasts 1.5x as long as residue and lifts capacity twice as much (+50% vs +25%). Per residue canister spent it
is roughly even (x1.25/600 s each vs a third of x1.5/900 s) - the reward is not efficiency but *headroom*: +50% is what lets a
one-crank network carry a pump plus a mixer, or a water wheel line take two more stations, which no amount of residue can.

### 4.7 Chainsaw bar oil

- Held `lubricant_canister`, Use with no other action taking it (aimed at air, ground, a non-machine block), with at least one
  chainsaw anywhere in the pack: `oilChainsaw(player)` adds `BAR_OIL_LOGS` (240) to `player.barOilLogs`, uses the canister,
  gives back `empty_canister`, plays `oil_glug` and toasts "Chain oiled: the next 240 logs cost a quarter less fuel".
- Refused when `barOilLogs + 240 > BAR_OIL_MAX` (480): "The chain is still well oiled (300 logs left) - use it up first".
  (Two canisters can be stacked so a long felling trip is one stop; never more, so oil is not hoarded into infinity.)
- No chainsaw in the pack: toast "Use Lubricant on a shaft part, or carry a Chainsaw to oil its chain" (outcome `'no-saw'`).
- Felling: of the `logs` cut, the first `oiled = min(barOilLogs, logs)` cost `fuelPerLog x BAR_OIL_MULT` (7 x 0.75 = 5.25),
  the rest 7. `fuel = Math.ceil(oiled * 5.25 + (logs - oiled) * 7)` (durability stays an integer). `barOilLogs -= oiled`.
  `affordable` accounts for the cheaper oiled logs, so a full tank of 840 fells 160 logs oiled instead of 120.
- When `barOilLogs` reaches 0 during a cut: toast "The chain runs dry - it burns 7 fuel a log again".
- One pool for every saw in the pack (SYSTEMS T10 rule 4): the oil is "on the player", the shared bar oil can.
- Status: Use with a chainsaw held and nothing else to do (aimed at air or a non-log block) toasts `sawStatusText(player)`:
  "Chainsaw - fuel 62%, bar oil 180 logs" or "Chainsaw - fuel 62%, chain dry". Phone-friendly: no tooltip needed.
- Lube Base does **not** oil a chain (it is not refined enough; T4 lists lubricant only). Held lube base aimed at air with a
  saw in the pack: "Lube Base is too rough for a chain - filter it into Lubricant first".

### 4.8 Process cards (Codex, ghosts, solver)

```ts
// RIG_LEGEND additions
U: 'vacuum_cap', X: 'filter_bed', M: 'vacuum_pump',
// PROCESS_CARDS additions (age by ageIndexOf at the call site)
card('vacuum_residue', 'vacuum_cap', '3 residue_canister', '1 lube_base_canister', '1 residue_canister, 1 empty_canister',
  350, 150, ageIndexOf('forge'), 'MU./.CR/.F./.B.'),
card('polish_lubricant', 'filter_bed', '2 lube_base_canister, 6 clay', '1 lubricant_canister', '1 empty_canister',
  0, 140, ageIndexOf('forge'), 'R/X/R'),
```

- `vacuum_residue` rig (top layer first): pump `M` at x0 beside the cap `U` at x1 on the head condenser `C`, receiver `R` at
  x2, flask `F`, base `B` (furnace under it). 3 canisters = 3000 L in the 4000 L flask: ~1335 L at the head (one Lube Base
  canister plus a remainder), ~1665 L of bitumen-rich leftover (one canister bottled as residue today). 150 s: ~1335 L at the
  condenser-limited 10 L/s plus the slow tail.
- `polish_lubricant`: lube base poured into the top receiver, through a bed holding 6 clay, into the bottom receiver: 2000 L
  -> ~1405 L at 92.5%; one canister bottled. `minTempC` 0 = no base needed (the solver's `chemReady` must treat 0 as "no
  furnace setting"; verify it does, else card has no `B` and the solver only needs the blocks owned).
- `rigBlocks` now returns `vacuum_pump` for `M`, so the solver needs a pump owned; `buildRig` in `distillKit.ts` places `M`
  as a plain block (no workshop in the kit) and the kit sets `d.vacuumAt = (x, y, z) => <a neighbour is vacuum_pump>` (a
  pump block beside the cap counts as turning in tests).

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, edge cases, failure messages

### 5.1 The vacuum line

| situation | what happens | what the player sees |
|---|---|---|
| cap on head, pump beside it turning >= 16 rpm | flask has `vacuum`; boils at `bp x0.7`; entrainment on | cap amber; flask line ends `, vacuum`; first time: flag `pulled_vacuum`, sfx `vacuum_hiss` |
| pump stops mid-run (crank released, clockwork wound out, wheel stops) | capability gone next chem step (<= 0.25 s); flask not boiling, state `blocked` | flask and cap: flask red, cap dark; toast once per working->blocked: "Vacuum lost - the run waits for the Vacuum Pump"; the existing `pipe_clunk` on blocked (Unit 12 renames it) |
| pump turns again | boils again, flask `working` | amber again; no toast (state changes are visible; the toast is for the stop) |
| pump too slow (12 rpm water wheel) | no vacuum | pump line: "Vacuum Pump - too slow (12 of 16 rpm)" |
| network overstressed / jammed | `speed` empty for the net, no vacuum | existing seize toast; pump line shows the existing "overstressed a/b su" / "jammed: the gears fight each other" |
| no pump touching the cap | no vacuum, still sealed -> blocked when heated with liquid | cap line "Vacuum Cap - no pump - set a Vacuum Pump beside it" |
| cap misplaced (on a segment, a receiver, a flask without condenser, alone) | ignored; problem `loose_cap` | cap line is the problem sentence; rig screen (6) lists it |
| cap broken mid-run | rescan: the stack is no longer sealed -> boils at 1 bar at whatever the base gives (residue at 350 C: only diesel comes) | lamps follow; no toast (the player did it) |
| vacuum cap on a vessel | vessel has `vacuum` while pulled | reactions (Unit 10) run or pause; vessel line ends `, vacuum` |
| two caps on one pump | both pulled | pump line "pulling on 2 caps" |
| still with cap, base cold / no fuel | nothing boils; state as today (`idle`/`blocked` by today's rules); the cap state is irrelevant | - |
| vacuum + jacketed head | both apply (head 30 C and x3 condensing) | - |
| chunk unloaded | rigs only scan loaded cells (existing); workshop parts in unloaded chunks do not solve; on return everything recomputes | - |
| save / load mid-run | nothing about the vacuum is saved: capability is derived each step from blocks + the workshop's live speed; cranks are not saved (today), so a cranked run reloads paused (red) until cranked; a wound clockwork motor is saved (`wound`) and resumes | as "pump stops" but with no toast on load (announce only on in-play transitions: the state loaded is already `blocked` or is set on the first step; see 8 step 6) |

"Leak": there is no random leak mechanic. A stack is sealed exactly when the cap sits on its head (4.2); breaking any glass of
it breaks the seal by rescan. That is the whole leak rule, and it is visible.

### 5.2 The filter bed

| situation | result | message |
|---|---|---|
| liquid arrives, no medium | held, state `blocked` (red) | bed line "Filter Bed - no Clay, 120 L waiting - Use Clay on it"; toast on becoming blocked: "The Filter Bed has nothing to filter with - Use Clay on it" |
| medium spent mid-batch | stops passing; `blocked` | toast "The Filter Bed's Clay is spent - Use fresh Clay on it"; bed drawn with a dark band |
| receiver below full | backs up; bed `idle` with liquid; receiver below is `done` (green) | bed line "Filter Bed - waiting, the Receiver below is full" |
| nothing below the bed | rig problem `drips_nowhere` (existing code path, extended to beds): "This filter drips onto nothing: set a Receiver or a Glass Tube below it" | - |
| Use Clay, bed has room | loads n clay | toast "Filter Bed: 4 Clay loaded - catches 400 L" |
| Use Clay, bed full | refused, keep item | "The Filter Bed holds all the Clay it takes (8)" |
| Use another medium (Unit 10 charcoal) on a bed with clay catch left | refused | "The Filter Bed still holds Clay (320 L of catch left) - let it run out first" |
| Use any medium on a spent bed | spent medium thrown out, new loaded | same load toast |
| empty canister / beaker on a bed | refused (the bed's liquid is unfiltered) | "Take it from the Receiver below the Filter Bed" |
| full container (a lube base canister) poured on a bed | refused: beds take liquid from above only, and only from glassware | "Pour it into the Receiver above the Filter Bed" |
| bed broken | its liquid is lost with the glass (existing `remove` rule), medium lost | - |
| arm / golem offers clay (`offerItem`) | same as Use: returns n taken | - |
| save / load | `medium`, `catchL`, `caughtL`, `mix`, `state`, `ran` saved in the entity; sanitised (8 step 6) | - |
| liquid that is all `keeps` (pure lube base) | passes with no catch used | - |
| the bed is fed slop / spirit | clay catches 85% of everything but lube base: almost nothing comes out and the clay is spent fast | bed line shows the catch falling; that is the lesson ("clay is for oil") |

### 5.3 Oiling

| situation | result | message |
|---|---|---|
| lubricant canister on a shaft part, unoiled net | x1.5 for 900 s, empty canister back, `oil_glug`, flag `oiled_works` | "Oiled with Lubricant: this network carries 50% more for 15 min" |
| resin / residue on a lubricant net | refused, item kept | "Already oiled better (Lubricant, 12.5 min left)" |
| lubricant on a lubricant net with 300 s left | refreshed to 900, canister used | "Oiled with Lubricant: this network carries 50% more for 15 min" |
| lubricant on a lubricant net with 900 s left (just oiled) | refused, kept | "Already oiled as well (Lubricant, 15 min left)" |
| lube base on a residue net | equal factor: refreshed (if it adds time) | "Oiled with Lube Base: this network carries 25% more for 10 min" |
| canister on a hand crank | refused as today (crank cranks) | no change |
| canister on a non-kinetic part (depot, funnel) | not a kinetic part -> falls through to normal Use | - |
| oil runs out on a turning net | factor back to 1 | "The oil has worn off - the network carries its plain load again" (once per net per expiry tick) |
| save / load | oil kind + seconds per part saved (`oil`) | resumes |
| part relocated by a piston/bearing | its oil entry moves with it (`Workshop.relocate` re-keys the map: add `oil` to the maps it re-keys, like `lube` today) | - |

### 5.4 Chainsaw

| situation | result | message |
|---|---|---|
| lubricant, saw in pack, oil 0 | +240 | "Chain oiled: the next 240 logs cost a quarter less fuel" |
| lubricant, oil 300 | refused | "The chain is still well oiled (300 logs left) - use it up first" |
| lubricant, no saw, aimed at air | refused | "Use Lubricant on a shaft part, or carry a Chainsaw to oil its chain" |
| lubricant aimed at a flask / receiver / vessel | chemistry wins (it is poured in: `chemUse` runs earlier in `Interaction.use`) | existing pour toast |
| lubricant aimed at a shaft part | workshop wins (oils the net) | - |
| felling 12 logs with 5 oil left | 5 x 5.25 + 7 x 7 = 75.25 -> 76 fuel; oil 0 | "The chain runs dry - it burns 7 fuel a log again" |
| saw empty of fuel but oiled | cannot fell (existing) - oil is kept | existing "coughs and dies" toast |
| saw dropped / stored in a chest | oil stays on the player (it is a can in the pack, conceptually) | - |
| player dies | `barOilLogs` kept (like stats; it is not an item that drops) | - |
| old save | `barOilLogs` missing -> 0 | - |

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair / goggles lines (T8 grammar; each <= ~60 characters)

Chem lines come from `chemView(d, x, y, z).text` (no goggles needed: glassware is read with the eye); the pump line from
`Workshop.describe` (goggles, like every workshop part).

| block / state | exact line |
|---|---|
| Vacuum Cap, pulled | `Vacuum Cap - pulling, everything boils at 0.7 heat` |
| Vacuum Cap, pump touching but slow/still | `Vacuum Cap - not pulling - turn the Vacuum Pump at 16 rpm` |
| Vacuum Cap, no pump touching | `Vacuum Cap - no pump - set a Vacuum Pump beside it` |
| Vacuum Cap, misplaced | `Vacuum Cap - put it on a still's top condenser or a vessel` |
| flask under vacuum | today's flask text + `, vacuum` (e.g. `Boiling Flask - 2.8 buckets Heavy Residue, 241 C, boiling, vacuum`) - if the existing line is longer than 60 with it, drop the litres to `2.8 buckets` form only (already the format) |
| flask sealed, waiting | `Boiling Flask - waiting for the Vacuum Pump, 2.8 buckets` |
| Filter Bed, filtering | `Filter Bed - filtering, 120 L in, Clay catches 420 L more` |
| Filter Bed, loaded, empty | `Filter Bed - ready, Clay catches 800 L` |
| Filter Bed, done | `Filter Bed - batch through, Clay catches 380 L more` |
| Filter Bed, no medium | `Filter Bed - no Clay, 120 L waiting - Use Clay on it` (or `Filter Bed - empty, Use Clay on it to load` with no liquid) |
| Filter Bed, spent | `Filter Bed - Clay spent, 120 L waiting - Use fresh Clay` |
| Filter Bed, backed up | `Filter Bed - waiting, the Receiver below is full` |
| Vacuum Pump, pulling | `Vacuum Pump - right 16 rpm, load 4/8 su, pulling on the cap above` (`above` / `below` / `beside` from where the cap is; two caps: `pulling on 2 caps`) |
| Vacuum Pump, too slow | `Vacuum Pump - too slow (12 of 16 rpm)` |
| Vacuum Pump, turning, no cap | `Vacuum Pump - right 16 rpm, load 4/8 su, no cap to pull on` |
| Vacuum Pump, still | `Vacuum Pump - still` (existing wording) |
| any oiled part | existing `, oiled` suffix (unchanged; J1 step 5) |

`chemView` also exposes (for Unit 6's screen, generically): `capabilities` includes `vacuum`; `problems[]` includes
`loose_cap`; for a bed, the facts `medium` name, `catchL`, `caughtL`. The litres format follows T8 (`<n> L` below 1000,
`<x.x> buckets` at or above) via the existing `litresText`.

### 6.2 Toasts (exact strings, all listed in 5)

Kinds: `'good'` for "Oiled with ...", "Chain oiled ...", "Filter Bed: n Clay loaded ..."; `'info'` for refusals and the
status line; `'warn'` (or the existing warning kind, if there is one; else `'info'`) for "Vacuum lost ...", "The oil has worn
off ...", "The Filter Bed's Clay is spent ...". The existing "Distilling run finished" is unchanged and fires when a vacuum run
completes normally.

### 6.3 Screens and phone

- **No new screen.** Everything is Use, a held item, and lines. Loading clay is one tap (loads up to 8 at once); oiling one
  tap; the pump runs from existing sources. This keeps the phone rule (SYSTEMS 1.3): no drag, no long-press.
- **Workshop Guide** (`src/ui/screens/workshop/workshopScreen.ts`, Rules tab): replace the oil rule text with the ladder, one
  row per oil: "Oil a network: Pine Resin +10% for 5 min, Heavy Residue or Lube Base +25% for 10 min, Lubricant +50% for 15
  min. The best oil wins; a weaker one is refused." And a Parts entry for the pump (from its `desc`, automatic if the Parts tab
  iterates `PART_DEFS`; verify).
- **Codex:** the two process cards appear through `RECIPES` with no script change (existing mechanism); Unit 12 places them
  in the distillery branch of `scripts/codex/progression.json`.
- Rig screen (Unit 6): nothing to do here; the screen is generic.

### 6.4 Sounds (T9)

| name | patch | when | volume |
|---|---|---|---|
| `vacuum_hiss` | short filtered-noise exhale falling in pitch, 0.4 s | a cap goes from not pulling to pulling (state change only) at the cap | 0.6 (small) |
| `oil_glug` | three low glugs, 0.5 s | a network or a chain is oiled | 0.6 |

Existing reused: `fuel_add` is NOT reused for the chain (that is the fuel sound); `machine_done` on run finished; the blocked
clunk on vacuum lost and on a spent bed. No loops: the pump makes its sound only through the existing workshop part
animation (silent) - an idle-loud pump would break T9 rule 3. Add both names to the `SfxName` union in
`src/core/gameEvents.ts`, the patches to `src/audio/sfxWorkshop.ts` (create the file and merge it in `src/audio/sfx.ts` if no
other unit has yet; otherwise append), and update the count in `sfx.test.ts`.

### 6.5 Visuals (render, T9 rule 4)

- Cap: amber lamp (active bit) while pulling; dark otherwise. In `distillFx`, while a cap's entity state is `working`, draw up
  to 3 small grey motes per cap rising into the cap every 0.6 s through the existing bubble instancing (counts towards the
  emitter cap of 24; no new draw call).
- Flask under vacuum: bubbles are drawn as today but at 1.5x the rate (foam); purely the existing bubble emitter with a
  multiplier read from the flask's `vacuum` flag in the render hint (add `vac?: boolean` render hint on the entity, like `band`).
- Filter bed: liquid drawn as in a receiver; plus a medium band at the bottom: height `catchL / (maxItems x catchLPerItem)` of
  a quarter block, colour clay `0xb07a4a`, darkening linearly towards `0x3a2c20` as the band shrinks; a spent bed (medium set,
  catchL 0) shows a thin dark band. Drips from bed to receiver use the existing drip emitter on edges.
- Pump: animated front `_on` while turning (existing ACTIVE-bit path).
