# The Bronze Age - complete plan

Standalone plan for the second age of Hearthwatt: pressure, pneumatics, and heat you can move. Design AND
implementation, written so an engineer who was not in the design conversation can build it exactly. Nothing in
this file is built yet. Companion files: `docs/STEAM_PLAN.md` (the first half of this age: shaft mechanics, speed and stress, built first; sections cited below keep their numbers),
`docs/EMBER_PLAN.md` (the handwork age before this one),
`docs/PROGRESSION.md` (whole game), `docs/SPEC.md` 21 and 21.8 (short form of this design; THIS file wins on detail).

> **Scope update:** the owner moved ALL steam and shaft mechanics into this age ("steam is a bronze age
> thing"). The Bronze Age therefore has two halves: (a) open steam and turning - the kettle, steam rotor,
> water wheel, windmill, axles, cogs, speed and stress, shaft machines - exactly as specified in
> `docs/STEAM_PLAN.md` (rewritten for the Bronze Furnace, tier 2; its Copper Kettle is `copper_kettle`, not the Ember
> Kettle Pot); then (b) everything in this file: thermocouples, the
> boiler multiblock, pressure, piston engines, air, the vacuum chute. The machines of (a) automate the hand
> stations of the Ember Age (`docs/EMBER_PLAN.md`): millstone = hand quern, saw bench = chopping block, trip
> hammer = stone anvil. The furnace upgrade list is shown from the first minute of each age.

## 1. The owner's words (the test for every choice)

- "we should have a fully separate bronze age with pneumatics and pressure mechanics and steam boilers and steam
  engines etc."
- "forge era will be more advanced smelting, heavy factory stuff/machines still."
- "there should be thermocouple blocks in the bronze era that can move heat when connected to a heated source"
- "bronze furnace will be what it is and the steam boiler will be the first separate multiblock"
- Earlier, still binding: the furnace is the heart of the base; things happen IN THE WORLD with animated
  blocks; "ember age is dominated by steam power and mechanical energy and stress and rotation speed"; watts are
  "a later step in the game progression"; phone first; original names and art.

Design law for this age:
1. **Heat has one origin: the furnace (or lava).** Thermocouples move it; nothing else creates it.
2. **Pressure is the new quantity** (bar), read on gauges in the world, dangerous when ignored.
3. **Air is steam's clean cousin**: made by a compressor, stored in tanks, spent by tools and tubes.
4. **No electricity.** Not one watt before the Forge Age's dynamo.
5. **The boiler is a building**, the player's first multiblock, and it stands apart from the furnace.
6. **Every failure is announced** at least 5 seconds ahead, by sound, by a needle, and by a sentence.

## 2. Where it sits

Ages: 0 Ember, **1 Bronze**, 2 Forge, 3 Current, 4 Atomic, 5 Star.
Furnace tiers: 1 Clay Furnace 800 C, **2 Bronze Furnace 1100 C**, 3 Blast hearth 1500, 4 Arc 2100, 5 Plasma
3200, 6 Starhearth.

| | Ember (before) | Bronze (this plan) | Forge (after) |
|---|---|---|---|
| Furnace | clay, single block | bronze, single block, 1100 C | blast hearth, multiblock, needs a blast nozzle |
| Heat | stays in the furnace | thermocouples carry it up to ~12 blocks | iron thermocouples, 20 kW |
| Steam | none (the Kettle Pot only boils tea water) | first half: open Copper Kettle, no pressure; second half: sealed multiblock boiler, 0-8 bar, pipes, valves | steel vessels and pipes, 16 bar |
| Motion | none: hand stations (Quern, Chopping Block, Stone Anvil) | first half: rotor 32 rpm, wheel, windmill, shafts; second half: piston engine, 16 rpm and 128 stress per bar | iron and steel shafts, heavy machines |
| Items | none (carry it, crates) | Bronze Chute pulled by a Vacuum Pump | steel conveyor pipe |
| Tools | bronze | air hammer | iron, steel |
| Electricity | none | none | dynamo at the end of the age |
| Signature danger | cold, hunger, mites | scalding, burst vessels | hounds, heavy industry accidents |

Enter the age: upgrade the Clay Furnace in place (8 bronze_ingot, 4 firebrick, 1 bellows, at 700 C).
Leave the age: a Blast hearth needs at least one `blast_nozzle` in its wall fed by an air network at >= 2 bar.

## 3. The age as it is played (about 45 minutes)

1. **Bronze Furnace.** Hotter fire (1100 C), two crucibles. Goal: "Move the heat".
2. **Thermocouples.** Forge bronze rods, lay four from the furnace's side to a Hot Plate: the rods glow dull
   red nearest the furnace, fading along the line. Cook on the hot plate while the crucibles smelt. Touch a rod:
   it burns. The furnace screen shows "Heat to machines: 1.2 kW".
3. **The boiler.** Goal "Build a steam boiler" opens the Structure planner (same one the hearth uses later):
   a ghost of the smallest vessel - a 3x3x4 box of Boiler Plate with a Gauge Glass, a Heat Port, a Water Port, a
   Steam Port. Build it block by block; when the last plate goes in the seams flash and it rings like a bell.
4. **Feed it.** Thermocouples from the furnace to the Heat Port; buckets (or a mech pump on a shaft) into the
   Water Port; the gauge glass shows water rising. Then steam: a bronze Steam Pipe from the Steam Port, a
   Pressure Gauge on it. The needle climbs.
5. **Piston power.** A Steam Engine on the pipe: beam rocking, flywheel turning, 16 rpm per bar. At 6 bar it
   does three times what the steam rotor of the first half of the age did (STEAM_PLAN). Hook it to your existing shaft line through a clutch.
6. **The lesson.** With the engine clutched out, pressure keeps climbing: 7 bar - hiss, shaking needle, HUD
   "Boiler pressure high - fit a Safety Valve or use the steam". Fit a valve (set 6): shriek, plume, safe.
   A player who ignores it for the full count loses the vessel.
7. **Air.** Compressor on the shaft, an Air Tank, Air Tubes. Goal "Pneumatic post": a crate at the mine, a crate
   at the furnace, a tube between them, and ore arrives with a thump. Pneumatic Press: plates and wire without
   the forge chill. Air Hammer: charge it at the tank, mine like iron.
8. **The gate.** Forge a Blast Nozzle. Brick walls around the furnace with the nozzle in one wall and an air
   tube to it: the Blast hearth forms. Forge Age.

Acceptance for the whole age (all must hold):
- A1. Playable start to gate on a phone using only goal texts, status sentences and the Structure planner.
- A2. The first boiler can be built from the ghost preview without counting blocks.
- A3. Every quantity (heat in a rod, water level, bar, air bar, rpm) can be read by aiming at a block.
- A4. No electrical block is obtainable in this age (solver test).
- A5. A burst never happens without 5 s of sound + needle + HUD sentence first, and never when a working valve
  set at or below the rating is fitted.
- A6. With the fire out, everything winds down in the right order: rods cool, pressure falls, engine slows,
  flywheel coasts, line stops - no seize, statuses say "No heat" / "No steam".

## 4. Blocks and items (all numbers are starting values; keep them in src/content)

Made at the Bronze Furnace (forge, tier 2) unless noted. "plate" = `bronze_plate` (hammered by hand on the Ember Stone Anvil, or by the
STEAM_PLAN Trip Hammer: 2 bronze_ingot -> 1; also the pneumatic press here).

### 4.1 Heat
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| thermocouple | Thermocouple | heat conductor (pipe-like shape, arms to heat neighbours) | loss 2% per block, network cap 6 kW, burns above 300 C (1 dmg/s), glows by temperature | 800 C: 1 bronze_ingot, 1 copper_ingot -> 4 |
| hot_plate | Hot Plate | heat user, 1 slot in + 1 out | cooks every Kitchen smelt recipe at delivered temperature, same times; draws 500 W while cooking | 700 C: 2 plate, 1 firebrick |
| heat_vent | Heat Vent | heat user | warmth radius 6 and safe-zone-like comfort; draws 400 W | 700 C: 2 plate, 1 stone_brick |
| heat_port | Heat Port | boiler wall part, heat user | passes up to 6 kW into its boiler | 800 C: 2 plate, 2 thermocouple |

### 4.2 The boiler (multiblock, see section 6)
| key | name | role | recipe |
|---|---|---|---|
| boiler_plate | Boiler Plate | shell block (rated 8 bar) | 800 C: 2 plate -> 2 |
| boiler_gauge_glass | Gauge Glass | controller, in a wall face; shows water level | 800 C: 2 plate, 2 glass |
| water_port | Water Port | wall part, fluid endpoint (accepts water) | 800 C: 2 plate, 1 pail |
| steam_port | Steam Port | wall part, joins a steam network | 800 C: 2 plate, 1 steam_pipe |
| safety_valve | Safety Valve | roof part or on any steam pipe; setting 2/4/6/8 bar | 900 C: 2 bronze_ingot, 1 cord, 1 small_cog |

### 4.3 Steam
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| steam_pipe | Bronze Steam Pipe | steam network pipe | volume 100 L, rated 8 bar | 800 C: 2 plate -> 6 |
| steam_tank | Steam Receiver | storage | volume 8000 L, rated 8 bar | 900 C: 6 plate, 1 steam_pipe |
| pressure_gauge | Pressure Gauge | reads its network (steam or air) | needle 0-12 | 700 C: 1 copper_ingot, 1 glass, 1 small_cog |
| steam_engine | Steam Engine | steam user + shaft source | min 2 bar; uses 6 L/s per bar; 16 rpm per bar (cap 96); capacity 128 per bar | 1000 C: 6 plate, 2 bronze_gearbox, 1 flywheel, 2 steam_pipe |
| steam_hammer | Steam Hammer | steam user, processor | min 4 bar, 30 L per blow; ingots -> plates 1.5 s; bronze only until Forge | 1000 C: 6 plate, 4 bronze_ingot, 2 stone_brick |
| steam_whistle | Steam Whistle | Use: sounds; also an alarm at a set pressure | 20 L per blast | 700 C: 1 bronze_ingot, 1 steam_pipe |

### 4.4 Air
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| air_compressor | Air Compressor | shaft consumer -> air | min 32 rpm, stress 8; makes 2 L/s per rpm; stalls at 6 bar | 900 C: 4 plate, 1 bronze_gearbox, 2 air_tube |
| air_tube | Air Tube | air network pipe AND pneumatic item tube | volume 50 L; open ends leak 100 L/s each | 800 C: 1 plate, 1 glass -> 6 |
| air_tank | Air Tank | storage | 4000 L | 900 C: 6 plate, 1 air_tube |
| item_pipe | Bronze Chute (MOVED here from Ember) | item pipe; does nothing by itself | items travel at 8 blocks/s toward the nearest running Vacuum Pump on the chute network | 800 C: 2 plate, 1 glass -> 8 |
| vacuum_pump | Vacuum Pump | air user on a CHUTE network; the place items are drawn TO | needs >= 2 bar air (its own air_tube connection), uses 30 L/s while items move; pulls up to 16 items per 0.5 s; delivers into the inventory it touches, else its own 9-slot buffer | 900 C: 4 plate, 1 air_tube, 1 item_pipe, 1 small_cog |
| pneumatic_press | Pneumatic Press | air user, processor | min 3 bar, 200 L per job, 2 s; plates (2 ingot -> 1), copper_wire x3 (1 ingot) with no forge chill | 1000 C: 6 plate, 1 air_tube, 2 stone_brick |
| pneumatic_drill | Pneumatic Drill | air user | min 3 bar, 100 L per block, 2 s per block, tool tier 3 (mines iron) | 1000 C: 6 plate, 2 flint, 2 air_tube |
| air_hammer | Air Hammer | hand tool | pickaxe tier 3, speed 4.5, 60 charges; Use on an air tank or tube refills (300 L for full) | 1000 C: 4 plate, 1 air_tube, 2 stick |
| blast_nozzle | Blast Nozzle | hearth wall part (Forge gate) | needs >= 2 bar air, uses 20 L/s while the hearth burns; counts as 2 tuyeres | 1100 C: 4 plate, 1 air_tube, 2 firebrick |

### 4.5 Changes to existing content
- `boiler` (current one-block Forge boiler) is REMOVED from recipes; saves that contain one keep it as a legacy
  block that still works (do not delete the block id) - mark `legacy: true`, hidden from the Codex.
- `steam_engine` gets the 4.3 definition (the first-draft variant in STEAM_PLAN section 2 is void).
- `hot_fluid_pipe` (steel) stays the Forge upgrade for steam (16 bar) and lava.
- `item_pipe` (Bronze Chute) MOVES to the Bronze Age (owner decision, section 5.4): its recipe needs bronze
  plate and the Bronze Furnace, and it moves nothing without a Vacuum Pump. The Ember Age has no item pipes.
  The `pipe_ore` goal moves into the Bronze chain as `pneumatic_post`. `fast_item_pipe` (Forge/Current) keeps the
  push/pull port model and needs no vacuum.
- `blower` (electric) stays Current-era; the Blast hearth's tuyere requirement is met by `blast_nozzle`.
- Furnace tier 3 structure gains `requiredParts: { blast_nozzle: 1 }`.

## 5. The three networks - exact rules

All three reuse the pipe-graph pattern in `src/sim/pipeGraph.ts` (flood fill on place/remove only, caps
1024 blocks, per-network cached arrays) and the "one anchor entity per network stores the amount" trick of
`src/sim/fluidNet.ts` for saving. First step of the work is to generalise that file into
`netGraph.ts<T>(family predicate, join predicate)` so power-free networks do not multiply code.

### 5.1 Heat (`src/sim/heatNet.ts`)
- Members: thermocouples; SOURCES = furnace or formed hearth shell blocks (temperature = furnace temp, only if
  >= 200 C), lava blocks (1300 C, max 2 kW per touching face); USERS = hot_plate, heat_vent, heat_port, copper_kettle (STEAM_PLAN; the brewing Kettle Pot is not a heat user).
  A source or user touching any thermocouple of the network is in it. A user touching a furnace directly needs
  no thermocouple (distance 0).
- On rebuild: for each user, BFS distance `n` (thermocouple blocks) to each source.
- Per tick: users sorted by distance ask `demandW`. For each user pick the source with the highest
  `Tsrc x 0.98^n`. deliveredTemp = that value. deliveredW = min(demandW, remaining network cap 6000 W,
  source availability) where a furnace source's availability is unlimited (it just cools) and lava's is its
  face limit. The furnace is charged `deliveredW / 0.98^n` (losses are paid by the fire) through the existing
  heat-extraction path (`extractW`).
- A user works only if deliveredTemp >= its own minimum (hot plate: the recipe's minTempC; heat_vent 150 C;
  heat_port 150 C).
- Per-block temperature for rendering and burns: `Tblock = Tsrc x 0.98^(distance from source)` when the network
  delivered anything this tick, else decays toward ambient at 5%/s. Store one number per block in a typed
  array on the network (not saved).
- Burn: player AABB touching a block with Tblock > 300 -> `player.damage(1/s, 'burn')` via the survival
  contact-damage path (block contactDamage is static today: add a sim query `hotAt(x,y,z)` that survival's
  local scan consults; keep the scan at 2 Hz).

### 5.2 Steam (`src/sim/steamNet.ts`)
- Members: steam_pipe, steam_tank, steam_port (-> its boiler), safety_valve, pressure_gauge, users.
- State (saved on the anchor): `steamL`. volumeL = sum of member volumes (formed boiler: 1000 L per interior
  cell). **bar = steamL / volumeL** (so "1 bar" = the network's own volume of steam), clamped 0..12.
- Boiler production (section 6): `makeL = heatW x 0.006 x dt` litres of steam (6 L/s per kW), consuming
  `makeL / 10` litres of water. No water -> no steam (dry timer runs).
- Users each tick, in priority order valve < whistle < engines/hammers (so valves act on the pressure the
  users see): engine takes `6 x bar x drive x dt` where drive = 1 if its shaft network has work or is not
  seized, else 0.1 (idling); hammer takes 30 L per blow; whistle 20 L.
- Engine output: rpm = min(96, 16 x bar), capacity = 128 x bar, only if bar >= 2; else 0 with status
  "Needs 2 bar - has 1.3".
- Natural loss: 0.2% of steamL per second (pipes are not perfect) so idle networks sag slowly.
- Safety valve: if bar > setting, vent `(bar - setting) x volumeL` down to the setting, capped 400 L/s; emit
  `steam:vent` (rate-limited 1/s) for sound and plume.
- Rating = lowest `ratedBar` of members. If bar > rating: `overS += dt`; at overS >= 5 -> BURST the weakest
  member nearest the boiler (tie: first found): `explode(pos, radius 2 for pipes / 3 for a vessel)`, scald
  6 damage within radius 4 (cause 'burn'), steamL = 0, event `steam:burst`. If bar <= rating, overS decays at
  2x. Warning state from 7 bar (or rating - 1): event `steam:warning` on change, HUD sentence, gauge shake.
- Worked example (must become a test): smallest boiler (interior 1x1x2: 2 cells -> water 4000 L, steam volume
  2000 L) + 10 pipes (1000 L) = 3000 L volume; one heat port at 6 kW -> 36 L/s; one engine at equilibrium:
  36 = 6 x bar -> **6 bar, 96 rpm, capacity 768**; two engines: 3 bar each -> 48 rpm, capacity 384 each. With no
  user and no valve: 36 L/s into 3000 L = 0.012 bar/s -> 7 bar after ~9.7 min, burst ~1.4 min + 5 s later.
  (If playtests find that too slow to teach the lesson, raise the per-port heat to 10 kW - do not shrink volume.)

### 5.3 Air (`src/sim/airNet.ts`)
- Members: air_tube, air_tank, air_compressor (source), pressure_gauge, tube_station, press, drill,
  blast_nozzle. State `airL`; **bar = airL / volumeL**, max 6 (compressor makes nothing at 6).
- Compressor: `2 x rpm x dt` litres while its shaft turns at >= 32 rpm.
- Leaks: each tube arm that ends in a non-member, non-solid cell leaks `100 x bar / 6` L/s (hiss event,
  rate-limited). The mesher's join table says which arms exist; expose it to the sim through a registry helper
  so both agree.
- Users: per the table in 4.4; below their minimum they idle with "Needs 3 bar - has 1.8".
- Item transport is NOT in air tubes: see 5.4 (the Bronze Chute and the Vacuum Pump).
- Air hammer: sim action `chargeTool(x, y, z, heldStack)` -> takes up to 300 L, sets charges 60; the held
  stack's `durability` field carries charges (it never breaks at 0, it just stops: "Out of air").

### 5.4 Bronze Chute + Vacuum Pump (owner decision)
Owner: "bronze chute will be in bronze age and will require a pneumatic vacuum to make the items pump towards
the placement on the network where the vacuum is, and then items flow that direction in the pipe".
- A chute network (the existing `item_pipe` graph) with NO running vacuum pump is inert: status on every end
  "No suction - add a Vacuum Pump".
- A Vacuum Pump is a member of the chute network AND of an air network (it has an air_tube connection). It
  runs while its air network holds >= 2 bar and it has room to deliver. While items are moving toward it, it
  uses 30 L/s of air.
- Every chute end touching an inventory is an INLET by default (the wrench sets an end to Off; there is no
  Push/Pull choice on bronze chutes - the vacuum decides direction). Items leave inlets and travel along the
  shortest chute path TOWARD the nearest running vacuum pump, at 8 blocks/s, and are delivered into the
  inventory the pump touches (a crate, a furnace: smart sides apply) or, if it touches none, its 9-slot buffer.
- The inventory the pump itself delivers into is never an inlet for that pump (no loops).
- Two pumps on one network: each inlet feeds its nearest pump (ties: lowest position key). Filters: the pump
  screen has 5 filter slots (allow/deny) - what it will draw in.
- Packets, reservation and "Destination full" reuse `src/sim/itemNet.ts`; what changes is how destinations
  are chosen (always a vacuum pump) and the air cost. In the world the items visibly stream toward the pump and
  the chute glass shows a faint drift in that direction.
- Saves made before this change: existing bronze chutes with Pull/Push ports keep their ports and keep
  working as legacy networks (flag on the network anchor `legacyPorts: true`) until the player edits them.

## 6. The boiler vessel - first multiblock

- Rules (data in a `STRUCTURES` content table, shared scan with the hearth): hollow cuboid, all six sides
  closed; wall/floor/roof = `boiler_plate` (later `iron_boiler_plate` 16 bar); interior air only, 1x1x2 to
  3x3x4 (x, z, y); exactly one `boiler_gauge_glass` in a side face (not an edge); side faces may hold
  heat_port, water_port, steam_port; the roof may hold steam_port and safety_valve; required: >= 1 of each
  port. No glass, no other blocks. Another gauge glass in the shell fails ("Only one Gauge Glass").
- Smallest vessel: interior 1x1x2 -> shell 3x3x4 = 36 cells - 2 interior = 34 blocks: 30 plates + glass +
  three ports. Raw cost about 60 bronze plates' worth: this is the age's big build (tune if the solver or
  playtest says it is a wall: e.g. plate recipe -> 4).
- Formation is automatic (scan next tick after a change in the shell box + 1; retry while unformed only when
  the player is within 16 blocks or its screen is open; one-cell sweep every 4 ticks when formed).
- Grants by interior cells `c`: water capacity 2000 x c L; steam volume 1000 x c L; heat intake 6 kW per heat
  port (max ports = side faces available).
- Water level and steam live on the gauge-glass entity: `{ kind: 'boiler', waterL, dryS, formed: {...} }`;
  steam belongs to the steam network it joins through its steam_ports (if none connected, the vessel is its
  own network of volume 1000 x c).
- Dry fire: heatW > 0 and waterL = 0 -> dryS += dt; from 5 s: rattle sound + status "Boiling dry - add water";
  at 20 s: the vessel warps: unform, one random plate becomes 1 scrap_metal drop, toast. Reset when watered.
- Unforming for any reason never deletes water or parts; steam is lost.
- Screen (opened from the gauge glass or any port): pressure dial (bar, rating marked red), water bar, heat in
  (kW of max), steam out (L/s), valve setting if fitted, STRUCTURE tab (the same component the hearth uses:
  checklist, problems with tap-to-highlight, size steppers, materials have/need, Show in world ghost).

## 7. Contracts (src/core - append only)

```ts
// types.ts
export interface HeatSpec { role: 'conductor' | 'user' | 'port'; capW?: number; lossPerBlock?: number; demandW?: number; minTempC?: number }
export interface GasSpec  { family: 'steam' | 'air'; role: 'pipe' | 'tank' | 'user' | 'source' | 'valve' | 'gauge' | 'port' | 'station';
                            volumeL?: number; ratedBar?: number; minBar?: number; useLPerS?: number; useLPerJob?: number }
// BlockSpec gains: heat?: HeatSpec; gas?: GasSpec; legacy?: boolean
// BlockShape: thermocouples, steam pipes and air tubes reuse 'pipe' (PipeSpec.family gains 'heat' | 'steam' | 'air'
//   so the mesher's join tables and collars work unchanged; families never join each other).
export interface StructureRules { key: string; controller: string; walls: string[]; interior: 'air';
  ceiling: 'required' | 'optional'; minInner: [number, number, number]; maxInner: [number, number, number];
  faceParts: string[]; roofParts: string[]; required: Record<string, number>; edgeParts?: string[] }
// MachineRole gains 'vessel' (boiler controller), 'gas' (steam/air devices without watts or shafts).
```
- gameEvents: `'steam:vent' {x,y,z,rateL}`, `'steam:warning' {x,y,z,bar,rated,on:boolean}`,
  `'steam:burst' {x,y,z,radius}`, `'air:leak' {x,y,z}`, `'boiler:formed' / 'boiler:unformed' {x,y,z}`,
  `'boiler:dry' {x,y,z,seconds}`; flags `heat_moved`, `boiler_formed`, `engine_turning`, `air_2bar`,
  `tube_delivery`, `press_job`; SfxName `valve_shriek`, `boiler_burst`, `boiler_formed`, `boiler_rattle`,
  `air_hiss`, `piston`, `pneumatic_thump`, `tube_whoosh`, `steam_whistle`, `scald`.
- constants: `STEAM_L_PER_KW_S = 6`, `WATER_PER_STEAM = 0.1`, `STEAM_SAG_PER_S = 0.002`, `BURST_SECONDS = 5`,
  `BURST_WARN_MARGIN_BAR = 1`, `VALVE_MAX_VENT_L_S = 400`, `THERMO_LOSS = 0.02`, `THERMO_CAP_W = 6000`,
  `THERMO_BURN_C = 300`, `AIR_MAX_BAR = 6`, `AIR_LEAK_L_S = 100`, `DRY_WARN_S = 5`, `DRY_WARP_S = 20`.
- registry: `STRUCTURES`, `structureOf(controllerKey)`, validation for heat/gas specs and structure rules;
  `smallestShell(rules)` material count for the solver.

## 8. Work items, in order, with acceptance checks

**W0 - six tiers and ages (alone in the repo; before anything else, also before STEAM_PLAN's waves) - DONE (see `docs/api/ages.md`)**

Status: built and tested; the fixture, `migrateSixAges` (save version 2), the Bronze Furnace block (appended last, textures `furnace_bronze_*`),
the renumbering and the moves of the Bronze-age items onto the Bronze Furnace are in. Differences from the text below: the fixture is
`tests/fixtures/save-before-bronze.json`; block ids needed no palette (the new block is appended); `hearth` structure rules are keyed by the
new tier numbers 3-6 and the validator says tiers below `FIRST_HEARTH_TIER` have none; `bronze_furnace` is a new Ember-ending goal and the Blast
hearth goal opens the Forge Age. Still to do from this plan: `requiredParts: { blast_nozzle: 1 }` (B1) and the Blast hearth's air requirement.
1. Insert age 'bronze' at index 1 and furnace tier 2 `furnace_bronze` (block + 4 textures + numbers: 1100 C,
   heat capacity 220, loss 2.2, crucibles 2, fuel slots 2, speed 1.1, warmth 7; upgrade 8 bronze_ingot,
   4 firebrick, 1 bellows at 700 C). Renumber tiers 2-5 -> 3-6 and ages 1-4 -> 2-5 everywhere:
   `rg -n "minTier|furnaceTier|MAX_FURNACE_TIER|tier:|age:|tier \\d of" src scripts docs/api`.
2. Save migration in `src/save/document.ts` (version +1): furnace entities `tier >= 2` -> `+1`; settings and
   objectives untouched (ids). Confirm block ids are saved by key palette (see docs/api/world.md); if raw ids
   are stored, add a palette in this migration.
3. Commit a real save from the CURRENT release build as `tests/fixtures/save-v-before-bronze.json` BEFORE the
   change (make one with the e2e save step), then a test that it loads, its Blast hearth is still formed and
   the objective position is unchanged.
4. AC: typecheck, all unit tests, full `npm run e2e` (scripts must upgrade Clay -> Bronze -> Blast).

**B1/B2 air slice - DONE (see `docs/api/air.md`)**: air_tube, air_tank, air_compressor and blast_nozzle, the air network (`src/sim/airNet.ts`, its own
graph, not pipeGraph), and the Blast hearth's `requiredParts: { blast_nozzle: 1 }` fed at 2 bar. Hearths built before the rule keep working (`legacyHearth`,
save rev 4). The compressor's shaft is the steam work's seam (`AirHost.shaftRpm`); until then Use cranks it by hand.

**B1 - contracts, content, art, sound (alone in the repo)**
Sections 4, 7; objectives of section 9; textures (bronze plate with rivets and seams + formed twin, glass
gauge with water, ports with coloured rings: heat = amber, water = blue, steam = white; rods; tubes with
glass; machines); sounds (measure like earlier engineers). Solver: Bronze needs no electricity; smallest
boiler materials obtainable at tier 2; tier 3 needs blast_nozzle + compressor + a shaft source. Playthrough
stand-ins marked. AC: content tests incl. "no electricity before tier 3", completable, Peaceful completable.

**B2 - simulation (three engineers can split: heat+boiler / steam / air+tubes, after `netGraph.ts` lands)**
0. FIRST, one engineer: `netGraph.ts` generalisation + `Subsystem` registration in `simulation.ts`
   ({ blockChanged, chunkChanged, tick, clear, resync }) + generalised structure scan (`structureScan.ts` from
   `hearthScan.ts`, hearth tests unchanged and green). Commit. Then the three in parallel.
1. Heat + boiler vessel (5.1, 6). 2. Steam (5.2) incl. engine as shaft source. 3. Air + pneumatic tubes +
   tools (5.3).
AC (tests): heat conservation (furnace cools by delivered / efficiency); 2%/block; 6 kW cap; user minimum
temperature; burn query; vessel forms/unforms with every problem code and size; capacities by size; dry-fire
timeline (5 s warn, 20 s warp); steam worked example numbers within 2%; valve holds its setting; burst only
after 5 s over rating and never with a valve <= rating; engine rpm/capacity by bar; sag; air production,
leak, stall at 6; tube sends refused under 2 bar; press/drill/hammer charge; save/load of water, steam, air,
packets; networks split/merge on pipe removal; unloaded chunks; perf: 10 vessels + 500 pipes < 0.3 ms/tick.
Playthrough extended: the scripted player builds the smallest boiler from `structureView` ghost cells, runs
an engine at 6 bar, compresses air, sends ore by tube, forges a blast nozzle, forms the Blast hearth.

**B3 - world/render, UI, player, audio (three engineers in parallel, API notes from B2 first)**
- Render: rods glow by temperature (3 active-texture steps or per-vertex tint from a sim snapshot - choose by
  cost, state which); gauge needles and gauge-glass water level in the parts layer (angle/height = value);
  engine beam + flywheel; valve plume; hiss puffs at leaks; packets in tubes; burst flash, debris, steam cloud;
  formed-shell seam flash. Screenshots at 1280x800 and 390x844: furnace -> rods -> hot plate at night; the
  boiler unformed with ghost, formed, venting, bursting; engine driving the mill; tube post between crates.
- UI: boiler screen (section 6), steam/air network panel on member screens, generic Structure tab moved to
  `src/ui/screens/structure/`, HUD lines: "Boiler pressure high - 7.2 bar of 8", "Boiling dry", gauges as
  target names ("Pressure Gauge - 5.4 bar"), How to Play card "Pressure and air", goal texts (section 9).
- Player: Use on valve cycles 2/4/6/8 (toast "Valve set to 6 bar"), Use with air hammer on tank/tube charges,
  Use on whistle; placing a port/valve into a formed shell replaces a plate only by breaking it first (no
  special case); burn from rods through the survival scan.
- Audio: one-shots of section 7 + ambience fields `boiler` (simmer by pressure), `piston` (by rpm), `air` (hiss
  by leak).
**B4 - wiring, e2e-bronze, review, release**
`scripts/e2e-bronze.mjs` (desktop + phonePortrait, real input, `__hw` only to give materials/tick): upgrade to
the Bronze Furnace; rods to a hot plate, cook; build the smallest boiler from the ghost; heat + water; gauge
reaches 2 bar; engine turns a millstone; with no valve and no user pressure passes the warning (HUD line
seen) and the vessel bursts while the player stands 8 blocks away unhurt; rebuild with a valve: it holds;
compressor to 2 bar; items drawn through a chute by a Vacuum Pump; blast nozzle; Blast hearth forms. Then the six-angle review workflow,
fixes, full suite, republish game + Codex (six ages), README, HANDOFF, PROGRESSION "built" tags.

## 9. Goals of the age (ids, titles, texts, conditions, rewards)

| id | title | completes when | text shown | reward |
|---|---|---|---|---|
| bronze_furnace | Band the furnace in bronze | furnaceTier 2 | "Eight bronze ingots, four firebricks and your bellows turn the Clay Furnace into a Bronze Furnace: 1100 C and two crucibles." | 4 thermocouple |
| move_heat | Move the heat | flag heat_moved (a heat user ran through >= 1 thermocouple) | "Thermocouples carry heat from the furnace. Lay a line to a Hot Plate and cook on it. Mind your hands." | - |
| build_boiler | Build a steam boiler | flag boiler_formed | "A boiler is a sealed box of Boiler Plate with a Gauge Glass and three ports. Open the Structure planner on the Gauge Glass and follow the ghost." | 6 steam_pipe |
| raise_steam | Raise steam | a steam network at >= 2 bar | "Heat to the Heat Port, water to the Water Port. Watch the glass." | 1 pressure_gauge |
| fit_valve | Fit a safety valve | place safety_valve | "Bronze holds 8 bar. Past that it bursts. A Safety Valve lets go first - Use it to choose the pressure." | - |
| piston_power | Piston power | flag engine_turning | "A Steam Engine turns faster with every bar. Run a pipe from the Steam Port." | 2 bronze_gearbox |
| compress_air | Compress air | flag air_2bar | "Put an Air Compressor on a shaft. Air Tubes carry it; an Air Tank stores it. Cap the ends or it leaks." | 8 air_tube |
| pneumatic_post | Pneumatic post | flag tube_delivery | "Lay Bronze Chute from a crate to a Vacuum Pump on your air line. The pump draws everything toward itself." | - |
| press_plates | Press plates | flag press_job | "The Pneumatic Press shapes metal cold: no trip to the forge." | - |
| make_nozzle | Forge a blast nozzle | make blast_nozzle | "A fire fed with forced air burns hot enough for iron. Set this in a brick hearth wall and feed it air." | - |
Next (Forge): blast_furnace now reads "Build brick walls around the furnace with a Blast Nozzle in one wall,
fed by air."

## 10. Status sentences (exact strings the player must see)

Heat: "Carrying 1.2 kW at 640 C" / "No heat - the furnace is below 200 C" / "Line is full - 6 kW" /
"Too cool here - 410 C of 700 C needed: shorten the line".
Boiler: "Formed - 3x3x4, holds 4000 L" / "Not formed" / "5.2 bar - rated 8" / "Pressure high - 7.4 bar of 8:
use the steam or fit a Safety Valve" / "Boiling dry - add water" / "No heat at the Heat Port" / "Warped - a
plate cracked. Replace it."
Engine: "Turning at 80 rpm on 5 bar" / "Needs 2 bar - has 1.3" / "Idling - nothing to turn".
Valve: "Set to 6 bar" / "Venting".
Air: "4.1 bar" / "Leaking - an open tube end at (x, y, z)" (tap highlights it, like hearth problems) /
"Needs 3 bar - has 1.8" / "No air pressure".
Air hammer: "Out of air - Use it on an Air Tank".

## 11. Old world tie-in (the Emberbound and ruins)

- Ruins gain Bronze-age relics: a burst boiler shell (cracked plates, drop scrap), dead gauges, a length of
  tube with a crate still holding a few items. "Deep" loot may hold 2-4 `boiler_plate` or a `pressure_gauge`.
- Bellows Hounds ARE pneumatic: their wind-up is the `air_hiss` family. Forge Wardens' hammer = a steam hammer.
  A new minor automaton fits this age if wanted later: the "Steam Lurcher" that vents scalding steam (not in
  scope; listed so the idea is not lost).

## 12. Risks and how to keep out of them

- Network sprawl (power, shafts, items, fluids, heat, steam, air): B2 step 0 exists to prevent seven
  near-copies. Do not skip it.
- The smallest boiler may be too expensive for the pace of the age: the solver prints the raw budget per tier -
  keep the Bronze total under about 1.5x the Ember total; tune the plate recipe yield first.
- Pressure maths drift: keep ONE definition (bar = stored / volume) for steam and air; every user's rate is
  linear in bar; write the worked example as a test before tuning anything.
- Phones: needles are small - aiming at a gauge must show the number as target text; warnings are text + sound,
  never colour alone.
- Fairness: bursts are opt-in by neglect. A6 and A5 are tests, not hopes.
- Old saves: the legacy one-block boiler and the old steam engine keep working as they did (legacy blocks);
  new ones cannot be crafted.

## 13. Ready-to-paste briefs (chain workflow: `{ model, effort, tasks: [{ label, brief }] }`)

Common preamble as in STEAM_PLAN section 12. Then:
- `bronze:w0` - "REFACTOR: six furnace tiers and six ages. docs/BRONZE_PLAN.md section 2 and work item W0 are
  your whole brief. Nobody else is in the repository. Commit the old-save fixture FIRST. Finish with the full
  npm run e2e."
- `bronze:content` - "FEATURE DATA: the Bronze Age. docs/BRONZE_PLAN.md sections 1, 4, 7, 9, 11 and work item
  B1. Follow names and numbers exactly; report any you change and why."
- `bronze:netgraph` - "REFACTOR: shared network graph, Subsystem registration, generic structure scan.
  docs/BRONZE_PLAN.md B2 step 0. All existing sim tests must stay green and unchanged."
- `bronze:heat+boiler`, `bronze:steam`, `bronze:air` - "FEATURE BEHAVIOUR: docs/BRONZE_PLAN.md sections 5.1 +
  6 / 5.2 / 5.3 and the B2 acceptance list. Write your docs/api note first. Scope: src/sim."
- `bronze:render`, `bronze:ui`, `bronze:player+audio` - "docs/BRONZE_PLAN.md B3 (your bullet), sections 3, 6,
  10. Screenshots at both sizes; look at every one."
- `bronze:wiring` - "docs/BRONZE_PLAN.md B4. Full npm run e2e at the end, reported honestly."


## 14. Pseudocode for the hard parts

Written to be turned into TypeScript nearly line for line. `dt` = 0.05 s. All numbers come from content or
constants; literals here are for reading only.

### 14.1 One graph builder for every network (`src/sim/netGraph.ts`)
```
type Family = { name; isMember(def, voxel) -> bool; joins(aDef, aVoxel, bDef, bVoxel, dir) -> bool }
class NetGraph<N>:
  nets: Map<id, Net<N>>           // Net = { id, cells: Int32Array (packed xyz), anchorKey, data: N, dirty }
  cellNet: Map<posKey, id>
  dirty: Set<posKey>

  blockChanged(x,y,z, fromDef, toDef):
    if family.isMember(fromDef) or family.isMember(toDef) or touchesMember(x,y,z):
      dirty.add(key(x,y,z)); for each of 6 neighbours: dirty.add(neighbour)

  rebuild(world, makeData, splitData, mergeData):        // called at the start of a tick if dirty not empty
    affected = { cellNet[k] for k in dirty if present }
    seeds    = cells of affected nets + dirty cells that are members now
    oldData  = affected nets' data (with their cell lists)       // for conservation
    delete affected nets
    for seed in seeds, not yet visited:
      cells = floodFill(seed)          // BFS, cap 1024; a chunk not loaded -> mark net.waiting = true and stop there
      net = new Net(cells); net.data = makeData(net)
      // conservation: every old net hands its amount to the new nets that contain its old cells,
      // split in proportion to the number of old cells each new net received
      for o in oldData: share = count(cells in o.cells) / o.cells.length
                        if share > 0: mergeData(net.data, splitData(o.data, share))
    dirty.clear()
  anchor(net) = lowest posKey cell; its block entity stores net.data for saving
```
Tests: place/remove in the middle splits and conserves; joining two nets merges; unloaded chunk waits; 1024 cap.

### 14.2 Heat network tick (`heatNet.ts`)
```
onRebuild(net):
  net.sources = members touching a furnace/hearth shell (>= 200 C) or lava
  net.users   = hot_plate, heat_vent, heat_port, copper_kettle touching a member
  for u in users: for s in sources: dist[u][s] = bfsBlocks(u.touchCell -> s.touchCell)   // thermocouple count
  for cell in net.cells: distToAnySource[cell] = multi-source BFS

tick(net, dt):
  capLeft = THERMO_CAP_W
  net.delivering = false
  for u in users sorted by nearest source distance:
    want = u.demandW()                     // 0 if idle (no job, boiler full of steam, room warm...)
    if want <= 0: u.deliveredW = 0; continue
    best = argmax over s of  T(s) * 0.98 ^ dist[u][s]
    Tdel = T(best) * 0.98 ^ dist[u][best]
    if Tdel < u.minTempC: u.deliveredW = 0; u.status = tooCool(Tdel, u.minTempC); continue
    w = min(want, capLeft, sourceLimit(best))
    capLeft -= w
    u.deliveredW = w; u.deliveredTempC = Tdel
    charge(best, w / 0.98 ^ dist[u][best])       // furnace: extractW += ...; lava: per-face budget
    net.delivering = net.delivering or w > 0
  // per-block temperature for glow and burns
  for cell: target = net.delivering ? Thottest * 0.98 ^ distToAnySource[cell] : AMBIENT
            temp[cell] += (target - temp[cell]) * min(1, 0.5 * dt * (target > temp[cell] ? 4 : 1))
hotAt(x,y,z) = temp[cell] if member else 0       // survival's 2 Hz contact scan asks this
```

### 14.3 Steam network tick, with valve and burst (`steamNet.ts`)
```
tick(net, dt):
  vol = net.volumeL                                     // cached on rebuild (pipes, tanks, formed vessels)
  // 1. make
  for b in net.boilers:                                 // formed vessels joined through steam ports
    heatW = sum(port.deliveredW for port in b.heatPorts)
    if b.waterL > 0 and heatW > 0:
      make = heatW / 1000 * STEAM_L_PER_KW_S * dt
      water = min(b.waterL, make * WATER_PER_STEAM)
      b.waterL -= water; net.steamL += water / WATER_PER_STEAM; b.dryS = 0
    else if heatW > 0: b.dryS += dt; dryFire(b)         // 14.6
  bar = net.steamL / vol
  // 2. valves first: they define the pressure users see
  for v in net.valves:
    if bar > v.setting:
      vent = min((bar - v.setting) * vol, VALVE_MAX_VENT_L_S * dt)
      net.steamL -= vent; bar = net.steamL / vol; emitRateLimited('steam:vent', v, vent / dt)
  // 3. users, pro rata if steam is short
  want = sum(u.wantL(bar, dt))                          // engine: 6 * bar * drive * dt ; hammer: per blow
  k = want > 0 ? min(1, net.steamL / want) : 0
  for u in users: got = u.wantL * k; net.steamL -= got; u.apply(bar, got / max(u.wantL, eps))
  // 4. sag
  net.steamL *= 1 - STEAM_SAG_PER_S * dt
  bar = clamp(net.steamL / vol, 0, 12); net.bar = bar
  // 5. danger
  rated = net.ratedBar                                  // min over members
  warn = bar >= rated - BURST_WARN_MARGIN_BAR
  if warn != net.warn: net.warn = warn; emit('steam:warning', { bar, rated, on: warn })
  if bar > rated: net.overS += dt else net.overS = max(0, net.overS - 2 * dt)
  if net.overS >= BURST_SECONDS: burst(net)

burst(net):
  m = weakest member (lowest ratedBar; tie -> nearest to a boiler; tie -> lowest posKey)
  radius = m is vessel shell ? 3 : 2
  net.steamL = 0; net.overS = 0
  scheduleExplosion(m.pos, radius, { scaldDamage: 6, scaldRadius: 4, cause: 'burn', dropHalfOf: vessel plates })
  emit('steam:burst', ...)                              // explosion code already exists for meltdowns

engine.apply(bar, satisfied):
  if bar < 2: rpm = 0; status = needsBar(2, bar); return
  rpm = min(96, 16 * bar) * satisfied; capacity = 128 * bar * satisfied
  -> feeds the shaft solver as a source (STEAM_PLAN section 3)
engine.drive = its shaft network has load and is not seized ? 1 : 0.1
```
Test to write first: the worked example in 5.2 (6 kW, one engine -> 6 bar within 2%; two engines -> 3 bar).

### 14.4 Air network and the vacuum-drawn chute (`airNet.ts`, changes in `itemNet.ts`)
```
air.tick(net, dt):
  for c in compressors: if c.rpm >= 32 and net.bar < AIR_MAX_BAR: net.airL += 2 * c.rpm * dt
  for end in net.openEnds: net.airL -= AIR_LEAK_L_S * (net.bar / AIR_MAX_BAR) * dt; emitRateLimited('air:leak', end)
  users take per job / per second as in 4.4, refused below their minBar
  net.bar = clamp(net.airL / net.volumeL, 0, AIR_MAX_BAR)

// chute network = existing item pipe graph. New: destinations are vacuum pumps only.
chute.onRebuild(net):
  net.pumps  = vacuum_pump members
  net.inlets = chute ends touching an inventory, mode != off, excluding each pump's own delivery inventory
  for p in pumps: distFrom[p] = BFS over chute cells from p          // field: steps to pump
  for inlet: inlet.pump = argmin over running-capable pumps of distFrom[p][inlet.cell]
             inlet.path = walk from inlet.cell always stepping to a neighbour with smaller distFrom[pump]

chute.tick(net, dt):
  for p in pumps: p.running = p.on and airNetOf(p).bar >= 2 and p.hasRoom()
  moving = false
  for inlet in net.inlets (round robin start index):
    p = inlet.pump; if !p or !p.running: inlet.status = p ? 'No air pressure' : 'No suction - add a Vacuum Pump'; continue
    if inlet.cooldown > 0: inlet.cooldown -= dt; continue
    stack = first extractable stack passing p.filter
    if !stack: inlet.status = 'Nothing to draw'; continue
    n = min(16, stack.count, p.reserveRoom(stack.item))               // reservation exactly as itemNet does today
    if n == 0: inlet.status = 'Destination full'; continue
    extract(n); packets.push({ item, n, path: inlet.path, to: p, t: 0, dur: path.length / 8 })
    inlet.cooldown = 0.5
  for pk in packets: pk.t += dt; moving = true
     if pk.t >= pk.dur: p.deliver(pk) or (p.buffer.add) or returnToSource(pk)   // never drop items
  for p in pumps: if moving toward p: airNetOf(p).airL -= 30 * dt
```
Render reads the same packet list the renderer already consumes (`sim.transportView()`).

### 14.5 One structure scan for hearths and boilers (`structureScan.ts`)
```
scan(world, controllerPos, facing, rules: StructureRules) -> { ok, inner, cells[], problems[] (max 8), parts{} }:
  start = controllerPos + behind(facing)                 // first interior cell
  if !isAir(start): return fail('interior', start, 'Interior must be empty')
  // 1. size of the interior box on the controller's layer
  for dir in [left, right, back]: walk air from start until a non-air cell, max rules.maxInner + 1
      if ran out: return fail('too_large' or 'gap', lastCell)     // 'gap' if a previous formed box exists there
  x0..x1, z0..z1 from the walks
  // 2. extend down then up while every interior cell of the layer is air
  y0 = lowest layer still all air;  y1 = highest layer still all air (cap rules.maxInner.y)
  if size < rules.minInner: fail('too_small')
  // 3. classify every shell cell of the box (inner box grown by 1)
  for cell in shell:
    role = on 2 or 3 faces at once ? 'edge' : y == y0-1 ? 'floor' : y == y1+1 ? 'roof' : 'face'
    b = block at cell
    if cell == controllerPos: require role == 'face'
    else if b in rules.walls: count wall tier
    else if role == 'face' and b in rules.faceParts: parts[b]++
    else if role == 'roof' and b in rules.roofParts: parts[b]++
    else if role == 'roof' and rules.ceiling == 'optional' and isAir(b): openTop = true
    else problems.push({ code: role == 'edge' ? 'edge_block' : 'wrong_block', pos: cell, need: rules.walls[0] })
    if b is another controller of the same rules: problems.push('other_controller')
  for (part, n) in rules.required: if parts[part] < n: problems.push({ code: 'missing_part', part, need: n - parts[part] })
  ok = problems.length == 0
```
The hearth passes its tier rules (and picks the highest tier whose rules pass); the boiler passes 6. The
existing hearth tests must pass unchanged against the generalised function before the boiler is written.

### 14.6 Boiler vessel runtime (`boilerVessel.ts`)
```
track(controller): entry = { e, formed: null, dirty: true, retryS: 0, sweep: 0 }
tick(dt):
  for v in vessels (chunk loaded):
    if v.dirty or (!v.formed and playerNear(v, 16) and (v.retryS += dt) >= 1):
      r = scan(world, v.pos, facing, STRUCTURES.boiler); v.dirty = false; v.retryS = 0
      if r.ok and !v.formed: form(v, r)        // set active bits on shell, capacities, join steam nets, event + sfx
      if !r.ok and v.formed: unform(v, r)      // clear bits, keep water, drop steam, toast with first problem
      v.lastResult = r
    else if v.formed and tick % 4 == 0: check one shell cell (v.sweep++); mismatch -> v.dirty = true
    if v.formed: fill water from water ports (fluid endpoint), clamp to capacity
dryFire(b):
  if b.dryS >= DRY_WARN_S and !b.warned: b.warned = true; emit('boiler:dry'); sfx 'boiler_rattle' every 2 s
  if b.dryS >= DRY_WARP_S: replace one random shell plate with air + give/leave 1 scrap_metal; unform; toast
blockChanged(x,y,z): for v whose box grown by 1 contains (x,y,z): v.dirty = true
```

> **Ground items (built):** dropped items are world entities (`docs/api/ground-items.md`). The Bronze Age also gets a handheld
> **Hand Vacuum Pump** (`hand_vacuum`, wear-powered, radius 9) that pulls ground items to the player. It is not the chute machine
> `vacuum_pump` below. (Done in W0: `hand_vacuum` is `forge(2, ...)`, age 1.)
> The Current Age Electromagnet is the same mechanism with an electric power source (`COLLECTORS` in `src/game/collectors.ts`).
