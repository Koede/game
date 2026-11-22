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
