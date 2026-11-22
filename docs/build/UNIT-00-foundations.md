# Unit 0 - Foundations (build spec)

Status: design, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Builds FIRST, alone, in Wave 0 (SYSTEMS 6.3).
Owner of: the reaction engine, vessel item slots, rig capabilities, the `CHEM` extension keys, the two oil fluids, the side-goal
mechanism, and the hook signatures every Wave 1 unit codes against (SYSTEMS 6.1, 6.2 first row, 6.5).

**Threads:** T3 (defines `lube_base`, `lubricant`, their grades and canisters; litres conserved through reactions), T7 (defines the
side-goal track), T10 (defines the saved vessel slots and reaction progress), T2 and T5 (hook SHAPES only: `standingOn` doc,
`fluidBlock.draw/fill`, `WorkshopView.moving`, `BlockSpec.surface`), T1 (one heat-draw helper so stills and heated vessels charge
their source the same way), T8 and T9 (vessel crosshair lines and refusals, existing sounds reused; no new sound names).

Words used below: NEW = does not exist in the code today and this unit creates it. Every other identifier was grepped and exists.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Hearthwatt's glass distillery already does one magical thing well: a flask on a still base on the furnace boils, and the vapour
finds its own way up the column to the right condenser. The Reaction Vessel next to it, though, knows exactly one trick - under
an Airlock Cap it turns syrup and water into wash - and that trick is a hand-written `if` in `Distillery.stepVessel`. Three Wave 1/2
units (asphalt, potions, the cracker) each want the vessel to do something new, and one wants it fed by arms and golems.

Unit 0 turns the vessel into what the distillery plan always said it was: **a reactor whose behaviour comes from a table.** A row in
`REACTIONS` says "these liquids, these solids, under these conditions, at this temperature, become those". The vessel reads the
conditions off the blocks around it - a still base under it (heated), an airlock on top (sealed), a cooling jacket touching it
(cooled), a vacuum cap pulled by a pump (vacuum), a pressure cap (pressure), a stirrer on a shaft (stirred), a catalyst bed in its
stack (`catalyst:<item>`) - and runs the first row that fits. Nothing is configured; where a block stands says what it does, the
same rule the column already obeys.

For the player in this unit, almost nothing visible changes - and that is the point. Fermenting works exactly as before (same
rate, same toast "Fermenting done: Sugar Wash", same flag `fermented`). What is new and visible:

- The vessel has **four input slots and four output slots**. Hold a solid a reaction asks for and Use the vessel: the whole held
  stack goes in ("4 Gravel into the Reaction Vessel"). Use with an empty hand: finished solids come out first, then your inputs
  back. On a phone that is two taps, no screen.
- The crosshair line of a vessel says what it is doing and what it lacks, in the T8 grammar:
  `"Reaction Vessel - fermenting, 3.2 buckets Sugar Wash, 20 C"`, `"Reaction Vessel - needs heat (150-250 C)"`.
- The Hearth Log gains a **Side goals** section (empty until Wave 1 fills it) - optional achievements, any order, a tick when done,
  a quiet toast "Side goal: Pave a road".
- Two new fluids exist in the registry - Lube Base and Lubricant - with canisters, ready for Unit 8 to make.

How it should feel when Wave 1 lands on top: a chemistry set that rewards *looking*. You put a jar on the burner and a lid on the
jar, and the jar tells you in one line what it would need to do more.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried, and every cross-unit contract

### 2.1 Threads

| thread | what Unit 0 defines / reads |
|---|---|
| T1 heat | NEW private `Distillery.drawHeat(base, watts)`: the single place a chem module charges its heat source; stills (existing code at `src/sim/distill.ts:307-308`) and heated vessels both call it. Unit 7 extends it for the ground burner. Reads `GLASS_MAX_C`, `baseTemp()`. |
| T2 rotation | `Distillery.stirredAt` hook (null by default; Unit 12 wires); `Workshop.standingOn` doc widened (Unit 17 fills). No stress or rpm logic. |
| T3 fluids | `lube_base`, `lubricant` in `FluidKey`, `DISTILL_FLUIDS`, `GRADES`, `CHEM_CONTAINERS`, items `lube_base_canister`, `lubricant_canister`. Reactions conserve litres exactly (`sum(out) == sum(in)` unless `gasLoss`). |
| T5 bodies | `BlockSpec.surface?` + `BlockDef.surface` + NEW pure helper `surfaceMult(def, mode)`; value 1 everywhere until Unit 9. |
| T6 helpers | `Distillery.offerItem` / `takeItem` (so `logi` can treat a vessel as a container later). |
| T7 knowledge | `SIDE_OBJECTIVES`, `ObjectiveTracker.side()`, event `objective:side`, Hearth Log section. |
| T8 reading | vessel crosshair grammar, refusal sentences (section 6). |
| T9 sound | reuses `machine_done`, `pipe_clunk`, `objective`; adds no `SfxName`. |
| T10 saving | optional `ChemEntity.items/out/rx/ruined/lastRx`; side goals saved in the existing `ObjectivesSnapshot.completed` (no new field, no `SAVE_VERSION` bump). |

### 2.2 Contracts Unit 0 PROVIDES (other units may assume these after it merges)

| contract | exact shape | consumers |
|---|---|---|
| `Capability` type | `'heated' \| 'sealed' \| 'cooled' \| 'vacuum' \| 'pressure' \| 'stirred' \| \`catalyst:${string}\`` in NEW `src/core/reactions.ts` | 6, 8, 9, 10, 11, 12 |
| `ReactionSpec` | SYSTEMS 6.5 verbatim plus OPTIONAL members `verb?`, `done?`, `flag?`, `stopAt?`, `blockAbove?`, `blockText?` (section 7.1) | 5, 9, 10, 11 |
| `REACTIONS` | NEW `src/content/reactionsDistill.ts`: `export const REACTIONS: ReactionSpec[] = [RX_FERMENT_WASH]`; units append rows from their own files (section 7.2) | 5, 9, 10, 11 |
| vessel slots | `ChemEntity.items?: (ItemStack \| null)[]` (4), `ChemEntity.out?: (ItemStack \| null)[]` (4); `VESSEL_SLOTS = 4` | 9, 10, 17 |
| `Distillery.reactions` | instance field, defaults to `REACTIONS` (tests and e2e replace it) | tests |
| `Distillery.capabilitiesOf(x, y, z): Capability[]` | public; works for any module of a rig, meaningful for flasks and vessels | 6, 8, 10, 11 |
| `Distillery.vacuumAt` / `stirredAt` | `((x, y, z) => boolean) \| null`, default null | 8 (vacuum), 12 (stirred) |
| `Distillery.offerItem(x, y, z, item, count): number` | count accepted into input slots | 17 (golems), workshop `logi` (later) |
| `Distillery.takeItem(x, y, z, filter, max): ItemStack \| null` | from output slots | 17, `logi` |
| `CHEM` keys | `vacuumCap: 'vacuum_cap'`, `pressureCap: 'pressure_cap'`, `filter: 'filter_bed'`, `catalyst: 'catalyst_bed'`, `reflux: 'reflux_head'`, `steelFlask: 'steel_flask'` + `CHEM_CAPACITY_L` rows + `STATEFUL` entries | 6, 8, 11 |
| `CHEM_LOOKS`-driven generation | blocks/machines/textures are generated only for kinds with a look row, so a `CHEM` key without a block is legal (section 4.4) | 8, 11 (add their look row + emblem) |
| `BP_MULT` | NEW in `src/core/distill.ts`: `{ vacuum: 0.7, pressure: 1.3 }` (SYSTEMS 5.1) | 8, 11 (stills), Unit 0 (vessel temperature cap) |
| `COOLED_C`, `REACT_HEAT_W` | NEW constants in `src/core/distill.ts` (5 C, 2000 W) | 6 (screen text), 7 (burner draw) |
| side goals | `SIDE_OBJECTIVES` (empty), `ObjectiveTracker.side()`, `'objective:side': { id: string }` | 2, 4, 5, 8, 9, 10, 11, 12, 13, 16, 17 |
| `WorkshopView.moving: MovingView[]` | always `[]` from Unit 0 | 13 |
| `Workshop.fluidBlock.draw?/fill?` | optional methods on the existing object type | 14 |
| `BlockSpec.surface?` / `BlockDef.surface` / `surfaceMult` | `{ walk: number; vehicle: number }`, `null` when unset | 9 |
| `CoolsSpec.returns?` | type only (behaviour is Unit 4's) | 4 |
| `BrewResult.giveCount?` / `consumeCount?` | optional; give/consume more than one in one Use | any chem/brew Use that moves stacks |

### 2.3 Contracts Unit 0 CONSUMES

None from other build units (it builds first). From existing code: `chem.ts` helpers (`pour`, `take`, `add`, `total`, `share`,
`bubblePoint`, `nameOf`, `expand`, `SLOP`), `stackLimit` (`src/game/inventory.ts`), `itemOrNull`, `fluidOrNull` (registry),
`Spills.release` (via a new `DistillHost.release`), `ObjectiveTracker`'s existing condition evaluator, `HearthLogView`.

### 2.4 Journeys this unit makes possible

J1 step 3-4 and 7 (vacuum still, filter bed, asphalt vessel: capabilities `vacuum`, item slots, `gives`), J2 steps 1-4 (drinks and a
glass vial in the slots; `vacuum` and `stirred` capabilities; elixir `gives`), J6 step 2 (`catalyst:catalyst_pellets`,
`pressure`), J4 step 3 (golems carrying to and from a vessel via `offerItem`/`takeItem`). Every side goal named in T7 rides on the
mechanism of section 4.7.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

| file | what is there today | what is missing |
|---|---|---|
| `src/sim/distill.ts` (460 lines) | `ChemEntity` (line 32) with `mix`, `state`, `setC`, `ran`, `recvS`, `flow`, `band`, `tempC`. `Distillery.stepRig` (199) runs stills, then `stepVessel(e, sealed, dt)` (311-335): fermenting hard-coded with `FERMENT_LPS`, `FERMENT_MAX_SUGARS`, `FERMENT_MAX_ETHANOL`, `FERMENT_MIN_C/MAX_C`, temperature fixed at `AMBIENT_TEMP_C`. `announce` (409-419): toast `Fermenting done: <fluid>`, flag `fermented`. `remove` (141) deletes contents silently. Furnace draw `f.extractW += ...` (307-308). | reaction table, vessel temperature, capabilities, slots, item drops on break, heat-draw helper |
| `src/sim/distillScan.ts` | `Rig { modules, stills, edges, sealed, jackets, problems }`; a base only attaches to a flask (line 145). | `heats` (vessel -> base), `cools` (module -> watered jacket), stack/cap walk |
| `src/sim/distillActions.ts` | `chemUse` (34-73): containers pour in / take out, empty hand on base cycles `STILL_SETPOINTS`, otherwise toasts the view; returns null for other items. `chemView` (86-135): vessel words `fermenting / done / too sweet - add water / waiting / open (an Airlock Cap ferments it)` (114). | slot insert/take, generic vessel line |
| `src/core/distill.ts` | `CHEM` (7-18, ten kinds), `STATEFUL` (29), `CHEM_CAPACITY_L` (55-58), fermenting constants (85-90), `CHEM_CONTAINERS` (111-125). | six extension keys, `BP_MULT`, `COOLED_C`, `REACT_HEAT_W`, `VESSEL_SLOTS`, two canisters |
| `src/core/chem.ts` | `Component` already contains `lube_base` and `bitumen` (line 20-21); `GRADES` (181-194) has no lube grades. | grades `lubricant`, `lube_base` |
| `src/content/blocksDistill.ts` | `LOOKS: Record<ChemKind, Look>` (21); `DISTILL_BLOCKS = Object.values(CHEM).flatMap(module)` (83). | adding a `CHEM` key today would force a block (and a TS error on `LOOKS`) |
| `src/content/machinesDistill.ts` | `DISTILL_MACHINES = CHEM_KINDS.map(...)` (28). | same problem |
| `src/render/textures/distill.ts` | `EMBLEMS: Record<ChemKind, ...>` (71); loop `for (const kind of Object.values(CHEM))` (147). | would throw on a kind without an emblem |
| `src/content/fluidsDistill.ts`, `itemsDistill.ts` | 11 fluids, 12 items. | two fluids, two canisters |
| `src/core/types.ts` | `FluidKey` (650-652), `CoolsSpec` (176-180), `BlockSpec` (302), `BlockDef` (390), `ObjectiveSpec` (692). | `surface`, `returns`, fluid keys |
| `src/game/objectives.ts` | `ObjectiveTracker` (85-281): one sequential cursor over `OBJECTIVES`, `completedIds` set saved as `completed`. | side track |
| `src/content/objectives.ts` / `objectivesBrew.ts` | `OBJECTIVES`, `BREW_OBJECTIVES` (incl. `six_cups`, which Unit 2 moves). | `objectivesSide.ts` |
| `src/core/registry.ts` | re-exports `OBJECTIVES` (327); validation loop over objectives (513-525). | `SIDE_OBJECTIVES` export + validation |
| `src/ui/screens/log/hearthLog.ts` | `HearthLogView` with age, goal card, sky, Up next, Done (139-168). | Side goals section |
| `src/ui/gameUI.ts` | `REFRESH_EVENTS` (95-98). | `'objective:side'` |
| `src/core/gameEvents.ts` | `'objective:completed': { id: string }` (209). | `'objective:side'` |
| `src/workshop/workshop.ts` | `WorkshopView { spin, swings, links }` (84), `standingOn` (115), `fluidBlock` (119), `view()` (641). | `moving`, `MovingView`, `draw?/fill?` |
| `src/player/brewTools.ts` | `BrewResult` (17-27) gives and consumes exactly one item; `apply` (99-118). | counts |
| `src/sim/simulation.ts` | `new Distillery(world, bus, { furnaceUnder, flagOnce })` (122-125); machines spill contents with `this.spills.release` (383). | `release` on the distill host |

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 The reaction model (what a reaction IS)

A reaction is **continuous on liquids and discrete on solids**, exactly like today's fermenting:

- Each chemistry step (4 Hz, `CHEM_STEP_HZ`) the vessel converts `rate x dt` litres of its `in` components into `out` components,
  where `rate = batchL / seconds x speed` and `speed` is the product of every `speedUps[cap]` the vessel holds (stirred: 2).
- The amount converted is limited by the scarcest `in` component: `min(rate x dt, min over c of mix[c] / partShare[c])`, where
  `partShare[c] = in[c] / sum(in)`. So a 1 : 1 reaction with 10 L of one input converts at most 20 L.
- Converted litres are tallied in `rx.doneL`. When `doneL` reaches `batchL`, the batch completes: the `items` it lists are taken
  from the input slots and the `gives` are put into the output slots; `doneL` drops by `batchL`; the next batch begins at once if
  everything still holds.
- Litres: `sum(out) == sum(in)` per litre converted (validated at load, section 9), minus `gasLoss` share which simply leaves the
  rig as vapour (the only sanctioned loss; it is recorded in a `Distillery.vented` counter for the conservation test).

Why continuous: the existing fermenting test (`src/sim/distill.test.ts:117`) and the `ferment_wash` process card (110 s) must stay
green to the second; a batch-at-the-end model would delay the wash by up to a batch. Why discrete on solids: `ItemStack` has no
fractional count, and items must never vanish (T4, T10).

**Items must stay present for the whole batch.** A batch that lists `items` starts only when the input slots hold them and pauses
(state `idle`, line says `needs 4 Gravel`) whenever they are removed; they are consumed at completion. So a player cannot take the
gravel back at 99%, and breaking the vessel mid-batch returns every item.

### 4.2 Choosing the reaction

Every step, for a vessel that is not ruined, in `Distillery.reactions` order (fixed order: deterministic, SYSTEMS 6.5 "first
reaction whose inputs, items, caps and window all hold"):

1. **inputs**: every `in` component present at `>= RX_MIN_L` (NEW, 0.001 L); the vessel's `stopAt` limits not yet reached
   (fermenting: ethanol share `< 0.14`);
2. **items**: every `items` entry present in the input slots (counts summed over slots);
3. **needs**: every listed capability held;
4. **blockAbove**: no listed component share above its limit (fermenting: sugars share `> 0.3` -> the reaction is a CANDIDATE that
   is blocked, state `blocked`, line uses `blockText` "too sweet - add water");
5. **window**: vessel temperature within `tempC[0]..tempC[1]` inclusive.

The first row passing 1-5 runs. If the vessel already has `rx` (a batch in progress) and that row still passes, it keeps running
even if an earlier row would now also pass (no batch is abandoned half-done by a reorder). If `rx` exists but its row no longer
passes, the batch pauses and keeps its `doneL` (resumes when it passes again); if the vessel's liquid no longer holds any `in`
component of that row, `rx` is dropped (its `doneL` is forgotten - the liquid it made is already in the mix, so nothing is lost).

If no row runs, the vessel's line explains the **nearest miss**: the first row whose step 1 passes, with the first failing check
among 2-5 (section 6.2 phrases). If no row passes step 1, the line is the plain contents line.

### 4.3 Vessel temperature

Today a vessel is always `AMBIENT_TEMP_C` (20 C). New rule (NEW function `vesselTemp`, private):

```
heatC   = baseTemp(base under the vessel)        // the existing Distillery.baseTemp: min(setC, furnace, GLASS_MAX_C); null when cold
temp    = heatC !== null ? heatC : (cooled ? COOLED_C : AMBIENT_TEMP_C)
if heatC !== null:
    bp  = bubblePoint(mix)                       // null when nothing volatile
    if bp !== null: temp = min(temp, bp x BP_MULT[vacuum|pressure] (1 when neither))
```

- `COOLED_C` = 5 (NEW): a watered jacket on a vessel chills it. A jacketed fermenter therefore pauses ("too cold (5 C), needs
  10-40 C") - deliberate, it is what cold does to yeast, and it keeps `cooled` meaningful for the crystalliser idea (DISTILLERY_PLAN 4).
- The bubble-point cap means a heated vessel never boils (a vessel is a reactor, not a still - it has no vapour path in today's
  scan); the liquid sits at its boiling point. Under vacuum that point is x0.7 (SYSTEMS 5.1): an essence (water-based, bp 100) on a
  base set to 92 C under vacuum holds 70 C, inside the 50-80 window - J2 step 2 works by construction.
- `e.tempC` is written for vessels too (render and crosshair use it; the field already exists and is harmless in a save).

**Heat drawn (T1 rule 4).** While a reaction runs and the vessel is heated, it draws `REACT_HEAT_W` = 2000 W from its source via
`drawHeat(base, REACT_HEAT_W)`. Reasoning: a quarter of a full boil (8 kW at `BOIL_LPS` 20 x `BOIL_J_PER_L` 400) - holding a pot warm
costs far less than boiling it, but it is not free. A heated vessel with nothing reacting draws nothing (T9 rule 3 spirit: idle is
quiet). Unit 7's burner burns fuel at this draw.

### 4.4 Capabilities (computed per step, never saved)

`capabilitiesOf(x, y, z)` for a module `m` in a rig (NEW; also used internally):

| capability | holds when | source |
|---|---|---|
| `heated` | `m` is a flask on a base (`still.base`) or a vessel on a base (`rig.heats`), and `baseTemp(base) !== null` | scan + furnace |
| `sealed` | `rig.sealed.has(m)` (existing rule: airlock cap directly on the vessel) | scan |
| `cooled` | a `cooling_jacket` holding more than 1 L touches `m` on any face (`rig.cools`) | scan + jacket mix |
| `vacuum` | the stack cap of `m` is a `vacuum_cap` AND `vacuumAt?.(cap.x, cap.y, cap.z) === true` | scan + hook (Unit 8) |
| `pressure` | the stack cap of `m` is a `pressure_cap` | scan |
| `stirred` | `stirredAt?.(m.x, m.y, m.z) === true` | hook (Unit 12) |
| `catalyst:<item>` | a `catalyst_bed` in the stack of `m` whose entity's `items?.[0]` is a stack of `<item>` with count > 0 | scan + entity (Unit 11 fills the bed) |

**Stack and cap (NEW scan rule, read-only).** From `m`, walk straight up while the block is a module of kind `column_segment`,
`catalyst_bed`, `reflux_head` or `condenser_coil`; the walked cells are the stack (`catalyst_bed`s found are recorded). The first
cell above that is a `vacuum_cap`, `pressure_cap` or `airlock_cap` module is the **stack cap**. This one rule covers a cap directly
on a vessel, on top of a column, and on top of a head condenser; Unit 8 documents which of those positions it supports for the
vacuum still (J1 step 3 leaves the choice to 8) and Unit 11 the cracker. The walk stops at `MAX_SEGMENTS + 2` cells. It never
changes the still routing (stills keep walking only `column_segment`, `distillScan.ts:148`); Unit 11 widens that.

New `Rig` fields (scan output, derived, never saved):

```ts
heats: Map<string, string>;            // vessel key -> still base key under it
cools: Map<string, string[]>;          // flask/vessel key -> jacket keys touching it
stacks: Map<string, { cells: string[]; catalysts: string[]; cap: string | null }>; // flask/vessel key -> its stack
```

### 4.5 The `CHEM` extension (keys and capacities only)

`src/core/distill.ts` `CHEM` gains, appended after `port` (append, never reorder):

| role | key | `CHEM_CAPACITY_L` | stateful (`_done` twin) | reason for the number |
|---|---|---|---|---|
| `vacuumCap` | `vacuum_cap` | 0 | no | a cap holds nothing (airlock is 0) |
| `pressureCap` | `pressure_cap` | 0 | no | same |
| `filter` | `filter_bed` | 500 | yes | DISTILLERY_PLAN 2 table: "500 L + 1 slot" |
| `catalyst` | `catalyst_bed` | 0 | yes | plan: modifier in the vapour path, holds a slot, no liquid |
| `reflux` | `reflux_head` | 0 | no | plan: "-" buffer; it returns liquid, never holds it |
| `steelFlask` | `steel_flask` | 4000 | yes | same body as `boiling_flask` (4000 L), different shell limit (`STEEL_MAX_C` is Unit 11's) |

`STATEFUL` becomes `[CHEM.flask, CHEM.vessel, CHEM.receiver, CHEM.filter, CHEM.catalyst, CHEM.steelFlask]` (SYSTEMS 4: `filter_bed_done`,
`catalyst_bed_done`, `steel_flask_done`).

**Generation by look row, not by key.** Because `DISTILL_BLOCKS`, `DISTILL_MACHINES` and the chem textures iterate `CHEM` today,
adding a key would create a block with no name, desc or emblem. Unit 0 changes the three generators to iterate only kinds that have
a look:

- `blocksDistill.ts`: `LOOKS` becomes `export const CHEM_LOOKS: Partial<Record<ChemKind, Look>>`; NEW
  `export const BUILT_CHEM_KINDS: readonly ChemKind[] = CHEM_KINDS.filter((k) => CHEM_LOOKS[k] !== undefined)`;
  `DISTILL_BLOCKS = BUILT_CHEM_KINDS.flatMap(module)`.
- `machinesDistill.ts`: `DISTILL_MACHINES = BUILT_CHEM_KINDS.map(...)`.
- `render/textures/distill.ts`: `EMBLEMS` becomes `Partial<Record<ChemKind, ...>>`; the tile loop iterates `CHEM_KINDS` and skips
  kinds with no emblem (`if (!EMBLEMS[kind]) continue;`).

Result: the block list, machine list, texture list and every roster test are byte-identical after Unit 0. Units 8 and 11 add one
`CHEM_LOOKS` row, one `EMBLEMS` entry and one `DESC` row each to make their block appear (append-only; block ids stay stable because
`DISTILL_BLOCKS` is appended last and the new kinds come after `chem_port` in `CHEM_KINDS` order). Unit 6's rig screen iterates
`CHEM`/`CHEM_KINDS` as SYSTEMS 6.2 requires and shows only modules actually present in a scanned rig, so the bodiless keys never
appear on screen.

### 4.6 The two oil fluids

| | `lube_base` | `lubricant` |
|---|---|---|
| `FluidKey` | added to the distillery line of the union | added |
| display name | "Lube Base" | "Lubricant" |
| colour (`FluidSpec.colour`) | `0x681800` (dark oxblood brown; nearest existing fluid colour is 72 RGB units away) | `0xf8f060` (pale clear gold; nearest existing, gasoline `0xffe800`, is 68 away) |
| canister (`FluidSpec.bucket`) | `{ full: 'lube_base_canister', empty: 'empty_canister' }` | `{ full: 'lubricant_canister', empty: 'empty_canister' }` |
| grade need (`GRADES`) | `{ lube_base: 0.6 }` | `{ lube_base: 0.9 }` |
| grade mix (pours in as) | `{ lube_base: 0.65, diesel: 0.2, bitumen: 0.15 }` | `{ lube_base: 0.92, diesel: 0.05, bitumen: 0.03 }` |
| `GRADES` position | both inserted directly BEFORE `residue`, `lubricant` first (best first, SYSTEMS T3) | |
| `CHEM_CONTAINERS` | `lube_base_canister: canister('lube_base')` | `lubricant_canister: canister('lubricant')` |
| hot | false | false |

Each mix meets its own grade and no grade above it (checked by a test). Neither grade is reachable by any existing process: crude
leaves lube base only inside the residue (lube 0.3 of the residue mix), so no existing receiver changes its name; the
`distillProcess.test.ts` cards prove it by staying green.

Items (in `src/content/itemsDistill.ts`, appended after `slop_canister`; category `material`, stack 8 like every canister,
`age: ageIndexOf('forge')` - written by name, not the literal `1` the old `can()` helper uses):

| key | name | desc (final text; Unit 8 makes the promises true) |
|---|---|---|
| `lube_base_canister` | Lube Base Canister | "Brown lube base, split from heavy residue in a vacuum still. A Filter Bed of clay polishes it into lubricant; it oils a shaft as well as heavy residue does." |
| `lubricant_canister` | Lubricant Canister | "Clear golden lubricant, the best oil there is. Use it on a shaft: the whole network carries half again the load for 15 minutes. It also oils a chainsaw's bar." |

T4 rows for both are in SYSTEMS (producer: Unit 8; consumers: filter bed, workshop oil, bar oil, refinery start-up). In Unit 0 they
have no producer yet, so they are added to `SPEC.worldOnlyItems` (`src/content/specRoster.ts:343`) with the comment
`// Unit 0: no producer until Unit 8's vacuum still; Unit 8 removes these two` so "can obtain every item" stays green.

They are NOT given `FUEL_GRADES` rows (not engine fuels) nor burner rows (SYSTEMS T4: "burner fuel? no"). Tanks keep their
hard-coded accept list until Unit 7's `tankFluids()`; `chem_port` accepts them automatically (`PORT_ACCEPTS` spreads `DISTILL_FLUIDS`).

### 4.7 Side goals

- NEW `src/content/objectivesSide.ts`: `export const SIDE_OBJECTIVES: ObjectiveSpec[] = [];` with a header comment telling feature
  files to export `<FEATURE>_SIDE_GOALS: ObjectiveSpec[]` and to append `...<FEATURE>_SIDE_GOALS` here, one line each, in unit order.
- Same `ObjectiveSpec` type; `age` is the age the goal belongs to (by `ageIndexOf`); `reward` optional and follows the existing
  rule (no item from further up the tree; the content test covers both lists).
- Exported through `src/content/index.ts` and re-exported by `src/core/registry.ts` as `SIDE_OBJECTIVES: readonly ObjectiveSpec[]`.
- Registry validation (`registry.ts:513-525`) iterates `[...OBJECTIVES, ...SIDE_OBJECTIVES]` with ONE id set: a side goal may never
  share an id with a main objective.
- Tracking: same conditions, same flags/counters recorded from minute one; never "current"; checked every `CHECK_INTERVAL_S` after
  the main track; complete in any order.
- Completion: id goes into the same `completedIds` set (so it is saved in `completed` with no new save field), rewards like a main
  objective (pending if the pack is full), emits `'objective:side' { id }` (NOT `objective:completed`, so the HUD's big objective
  banner never fires for a side goal), toast `Side goal: <title>` kind `good`, sfx `objective` at volume 0.6 (small tier, T9 rule 2).
- An old save whose recorded flags/counters already meet a side goal completes it on the first check after load, with its toast -
  honest and cheap ("you already did this"). Unit 2's move of `six_cups` lands safely: old saves already list `six_cups` in
  `completed`, so it is never rewarded twice.

### 4.8 Hook signatures (default no-op)

| hook | change | file |
|---|---|---|
| `Workshop.standingOn` | type unchanged `((x, y, z) => boolean) \| null`; doc comment becomes "true when the player OR a harnessed mob (Unit 17) stands in that cell" | `src/workshop/workshop.ts:115` |
| `Workshop.fluidBlock` | object type gains `draw?(x: number, y: number, z: number, fluid: string, L: number): number; fill?(x: number, y: number, z: number, fluid: string, L: number): number;` (litres actually moved) | `workshop.ts:119` |
| `WorkshopView.moving` | NEW `MovingView` interface exported (SYSTEMS 6.5 verbatim); `WorkshopView` gains `moving: MovingView[]`; `view()` returns `moving: []` | `workshop.ts:84, 641` |
| `BlockSpec.surface?` | `{ walk: number; vehicle: number }`; `BlockDef.surface: { walk: number; vehicle: number } \| null`, resolved `spec.surface ?? null` in `resolveBlock` | `types.ts:302, 390`; `registry.ts:84` |
| `surfaceMult` | NEW `src/core/surface.ts`: `export const surfaceMult = (def: BlockDef \| null, mode: 'walk' \| 'vehicle'): number => def?.surface?.[mode] ?? 1;` Unit 0 does not call it; Unit 9 wires physics (`src/player/physics.ts:141`) and the tractor | NEW |
| `CoolsSpec.returns?` | `returns?: string` with doc "handed back into the pack too when it cools (Unit 4)"; no behaviour | `types.ts:176` |

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules

### 5.1 The fermenting row (the one content move)

`RX_FERMENT_WASH` in `src/content/reactionsDistill.ts`, numerically identical to `stepVessel` today:

```ts
export const RX_FERMENT_WASH: ReactionSpec = {
  key: 'rx_ferment_wash', name: 'Fermenting', verb: 'fermenting', done: 'Fermenting done', flag: 'fermented',
  in: { sugars: 1 },
  out: { ethanol: 0.6, water: 0.3, fusel: 0.09, methanol: 0.01 },      // sums to 1: litres conserved
  needs: ['sealed'],
  stopAt: { ethanol: FERMENT_MAX_ETHANOL },                              // 0.14: the yeast gives up -> done
  blockAbove: { sugars: FERMENT_MAX_SUGARS }, blockText: 'too sweet - add water', // 0.3
  tempC: [FERMENT_MIN_C, FERMENT_MAX_C],                                 // 10..40
  batchL: 150, seconds: 100,                                             // 1.5 L/s == FERMENT_LPS
  age: ageIndexOf('ember'),
};
```

The fermenting constants stay in `src/core/distill.ts` (they are read here and by docs). `FERMENT_LPS` stays exported and a
test asserts `RX_FERMENT_WASH.batchL / RX_FERMENT_WASH.seconds === FERMENT_LPS`.

### 5.2 The vessel state machine (per step)

```
total == 0:                       state idle; ran = false; rx = undefined; ruined = false; lastRx kept
ruined:                           state blocked (no reaction runs until the vessel is emptied)
temp > rx.ruinC (running row):    ruin: mix := expand(SLOP, total(mix)); rx = undefined; ruined = true; state blocked;
                                  toast "<name> ruined - too hot (above <ruinC> C)" kind 'warn'; sfx pipe_clunk (from announce)
a row runs (4.2):                 convert; rx = { key, doneL }; ran = true; lastRx = key; state working
    batch completes, gives fit:   items out of input slots, gives into output slots
    batch would complete, gives do NOT fit: doneL held at batchL - RX_MIN_L; state blocked; line "output slots full - take the
                                  finished items out"
a candidate is blocked (blockAbove): state blocked
nothing runs:                     state = ran ? 'done' : 'idle'
```

- `done` keeps today's meaning: "it reacted since it was last empty and nothing more will happen" - the vessel then lets its liquid
  go along its edges (`flow()` line 343 is unchanged: a vessel pours only in state `done`).
- `announce` (generalised): working -> done on a vessel toasts `${rx.done ?? `${rx.name} done`}: ${fluid name}` using `lastRx`
  (fermenting: "Fermenting done: Sugar Wash", unchanged), appends `, ${n} ${Item} in the vessel` for each output stack made in this
  run when there are any (example "Asphalt mix done: Slop, 8 Asphalt in the vessel"), emits `sfx machine_done` pitch 1.4
  (unchanged) and `flagOnce(rx.flag)` when the row has a flag. A vessel `done` with no `lastRx` (old save) toasts "Reaction done".
- Ruin text needs `ruinC`; rows without `ruinC` never ruin.

### 5.3 Item slots

- `VESSEL_SLOTS` = 4 (NEW) input slots `items`, 4 output slots `out`, only on `reaction_vessel` entities (NEW
  `ITEM_SLOT_KINDS: readonly ChemKind[] = [CHEM.vessel]`; Unit 11 may append `steel_flask` if its reactions need it). Arrays are
  created lazily (absent = all empty) so old entities stay untouched until used.
- **Accepted inputs** = NEW `Distillery.slotItems(): ReadonlySet<string>`, the union of every `items[].item` in `this.reactions`
  (recomputed when `reactions` is reassigned; use a setter). Today that set is EMPTY (fermenting lists no items), so Use with any
  solid on a vessel behaves exactly as before (falls through to placing etc.). Chem module block items (`CHEM_KINDS` keys) are never
  accepted even if a reaction lists one, so a player can always place an airlock or cap on a vessel by Use.
- **Insert (player)**: held item in `slotItems()` -> merge into a slot with the same key (up to `stackLimit(item)`), else into the
  first empty slot; the whole held stack goes in if it fits, else what fits. Durability-carrying stacks are refused ("Only plain
  items go into the slots") - reaction ingredients are materials; a durability would be lost in a merge.
- **Take (player, empty hand)**: first non-null `out` slot (whole stack) -> pack; else the LAST non-null `items` slot (whole stack)
  -> pack; else today's behaviour (the view line as a toast). The sim cannot see the pack, so it hands the whole stack over;
  `BrewTools.apply` gives it, and what does not fit is dropped at the player's feet with `player.drop` after the existing
  "Inventory full - no room for ..." toast from `PlayerState.give`. Items never vanish.
- **offerItem(x, y, z, item, count)**: the same insert rules without the player; returns the count accepted (0 when the module is
  not a slotted kind, the item is not accepted, or the slots are full). **takeItem(x, y, z, filter, max)**: from `out` only (helpers
  carry products, never steal inputs); `filter` null = first stack, else the first stack with that key; removes and returns up to
  `max`; null when nothing matches. Both call `touched()`.
- **Breaking** a vessel (or replacing it with another chem kind): `remove()` hands every non-null `items` and `out` stack to the NEW
  host callback `release(x, y, z, stacks)`, which Simulation wires to `this.spills.release` (pack first, then a spill crate, exactly
  like a broken machine at `simulation.ts:383`), skipped while `destroying`. Liquid is lost with the glass as today.

### 5.4 Edge cases

| case | rule |
|---|---|
| save / load mid-batch | `rx` saved with `doneL`; `track()` sanitises (unknown key -> dropped; `doneL` clamped to `[0, batchL)`); the batch resumes. |
| chunk unload | unchanged: `rescan` only sees loaded modules; an unloaded vessel neither ticks nor loses anything. |
| base removed mid-reaction | `heated` lost -> the batch pauses (`doneL` kept); line "needs heat (150-250 C)". |
| vessel moved by a contraption | not possible today (chem blocks are not workshop parts); out of scope. |
| two rows match | first in table order wins (4.2); stable across saves because `rx.key` keeps the running row. |
| liquid flows out of a done vessel into another vessel | the receiving vessel re-evaluates next step; nothing special. |
| full input slots | refusal "The Reaction Vessel's slots are full - take something out with an empty hand". |
| reaction lists an item that is not a registered item | content validation fails (section 9). |
| reaction with `gasLoss` | converted `x (1 - gasLoss)` litres go to `out`; `x gasLoss` added to `Distillery.vented`. |
| `stopAt` reached | the row fails check 1 -> nothing runs -> `done` (fermenting's "yeast gives up"). |
| Peaceful / Dev mode | no difference. |
| multiplayer | none exists; no locking. |

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair line of a vessel (T8; replaces `distillActions.ts:113-117`)

`"Reaction Vessel - <first fact>, <contents>, <temp> C"`; contents `"3.2 buckets Sugar Wash"` / `"250 L Slop"` / `"empty"` via the
existing `litresText` and `fluidName`; temperature integer, no degree sign. First fact by state:

| state | first fact | example (all <= 60 chars) |
|---|---|---|
| working | `rx.verb ?? 'reacting'` + `, <pct>%` of the batch when the row lists items or gives | `Reaction Vessel - fermenting, 3.2 buckets Sugar Wash, 20 C` |
| done | `done` | `Reaction Vessel - done, 4 buckets Sugar Wash, 20 C` |
| blocked (blockAbove) | `rx.blockText` | `Reaction Vessel - too sweet - add water, 1 bucket Syrup` |
| blocked (gives full) | `output slots full - take the finished items out` | (contents dropped to fit) |
| blocked (ruined) | `ruined - pour it out` | `Reaction Vessel - ruined - pour it out, 3 buckets Slop` |
| idle, nearest miss | see 6.2 | `Reaction Vessel - needs heat (150-250 C), 1 bucket Bitumen` |
| idle, sealed, nothing to do | `waiting` (unchanged) | `Reaction Vessel - waiting, empty` |
| idle, not sealed, nothing matches | `open (an Airlock Cap ferments it)` (unchanged words) | |

When slots hold anything, a SECOND goggles-style fact is appended only if it still fits 60 characters: `, holds 4 Gravel` (first input
stack) or `, 8 Asphalt ready` (first output stack). The full slot list is in the toast on empty-hand Use when there is nothing to
take ("Reaction Vessel - in: 4 Gravel, 2 Sand; out: nothing").

### 6.2 Nearest-miss phrases (first failing check)

| check | phrase |
|---|---|
| items | `needs 4 Gravel` (missing count, item name; several -> the first missing) |
| `heated` | `needs heat (<lo>-<hi> C)` |
| `sealed` | `needs an Airlock Cap` |
| `cooled` | `needs a watered Cooling Jacket` |
| `vacuum` (no cap) | `needs a Vacuum Cap` ; (cap but `vacuumAt` false) `the Vacuum Cap is not pulling` |
| `pressure` | `needs a Pressure Cap` |
| `stirred` | `needs stirring (a Chem Stirrer at 16 rpm)` |
| `catalyst:<k>` | `needs a Catalyst Bed of <Item name>` |
| window, too cold | `too cold (<t> C), needs <lo>-<hi> C` |
| window, too hot | `too hot (<t> C), needs <lo>-<hi> C` |

Module names in these phrases are written as the owning unit's display names (SYSTEMS 4: "Vacuum Cap", "Pressure Cap", "Catalyst
Bed", "Chem Stirrer"); the text table lives in NEW `src/sim/reactionText.ts` (pure, tested).

### 6.3 Use results (toasts and refusals)

| action | text |
|---|---|
| insert | `4 Gravel into the Reaction Vessel` |
| insert partial | `3 Gravel into the Reaction Vessel - the slots are full` |
| slots full | `The Reaction Vessel's slots are full - take something out with an empty hand` |
| durability item | `Only plain items go into the slots` |
| take output | `Took 8 Asphalt` |
| take input back | `Took back 4 Gravel` |
| ruin (event) | `Reaction Vessel ruined - too hot (above 80 C)` |
| side goal | `Side goal: Pave a road` |

### 6.4 Hearth Log: Side goals section

- A `section.hw-log__section.hw-log__side` after the Done section: heading `Side goals  <done> / <total>` (same double-space
  pattern as `Done  12 / 61`), then an `ol.hw-log__list.hw-log__list--side`.
- Each goal is one `li.hw-log__item` with `data-state="done"` (existing tick glyph `glyph('check', 12)`, title) or
  `data-state="side"` (title, then `p.hw-log__side-text` with the objective `text`, clamped to 2 lines by CSS
  `-webkit-line-clamp: 2`, and the progress text from `progressOf(condition).text` when non-empty, e.g. `9 / 16`).
- Not-done goals first in list order, then done goals in list order. Hidden entirely (`section.hidden = true`) while
  `SIDE_OBJECTIVES` is empty - so in Unit 0 nothing visible changes.
- Rebuilt when the refresh key changes; the key gains the side completed count: `${current}|${completed}|${age}|${sideDone}`.
  Progress texts of not-done side goals refresh with the existing cheap path only when the log is open (`refresh()` already runs
  then).
- Phone: plain vertical list in the existing scroll container; no new buttons; rows are text-only so no 44 px target applies; at
  390 px the 2-line clamp keeps each row <= 4 lines.

### 6.5 Sounds and visuals

No new sfx. Reused: `machine_done` (pitch 1.4) on a vessel finishing, `pipe_clunk` on entering `blocked` (unchanged; Unit 12 swaps
it for `distill_clunk`), `objective` at volume 0.6 for a side goal. Vessel lamps use the existing four states (amber working, green
done, red blocked). The renderer is not touched; output items are not drawn (Unit 6/12 may draw them later).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types (NEW `src/core/reactions.ts`)

```ts
import type { Component } from './chem';
import type { ItemAmount } from './types';

export type Capability = 'heated' | 'sealed' | 'cooled' | 'vacuum' | 'pressure' | 'stirred' | `catalyst:${string}`;
export const BASE_CAPABILITIES: readonly Capability[] = ['heated', 'sealed', 'cooled', 'vacuum', 'pressure', 'stirred'];

export interface ReactionSpec {
  key: string;                                    // 'rx_<what>'
  name: string;                                   // 'Fermenting'
  in: Partial<Record<Component, number>>;         // parts by volume taken from the Mix
  items?: ItemAmount[];                           // consumed from input slots per batch
  out: Partial<Record<Component, number>>;        // parts put back; sum(out) == sum(in) unless gasLoss
  gasLoss?: number;                               // 0..0.5 share of converted litres vented
  gives?: ItemAmount[];                           // into output slots per completed batch
  needs: Capability[];
  speedUps?: Partial<Record<Capability, number>>; // { stirred: 2 }
  tempC: [number, number];                        // inclusive window
  ruinC?: number;                                 // above: the vessel's mix turns to slop
  batchL: number;                                 // litres of `in` per batch (SYSTEMS 5.2: 250-1000 for new rows)
  seconds: number;                                // base seconds per batch (30-120 for new rows)
  age: number;                                    // ageIndexOf('<name>') at the call site
  // OPTIONAL members added by Unit 0 (SYSTEMS 6.5 allows optional additions):
  verb?: string;                                  // crosshair word while working, 'fermenting'
  done?: string;                                  // toast head when the run ends, 'Fermenting done'
  flag?: string;                                  // flagOnce when a run ends, 'fermented'
  stopAt?: Partial<Record<Component, number>>;    // the row cannot run once a share reaches this (ends the run: done)
  blockAbove?: Partial<Record<Component, number>>;// a share above this blocks the row (red lamp)
  blockText?: string;                             // the crosshair fact for blockAbove
}

/** Pure helpers (tested without a world). */
export function partsTotal(parts: Partial<Record<Component, number>>): number;
export function validateReaction(r: ReactionSpec, knownItem: (k: string) => boolean): string[]; // problems, [] when fine
```

Note `age: number` (an index from `ageIndexOf`) rather than SYSTEMS' sketched `AgeName`: every other spec in the code
(`ItemSpec.age`, `ObjectiveSpec.age`) stores the index, and the sketch's own comment says "ageIndexOf at the call site". See
coordinator note 3.

`batchL` / `seconds` ranges in SYSTEMS 5.2 apply to new rows; `rx_ferment_wash` keeps 150 L / 100 s to stay identical to today.

### 7.2 Content file

```ts
// src/content/reactionsDistill.ts (NEW)
export const RX_FERMENT_WASH: ReactionSpec = { /* 5.1 */ };
/** Every reaction, in priority order. Units append: ...ASPHALT_REACTIONS (9), ...POTION_REACTIONS (10), ...CRACK_REACTIONS (11). */
export const REACTIONS: ReactionSpec[] = [RX_FERMENT_WASH];
```

Feature units export their rows from their own content files and add one spread line here (append order = priority; a unit that
needs priority over another says so in its spec).

### 7.3 Entity fields (`ChemEntity`, all optional, plain JSON in the world entity list)

```ts
items?: (ItemStack | null)[];     // input slots, length VESSEL_SLOTS when present
out?: (ItemStack | null)[];       // output slots
rx?: { key: string; doneL: number };
ruined?: boolean;
lastRx?: string;                  // key of the row that ran last (done toast, crosshair 'done' line)
```

Sanitising in `track()` (NEW helper `cleanSlots(v: unknown): (ItemStack | null)[] | undefined`): not an array -> undefined;
otherwise exactly `VESSEL_SLOTS` entries, each `null` unless it is `{ item: string known to itemOrNull, count: integer 1..stackLimit }`
(durability dropped). `rx`: kept only if `key` names a row in `this.reactions`, `doneL` finite, clamped `[0, batchL)`. `ruined`:
`=== true`. `lastRx`: string or dropped. A field on a non-slotted kind is deleted.

Old saves: entities without the fields load as before (absent = empty / no batch). No `SAVE_VERSION` change (T10 rule 3).

### 7.4 Objectives save

`ObjectivesSnapshot.completed` holds main and side ids together; `ObjectiveTracker.completed` keeps filtering `OBJECTIVES`, so the
main Done count is unchanged. `load()` keeps unknown ids (a side goal of a later build survives a round trip through this one).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; `npm test` green after each step)

1. **Types and constants.**
   - NEW `src/core/reactions.ts` (7.1) with `partsTotal`, `validateReaction` (checks: `partsTotal(in) > 0`;
     `|partsTotal(out) - partsTotal(in) x (1 - (gasLoss ?? 0))| < 1e-9`; window ordered; `batchL > 0`, `seconds > 0`; every item key
     known; every `speedUps` value >= 1; `gasLoss` in [0, 0.5]).
   - `src/core/distill.ts`: append the six `CHEM` keys and their `CHEM_CAPACITY_L` rows; extend `STATEFUL`; add
     `BP_MULT = { vacuum: 0.7, pressure: 1.3 } as const`, `COOLED_C = 5`, `REACT_HEAT_W = 2000`, `VESSEL_SLOTS = 4`, `RX_MIN_L = 0.001`,
     `ITEM_SLOT_KINDS`; add the two `CHEM_CONTAINERS` rows.
   - `src/content/blocksDistill.ts`, `machinesDistill.ts`, `src/render/textures/distill.ts`: switch to `CHEM_LOOKS` /
     `BUILT_CHEM_KINDS` / skip-missing-emblem (4.5).
   - `src/core/types.ts`: `FluidKey` += `'lube_base' | 'lubricant'`; `BlockSpec.surface?`; `BlockDef.surface`; `CoolsSpec.returns?`.
   - `src/core/registry.ts` `resolveBlock`: `surface: spec.surface ?? null`. NEW `src/core/surface.ts` (`surfaceMult`).
2. **Fluids and items.** `src/core/chem.ts` `GRADES` (two rows before `residue`); `src/content/fluidsDistill.ts` two rows (after
   `residue`, before `slop`); `src/content/itemsDistill.ts` two items; `src/content/specRosterDistill.ts` items list += both;
   `specRoster.ts` `worldOnlyItems` += both.
   `techContent.test.ts` requires every pair of fluid colours to be more than 60 apart in RGB (line 33); both colours above were
   checked against all 16 existing fluid colours (min 72 and 68) and against each other (far apart). Also extend the tech roster's
   two distillery fluid lists (`specRosterTech.ts:64-65`) and its fluid table (line 87 pattern:
   `lube_base: ['Lube Base', false, false, null, 'lube_base_canister']`, `lubricant: ['Lubricant', false, false, null, 'lubricant_canister']`).
3. **Scan.** `src/sim/distillScan.ts`: build `heats`, `cools`, `stacks` (4.4) after the existing modifier loop; no change to stills,
   edges or problems.
4. **Engine.** `src/sim/distill.ts`:
   - fields `reactions` (getter/setter recomputing `slotItems`), `vacuumAt = null`, `stirredAt = null`, `vented = 0`;
   - `DistillHost` gains `release?(x: number, y: number, z: number, stacks: ItemStack[]): void`;
   - `capabilitiesOf(x, y, z): Capability[]` (public) and private `capsOf(rig, key): Set<Capability>`;
   - private `drawHeat(base: ChemEntity, watts: number): void` (furnace under base: `extractW += watts`); `stepStill` uses it
     (`drawHeat(base!, (moved / dt) * BOIL_J_PER_L)` replacing lines 307-308);
   - private `vesselTemp(v, rig, caps): number` (4.3);
   - replace `stepVessel(e, sealed, dt)` with `stepVessel(v: ChemEntity, rig: Rig, dt: number)` implementing 4.1-4.2 and 5.2, via
     pure NEW `src/sim/reactionStep.ts`:
     ```ts
     export interface RxContext { caps: ReadonlySet<Capability>; tempC: number; items: readonly (ItemStack | null)[]; }
     export type RxPick = { r: ReactionSpec; ok: true } | { r: ReactionSpec; ok: false; miss: RxMiss } | null;
     export type RxMiss = { kind: 'items'; item: string; missing: number } | { kind: 'cap'; cap: Capability }
       | { kind: 'cold' | 'hot'; tempC: number; lo: number; hi: number } | { kind: 'blocked'; text: string };
     export function pickReaction(list: readonly ReactionSpec[], mix: Mix, ctx: RxContext, running: string | null): RxPick;
     export function convert(mix: Mix, r: ReactionSpec, litres: number): { converted: number; vented: number }; // conserving
     export function rateOf(r: ReactionSpec, caps: ReadonlySet<Capability>): number; // L/s
     ```
   - slot helpers (NEW, in NEW `src/sim/chemSlots.ts`, pure over arrays): `countIn(slots, item)`, `insert(slots, item, count): number`,
     `removeItems(slots, amounts): boolean`, `fits(slots, amounts): boolean`, `addItems(slots, amounts): void`,
     `takeFirst(slots, filter, max): ItemStack | null`, `takeLast(slots): ItemStack | null`;
   - `offerItem`, `takeItem` (5.3); `remove()` releases stacks through `host.release`;
   - `track()` sanitising (7.3); `announce()` generalised (5.2).
5. **Actions.** `src/sim/distillActions.ts`: `ChemResult` ok-branch gains `giveCount?: number; consumeCount?: number`; `chemUse`
   adds slot insert (after the container branches, before `return null`) and empty-hand take on slotted kinds (before the view
   toast); `chemView` vessel case uses `src/sim/reactionText.ts` (NEW: `vesselFact(state, pick, ...)`, `missText(miss)`).
   `src/player/brewTools.ts`: `BrewResult` ok-branch gains the same two fields; `apply` consumes `r.consumeCount ?? 1`; when
   `r.giveCount > 1` call `player.give(item, giveCount)` and `player.drop(item, left)` for any leftover.
6. **Simulation wiring.** `src/sim/simulation.ts:122`: host `release: (x, y, z, stacks) => { if (!this.destroying) this.spills.release(x, y, z, stacks); }`.
   `vacuumAt` / `stirredAt` stay null (Units 8/12 assign them where Game builds the workshop).
7. **Side goals.** NEW `src/content/objectivesSide.ts`; `src/content/index.ts` export; `src/core/registry.ts` export + validation;
   `src/core/gameEvents.ts` `'objective:side': { id: string }`; `src/game/objectives.ts`: constructor gains 4th parameter
   `private readonly sideSpecs: readonly ObjectiveSpec[] = SIDE_OBJECTIVES`, method `side(): { spec: ObjectiveSpec; done: boolean }[]`,
   private `completeSide(spec)`, `check()` loops side specs after the main loop; `src/ui/screens/log/hearthLog.ts` section (6.4) +
   CSS in `src/ui/styles.css` next to `.hw-log__item` (line 2596): `.hw-log__side-text { font-size: max(11px, 0.8em); opacity: .8;
   display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }`; `src/ui/gameUI.ts`
   `REFRESH_EVENTS` += `'objective:side'`.
8. **Workshop hook shapes.** `src/workshop/workshop.ts`: `MovingView`, `WorkshopView.moving`, `view()` returns `moving: []`,
   `fluidBlock` type, `standingOn` doc. Fix any object literal typed `WorkshopView` in tests/renderers (`moving: []`).
9. **Docs** (section 11), then e2e (section 10).

Reuse, do not duplicate: `pour`/`take`/`add`/`total`/`share`/`bubblePoint`/`expand` (chem.ts), `baseTemp` (distill.ts), `litresText`
and `fluidName` (distillActions.ts), `stackLimit` (game/inventory.ts), `Spills.release`, `ObjectiveTracker.progressOf`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests

All co-located vitest files; fixtures `buildRig`, `feed`, `runUntil`, `litresOf` (`src/sim/distillKit.ts`), `makeKit`
(`src/sim/testKit.ts`).

**NEW `src/core/reactions.test.ts`**
- `validateReaction accepts rx_ferment_wash` -> `[]`.
- `validateReaction refuses a row whose out does not sum to in` -> one problem mentioning the key.
- `validateReaction allows gasLoss and checks the reduced sum`.
- `every row of REACTIONS validates against the registry` (`knownItem = (k) => itemOrNull(k) !== null`) and keys are unique and
  start with `rx_`.
- `rx_ferment_wash runs at FERMENT_LPS` (`batchL / seconds === FERMENT_LPS`).

**NEW `src/sim/reactionStep.test.ts`** (pure)
- `picks the first row whose inputs, items, needs and window hold`.
- `keeps the running row even when an earlier row now also matches`.
- `reports the first failing check as the nearest miss` (items -> cap -> cold/hot, one case each).
- `convert conserves litres` - fuzz 500 random mixes x random rows with random `in/out` summing equal: `total(after) + vented ===
  total(before)` to 1e-9, no negative or NaN component.
- `convert is limited by the scarcest input`.
- `rateOf multiplies speedUps of held capabilities only` (stirred 2 held -> x2; not held -> x1).

**NEW `src/sim/chemSlots.test.ts`**
- `insert merges into a same-key stack up to stackLimit, then fills empty slots, returns what it took`.
- `removeItems takes counts across slots or nothing at all`.
- `takeFirst filters by key and caps at max`; `takeLast returns the last non-null stack`.
- `items never vanish`: random insert/take sequences keep `sum(in slots) + sum(taken) === sum(inserted)`.

**`src/sim/distill.test.ts` (extend)**
- existing `ferments syrup and water under an airlock, refuses syrup alone, and lets the wash go when done` stays unchanged and green.
- `a fake reaction runs with each capability` - for each of `heated`, `sealed`, `cooled`, `vacuum`, `pressure`, `stirred`,
  `catalyst:flint`: set `kit.sim.distill.reactions = [fake(cap)]` (fake: `in {water:1}`, `out {water:0.5, ethanol:0.5}`,
  window `[0, 450]`), build the rig that provides it (vessel on a base on a furnace at 120 C; airlock; watered jacket; a cap module
  and hook - the cap/bed blocks do not exist yet, so the test registers nothing and instead stubs `vacuumAt`/`stirredAt` and, for
  `pressure`/`catalyst`, asserts through `pickReaction` with an injected capability set), run 30 s, assert ethanol appeared; then
  remove the provider and assert it stops (state not `working`).
- `capabilitiesOf a vessel on a hot base includes heated, and loses it when the furnace goes cold`.
- `a heated vessel holds at the bubble point and never above the base` (water on a base set 130 C -> 100 C; with `vacuumAt` hook
  irrelevant here).
- `a jacketed vessel sits at COOLED_C and fermenting pauses, too cold` (line contains `too cold (5 C), needs 10-40 C`).
- `a heated reaction draws REACT_HEAT_W from the furnace only while working` (`furnace.extractW` delta).
- `items in the slots are consumed at batch end and gives land in out` (fake row with `items [{sand,2}]`, `gives [{flint,1}]`,
  `batchL 250`, `seconds 5`).
- `a batch pauses when its items are taken out and resumes with doneL kept`.
- `full output slots block the vessel before the batch completes` (state `blocked`, `rx.doneL < batchL`).
- `ruinC turns the mix to slop, blocks until emptied, conserving litres`.
- `breaking a vessel releases its slots through host.release` (spy) and `litres()` drops by exactly its mix.
- `save round-trip of vessel slots and rx` - `JSON.parse(JSON.stringify(entity))`, `clear()`, `track()`: slots, `rx.doneL` equal;
  continue 10 s and compare with an un-saved twin (equal mixes to 1e-9).
- `an old vessel entity without slots loads and ferments as before`.
- `track sanitises bad slots and unknown rx keys` (count 0, unknown item, `rx.key: 'rx_gone'`, `doneL: NaN`).
- `offerItem accepts only reaction items and takeItem only takes outputs`.
- `conservation fuzz with reactions` - extend the existing fuzz style: 200 random rigs with a vessel, random fake rows, 2000 steps:
  `litres() + vented` constant to 1e-6, no NaN, block states match entity states.

**`src/sim/distillScan.test.ts`** (create if absent, else extend): `heats maps a vessel to the base under it`, `cools lists watered
and unwatered jackets` (the capability check filters water), `the stack walk passes segments and a head condenser and finds the cap
above` (uses an airlock module as the cap since it exists).

**`src/sim/distillActions` tests** (in `distill.test.ts` or NEW `src/sim/distillActions.test.ts`)
- `Use with an accepted item puts the whole stack into the slots` (`consumeCount` 4, toast `4 Sand into the Reaction Vessel`).
- `Use with an item no reaction asks for returns null` (placing still works).
- `Use with a chem module item is never taken into the slots`.
- `empty hand takes outputs first, then inputs back, then shows the line`.
- `the vessel line follows T8` - every produced line matches `/^Reaction Vessel - [a-z]/` and is <= 60 chars for contents < 10
  buckets.

**`src/game/objectives.test.ts` (extend)**
- `side goal completes out of order` - tracker with `sideSpecs = [flagGoal('side_a', 'flag_a'), flagGoal('side_b', 'flag_b')]`;
  emit `flag_b` -> `side()` shows b done, a not; `objective:side` emitted once with `side_b`; toast `Side goal: <title>`; the main
  `current` unchanged.
- `side goals never become current and never emit objective:completed`.
- `side goal rewards go to pendingRewards when the pack is full`.
- `side completions round-trip through toJSON/load without re-announcing`.
- `an old snapshot without side ids loads; a side goal already met completes on the next check`.

**`src/content/content.test.ts` (extend)**
- `side goal ids are unique and disjoint from OBJECTIVES` (empty list passes).
- `side goal rewards come from their own age or earlier` (same rule as the main list; reuse its helper).
- `the lube grades meet their own need and no grade above them`.
- roster: `specRosterDistill.ts` items list includes `lube_base_canister`, `lubricant_canister`; tech roster fluids include
  `lube_base`, `lubricant`; block and machine rosters unchanged (proves 4.5).

**`src/core/chem.test.ts` (extend)**: `nameOf names a 0.95 lube_base mix lubricant and a 0.7 mix lube_base`;
`expand('lubricant', 1000) totals 1000`.

**`src/core/core.test.ts` / registry**: `surfaceMult is 1 for every block today`; `every block resolves surface null`.

**`src/audio/sfx.test.ts`**: unchanged count (no new sound).

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E

Extend `scripts/e2e-distill.mjs` (it already builds rigs through `window.__hw`, uses `d.selectItem`, `d.selectEmptyHand`,
`tapTimes`, `mod`, `fastForward`, `view`). Add after the existing steps:

```js
await step('a reaction vessel takes a solid into its slots and hands back what it made', async () => {
  const V = { x: P.pot.base.x + 3, y: P.pot.base.y, z: P.pot.base.z };
  // set-up only (window.__hw): clear the cell, stand a vessel on stone, register one test reaction
  await d.hw((p) => {
    const hw = window.__hw; const sim = hw.app.game.state.sim;
    hw.setVoxel(p.x, p.y - 1, p.z, 'stone');
    hw.setVoxel(p.x, p.y + 1, p.z, 'air');
    hw.setVoxel(p.x, p.y, p.z, 'reaction_vessel');
    sim.distill.reactions = [...sim.distill.reactions, {
      key: 'rx_e2e', name: 'Test mix', verb: 'mixing', in: { water: 1 }, out: { water: 1 },
      items: [{ item: 'sand', count: 2 }], gives: [{ item: 'flint', count: 1 }],
      needs: [], tempC: [0, 100], batchL: 250, seconds: 5, age: 0 }];
    hw.give('water_pail', 1); hw.give('sand', 4);
  }, V);
  await d.selectItem('water_pail'); await tapTimes(V, 1);       // real input: pour 1000 L of water
  await d.selectItem('sand'); await tapTimes(V, 1);             // real input: the whole stack into the slots
  const slots = await d.hw((p) => window.__hw.app.game.state.sim.distill.entityAt(p.x, p.y, p.z)?.items ?? [], V);
  assert(slots.some((s) => s && s.item === 'sand' && s.count === 4), `slots ${JSON.stringify(slots)}`);
  await fastForward((p) => (window.__hw.app.game.state.sim.distill.entityAt(p.x, p.y, p.z)?.out ?? []).some((s) => s && s.item === 'flint'), V, 'a flint in the output slots', 30);
  await view('9-vessel-slots');
  const count = () => d.hw(() => window.__hw.app.game.state.player.inventory.count('flint'));
  const before = await count();
  await d.selectEmptyHand(); await tapTimes(V, 1);              // real input: take the output
  assert((await count()) > before, 'the flint came out of the vessel into the pack');
});
```

Helpers used are the script's own (`d.hw(fn, arg)` from `scripts/lib/e2eDriver.mjs`, `tapTimes`, `fastForward`, `view`, `P`)
and existing debug API (`setVoxel`, `give`); no new debug API is needed. Real input does the pouring, inserting and taking.
The existing fermenting / pot-still steps must still pass unchanged (the regression guard for the engine move).
Screenshot `test-results/e2e-distill/9-vessel-slots.png`.

Run: `node scripts/e2e-distill.mjs --device=desktop` (no `HW_GPU`). The Hearth Log change is invisible while `SIDE_OBJECTIVES` is
empty, so no phone run is required by Unit 0; Unit 2 (first side goal) adds the `--device=phonePortrait` log check.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update

- `docs/api/distillery.md`: new sections "Reactions" (ReactionSpec, table order, continuous/discrete rule, temperature, heat draw,
  ruin), "Capabilities" (table 4.4, stack/cap walk), "Item slots" (Use rules, offerItem/takeItem, break release), "Extension kinds"
  (the six `CHEM` keys, `CHEM_LOOKS`/`BUILT_CHEM_KINDS`, how a unit adds a module), fluids table += Lube Base / Lubricant with final
  colours, constants `BP_MULT`, `COOLED_C`, `REACT_HEAT_W`, `VESSEL_SLOTS`.
- `docs/api/game.md` (objectives part): side goals, `side()`, `objective:side`, save in `completed`.
- `docs/api/hud.md` or the doc that covers the log screen: the Side goals section.
- `docs/api/workshop.md`: `MovingView`, `WorkshopView.moving`, `fluidBlock.draw/fill`, `standingOn` meaning.
- `docs/api/content.md`: `BlockSpec.surface`, `CoolsSpec.returns`, `surfaceMult`, `objectivesSide.ts`, `reactionsDistill.ts`.
- `docs/api/brewing.md` (BrewResult): `giveCount`, `consumeCount`.
- Never `docs/WHATS_LEFT.md` (coordinator) and never `docs/build/SYSTEMS.md`.

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `npm test` green; every pre-existing test unchanged and passing (fermenting, process cards, rosters, progression, gates).
- [ ] `REACTIONS` exists with exactly `rx_ferment_wash`; `stepVessel` contains no fermenting constants.
- [ ] Fermenting a 1000 L syrup + 1000 L water vessel gives the same mix (to 1e-6) after 110 s as before the change (golden test
      recorded from the pre-change code in the same PR).
- [ ] `capabilitiesOf` returns each of the seven capability kinds under its condition (test per kind).
- [ ] Vessel temperature: 20 C bare, 5 C jacketed, base temp capped at bubble point (x0.7 / x1.3 with vacuum / pressure) when heated.
- [ ] Heated reactions draw 2000 W; idle heated vessels draw 0 W.
- [ ] Use with an accepted solid moves the whole stack into the slots; empty hand takes outputs, then inputs; leftovers dropped, never lost.
- [ ] Breaking a vessel returns every slot item (pack, then spill crate).
- [ ] Slots and `rx` survive save/load; old entities load unchanged; corrupt fields sanitised.
- [ ] Litres conserved across 200 random reaction rigs x 2000 steps (vented counted).
- [ ] Six new `CHEM` keys exist; block, machine and texture lists unchanged; a kind without `CHEM_LOOKS` produces no block.
- [ ] `lube_base`, `lubricant` registered (FluidKey, fluid spec, grades before residue, canisters, items, rosters, worldOnlyItems).
- [ ] `SIDE_OBJECTIVES` empty and exported; a test goal completes out of order with toast `Side goal: <title>` and `objective:side`;
      the main track is unaffected; the Hearth Log section is hidden when empty and renders with a test list (unit test of the view).
- [ ] `WorkshopView.moving` is `[]`; `fluidBlock.draw?/fill?`, `BlockSpec.surface?`, `CoolsSpec.returns?` type-check; `surfaceMult` returns 1.
- [ ] `node scripts/e2e-distill.mjs --device=desktop` passes including step "a reaction vessel takes a solid into its slots and hands back what it made".
- [ ] Docs in section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope / deferred

- Any real new reaction (asphalt 9, essences/tinctures/elixirs 10, cracking 11), sugar into vessels (5).
- Blocks, textures and behaviour of `vacuum_cap`, `pressure_cap`, `filter_bed`, `catalyst_bed`, `reflux_head`, `steel_flask` (8, 11);
  `STEEL_MAX_C`, new `STILL_SETPOINTS` (11). Applying `BP_MULT` to STILLS (8, 11).
- Wiring `vacuumAt` (8) and `stirredAt` (12); `distill:step` event (12); `distill_clunk` and other distillery sounds (12).
- Wiring `offerItem`/`takeItem` into the workshop `logi` for arms/deployers (first done by Unit 17 for golems; arms may follow in the
  same change if trivial - Unit 17 decides and documents).
- Physics/tractor reading `surface` (9); `MovingView` filling and tween rendering (13); `fluidBlock.draw/fill` implementation (14);
  harnessed mobs in `standingOn` (17); `cools.returns` behaviour (4).
- Moving `six_cups` into side goals (2); any side goal content (owner units).
- Rig screen showing capabilities (6); drawing slot items inside the vessel (6/12).
- A vessel that boils (vapour out of a heated vessel, DISTILLERY_PLAN 3 table "U (only if heated)") - not needed by any unit of
  this build; stills remain the only boilers.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **`CHEM` keys force blocks today.** SYSTEMS 6.1.3 says Unit 0 adds the six keys "only" and owning units add the block specs, but
   `DISTILL_BLOCKS`, `DISTILL_MACHINES` and the chem texture loop are generated from `CHEM` itself (`blocksDistill.ts:83`,
   `machinesDistill.ts:28`, `render/textures/distill.ts:147`), and `LOOKS`/`EMBLEMS` are `Record<ChemKind, ...>`. Resolution adopted
   here: generation is driven by the presence of a `CHEM_LOOKS` row (4.5). Please add one line to SYSTEMS 6.1.3: "a unit makes its
   module appear by adding a `CHEM_LOOKS` row, an `EMBLEMS` entry and a `DESC` row".
2. **`heated` for vessels needs a vessel-on-base rule** the scan does not have (a base only attaches to a flask today). Unit 0 adds
   `rig.heats` and the vessel temperature model (4.3) including `COOLED_C` 5 C and `REACT_HEAT_W` 2000 W. These numbers are new
   canon; please add them to SYSTEMS 5.1/5.2. Unit 7's burner must burn fuel at `REACT_HEAT_W` for a heated vessel (via
   `drawHeat`), in addition to the 8 kW boil and 500 W idle rates it already owns.
3. **`ReactionSpec.age`** is sketched as `AgeName` but every age field in the code is a number from `ageIndexOf`; this spec uses
   `age: number` (set with `ageIndexOf('<name>')`). Suggest correcting the sketch.
4. **Optional ReactionSpec members** `verb`, `done`, `flag`, `stopAt`, `blockAbove`, `blockText` are needed to express fermenting as a
   row without losing today's behaviour and strings. They are optional additions as 6.5 permits; please list them in 6.5.
5. **Reaction model is continuous, not batch-at-end** (4.1), to keep fermenting identical. SYSTEMS 5.2 "seconds 30-120" therefore
   means "a batch's worth of liquid converts in that time"; solids are consumed and given per completed batch.
6. **`BP_MULT` lives in `src/core/distill.ts` from Unit 0** so Units 8 and 11 do not each define 0.7 / 1.3.
7. **`surface` wiring.** SYSTEMS 6.1.6 says "read by physics and the tractor (9 sets values)". Unit 0 adds the field and
   `surfaceMult` helper but does not edit `physics.ts` or the tractor; Unit 9 owns the speed rule wiring (it already owns T5's
   surface values). If the coordinator prefers Unit 0 to wire it (behaviour-neutral at 1.0), it is two lines.
8. **`CoolsSpec.returns?`** appears in the 6.5 Unit 0 sketch but 6.2 gives it to Unit 4. Unit 0 adds the optional type field only (to
   avoid two units editing the same interface) and no behaviour.
9. **The two canisters are unobtainable until Unit 8** and go into `SPEC.worldOnlyItems` temporarily; Unit 8 must remove them.
10. **`BrewResult.giveCount/consumeCount`** are a small new player-side contract (one Use moving a stack). Units 4, 5, 10 may reuse it.
11. **Side goals saved in `completed`** rather than a new field - no save change; Unit 2 needs nothing special for `six_cups`.
