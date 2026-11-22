# Hearthwatt - the shared systems document (SYSTEMS.md)

Status: written 2026-11-22 for the "finish everything that is left" build. It is the ONE document every build unit spec
(`docs/build/UNIT-NN-*.md`) is written against. Where a unit spec and this file disagree, this file wins until the owner says
otherwise; where this file and the code disagree about something that EXISTS, the code wins and this file gets fixed.

Excluded from this build by the owner (2026-11-22): the six-age refactor (BRONZE_PLAN W0), STEAM_PLAN, BRONZE_PLAN B1-B4,
hand play-testing, the Star hearth casing count, creating `main`. Everything here is keyed so W0 can land later by editing
`src/magic/ageMap.ts` and the `age` / `minTier` fields, never by hunting literal numbers.

---------------------------------------------------------------------------------------------------------------------------

## 0. Purpose, and how to use this document

Hearthwatt has grown by many sessions, each building one system well: the furnace and hearth, power, pipes, farming, animals,
brewing, Ember handwork and casting, the glass distillery, the Bronze workshop, Essentia and Research, the tractor and the
chainsaw, sugar. What is left (docs/WHATS_LEFT.md) is not a pile of separate features; almost every open item is a SEAM
between two of those systems: lubricant is a distillery product that the workshop and the chainsaw consume; a golem is a magic
creature that works workshop machines; asphalt is a refinery leftover that changes how fast feet and tractors move; a ladle of
molten bronze carries the furnace's heat to an anvil across the room. This document makes the seams deliberate.

Rules for every unit spec:

1. **Cite the threads.** Each unit spec opens with a "Threads" line listing which of T1-T10 (section 3) it carries, and for each
   thread names the shared ids/constants/hooks it reads or defines. A unit that adds an item must show the item in the T4
   material web with a producer and at least two consumers (or say which existing consumer it feeds).
2. **Use the shared ids verbatim** from section 6 (contracts). Do not invent a second name for anything listed there.
3. **Use the canonical numbers** of section 5 unless the spec argues in a sentence why not (and then this file is updated).
4. **Write the player's words in the game's voice** (section 1.4, T8): plain, concrete, with the number in it.
5. **Phone first.** Every new screen, button and chip is 44 px touch target, works at 390 px portrait and 844 x 390 landscape.
6. **Optional by default.** New systems never block the tech spine; the progression solver (`src/content/progression.ts`) and
   `content.test.ts` must still prove the game completes without them (T7).

---------------------------------------------------------------------------------------------------------------------------

## 1. The game's identity (one page)

### 1.1 What Hearthwatt is

An original first-person voxel sandbox "more focused on technological advancement and generating power from resources", where
"the furnace is the main place in one's base they should congregate to" (SPEC.md section 0). The pillars still hold:

- **The furnace is the heart.** One block, upgraded in place: fire, forge, generator, warm shelter, respawn anchor, win
  condition. Every new system in this build should, where it is natural, *face the hearth*: the ground burner is the furnace's
  little sibling for the far field; the ladle carries its heat out; the siphon jar feeds it; the refinery tower is its industrial
  cousin. When in doubt about where a thing gets its heat, the answer is "from the hearth, or from something that copies it
  badly" (T1).
- **Heat first, then watts.** Ember is real fire and hands. Bronze/Forge is shafts and steam. Current is electricity. The order
  of the ages is the order of the energy ladder (T1, T2).
- **Technology is a place, not a menu.** Locked recipe rows say what they need ("needs 1300 C at an Arc Furnace"). Research
  exists only in the optional magic layer, and it never gates the spine (T7).
- **Danger is environmental first.** Cold, falls, drowning, lava, radiation; the Emberbound automatons came later and are
  bounded by safe zones. Nothing in this build adds combat; Tipsy's melee bonus is a joke, not a system.

### 1.2 The ages (by NAME; numbers via `ageIndexOf` only)

| name | furnace that opens it | character | today `AGE_INDEX` |
|---|---|---|---|
| ember | Clay Furnace (tier 1, 800 C) | hands, clay, flint, the first fire, handwork stations, pot stills | 0 |
| bronze | (Bronze Furnace, deferred W0) | shafts, cranks, belts, the workshop, glassware columns, cogs | 0 (placeholder = ember) |
| forge | Blast Furnace (tier 2, 1500 C) | iron, steel, heavy machines, crude oil, canisters, vaults, bearings | 1 |
| current | Arc Furnace (tier 3, 2100 C) | electricity everywhere, alumina, circuits, the chainsaw, the tractor, the electromagnet | 2 |
| atomic | Plasma Furnace (tier 4, 3200 C) | fission, radiation, shields | 3 |
| star | Starhearth (tier 5) | the finale | 4 |

`src/magic/ageMap.ts`: `AGE_INDEX = { ember: 0, bronze: 0, forge: 1, current: 2, atomic: 3, star: 4 }`. Write
`age: ageIndexOf('bronze')` for anything that belongs to Bronze even though it equals Ember today; when W0 lands it moves by
itself. Recipes still carry `minTier` (furnace tier); for Bronze items use `minTier: 1` today and leave a `// W0: 2` comment.

Owner rule (SESSION_CONTEXT section 4): **Ember is pure handwork - no steam, no machines, no electricity.** A ground burner (a
fire) and a ladle (a clay pot) are Ember; a vacuum pump (shaft-driven) is Bronze; an electromagnet is Current.

### 1.3 The phone-first rule

The player is most likely on a phone. Concretely, for this build:
- Every interaction must be possible with Use / Mine / a 44 px button. No drag, no long-press-only actions, no hover-only info.
- In-world reading first (goggles text, block state lamps, particles) before a screen; a screen only when a choice has more than
  three options (the rig screen, the punch-card editor).
- Text lines that appear in the crosshair must fit in about 60 characters at the HUD's font; longer facts go in the screen.
- HUD additions (aura dial) live in existing corners and collapse on narrow portrait; never cover the hotbar or the crosshair.

### 1.4 The voice of the UI (quote the code, match it)

Real strings from the code, which every new string should sound like:

- Crosshair / goggles: `"Millstone - 16 rpm, load 4.25/8 su, Flour 40%, holds 2 Wheat"`, `"Ratio dial: speed x2"`,
  `"Governor: at most 64 rpm"`, `"Still Base - set 92 C, holding 91 C"`, `"Boiling Flask - 1.4 buckets Low Wines, 96 C, boiling"`,
  `"Clockface - <time>"`.
- Refusals (a full sentence, says what to do): `"Needs 3 molten Bronze Ingot - there is 2"`, `"Hold a fired mould to pour into"`,
  `"It has gone cold - smelt the bloom again"`, `"Your pack is full"`, `"The pot has all the copper it takes - it needs tin"`.
- Events: `"Distilling run finished"`, `"Fermenting done: Sugar Wash"`, `"Spring replaces Mending"`,
  `"Spring: Jump 35% higher"`.
- Objectives: imperative title + one or two sentences with the how: `"Gear the speed up"` / `"A Ratio Dial in the line multiplies
  the speed (Use cycles it). The Mixer needs 32 rpm, twice what one crank gives."`
- Item descriptions name the use and the number: `"A big wheel to walk in. It turns at 12 rpm and carries 24 stress units while
  you or a tame animal stand on top of it."`

Grammar rules: sentence case; names of things are Title Case ("Boiling Flask"); hyphen with spaces " - " separates the name from
its state; commas separate facts; units after a space (`92 C`, `16 rpm`, `4.25/8 su`, `250 L`, `1.4 buckets`, `14 s`, `1.5 min`);
no degree sign in crosshair lines (the ui-kit `formatTemp` with `°C` is for screens); no exclamation marks except real alarms.

---------------------------------------------------------------------------------------------------------------------------

## 2. Current state inventory (what exists, where)

Short and factual; detail in `docs/api/<name>.md`.

| system | exists today | key files |
|---|---|---|
| Furnace & hearth | five tiers (maxTempC 800/1500/2100/3200/3200), fuel slots, crucibles, multiblock hearths, upgrade in place, structure tab with shift buttons | `src/content/tech.ts`, `src/sim/furnace*.ts`, `src/sim/hearthScan.ts`, `src/ui/screens/furnace/` |
| Casting | molten pools in crucibles (`MOLTEN_WINDOW_S` 20), pour into fired moulds (`MOULD_POURS` 40), blooms, alloy pot item | `src/sim/casting.ts`, `src/content/mouldsHand.ts`, `docs/api/casting.md` |
| Handwork | chopping block, quern, stone anvil (hot window `HOT_WORK_WINDOW_S` 20 near a pour), mortar, clay table, loom, drying rack (needs sky), trough | `src/sim/handWork.ts`, `src/content/*Hand.ts` |
| Brewing | six drinks in two families (tea: spring/hearthkept/mending; coffee: swift/vigor/lasting), `DRINK_BUFF_S` 180, cups, kettle pot, boiling pails | `src/core/brewing.ts`, `src/game/buffs.ts`, `src/game/drink.ts` |
| Sugar | tap pine (`TAP_COOLDOWN_S` 120, not saved), pine resin, sugar, cookie/bun/cake, Sugar Rush (`SUGAR_SPEED_MULT` 1.12, Well-Fed burns x2.5) | `src/player/sapTools.ts`, `src/content/itemsSugar.ts` |
| Glass distillery | 10 module kinds, mixture model (12 components), grades, stills, columns (8 segments), fermenting, ports, 7 process cards, `FUEL_GRADES` | `src/core/chem.ts`, `src/core/distill.ts`, `src/sim/distill*.ts`, `src/content/*Distill.ts` |
| Pipes & tanks | item/fluid pipes, wrench, pumps, tanks (16 000 L, accepts only water/lava/steam/crude_oil/fuel), buckets & canisters (1000 L) | `src/content/techMachines.ts`, `src/sim/fluidMachines.ts` |
| Bronze workshop | signed rotation (crank 16 rpm/8 su, clockwork 24/48, treadwheel 12/24, generators turning shafts), ratio dial, governor, gearshift (3 preset programs), worm, links, differential, flywheel, shear pin, oil (`LUBE`: residue x1.25/600 s, pine resin x1.10/300 s), belts, funnels, chutes, depots, basins, spouts/drains (bucket by bucket), mixer, press, deployer, arm, drill, saw arm, vacuum collector, item vault (108 stacks, single block), signals, tally board, clockface, guide screen, pistons, bearings, rail + skiff (discrete steps), 13 goals | `src/workshop/*.ts`, `src/content/itemsWorkshopParts.ts`, `src/render/workshop/` |
| Essentia & Research | 21 aspects, fingerprints for every key, aura, wellsprings, vials (4 units), jars (32), void jars (128), tubes (instant), rods 16/32/64, 24 research entries, rune desk (loses partial vials), infusion altar, 4 foci, clay servants (crank only), hearth siphon, still clarity | `src/magic/*.ts`, `src/content/*Magic.ts` |
| Vehicles & tools | tractor (5.5 m/s, diesel x1.5, PTO for shafts), chainsaw (durability = fuel tank 840, 7/log), hand vacuum (`COLLECTORS`) | `src/vehicles/`, `src/game/felling.ts`, `src/game/collectors.ts` |
| Animals | hen, goat, boar and more; feed to tame (`tame` saved), follow when you hold a liked item, breed | `src/mobs/`, `src/content/creatures.ts` |
| Objectives | ONE sequential track (`OBJECTIVES` in `src/content/objectives.ts`, tracker walks in order); magic has its own notebook Goals | `src/game/objectives.ts` |
| Sound | per-feature sfx sets merged in `src/audio/sfx.ts`; `SfxName` union in `src/core/gameEvents.ts`; test counts `72 + MAGIC_SFX` | `src/audio/` |
| Save | block edits by key string; systems `world.persist(key, toJSON)` + tolerant `load`; player `src/save/document.ts` (`SAVE_VERSION` 1, `migrateSave` stub) | `src/save/`, `src/world/world.ts` |

Facts that surprised the research and matter to several units:
- `ItemStack` is `{ item, count, durability? }` - **no per-stack metadata.** Anything that "remembers" something per item uses
  distinct item keys, or durability-as-a-number (seconds left, fuel, wear, charge), or a per-block entity.
- The cup/cone FORGE recipes are already gone (handwork-content.md: "pressed at the clay table and fired"). Unit 2 verifies and
  cleans leftover text; it does not need to delete code.
- The workshop already oils networks with Heavy Residue. Lubricant is the refined top of an existing ladder, not a new mechanic.
- `vacuum_collector` (a workshop part) and `hand_vacuum` (a held tool) both exist; neither makes a VACUUM for chemistry.
- Distillery `REACTION_SPECS` (DISTILLERY_PLAN section 6) were never built; fermenting is special-cased in `Distillery.stepVessel`.
  Three units need generic reactions, so the engine is built once, first (Unit 0).
- Block edits are saved by key, so new block ids appended by parallel units never break saves; the only id rule is "append, never
  insert or reorder existing rows".

---------------------------------------------------------------------------------------------------------------------------

## 3. The congruence threads

Each thread: definition, what exists, what this build adds, shared ids/constants, rules.

### T1 - Heat and fuel ladder

**Definition.** Every heat in the game is either the furnace's (and its hearth's), or a lesser fire that imitates it within a
cap. Every fuel sits on ONE ladder from sticks to refinery fuels, and each step up is hotter, longer, or more portable.

**Exists.** `FuelSpec { energyJ, burnS, flameTempC }`: stick 30 kJ/12 s/450 C, plank 60/20/550, log 200/50/650, charcoal
400/80/1000, coal 800/100/1250, coke 1200/120/1550. Still base on a furnace top holds `min(setC, furnace, 450)`
(`GLASS_MAX_C` 450), drawing `BOIL_J_PER_L` 400 J/L into the furnace. `FUEL_GRADES` (engines): fuel_canister 1/1, gasoline
saw 1.3 / tractor 1.2, diesel tractor 1.5 (saw refuses), fuel_ethanol_beaker 0.25/0.2. Steam engine is a heat engine on a
furnace (draws heat even when idle: Unit 3 fixes).

**Adds.**
- *Ground burner* (Unit 7): a `still_base` NOT on a furnace top burns a fuel item put in it with Use. It is an open fire, so it
  caps lower than a furnace and far lower than its fuel's flame:

  | burner fuel | burner holds at most | burns for (at full boil, 8 kW draw) | why |
  |---|---|---|---|
  | charcoal | 250 C | 50 s (400 kJ / 8 kW) | Ember comfort: syrup, wash, low wines, spirit runs |
  | coal | 280 C | 100 s (800 kJ) | same cap band, longer |
  | fuel_ethanol_beaker | 300 C | 40 s (320 kJ, returns the beaker) | the still feeds itself |
  | kerosene_canister | 350 C | 300 s (2400 kJ, returns the canister) | a refinery fuel gives the far-field still enough heat for crude (350 C) - the first real use of kerosene |

  Burn time scales with the draw: a burner whose flask is not boiling burns at `BURNER_IDLE_W` 500 W (embers), so fuel is not
  wasted while a run waits. A burner's temperature is `min(setC, fuelCap)`.
- *Ladle* (Unit 4): molten metal leaves the furnace in a fired clay ladle; it cools in `MOLTEN_WINDOW_S` 20 s (same window as
  the crucible), so the furnace stays the source of all hot metal.
- *Casting bench* (Unit 4): has no heat of its own; it is filled by ladle or by "pour to bench" from a furnace within 4 blocks.
- *Steel flask* (Unit 11): a steel still shell holds to `STEEL_MAX_C` 600 (glass 450), needed for the 480 C cracker. Its heat
  still comes from a furnace below (a burner cannot exceed 350 C). The base's cap becomes `min(setC, furnace, flaskMax)` and
  `STILL_SETPOINTS` gains 480 and 560, offered only while a steel flask stands on the base.
- *Electromagnet* (Unit 14) is the first held tool that runs on stored electricity (T2/T1 boundary): it carries a charge.

**Rules.**
1. No device is hotter than its source. Burner <= 350 C; glass <= 450 C; steel <= 600 C; a still is never hotter than the furnace
   under it.
2. Every liquid fuel has exactly one row in `FUEL_GRADES` (engines) and, if burnable in a burner, one row in `BURNER_FUELS`
   (Unit 7 owns it, `src/core/distill.ts`). A fuel with neither is a bug (kerosene was one).
3. Containers come back: burning a beaker or canister returns the empty (the same `empty` field as `CHEM_CONTAINERS`).
4. Heat drawn is energy: anything that boils draws `BOIL_J_PER_L` from its source (furnace `extractW`, burner fuel).

### T2 - Rotation and stress (one kinetic model)

**Definition.** All mechanical work in the game is the workshop's kinetic model: signed rpm, stress units (su) used vs capacity,
networks found by BFS (`MAX_NET` 512), jams when one part gets two speeds. There is no second model (STEAM_PLAN's `mechGraph` is
deferred; when it lands it feeds `extraRpm`).

**Exists.** Sources: hand crank 16 rpm / 8 su while Used (`CRANK_S` 2.5), clockwork 24/48, treadwheel 12/24 (player only),
water wheel 12, wind turbine 16, steam engine 24 (capacity = watts/50), tractor PTO 24/30, flywheel coast 12 su for 4 s.
Stress per part `BASE_STRESS[kind] x clamp(16/|rpm|, 0.25, 4)`. Oil: `LUBE` multiplies the whole network's capacity for a time.

**Adds (every new shaft consumer and source of this build).**

| key | role | unit | stress (`BASE_STRESS`) | min rpm | effect |
|---|---|---|---|---|---|
| `vacuum_pump` | consumer (workshop part) | 8 | 4 | 16 | a `vacuum_cap` it touches (or tubes to, see T3) pulls vacuum: capability `vacuum` |
| `chem_stirrer` | consumer (workshop part) | 12 | 4 | 16 | a `reaction_vessel` / `boiling_flask` it touches is `stirred`: reactions x2 speed; `needs: stirred` reactions run at all |
| treadwheel + tame animal | source | 17 | - | - | a harnessed tame animal counts as `standingOn`: 12 rpm / 24 su, same as the player |
| `clay_golem` at a crank | source | 17 | - | - | `workshop.crank()` like a servant: 8 su while cranking |
| punch cards in `sequence_gearshift` | program | 16 | 1 (unchanged) | - | the gearshift's program comes from its card |
| contraption tween | visual | 13 | - | - | no stress change; moving structures look continuous |
| `lubricant` oil | capacity | 8 | - | - | `LUBE.lubricant` x1.5 for 900 s |

**Shared constants.** `LUBE` in `src/workshop/workshop.ts` becomes the oil ladder, one row per oil, best factor wins, never
stacking:

| oil (item used) | factor | seconds | source |
|---|---|---|---|
| `pine_resin` | 1.10 | 300 | Ember sap boil (exists) |
| `residue_canister` | 1.25 | 600 | crude refining (exists) |
| `lubricant_canister` | 1.50 | 900 | vacuum still + filter bed (Unit 8) |

**Rules.**
1. **One oil rule everywhere.** "Lubricant raises stress capacity" (DISTILLERY_PLAN 15.6) IS the `LUBE` rule. Distillery shaft
   machines (stirrer, vacuum pump) are workshop parts on workshop networks, so oiling the network covers them. No unit writes a
   second capacity multiplier.
2. Oiling uses the item (canister goes back as `empty_canister`; resin is eaten), refreshes the timer, never shortens a better
   running oil: if `residue` x1.25 runs with 400 s left and resin is applied, nothing changes and the toast says "Already oiled
   better (Heavy Residue, 6.7 min left)".
3. A consumer that needs rpm reports it in goggles: `"Vacuum Pump - right 16 rpm, load 4/8 su, pulling on the cap above"` or
   `"Chem Stirrer - too slow (8 of 16 rpm)"`.
4. Helpers (animals, golems, servants) touch the kinetic world ONLY through the machine interface (T6).

### T3 - Fluids and containers (one accept list)

**Definition.** Every liquid is a `FluidKey` with a `FluidSpec` (colour, hot, glow, optional `bucket {full, empty}`). Every
container is one of: pail/bucket (1000 L), canister (1000 L), beaker (250 L), glass vial (250 L as a liquid container; 4 units
as an essentia vial - different items), basin (1000 L), tank (16 000 L, stacks), distill modules (`CHEM_CAPACITY_L`), jar
(essentia, not litres).

**Exists.** `FluidKey` = water, lava, steam, crude_oil, fuel + sap, syrup, sugar_wash, low_wines, spirit, fuel_ethanol, gasoline,
kerosene, diesel, residue, slop. Canisters for crude/gasoline/kerosene/diesel/residue/slop. Tank `accepts` hard-coded to the
first five. Spouts and drains move one bucket at a time.

**Adds.**
- New fluids (registered by Unit 0 so every unit sees them): `lube_base` ("Lube Base", canister `lube_base_canister`) and
  `lubricant` ("Lubricant", canister `lubricant_canister`). Grades in `GRADES`: `lubricant` needs `lube_base >= 0.9` (only a
  filter bed gets there), `lube_base` needs `lube_base >= 0.6`. Insert both BEFORE `residue` in `GRADES` (best first).
- One accept list (Unit 7): tanks and pipes accept `tankFluids()` = every registered fluid; `hot` fluids still need a hot pipe.
  `content/techMachines.ts` stops listing fluids by hand. Pumps keep their own `gives` (they draw from the world).
- Continuous spouts and drains (Unit 14): a spout fed by a pipe/tank fills the container below at `SPOUT_LPS` 250 L/s (a bucket in
  4 s, a beaker in 1 s); a drain over a tank empties at the same rate. Bucket-by-bucket stays as the fallback with no pipe.
- Receiver -> pipe -> tank end to end (Unit 7): a `chem_port` on a receiver is an outlet for named grades into the pipe network.

**Rules.**
1. **Litres are exact and conserved.** Every move goes through the fluid API or the chem `pour/take/add`; nothing creates litres.
2. **Named at boundaries.** Inside a rig a liquid is a `Mix`; in a pipe, tank, canister or beaker it is a named grade (`nameOf`),
   and it expands back with `expand`. Purity is only lost at boundaries.
3. **Containers are tables, not code paths.** New fluids get containers by adding rows (`CHEM_CONTAINERS`, `FluidSpec.bucket`);
   `filledWith` / `bucketUse` then handle them.
4. **Name collision rule.** `vial_<aspect>` is reserved for essentia. Liquid potions bottled in glass vials are
   `elixir_<buff>`, `tincture_<herb>`, `essence_<buff>` (T4), never `vial_<something>`.

### T4 - The material web (no dead ends)

Every new intermediate has a producer and at least two consumers in different systems, or feeds an existing consumer that has
no other supplier at its age. Stack sizes follow existing patterns: materials 64, beakers 16, canisters 8, tools/vials of potion 16
or 1, foods 16/8, cards 16, moulds 1.

| item / fluid | made by (unit) | consumed by | age | stack |
|---|---|---|---|---|
| `lube_base` (fluid) / `lube_base_canister` | vacuum still on residue, 330 C, `vacuum` (8) | filter bed -> lubricant (8); workshop oil at the residue rung (x1.25, 600 s) as a cleaner stand-in (8); burner fuel? no | forge | 8 |
| `lubricant` (fluid) / `lubricant_canister` | filter bed (clay) on lube base (8) | workshop oil x1.5 (8, T2); chainsaw bar oil (8); stirrer & vacuum pump networks (12, 8) via oil; refinery tower start-up (11) | forge | 8 |
| asphalt (`asphalt` block) | heated vessel: bitumen 250 L + 4 gravel + 2 sand -> 8 (9) | player roads walk x1.25 (physics, T5); tractor x1.4 (vehicles, T5); the tractor's tiller leaves it alone like stone (9) | forge | 64 |
| `tarred_plank` (block) | heated vessel: bitumen 125 L + 4 plank -> 4 (9) | non-burning floors/walls, rail sleepers recipe alternative (16 rail via tarred plank), boat-like skiff hull recipe (16) | forge | 64 |
| `bandage` | workbench: 1 spirit_beaker + 2 cloth -> 4, `byproducts: 1 glass_beaker` (10) | heal 6 HP over 12 s (10); golem repair (17: Use a bandage on a damaged golem); Emberbound fights | ember | 16 |
| `essence_<buff>` (6, in glass vial) | vacuum still 60 C, 4 drinks of that buff + 1 glass vial in the vessel (10) | elixirs (10); rune desk research ingredient for M6 entries (18) | bronze | 16 |
| `tincture_<herb>` (glowcap, wildberries, tea_leaves, coffee_cherries) | heated vessel 50 C: 4 herb + spirit 250 L + 1 glass vial, then filter bed (charcoal) to clear (10) | elixirs (10); infusion altar ingredient (18) | ember (cloudy) / bronze (clear) | 16 |
| `elixir_<buff>` (6) + `glowcap_draught` | stirred or heated vessel: essence + clear tincture + syrup 250 L -> 4 (10) | drink: buff x3 time (540 s) in its family slot (T5); golems fed an elixir work 2x for 5 min (17) | bronze | 16 |
| spirit drinks: `spirit_beaker` drunk directly | existing | Warmed + Tipsy (10, T5); bandage (10); tinctures (10) | ember | 16 |
| `clay_ladle` / `ladle_<metal>` (copper, tin, bronze) | clay table `unfired_ladle` (2 clay) -> fire 500 C 8 s (4); a ladle filled from a molten crucible (4) | casting bench moulds (4); stone anvil hot work anywhere (4); cools to the bloom + the empty ladle back (`cools.returns`) | ember | 1 |
| sugar goods: `berry_tart` (flour + sugar + wildberries), `toffee` (2 sugar), `syrup_bread` (dough + syrup_beaker, beaker back) | furnace bake (5) | food + Sugar Rush (end product, see rule below) | ember | 16 |
| sugar as chem input | sugar item Use on a vessel adds 25 L `sugars` (5) | fermenting wash (existing), syrup elixir base (10) | ember | 32 |
| `catalyst_pellets` | forge T3 1200 C: 2 alumina + 1 silica -> 2 (11) | catalyst bed (cracker) 8 batches each (11); refinery tower (11) | current | 16 |
| `steel_flask` (+`_done`) | forge T2 1300 C: 4 steel_plate + 2 glass (11) | cracker, refinery tower flask (11); hot heavy runs > 450 C | forge | 16 |
| `punch_card` (blank) + 3 presets `punch_card_pulse`, `punch_card_swing`, `punch_card_ladder` | workbench: 1 cloth + 1 flint -> 2 blank (16) (no paper exists; stiff cloth is the card); a preset = blank punched at the gearshift screen | sequence gearshift programs (16); metronome rhythm? no - one consumer is enough for a program carrier, it is a tool not an intermediate | bronze | 16 |
| trinket blocks (wind_vane, weather_cock, padlock_chest, lantern_chain) + held (spyglass, brass_horn) | bench / forge T1 (16) | reading wind for turbines (16, T8); rain signal to close roofs over racks (16 + 2); calling animals to the treadwheel (16 + 17); locking stores away from arms/golems (16 + 17) | bronze | 16/1 |
| `clay_golem` (item that places a mob) | infusion altar: clay_servant + 4 soul + 2 drive (17) | walking helper (17); research `golem_walk` gates the infusion (18) | forge | 1 |
| `electromagnet` | forge T3 1400 C: 1 magnet_ring, 2 copper_coil, 1 battery, 1 iron_plate (14) | pulls metal ground items (14); recharged at batteries (T1) | current | 1 |

Rules: end products (foods, drinks, building blocks, tools, trinkets) are consumed by the player and need no second consumer; the
"two consumers" rule is for INTERMEDIATES (fluids, parts, reagents). A unit that wants a new item not on this table adds a row here in its spec (with producer + 2 consumers) and the coordinator
merges it. Prefer reusing an existing item (cloth, leather, glass_vial, glass_beaker, empty_canister, bronze_cog, scrap_metal,
alumina, magnet_ring) over making a new one.

### T5 - Bodies and buffs (one stacking rule, one speed rule)

**Definition.** A buff is a timed modifier applied at the ONE place its base rule lives (Buffs getters). Buffs live in slots;
one slot per family; a new buff of the same family replaces; the same buff refreshes and never shortens.

**Exists.** `Buffs`: `wellWarmedS`, `wellFedS`, `sugarS`, drink slots `tea` and `coffee`. Getters: `jumpMult`, `speedMult`
(Swift x Sugar), `miningMult`, `warmthDrainMult`, `regenMult`, `foodDrainMult`. HUD pills `.hw-buff[data-kind=...]`.

**Adds.**
- Elixirs (Unit 10) grant an existing drink buff in its existing family for `ELIXIR_BUFF_S` 540 s (3 x 180). They do NOT add a new
  strength level (there is none in the model); "stronger" means "longer". An elixir and a cup of the same buff simply refresh.
- `glowcap_draught` (Unit 10): new buff `night_sight` in a NEW family `tonic` (300 s): darkness lifted (render exposure +, no
  fog of night). `BuffName` gains `night_sight`, `tipsy`.
- Spirit drink (Unit 10): Warmed = grant `wellWarmedS` 300 s (the fire buff), and Tipsy: own timer `tipsyS` 120 s:
  melee x1.1, camera sway amplitude 0.6 deg; drinking spirit again while Tipsy refreshes and adds `BLURRED_S` 20 s of soft
  vignette and speed x0.9. Saved as optional `BuffsSnapshot.tipsyS`.
- Bandage (Unit 10): not a buff slot - a heal-over-time `healOverTime(hp, seconds)` on `Survival` (6 HP over 12 s), refreshing.
- Sweetened drinks (Unit 5): a drink made with sugar grants its buff x1.5 time (270 s) plus 30 s Sugar Rush.
- Asphalt (Unit 9): surface speed.

**Speed rule (one multiplication, in physics only).**
`speed = base(walk|sprint|swim) x buffs.speedMult x surfaceMult(block under feet) x (blurred ? 0.9 : 1)`, where
`surfaceMult` reads the new optional `BlockSpec.surface?: { walk: number; vehicle: number }` (Unit 0 adds the field; Unit 9 sets
asphalt `{ walk: 1.25, vehicle: 1.4 }`, tarred_plank `{ walk: 1.1, vehicle: 1.1 }`). The tractor multiplies its max speed by
`surface.vehicle` of the block under its centre. Swimming ignores surface.

**HUD.** Every timed buff shows one pill: name + m:ss. Families show their current member. Order: warm, fed, sugar, tea, coffee,
tonic, tipsy. Heal-over-time shows a small "+" pulse on the health bar, no pill.

**Save.** Every new timer is an optional number in `BuffsSnapshot`; missing = 0.

### T6 - Creatures and helpers (one machine interface)

**Definition.** Anything that is not the player and does work - tame animals, clay servants, clay golems, deployers, arms - touches
machines only through the workshop's stable interface on `Game.workshop`: `offer`, `take`, `crank`, `signal`, `act`, and
`standingOn` for wheels.

**Exists.** Clay servants (a block) crank touching cranks, fed 1 Spring essentia per 30 s. Mobs follow players holding a liked
item; `feed()` tames. Treadwheel reads `standingOn(x, y+1, z)` - the player only.

**Adds.**
- Harnessed animals (Unit 17): a tame animal led onto a treadwheel (it follows the liked item) and left there is HARNESSED: it stays
  on the wheel, walks in place, counts for `standingOn`. It must be fed a liked item every `HARNESS_FEED_S` 600 s or it steps off
  ("The goat is hungry and steps off the treadwheel"). Saved on the mob: `harness?: "x,y,z"`, `fedS?: number`.
- Brass horn (Unit 16): Use calls tame animals within 32 blocks to follow the player for 20 s (`MobManager.call(x, y, z, radius,
  seconds)`, Unit 16 owns the method; Unit 17 owns harness behaviour; both in `src/mobs/manager.ts`, separate methods).
- Clay golem (Unit 17): a walking servant. Set up exactly like a mechanical arm: wrench on the golem, then on a source, then up to 4
  targets within `GOLEM_RANGE` 8 blocks of its home cell, then the golem again. Targets may be a hand_crank (it walks there and
  cranks: 8 su), a depot/crate/basin/machine (it carries one stack per trip at `GOLEM_SPEED` 2 blocks/s using `take`/`offer`), or a
  block to `act` on (a hand station: it strokes). Fed like a servant (1 Spring per 30 s from a jar in its range or tubed); an
  elixir doubles its pace for 5 min. Padlocked chests are skipped (T8 trinkets).
- Deployer/arm/golem/vacuum collector all respect `padlock_chest` (Unit 16): `logi.take` refuses a locked container for every
  caller except the player's own hand.

**Rules.** No helper reads or writes another system's private state. A helper's status is one crosshair line:
`"Clay Golem - carrying 8 Flour to the Mixer, fed 22 s"`, `"Goat - harnessed to the treadwheel, fed 6.5 min"`.

### T7 - Knowledge and gating

**Definition.** The spine is gated only by furnace tier/temperature and item ages. Magic research gates only magic recipes
(`RESEARCH_GATES`). Objectives are of two kinds: the main track (sequential, teaches the spine) and side goals (optional, any
order, celebrate systems).

**Exists.** One sequential `OBJECTIVES` list; magic Goals in the notebook; `progression.ts` solver; `chemReady` for process cards.

**Adds.**
- **Side goals** (Unit 0 builds the mechanism; Unit 2 moves `six_cups` into it): `SIDE_OBJECTIVES: ObjectiveSpec[]` in
  `src/content/objectivesSide.ts`, tracked by the same tracker (flags/counters already recorded from minute one) but never "current";
  shown in the objectives panel (the hearth log) under "Side goals" with a done tick; completing one toasts "Side goal: <title>" and gives
  its reward. Feature files export `<FEATURE>_SIDE_GOALS` arrays that `objectivesSide.ts` concatenates.
- New side goals this build (owner units): `run_spirit` "Run your first spirit" (12, on `distill:step` done with process
  `distil_spirit`), `oil_the_works` "Oil the works" (8, a network oiled with lubricant), `pave_road` "Pave a road" (9, place 16
  asphalt), `bottle_elixir` "Bottle an elixir" (10), `crack_oil` "Crack heavy oil" (11), `ride_skiff` "Ride the skiff" (13),
  `read_the_wind` "Read the wind" (16, place a wind vane), `harness_animal` "Put an animal to work" (17), `walk_golem` "Wake a golem"
  (17), `pour_bench` "Fill a casting bench" (4), `tap_and_wait` "Tap a pine twice" (5, optional), `taste_them_all` = existing
  `six_cups` (2).
- New research entries (Unit 18) unlock magic conveniences that *reach into* other units' content: `late_draw` (spark/soul/void
  drawable), `golem_walk` (the clay golem infusion, 17), `steady_tubes` (tube flow x2, 19), `essence_ward` (a `vial_ward` in an
  elixir reaction makes 6 instead of 4, 10), `aura_dial` unlocks the HUD dial (19) - the dial itself also accepts `aura_reading`
  as before; see Unit 19.
- Codex (Unit 12 owns `scripts/codex/progression.json` edits for the distillery branch; other units add their items via the normal
  recipe extraction and only touch progression.json in a section headed with their unit name).

**Gating table for this build.**

| content | gate |
|---|---|
| ground burner, ladle, casting bench, bandage, spirit drinks, cloudy tinctures, sugar goods, side goals | ember (age 0, furnace tier 1) |
| vacuum pump, stirrer, clear tinctures, essences, elixirs, punch cards, trinkets, skiff riding | bronze (`ageIndexOf('bronze')`, tier 1 today) |
| lube base, lubricant, asphalt, tarred plank, steel flask, vault growth | forge (age 1, tier 2) |
| catalyst pellets, cracker, pressure cap, refinery tower, electromagnet | current (age 2, tier 3) |
| golem, late aspects | research entries (magic, optional) |

### T8 - Reading the world (one phrasing grammar)

**Definition.** A player learns state by looking: block lamps/particles, then the crosshair line (goggles add the kinetic line),
then a screen only for choices.

**Exists.** Workshop `describe()`, `inspector.ts` (goggles anywhere in the pack), distill `chemView().text`, clockface, the furnace
structure tab, the Workshop Guide (goggles on empty air).

**Adds.** Rig screen (6), structure-tab machines list (3), aura dial (19), wind vane / weather cock lines (16), golem/animal lines
(17), vault group line (15), bench line (4).

**Grammar (normative).**
- Line = `<Name> - <fact>, <fact>[, <fact>]`. First fact = the most important state (what it is doing), then numbers, then what
  it holds. Max ~60 characters on the HUD line; a second goggles line may carry kinetic facts.
- Numbers: rpm rounded to 0.1 (`16 rpm`, `12.5 rpm`); su with `fmt` (`4.25/8 su`); temperatures integer `C` in lines (`°C` only in
  screens via `formatTemp`); litres `<n> L` below 1000, `<x.x> buckets` at or above; time `14 s` under 60, `1.5 min` under 60 min;
  percentages integer `40%`.
- Problems are sentences that say the fix: `"no condenser on top - add a Condenser Coil"`.
- Examples to copy: `"Wind Vane - wind from the west, fresh (0.6)"`; `"Weather Cock - rain in about 2 min, signal on"`;
  `"Item Vault - group of 4, 312/432 stacks"`; `"Casting Bench - 3 moulds set, Pickaxe Mould ready to pour"`;
  `"Structure - 6 machines: Boiler, Steam Engine x2, Tank, Pump, Turbine"`; aura dial chips `"cinder 6  loam 4  gale 2"`.

### T9 - Sound and feel

**Exists.** Synth patches per feature (`sfxBrew.ts`, `sfxMagic.ts`, ...), `MAX_VOICES` 24, positioned within `HEARING_RANGE` 24,
ambience layers incl. a boil layer silent until `state.boil` is set.

**Adds.** `sfxDistill.ts` (Unit 12: `still_bubble` loop via the boil ambience layer fed by the number of boiling flasks near the
listener, `glass_chime` on step done, `drip` on a receiver filling, `distill_clunk` replaces `pipe_clunk` on blocked);
`sfxWorkshop.ts` (Units 13/14/16: `skiff_roll`, `spout_pour`, `horn_call`, `vane_creak`, `card_punch`); additions to
`sfxMagic.ts` (Unit 19: `tube_flow`, `golem_step` (17 may use), `aura_tick`).

**Rules.**
1. Name `<thing>_<sound>` snake_case. Add the name to the `SfxName` union in `src/core/gameEvents.ts`, the patch to the feature
   set, and the set's length to the `sfx.test.ts` expression (`72 + MAGIC + DISTILL + WORKSHOP`).
2. Loudness tiers (request `volume`): whisper 0.3 (drips, ticks), small 0.6 (UI, chimes), normal 1 (tools, machines), loud 1.4
   (falls, bells, horns), alarm 1.8 (seize, burst). Loops never above 0.6.
3. A machine makes sound only when its state changes or while it works; idle is silent.
4. Visual vocabulary: amber = working, green = done, red = blocked (distill lamps; reuse for the casting bench and the vacuum cap);
   particles at most 24 per emitter; tweened motion with ease-in-out over the step time (Unit 13); nothing teleports that could be
   seen moving.

### T10 - Saving

**Rules (normative).**
1. Every new saved field is OPTIONAL and sanitised on load; a missing field means the old default. Old saves must load (a test per
   unit: load a snapshot without the field).
2. Per-block state lives in maps keyed `"x,y,z"` inside the owning system's snapshot (`world.persist('<system>')`), cleaned by
   `verify()` / `blockChanged`, moved by `Workshop.relocate(map)` when contraptions move.
3. Player-level additions go in `src/save/document.ts` (`PlayerSnapshot`) as optional fields; no `SAVE_VERSION` bump in this build.
4. Durability-as-number is the only per-stack state: seconds left (boiling pail, ladle), fuel (chainsaw), wear (hand vacuum),
   charge (electromagnet). State that would need a second number on a stack goes on the player instead: chainsaw bar oil is
   `PlayerSnapshot.barOilLogs?` (logs of oiled cutting left, shared by every saw in the pack). `Inventory.add`, ground-item spill and stack merge must carry it (Unit 4 fixes the pail case generally).
5. Groups (vault multiblocks, harnessed animals) are DERIVED where possible and only their contents are saved.

---------------------------------------------------------------------------------------------------------------------------

## 4. Naming and id conventions

- Keys: lowercase snake_case, noun first, material prefix for variants: `bronze_cog`, `steel_flask`, `clay_ladle`,
  `ladle_bronze`, `lubricant_canister`, `elixir_swift`, `tincture_glowcap`, `punch_card_pulse`.
- Chem modules keep the distillery's words: `*_cap`, `*_bed`, `*_flask`, `*_head`; stateful ones have a `_done` twin
  (`filter_bed_done`, `catalyst_bed_done`, `steel_flask_done`), `item: false`, dropping the plain block.
- Workshop parts: one `PART_DEFS` row; faces `ws_<key>_front` / `_on`; non-kinetic ones in `NON_KINETIC`.
- Containers: `<fluid>_beaker` (250 L), `<fluid>_canister` (1000 L); exceptions that already exist stay (`pine_sap`, `wash_beaker`).
- Display names: Title Case, plain English, no borrowed names (no "Create", "Thaum-", "minecart"): "Vacuum Pump", "Chem Stirrer",
  "Casting Bench", "Clay Ladle", "Ladle of Bronze", "Brass Horn", "Weather Cock", "Clay Golem".
- Recipe ids: the output key (`forge(...)` helpers set `id = output`); a second recipe for the same output gets a suffix
  (`asphalt_vessel`, `rail_tarred`). Reactions: `rx_<what>` (`rx_asphalt`, `rx_crack_diesel`, `rx_elixir_swift`).
- Flags: past tense snake_case (`distilled`, `felled_tree`, `harnessed_animal`, `golem_woke`, `paved_road`).
- Events: `<system>:<verb>` (`distill:step`, `cast:poured`, `bench:filled`).
- Constants: SCREAMING_SNAKE in the owning module (`GOLEM_RANGE`, `SPOUT_LPS`, `ELIXIR_BUFF_S`).

---------------------------------------------------------------------------------------------------------------------------

## 5. Balance scales (canonical numbers)

### 5.1 Temperatures (C)

| thing | value | reason |
|---|---|---|
| burner caps | charcoal 250, coal 280, ethanol 300, kerosene 350 | below the glass limit; kerosene reaches crude refining (350) |
| glass limit | 450 | `GLASS_MAX_C` |
| steel shell limit | 600 | above the cracker (480) with margin |
| vacuum boiling | bp x0.7 under `vacuum` | DISTILLERY_PLAN 2 |
| pressure boiling | bp x1.3 under `pressure` | DISTILLERY_PLAN 2 |
| essence window | 50-80, ruin above 80 | heat-sensitive drink actives |
| maceration | 45-60 | tinctures |
| asphalt mix | 150-250 | bitumen flows, does not burn |
| cracker | 460-520 | needs steel flask + pressure cap + catalyst |
| ladle cooling | `MOLTEN_WINDOW_S` 20 s | same as the crucible pool |

### 5.2 Rates and capacities

| thing | value |
|---|---|
| boil | `BOIL_LPS` 20 L/s, 400 J/L (8 kW) |
| spout / drain continuous | `SPOUT_LPS` 250 L/s |
| tube essentia flow | `TUBE_UPS` 4 units/s per network (instant for jars directly touching the consumer); `steady_tubes` x2 |
| reaction batch | `batchL` 250-1000 L; seconds 30-120 at base speed; stirred x2 |
| vault | `VAULT_STACKS` 108 per cell; a group shares the sum (4 cells = 432) |
| golem | range 8, speed 2 blocks/s, carries one stack (up to 64), 1 Spring / 30 s |
| harness | 12 rpm / 24 su; feed every 600 s |
| electromagnet | radius 12, pull 14 b/s, burst 3 s, 400 W while pulling, charge 120 kJ (100 bursts) held as durability; Use it on a `battery` / `lithium_bank` block to draw up to the missing charge from that network's storage (new sim hook `drawJoules(x, y, z, J): number`); metal items only (keys containing `ore`, `ingot`, `plate`, `wire`, `bloom`, `scrap`, `nugget`, or tools of metal) |
| chainsaw bar oil | one lubricant canister = `BAR_OIL_LOGS` 240 logs of oiled cutting: fuel per log x0.75 (7 -> 5.25) |
| skiff | 5 blocks/s (`SKIFF_STEP_S` 0.2), rider seat offset 0.6 |
| bandage | 6 HP over 12 s (`MAX_HEALTH` 20) |
| elixir | 540 s; 4 per 1000 L batch (6 with `essence_ward`) |

### 5.3 Costs (guidance)

A thing costs roughly what its neighbours of the same age cost. Ember goods: clay, flint, fiber, cloth, a little copper/tin.
Bronze parts: 1-4 bronze ingots or cogs, planks, a belt or cloth. Forge parts: iron/steel plate 2-4, glass 1-2. Current: alumina,
circuit, coil. Trinkets are CHEAP (<= 2 ingots); they exist for delight and information.

---------------------------------------------------------------------------------------------------------------------------

## 6. Cross-unit dependency and interface contracts

### 6.1 Unit 0 - Foundations (new; builds first, alone, small)

Three units need a generic reaction engine and several need the same hooks. Building those once, first, removes most merge pain.
Unit 0 owns, and every other unit may assume after it merges:

1. **Reaction engine** in `src/sim/distill.ts` + `src/core/reactions.ts` (types) + `src/content/reactionsDistill.ts` (empty list +
   fermenting moved into it as `rx_ferment_wash`): `ReactionSpec` exactly as DISTILLERY_PLAN section 6, plus `items` consumed from
   the vessel's new `items?: (ItemStack|null)[]` (4 slots, saved, optional) and `gives` items into an output slot list
   `out?: (ItemStack|null)[]` (4 slots). Use with an item on a vessel puts it in a slot; empty-hand Use on a vessel with outputs
   takes them. `Distillery.offerItem(x,y,z,item,count)` / `takeItem(x,y,z,filter,max)` exist so the workshop `logi` can treat
   vessels as containers (arms, golems).
2. **Capabilities** computed per vessel/stack: `heated`, `sealed` (exists), `cooled` (jacket), `vacuum`, `pressure`, `stirred`,
   `catalyst:<item>`; the last four read hooks on `Distillery`: `vacuumAt?`, `stirredAt?` (set by Game from the workshop) and the
   presence of `vacuum_cap` / `pressure_cap` / `catalyst_bed` blocks (block specs registered by their owning units; the scan
   recognises them by key through the `CHEM` table extension below).
3. **`CHEM` table extension points**: `CHEM` gains `vacuumCap: 'vacuum_cap'`, `pressureCap: 'pressure_cap'`, `filter: 'filter_bed'`,
   `catalyst: 'catalyst_bed'`, `reflux: 'reflux_head'`, `steelFlask: 'steel_flask'`, with `CHEM_CAPACITY_L` rows. Unit 0 adds the
   keys and capacities only; owning units add the block specs, rules and behaviour.
4. **Fluids**: `lube_base`, `lubricant` in `FluidKey`, `DISTILL_FLUIDS`, `GRADES`, `CHEM_CONTAINERS` (+ canister items).
5. **Side goals** mechanism (T7) with an empty `SIDE_OBJECTIVES`.
6. **Hooks (signatures only, default no-op)**:
   - `Workshop.standingOn` widened to `(x, y, z) => boolean` unchanged in type but documented to include harnessed mobs (17 fills);
   - `Workshop.fluidBlock` gains `draw?(x,y,z, fluid, L): number` and `fill?(x,y,z, fluid, L): number` (14 implements);
   - `WorkshopView` gains `moving: MovingView[]` (`{ cells: [x,y,z,key][], from: [dx,dy,dz] | null, rot: -1|0|1, pivot, t0, durS }`),
     empty by default (13 fills);
   - `BlockSpec.surface?: { walk: number; vehicle: number }` read by physics and the tractor (9 sets values);
7. Tests: reaction conservation fuzz (litres in = litres out), save round-trip of vessel slots, a fake reaction with each
   capability, side goal completes out of order.

Unit 0 does NOT add gameplay content beyond moving fermenting into the reaction table and the two fluids. It must leave every
existing test green.

### 6.2 Ownership of shared ids (who defines, who consumes)

| id / API | defined by | consumed by |
|---|---|---|
| reaction engine, vessel slots, capabilities, `CHEM` extension, side goals, hooks above | 0 | 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17 |
| `vacuum_cap` block, `vacuum_pump` part, `Workshop.vacuumAt(x,y,z)`, `filter_bed`, `LUBE.lubricant`, bar oil | 8 | 10 (essences need vacuum), 12 (pump on shared networks), 11 (vacuum + pressure caps exclusive) |
| `BURNER_FUELS`, `tankFluids()`, receiver->tank | 7 | 8, 10, 11 (their fluids flow to tanks) |
| `reflux_head`, `catalyst_bed`, `pressure_cap`, `steel_flask`, `refineryScan`, `catalyst_pellets` | 11 | 6 (rig screen shows them generically from the scan) |
| `chem_stirrer` part, `Distillery.stirredAt` wiring, `distill:step` event, `sfxDistill.ts`, distillery Codex branch | 12 | 9, 10, 11 (reactions may list `stirred` as a speed-up), 6 (screen lists "stirred") |
| rig screen, ghost previews, `chemView` richer fields (`capabilities`, `problems[]`) | 6 | - (reads everything generically: NEVER hard-codes a module list; iterates `CHEM`) |
| `BlockSpec.surface` values, `asphalt`, `tarred_plank`, `rx_asphalt`, `rx_tar_planks` | 9 | 16 (rail recipe alternative), 13 (skiff hull - optional) |
| elixirs/tinctures/essences/bandage, `tipsyS`, `tonic` family, `night_sight`, `healOverTime` | 10 | 17 (golem elixir, bandage on golem), 18 (`essence_ward`) |
| `clay_ladle`, `ladle_<metal>`, `ItemSpec.cools.returns?`, casting bench | 4 | - |
| sap tap save, sweetened drinks, sugar into vessels, baked goods | 5 | 10 (syrup in elixirs: existing syrup grade) |
| side goal `six_cups` move, drying rack sky rule (glass no longer counts) | 2 | 16 (weather cock signal story) |
| `MovingView`, skiff seat (`Workshop.seatAt`, vehicle manager riding) | 13 | 15 (belts re-run after moves must not fight the tween: 15 recomputes on the step's END) |
| `fluidBlock.draw/fill`, continuous spout/drain, `electromagnet`, `COLLECTORS.electromagnet`, `drawJoules` sim hook | 14 | - |
| vault groups, belt border hand-off | 15 | 17 (golems target vault groups as one container) |
| trinkets, `padlock_chest` lock rule in `logi.take`, punch cards, `MobManager.call`, `windDirAt` | 16 | 17 (golems skip padlocks), 2's rack story |
| harness, `clay_golem` mob, golem setup, `standingOn` mob read | 17 | 18 (`golem_walk` gate) |
| `late_draw`, new entries, desk vial refund | 18 | 19 (`steady_tubes` flag read), 10 (`essence_ward` flag read), 17 (`golem_walk` flag read) |
| aura dial, `TUBE_UPS` flow, magic sounds/balance | 19 | - |
| e2e chain green | 1 | everyone (runs FIRST in Wave 1 so the baseline is red-free) |

### 6.3 Build order (waves)

- **Wave 0:** Unit 0 (foundations) and Unit 1 (e2e chain green). Both small-ish; Unit 1 touches scripts and whatever is red.
- **Wave 1 (parallel):** Units 2-9, 12-19.
- **Wave 2 (after 8 lands):** Units 10 and 11 (they need the vacuum cap and the scan conventions of 8).
- Unit 6 runs in Wave 1: it is generic over `CHEM`, so modules that land later appear in its screen with no edit.

Flag reads across units (`hasFlag(research, 'steady_tubes')`, `'essence_ward'`, `'golem_walk'`) are plain string checks; a unit
reading a flag another unit defines works before the other merges (the flag is simply never set).

### 6.4 Changes to the batch plan (scope moves made by this document)

The first batch plan (`/root/.claude/plans/unified-herding-minsky.md`) cut the work by file area. Read against the threads, three
cuts split one mechanism across two units; this document moves them so each mechanism has ONE owner:

| item | was | now | why |
|---|---|---|---|
| reaction engine (`REACTION_SPECS`, vessel item slots, capabilities) | implied inside 9, 10, 11 | **Unit 0** | three units need the same engine; three copies would conflict |
| vacuum pump (WHATS_LEFT 2 "a vacuum pump hookup") | 14 | **8** | the pump exists to make chemistry's vacuum; it and the vacuum cap are one mechanism |
| reflux head | 8 | **11** | reflux head, catalyst bed and pressure cap are all column-stack modifiers read by the same scan code |
| filter bed | 8 | **8** (unchanged) | lube base -> lubricant needs it; tinctures (10) reuse it |
| side goal mechanism | 2 | **Unit 0** (2 moves `six_cups` into it) | eleven units add side goals |
| `distill:step` objective | 12 | 12 owns the event and `run_spirit`; other units' side goals listen to their own events | - |
| electromagnet | 14 | 14 (unchanged) | - |

Unit 14 is therefore "Continuous fluids and the electromagnet". Unit 8 is "Vacuum line and lubricant". Unit 11 is "Column modifiers
and the refinery".

### 6.5 Interface sketches (Unit 0; TypeScript shapes the other units code against)

```ts
// src/core/reactions.ts
export type Capability = 'heated' | 'sealed' | 'cooled' | 'vacuum' | 'pressure' | 'stirred' | `catalyst:${string}`;
export interface ReactionSpec {
  key: string;                         // 'rx_asphalt'
  name: string;                        // 'Asphalt mix'
  in: Partial<Record<Component, number>>;   // parts by volume taken from the vessel's Mix
  items?: ItemAmount[];                // consumed from the vessel's item slots per batch
  out: Partial<Record<Component, number>>;  // parts put back; sum(out) == sum(in) unless gasLoss
  gasLoss?: number;                    // share of the batch that leaves as vapour (vented)
  gives?: ItemAmount[];                // into the vessel's output slots when a batch completes
  needs: Capability[];                 // all must hold
  speedUps?: Partial<Record<Capability, number>>; // e.g. { stirred: 2 }
  tempC: [number, number];             // window; outside it the reaction pauses
  ruinC?: number;                      // above it the batch turns to slop and the vessel goes 'blocked'
  batchL: number;                      // litres of `in` per batch
  seconds: number;                     // base seconds per batch
  age: AgeName;                        // ageIndexOf at the call site
}
// src/content/reactionsDistill.ts
export const REACTIONS: ReactionSpec[] = [/* rx_ferment_wash (moved), then units append */];

// src/sim/distill.ts additions
interface ChemEntity { /* existing */ items?: (ItemStack | null)[]; out?: (ItemStack | null)[]; rx?: { key: string; doneL: number } }
class Distillery {
  vacuumAt: ((x: number, y: number, z: number) => boolean) | null; // Game: workshop.vacuumAt (Unit 8)
  stirredAt: ((x: number, y: number, z: number) => boolean) | null; // Game: workshop.stirredAt (Unit 12)
  capabilitiesOf(x: number, y: number, z: number): Capability[];
  offerItem(x: number, y: number, z: number, item: string, count: number): number;
  takeItem(x: number, y: number, z: number, filter: string | null, max: number): ItemStack | null;
}

// src/content/objectivesSide.ts
export const SIDE_OBJECTIVES: ObjectiveSpec[] = [/* ...BREW_SIDE_GOALS (Unit 2), ...DISTILL_SIDE_GOALS (Unit 12) ... */];
// src/game/objectives.ts: ObjectiveTracker.side(): { spec, done }[]; emits 'objective:side' { id } once per goal.

// src/workshop/workshop.ts additions (types only in Unit 0)
export interface MovingView { cells: [number, number, number, string][]; from: [number, number, number] | null; rot: -1 | 0 | 1;
  pivot: [number, number, number] | null; t0: number; durS: number }
export interface WorkshopView { spin: SpinView[]; swings: SwingView[]; links: LinkView[]; moving: MovingView[] }
fluidBlock: { is(...): boolean; use(...): string | null; draw?(x, y, z, fluid: string, L: number): number; fill?(x, y, z, fluid: string, L: number): number } | null;

// src/core/types.ts
interface BlockSpec { /* existing */ surface?: { walk: number; vehicle: number } }
interface CoolsSpec { to: string; afterS: number; returns?: string } // returns: handed back into the pack too (Unit 4 uses)
```

Units must not change these shapes; if one needs more, it adds an OPTIONAL member and says so in its spec.

---------------------------------------------------------------------------------------------------------------------------

## 6b. Integration journeys (the web, walked)

These are the stories the finished build must make possible. Each step names the unit and the number. Unit specs use them as e2e
inspiration; the coordinator uses them as the final acceptance walk.

### J1 - The oil chain (Forge): from crude to a quiet, strong workshop
1. Pump crude into a tank (exists) -> canister -> 3-segment column at 350 C: gasoline, kerosene, diesel, residue (exists).
2. Kerosene canister into a ground burner far from the base: 350 C for 300 s (7). The far-field still can now refine too.
3. Residue into a flask whose stack carries a `vacuum_cap`; a `vacuum_pump` touching the cap, cranked or on a water wheel at 16 rpm
   (8). Under vacuum boiling points fall to 0.7x: at 330 C the diesel tail comes over first (196 C), then lube base (259 C); bitumen
   (364 C) stays in the flask. Unit 8 decides where the cap sits on a stack and documents it in the rig legend (`U`).
4. Lube base -> receiver -> `filter_bed` loaded with clay -> receiver: lubricant (8). Bottle it in a canister by hand, or a
   `chem_port` on the receiver pipes it into a tank (7) and a pipe-fed spout fills canisters on a belt continuously (14).
5. Use a lubricant canister on a shaft: the whole network x1.5 for 15 min, goggles say ", oiled" (8, T2). The empty canister comes
   back. Side goal "Oil the works".
6. The same canister on a carried chainsaw: 240 logs of bar-oiled cutting, 5.25 fuel per log instead of 7 (8).
7. The bitumen left in step 3 is poured into a heated reaction vessel with gravel and sand: asphalt (9). Pave a road from the
   pumpjack to the base; the tractor runs 7.7 m/s on it (5.5 x 1.4). Side goal "Pave a road".

### J2 - The potion chain (Bronze): from a cup of tea to an elixir
1. Brew four cups of light roast (exists). Put them into a reaction vessel's slots with an empty glass vial (0, 10).
2. Vacuum cap + pump on the vessel's stack (8), base at 60 C: the essence comes off without ruining (window 50-80) - an
   `essence_swift` in the vial lands in the vessel's output slot (10).
3. Glowcap + spirit at 50 C in another vessel: cloudy tincture; through a filter bed of charcoal: clear (10).
4. Essence + clear tincture + syrup in a stirred vessel (12's stirrer on a crank) or heated vessel: 4 `elixir_swift` (10).
   With research `essence_ward` and a `vial_ward` in a slot: 6 (18).
5. Drink: Swift for 9 minutes in the coffee slot; the HUD pill reads "Swift 9:00" (T5). A golem fed an elixir works twice as fast
   for 5 minutes (17). Side goal "Bottle an elixir".

### J3 - Hot metal (Ember): the furnace's heat leaves the furnace
1. Press an unfired ladle at the clay table, fire it (4). Smelt copper: a molten pool in the crucible, 20 s window (exists).
2. Use the clay ladle on the furnace (or the SMELT tab button "Take with the ladle"): `ladle_copper` in the hand, 20 s and falling
   (durability = seconds) (4).
3. Walk to the Casting Bench (3 moulds set): Use pours into the moulds in order (4). Or walk to a stone anvil anywhere: Use puts hot
   metal on it and opens the hot window - hammer strokes now (4).
4. Too slow: the ladle cools; the pack gets a copper bloom AND the empty ladle back (`cools.returns`) - nothing lost, smelt again.
5. Or stand the bench within 4 blocks of the furnace and press "Pour to bench" in the SMELT tab: the pool fills the bench's moulds
   (4). Side goal "Fill a casting bench".

### J4 - The wheel and its helpers (Bronze -> Forge)
1. Tame a goat with wheat (exists). Hold wheat: it follows; walk onto the treadwheel and off again: the goat stays, HARNESSED (17).
   Shaft: 12 rpm / 24 su. Feed it every 10 min or it steps off with a toast.
2. Lost the goat behind the hill? The brass horn calls tame animals within 32 blocks (16).
3. Research `golem_walk` (18), infuse a clay golem (17). Wrench: golem, then the flour depot, then the mixer, then the golem. It walks,
   carries, comes back; padlocked chests it ignores (16). A vault group is one target (15).
4. The wheel drives a ratio dial into a gearshift with a punched "swing" card (16): a mixer that reverses every 3 s.

### J5 - Rain-proof racks (Ember -> Bronze): an owner decision becomes a contraption
1. The drying rack no longer works under glass (2): it needs open sky; rain spoils the dry. 
2. A weather cock (16) on the roof: "Weather Cock - rain in about 2 min, signal on". Its signal goes down a signal wire into a
   lever-driven piston (exists) that pushes a framed roof over the racks while it rains; the bell rings (exists).
3. The tween (13) makes the roof glide over the racks instead of popping. Side goal "Read the wind" (16).

### J6 - The refinery (Forge -> Current)
1. Steel flask (11) on a base on a Blast Furnace (1500 C): holds to 600 C. Reflux head on the column: wrench cycles return 0/50/75%
   - fuel ethanol in one pass with 75% (11).
2. Catalyst pellets (alumina + silica, Arc Furnace) in a catalyst bed in the stack, pressure cap on top, 480 C: diesel cracks to
   gasoline (11). Side goal "Crack heavy oil".
3. The refinery tower multiblock (11) runs crude at 4x the column rate; the rig screen (6) lists its problems and its capabilities;
   ghosts (6) show the missing casings from the process card.
4. Gasoline canisters feed the chainsaw (x1.3) and the tractor (x1.2) (exists). Out in the field, the electromagnet (14) pulls the
   ore and ingots lying around a mined vein back to the player from 12 blocks, recharged at the base's lithium bank.

---------------------------------------------------------------------------------------------------------------------------

## 6c. Testing and acceptance conventions (every unit)

- **Unit tests** co-located `*.test.ts`. Pure helpers (`*Text.ts`, `*Logic.ts`, scan rules, reaction steps) are tested without a
  world; sim behaviour with the existing fixtures: `setup()` from `src/workshop/parts.test.ts`, `buildRig(rig)` / `feed` /
  `runUntil` from `src/sim/distillKit.ts`, `fakeWorld.ts` in `src/game`, herd fixtures from `src/mobs/herd.test.ts`.
- **Content tests**: every new key in the feature's `specRoster<Feature>.ts` with its recipe count; icons pass the texture
  readability test; `content.test.ts` progression still completes; `gates.test.ts` still proves magic optional.
- **Save tests**: round-trip of the new state; an old snapshot without the field loads to defaults.
- **Conservation tests** for anything that moves litres or items (fluids never appear; items never vanish on split/merge/move).
- **E2E**: extend the feature's existing script with named steps (`step('casting bench fills from the ladle', ...)`), use
  `window.__hw` only for setup and reading state, real input for the action; run `--device=desktop` and, for any UI, also
  `--device=phonePortrait`; save a screenshot per new step to `test-results/e2e-<feature>/`.
- **Docs**: update the feature's `docs/api/*.md` "what exists" section in the same PR; never edit `docs/WHATS_LEFT.md` (the
  coordinator does).

## 6d. Anti-patterns (rejected in review)

- A second multiplier for something a thread already owns (a "lubricant bonus" outside `LUBE`; a "road speed" outside `surface`).
- A hard-coded list of fluids, modules or parts where a registry exists (tank accepts, rig screen module list, goggles kinds).
- A helper that reaches into another system's private maps instead of `offer/take/crank/act`.
- Per-stack metadata smuggled in some other way (encoding data in counts, parallel maps keyed by slot index).
- A new screen where a crosshair line or a Use cycle would do; a screen that is not usable at 390 px.
- Literal age numbers; `age: 1` written for "forge" instead of `ageIndexOf('forge')` in new code.
- A side goal inserted into the sequential `OBJECTIVES` track.
- Sounds that loop while idle; particles without a cap; anything that allocates per frame in render loops.

---------------------------------------------------------------------------------------------------------------------------

## 7. Per-unit briefs (role in the whole, threads carried)

**Unit 0 - Foundations.** The quiet unit that makes the loud ones agree: reaction engine, vessel slots, capabilities, the two oil
fluids, side goals, hook signatures. Threads: T3, T7, T10 (defines), T2/T5 (hook shapes).

**Unit 1 - E2E chain green.** Re-runs `npm run e2e` headless and fixes real regressions so every later unit's e2e step lands on a
green baseline. Threads: none new; guards all.

**Unit 2 - Owner decisions.** Moves "Taste them all" (`six_cups`) to side goals; verifies the cup/cone forge recipes are gone and
cleans text that still mentions them; makes the drying rack stop under glass (glass is a roof now), which turns the weather cock
(16) into a real tool: a rain signal closing a piston roof over racks. Threads: T7, T8.

**Unit 3 - Small known gaps.** Crops pop off when their farmland goes; the steam engine draws no heat when idle; UI size floors
(captions >= 10 px, hotbar >= 44 px); the structure tab lists its machines ("Structure - 6 machines: ..."); pump/boiler/turbine
wording polished to T8 grammar. Threads: T1 (idle draw), T8.

**Unit 4 - Casting and hot metal.** The clay ladle carries the furnace's molten pool out into the room: to a Casting Bench of 4
moulds (pour to bench from a furnace within 4, or by ladle), or to a stone anvil anywhere for hot work. The boiling pail keeps its
seconds through every inventory path. Threads: T1, T4, T8, T9, T10.

**Unit 5 - Sap tap and sugar food.** The tap remembers (saved), drips (particles, a slow amber bead animation) and the sugar chain
grows: more baked goods, sweetened drinks (x1.5 buff + rush), and sugar as a chemistry input (a vessel of water + sugar ferments).
Threads: T4, T5, T9, T10.

**Unit 6 - Rig screen and ghosts.** The distillery's STRUCTURE tab: wrench on any module opens a phone-friendly screen with the
rig's problems (tap one: the block glows), capabilities ("This rig can: distil, 2 cuts, ferment, stirred"), and a process picker
whose card shows ghost blocks for what is missing. Generic over `CHEM` so new modules from 7/8/11/12 appear without edits.
Threads: T8, T9.

**Unit 7 - Ground burner and tank fluids.** The far-field fire (charcoal 250 C ... kerosene 350 C) and the one accept list: tanks take
every fluid; receivers pipe into tanks end to end. Gives kerosene its first use. Threads: T1, T3, T10.

**Unit 8 - Vacuum line and lubricant.** Vacuum cap + shaft-driven vacuum pump + filter bed: residue -> lube base -> lubricant, the top
of the oil ladder (x1.5, 15 min) and the chainsaw's bar oil. This is also the "vacuum pump hookup" of WHATS_LEFT section 2 (the
workshop pump makes chemistry's vacuum). Threads: T1, T2, T3, T4, T8.

**Unit 9 - Bitumen and asphalt roads.** Residue's heavy end becomes roads and tarred planks; the one speed rule gains a surface
term; the tractor finally has a reason to stay on the road. Threads: T3, T4, T5.

**Unit 10 - Potions, spirits and bandage.** The brewing buffs concentrated: essences under vacuum, tinctures by maceration and
filtering, elixirs that run three times as long, a glowcap draught for night sight, spirit you can drink (Warmed, Tipsy) and a
bandage made of spirit and cloth. Threads: T3, T4, T5, T10.

**Unit 11 - Refinery chemistry.** The column grows up: reflux head (purity for flow), catalyst bed + pressure cap + steel flask =
cracker (heavy oil to gasoline at 480 C), and the refinery tower multiblock (hearthScan-style) that runs crude at scale. Threads:
T1, T3, T4, T8.

**Unit 12 - Distill shaft hooks and polish.** The chem stirrer joins the kinetic world (stirred x2), the `distill:step` event lands
with its side goal, the distillery gets its own sounds and a Codex branch, and a written balance pass. Threads: T2, T7, T9.

**Unit 13 - Workshop motion and skiff riding.** Pistons, bearings and skiffs glide instead of jump (a `MovingView` tween), and the
player can board the skiff and ride the rails. Threads: T2 (visual), T9, T10.

**Unit 14 - Continuous fluids and the electromagnet.** Spouts and drains fed by pipes pour continuously (250 L/s); the Current-age
electromagnet pulls metal from 12 blocks on its own charge, recharged at batteries. Threads: T1, T3, T4.

**Unit 15 - Vault growth and border belts.** Touching item vaults merge into one store (4 cells = 432 stacks), splitting keeps
every item; belts at a structure border hand items across after each move. Threads: T6 (golems target groups), T8, T10.

**Unit 16 - Trinkets and punch cards.** Small delights with jobs: wind vane (where to put turbines), weather cock (rain signal),
spyglass (zoom), brass horn (call animals), padlock chest (keeps machines and golems out), lantern chain (light); punched cards
program the gearshift. Threads: T2, T4, T6, T8, T9.

**Unit 17 - Harnessed animals and walking golems.** Tame animals walk the treadwheel; clay golems walk up to 8 blocks to carry,
crank or stroke, set up like an arm. Threads: T2, T6, T10.

**Unit 18 - Magic aspects, research and vials.** Spark, soul and void become drawable after `late_draw`; the rune desk pours a vial's
rest back into a jar; new entries reach into golems, tubes and elixirs. Threads: T4, T7.

**Unit 19 - Aura dial, tube flow and magic sound.** A small HUD dial shows the land's aspects while the rod is held; tubes carry
4 units/s (8 with `steady_tubes`) with visible motes; a sound and balance pass. Threads: T3 (essentia flow), T8, T9.

---------------------------------------------------------------------------------------------------------------------------

## 8. Open questions for the owner (genuinely unresolvable here)

1. **`vacuum_pump` key.** BRONZE_PLAN 5.4 reserves `vacuum_pump` for an air-network device on item chutes. This build uses the key
   for the shaft-driven pump that makes chemistry's vacuum; when Bronze B2 lands, the air network should treat this same block as its
   vacuum source rather than adding a second block. OK? (Default: yes.)
2. **Golems and automation.** OVERHAUL_PLAN B open question 3 asked whether a construct may automate crafting. This build lets a golem
   carry, crank and stroke hand stations (the same things an arm and a deployer already do). OK? (Default: yes, it adds nothing an arm
   cannot already do; it walks.)
3. **Tipsy.** Is a mild sway + blur acceptable in a game played on phones? (Default: yes, amplitude 0.6 deg; there is no
   "reduce motion" setting today, so Unit 10 puts the amplitude in one constant `TIPSY_SWAY_DEG` that can be set to 0.)
