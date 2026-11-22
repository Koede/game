# Unit 9 - Bitumen and asphalt roads

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Where this spec and SYSTEMS.md disagree,
SYSTEMS.md wins unless the deviation is argued here and listed in section 14 for the coordinator to merge.

**Threads:** T3 (fluids and containers: new `bitumen` fluid, grade and canister), T4 (material web: `bitumen` intermediate,
`asphalt` and `tarred_plank` building blocks), T5 (bodies and buffs: the `surface` term of the ONE speed rule, read in physics
and in the tractor). Touches T1 lightly (asphalt is mixed at 150-250 C, so a ground burner on charcoal can do it), T7 (side goal
`pave_road`, forge gating), T8 (descriptions, reaction lines), T9 (footstep pitch on a surfaced block), T10 (no new saved
fields - stated and tested).

Shared ids this unit DEFINES (SYSTEMS 6.2 row "`BlockSpec.surface` values, `asphalt`, `tarred_plank`, `rx_asphalt`,
`rx_tar_planks` | 9 | 16, 13"): `asphalt`, `tarred_plank`, `rx_asphalt`, `rx_tar_planks`, the `surface` VALUES, plus (new,
argued in 4.1) the fluid `bitumen`, its grade and `bitumen_canister`, the side goal `pave_road`, the flag `paved_road`, the
helpers `surfaceOf` / `surfaceUnder`, and three process cards (`strip_residue`, `mix_asphalt`, `tar_planks`).

Shared ids this unit CONSUMES (from Unit 0): `BlockSpec.surface?: { walk: number; vehicle: number }` (the field), `ReactionSpec`,
`REACTIONS` in `src/content/reactionsDistill.ts`, vessel item slots (`items`, `out`), capability `heated` (and `stirred`
as a speed-up, which only fires once Unit 12 lands), `SIDE_OBJECTIVES` / `<FEATURE>_SIDE_GOALS`.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Crude oil already splits in a three-cut column into gasoline, kerosene, diesel and a canister of black **Heavy Residue** that,
today, does one small job (it oils a workshop network, `LUBE.residue` x1.25 for 600 s). This unit gives residue its heavy end.

The fantasy, in the player's order:

1. *"What is left in the flask?"* Boil residue hot in a pot still (420 C, or 330 C under Unit 8's vacuum): the diesel tail and
   the lube base come over into the receiver, and what stays behind in the flask is thick, black **Bitumen**. Draw it off with an
   Empty Canister: a `bitumen_canister`.
2. *"A road."* Pour the bitumen into a **Reaction Vessel** standing on a Still Base set to 200 C, drop gravel and sand into its
   slots, wait 40 s a batch: 8 blocks of **Asphalt** per 250 L land in the vessel's output slots. One canister is 32 blocks of road.
3. *"It is faster."* On asphalt you walk 25% faster (4.3 -> 5.4 m/s; sprinting 5.8 -> 7.25 m/s); the tractor's top speed goes
   from 5.5 to **7.7 m/s**. Off the road the world is as slow as ever. The tractor finally has a reason to stay on the road, and
   the path from the pumpjack to the hearth becomes a black ribbon the player built on purpose.
4. *"And the planks."* The same hot bitumen soaks planks into **Tarred Planks**: dark, glossy boards that never feed a fire
   (a safe floor around the furnace and the stills), slightly quicker underfoot (x1.1), and the alternative sleeper for rails
   (Unit 16) and hull for the skiff (Unit 13).

It is the last step of SYSTEMS journey J1 ("The oil chain"): *"The bitumen left in step 3 is poured into a heated reaction vessel
with gravel and sand: asphalt (9). Pave a road from the pumpjack to the base; the tractor runs 7.7 m/s on it (5.5 x 1.4). Side
goal 'Pave a road'."*

It is congruent with the game's pillars: the heat for the mix comes from the hearth (a still base on a furnace) or from its
little sibling the ground burner (Unit 7, charcoal caps at 250 C, enough for 200 C); the speed is not a new buff but one
multiplication inside the one speed rule (T5); nothing new is gated except by furnace age (forge) and nothing on the spine
depends on it (T7, "optional by default").

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 T5 - the speed rule (normative, from SYSTEMS T5)

```
speed = base(walk|sprint|swim) x buffs.speedMult x surfaceMult(block under feet) x (blurred ? 0.9 : 1)
```

- `surfaceMult` reads `BlockSpec.surface?.walk` of the block under the player's feet (rules in 5.1). Missing field = 1.
- The tractor multiplies its max speeds (forward AND reverse) by `surface.vehicle` of the block under its centre.
- Swimming ignores surface (factor 1). Dev flight ignores surface (factor 1).
- This unit writes NO other speed multiplier anywhere (SYSTEMS 6d: "a 'road speed' outside `surface`" is rejected).
- `blurred` belongs to Unit 10. This unit only inserts the surface factor; the line it leaves must accept Unit 10's factor as one
  more product term without restructuring (see 8.4).

### 2.2 T3 - the fluid

`bitumen` joins `FluidKey`, `DISTILL_FLUIDS`, `GRADES` (before `residue`) and `CHEM_CONTAINERS` (`bitumen_canister`). Tanks and
pipes accept it through Unit 7's `tankFluids()` with no edit by this unit (it is not `hot`). If Unit 7 has not merged yet, the
hard-coded tank list stays as it is (bitumen simply cannot go into a tank until 7 lands) - this unit must NOT add `bitumen` to
the hand-written tank list in `src/content/techMachines.ts` (SYSTEMS 6d: no hard-coded fluid lists).

### 2.3 T4 - the material web rows (this unit adds the `bitumen` row; asphalt and tarred plank rows already exist)

| item / fluid | made by | consumed by | age | stack |
|---|---|---|---|---|
| `bitumen` (fluid) / `bitumen_canister` (NEW row) | pot still on residue at 420 C (exists as physics; card `strip_residue`, 9), or Unit 8's vacuum still at 330 C (8) | `rx_asphalt` (9); `rx_tar_planks` (9); tank storage (7) | forge | 8 |
| `asphalt` (block) | `rx_asphalt`: 250 L bitumen + 4 gravel + 2 sand -> 8, heated vessel 150-250 C, 40 s | end product (building block): walk x1.25, tractor x1.4 | forge | 64 |
| `tarred_plank` (block) | `rx_tar_planks`: 250 L bitumen + 8 plank -> 8, heated vessel 150-250 C, 30 s (deviation: SYSTEMS says 125 L + 4 -> 4; see 4.4) | end product: non-fuel floor/wall, walk/vehicle x1.1; rail recipe alternative (16); skiff hull (13, optional) | forge | 64 |

Bitumen has two consumers in this unit and storage in a third system; asphalt and tarred plank are end products (building
blocks) and per the T4 rule need no second consumer.

### 2.4 T7 - gating

All of it is **forge** (`ageIndexOf('forge')`, today 1, furnace tier 2): residue only exists after a forge column runs crude.
Process cards use `age: ageIndexOf('forge')`, blocks `age: ageIndexOf('forge')`. Nothing on the spine needs any of it;
`content.test.ts` progression must still complete with these items removed (the existing "Nothing existing depends on any
distillery item" property, DISTILLERY_PLAN 11).

### 2.5 Contracts with other units

| unit | what flows | rule |
|---|---|---|
| 0 | `BlockSpec.surface` field, reaction engine, vessel slots, `heated` capability, side goals | consumed as specified in SYSTEMS 6.5. One OPTIONAL member is requested on `ReactionSpec`: `minShare?` (4.3). If Unit 0 already merged without it, Unit 9 adds it (one optional field + one check in the engine's "can this reaction run" test) and says so in its PR. |
| 7 | ground burner, `tankFluids()` | asphalt at 200 C works on a charcoal burner (cap 250 C). Nothing to code; one test proves it if Unit 7 is merged (skip otherwise, see 9.6). |
| 8 | vacuum still on residue | Unit 8's flask leftover after a vacuum residue run must name as `bitumen` (share >= 0.85). Unit 9 owns the grade; Unit 8 only benefits. |
| 10 | `blurred` factor in the speed line | Unit 10 appends `x (blurred ? 0.9 : 1)`; Unit 9's line is written so that is a pure append. |
| 12 | `chem_stirrer`, `stirred` | `rx_asphalt` and `rx_tar_planks` list `speedUps: { stirred: 2 }`. Before 12 lands nothing sets `stirred`, so the factor never applies. |
| 13 | skiff hull (optional) | may add a recipe alternative using `tarred_plank`; Unit 9 only provides the block. |
| 16 | rail recipe alternative | Unit 16 adds `rail_tarred` (16 rail via tarred plank); Unit 9 only provides the block. Unit 9 does NOT write that recipe. |
| 17 | golem speed | golems do NOT read surface (out of scope, 13). |

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (what exists, verified 2026-11-22)

### 3.1 The heavy oil today

- `src/core/chem.ts`: `Component` already includes `'lube_base' | 'bitumen'`; `COMPONENTS.bitumen = spec('bitumen', 'Bitumen', 520,
  0x15120f, 200)` (bp 520 C, viscosity 200). `lube_base` bp 370.
- `GRADES` ends `... { fluid: 'residue', need: { bitumen: 0.45 }, mix: { bitumen: 0.6, lube_base: 0.3, diesel: 0.1 } }, ...`.
  There is NO `bitumen` grade: a nearly pure bitumen mixture taken out of a flask today is named `residue` (it meets
  `bitumen >= 0.45`) and, poured back, expands to the 60/30/10 residue mix. Purity is lost at the boundary - which is exactly
  why the new grade is needed (T3 rule 2, "Named at boundaries").
- `nameOf(mix)` picks the first grade a mixture meets, best first; `expand(fluid, L)` pours a grade's own `mix`.
- `src/content/fluidsDistill.ts`: `DISTILL_FLUIDS` has `f('residue', 'Heavy Residue', 0x5a4a40, 'residue_canister')`.
- `src/core/distill.ts`: `CHEM_CONTAINERS.residue_canister = canister('residue')`; `CANISTER_L = 1000`; `EMPTY_CANISTER =
  'empty_canister'`; `STILL_SETPOINTS = [78, 92, 97, 130, 200, 260, 350, 420]`; `GLASS_MAX_C = 450`; `CHEM_CAPACITY_L`
  `reaction_vessel: 4000`, `boiling_flask: 4000`, `receiver: 2000`.
- `src/content/itemsDistill.ts`: `can('residue_canister', 'Heavy Residue', 'What crude oil leaves in the flask: lube base and
  bitumen. Vacuum stills will split it later.')`.
- `src/core/types.ts` line ~653: `FluidKey` union ends `'diesel' | 'residue' | 'slop'`.
- `src/workshop/workshop.ts`: `LUBE = { residue: { factor: 1.25, s: 600 }, pine_resin: { factor: 1.1, s: 300 } }` - residue's
  only consumer today.

### 3.2 Splitting residue is ALREADY possible at 420 C (worked out from `bubblePoint`)

`bubblePoint(m) = -10 log2(sum x_i 2^(-bp_i/10))`. For the residue grade mix (bitumen .6, lube .3, diesel .1) that is about
313 C, so a pot still set to 350 or 420 C boils it. Diesel goes first, then lube base. With the diesel gone, the flask stops
boiling when its bubble point reaches the set temperature: at 420 C that happens when lube base is about 3% of what is left
(`x * 2^-37 + (1-x) * 2^-52 = 2^-42` -> x ~ 0.03). So **two residue canisters (2000 L) in a pot still at 420 C leave about
1230 L of ~97% bitumen in the flask** and about 770 L of diesel + lube base (lube ~0.75) in the receiver. Under Unit 8's vacuum
(bp x0.7) at 330 C the leftover is ~99% bitumen. Both clear the new grade's 0.85 threshold with margin. This is the reason Unit 9
does NOT depend on Unit 8: the atmospheric route works today, the vacuum route is the gentler far-field one (and the burner
route, since a kerosene burner caps at 350 C).

The drain: `chemUse` in `src/sim/distillActions.ts` - an empty container used on a flask (`TAKES_FROM` includes
`CHEM.flask`) takes `nameOf(e.mix)` if there are at least the container's litres (`"Only 640 L of Bitumen here - an Empty
Canister takes 1000 L"`), giving `filledWith(heldKey, name)`.

### 3.3 Reaction vessel today

`stepVessel(v, sealed, dt)` in `src/sim/distill.ts` special-cases fermenting (AMBIENT temperature, needs the airlock).
Unit 0 moves fermenting into `REACTIONS` as `rx_ferment_wash`, adds item slots (`items`, `out`, 4 each), the `heated` capability
(a vessel standing on a still base that holds a temperature - furnace below, or Unit 7's burner) and the vessel's temperature.
Unit 9 codes against that engine only; it never touches `stepVessel` itself except for the optional `minShare` check (4.3).

### 3.4 Movement today

- `src/core/constants.ts`: `WALK_SPEED = 4.3`, `SPRINT_SPEED = 5.8`, `SWIM_SPEED = 2.6`.
- `src/player/physics.ts` line 141, `PlayerPhysics.step`:
  `const speed = (this.inLiquid ? SWIM_SPEED : r.sprinting ? SPRINT_SPEED : WALK_SPEED) * p.buffs.speedMult * (p.flying && p.dev ? FLY_SPEED_MULT : 1);`
  Velocity eases towards `wish * speed` with `GROUND_RESPONSE` 14 / `AIR_RESPONSE` 2.5 / `LIQUID_RESPONSE` 6.
  `STEP_HEIGHT = 0.52` (a slab). `solidHeight(world, x, y, z)` from `./collision` gives 0 / 0.5 / 1.
- `src/game/buffs.ts`: `get speedMult(): number { return (this.has('swift') ? SWIFT_SPEED_MULT : 1) * (this.sugarS > 0 ? SUGAR_SPEED_MULT : 1); }`.
  It stays untouched: surface is not a buff (T5 "Asphalt (Unit 9): surface speed").
- `src/player/controller.ts`: footsteps - `this.sfx('step', 0.6)` every `STEP_EVERY = 1.75` blocks walked ("Blocks walked on the ground between
  footstep sounds"); `private sfx(name: 'jump' | 'splash' | 'land' | 'step', volume?: number)`.

### 3.5 The tractor today

- `src/vehicles/tractor.ts`: `MAX_FORWARD = 5.5`, `MAX_REVERSE = 2.2`, `ACCEL = 5`, `BRAKE = 9`, `DRAG = 2.4`, `HALF_WIDTH = 0.8`,
  `STEP_HEIGHT = 1`. `driveTractor(world, t, input, dt, working = false)` computes
  `const target = throttle > 0 ? throttle * MAX_FORWARD : throttle < 0 ? throttle * MAX_REVERSE : 0;`.
  `Tractor` has transient (not saved) fields `roll`, `steer`, `working`, `onGround`.
- `src/vehicles/manager.ts`: `driveTractor(this.host.world, t, { throttle, steer }, h, working)` in sub-steps; engine sound
  `const load = Math.min(1, Math.abs(t.speed) / 5.5);` (a literal 5.5 - see 8.6).
- `src/vehicles/tractorWork.ts` `tillSwath` only tills where `tillResult(ground) !== null`; `tillResult` (`src/game/farming.ts`)
  is `TILLABLE.includes(def.key) ? block('farmland') : null` - grass and dirt. Asphalt and tarred planks are therefore already
  left alone by the tiller "like stone" (T4 row); this unit adds a test that pins it.
- `src/ui/vehicleHud.ts` shows fuel, tool and key hints; no speed readout (and this unit adds none, 6.4).

### 3.6 Content plumbing

- Blocks: `src/content/blocks.ts` (`sand`: tool `shovel`, hardness 0.8; `gravel`; `plank` "Planks", tool `axe`, hardness 1.5);
  distillery blocks in `src/content/blocksDistill.ts`, appended after every older block ("saved voxel ids never move").
- Recipes and cards: `src/content/recipesDistill.ts` - `forge(...)`, `card(id, station, inputs, output, byproducts, setC, timeS,
  age, rig)`, `PROCESS_CARDS`, `RIG_LEGEND` (`V: 'reaction_vessel'`, `B: 'still_base'`, `F`, `C`, `R`). Cards are what the Codex
  and the progression solver read; `src/sim/distillProcess.test.ts` builds each card's rig and runs it.
- Rosters (test fixtures): `src/content/specRosterDistill.ts` (`DISTILL_SPEC.blocks`, `.items`, `.blockProps`, recipe counts),
  `src/content/specRosterTech.ts` (fluid list lines ~64-65 and the fluid table row format
  `residue: ['Heavy Residue', false, false, null, 'residue_canister']`).
- Textures: `src/render/textures/distill.ts` (`icon(...)`, `canister(c, band)`, `ramp(...)`;
  `item_residue_canister: icon((c) => canister(c, ramp(0x5a4a40)))`).
- Objectives: `ObjectiveCondition` `{ type: 'place', block, count }` counted from `stats.placed[block]`
  (`src/game/objectives.ts` `progressOf`).
- Debug handle (`src/app/debug.ts`, `window.__hw`): `give`, `teleport`, `setVoxel(x, y, z, block, facing?, active?)`, `getBlock`,
  `surfaceY`, `look`, `lookAt`, `tick`, `state()` (with `player`).

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Fluid `bitumen` (NEW) - why a new fluid at all

SYSTEMS T4 writes the asphalt recipe as "bitumen 250 L". There must be a way to carry bitumen from the still to the vessel, and
the boundary rule (T3.2) names every carried liquid by its grade. Without a grade, the still's 97% bitumen bottles as `residue`
and pours back at 60% - the player would be making asphalt out of residue with extra steps, and the residue route in 4.3 would
be indistinguishable from the refined one. So:

| field | value |
|---|---|
| `FluidKey` | `'bitumen'` (append to the union in `src/core/types.ts`, after `'residue'`) |
| `FluidSpec` | `f('bitumen', 'Bitumen', 0x1c1714, 'bitumen_canister')` in `DISTILL_FLUIDS`, placed right after `residue` |
| colour reason | the component colour is 0x15120f; 0x1c1714 is a hair lighter so the pipe window reads as "black oil", and it must pass the techContent "reads apart from every other fluid" test (residue 0x5a4a40 is the nearest; distance is large) |
| `hot` | false (it is carried cold and stiff; it flows when the vessel heats it). Ordinary fluid pipes take it. |
| grade in `GRADES` | `{ fluid: 'bitumen', need: { bitumen: 0.85 }, mix: { bitumen: 0.9, lube_base: 0.1 } }`, inserted **immediately before** the `residue` row (best first: anything that meets bitumen also meets residue). Coordinate with Unit 0, which inserts `lubricant` and `lube_base` "BEFORE `residue`": final order `... diesel, syrup, lubricant, lube_base, bitumen, residue, ...` - the relative order of `bitumen` vs the lube grades does not matter (they test different components). |
| container | `CHEM_CONTAINERS.bitumen_canister = canister('bitumen')` (1000 L, empty `empty_canister`). No beaker (heavy oils ride in canisters, SYSTEMS 4 "Containers"). |
| burner fuel? | No. Not in `FUEL_GRADES`, not in `BURNER_FUELS` (T1 rule 2 applies to liquid FUELS; bitumen is not a fuel in this game - it "does not burn" at mixing temperatures, SYSTEMS 5.1). |
| oil (`LUBE`)? | No. Residue stays the residue rung; bitumen is too thick to oil a shaft. Using a bitumen canister on a shaft does nothing (falls through to the normal Use path). |

Why 0.85 / 0.9: the atmospheric 420 C run leaves ~0.97, the vacuum run ~0.99, so both clear 0.85 comfortably; the residue grade
mix (0.6) and anything a sloppy run leaves (stopping early at 350 C leaves ~0.75: worked from the same bubble point formula,
lube ~ 0.23 at Tb 350 with diesel gone) do NOT. "Run it hotter or longer" is a lesson the player can read from the bottle name.
Expansion at 0.9 (below the 0.97 the still made) keeps "storing can only lose quality" true (DISTILLERY_PLAN 5.4).

Item `bitumen_canister` (in `src/content/itemsDistill.ts`, via the existing `can(...)` helper so it gets the canister's stack 8,
category and age the other canisters have):

- Display name: **Bitumen** (as the other canisters are named after their fluid: "Heavy Residue", "Diesel").
- Description: `"The black, heavy end of crude oil. Heat it in a Reaction Vessel at 150-250 C with 4 Gravel and 2 Sand for 8 Asphalt, or with 8 Planks to tar them."`
- Stack 8, category `material`, age 1 = forge: `can(key, name, desc)` hard-codes `age: 1, stack: 8` like every other canister.
  Do not change the helper in this unit (W0 will move canisters with the rest).
- Icon `item_bitumen_canister: icon((c) => canister(c, ramp(0x2a221c)))` - the band is lifted to 0x2a221c so the icon passes the
  texture readability test on the dark canister body; if it still fails, add a thin 0x8a7a60 highlight line on the band (the
  "wet gloss" of tar), never a different hue.

Also edit the residue description (it promises "Vacuum stills will split it later", which this unit makes true in a different
way): `"What crude oil leaves in the flask: lube base and bitumen. Boil it again at 420 C and Bitumen stays behind in the flask."`
(Unit 8 may append "or under vacuum at 330 C"; see 14.)

### 4.2 Card `strip_residue` - making bitumen visible in the Codex and to the solver

The physics already works (3.2); the card makes it discoverable, testable and solvable:

```ts
card('strip_residue', 'boiling_flask', '2 residue_canister', '1 bitumen_canister', '1 empty_canister', 420, 120, ageIndexOf('forge'), 'CR/F./B.'),
```

- Inputs 2 residue canisters (2000 L; both empties come back on pouring). Output 1 bitumen canister (the player uses one of the
  two empties to draw the flask). Byproduct 1 empty canister. The ~770 L in the receiver is NOT listed (the cards list at least
  what the run makes; the receiver keeps it - the player bottles it as Unit 0's `lube_base` grade when it meets 0.6, else slop).
- `timeS` 120: 770 L at `BOIL_LPS` 20 L/s slowing near the end; the test only needs the outputs, the number is for the Codex.
- Card ids are plain verbs like the existing ones (`refine_crude`, `distil_spirit`); `rx_` is for reactions only.
- If `card(...)` takes a literal `age: number`, pass `ageIndexOf('forge')` (import from `src/magic/ageMap.ts`) - the existing
  rows pass `1`; do not "fix" them in this unit.

### 4.3 Reaction `rx_asphalt` and the `minShare` option

Appended to `REACTIONS` in `src/content/reactionsDistill.ts`:

```ts
{
  key: 'rx_asphalt',
  name: 'Asphalt mix',
  in: { bitumen: 0.9, lube_base: 0.1 },        // parts: exactly the bitumen grade, so a canister is used up cleanly
  minShare: { bitumen: 0.8 },                  // NEW optional member (below): refuses residue (0.6)
  items: [{ item: 'gravel', count: 4 }, { item: 'sand', count: 2 }],
  out: {},                                     // all 250 L leave the liquid...
  gasLoss: 0,                                  // (no vapour)
  gives: [{ item: 'asphalt', count: 8 }],      // ...as 8 blocks
  needs: ['heated'],
  speedUps: { stirred: 2 },
  tempC: [150, 250],
  batchL: 250,
  seconds: 40,
  age: 'forge',
}
```

Litre accounting: `out` is empty because the litres become solid blocks. Unit 0's conservation fuzz asserts
`sum(out) == sum(in) unless gasLoss`; a reaction whose `gives` carries the litres must be accepted by that check. Contract: **a
reaction with non-empty `gives` and empty `out` is a solidifying reaction; the conservation test counts its consumed litres as
leaving into items** (`rx_ferment_wash` does not do this, so the fuzz stays meaningful for liquid reactions). If Unit 0's test
does not allow it, Unit 9 adds the exception there with a one-line comment `// solidifying reactions (rx_asphalt, rx_tar_planks): litres leave as gives`.

**`minShare?: Partial<Record<Component, number>>` (NEW optional member of `ReactionSpec`).** Meaning: the reaction may run only
while the vessel's mix holds at least this share of each listed component (`share(v.mix, c) + 1e-9 >= minShare[c]`). Why it is
needed: without it, pouring a residue canister (bitumen .6, lube .3, diesel .1) into the vessel would run `rx_asphalt` until the
bitumen ran out, leaving ~230 L lube base + 100 L diesel that bottles as `lube_base` - a shortcut that skips the still entirely
and undercuts both `strip_residue` and Unit 8's vacuum line. With `minShare: { bitumen: 0.8 }` residue simply does not react.
It is a single comparison in the engine's "can this reaction run" test, defaulting to "no requirement". SYSTEMS 6.5 says "if one
needs more, it adds an OPTIONAL member and says so in its spec": this is that sentence.

The vessel problem text when `minShare` is not met (the engine's generic "reaction cannot start" line, filled from the spec):
`"Reaction Vessel - too thin for Asphalt mix: 60% bitumen, needs 80%"` (54 characters with a 2-digit share; fits the ~60 rule).

Numbers and why (SYSTEMS 5):

| number | value | reason |
|---|---|---|
| window | 150-250 C | SYSTEMS 5.1 "asphalt mix 150-250: bitumen flows, does not burn". The still base setpoint **200 C** (`STILL_SETPOINTS` has it) is the one to use; 260 is outside (the base holds 260, the reaction pauses: the vessel line says so, 5.4). A charcoal burner (cap 250) reaches 200; so does coal (280 cap, set 200). |
| ruinC | none | overheating only pauses; asphalt is a forgiving recipe (the essence window is the punishing one). |
| batchL | 250 L | SYSTEMS 5.2 "reaction batch `batchL` 250-1000 L". |
| seconds | 40 | inside 30-120. One canister = 4 batches = 160 s (80 s stirred). A full 4000 L vessel = 16 batches = 128 asphalt in 10.7 min. |
| items | 4 gravel + 2 sand per batch | SYSTEMS T4 row. Gravel and sand are Ember-common (shovel). One canister of road = 16 gravel + 8 sand. |
| gives | 8 asphalt per batch | SYSTEMS T4. 32 per canister; the side goal needs 16 = half a canister. |
| output slots | 4 x 64 = 256 asphalt | a full vessel (128) fits in 2 slots. If the output slots are full the reaction pauses (Unit 0 generic: "output full - take what it made"). |

Cost check against 5.3 ("forge parts: iron/steel plate 2-4"): a 32-block road costs 2 residue canisters of a crude run (which
itself gives 2 residue per 8 crude) + 16 gravel + 8 sand + ~3 minutes. Cheap per block, expensive in set-up (a column, a second
still, a vessel) - the right shape for a building block whose value is in quantity.

### 4.4 Reaction `rx_tar_planks` (deviation from T4's 125 L / 4 planks)

```ts
{
  key: 'rx_tar_planks',
  name: 'Tarring planks',
  in: { bitumen: 0.9, lube_base: 0.1 },
  minShare: { bitumen: 0.8 },
  items: [{ item: 'plank', count: 8 }],
  out: {},
  gives: [{ item: 'tarred_plank', count: 8 }],
  needs: ['heated'],
  speedUps: { stirred: 2 },
  tempC: [150, 250],
  batchL: 250,
  seconds: 30,
  age: 'forge',
}
```

Deviation argued: SYSTEMS T4 says "bitumen 125 L + 4 plank -> 4", but SYSTEMS 5.2 says batches are 250-1000 L. Same ratio
(31.25 L per plank), doubled to obey 5.2. One canister tars 32 planks. Section 14 asks the coordinator to update the T4 row.

Which reaction runs when both could? Unit 0's engine picks "the first reaction whose inputs, items, caps and window all hold, in
fixed order". `rx_asphalt` is listed before `rx_tar_planks`, and their item needs are disjoint (gravel+sand vs planks): a
vessel holding planks only tars; one holding gravel+sand only paves; one holding all three paves first until gravel or sand runs
out, then tars. That is deterministic and explainable; the vessel line names what it is doing (5.4).

`plank` is a furnace fuel (`burnableBlock('plank', fuel(60, 20, 550))` in `src/content/items.ts`). `tarred_plank` gets NO
`burnableBlock` row (its generated block item has no `fuel`) - "they never feed a fire" - so
there is no fuel exploit (8 planks -> 8 non-fuel planks loses fuel value, never gains).

### 4.5 Cards `mix_asphalt` and `tar_planks`

```ts
card('mix_asphalt', 'reaction_vessel', '1 bitumen_canister, 16 gravel, 8 sand', '32 asphalt', '1 empty_canister', 200, 160, ageIndexOf('forge'), 'V/B'),
card('tar_planks', 'reaction_vessel', '1 bitumen_canister, 32 plank', '32 tarred_plank', '1 empty_canister', 200, 120, ageIndexOf('forge'), 'V/B'),
```

Rig `'V/B'`: a vessel on a still base (the furnace goes under every B, per the `ProcessCard.rig` legend). These cards are the
progression solver's pseudo-recipes for asphalt and tarred plank, so both are "reachable in their age". `distillProcess.test.ts`
must put non-container inputs into the vessel's item slots: if Unit 0's runner does not already do that, Unit 9 extends it -
for each input whose item is not a key of `CHEM_CONTAINERS`, call `d.offerItem(vx, vy, vz, item, count)` on the card's `V` cell,
and after the run count `out` slot items against `output` with `d.takeItem`.

### 4.6 Block `asphalt`

| field | value | reason |
|---|---|---|
| key | `asphalt` | SYSTEMS 6.2 |
| name | `Asphalt` | |
| desc (tooltip) | `"A hard black road. You walk 25% faster on it and a tractor drives 40% faster. The tiller leaves it alone."` | 1.4: names the use and the number |
| shape | `cube` (default) | no slabs or stairs for building blocks exist in the game (only machine slabs); see 5.2 |
| solid / opaque | default (true / true) | |
| hardness | 2 | a little harder than planks (1.5): a road should not crumble under a stray click |
| tool | `pickaxe` | like stone |
| minTier | 0 | a block the player made always comes back; bare hands are just slow |
| drops | `'self'` (default) | mining asphalt returns the block: roads can be moved. No bitumen back. |
| stack | 64 | SYSTEMS T4 ("materials 64") and the T4 row |
| category | `block` (default) | |
| age | `ageIndexOf('forge')` | T7 gating table |
| surface | `{ walk: 1.25, vehicle: 1.4 }` | SYSTEMS T5 |
| textures | `{ all: 'asphalt' }` | 4.8 |

### 4.7 Block `tarred_plank`

| field | value | reason |
|---|---|---|
| key / name | `tarred_plank` / `Tarred Planks` | the plain block is "Planks" (plural) - match it |
| desc | `"Planks soaked in hot bitumen. They never feed a fire, so they are a safe floor by the furnace. Walking and driving on them is 10% faster."` | |
| hardness / tool / minTier | 1.5 / `axe` / 0 | same as `plank` |
| drops | `'self'` | |
| stack | 64 | |
| age | `ageIndexOf('forge')` | |
| surface | `{ walk: 1.1, vehicle: 1.1 }` | SYSTEMS T5 |
| textures | `{ all: 'tarred_plank' }` | |
| fuel | none (no `burnableBlock` row in `src/content/items.ts`, so its item has no `fuel`) | |

"Non-burning": the game has no fire spread today, so "never feeds a fire" means exactly: not a fuel. The description promises
nothing else.

### 4.8 Textures (procedural, 16 x 16 like every tile; in `src/render/textures/distill.ts` beside the canisters)

- `asphalt`: base 0x2b2a2c (near-black with a cool blue-grey, NOT pure black so lighting reads); per-pixel noise +/-10 in value;
  ~10% of pixels are "aggregate" specks in 0x55524e and 0x6a655e (2-3 single pixels and a few 2-pixel stones) - the gravel in
  the mix; no lines or markings (a tile has no orientation and roads run every way). Readability: the noise contrast keeps it
  from reading as a hole at night. Its look at a glance must differ from `stone` (grey, lighter) and `coal_ore`; distinct colour
  count in the texture test >= the test's floor.
- `tarred_plank`: the `plank` painter's board pattern (reuse the same function if it is exported; else copy its board-seam
  logic) with the colour ramp darkened to 0x3a2a1c..0x5a4028 and a 1-pixel gloss streak 0x8a6a48 along each board - "wood under
  a coat of tar". The board seams must still show (the player must read it as planks).
- `item_bitumen_canister`: 4.1.

### 4.9 Side goal `pave_road`

In a new export in `src/content/objectivesDistill.ts`-style file - use whatever file Unit 12 creates for `DISTILL_SIDE_GOALS`; if
it does not exist at merge, create `export const ROAD_SIDE_GOALS: ObjectiveSpec[]` in `src/content/objectivesRoad.ts` (NEW) and
concatenate it in `src/content/objectivesSide.ts`:

- `ObjectiveSpec` (`src/core/types.ts`): id `pave_road`, title `"Pave a road"`, condition `{ type: 'place', block: 'asphalt', count: 16 }`,
  `age: ageIndexOf('forge')`,
- `text` "Mix Bitumen with gravel and sand in a heated Reaction Vessel, then lay 16 Asphalt. You walk 25% faster on it, and the tractor 40%."`,
- `reward`: omitted (the field is optional; the road IS the reward).
- On completion the tracker toasts `"Side goal: Pave a road"` (Unit 0 mechanism) and sets flag `paved_road` (SYSTEMS 4 flag
  example) via `bus.emit('flag', { flag: 'paved_road' })` when the goal completes - emit it from the side-goal completion hook if
  Unit 0 exposes one, else from the goal's own `onDone` if `ObjectiveSpec` has it; if neither exists, skip the flag (nothing
  reads it) and say so in the PR.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, with edge cases

### 5.1 Which block is "under the feet" (player)

`surfaceUnder(world, x, feetY, z)` (NEW, `src/player/surface.ts`) returns the `{ walk, vehicle }` of the cell
`(floor(x), floor(feetY - 0.05), floor(z))`, or `null` when that cell's block has no `surface`.

- Standing on a full block at height k: feet at k+1, sample at k+0.95 -> cell k. Correct.
- Standing on a slab at cell k (top k+0.5): feet at k+0.5, sample k+0.45 -> cell k (the slab). Correct for any future asphalt slab.
- The player box is 0.6 wide: only the CENTRE column is sampled. Half on the road = whatever the centre is over. This is
  deterministic, cheap (one block lookup per step) and matches how the player perceives "I am on the road". No blending.
- **Centre over an empty or non-solid cell** (walking along a road edge with the centre over a ditch, or over a torch/flower
  standing on the road): `solidHeight(world, cx, cy, cz) === 0` -> keep the last grounded factor (5.3). A flower ON asphalt is in
  the cell above, so the sampled cell is the asphalt anyway.
- Snow layers, carpets or any non-surface block placed on top of the asphalt (in the cell the feet stand in, i.e. a slab-height
  block) are sampled instead and have no `surface` -> factor 1. A road covered in something is not a road.

### 5.2 Slabs and stairs

There are no building slabs or stairs in the game (`BlockShape` has `'slab'` but only machines use it). The player climbs a
full asphalt block by jumping; the tractor climbs 1 block (`STEP_HEIGHT = 1`) without stopping, so a road may rise 1 block per
step for vehicles. An `asphalt_slab` is out of scope (13) but the sampling rule above already handles it.

### 5.3 Airborne, swimming, flying

- `PlayerPhysics` keeps `private surfaceWalk = 1` (NEW field, not saved). Each step, if `p.onGround` (from the previous
  integrate) and the sampled cell is solid, set `surfaceWalk = surfaceUnder(...)?.walk ?? 1`.
- In the air the last grounded value is kept: a sprinting jump on asphalt keeps its road speed (without this, `AIR_RESPONSE`
  would bleed ~78% of the bonus over a 0.6 s jump: running and jumping on a road would feel like braking).
- `this.inLiquid` -> factor 1 and `surfaceWalk` reset to 1 (SYSTEMS: "Swimming ignores surface"). A flooded road is water.
- Dev flight (`p.flying && p.dev`) -> factor 1 (flight has its own `FLY_SPEED_MULT`).
- Respawn / teleport: `reset()` sets `surfaceWalk = 1`.

### 5.4 Reaction vessel behaviour (seen by the player)

All of this is Unit 0's generic engine; Unit 9 guarantees the specs produce these lines (the exact phrasing is Unit 0's generic
template - if it differs in punctuation, Unit 0's template wins, the facts must be the same):

| situation | crosshair line (target: the vessel) |
|---|---|
| working | `"Reaction Vessel - 1.0 buckets Bitumen, 200 C, Asphalt mix 2 of 4"` |
| too cold (no base, base at 130) | `"Reaction Vessel - 750 L Bitumen, 130 C, needs 150-250 C for Asphalt mix"` |
| too hot (base at 260) | `"Reaction Vessel - 750 L Bitumen, 260 C, needs 150-250 C for Asphalt mix"` |
| residue poured in | `"Reaction Vessel - too thin for Asphalt mix: 60% bitumen, needs 80%"` |
| items short | `"Reaction Vessel - needs 4 Gravel and 2 Sand - it has 1 Gravel"` |
| output full | `"Reaction Vessel - output full - take what it made"` |
| done (no bitumen left) | `"Reaction Vessel - done, 32 Asphalt to take"` |

Use-flows (Unit 0): Use with gravel/sand/planks puts the held stack (all of it, up to slot room) into a free item slot; empty-hand
Use on a vessel with outputs takes them into the pack; if the pack is full: `"Your pack is full"` (existing refusal).
Pouring the bitumen canister: the existing toast `"Bitumen poured in (1.0 buckets)"`.

**Edge: a vessel with bitumen but not heated** keeps the bitumen indefinitely (no spoiling). Bitumen left in a vessel when its
block is mined follows the existing distillery rule for a mined module's contents (whatever `Distillery` does today for a vessel
of wash: same path, no special case).

**Edge: half a batch** - the engine moves litres by `frac` each step; items are consumed and `gives` pushed only when a whole
batch completes (DISTILLERY_PLAN 6). If the bitumen runs out mid-batch (e.g. 900 L poured: 3 batches + 150 L), the last partial
batch never completes: the vessel shows `done` with 150 L of Bitumen left (the line says it: `"Reaction Vessel - done, 150 L
Bitumen left (a batch needs 250 L)"`). Pouring another canister continues it. Items for the partial batch stay in the slots
(they are consumed at batch completion, never at start).

### 5.5 Laying and mining

- Placing asphalt / tarred planks: ordinary block placement; `stats.placed.asphalt` counts towards `pave_road`.
- Mining asphalt with a pickaxe: `hardness` 2 x the tool's speed, drops 1 asphalt (self). Bare hands: slow, still drops.
- The tractor's tiller passes over asphalt and tarred planks without changing them (not in `TILLABLE`), and the harvester only
  cuts ripe crops: nothing to code, pinned by tests (9.3).
- Hoe on asphalt: `canTill` false -> the hoe does nothing (existing behaviour; no message, like on stone).
- Mobs walk on roads at their normal speed (out of scope).

### 5.6 Tractor

`driveTractor` reads `surfaceOf` for the block under the tractor's centre: cell `(floor(t.x), floor(t.y - 0.05), floor(t.z))`
(`t.y` is the bottom of the body box, the same convention as the player's feet - verify in `collide.ts sweepBox`, which treats
`pos.y` as the box bottom). The factor `t.surf` (NEW transient field on `Tractor`, not saved, `createTractor` sets 1) updates only
while `t.onGround` and the cell is solid (same airborne rule as the player).

```
const top = MAX_FORWARD * t.surf;      // 5.5 -> 7.7 on asphalt, 6.05 on tarred planks
const back = MAX_REVERSE * t.surf;     // 2.2 -> 3.08 on asphalt
const target = throttle > 0 ? throttle * top : throttle < 0 ? throttle * back : 0;
```

- Driving off the road at 7.7 m/s onto grass: the target drops to 5.5 and the tractor slows with `ACCEL` 5 m/s^2 towards it
  (the `rate` clamp - about 0.44 s). That is the "roll-off" feel: it coasts down, it does not stop dead. Do NOT use `BRAKE` for
  this (the brake branch is only for a target of the opposite sign - true already in the code).
- Half the tractor on the road: centre rule. The 1.6-wide body means a 2-wide road keeps the centre on it while steering.
- Fuel: `burn()` is per second of throttle, not per metre, so a road also makes fuel go 40% further per metre. Intended (a reason
  to pave), stated in the tractor docs.
- Turning: `grip` saturates at `SPEED_FOR_FULL_TURN` 2.5, so turn rate is unchanged; at 7.7 m/s the turning circle is 40% wider.
  Intended (a road is for going straight).
- The PTO (shaft power) does not depend on speed - unaffected.
- Engine sound: `load = Math.min(1, Math.abs(t.speed) / (MAX_FORWARD * t.surf))` so the pitch tops out at each surface's top speed
  instead of saturating early on asphalt (replace the literal `5.5` with the constant - also fixes a magic number).

### 5.7 Messages (complete list of new player-visible strings)

| where | string |
|---|---|
| item name / desc | `Bitumen` / `"The black, heavy end of crude oil. Heat it in a Reaction Vessel at 150-250 C with 4 Gravel and 2 Sand for 8 Asphalt, or with 8 Planks to tar them."` |
| item desc (edit) | residue canister: `"What crude oil leaves in the flask: lube base and bitumen. Boil it again at 420 C and Bitumen stays behind in the flask."` |
| block name / desc | `Asphalt` / `"A hard black road. You walk 25% faster on it and a tractor drives 40% faster. The tiller leaves it alone."` |
| block name / desc | `Tarred Planks` / `"Planks soaked in hot bitumen. They never feed a fire, so they are a safe floor by the furnace. Walking and driving on them is 10% faster."` |
| reaction names | `Asphalt mix`, `Tarring planks` |
| vessel lines | 5.4 |
| side goal | title `"Pave a road"`, text 4.9, toast `"Side goal: Pave a road"` (Unit 0 template) |
| take refusal (existing template, new fluid) | `"Only 640 L of Bitumen here - an Empty Canister takes 1000 L"` |

No exclamation marks, numbers with units, " - " between name and state (SYSTEMS 1.4).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Strings (T8)

All in 5.7. Every crosshair line in 5.4 is <= 60 characters with realistic numbers (checked: the longest,
`"Reaction Vessel - 750 L Bitumen, 130 C, needs 150-250 C for Asphalt mix"`, is 71 - **too long**; the HUD shows
`"Reaction Vessel - 130 C, needs 150-250 C for Asphalt mix"` (56) instead: when the reaction is paused for temperature, the
contents fact is dropped, since the temperature is the most important state (T8 "first fact = the most important state")).
Final table entries for the two temperature rows therefore read:
`"Reaction Vessel - 130 C, needs 150-250 C for Asphalt mix"` and `"Reaction Vessel - 260 C, needs 150-250 C for Asphalt mix"`.

### 6.2 Sound (T9) - the footstep set

No new `SfxName` (keeps `sfx.test.ts`'s count untouched and avoids a shared-union edit). Footsteps on a block with `surface`
use the existing `step` patch with a different pitch and volume: a firmer, higher, drier tap.

- `controller.ts`: `this.sfx('step', 0.6)` becomes `this.sfx('step', surfaced ? 0.5 : 0.6, surfaced ? 1.18 : undefined)` where
  `surfaced = this.physics.onSurface` (NEW read-only getter: `surfaceWalk !== 1` while grounded). The `sfx` helper gains an
  optional `pitch?: number` parameter and passes it in the `'sfx'` event (the event already carries `pitch` - the tractor's
  engine uses it). `step` has `jitter` > 0 (sfx.test "random pitch spread"), so road steps still vary.
- Loudness: whisper/small tier (0.5), below the grass step (0.6): smooth road, quieter feet.
- The tractor on a road: no new sound; the engine pitch follows 5.6.

### 6.3 Particles and visuals

- None for walking (a road is calm). The reaction vessel's liquid already renders the mix colour (`colourOf`): bitumen shows
  near-black with very slow bubbles (viscosity 200 -> "bitumen drips once every 2 s", DISTILLERY_PLAN 10) - existing renderer, no
  code. The vessel lamp states (amber working, green done, red blocked) come from the generic engine.

### 6.4 HUD

No new HUD element. The player feels the speed; the item and block descriptions state the numbers. No speed readout on the
driving HUD (adding one is a separate feature; out of scope). Phone: nothing new to tap; every action is Use / Mine / place.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

- **Blocks** `asphalt`, `tarred_plank`: appended at the END of the block list (new file `src/content/blocksRoad.ts` exporting
  `ROAD_BLOCKS: BlockSpec[]`, concatenated last in the `BLOCKS` array of `src/content/blocks.ts` (today `...WORLD_BLOCKS, ...TECH_BLOCKS, ...,
  ...DISTILL_BLOCKS, ...MAGIC_BLOCKS, ...WORKSHOP_BLOCKS, ...GLASS_BLOCKS`), after whatever is last when this unit merges). Never inserted between existing rows (SYSTEMS 2: "append, never insert or
  reorder"). Block edits are saved by key, so order only matters for the roster test.
- **Fluid** `bitumen` and item `bitumen_canister`: registered like the other distillery fluids. Tanks/pipes holding bitumen save
  through the existing fluid snapshots (fluid key string) - nothing new.
- **Vessel slots**: Unit 0's saved `items` / `out` carry gravel, sand, planks and asphalt like any `ItemStack`.
- **No new saved fields.** `PlayerPhysics.surfaceWalk` and `Tractor.surf` are transient; `snapshotOf(t)` / `fromSnapshot` are not
  changed (`fromSnapshot` must initialise `surf: 1`). Test 9.5 proves an old tractor snapshot loads with `surf === 1`.
- `BlockSpec.surface` is content, not save data.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npm test` green)

Prerequisite: Unit 0 merged (the `surface` field, reaction engine, vessel slots, `heated`, side goals). Steps 1-3 do not need the
reaction engine and can land first if Unit 0 is late.

### 8.1 Step 1 - the surface helpers (NEW `src/player/surface.ts`)

```ts
import { blockOf } from '../core/registry';
import type { IWorld } from '../core/types';
import { solidHeight } from './collision';

export interface Surface { walk: number; vehicle: number }
/** Below this many blocks under the feet/bottom we sample (so a slab top at k+0.5 is cell k). */
export const SURFACE_PROBE = 0.05;
/** The surface of the block in cell (x, y, z), or null (no `surface` field, unloaded, air). */
export function surfaceOf(world: IWorld, x: number, y: number, z: number): Surface | null;
/** The surface under a body whose bottom centre is at (x, bottomY, z); `solid` false when that cell is passable. */
export function surfaceUnder(world: IWorld, x: number, bottomY: number, z: number): { surface: Surface | null; solid: boolean };
```

`surfaceOf` = `blockOf(world.getVoxel(x, y, z)).surface ?? null` (use the same block lookup `physics.ts` already imports:
`blockOf` from `../core/registry`). `solid` = `solidHeight(world, cx, cy, cz) > 0`. Both allocation-free: return a module-level
reused object for `surfaceUnder` (physics is "allocation-free per step" - file header). Pure; lives in `player/` but is imported
by `vehicles/tractor.ts` too (vehicles already import from `../core`; importing `../player/surface` is fine - or place it in
`src/game/surface.ts` if a vehicles->player import breaks a lint/layer rule; check `vehicles/*.ts` imports and follow them).

### 8.2 Step 2 - player physics (`src/player/physics.ts`)

- Field `private surfaceWalk = 1;` and getter `get onSurface(): boolean { return this.surfaceWalk !== 1 && this.player.onGround && !this.inLiquid; }`.
- In `step()`, before the speed line:
  ```ts
  if (this.inLiquid) this.surfaceWalk = 1;
  else if (p.onGround) {
    const s = surfaceUnder(this.world, pos.x, pos.y - SURFACE_PROBE, pos.z);
    if (s.solid) this.surfaceWalk = s.surface?.walk ?? 1;
  }
  const surface = this.inLiquid || (p.flying && p.dev) ? 1 : this.surfaceWalk;
  const speed = (this.inLiquid ? SWIM_SPEED : r.sprinting ? SPRINT_SPEED : WALK_SPEED) * p.buffs.speedMult * surface * (p.flying && p.dev ? FLY_SPEED_MULT : 1);
  ```
  (`surfaceUnder` takes the bottom Y and subtracts nothing itself, or subtracts `SURFACE_PROBE` itself - pick ONE; the sketch above
  assumes the caller passes `pos.y - SURFACE_PROBE` and the helper floors it. Document it in the helper's JSDoc.)
- `reset()`: `this.surfaceWalk = 1;`.
- Update the file header comment: "... swimming, stepping onto slabs, road surfaces (BlockSpec.surface) and fall damage".

### 8.3 Step 3 - the tractor (`src/vehicles/tractor.ts`, `manager.ts`)

- `Tractor` gains `/** Speed factor of the ground under the centre (BlockSpec.surface.vehicle); not saved. */ surf: number;`
  `createTractor` and `fromSnapshot` set `surf: 1`.
- In `driveTractor`, before `target`: `if (t.onGround) { const s = surfaceUnder(world, t.x, t.y - SURFACE_PROBE, t.z); if (s.solid) t.surf = s.surface?.vehicle ?? 1; }`
  then the 5.6 target. `settleTractor` leaves `surf` alone.
- `manager.ts sound()`: `const load = Math.min(1, Math.abs(t.speed) / (MAX_FORWARD * t.surf));` (import `MAX_FORWARD`).

### 8.4 Step 4 - footstep pitch (`src/player/controller.ts`)

- `private sfx(name: 'jump' | 'splash' | 'land' | 'step', volume?: number, pitch?: number)`: include `pitch` in the emitted
  `'sfx'` event when defined.
- The footstep call: `this.sfx('step', surfaced ? ROAD_STEP_VOLUME : 0.6, surfaced ? ROAD_STEP_PITCH : undefined)` with NEW
  constants `ROAD_STEP_VOLUME = 0.5`, `ROAD_STEP_PITCH = 1.18` next to `STEP_EVERY`.

### 8.5 Step 5 - the fluid (shared files: small, one commit)

1. `src/core/types.ts`: `FluidKey` += `'bitumen'`.
2. `src/core/chem.ts`: `GRADES` += the bitumen row before `residue` (4.1).
3. `src/content/fluidsDistill.ts`: `f('bitumen', 'Bitumen', 0x1c1714, 'bitumen_canister')` after residue.
4. `src/core/distill.ts`: `CHEM_CONTAINERS.bitumen_canister = canister('bitumen')` after `residue_canister`.
5. `src/content/itemsDistill.ts`: `can('bitumen_canister', 'Bitumen', <desc 4.1>)`; edit the residue description.
6. `src/render/textures/distill.ts`: `item_bitumen_canister`.
7. Rosters: `specRosterDistill.ts` `items` += `'bitumen_canister'`; `specRosterTech.ts` fluid lists += `'bitumen'` (both
   lines ~64-65, in registry order after `'residue'`) and the table row `bitumen: ['Bitumen', false, false, null, 'bitumen_canister']`.

### 8.6 Step 6 - blocks and textures

1. NEW `src/content/blocksRoad.ts`:
   ```ts
   import { ageIndexOf } from '../magic/ageMap';
   import type { BlockSpec } from '../core/types';
   export const ROAD_BLOCKS: BlockSpec[] = [
     { key: 'asphalt', name: 'Asphalt', desc: '...', hardness: 2, tool: 'pickaxe', stack: 64, age: ageIndexOf('forge'),
       surface: { walk: 1.25, vehicle: 1.4 }, textures: { all: 'asphalt' } },
     { key: 'tarred_plank', name: 'Tarred Planks', desc: '...', hardness: 1.5, tool: 'axe', stack: 64, age: ageIndexOf('forge'),
       surface: { walk: 1.1, vehicle: 1.1 }, textures: { all: 'tarred_plank' } },
   ];
   ```
   Put the multipliers in named constants in the same file (`ASPHALT_SURFACE`, `TARRED_PLANK_SURFACE`) so tests import them
   instead of repeating 1.25 / 1.4.
2. `src/content/blocks.ts`: `import { ROAD_BLOCKS } from './blocksRoad';` and append `...ROAD_BLOCKS` after the last group of
   the `BLOCKS` array present at merge time (today `...GLASS_BLOCKS`).
3. Textures `asphalt`, `tarred_plank` (4.8) in `src/render/textures/distill.ts` (or the file where block tiles of that module
   are registered - follow how `chem_*` tiles are registered there).
4. Rosters: `specRosterDistill.ts` `blocks` += `'asphalt', 'tarred_plank'` (at the end, matching append order) and `blockProps`
   entries `{ shape: 'cube', solid: true, opaque: true, tool: 'pickaxe' | 'axe', minTier: 0, machine: undefined/null as the roster
   expects for plain blocks, itemKey: 'asphalt' | 'tarred_plank' }` - copy the exact shape the roster uses for plain blocks from
   `specRosterWorld.ts` or `specRoster.ts`.

### 8.7 Step 7 - reactions, cards, side goal (needs Unit 0)

1. `src/core/reactions.ts`: `ReactionSpec` += `/** Least share of each listed component the vessel's mix must hold for this reaction to run (Unit 9). */ minShare?: Partial<Record<Component, number>>;`
2. The engine's run test in `src/sim/distill.ts` (Unit 0's reaction selection): add `&& meetsShare(v.mix, r.minShare)` with a
   tiny helper (reuse `share` from `src/core/chem.ts`); and the problem line of 5.4 when it is the only failing condition.
3. `src/content/reactionsDistill.ts`: append `rx_asphalt`, `rx_tar_planks` (4.3, 4.4), using `ageIndexOf`/`AgeName` as Unit 0's
   type dictates (`age: 'forge'` if `AgeName`).
4. `src/content/recipesDistill.ts`: append the three cards to `PROCESS_CARDS` (4.2, 4.5). Extend `distillProcess.test.ts`'s
   runner for item inputs if Unit 0 did not (4.5).
5. Side goal (4.9).
6. Codex: cards are extracted automatically. `scripts/codex/progression.json` belongs to Unit 12 for the distillery branch -
   Unit 9 does NOT edit it; it lists the three card ids in its PR so Unit 12 (or the coordinator) can slot them in.

### 8.8 Helpers to reuse (do not rewrite)

`share`, `meets`, `nameOf`, `expand`, `bubblePoint` (`src/core/chem.ts`); `canister`, `CHEM_CONTAINERS`, `filledWith`
(`src/core/distill.ts`); `can(...)` (`itemsDistill.ts`); `card(...)`, `amounts` (`recipesDistill.ts`); `solidHeight`
(`src/player/collision.ts`); `blockOf` (`src/core/registry.ts`); `ageIndexOf` (`src/magic/ageMap.ts`); `buildRig`, `feed`,
`runUntil` (`src/sim/distillKit.ts`); `FakeWorld` (`src/game/fakeWorld.ts`).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest; exact cases)

### 9.1 `src/player/surface.test.ts` (NEW)

1. `surfaceOf` returns `{ walk: 1.25, vehicle: 1.4 }` for asphalt, `{ walk: 1.1, vehicle: 1.1 }` for tarred_plank, `null` for
   grass, stone, plank and air.
2. `surfaceUnder` on a full asphalt block at y=9 with bottomY 10 - 0.05 -> asphalt, `solid: true`; over air -> `solid: false`.
3. Every block with a `surface` has `walk` and `vehicle` in [1, 2] (guards typos like 12.5) - iterate the registry.

### 9.2 Player speed (`src/player/physics.test.ts`, add a `describe('road surfaces')`)

Fixture: `FakeWorld`, a strip `fill(-2, 9, -60, 2, 9, 2, 'grass')` and a parallel strip of `asphalt` at x 10..14; player at
y=10 facing -Z (yaw 0), `moveZ: 1`, step at 1/60 for 3 s, then measure distance over the next 2 s.

1. Walking on grass reaches `WALK_SPEED` (velocity magnitude `toBeCloseTo(4.3, 1)`).
2. Walking on asphalt reaches `WALK_SPEED * ASPHALT_SURFACE.walk` (5.375, `toBeCloseTo(.., 1)`); distance over 2 s on asphalt
   / on grass `toBeCloseTo(1.25, 2)`.
3. Sprinting on asphalt reaches `SPRINT_SPEED * 1.25` (7.25).
4. Buffs multiply, not add: with Swift active (`p.buffs` drink `swift`), asphalt speed = `WALK_SPEED * SWIFT_SPEED_MULT * 1.25`.
5. Tarred planks: `WALK_SPEED * 1.1`.
6. Swimming over a submerged asphalt floor (water fill above it, body in liquid) moves at `SWIM_SPEED` (factor ignored).
7. A jump while running on asphalt: horizontal speed at the apex is still >= `WALK_SPEED * 1.2` (airborne keeps the factor).
8. Walking off the asphalt onto grass: within 1 s the speed is back to `WALK_SPEED` +/- 0.1.
9. Half on the road: player centre at x = 9.9 over grass while the box overlaps the asphalt at x=10 -> grass speed; centre at
   x = 10.1 -> asphalt speed.
10. Dev flight over asphalt: speed = `WALK_SPEED * FLY_SPEED_MULT` (no surface factor).
11. `reset()` clears the factor (teleport from asphalt to mid-air then land on grass: grass speed immediately on landing).

### 9.3 Tractor (`src/vehicles/tractor.test.ts`)

Fixture: the existing `field()` (grass at y 9) and a `road()` variant with `asphalt`.

1. `'drives 1.4x faster on asphalt'`: full throttle 3 s on `road()` -> `t.speed` `toBeCloseTo(MAX_FORWARD * 1.4, 1)` (7.7).
2. Reverse on asphalt -> `toBeCloseTo(-MAX_REVERSE * 1.4, 1)` (3.08).
3. Tarred planks -> `MAX_FORWARD * 1.1`.
4. Leaving the road: 3 s on asphalt then onto grass, full throttle -> after 1 s `t.speed` `toBeCloseTo(MAX_FORWARD, 1)` and at no
   step does speed fall below `MAX_FORWARD - 0.01` (it eases down, never brakes under the grass top speed).
5. `createTractor(...).surf === 1`; `fromSnapshot(snapshotOf(t)).surf === 1` even when the saved tractor was on asphalt (not saved).
6. Fuel per second unchanged on asphalt: `burn` over 3 s equal on both surfaces (`toBeCloseTo`).
7. `src/vehicles/tractorWork.test.ts` (or the existing work test): `tillSwath` over a row of `asphalt` and `tarred_plank`
   changes nothing and returns `count: 0`; over grass it tills (existing).

### 9.4 Chemistry (`src/sim/asphalt.test.ts`, NEW; uses `distillKit`)

1. Grade: `nameOf({ bitumen: 970, lube_base: 30 }) === 'bitumen'`; `nameOf({ bitumen: 600, lube_base: 300, diesel: 100 }) === 'residue'`;
   `nameOf({ bitumen: 800, lube_base: 200 }) === 'residue'` (0.8 < 0.85); `expand('bitumen', 1000)` = `{ bitumen: 900, lube_base: 100 }`.
2. Order: in `GRADES`, the index of `bitumen` < the index of `residue`.
3. **Strip residue at 420 C** (pot still `'CR/F./B.'` on a furnace held >= 420 C, base set 420, 2 residue canisters poured):
   `runUntil` the flask is `done`; flask holds >= 1000 L with `share(bitumen) >= 0.85`; an empty canister used on the flask
   (`chemUse(d, fx, fy, fz, 'empty_canister')`) gives `bitumen_canister`. Total litres conserved to 1e-6.
4. Stopping early: same rig at 350 C ends with a flask that does NOT name `bitumen` (proves the "hotter" lesson; if the model gives
   >= 0.85 at 350, drop this case and note the actual share in the PR - the 420 case is the contract).
5. **rx_asphalt**: vessel on a base at 200 C (`'V/B'`), pour 1 `bitumen_canister`, `offerItem` 16 gravel + 8 sand; run 200 s
   simulated -> `out` holds exactly 32 `asphalt`, item slots empty, vessel mix total < 1e-6, vessel state `done`.
6. Stoichiometry per batch: after the first batch completes (run 41 s): 8 asphalt out, 12 gravel + 6 sand left, 750 L left.
7. Temperature window: base at 130 -> after 120 s, 0 asphalt and 1000 L untouched; base at 260 -> same; back to 200 -> runs.
8. **minShare**: pour a `residue_canister` + gravel + sand at 200 C -> after 200 s, 0 asphalt and the residue untouched; the
   vessel's view text contains `"too thin for Asphalt mix"`.
9. Partial batch: pour 900 L (3.6 batches; `feed(card, into)` takes a card, so pour directly:
   `pour(expand('bitumen', 900), v.mix, 900)`) -> 24 asphalt, 150 L left, 4 gravel + 2 sand left in slots.
10. Items short: 1000 L + 2 gravel + 2 sand -> 0 asphalt (needs 4 gravel); text contains `"needs 4 Gravel"`.
11. **rx_tar_planks**: 1 canister + 32 plank -> 32 tarred_plank, 120 s.
12. Both item sets present: 1 canister + 8 gravel + 4 sand + 16 plank -> 16 asphalt (2 batches) then 16 tarred planks
    (2 batches): deterministic order.
13. Stirred speed-up (only if the `stirredAt` hook exists): `d.stirredAt = () => true` -> first batch completes by 21 s.
14. Burner heat (only if Unit 7's ground burner exists - `it.skipIf(!BURNER_FUELS)`): a vessel on a burner with charcoal at set
    200 runs `rx_asphalt`.

### 9.5 Save

1. Tractor snapshot round trip keeps `surf` out of the snapshot (`'surf' in snapshotOf(t)` is false).
2. A vessel holding 8 asphalt in `out` and 4 gravel in `items` round-trips (covered by Unit 0's slot test; add one case with
   these keys so the asphalt item id is exercised).
3. A world snapshot with an `asphalt` block edit loads it back by key (block-edit-by-key path).

### 9.6 Content / roster tests

- `specRosterDistill.ts`: blocks += `asphalt`, `tarred_plank`; items += `bitumen_canister`; process card count +3
  (7 -> 10, assuming no other unit's card merged first - update the count to whatever the file holds +3).
- `specRosterTech.ts`: fluid lists and table row for `bitumen`.
- `content.test.ts`: progression completes (unchanged); the distillery reachability test now also proves `asphalt`,
  `tarred_plank`, `bitumen_canister` reachable at age forge through the cards.
- Texture readability test passes for `asphalt`, `tarred_plank`, `item_bitumen_canister`.
- `techContent` test: `bitumen` colour reads apart from every other fluid.
- Side goal: `pave_road` completes after 16 `block:placed` events of asphalt (simulate via `stats.placed.asphalt = 16` in the
  tracker fixture), never becomes the current main-track objective, toasts once.
- `distillProcess.test.ts`: `strip_residue`, `mix_asphalt`, `tar_planks` cards build and meet their outputs.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E (`scripts/e2e-distill.mjs` for the road walk and the mix; `scripts/e2e-vehicles.mjs` for the tractor)

Run: `node scripts/e2e-distill.mjs --device=desktop` and `node scripts/e2e-vehicles.mjs --device=desktop` (no `HW_GPU`). No new
UI, so phone portrait is not required (SYSTEMS 6c: "for any UI, also phonePortrait"); run `--device=phonePortrait` once anyway
for the vessel crosshair line length and attach the screenshot. Screenshots to `test-results/e2e-distill/` and
`test-results/e2e-vehicles/`. Use `window.__hw` only for setup and reading state; actions use real input.

### 10.1 `step('asphalt road: walking is 25% faster than on grass', ...)` (e2e-distill.mjs)

1. Setup: `hw.newWorld('road-e2e', 'survival')` (or reuse the script's world), find flat ground `y = hw.surfaceY(x0, z0)`; with
   `hw.setVoxel` lay two parallel strips 30 long, 3 wide: grass at x0..x0+2 and asphalt at x0+6..x0+8, from z0 to z0-30, with air
   above (clear 3 blocks up). Remove obstacles.
2. Grass run: `hw.teleport(x0 + 1.5, y + 1, z0 - 0.5)`, `hw.look(0, 0)` (yaw 0 faces -Z); hold `KeyW` with
   `page.keyboard.down('KeyW')` for 1.0 s (settle), read `hw.state().player` position `zA`, keep holding 3.0 s, read `zB`, release.
   `vGrass = (zA - zB) / 3`.
3. Asphalt run: same at x0 + 7.5. `vRoad`.
4. Assert `vRoad / vGrass` in [1.18, 1.32] (wall-clock frame jitter tolerance) and `vGrass` in [3.6, 4.8].
5. Screenshot `road-walk.png` looking down the asphalt strip (`hw.look(0, -0.3)`).

### 10.2 `step('asphalt mix: a heated vessel turns bitumen, gravel and sand into asphalt', ...)` (e2e-distill.mjs)

1. Setup (as the existing script builds rigs): a clay furnace lit and hot (the script's existing furnace helper), `still_base`
   on it, `reaction_vessel` on the base; tap the base with an empty hand (real Use) until the toast reads `"Still Base set to 200 C"`.
2. `hw.give('bitumen_canister', 1)`, `hw.give('gravel', 16)`, `hw.give('sand', 8)`; select each in the hotbar
   (`hw.selectSlot`) and Use on the vessel with the real Use key/click (`hw.lookAt` the vessel first).
3. `hw.tick(...)` 200 s of game time; read the vessel's crosshair text (target line) and assert it starts with
   `"Reaction Vessel - done"`.
4. Empty-hand Use: the pack gains 32 `asphalt` (`hw.state().inventory`). Screenshot `asphalt-vessel.png`.

### 10.3 `step('pave a road: placing 16 asphalt completes the side goal', ...)`

Place 16 asphalt with real right-clicks (look at the ground cells in a row with `hw.lookAt`, press the place button). Assert the
side goals list (from `hw.state().objective` or the objectives panel DOM, whichever Unit 0 exposes) contains `pave_road` done,
and a toast with `"Side goal: Pave a road"` appeared. Screenshot `pave-road.png`.

### 10.4 `step('tractor: 7.7 m/s on asphalt', ...)` (e2e-vehicles.mjs)

Reuse the script's tractor setup (it already places and fuels a tractor and drives with `page.keyboard.down('KeyW')`). Lay a
40-long, 3-wide asphalt strip with `hw.setVoxel` in front of it; drive 2 s, measure the tractor position over the next 2 s (via
`hw.state()` - the vehicles section the script already reads; if the debug summary has no tractor field, read the player's
position, which is the seat). Assert speed in [7.0, 8.0]. Same on grass (existing step or a parallel strip): [5.0, 5.9].
Screenshot `tractor-road.png`.

Also: `no console errors during the run` (existing final step) stays green.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/distillery.md`: "what exists" gains the `bitumen` fluid/grade/canister, the three cards, `rx_asphalt`,
  `rx_tar_planks`, `minShare`, the strip-residue lesson (420 C, >= 85%).
- `docs/api/player.md`: the speed rule with the surface term and the airborne/swimming/flight rules; `surface.ts` helpers;
  footstep pitch on roads.
- `docs/api/tractor.md`: top speed x `surface.vehicle` (7.7 on asphalt, 6.05 on tarred planks), roll-off, fuel per metre, the
  tiller ignoring roads, engine pitch load.
- `docs/api/world-content.md` (or `content.md`, wherever blocks are catalogued): `asphalt`, `tarred_plank` with their fields.
- `docs/api/textures.md`: the three new tiles/icons.
- Do NOT edit `docs/WHATS_LEFT.md` or `docs/build/SYSTEMS.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `bitumen` is a `FluidKey`, in `DISTILL_FLUIDS`, in `GRADES` before `residue` (need 0.85, mix 0.9/0.1), with
      `bitumen_canister` (stack 8) in `CHEM_CONTAINERS` and an icon.
- [ ] Two residue canisters at 420 C in a pot still leave a flask that bottles one `bitumen_canister` (unit test 9.4.3).
- [ ] `rx_asphalt`: 250 L + 4 gravel + 2 sand -> 8 asphalt in 40 s at 150-250 C, heated; `rx_tar_planks`: 250 L + 8 plank -> 8 in
      30 s. Residue does not react (`minShare`).
- [ ] `asphalt` (`{ walk: 1.25, vehicle: 1.4 }`) and `tarred_plank` (`{ walk: 1.1, vehicle: 1.1 }`) blocks exist, appended last,
      stack 64, age forge, drop themselves; tarred planks are not a fuel.
- [ ] Player speed = base x `buffs.speedMult` x surface, one line in `physics.ts`; swimming and dev flight ignore surface;
      airborne keeps the last grounded factor.
- [ ] Tractor top speed (both directions) x `surface.vehicle`: 7.7 m/s on asphalt; eases down off the road.
- [ ] Tiller leaves asphalt and tarred planks unchanged (test).
- [ ] Footsteps on a surfaced block: `step` at pitch 1.18, volume 0.5.
- [ ] Side goal `pave_road` completes at 16 placed asphalt; not on the main track.
- [ ] No new saved fields; old tractor snapshots load (`surf` 1).
- [ ] All crosshair strings <= 60 chars, T8 grammar.
- [ ] `npm test` green; `content.test.ts` progression completes; the three cards pass `distillProcess.test.ts`.
- [ ] E2E steps 10.1-10.4 pass on `--device=desktop`; screenshots saved.
- [ ] Docs of section 11 updated.
- [ ] No second speed multiplier anywhere (`grep -rn "1.25\|1.4" src/player src/vehicles` shows only the surface constants'
      imports, not literals).

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Asphalt slabs, ramps, stairs, road markings, curbs, coloured asphalt.
- Mobs, animals, golems (`GOLEM_SPEED`), Emberbound automatons or the skiff reading `surface` (the skiff runs on rails at its
  own step rate). Only the player and the tractor read surface in this build (SYSTEMS T5).
- "Never churns to mud" (DISTILLERY_PLAN 8.1): there is no mud mechanic; nothing to prevent.
- Fire spread / "does not rot": no such systems exist; tarred planks only stop being fuel.
- A bitumen block that "cools to bitumen blocks" (DISTILLERY_PLAN 8 oil tree): no; bitumen stays a fluid in canisters.
- Grease (lubricant + rosin + tallow) and any other heavy-oil product.
- The rail (`rail_tarred`, Unit 16) and skiff hull (Unit 13) recipes that use tarred planks.
- A speed readout on the driving HUD.
- Codex `progression.json` edits (Unit 12 / coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **New fluid `bitumen` + grade + `bitumen_canister`** (argued in 4.1). Please add a T3 "Adds" line and the T4 row of 2.3 to
   SYSTEMS.md, and the grade to Unit 0's `GRADES` insertion note (final order `... lubricant, lube_base, bitumen, residue ...`).
2. **`ReactionSpec.minShare?`** - one optional member requested of Unit 0's shape (4.3). Without it, residue poured straight into
   a vessel makes asphalt AND leaves lube base, skipping both the strip run and Unit 8's vacuum still. If Unit 0 lands first,
   Unit 9 adds it itself (one field + one check).
3. **Solidifying reactions in the conservation fuzz**: `out: {}` + `gives` means litres became items; Unit 0's fuzz must accept it
   (4.3).
4. **T4 row `tarred_plank`**: change "bitumen 125 L + 4 plank -> 4" to "bitumen 250 L + 8 plank -> 8" (same ratio; obeys 5.2's
   250 L minimum batch).
5. **Atmospheric residue split already works at 420 C** (3.2): the diesel + lube base distillate (~0.75 lube) will bottle as
   `lube_base` once Unit 0 adds that grade (need 0.6). That means lube base is reachable WITHOUT Unit 8's vacuum line (needing a
   Blast-era furnace hot enough to hold 420 C under glass, and a residue that only forge crude refining makes). Unit 8 should know:
   its vacuum still's selling point is "330 C: on a kerosene ground burner far from the furnace, and cleaner", not "the only way".
   If the owner wants vacuum to be the only way, Unit 8 raises the `lube_base` grade threshold above 0.75 (the 420 C distillate
   would then bottle as slop) - Unit 9's bitumen route is unaffected either way.
6. The residue canister description is edited by Unit 9 (4.1). If Unit 8 also edits it, merge to: `"What crude oil leaves in the
   flask: lube base and bitumen. Boil it again at 420 C, or at 330 C under vacuum, and Bitumen stays behind in the flask."`
7. Side goal file: Unit 9 uses `DISTILL_SIDE_GOALS` if Unit 12's file exists at merge, else its own `ROAD_SIDE_GOALS` in
   `src/content/objectivesRoad.ts`. Either is fine; pick one at merge.
8. Codex: three new card ids for the distillery branch (`strip_residue`, `mix_asphalt`, `tar_planks`) for Unit 12's
   `progression.json` section.
9. Journey J1 step 7 is fully covered by e2e 10.2-10.4; the bitumen in J1 step 3 comes from Unit 8's vacuum run and names
   `bitumen` by this unit's grade.
