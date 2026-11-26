# Hearthwatt - congruence audit, conventions and integration streams

Written 2026-11-21 by a read-only audit session (branch `ccr-3c8b169f-e78nk2`, taken while the six-age refactor was still running, so file
and line references can shift by a few lines; names of files and symbols are stable). Sources: every plan in `docs/`, `docs/api/*`, and a
sample of `src/content`, `src/sim`, `src/game`, `src/workshop`, `src/magic`, `src/vehicles`, `src/core`. Nothing was built or run.
Claims marked **(unverified)** came from a doc and were not re-checked in code.

Owner decisions that this document takes as fixed: six ages Ember / Bronze / Forge / Current / Atomic / Star; Ember is handwork (no steam,
no machines, no electricity); Bronze begins steam and shafts, then the boiler multiblock, pressure, pneumatics; Forge is iron, steel and
heavy industry with the dynamo at the end; Current is electricity and the modern steam turbine; the furnace is the heart of the base;
in-world interaction beats UI screens; original art and names.

---

## 0. The five findings that matter most

1. **There are two steam/shaft worlds and neither knows the other.** `STEAM_PLAN`/`BRONZE_PLAN` describe a `MechSpec` shaft core, a copper
   kettle, rotor, boiler vessel, heat/steam/air nets. `grep MechSpec src` finds nothing. What exists instead is `src/workshop/kinetics.ts` +
   `workshop.ts`: a complete hand-crank-driven rotation layer with solver, jams, lubricant, gearshifts, signals, contraptions. Its power
   sources for steam-ish things are the OLD watt-based `water_wheel`, `wind_turbine`, `steam_engine` (`workshop.ts` ~line 34: a table of
   `rpm` and `suPerW: 1/50`), which are Forge/Current electric generators in `src/content/blocks.ts` / `recipes.ts` (`forge(2,'water_wheel')`,
   `forge(3,'wind_turbine')`, `forge(2,'steam_engine')`). So a Bronze player never gets a shaft source other than the crank, treadwheel,
   clockwork motor and tractor power take-off. **Stream A must decide to extend the workshop solver, not build `mech.ts` as written in
   STEAM_PLAN** (see D1, section 3.1).
2. **Several docs are stale about the workshop.** `OVERHAUL_PLAN.md` section 0 says rotation is a plan; it is built (`docs/api/workshop.md`,
   `WHATS_LEFT.md` section 2). `SESSION_CONTEXT.md` sections 10 and 11 disagree about what "left" means. Treat `docs/api/*.md` and the code as truth;
   fix the plans in stream G (task G1).
3. **Age gating is a placeholder.** `src/magic/ageMap.ts` maps `bronze` to index 0 (Ember) until the refactor. Workshop recipes are written
   `age: 0` (`recipesWorkshop.ts` `bench()` / `forgeR()`), so today **all Bronze workshop machines are craftable in the Ember Age**. After the
   refactor every "BRONZE" constant must resolve to the new index 1 and the recipes must be re-gated (section 3.4).
4. **The distillery and the workshop already touch (lubricant, spouts, drain) but the loop is open.** `LUBE` in `workshop.ts` knows Heavy Residue
   (`residue` fluid) and `pine_resin`; the distillery makes `residue` and `crude_oil` but there is no residue->lubricant can path end to end, and
   essentia/aspects are absent from distillation (the plan's "Clarity in the still" is a status entry, not a mixture component).
5. **Names clash in three places**: `copper_kettle` (Bronze steam) vs `kettle_pot` (Ember brewing); old `steam_engine` (Forge, dynamo-driving)
   vs the planned Bronze "Steam Engine" (piston onto shafts) vs the workshop's `steam_engine` entry in the rpm table; `boiler` (Forge-era cased
   machine in `blocksTech.ts`, sits on a furnace) vs the planned boiler multiblock. Details in section 3.

---

## 1. Theme, material, colour and signature moments per age

One sentence each, written for art, sound and writing sessions. Aspect and fluid colours are already fixed in code (aspects: `src/magic/aspects.ts`;
fluids: `src/content/fluids*.ts`); the age colours below are the **direction for new art**, not existing constants (no age-palette table exists
yet - stream G adds `docs/ART_DIRECTION` notes or a `src/render/textures/agePalette.ts` if the owner wants one).

| Age | Theme sentence | Signature material | Signature colour | Signature sound |
|---|---|---|---|---|
| Ember | Everything is made by hand, stroke by stroke, and the fire is a living thing you feed. | Fired clay, charcoal, bone, copper | Ember orange `#e8622a` on clay brown `#8a6a3c` | crackle, stone-on-stone strokes, kettle hiss |
| Bronze | Heat learns to move: water, steam and turning shafts carry the fire's work across the yard. | Bronze, oak axles, leather belts, brass-warm glass | Verdigris green-gold `#b89a4a` / `#4f9a85` | rhythmic cog ticks, a chuffing piston, safety-valve whistle |
| Forge | The furnace gets a blast and iron becomes steel; machines get heavy. | Iron, steel, coke, refractory brick | Slate blue-grey `#5a6672` with white-hot highlights | trip-hammer thud, roaring blast, rolling mill grind |
| Current | Invisible power in copper veins; light and signal everywhere. | Copper cable, silicon, glass, aluminium | Cyan-white `#8fd8ff` and warm lamp `#ffd95a` | hum, relay clicks, turbine whine |
| Atomic | Quiet danger and control: cool water around a hot heart. | Superalloy, fused quartz, heavy water | Reactor green-blue `#5cf0c0` over graphite black | Geiger-soft ticks, coolant flow, low drone |
| Star | The base finally burns like a small sun. | Star core, plasma-white metal | Gold-white `#fff2b0` | rising harmonic chord, then calm |

Hold the **hearth ladder** as the visual spine: clay furnace (grey-brown) -> bronze furnace (green-gold plate) -> blast hearth (slate, bricks, nozzle
glow) -> arc hearth (cyan electrodes) -> plasma hearth (violet-white) -> starhearth. Each step re-uses the same silhouette so players recognise "the furnace".

**Signature moments (one per slice, scripted by objectives/sfx, never a cutscene):**
- Ember: *first pour* - molten bronze runs from the crucible into a mould and the mould glows then dims.
- Ember: *first cup* - a boiling pail, a cup, a drip cone; steam rises and a buff icon appears.
- Bronze: *the first shaft turns* - the wooden axle starts, cogs mesh, the goggles read "16 rpm, load 6/24 su".
- Bronze: *the safety valve sings* - pressure crosses its set point and the whistle blows instead of the boiler bursting.
- Bronze: *the first thing moves itself* - grain on a belt, into a mill, out of a chute into a basin.
- Forge: *the blast* - air through the nozzle, the hearth flares, iron runs for the first time.
- Current: *first lamp* - the dynamo/turbine feeds a cable; the base lights from within.
- Atomic: *the pile goes critical* with a calm rising hum, not alarms.
- Star: *ignition* - 300 kW for 90 s; the sky tints and the base is "forever warm".
- Magic (cross-age, mostly Bronze/Forge): *the first scan* - the notebook names the aspects of the thing in your hand.

---

## 2. Systems matrix

Legend: **C** consumes, **P** produces, **Age** = owning age after the six-age refactor (current code placement in brackets if different).
"Should talk to but does not" are the integration seeds that stream section 5 turns into designs.

| System | Consumes | Produces | Age | Should talk to, does not yet |
|---|---|---|---|---|
| **Furnace / heat** (`sim/furnace.ts`, `hearth*.ts`) | fuels (sticks 450, logs 650, peat 900, charcoal 1000 C; bellows), crucible items | heat (C, kW), smelting, bronze alloy, glass, warm zone against cold | Ember (1-block) .. Star (multiblocks) | boiler/steam (old boiler sits on it; planned one is remote via thermocouples); essentia (`hearth siphon` exists - one-way); weather (rain on open flue); distillery ground burner (planned) |
| **Handwork** (`sim/handWork.ts`, `handRules.ts`, `recipesHand.ts`) | stroke input at stations, hot-window after pours | tools, plates, flour, rope/cloth/leather, moulds | Ember | workshop twins use the same recipes (good, via `recipesHand`); casting bench is inert (pour happens at furnace); hot metal in hand for anvil window; tractor/chainsaw don't use it; aspects on mould outputs exist only by keyword rule |
| **Brewing** (`sim/brewing.ts`, `brewActions.ts`, `core/brewing.ts`) | water, leaves/grounds, heat under pail, cups/cones | tea/coffee drinks with 3-min buffs (`game/brewBuffs.ts`) | Ember | sugar (no sweetener step), spirit/ethanol (no tincture/elixir path), distillery beakers, essentia (Clarity vial exists in the still only), hunger value for drinks |
| **Food / Sugar Rush** (`game/hunger.ts`, `buffs.ts`, `itemsSugar.ts`) | food items | hunger, well-fed, `sugar_rush` (speed up, well-fed burns faster) | Ember/Bronze (sap tapping) | only 4 sugar foods; no sugar in brewing; no alcohol buff; no distillery syrup->sugar rule verified (syrup fluid exists); farming crops don't feed sugar beet-type source (sap only) |
| **Farming** (`sim/crops*.ts`, `game/farming.ts`) | tilled soil, seeds, water, weather | crops, wild plants, bushes (tea/coffee regrow) | Ember | tractor harvester (exists, `tractorWork.ts`) vs planned `reaper` (Bronze) - one of them is redundant; sprinkler/fluid pipe irrigation; weather affects growth (verify), aspects `spring` linked to growth speed (no) |
| **Ground items** (`game/groundItems.ts`, `collectors.ts`, `render/groundItems.ts`) | drops from blocks, mobs, spills, belts | entities that fly to player; vacuum collector, hand vacuum | Ember core, vacuum Bronze | belts spawn items through `host.ground.spawn(..., delayS:0.5)` (works); no sort/filter on belts beyond funnels; magnet/electromagnet (Current) planned as one definition in `collectors.ts`; no fluids on belts |
| **Leaf decay / chainsaw / tractor** (`game/felling.ts`, `leafDrops.ts`, `vehicles/*`) | fuel (ethanol/gasoline/diesel through canisters), logs | felled trees, harvested rows, towing | Current (gated by tier today; notes say move to age on W0) | distillery fuels are wired (ethanol weak, others stronger - verify numbers); bar oil consumer unbuilt; tractor PTO into shafts built (24 rpm, cap 30); weather/mud; sap tapping needs tree state |
| **Fluids and pipes** (`sim/fluidNet.ts`, `pipeNet.ts`, `tanks.ts`) | pumps, tanks, buckets/canisters | water, lava, steam, crude_oil, fuel, + 11 distillery fluids | Forge (pipes, today tier 1-2) | `FluidKey` is a closed union in `core/types.ts` (every new fluid edits core); essentia tubes are a separate net (see magic); steam as a fluid is the old forge-era definition, the Bronze steam net is a separate design; tank support for distillery fluids unfinished |
| **Distillery** (`sim/distill*.ts`, `core/chem.ts`, `core/distill.ts`) | beakers/canisters of wash, sap, syrup, crude oil; heat; water | spirit, fuel ethanol, gasoline, kerosene, diesel, residue, slop | Bronze/Forge per `DISTILL_AGE` | essentia/aspects; shafts (stirrer hook, vacuum cap pump); lubricant (residue exists, can does not); potions/tinctures; fuel ethanol into furnace? ground burner; brewing (tea->tincture) |
| **Kinetic workshop** (`workshop/*`) | rpm from crank, treadwheel, clockwork motor, tractor PTO, old generator blocks; stress; lubricant | rotation, belts, press/mixer/deployer/arm/drill/saw/loom/hammer/quern effects, signals | Bronze (age index 0 today) | steam/boiler (no steam source on shafts in Bronze), wind/water as wooden primitives, lubricant can end to end, essentia servants (cranks only), belts into crates, signals into magic, weather |
| **Steam** (old: `boiler`, `steam_engine`, `steam_turbine`; planned: STEAM_PLAN, BRONZE_PLAN) | furnace heat + piped water (old); planned copper kettle/boiler vessel | steam fluid; watts via dynamo (old); rotation (planned) | old: Forge/Current; planned: Bronze | whole planned stack unbuilt; shafts must be sourced here (stream A) |
| **Power networks** (`sim/power.ts`, `nodes.ts`, `fission.ts`) | generators (solar, wind, combustion, geothermal, turbine, fission), batteries | watts to lamps, arc hearth, machines | Forge end .. Atomic | Dynamo (planned Forge end) between shafts and watts; weather already affects solar/wind in power (verify), but not workshop wind; essentia `spark` aspect is not drawable; signals (workshop) vs cables are separate and should stay so but a "relay" bridge is nice |
| **Essentia magic** (`magic/*`, `render/magic`) | land aspects via gathering rod, vials, jars, hearth heat | notebook scans, research tree (24), wellsprings, tubes, rune desk, infusion altar, pedestals, foci, clay servants, hearth siphon | Bronze..Forge (ageMap) | tubes aren't fluid pipes; aspect fingerprints are keyword-derived not authored per new item; servants only crank; spark/soul/void undrawable; no aura HUD; no interaction with weather or time of day; distillery (Clarity) one-off |
| **Dev Mode** (`app/devMode*`, `docs/api/dev-mode.md`) | creative item menu, flags | sandbox state | all | must enumerate new content automatically (check on every new stream); no objectives/Codex pollution flags |
| **Objectives** (`content/objectives*.ts`, `game/objectives.ts`) | events, `ObjectiveCondition` union | goals, rewards | per age | no condition for fluids, rpm/stress, aspects learned, research done (uses `flag`); ids spread across 4 files; age field is an index so refactor renumbers |
| **Codex** (`scripts/codex`, `Codex tab`) | content registries, progression tree, aspects | static site page, item map, research tree | all | planned items shown only as text; process cards (distillery) feed it; workshop recipe cards under goggles are in-game, not in Codex; regenerate with `npm run codex` after content changes |
| **HUD / UI** (`ui/hud`, `ui/screens`, `ui/kit`) | game state | target line, buffs, objective tracker, screens (furnace, machine, pipe, brewing, notebook, rune desk, workshop guide) | all | goggles readout vs HUD target line vs machine screen are three presentations of the same facts; the workshop guide is a screen (against the in-world preference) |

---

## 3. Contradiction and gap list

Severity: **B** blocks a stream, **M** confusing or exploitable, **S** small. File references are to the repo at audit time.

### 3.1 Duplicate or competing mechanics

| # | Sev | Finding | Where | Resolution (owner of fix) |
|---|---|---|---|---|
| D1 | B | Planned `MechSpec` shaft core vs built `workshop/kinetics.ts` + `workshop.ts` | `STEAM_PLAN` sections 1-3, `OVERHAUL_PLAN` A.9 `mechLite`, `src/workshop/*` | Keep the workshop solver. Add *sources* (steam rotor/engine, water wheel, windmill) as workshop part kinds with `{ rpm, capacity }` like `CLOCKWORK`/`pto` (A) |
| D2 | B | Old watt generators `water_wheel`, `wind_turbine`, `steam_engine` double as workshop shaft sources via a table | `workshop.ts` ~34, `blocks.ts` 197-200, `recipes.ts` 141-178 | Rename the Forge-era ones (e.g. `dynamo_wheel`) or create wooden Bronze twins (`wooden_water_wheel`, `windmill`) and drop the table (A) |
| D3 | M | Three "steam engines": Forge `steam_engine` (heat + water on furnace -> dynamo), planned Bronze piston engine, workshop rpm entry | `blocks.ts` 197, `STEAM_PLAN` section 2, `workshop.ts` | Old block becomes the **Steam Dynamo** (Forge end, electricity); the Bronze piston is `piston_engine` (A) |
| D4 | M | Two boilers: Forge cased `boiler` (on a furnace) and the planned boiler vessel multiblock | `blocksTech.ts` 55, `BRONZE_PLAN` section 6 | Keep the vessel as `boiler`; rename old to `furnace_boiler` and move it to Forge/Current as the steam turbine feeder, or delete it after tests (A) |
| D5 | M | Hand-station twins exist twice: workshop `mech_*` kinds and the planned `trip_hammer`/`millstone`/`saw_bench` items | `OVERHAUL_PLAN` A.4, `STEAM_PLAN` section 2, `itemsWorkshop.ts` (mech_saw, mech_millstone... are block keys in `BASE_STRESS`) | Use the workshop names; strike the STEAM_PLAN duplicates (A, C) |
| D6 | M | Collectors: tractor harvester vs `reaper` vs `mech_arm` + deployer with a hoe | `vehicles/tractorWork.ts`, `OVERHAUL_PLAN` A.7 | Tractor = Current-age mass harvest; reaper (Bronze) = 3x3 crop cutter on a shaft; keep both, make recipes distinct (C, E) |
| D7 | S | Vacuum: Bronze Chute + Vacuum Pump (BRONZE_PLAN 5.4), `vacuum_collector` (workshop), Hand Vacuum Pump (ground items) | `BRONZE_PLAN` 5.4, `itemsWorkshop.ts`, `game/collectors.ts`, `docs/api/ground-items.md` | One mechanism: `collectors.ts`. Chute network with a vacuum becomes a collector kind; do not build a second pull algorithm (A, C) |
| D8 | M | Two ways to make Bronze goods: cup/cone forge recipes vs Clay Table | `WHATS_LEFT` section 0 (owner decision pending) | Owner decides; recommended: delete cup/cone forge recipes (E) |
| D9 | S | Heat transport: planned thermocouples (BRONZE_PLAN) vs the existing `hearth siphon` (essentia) and furnace "warm zone" | `BRONZE_PLAN` 4.1, `magic.ts` | Not competing, but name them in a "heat" section of the Codex (G) |

### 3.2 Name clashes (decide once, record in the conventions sheet)

| Clash | Decision |
|---|---|
| `copper_kettle` (steam, Bronze) vs `kettle_pot` (boiling water, Ember) | Keep both; `kettle_pot` = Ember Kettle Pot (boils water only); steam item = `bronze_kettle` is NOT used; use `steam_kettle` with display name "Copper Steam Kettle". Never display "Kettle" alone. |
| `steam_engine` x3 | see D3: Forge `steam_dynamo`, Bronze `piston_engine` |
| `boiler` x2 | see D4 |
| `water_wheel`, `wind_turbine` | Bronze wooden: `water_wheel`, `windmill` (axle output); Current: `wind_turbine` (watts) stays; Forge-era `water_wheel` recipe becomes the Bronze wooden one |
| `mech_pump` (STEAM_PLAN recipe item) vs `pump` (fluid pump, `blocksTech.ts` 50) | `pump` stays the electric/fluid pump; shaft pump = `mech_pump` in workshop style |
| `conveyor_belt` (code) vs `belt`/`drive_belt` (plans) | keep `conveyor_belt` (items) and `belt_pulley` (shaft link); never call the shaft link a "belt" in UI |
| `drive_shaft` (code) vs "wooden axle" (plans) | code name wins; display "Wooden Axle" in Bronze, "Iron Shaft"/"Steel Shaft" later as variants of the same block key with material in `variant` or separate keys `iron_shaft`, `steel_shaft` (A decides; recommended separate keys for tool/tier rules) |
| `six_cups` goal, `spirit_beaker` vs `spirit` fluid | cosmetic; beakers are the item form, fluids the pipe form: `<fluid>_beaker`, `<fluid>_canister` |

### 3.3 Items with no use / no source / dead ends

I did not run an exhaustive graph (that is a test, task G2). Observed from docs and content lists:

- **No source or no way to obtain at their age:** `lubricant` as a fluid or can (workshop has `LUBE` keyed on `residue` and `pine_resin`; since then a `lubricant_canister` exists in `src/core/distill.ts` and halves chainsaw bar wear,
  `src/game/felling.ts`, so this point is resolved); `bar oil` (resolved: the lubricant canister is the bar-oil consumer); `spark`/`soul`/`void` aspects (no source); `bent_pin` return (plan only, verify).
- **Dead-end fluids:** `slop` (distillery waste: no use); `kerosene` (no consumer unless a lamp or jet fuel is added); `gasoline`/`diesel` have tractor/chainsaw use but
  no generator (the combustion engine burns only `fuel`: piped refined fuel or `fuel_canister`, `src/sim/fluidUse.ts`, `src/sim/machines.ts`); `sugar_wash`, `low_wines` only feed the still; `syrup` should reach sugar (rule not verified);
  `crude_oil` and `fuel` (old refined fuel) are older than the 11 new fluids and the relation between `fuel` and `gasoline/diesel` is not documented - **one of them must absorb the other** (see section 4, B7).
- **Closed-union cost:** `FluidKey` is a literal union in `core/types.ts` - every new fluid (steam variants, lubricant, essence) touches core. Convention below: fluids append, never reorder.
- **Items that exist but have no recipe consumer:** unknown; expect some Atomic and glass beakers. Test G2 enumerates (item is craftable AND (used as input OR placeable OR consumable OR objective reward)).
- **Planned only (named in docs, absent in code):** thermocouples, hot plates, heat vents, boiler vessel, copper kettle, steam rotor, steam engine (piston), pressure gauge, safety valve, air compressor/tank/tubes, pneumatic press/drill/hammer, blast nozzle, dynamo, vacuum pump block, iron/steel shafts, rolling mill, drop forge, crusher.

### 3.4 Recipes that bypass the age gates

- **All workshop recipes are `age: 0`** (see finding 3). A Bronze Workshop in the Ember Age is craftable with workbench bronze/copper recipes. After W0 set `age: 1` through the single `BRONZE` constant (`itemsWorkshop.ts` imports it from `ageMap`) - but also check the *station*: Ember bench recipes should not use bronze ingots in quantity unless the age 1 gate holds.
- **Workbench recipes that craft machines from raw materials** (`bench()` rows in `recipesWorkshop.ts`) skip the "forge it" step; Bronze machines should need the bronze furnace tier (W0 adds `minTier 1`): `forgeR` already uses `minTier: 1` - that tier today is the **Clay furnace**, since tier 1 = Ember. W0 renumbering turns it into Bronze only if all `minTier: 1` literals are bumped. Search for the literal `minTier: 1` in all recipe files after W0 (task G2).
- **Vacuum pump, chainsaw, workshop parts and magic ages are gated by tier today** (WHATS_LEFT); notes in `docs/api/ground-items.md` and `docs/api/chainsaw.md` say where to move them.
- **Magic gates:** `src/magic/gates.ts` gates glass vial, rod and jar recipes by research; Bronze/Forge entries should depend on the same age names - verify `AGE_INDEX` use in `entries.ts` after W0.
- **Tractor/chainsaw as Current**, but the distillery makes their fuel in Bronze-Forge: fine, but the tractor's PTO into shafts means a Current vehicle drives Bronze machines. Acceptable (a reward), but it bypasses the crank/treadwheel/steam ladder in a sandbox. Either gate the PTO behind Forge or accept it as a late-game convenience (owner decision, default: accept).

### 3.5 Other contradictions found in docs

| # | Finding | Fix |
|---|---|---|
| X1 | `OVERHAUL_PLAN` section 0 says rotation is a plan; `api/workshop.md` and code say built | Update OVERHAUL_PLAN with a "status" box; keep the design text (G1) |
| X2 | `PROGRESSION.md` "Age 0 goals" list *Italic = planned* but some are built (clay table, casting, hand quern) | Re-mark after the refactor (G1) |
| X3 | `SESSION_CONTEXT.md` has duplicate section numbers (two "## 7"), sections 10-12 repeat | Renumber on the next pass; low priority (G1) |
| X4 | `PROGRESSION.md` says "Ember Kettle Pot is a different block from the Bronze Copper Kettle"; there is no mention of `steam_kettle` naming | Add to conventions (this document section 4) |
| X5 | `STEAM_PLAN` section 8 "state of the repo" is dated; the shaft core claims "nothing exists" and it is true for `MechSpec` only | Replace with a pointer to section 0 here (A) |
| X6 | `DISTILLERY_PLAN` section 11 puts the still in an age through `DISTILL_AGE`; `PROGRESSION` says the still is Current | Distillery plan wins for glass (Bronze, hand-fed), Current still is the older `techMachines.ts` still (a *different*, electric still). Name them `glass still` vs `electric still` in the Codex (B, G) |
| X7 | Star hearth: 93 casings, pending owner decision | Reduce or keep: **recommend keep 93 but allow a smaller "compact star shell" achievable with superalloy hatches** (F) |
| X8 | "Rack under glass keeps running", "crops without farmland stay without growing", "steam engine draws heat when idle" in `SESSION_CONTEXT` section 6 | Fix when touched (E, A) |
| X9 | `Saves`: `SAVE_VERSION = 1` in `src/save/document.ts`; W0 needs a migration and a **fixture of an old save** committed first | W0 session owns; every later stream appends save keys without bumping unless changing shape (see conventions) |

---

## 4. Conventions sheet

Everything here is either already true in code (cited) or a **decision** (marked D). Parallel streams must follow it; if a decision is wrong, change it here first.

### 4.1 Naming

- **Keys**: `lower_snake_case`, ASCII, stable forever (saves store keys). Never rename a key; add an alias in sanitize/migration instead (`src/sim/sanitize.ts`, `src/save/document.ts`).
- **Items vs blocks**: a placeable thing has a block key and an item key that are the same string. Do not suffix with `_block` or `_item`.
- **Material before shape**: `bronze_ingot`, `iron_plate`, `copper_coil`, `steel_shaft` (D). Tool kinds: `<material>_pickaxe`, ..., `<material>_maul`.
- **Containers of fluids**: item `<fluid>_beaker` (glass, 125 mL? **unverified amount; see `content/amounts.ts`**), `<fluid>_canister` (8 stack; large), bucket = 1000 mL with `FluidSpec.bucket`. The fluid key is the bare name: `spirit`, `residue`.
- **Display names**: Title Case, original names only (no Create/Thaumcraft/Minecraft names). Existing homages are tolerated internally (`item_vault`) but displayed names must be ours: use "Wooden Axle", "Gear Case", "Stamp Mill", "Field Notebook".
- **Ages**: the lower-case names `'ember' | 'bronze' | 'forge' | 'current' | 'atomic' | 'star'` (`AgeName` in `src/magic/ageMap.ts`). Code uses a numeric index (0-5 after W0); **new content must use `AgeName` via `ageIndexOf()` / its age constants, never a bare number** (D). Display: "Ember Age", etc.
- **Aspects** (all lower-case): primals `cinder loam brook gale rune rift`; compounds `glow spring vein frost ash wane drive craft mind ward steam clarity`; late `spark soul void` (`src/magic/aspects.ts`). New aspects require a tier, two parts, a colour and a research entry.
- **Events** (`src/core/gameEvents.ts`): `namespace:verb` (`cast:poured`, `mech:seized`). New events append to the union.
- **Machine roles** (`MachineRole` in `core/types.ts`): keep existing; new `role` values append.
- **Test fixtures**: roster file names `specRoster<Area>.ts`, one line merge in `specRoster.ts`, and a count line in `content.test.ts`.

### 4.2 Units

| Quantity | Unit | Where |
|---|---|---|
| Temperature | degrees C (integer display) | furnace, recipes `minTempC` |
| Heat flow | kW | thermocouples (planned 6 kW/line bronze, 20 kW iron) |
| Electrical power | W (display kW/MW) | `core/constants.ts`, `power.ts`; storage J |
| Rotation | rpm, signed (negative = reverse) | `workshop/kinetics.ts`; base rpm 16 (`STROKE_S` 0.5 s at 16 rpm; belt 1 block/s at 16 rpm) |
| Stress | su ("stress units"); capacity of sources vs load; `BASE_STRESS` table | `kinetics.ts` |
| Watts to stress | `suPerW = 1/50` for converted generators (`workshop.ts`) | until D2 is resolved |
| Fluid | litres (L) in code, called mL in some recipe docs: **use L for machines, beakers/vials in mL where a recipe shows 125/250 mL**; `FluidSpec` bucket = 1000 L | `content/amounts.ts` |
| Pressure | bar (Bronze steam), 8 bar bursts without valve (planned) | `BRONZE_PLAN` |
| Essentia | integer units; jars 32; max 8 per aspect in a fingerprint, max 4 aspects (`aspectTable.ts`) | `magic` |
| Time | game seconds in sim (`dt`), real-time in UI; day length in `game/clock.ts` | |
| Durability | integer uses | `ItemSpec` |

### 4.3 Recipes, stations and temperatures

- Stations (existing): `workbench`, `furnace` (with `kind: 'forge'` or smelt rows), hand stations (chopping block, quern, stone anvil, mortar, clay table, casting bench, drying rack, tanning trough, loom), brewing pail/cup/cone, glass still modules (cards), workshop `basin:<id>` rows, Rune Desk and infusion altar.
- **Rule 1 (D):** the more a recipe resembles a transformation of heat/force, the earlier it should be on a physical station; **workbench is for assembly of already-made parts only**. A workbench row whose inputs include an ore, raw dust or fluid is a smell.
- **Rule 2 (D):** furnace forge rows carry `minTier` (furnace tier = age index + 1 after W0? **tier numbering is decided by W0; read `FurnaceTierSpec`**) and `minTempC`: copper 700, bronze 800 (Ember), Bronze-age rows 700-1100, iron 1150, steel 1400, silicon 1700, tungsten 2000.
- **Rule 3 (D):** a recipe can raise at most one gate: age, research, or tier (two when the second is a safety check). Research gates are implemented through `magic/gates.ts` `setCraftGate`, never by editing the recipe function.
- Hand recipes live in `recipesHand.ts` and **machines read them** (twins keep the same rows; time = seconds / (rpm/16)).
- Distillery recipes are cards (`recipesDistill.ts` `card(...)`: id, vessel, inputs, outputs, temp, time, pressure/aux, glyph string). Process cards feed Codex, ghosts and tests: add a card, not an ad-hoc rule.

### 4.4 Tool and tier ladder

Mining tiers 1 (wood/stone/flint) .. 5 (endgame) per `BlockDef.minTier`. Ember: flint then bronze tools (bronze = tier 2 equivalent) - **bronze tools are made in the Ember Age by hand casting** (Ember plan), so the Bronze Age does not start with a tool upgrade but with machines. Forge: iron (3), steel (4); Current: tungsten/arc maul (4-5); Atomic: superalloy/power drill (5). Weapon/armour ladders follow the same names (iron/steel mauls, plated coat, steel cuirass, shield suit). New blocks choose `tool` and `minTier` from this ladder; machines made of metal need `pickaxe` tier of their age.

### 4.5 How a new system registers (checklist for every stream)

1. **Content**: block rows in `src/content/blocks<Area>.ts` appended LAST so voxel ids never move (id is 10 bits; facing 2, active 1, variant 3 - `docs/api/world.md`); items `items<Area>.ts`; machines `techMachines.ts`/`machines<Area>.ts`; fluids `fluids<Area>.ts` and `FluidKey` union in `core/types.ts`.
2. **Recipes** in `recipes<Area>.ts` and the `RECIPES` index; cooking/hand rows in `recipesHand.ts`.
3. **Fixture**: `specRoster<Area>.ts` + merge in `specRoster.ts` + counts in `content.test.ts` / `worldContent.test.ts` (the tests count items, blocks, recipes; they fail if you forget).
4. **Solver rules** for sim-driven things: workshop part kinds in `workshop/kinetics.ts` (`BASE_STRESS`, `passOn`) and `workshop.ts` (`CYCLES`, source table); chem rules in `core/chem.ts` + `REACTION_SPECS`/`PROCESS_SPECS`.
5. **Aspects**: every item and block gets a fingerprint automatically from `src/magic/aspectTable.ts` (`KEYWORD_RULES`, `CATEGORY_BASE`, `AGE_BONUS_PER_AGE`, `OVERRIDES`); **new content must add keyword rules or overrides so its fingerprint reads sensibly** (D), and `magic.test.ts`/`fingerprint.test.ts` check budget (max 4 aspects, max 8 each).
6. **Codex**: `scripts/codex` reads registries; add the item to a progression branch in `content/progression.ts` and regenerate (`npm run codex`). Planned items are listed with `[planned]` until they exist.
7. **Objectives**: add an id to the relevant `objectives*.ts`; `ObjectiveCondition` types in `core/types.ts` are limited (have, make, place, break, furnaceTemp, furnaceTier, generate, stored, flag, any); use `flag` events for anything else (D) and add typed conditions only when 3+ goals need them.
8. **Save keys**: sim state serialises through each system's `save`/`load` into the world save (`src/save/document.ts`, `isWorldSave`, `normalizeDocument`). Add a key to the document and a default in `normalizeDocument`; do not bump `SAVE_VERSION` unless shape breaks. Missing keys MUST load as empty.
9. **Sounds**: add a name to `SfxName` in `src/core/gameEvents.ts`, a recipe in `src/audio/sfx<Area>.ts`, list it in `sfx.test.ts`'s expected names; ambience layers in `src/audio/ambience*.ts`.
10. **Icons/textures**: painters in `src/render/textures/*` (five-step ramps in `palette.ts`), tile listing in `render/atlas`/`textures.test.ts`; item icons from `render/icons.ts`. Every item/block needs a texture or the tests fail.
11. **Render** for in-world animation lives in `src/render/<area>/`, instanced renderers for repeated parts.
12. **Docs**: one `docs/api/<area>.md`; add to `SESSION_CONTEXT.md` only the commit range and state.
13. **e2e**: a `scripts/e2e-<area>.mjs` and a line in `package.json` chain; run under the `.run-lock` mutex when others are building.

### 4.6 UI language and phone interaction

- **In-world first** (owner): prefer a block you press/hold/strike, a status sentence on the HUD target line, a ghost preview, or a goggles readout over a modal screen. A screen is justified only for inventories of many things (notebook, research board, Codex, rune desk) or a settings panel.
- Touch target >= 44 px (`--hw-tap` 44px in `ui/styles.css`, `IconButton` 44 px). Phone breakpoint `(max-width: 719.98px), (max-height: 519.98px)`; windows become full-screen sheets on phones; no page scroll; long-press (420 ms) = secondary action.
- Every machine has **one status sentence** (<= 70 characters, "Quern: grinding wheat, 14 rpm, load 4/24 su") shown on the target line and by goggles; planned exact strings exist in `BRONZE_PLAN` section 10. New machines add theirs; failures use verbs ("seized", "overheating", "out of fuel") and say what to do ("add a clutch").
- Copy: second person, plain, <= 2 sentences per description, no jargon without a Codex entry; numbers with units (`16 rpm`, `1100 C`, `8 bar`, `2 kW`).
- Buttons are verbs; toasts at most 3 s; never block movement with a modal during survival hazards.
- Fonts: IBM Plex Sans / Plex Mono (class `hw-num` for readings).

### 4.7 Colour and art direction

- Voxel world with painted tiles from code (`src/render/textures`), five-step ramps per material, a gentle S-curve and warm highlights (`textures.md`).
- Per age signature (section 1). Fluid colours in `FluidSpec.colour` (water `0x3a86b4`, lava `0xff7a1e`, steam `0xe6ecf0`, crude `0x1d1814`, fuel `0xe2bc3a`); **aspects keep their `AspectInfo.color` everywhere** (cinder `#e8622a`, loam `#8a6a3c`, brook `#3f8fd8`, gale `#cfe6ee`, rune `#a77fe0`, rift `#5a3a6e`, glow `#ffd95a`, spring `#5cc060`, vein `#c7a24a`, frost `#9fd6ff`).
- Machines read by *state*: heat = emissive glow by temperature (`glows.ts`), motion = turning parts (workshop renderer), fluid level = window, essentia = floating motes in the aspect colour. A machine that does something must **show it** (no silent processing).
- Glass always has the same blue-white transparency; metal parts carry a material colour (bronze `#b89a4a` verdigris edge, iron slate, steel bright).

### 4.8 Sound conventions

- All sfx are synthesised in `src/audio/sfx*.ts` with `SfxName` strings: `<area>_<what>` e.g. `essentia_pour`, `scan_chime`. One sound per player-visible action, plus one ambient layer per running machine class (`ambience*.ts`, with weather layers separate). A new loop must have a volume budget in the ambience test and respect distance attenuation.
- Pitch encodes state (machines whine up with rpm, down with load); never add speech.
- Phone: master volume and mute in Settings; no autoplay before first touch.

---

## 5. Prioritised integration work list (streams)

**Ordering.** The six-age refactor (W0) lands first and exclusively. After it, run **A first** (it unblocks C, D, E and part of F), with **B, E and F-content** in parallel as soon as W0 lands; **C** can start with the non-steam items; **D** after the Bronze sources exist; **G** is last. Each stream should be one session, one branch, rebase on W0 (never merge another stream's branch). Shared files all streams touch (`src/core/types.ts`, `content.test.ts`, `specRoster.ts`, `package.json` e2e chain, `src/app/game.ts`, `src/audio/sfx.ts`): append-only, small commits, **rebase before every commit**.

Every stream's end state: `npx tsc --noEmit` clean, `npx vitest run` green, its own e2e passes on desktop and phone portrait (`HW_GPU=1`), `docs/api/<area>.md` updated, Codex regenerated, no key renamed, no voxel id moved.

### Stream A - Steam and Bronze mechanics (STEAM_PLAN + BRONZE_PLAN, reconciled)

**Owns:** `src/sim/{heatNet,steamNet,airNet,netGraph,boilerVessel,structureScan}.ts` (new), `src/content/{blocksSteam,itemsSteam,recipesSteam,specRosterSteam}.ts` (new), `src/workshop/{kinetics,workshop}.ts` (add source part kinds only), `src/render/steam/` (new), `docs/STEAM_PLAN.md`, `docs/BRONZE_PLAN.md`, `docs/api/steam.md`. Shares append-only: `core/types.ts` (FluidKey `steam_low`? no: keep `steam` and add `air`), `core/gameEvents.ts`.
**Does not touch:** distillery, magic, handwork.

Designs (one concrete picture each):
1. **Wooden primitives first.** `windmill` (turns by `windAt`, height gives capacity) and `wooden_water_wheel` (two water sides) become workshop *source kinds* (`{rpm, capacity}` like `CLOCKWORK`), replacing the watt table (D2). Player sees: a windmill on a hill, the wooden axle trundling down to a quern. Goggles: "Windmill: 12 rpm, wind 0.8, load 6/18 su." Weather already provides wind; storm gusts raise stress capacity and a heavy gust shears a pin (hooks the shear pin).
2. **Copper steam kettle + rotor.** `copper_kettle` sits on the clay or bronze furnace (adjacent heat) and takes a water bucket; at the boil it makes steam that spins a `steam_rotor` placed on top. Player sees: a sealed copper pot, a puff, the rotor whirling, a shaft starting; running dry warps the kettle (rule from STEAM_PLAN). This is the "heat makes motion" moment.
3. **Thermocouples carry heat, not fuel.** A bronze strip running from the furnace to a plate: the plate glows by temperature and burns your hand; boiler heat ports take heat from it (BRONZE_PLAN 5.1). Reuse the **hearth siphon pattern** from magic (one-way heat taken by a neighbour).
4. **The boiler vessel multiblock** built from a ghost preview in the Structure planner; `scan` reuses `hearthScan`. Safety valve + pressure gauge; burst after a 5 s warning above 8 bar with no valve; the valve **whistle** is the signature sound. Pressure shows on the **goggles** (not a new screen).
5. **Piston engine** (`piston_engine`) turns 16 rpm/bar with 128 su/bar capacity: the first strong shaft source. Rename old `steam_engine` to `steam_dynamo` (Forge end, watts) per D3.
6. **Pneumatics**: compressor on a shaft -> air tubes -> tank (6 bar, leaks at open ends) -> pneumatic press/drill/air hammer; new `air` fluid (append to `FluidKey`); the tubes should look like the essentia tubes but copper (same render code if possible, different net).
7. **Vacuum chute = collector**: see D7. A chute network with a vacuum pump calls `collectors.ts` (no new pull algorithm); items rattle through glass-ended tubes.
8. **Blast nozzle gate** to the Forge: brick walls + nozzle fed at 2 bar -> blast hearth forms (Forge gate; edits `hearthScan` + progression gate only).
**Acceptance (golden tests + e2e):** (a) windmill + crank-free quern grinds wheat headless (unit); (b) kettle boils a bucket and the rotor reaches 16 rpm; dry kettle warps; (c) boiler with no valve bursts after 5 s above 8 bar; (d) air tank leaks when a tube end is open; (e) blast hearth forms only with nozzle at 2 bar; (f) old saves load (fixture); (g) `e2e-steam.mjs` builds kettle -> axle -> mill on desktop and phone. Also: D1-D4 resolved, old items renamed with aliases in `sanitize.ts`.

### Stream B - Distillery completion (DISTILLERY_PLAN section 15)

**Owns:** `src/sim/distill*.ts`, `src/core/{chem,distill}.ts`, `src/content/{blocksDistill,itemsDistill,recipesDistill,fluidsDistill,machinesDistill,specRosterDistill}.ts`, `src/render/distill/`, `docs/DISTILLERY_PLAN.md`, `docs/api/distillery.md`. Shares append-only: `core/types.ts` FluidKey, `fluids.ts`.
Designs:
1. **Lubricant, end to end.** Vacuum cap on a rig separates `residue` into `lubricant` (new fluid) and bitumen; a `lubricant_can` is filled at a tank spout (workshop `spout`), used on a shaft: the goggles show "oiled, 9 min left" and the stress capacity rises (workshop `LUBE`). The chainsaw bar-oil consumer drinks the same can. Player sees oil sheen on the axle and the shaft quietens (sound filter).
2. **Essentia in the still (aspect distillation).** A rig fed a jar's aspect or a herb produces an "essence" item (`<aspect>_essence`, appended `ItemSpec` per primal aspect) at low yield; the Clarity vial entry becomes a real reaction card. Essence makes tinctures and elixirs. Visuals: the column glows in the aspect colour. (Coordinates with D.)
3. **Tinctures, potions, drinks, antiseptic bandage:** brewing buffs (`game/brewBuffs.ts`) gain alcohol-extracted variants: Green Tea tincture (longer jump), Berry Tea elixir (heal over time), Spirit as a drink (warmth, slows aim - small cost), Fuel ethanol in the **ground burner** (charcoal-free fire). Drinks reuse `drink.ts`.
4. **Ground burner & reflux head & filter bed**: single-block hand-fed heat for the first rigs (no furnace needed); reflux head raises purity; filter bed (sand, charcoal) cleans slop into water.
5. **Rig screen and ghost previews** (in-world preferred: ghosts + goggles sentences; screen only for a recipe card).
6. **Tank/pipe end to end**: tanks accept all 11 fluids; receiver -> pipe -> tank; shaft stirrer hook in the workshop (a Bronze stirrer lowers batch time; B reads workshop `driveAt`-like API: coordinate with C).
7. **Refinery tower** (late, Forge): catalyst bed + pressure cap + cracker: crude -> gasoline/kerosene/diesel by cut height. `slop` and `kerosene` get consumers: kerosene lamp (light without power, Bronze-Forge), slop -> fertiliser.
8. **Merge `fuel` (old refined fuel, `fluids.ts`) into the new fuels** (B7): keep key `fuel` as an alias of `gasoline` in sanitize, or rename in the oil tech chain; the combustion generator consumes `diesel`/`gasoline`/`fuel_ethanol` with different efficiency.
**Acceptance:** rig golden tests for lubricant and essence; a `distill:step` event; each new fluid has a tank test; `e2e-distill.mjs` runs bottle -> spout -> can -> shaft oiled, desktop + phone; `content.test.ts` counts updated.

### Stream C - Workshop polish and Create-style gaps

**Owns:** `src/workshop/*` (except source kinds, which A adds), `src/render/workshop/`, `src/content/{itemsWorkshop,itemsWorkshopParts,recipesWorkshop,objectivesWorkshop,specRosterWorkshop,basinWorkshop}.ts`, `docs/api/workshop.md`.
Designs (from WHATS_LEFT section 2 plus new):
1. **Smooth tweening of moving structures** and **riding the skiff** (seat = player locked to the skiff, view bobs with rail grade). Test: skiff carrying a player down a rail doesn't desync collision.
2. **Treadwheel with tamed animals** (`mobs.md`): a goat or hound on the wheel gives 12 rpm; the horn calls it. Animals tire (stamina) and need food -> farming/hunger link.
3. **Belts cross structure borders** and **belts into crates**: a belt ending against a crate adds the item (via `accept` -> `acceptCrate` already exists), so a field -> belt -> crate loop works without a funnel. Visual: crate lid opens.
4. **Continuous spouts**: a spout connected to a pipe network fills any container on a depot every second (no bucket needed): distillery bottling line.
5. **Punched gearshift cards** as an item with a visible pattern; Use on the gearshift loads it; cards are craftable at the workbench with a punch tool. The three presets stay as defaults.
6. **Item vault multiblock growth** and a **sorting funnel** (filter slot, whitelist of items); belts show item sprites moving (done) and texture direction (belts animate).
7. **Trinkets**: wind vane (reads `windAt`, rotates), weather cock, spyglass (zoom, long-press on phone), brass horn, padlock chest, lantern chain. Ship each as a block with a status sentence; trinkets feed the Codex "decor" branch.
8. **Weather and machines**: rain makes belts slip (speed x0.8 outdoors unless under a roof, read `weather.ts` precipitation + sky exposure), frost thickens water wheel flow, storm wind may bend a windmill (stress spike). Tiny, readable, goggles show "wet belt".
9. **Vacuum/magnet collector**: `vacuum_collector` already exists; make it a kind in `collectors.ts` with the same API the magnet will use.
**Acceptance:** unit tests per part; goggles sentence per part; `e2e-workshop.mjs` extended: field -> belt -> mill -> chute -> crate; no regression in the six workshop goals; phone portrait e2e. **Fix first:** re-gate recipes to Bronze (C6); remove the generator table dependency once A lands.

### Stream D - Magic depth and tech/magic tie-ins

**Owns:** `src/magic/*`, `src/render/magic/`, `src/content/{itemsMagic,recipesMagic,specRosterMagic}.ts`, Codex Essentia tab, `docs/api/magic.md`.
Designs:
1. **Aspects on every new item** (task D0, runs after each stream): extend `aspectTable.ts` keywords: e.g. `kettle` -> cinder+brook+steam, `shaft/axle` -> drive+loam, `windmill` -> gale+drive, `piston` -> steam+drive, `lubricant` -> brook+glow, `spirit` -> cinder+clarity, `residue` -> loam+rift. A test lists items whose fingerprint is only `CATEGORY_BASE` (unmeaningful) and fails above a threshold.
2. **Servants on cranks, then on more**: a clay servant turning a crank (built) grows into a **golem socket**: a servant on a *deployer* or *treadwheel* seat. Spring + Mind feeds them. Player sees a clay figure patiently grinding; golems that walk stay off the list until after (keeps scope).
3. **Essentia tubes ARE a pipe net**: re-implement `essentiaNet.ts` on `pipeGraph.ts` with a fluid key `essentia` carrying (aspect, amount) pairs, so tubes share rendering, build tools and breakage with pipes. Existing saves migrate by adding tubes to the pipe snapshot (tests with a fixture).
4. **Steam aspect and the boiler**: a boiler fed a jar of `steam` essentia makes steam without fuel but the furnace's warm zone dims (Essentia replaces fire but not warmth) - magic costs a trade-off. Rod charge from furnace heat (hearth siphon exists) is the bridge back.
5. **Infusion altar upgrades items with aspects**: a lubricant can infused with `glow` never runs out; a hand crank infused with `drive` gives +50% capacity; a kettle with `cinder` boils with half the fuel. Each infusion is one small effect in a table (`INFUSIONS` in `magic/`), described in the notebook. Prevents power creep with a charge cost.
6. **Spark / soul / void drawable** in Current/Atomic: spark from lightning rods in storms (weather link) and from the dynamo's field, soul from mob drops (Emberbound), void from deep rift places (world feature). Each unlocks one late research chain (electric servants, wards, storage).
7. **Aura HUD dial**: a tiny dial on the compass that shows the local dominant aspect (colour) - not a screen, a HUD element.
8. **More research entries** (24 -> 36) for Bronze/Forge: one per new Bronze system (kettle, kinetic, still, belts, pressure), gated through `gates.ts`.
9. **Weather & time**: gathering rod draws more `gale` in storms and `cinder` at noon; wells recover by night.
**Acceptance:** `fingerprint.test.ts` coverage test; research board tests for new entries; the e2e-magic script covers tube-on-pipe-net and altar infusion; no regression in saves (fixtures).

### Stream E - Food, farming, brewing, sugar depth and cross-links

**Owns:** `src/sim/{brewing,brewActions,crops*,bushes}.ts`, `src/game/{farming,hunger,buffs,brewBuffs,drink}.ts`, `src/content/{itemsBrew,itemsSugar,recipesBrew,blocksBrew,machinesBrew,objectivesBrew,specRosterFood,specRosterBrew}.ts`, `docs/api/{brewing*,sugar,food*,crops}.md`.
Designs:
1. **Sugar in the cup**: sugar and syrup are sweeteners that change a drink's profile: Sweet Green Tea = Green Tea + sugar -> jump + Sugar Rush speed, with the well-fed burn penalty (the existing `SUGAR_*` constants). Player adds a sugar lump to the cup before the pour (no screen: Use with sugar on the cup).
2. **Alcohol path**: sugar wash -> low wines -> spirit (distillery) and a **fermenting jar** (Ember: clay jar + wash + days) that makes weak ale/cider you can drink raw. Drink buffs: Cider (warm + slow), Ale (hearty: hunger), Spirit (burn, heat resist). Alcohol should have a visible cost (aim sway) and a hangover-like "well-fed burn" so it is a choice.
3. **New foods from new machines**: mill flour -> basin + mixer dough -> belt oven; sweet bun/cookie/cake exist; add savoury pie (meat + flour), cheese (milk + salt + time), jerky (rack). Each food has: hunger, well-fed seconds, optional buff. All numbers in `core/constants.ts` neighbourhood; one table.
4. **Farming/irrigation/weather**: furrows next to water grow faster; rain waters; drought in the Current age storms? Tractor harvest and deployer-hoe both reach crop rules (`cropRules.ts`): reaper and tractor use the same ripeness check.
5. **Sap -> syrup -> sugar chain** completes: tapped pine sap boils on the furnace into syrup (distillery fluid), syrup crystallises on a rack/hot plate into sugar; tap state is now saved (`extras.sap`, `src/player/sapTools.ts`); animation and particles still open.
6. **Hunger from new drinks** with a single table `DRINK_HUNGER` so brewing, distillery and potions share it.
7. **Bushes regrow after farmland removal** (known gap) and **rack under glass** decision.
8. **Cup/cone vs clay table**: apply the owner's decision.
**Acceptance:** per-recipe tests; `brewing.test.ts` + `food.test.ts` counts updated; e2e for "tea with sugar" and "tap -> syrup -> sugar"; buffs UI icon for each buff (HUD buff row) at 44 px.

### Stream F - World and progression (biomes, objectives, Codex, balance)

**Owns:** `src/content/{objectives*,progression,loot,oreVeins,creatures,automatons,emberbound}.ts`, `src/world/*`, `src/mobs/*`, `scripts/codex/*`, `docs/PROGRESSION.md`, `docs/api/{world*,mobs,emberbound*}.md`.
Designs:
1. **Objectives per age renumbered** and a single `objectives.ts` index so goals are in one ordered list per age with `requires` links (so the HUD tracker never shows a goal whose prerequisite machine isn't built). New conditions: `rpm`, `fluid`, `aspect`, `research` (typed, since 3+ goals need them).
2. **Bronze goal chain** written to match STEAM/BRONZE plans: Bronze Furnace -> boil water -> shaft turns -> grind -> gear up -> saw planks -> heat moves -> build a boiler -> raise steam -> safety valve -> piston power -> compress air -> vacuum chute -> press plates -> blast nozzle (adds to the existing workshop goals, with `six_cups` optional).
3. **Codex progression tree** shows the single spine (heat -> steam -> motion -> air -> watts) with each system as a branch colour; planned items grey; research tree linked; distillery process cards as a branch.
4. **Biomes with purpose per age**: a `peat bog` (Ember: peat, wild tea), `mesa/clay flats` (Bronze: copper, tin, clay), `coal ridge` (Forge), `quartz dunes` (Current), `ruin deep` (Atomic). Spawn picks so the player finds every age's raw materials within a walk; resources are on **ore veins** (`oreVeins.ts`).
5. **Emberbound / ruin scaling**: each age's guardians drop that age's late material (e.g. Bellows Hounds drop leather for belts), and unlock a **sound cue** when you enter a ruin of the next age (teaser).
6. **Balance pass**: one spreadsheet-like test (`balance.test.ts`) prints time-to-gate for each age under an idealised player: target ~45 / 45 / 55 / 60 / 60 min (PROGRESSION). Tune fuel, furnace speeds and stress numbers.
7. **Star hearth decision** (X7).
**Acceptance:** `objectives.test.ts` proves every goal is reachable in order (existing playthrough test extended to Bronze); Codex builds without warnings; `balance.test.ts` thresholds; world map script shows resource distribution.

### Stream G - Final integration and playtest

**Owns:** `docs/*` (consistency), `src/content/content.test.ts` graph tests, `scripts/e2e*.mjs` chain, `package.json` chain, `docs/PLAYTEST.md` (new). Last, after A-F are merged by the owner.
Tasks:
- **G1 Docs reconcile**: fix X1-X5, delete duplicated plan text now built (replace with status boxes and pointers), regenerate the handoff bundle.
- **G2 Graph tests** (new `src/content/congruence.test.ts`): every item is obtainable (some recipe/drop/loot/reward/Dev), every non-trivial item is used (input, placeable, consumable, reward) or flagged `decor`; no recipe lower than its age gate (age >= max input age except natural materials); every fluid has a source and a sink; every `FluidKey` has a bucket or canister path or is flagged pipe-only; every block has an aspect fingerprint beyond `CATEGORY_BASE`; every objective chain reachable; every `SfxName` has a recipe; every status sentence <= 70 characters.
- **G3 Whole e2e chain** on GPU with diagnostics; fix red.
- **G4 Playtest checklist** below.
- **G5 Republish** the game artifact and Codex; save/load roundtrip with old-save fixture.

---

## 6. Cross-stream integration ideas (single concrete designs)

These live between streams; owners are noted so that nothing is built twice.

| Idea | What the player sees and does | Owner |
|---|---|---|
| **Lubricant raises shaft capacity** | Fill a can from the distillery spout (residue), press Use on a shaft: oil sheen runs along the axle, goggles say "oiled, 9 min", loads stress shows 80%; sloppy shafts squeal (filter) when un-oiled and near capacity | B + C |
| **Essentia in the still** | Hold a jar of `cinder` against the boiling flask rig; the glass glows orange; a "Cinder Essence" bottle results; essence added to a tea at the cup makes a long-lasting warm drink | B + D + E |
| **Oil and fuels** | Crude from a bog or oil shale pump -> still column cuts; kerosene lamp (Bronze light), gasoline/diesel/ethanol for chainsaw, tractor, combustion generator; each tank labelled with colour | B |
| **Ground items on belts** | Drop an item on a belt; it rides; funnels filter; a magnet collector at the end drops into a crate with the lid opening | C |
| **Sugar and alcohol in brewing** | Sugar at the cup raises speed; spirit in a tincture extends buff duration; cost: well-fed burns and aim sway | E |
| **Aspects on every new item** | Notebook scan of a new part reads like a sentence: "Windmill: Gale and Drive" with a research hint | D |
| **Belts into crates** | Belt end touches crate: items are taken at 1/s; crate fills; HUD shows count when goggles on | C |
| **Servants on cranks / treadwheels** | A clay servant grinds at a quern; spring jar feeds it; you see it tire and brighten | D + C |
| **Tractor power take-off** | Park the tractor by a shaft: engine note changes, 24 rpm to the shaft; fuel drains; chainsaw fuel is the same can | C + B |
| **Vacuum / magnet collectors** | Pump or magnet reaches 9 blocks; items stream to the collector with a pop; electromagnet in Current uses watts | A + C |
| **Weather affecting machines** | Wet belts, wind-driven mills, frost on wheels, lightning striking a metal vane makes `spark` | C + D + A |
| **Hunger and buffs from new foods and drinks** | One `DRINK_HUNGER` table; HUD buff row icons; alcohol buff has a cost | E |
| **Steam plan vs workshop vs distillery vs essentia tubes** | One shaft world (workshop), one fluid world (pipes) with air/steam as fluid keys, one tube world rebuilt on the pipe graph, one still with essences: no parallel systems | A + B + C + D |

---

## 7. Playtest checklist (desktop and phone portrait, Dev Mode off then on)

Run on a real GPU with `?diag=1`. Mark each with: pass, feel notes, bugs. A hand-playthrough **has not been done** for the newest systems (WHATS_LEFT).

**Ember (45 min):** spawn near trees/stone/clay/water; hunger and cold readable; furnace placed and lit; charcoal; copper then bronze cast by hand (first pour moment); hand quern -> flour -> dough -> bread; tea brew (boil pail, cup, cone); phone: every action reachable with thumb, targets >= 44 px; goals advance in order; gate list on the furnace screen is legible.
**Bronze:** bronze furnace upgrade; crank + axle + quern; belts + funnel + chute + basin + mixer (the grain-to-dough line); goggles on every part; windmill and kettle/rotor (after A); boiler, valve whistle; compressor, air tank, pneumatic press; vacuum chute; lubricant can; overstress and shear pin; clutch and gearshift card; signals (lever, plate, bell); skiff ride; tally board; clockface.
**Forge and later:** blast hearth, iron/steel, trip hammer, dynamo, first lamp; arc hearth; electric still; tractor and chainsaw with ethanol; PTO into a mill; magnet collector; fission pile; star ignition.
**Cross-system:** distillery run (wash -> spirit -> fuel -> chainsaw; residue -> lubricant); notebook scan, research board, rod and jar, altar infusion, servant on crank; Sugar Rush (tap -> syrup -> sugar -> bun) and its penalties; weather during machines; save/quit/continue with an old save and a new save.
**Quality gates:** no page scroll on phone; no text clipped; frame time stable at 20 view chunks; audio volume balanced across machine ambiences; no UI screen needed for any core loop (screens only: furnace, notebook, rune desk, Codex, settings); Codex shows each item with its recipe and aspects.

---

## 8. Open decisions for the owner (defaults in parentheses)

1. Star hearth casings: keep 93 or reduce (keep, add compact shell option).
2. `six_cups` optional (yes).
3. Delete cup/cone forge recipes in favour of Clay Table (yes).
4. Create `main` so pages.yml publishes (after G).
5. Tractor PTO available before Forge (yes, as a late convenience).
6. Display names for the Forge-era steam parts: `steam_dynamo`, `furnace_boiler` (see D3, D4).
7. Whether shaft materials (wooden, iron, steel) are separate block keys (separate keys).
