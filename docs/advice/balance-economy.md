# Hearthwatt - balance and economy advice

Advisor: balance and economy (read-only pass, 2026-11-21). Numbers are expressed per **age name** and **recipe id**, never per tier index, because the
six-age refactor is renumbering tiers under this document.

**Method and its limits (read first).** All content numbers were read from the committed tree at `9e3b862` (five furnace tiers, old `age:` fields),
dumped through the real registry (`ITEMS`, `RECIPES`, `BLOCKS`, `ORE_VEINS`, `MACHINE_SPECS`) with `vite-node`. The Bronze Age parts are NOT in code yet, so
their costs come from the tables in `docs/BRONZE_PLAN.md` / `docs/STEAM_PLAN.md` (marked *planned*). Nothing was built, run in a browser or played: every
"minute" below is a **model estimate**, not a measurement. The script is `balance-model.ts` in the shared notes folder
(`C:\Users\admin\AppData\Roaming\Claude\side-session-notes\local_4bdc7aa5-0ceb-445b-9336-843dec94f1d4\`); it must live in a `src/content/timeModel.ts` +
test before anyone trusts it (section 5).

---

## 1. Resource-flow model

### 1.1 Formulas (all parameters are assumptions, flagged `A`)

| Quantity | Formula | Source |
|---|---|---|
| Mining time of a block | `hardness / toolSpeed` (x3 and no drop below `minTier`; x1/1.25 when Well-Warmed; x1.25 Vigor) | `game/mining.ts` |
| Tool wear | exactly 1 durability per matching block | `mining.ts:wear` |
| Gather cost of one raw item | `(mineTime + vein overhead) / (expected drop count x chance)`; vein overhead = `30 s / (veinSize x 0.8)` per ore block `A`, trees 6 s per 4 logs `A` | `oreVeins.ts` |
| Craft cost (attended) | hand/workbench = 2 s of taps `A`; strokes stations `strokes / strokesPerS` (quern 3/s, anvil 2.5/s x2 with hammer, mortar 2/s, loom 2/s) | `blocksHand.ts` |
| Smelt | crucible-seconds = `timeS`; wall time = `crucible-s / (crucibles x furnace.speed)`; runs parallel to gathering (counted at 25% attended) `A` | `recipes.ts`, `tech.ts` |
| Fire-seconds for a job | `crucible-s / (crucibles x speed x 0.7 utilisation)` `A` | |
| Fuel items | `fire-s / burnS` (charcoal 80 s, coal 100 s, coke 120 s, peat 50 s, log 50 s). Fuel burns at a fixed `energyJ/burnS` while lit whether or not the temperature is capped, so draft shortens the burn by `1+draft` | `sim/furnace.ts:170` |
| Heat-up | `heatCapacityJ x dT / qFuel` = 150 J/C x 780 C / 5 kW = **23 s** for a Clay Furnace on charcoal | `sim/furnace.ts` |
| Raw cost of an item | cheapest-route fixed-point over every recipe (cost in expert seconds); containers (pail, beaker, vial, moulds) are reusable and cost 0 | `balance-model.ts` |
| Expert minutes -> player minutes | `x 2.0` `A` (phone controls, exploring, building the shell, nights, learning). **Unverified: calibrate from the first real playthrough log.** | |

"Expert" = never lost, never dies, optimal tool at each step, one trip per ore. It is a *lower bound*; a first-time phone player lands at ~2x.

### 1.2 Gather costs per raw item (expert seconds per unit, vein overhead included)

| Raw | flint tools | bronze tools | iron tools | steel tools | notes |
|---|---|---|---|---|---|
| oak/pine log | 2.5 | 1.6 | | | 4 logs a tree |
| clay | 2.0 | 1.5 | | | shovel |
| rubble | 2.5 | | | | stone h4 |
| flint | 8.0 | | | | gravel drops flint 25% |
| copper ore | 9.0 | 6.9 | | | h5.5, vein 6 blocks, 4 veins/chunk |
| tin ore | 10.3 | 7.7 | | | h5.5, vein 5, 2.5 veins/chunk (scarce) |
| coal | 4.8 | 3.9 | 3.9 | | h5, drops 1-2 |
| iron ore | - | 11 | 7.8 | | h7, needs a bronze pick (tier 2) |
| wolframite / spodumene | | | | 9.5 / 9.3 | h12/h11, tier 4, 0.7 / 0.6 veins/chunk |
| bauxite / quartz | | | | 7.6 / 8.8 | h8, tier 3 |
| pitchblende | | | | needs `power_drill` | h14 tier 5 |

### 1.3 What it takes to leave each age (expert seconds, raw bill, smelt load)

Bundles are the furnace upgrade list plus the age's own kit, so "to reach the next furnace tier" includes the machines the age exists to teach.

| Age (bundle) | Raw bill | Gather+craft (expert) | Crucible-s | Fire fuel |
|---|---|---|---|---|
| **Ember** kit: workbench, flint tool trio, `furnace_clay`, 10 charcoal | 12 rubble, 12 oak_log, 9 fiber, 6 clay, 5 flint | 2.9 min | 80 | 1 charcoal/80 s |
| **Ember** metal: 15 `bronze_ingot` (13 for cast heads + 2 `bronze_hammer`), 45 clay for 9 moulds/pot/cup/cone, 8 `stone_brick`, cord | 9 copper_ore, 3 tin_ore, 45 clay, 18 fiber, 8 rubble | 5.4 min | 86 | |
| **Ember -> Bronze gate** (planned: 8 `bronze_ingot`, 4 `firebrick`, 1 `bellows`, 2 `bronze_plate`, 1 `leather` at 700 C) | 7 copper_ore, 3 tin_ore, 12 fiber, 2 clay, 1 hide, 1 log | 3.1 min | 81 | |
| **Ember total** (plus food, farm, brew, ~3 min not modelled) | ~30 Cu+Sn ore, ~60 clay | **~12-15 min** | ~250 | ~5 charcoal |
| **Bronze** *planned*: `boiler_plate` x30, gauge glass, heat/water/steam port, `safety_valve`, 2 gauges, 12 `steam_pipe`, `steam_engine_b`, `air_compressor`, `air_tank`, `blast_nozzle`, 8 thermocouples, 24 `brick` | 85 copper_ore, 28 tin_ore, 49 clay, 5 sand | 32 min (+ ~6 min first-half steam kit: saw, millstone, trip hammer, stamp mill, press, wheel, clockwork = ~350 s) = **~38 min** | 1,197 | ~8 charcoal/coal |
| **Forge** kit: iron/steel pick+axe, `plated_coat`, `steel_cuirass`, `crusher`, `boiler`, `steam_engine`, 2 `tank`, `pump` | 56 iron_ore, 44 fiber, 15 sand, 9 coal, 9 limestone, 7 copper_ore | 19 min | 1,193 | ~7 coal |
| **Forge -> Current gate** (HEAD): 2 `copper_coil`, 2 `steel_plate`, 24 `refractory_brick`, 1 `electrode` | 48 clay, 19 coal, 7 iron_ore, 4 limestone | 7.8 min (+ dynamo, not in code) | 638 | |
| **Forge total** | | **~27 min** | ~1,800 | |
| **Current** kit: `steam_turbine`, `still`, 2 `wind_turbine`, `chainsaw`, `bore_rig`, 2 `battery`, 6 `heavy_cable`, 4 `circuit` (not `ward_beacon`: needs 2 `ember_core`, a drop) | 36 iron_ore, 16 copper_ore, 16 coal, 12 silica, 9 bauxite, 6 sulfur | 18.3 min | 1,126 | |
| **Current -> Atomic gate** (HEAD): 53 `plasma_casing`, 2 `circuit`, 2 `tungsten_rod`, 2 `power_port` | 57 iron_ore, 55 coal, 53 limestone, 29 wolframite, 27 bauxite | **36 min** | 2,390 | ~8 coke |
| **Atomic** kit: `fission_pile`, `centrifuge`, `electrolyzer`, `power_drill`, `shield_suit`, `lithium_bank`, 6 `super_cable` | 34 silica, 29 iron_ore, 20 coal, 18 fiber, 13 wolframite, 13 bauxite | 21 min | 1,313 | |
| **Atomic -> Star gate** (HEAD): 93 `star_casing`, `star_core`, 8 `deuterium_cell`, 4 `power_port` | 216 iron_ore, 148 copper_ore, 113 silica, 107 coal, 107 bauxite, 103 limestone, 103 wolframite, 53 spodumene | **168 min**, 9.7 MJ of machine energy | 10,070 | ~15 coke |

Per-item unit costs that drive the late bills (expert s each): `steel_plate` 24, `tungsten_rod` 15, `aluminum_ingot` 12, `circuit` 20, `superalloy` 25, `fused_quartz` 6,
`plasma_casing` 38, `magnet_ring` **130**, `star_casing` **94** (the ring is 70% of it).

### 1.4 Findings from the bills

1. **Fuel is never a constraint.** Every gate needs 5-15 fuel items against 80-120 s burn per item; heat-up is 23 s. The real fuel sink is *keeping the furnace lit as the base's heart*:
   a lit furnace burns `1/burnS` items per second: charcoal 11.3 per 15-minute day, coal 9, coke 7.5, log 18, peat 18; draft doubles it. At 2.5-7 s of labour per fuel item that is **~8% of the day**. Keep it: it is the
   only thing that makes "the furnace is the heart" a cost. Do not add per-recipe fuel costs.
2. **Ore bills are mostly multiplicative-yield decisions.** Hand `mortar` gives 1.35 crushed ore per ore (bonus 35%), the Forge `crusher` gives 2.0 (`crushed_*` x2). That is 1.35x and 2x the ingots per ore.
   The Bronze bill above already uses the mortar; without it the bill is 114 copper + 37 tin. Do not give any Bronze machine a bonus above the mortar's.
3. **The Star bill is out of band by 4-5x** and Atomic/Current by ~1.4x (section 2). `magnet_ring` (130 s each) dominates because `star_casing` and `star_core` both consume it.
4. **Ember is cheap as raw work** (12-15 expert minutes). The 30 player-minute target is carried by exploring, learning the stations, farming and brewing waits, not by the resource bill. Do not raise Ember ore counts; add *goals*, not ore.
5. **Tin is the Bronze choke point**: 2.5 veins/chunk of 5 blocks gives 12.5 ore/chunk vs copper 24. Bronze needs a 3:1 Cu:Sn ratio so this is balanced *on average*, but a spawn without tin within ~30 blocks stalls the player.
   Add one guaranteed small tin vein (5 blocks) within 48 blocks of spawn (world gen, test: `tinWithin(spawn, 48)` on 20 seeds) - cheaper than raising `veinsPerChunk`.

---

## 2. Time-to-next-age curve

Target is **player minutes per age** (expert x 2.0). The owner's frame: first 30 minutes, then 45-90 per age on a phone.

| Age | Target player min | Target expert min | Model today (expert) | Deviation | Fix (numeric) |
|---|---|---|---|---|---|
| Ember | 30 | 12-15 | 12-15 | OK | none; add the new goals (clay table, mould firing, pour, quern, brew) but no ore |
| Bronze | 70 | 30-38 | 38 | OK (high end) | keep 30 `boiler_plate`, but offer the smaller `3x3x3` vessel (interior 1x1x1, 26 blocks) as legal: saves 8 plates = 16 ingots = ~2.5 expert min; do not let 85 Cu ore grow |
| Forge | 55 | 24-30 | 27 | OK | the *gate* is only 7.8 min; the age's weight is in its kit (iron/steel tools, crusher, boiler, engine). Keep the Forge gate cheap but make `dynamo` + `crusher` goals required |
| Current | 55 | 25-30 | 18 kit + 36 gate = **54** | +80% | `plasma_casing` 53 -> **24** (3x3x3 hollow shell, 26 blocks - 2 ports): gate 36 -> 18 min; Current total ~36. Keep `plasma_casing` recipe |
| Atomic | 60 | 28-32 | 21 kit + 168 gate = **189** | **+500%** | `star_casing` 93 -> **30**; remove `magnet_ring` from `star_casing` (keep only in `star_core`, 6 -> 3 rings); `deuterium_cell` 8 -> 4. Expert: kit 15 (move `shield_suit`, `lithium_bank` to optional goals) + gate ~27 = **~42** (player 84, the top of the range; the Star Age is a finale) |
| Star | endgame | - | ignition | - | 300 kW for 90 s: see section 3.4 for what that demands |

Gate arithmetic used (so builders can re-derive): `plasma_casing` costs 0.63 expert-minutes each (linear); `star_casing` 1.56 each *with* the ring and 0.47 without; `star_core` + 8 `deuterium_cell` + 4 `power_port` = 22.7 min
(6 rings = 13 min of it).

Whole game: today ~12 + 38 + 27 + 54 + 189 = **~320 expert min = 10.7 player hours**; target total ~ 12 + 35 + 27 + 30 + 42 = **~146 expert min ~ 4.9 player hours**. Within-age ratio rule: consecutive ages should grow by x0.7-2.5, never x5.

**Waiting time that the model does not see** (add to design, not to bills): wheat 100 s per stage x stages (7 min to ripen, `crop.stageS=100`), sap taps 120 s per log, tea/coffee bushes regrow 360 s, tanning 60 s + drying 120 s, distillery runs 60-260 s.
Rule: **no age gate may be blocked on a wait longer than 8 minutes** unless the wait has a hand-work alternative.

---

## 3. Energy and stress budgets

### 3.1 One exchange-rate table (decide once, the builders put it in `core/constants.ts`)

| Symbol | Value | Meaning / current source |
|---|---|---|
| `W_PER_SU` | **50 W** | 1 stress unit = 50 W of shaft power at the 16-rpm reference. Already implied by `GENERATOR_SHAFT.suPerW = 1/50` in `workshop/workshop.ts:33` |
| `ETA_STEAM_SHAFT` | **0.25** | heat -> shaft by a piston engine. The Forge electric `steam_engine` already is 1/3 (`heatPerWatt: 3`) |
| `ETA_DYNAMO` | 0.9 | shaft -> electricity (Forge dynamo, to be built) |
| `ETA_TURBINE` | 0.5 | heat -> electricity, `steam_turbine` (800 L/s x 20 J/L = 16 kW heat for 8 kW) |
| `ETA_BURNER` | 0.3 | `burner_generator.efficiency` |
| `ETA_COMBUSTION` | 0.4 | `combustion_engine.efficiency` |
| `ETA_ELECTRIC_HEAT` | 1.0 | `electricHeatW`: electricity -> furnace heat |
| `ETA_BATTERY` | 0.9 round trip max | `BATTERY_EFFICIENCY` |
| Steam | `STEAM_L_PER_KW_S = 6` (plan) | 6 L/s of steam per kW of heat |
| Shaft SU from boiler | `SU = heatKW x ETA_STEAM_SHAFT x 1000 / W_PER_SU = 5 x heatKW` | = **5 SU per bar** at 6 L/s per bar-kW |

**Invariant:** the product of efficiencies around any closed conversion cycle must be < 1 (target <= 0.6, so a loop is visibly lossy).

### 3.2 Free-energy loops found (confirmed in code unless marked *plan*) and how to close each

| # | Loop | Evidence | Gain | Close it by |
|---|---|---|---|---|
| L1 | **Gearing makes work out of nothing.** Machine throughput is `dt x rpm/16`, but part stress is `base x clamp(16/rpm, 0.25, 4)`, i.e. it FALLS as rpm rises. A crank (16 rpm, 8 SU) into two `ratio_dial` x3 = 144 rpm: stress floor 0.25, throughput x9: work per SU is **x36** | `workshop/kinetics.ts:165-168`; `workshop.ts:592`; `logistics.ts:462` | **up to x36** | Stress must follow power: `stress = base x |rpm|/16` (constant torque per unit of work; power = torque x rpm). Delete the clamp. Then dials, differentials and governors conserve power. Test T3 below |
| L2 | **Steam engine capacity is 25x the heat that feeds it** *(plan)*. 6 kW heat -> 6 bar -> `capacity = 128 x bar` = 768 SU = 38 kW at 50 W/SU | `BRONZE_PLAN.md` section 5.2 ("96 rpm, capacity 768") | **x6.4 energy** (kW), x25 in SU terms | `capacity = 5 SU per bar` (30 SU at 6 bar = 1.5 kW from 6 kW heat); keep `rpm = min(96, 16 x bar)`. A boiler with two heat ports (12 kW) then runs ~7 saws or ~3 presses at 16 rpm, which is the intended Bronze factory |
| L3 | **Generators double-dip**: a water wheel / wind turbine / steam engine delivers its full electric watts AND a shaft at `watts/50` SU | `workshop.ts:344-347` | up to x2 | The shaft share is taken out of the electric output: `electricW = ratedW - 50 x SU_used`, or a unit is either shaft-mode or cable-mode (the Create answer). Test T4 |
| L4 | **Treadwheel is passive power**: 24 SU (= 3 cranks) for standing still on it | `workshop.ts:349` | AFK x3 crank | 12 SU (1.5 cranks), and it must stop if the player does not move/attack for 30 s (anti-AFK). Animals: 12 SU each |
| L5 | **Clockwork motor** gives 48 SU for 120 s for four taps | `CLOCKWORK` | x6 crank per tap | 24 SU, `windS` 30, `maxS` 120 (keeps one tap per 30 s of 24 SU, i.e. 3 cranks; a flywheel on top should *not* extend it) |
| L6 | **Fuel conversions create energy**: log 200 kJ -> `charcoal` 400 kJ (x2); `coal` 800 -> `coke` 1,200 (x1.5). Not a cycle (the input is a raw resource) but the "energy out > energy in" invariant fails | `items.ts` fuel table, `recipes.ts` `charcoal`, `coke` | x2 / x1.5 | Accept charcoal x2 (the Ember bootstrap needs it) and **list both as the only allowed exceptions**; set `coke` 1,200 -> 1,000 kJ and keep `flameTempC` 1,550. Test T6 whitelists them |
| L7 | **Essentia Cinder is free fuel**: one vial (4 units) adds 90 s of fire (= ~1.1 charcoal, 450 kJ at 5 kW). The land recovers 1 unit per 30 s per chunk per aspect, so ~0.5 charcoal/min/chunk forever, automatable with jars + a siphon | `magic.ts:43,49,609` | free fuel | `CINDER_BURN_S` 90 -> **45**, siphon adds `CINDER_BURN_S / VIAL_UNITS` only when below 15 s (already). Since fuel is not a constraint (1.4) this is cosmetic, but keep the cap so magic can never be the *cheapest* heat |
| L8 | **Oil shale -> `fuel_canister` is a 150:1 energy mine**: 2 `oil_shale` + 40 kJ (still) -> 6 MJ chemical -> 2.4 MJ electric in the `combustion_engine` | `recipes.ts` `fuel_canister`; `combustion_engine.fuelEnergyJ` | x60 vs input energy | Intended (a rock is energy dense) but note labour: 1 canister costs ~16 s of labour against 30 charcoal (~210 s) for the same energy: the still makes fuel 13x cheaper per joule than wood. Keep, but do **not** let the still output also be furnace fuel (it is not today: no `fuel` on canisters; add a test that no distillery item has `fuel`) |
| L9 | **Wind and solar scale without limit**: `water_wheel` has `shareRadius 3`, wind/solar have none; one `wind_turbine` is 94 expert-s for 1.5 kW | `tech.ts` `wind_turbine`, `solar_panel` | linear | Add `shareRadius` 12 to wind (output / number of turbines in range) and 6 to solar panels; cheap, same code as the wheel |
| L10 | **Fission and Starhearth are intended gains** (72 MJ rod from 640 kJ of centrifuge; 1 MW ignited from a 27 MJ ignition) | `fission_pile`, `ignitedTempC` | x100 | Intended: they are the endgame. Make sure *cable rating and ignition* are the gate, not free tickling (see 3.4) |

No loop was found in: thermopile (cools the furnace by 4x its output), `blower` (burn and heat both scale with `1+draft`), `space_heater`, arc/plasma heating (a steam-turbine -> arc heater -> boiler loop is 0.5 x 1.0 = 0.5), boiler (`heatPerSteamL 20`).

### 3.3 Power-budget table (so no age is starved or flooded)

Stress is in SU at 16 rpm reference (after fix L1). Electric in W.

| Age | Sources (rated) | Typical peak load | Headroom rule |
|---|---|---|---|
| Ember | hand crank 8 SU (attended, `CRANK_S 2.5`), treadwheel 12 SU | none (hand stations only) | **Ember has no stress network** (owner decision). Cranks appear in Bronze |
| Bronze | crank 8, wheel 8 (400 W), wind 8, clockwork 24, boiler engine **5 SU/bar, <= 30 SU at 6 bar**, 2 heat ports -> 60 | 4-7 machines: saw 4, millstone 4, mortar 4, press 8, hammer 8, mixer 6, drill 6 | one engine (30 SU) runs a 5-machine line; a second port or engine is the first *expansion goal*. Stalled at over-stress, never destroyed |
| Forge | `steam_engine` 2 kW, `burner_generator` 3 kW (charcoal 400 kJ -> 120 kJ, 33 s per item), water wheel 0.4 kW, thermopile 0.3 kW, dynamo <= 2 kW | `crusher` 1 kW, `blower` 150 W, lamps 10 W | one engine = one crusher; **crusher must be worth it**: 1 kW x 4 s = 4 kJ per ore, 2 ingots per ore |
| Current | `steam_turbine` 8 kW, `wind_turbine` 1.5 kW, `solar_panel` 0.3 kW, `combustion_engine` 12 kW, `geothermal_tap` 6 kW | `still` 2 kW, `bore_rig` 4 kW, arc heating 8 kW, `ward_beacon` 0.5 kW | ~15 kW peak: turbine + 2 wind + battery. Grid goal "generate 10 kW" fits |
| Atomic | `fission_pile` 60 kW | `centrifuge` 8, `electrolyzer` 20, plasma 40 | ~68 kW peak: one pile + battery bank **is short by design**; second pile or `lithium_bank` is the goal |
| Star | ignited Starhearth 1 MW | 300 kW x 90 s ignition = 27 MJ | see 3.4 |

Price of power (expert-seconds to build per kW, from the cost model): thermopile 136, water wheel 183, solar 121, `steam_engine` 84, wind 63, `burner_generator` 37, geothermal 37, `steam_turbine` 29, `combustion_engine` 20 - monotonically falling by age (good), with the water wheel the worst by design (free forever, 400 W).

### 3.4 Starhearth ignition

`IGNITION_POWER_W = 300 kW`, 90 s, needs 95% satisfaction, 2 s grace. One `fission_pile` is 60 kW: **five piles or a charged `lithium_bank`** are required. The rule "hold 300 kW on a line that can carry it" is the real gate; keep it.
Check before building: the bank's discharge W must not exceed its `capacityJ` / 90 s with 0.9 efficiency (27 MJ / 0.9 = 30 MJ capacity). Test T2c.

### 3.5 Machines vs hand work (stations are 2-5 s per operation; machines must pay back, hand must stay viable)

Hand rates: chopping block 4 strokes/s (axe doubles), quern 3/s, anvil 2.5/s (bronze hammer doubles), mortar 2/s, loom 2/s. Machine rate: `STROKE_S = 0.5` per stroke at 16 rpm, i.e. **2 strokes/s, slower than a hand**: machines win only by running unattended and in parallel (and by rpm, once L1 is fixed). Payback ops = build cost / (hand seconds + 2 s of taps).

| Machine | Build cost (expert s) | Hand s/op | Machine s/op @16 rpm | Payback ops | Verdict | Target |
|---|---|---|---|---|---|---|
| `mech_loom` | 16 | 5.0 | 5.0 | 2 | too cheap | 60 s (+2 `bronze_plate`, +1 `bronze_cog`) -> ~9 ops |
| `mech_millstone` | **10** | 2.0 | 3.0 | 3 | too cheap | 60 s (+2 `bronze_plate`) -> ~15 ops |
| `mech_mortar` | 29 | 4.0 | 4.0 | 5 | cheap | 60 s |
| `mech_hammer` | 40 | 1.6 | 4.0 | 11 | ok | keep |
| `mech_saw` | 54 | 0.75 | 1.5 | 20 | ok | keep |
| `hand_crank` | 8 | - | - | - | fine | keep |

Rule: **machine build cost = 15-40 x the hand attended seconds of one op**, rising with age; before the first crank the player has already done every op by hand 30+ times, so hand work stays viable and the machine is relief, not a requirement.
Hand throughput must stay >= machine throughput at 16 rpm (true today) so a machine never makes hand work obsolete; machine value is parallelism (buffer 16 items), idle time and rpm.
Forge `crusher`: 2 crushed ore per ore (vs mortar 1.35) at 4 kJ - worth it because it doubles ingots, not because it is fast. `still` (2 kW): see 3.6. `bore_rig` 4 kW x 2 s/block (`secondsPerBlock 2`, tier 4): 6x faster than a steel pick on h12, correct.

### 3.6 Distillery, sugar, brewing, essentia (price/yield audit)

**Sap chain (HEAD recipes): `distil_syrup` 4 sap -> 1 syrup; `ferment_wash` 1 syrup -> 5 wash; `distil_low_wines` 16 wash -> 1; `distil_spirit` 8 low wines -> 1; `rectify_spirit` 4 spirit -> 1 `fuel_ethanol_beaker`.**
Back-multiplying: 1 ethanol beaker = 4 spirit = 32 low wines = 512 wash = 102 syrup = **410 pine sap**, and ~12,300 + 11,300 + 2,240 + 240 + 60 = **~26,000 vessel-seconds** (7 hours on one flask). At one tap per log per 120 s that is 49,000 log-seconds (a 20-log grove for 41 minutes).
Its worth: `FUEL_GRADES.fuel_ethanol_beaker` saw 0.25 x 420 = 105 units = 15 logs; the tractor 0.2 x 150 s = 30 s. A `fuel_canister` (2 oil shale, ~16 s of labour) gives 420 saw units / 150 tractor-s. **Ethanol is ~100x too expensive for its use.**

| Knob | Now | Proposed | Result (sap per ethanol / vessel-s) |
|---|---|---|---|
| `distil_low_wines` ratio | 16 wash : 1 | **8 : 1** | |
| `distil_spirit` ratio | 8 : 1 | **4 : 1** | |
| `rectify_spirit` ratio | 4 : 1 | **2 : 1** | **51 sap / ~3,700 vessel-s** (4 vessels ~15 min) |
| `FUEL_GRADES` ethanol saw / tractor | 0.25 / 0.2 | 0.5 / 0.4 | 1 ethanol = 30 logs; still 3x dearer than oil, which is right: it exists for the Ember/Bronze niche (spirit lamp, antiseptic, potions), not for the saw |
| Fermenting from sugar | not possible | add `ferment_wash_sugar`: 3 `sugar` + 1 water -> 3 wash (sugar = 0.67 sap) | makes the sugar chain a real input to brewing, the planned tie-in |

**Crude oil:** `refine_crude` 8 crude -> 2 diesel + 1 gasoline + 1 kerosene + 2 residue + 2 empty (260 s); `refine_crude_short` 4 -> 1 diesel + 1 slop + 1 residue (130 s). Residue feeds `LUBE.residue` x1.25 stress capacity for 600 s (vs pine resin x1.1, 300 s).
Keep the lube bonus at x1.25: with L1 closed it is the only stress *multiplier*, so test it (T3). Oil pools: confirm they are finite or slow to refill (not read; add to playtest list).

**Sugar chain:** `sap` -> `pine_resin` (boil 180 C) -> 2 resin + 1 water + 1 beaker -> 3 `sugar`. **0.67 sap per sugar**, one tap per 120 s per log: 6 logs = 4.5 sugar/min.

**Brewing (per cup, expert):** attended ~19 s (2 cherries or leaves 4 s + taps), passive roast 8 s, boil 12 s, steep 20 s; buff = 180 s (`DRINK_BUFF_S`).
Break-even test = seconds saved by the buff vs attended seconds spent: Swift (x1.2 walk, ~50% of time walking) saves 15 s; Vigor (x1.25 mining, ~40% mining) 14 s; Lasting (hunger x0.5) ~5 s; Spring/Hearthkept/Mending are situational. **Cups are break-even to slightly negative.** Fix: `DRINK_BUFF_S` 180 -> **300** (saves 25 s; cost unchanged) or brew 2 cups per boil. Do not raise the multipliers: stacking is already high (3.7).

**Essentia gathering:** vis rod 1 unit per use (capacity 16), bronze rod 2/use (32), iron rod 3/use (64), `ROD_INTERVAL_S 0.2`; land recovery 1 unit per 30 s per chunk per aspect, cap `DRAW_CAP 24`. A research-gated Rune Desk recipe costs 12-18 units, an infusion 16-24: **~5-9 minutes of recovery for a chunk's aspect, but the cap of 24 means a 4-unit aspect can be gathered immediately from a chunk with 24 banked**.
Price check: `steel_infusion` (1 `iron_ingot` + 2 `coal` + 12 essentia -> 1 steel) is *worse* than the forge route (2 iron + coke + limestone -> 2 steel), so magic is a flavour path, not a shortcut: keep.
Rule for any new arcane/infusion recipe: essentia cost (units) x 30 s of recovery <= 0.7 x the expert seconds of the physical route; test T9b.

### 3.7 Chainsaw, tractor, vacuum

| Item | Rule today | Cost per use | Verdict / numbers |
|---|---|---|---|
| `chainsaw` | tank 840 units = 120 logs; `fuelPerLog 7`; canister refills 420 (60 logs); gasoline x1.3 (78 logs), ethanol x0.25 (15 logs), diesel 0 | 0.05-0.07 oil shale per log (a canister = 2 shale ~16 s) | Fuel is nearly free; the saw saves ~0.4 s of axe time per log but removes the tree-by-tree overhead (6 s per 4-log tree -> one cut). Fine. Keep the 48-log cap per cut (a sane felling radius). Do not lower `fuelPerLog` |
| `tractor` | 600 s tank at burn 1; canister 150 s; idle 0.2, drive 0.8, work 0.6 per s; max 5.5 b/s (a sprinting player is 5.8) | ~0.024 canister per 100 tilled blocks | The tractor *tills a 4-wide swath at 5.5 b/s* (~22 blocks/s vs a hoe's ~2/s). Fuel is trivial; the real cost is the build (2 `chassis`, 4 `steel_plate`, 3 `copper_coil`, circuit, 4 `iron_plate`). Fine. Sprint > tractor is good: it is a work vehicle |
| Vacuum (`vacuum_collector`, Hand Vacuum Pump) | no fuel; workshop collector radius 4, hand pump 9 blocks; planned air 30 L/s | stress 3 | No new cost needed. The Hand Vacuum Pump recipe (4 `bronze_plate`, 2 leather, bellows, 2 `copper_plate`) ~ 140 expert-s: **fine for Bronze** |
| Tool wear (1 per block) | flint 64, bronze 192, iron 384, steel 768, `power_drill` 3000 | replace cost / block: flint 0.30 s (11% of mine time), bronze 0.25 (13%), iron 0.06 (5%), steel 0.05 (5%) | Healthy. Bronze Bronze->Forge needs ~500 blocks = 2.6 pickaxes (~8 ingots, 5% of the bill). Hammer 120/400, mould pours limited: keep |

### 3.8 Hunger and buffs

Constants: day 900 s; food 20 max; base drain 1/60 per s; sprint x2.5; per block mined 0.03; per jump 0.03; regen needs >= 12 food at 0.25 per hit point; Well-Fed 360 s (x2 regen, x0.5 drain).
Need per player-hour (baseline + 800 blocks/age mined + 30% sprint): **~90 hunger/h**: 7.5 `hearth_stew` or 15 `bread`.

| Food | Hunger | Raw labour (expert s) | Hunger per attended s | Note |
|---|---|---|---|---|
| `bread` (2 flour = 2 wheat) | 6 | ~7 | ~0.9 | baseline |
| `cooked_mutton` / `cooked_chop` | 7 / 8 | ~13 | ~0.6 | + Well-Fed none |
| `hearth_stew` | **12 + Well-Fed 360 s** | ~19 | 0.6 + buff | exactly additive (8+1+3): no free hunger, buff is the reward |
| `sugar_cookie` x4 (1 flour + 1 sugar) | **12 (3 each)** | ~4.5 | **~2.7** | **3x the best staple, plus Sugar Rush** - the dominant food |
| `sweet_bun` / `sugar_cake` | 6 / 9 | | | fine |

**Cookie fix:** yield 4 -> 3 and `sugar_cookie` hunger 3 -> 2 (6 per batch = 1.3/s, 1.5x bread), or keep 4 cookies of hunger 2 (8 per batch).

**Buff stacking (verified in `game/buffs.ts` and `core/constants.ts`):**

| Effect | Sources | Max stack | Number |
|---|---|---|---|
| Walk/sprint speed | Swift 1.20 x Sugar Rush 1.12 | x1.344 | sprint 5.8 -> 7.8 b/s |
| Mining speed | Vigor 1.25 x Well-Warmed 1.25 | x1.56 | multiplies the tool speed |
| Food drain | Well-Fed 0.5 x Lasting 0.5 | **x0.25** | one stew = 48 minutes idle; Lasting + Stew **removes hunger as a pressure** |
| Regen | Well-Fed 2 x Mending 2 | x4 | |
| Warmth drain | Hearthkept 0.5 | x0.5 | |
| Jump | Spring 1.35 | | |

Sugar Rush: 1.12 speed, `SUGAR_WELL_FED_BURN_MULT 2.5` (a 360 s stew lasts 144 s), buff time max-merges (not additive), 45/90/150/240 s for sugar/cookie/bun/cake.
Trade-off is real only when the player holds Well-Fed: +12% speed vs 60% of the stew wasted. Players without a stew pay nothing, so **sugar rush is free speed for the sugar chain**.
Rules: (1) cap the *product* of drain multipliers at 0.4 (raise Lasting to 0.7 or Well-Fed to 0.6); (2) Sugar Rush also raises hunger drain x1.25 while active (so the cost applies when not Well-Fed), (3) keep one tea and one coffee at a time (already), (4) `speedMult` <= 1.4 total, `miningMult` <= 1.6 incl. Well-Warmed, asserted by tests T8.

---

## 4. Concrete value changes (summary of every number proposed)

| Id | Change | From -> To |
|---|---|---|
| plasma_casing shell | casings in the Current -> Atomic gate | 53 -> 24 |
| star_casing recipe | drop `magnet_ring` input; keep `2 superalloy, 1 fused_quartz -> 2` | 1 ring per 2 casings -> 0 |
| Star gate | casings; `star_core` rings; deuterium | 93 -> 30; 6 -> 3; 8 -> 4 |
| steam engine (plan) | shaft capacity per bar | 128 SU -> **5 SU** (cap 30 at 6 bar) |
| kinetics `solveNetwork` | part stress vs rpm | `base x clamp(16/rpm,.25,4)` -> `base x \|rpm\|/16` |
| GENERATOR_SHAFT | electric output when shaft used | full -> `rated - 50 x SU` |
| treadwheel | SU | 24 -> 12 (+ AFK stop) |
| clockwork motor | SU | 48 -> 24 |
| coke | energy | 1,200 -> 1,000 kJ |
| CINDER_BURN_S | fire s per vial | 90 -> 45 |
| wind / solar | share radius | none -> 12 / 6 |
| low wines / spirit / rectify | wash:1, low:1, spirit:1 | 16/8/4 -> 8/4/2 |
| ethanol grades | saw / tractor | 0.25/0.2 -> 0.5/0.4 |
| DRINK_BUFF_S | | 180 -> 300 |
| sugar_cookie | yield x hunger | 4 x 3 -> 3 x 2 |
| mech_millstone, mech_loom | add bronze plates | 10 s / 16 s -> ~60 s |
| food-drain product | Well-Fed x Lasting | 0.25 -> >= 0.4 |
| tin | one guaranteed 5-block vein within 48 blocks of spawn | new |

---

## 5. Balance test plan (automated, to be added by the builders)

Put the model in `src/content/timeModel.ts` (pure, imports `RECIPES`, `ORE_VEINS`, `BLOCKS`, `FURNACE_TIERS`, `MACHINES`; parameters in one exported `TIME_PARAMS`), so tests do not depend on a snapshot. Every threshold below is a **band, not a point**, so content tweaks do not churn tests.

| Id | Test | Implementation | Acceptance threshold |
|---|---|---|---|
| T1 | **Time-to-next-age** per age bundle | `expertMinutes(bundle)` via the cost fixed point; bundles are `FURNACE_TIERS[i].upgradeCost` + `hearthMaterials(i)` + a named kit list in content | Ember 8-18; Bronze 28-42; Forge 20-32; Current 24-36; Atomic 28-48 (bundle = kit + gate); each age <= 2.5x the previous and >= 0.6x; total <= 190 expert min |
| T1b | **Ore bill sanity** | sum raw ore of each bundle | no age needs > 120 ore blocks of one kind; tin >= 25% of copper count in Ember/Bronze |
| T1c | **Gate has no wait > 8 min** | sum of crop/tap/tanning/dry waits on the critical path | <= 480 s without a hand alternative |
| T2a | **Energy conversion cycles are lossy** | table `CONVERSIONS: [from, to, efficiency][]` in `core/constants.ts`; find cycles with DFS | product of any cycle <= 0.6 (fails today only if L2/L3 stay) |
| T2b | **No recipe returns more energy than it costs** | for every recipe, `energy(outputs)` (fuel items' `energyJ`) vs `energy(inputs)` + `energyJ` of the machine | ratio <= 1.0 with whitelist `{charcoal: 2.0, coke: 1.5}`; distillery items must have no `fuel` |
| T2c | **Ignition feasible** | storage capacity / max discharge of `lithium_bank` | >= 27 MJ / 0.9 and discharge >= 300 kW |
| T3 | **Gearing conserves work** | for rpm in {4, 8, 16, 32, 64, 96, 144}: `throughput = rpm/16`, `stress(part)` from `solveNetwork` | `stress / throughput` constant within 1%; i.e. `workPerSU(144 rpm) <= 1.01 x workPerSU(16 rpm)` |
| T4 | **Generators do not double-dip** | water wheel at 2 water blocks with and without a shaft load | `electricW + 50 x shaftSU <= ratedW` |
| T5 | **Boiler energy** (when built) | sim a 6 kW heat port into the engine | `shaftSU x 50 W <= 0.30 x heatW`, within 5% of `5 SU/bar` |
| T6 | **Crafting value invariants** | `cost(output) >= 0.5 x sum(cost(inputs)/outCount)` and `<= 3x` | no `output` cheaper than half its inputs; flagged list (crusher x2, mortar x1.35, `sugar` 3 from 2) is an explicit whitelist |
| T7 | **Food economy** | hunger per attended second from the cost model | no food > 2.0x `bread`; `sugar_cookie` <= 1.6x; starvation sim: a bot eating `bread` only keeps food >= 6 for 60 min with <= 25% of attended time spent on food |
| T8 | **Buff stacking bounds** | instantiate `PlayerBuffs` with every buff active | `speedMult <= 1.4`, `miningMult x wellWarmed <= 1.6`, `foodDrain x wellFed >= 0.4`, `regenMult <= 4` |
| T9 | **Distillery yields** | compute sap and vessel-s per `fuel_ethanol_beaker` from `recipesDistill.ts` | sap <= 60, vessel-s <= 5,000; ethanol worth: `sapCost x tap time` <= 40 x oil route |
| T9b | **Arcane cost vs physical route** | `sum(units) x DRAW_RECOVER_S` vs `expertSeconds(route)` | <= 0.7 |
| T10 | **Machine payback** | `buildCost / (handSecondsPerOp + 2)` for every `MECH_TWINS` | 8-60 ops; `machineSecondsPerOp(16 rpm) >= handSecondsPerOp` |
| T11 | **Tool wear economics** | `replaceCost / (durability x mineTime)` per tool set | <= 0.15 |
| T12 | **Power budget per age** | `sum(sourceRatedW)` of that age's goal kit vs `sum(consumerDrawW)` of its machines | headroom 1.0-3.0x (Forge ~1.3, Current ~1.5, Atomic **< 1.2 by design**) |
| T13 | **Furnace upkeep** | lit-day fuel items x gather seconds / 900 | <= 10% |
| T14 | **Spawn fairness** | for 20 seeds, distance to nearest tin, copper, coal, clay, water, pine | tin <= 48 blocks, coal <= 64, clay <= 32, pine log <= 40 |
| T15 | **Solver-time regression** | extend `playthrough.test.ts` to log the cost-model minutes at each objective | assert monotone, no objective > 12 minutes after its predecessor |

Process: add T1-T4 and T8 first (cheap, pure, cover the two loops that matter most: L1, L3); the rest follow the code they test (T5 after the boiler exists, T9 after the distillery rebalance).
**After the first real playthrough, replace the `x2.0` expert-to-player factor with the measured ratio** and rerun T1; that one number decides every band.

---

## 6. Open items and honest caveats

- Not measured: nothing ran. The model has no mob fights, nights, deaths, inventory trips, crafting UI time beyond a flat 2 s, or learning curve (factor 2.0 is a guess).
- The Bronze bundle uses the plan's own numbers, including "30 plates + ports"; some recipe ids (`bronze_gearbox`, `flywheel`, `steam_engine_b`) are assumptions where the plan says only "gearbox".
- Hearth shell material counts were taken from the committed `hearthMaterials()`; the six-age refactor may change them. T1 reads them live so it self-corrects.
- Oil pool regeneration, battery capacity/discharge limits and crop yield per plot were not read; T2c and T14 cover them.
- The Forge -> Current dynamo (shaft -> electricity) does not exist yet: price it with `ETA_DYNAMO 0.9` and `W_PER_SU 50` (a 2 kW dynamo needs 44 SU: one steam engine, i.e. two boiler ports).
